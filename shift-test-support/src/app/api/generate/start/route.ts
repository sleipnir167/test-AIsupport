import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import {
  getProject, updateProject,
  saveTestItems, clearTestItems,
  saveJob, updateJob,
  type GenerationJob,
} from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPrompts, parseTestItems } from '@/lib/ai'
import OpenAI from 'openai'
import type { PageInfo } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function log(jobId: string, ...args: unknown[]) {
  const ts = new Date().toISOString()
  console.log(`[generate][${jobId}][${ts}]`, ...args)
}

function createAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  log('init', 'AI_PROVIDER:', provider)
  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://shift-test-support.vercel.app',
        'X-Title': 'Shift AI Test Support',
      },
    }),
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { projectId, maxItems = 100, perspectives, targetPages = null }:
    { projectId: string; maxItems: number; perspectives?: string[]; targetPages: PageInfo[] | null } = body

  if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

  const jobId = uuidv4()
  log(jobId, 'START projectId:', projectId, 'maxItems:', maxItems)

  const now = new Date().toISOString()
  const job: GenerationJob = {
    id: jobId, projectId,
    status: 'running', stage: 0, message: 'RAG検索中...',
    createdAt: now, updatedAt: now,
  }
  await saveJob(job)
  log(jobId, 'Job saved to KV')

  try {
    // ── Step 1: RAG検索 ─────────────────────────────────
    log(jobId, 'Step1: RAG search start')
    await updateJob(jobId, { stage: 0, message: 'RAG検索中...' })

    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, 12),
      searchChunks(pageQuery, projectId, 8, 'site_analysis'),
      searchChunks(pageQuery, projectId, 6, 'source_code'),
    ])
    log(jobId, `Step1 done: doc=${docChunks.length} site=${siteChunks.length} src=${sourceChunks.length}`)

    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    // ── Step 2: プロンプト構築 ───────────────────────────
    log(jobId, 'Step2: build prompt')
    await updateJob(jobId, {
      stage: 1,
      message: `プロンプト構築中 (Doc:${docChunks.length} Site:${siteChunks.length} Code:${sourceChunks.length})`,
    })

    const { systemPrompt, userPrompt } = buildPrompts(
      project.name, project.targetSystem, allChunks,
      { maxItems, perspectives, targetPages }
    )
    log(jobId, `Step2 done: systemPrompt=${systemPrompt.length}chars userPrompt=${userPrompt.length}chars`)
    // プロンプトの先頭300文字をログに出力
    log(jobId, 'systemPrompt preview:', systemPrompt.slice(0, 300))
    log(jobId, 'userPrompt preview:', userPrompt.slice(0, 500))

    // プロンプトをKVに保存（UIで確認できるように）
    await updateJob(jobId, {
      stage: 1,
      message: `プロンプト構築完了`,
      // @ts-ignore 拡張フィールド
      debugPrompt: {
        system: systemPrompt.slice(0, 1000),
        user: userPrompt.slice(0, 2000),
        totalChunks: allChunks.length,
      },
    })

    // ── Step 3: AI呼び出し ──────────────────────────────
    const { client, model } = createAIClient()
    log(jobId, `Step3: AI call model=${model} maxItems=${maxItems}`)
    await updateJob(jobId, { stage: 2, message: `AI生成中... (model: ${model})` })

    const aiStream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 16000,
      stream: true,
    })
    log(jobId, 'Step3: stream opened')

    let fullContent = ''
    let charCount = 0
    let lastKvUpdate = 0

    for await (const chunk of aiStream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      if (!delta) continue
      fullContent += delta
      charCount += delta.length
      if (charCount - lastKvUpdate >= 3000) {
        log(jobId, `streaming: ${charCount} chars`)
        await updateJob(jobId, { stage: 2, message: `AI生成中... (${charCount}文字)` })
        lastKvUpdate = charCount
      }
    }
    log(jobId, `Step3 done: total=${charCount}chars`)

    // ── Step 4: パース・保存 ────────────────────────────
    log(jobId, 'Step4: parse and save')
    await updateJob(jobId, { stage: 3, message: 'テスト項目を保存中...' })

    const items = parseTestItems(fullContent, projectId)
    log(jobId, `Step4: parsed ${items.length} items`)

    if (targetPages && targetPages.length > 0) {
      await saveTestItems(items)
    } else {
      await clearTestItems(projectId)
      await saveTestItems(items)
    }

    await updateProject({
      ...project,
      status: 'generated',
      testItemCount: (targetPages?.length ? project.testItemCount : 0) + items.length,
      updatedAt: new Date().toISOString(),
    })

    await updateJob(jobId, {
      status: 'completed', stage: 4, message: '完了',
      count: items.length,
      breakdown: { documents: docChunks.length, siteAnalysis: siteChunks.length, sourceCode: sourceChunks.length },
      model,
    })
    log(jobId, `COMPLETED: ${items.length} items`)

    return NextResponse.json({ jobId, status: 'completed', count: items.length })

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : ''
    log(jobId, 'ERROR:', message, stack)
    await updateJob(jobId, {
      status: 'error',
      error: message,
      // @ts-ignore
      debugError: stack?.slice(0, 500),
    })
    return NextResponse.json({ jobId, status: 'error', error: message }, { status: 500 })
  }
}
