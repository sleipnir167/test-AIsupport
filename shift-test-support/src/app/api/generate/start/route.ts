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

const ABORT_AT_MS = 54_000

function log(jobId: string, ...args: unknown[]) {
  console.log(`[generate][${jobId}][${new Date().toISOString()}]`, ...args)
}

// モデル名からAIクライアントを生成（フロントから指定可能）
function createAIClient(modelOverride?: string): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: modelOverride || process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
    model: modelOverride || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3-0324',
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { projectId, maxItems = 100, perspectives, targetPages = null, modelOverride }:
    { projectId: string; maxItems: number; perspectives?: string[]; targetPages: PageInfo[] | null; modelOverride?: string } = body

  if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

  const jobId = uuidv4()
  const startedAt = Date.now()
  log(jobId, `START projectId=${projectId} maxItems=${maxItems} model=${modelOverride || 'env'}`)

  const now = new Date().toISOString()
  const job: GenerationJob = {
    id: jobId, projectId,
    status: 'running', stage: 0, message: 'RAG検索中...',
    createdAt: now, updatedAt: now,
  }
  await saveJob(job)

  try {
    // Step 1: RAG検索
    await updateJob(jobId, { stage: 0, message: 'RAG検索中...' })

    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, 30),
      searchChunks(pageQuery, projectId, 20, 'site_analysis'),
      searchChunks(pageQuery, projectId, 40, 'source_code'),
    ])
    log(jobId, `RAG: doc=${docChunks.length} site=${siteChunks.length} src=${sourceChunks.length}`)

    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    // Step 2: プロンプト構築
    await updateJob(jobId, {
      stage: 1,
      message: `プロンプト構築中 (Doc:${docChunks.length} Site:${siteChunks.length} Code:${sourceChunks.length})`,
    })

    const { systemPrompt, userPrompt } = buildPrompts(
      project.name, project.targetSystem, allChunks,
      { maxItems, perspectives, targetPages }
    )
    log(jobId, `Prompt: system=${systemPrompt.length}c user=${userPrompt.length}c`)
    log(jobId, '[SYSTEM PROMPT]\n' + systemPrompt)
    log(jobId, '[USER PROMPT]\n' + userPrompt.slice(0, 1500))

    await updateJob(jobId, {
      stage: 2,
      message: `AI生成中...`,
      // @ts-ignore
      debugPrompt: {
        system: systemPrompt.slice(0, 1000),
        user: userPrompt.slice(0, 2000),
        totalChunks: allChunks.length,
      },
    })

    // Step 3: AI呼び出し
    const { client, model } = createAIClient(modelOverride)
    log(jobId, `AI call: model=${model}`)

    const abortController = new AbortController()
    const abortTimer = setTimeout(() => {
      log(jobId, 'ABORT: 54s timeout protection triggered')
      abortController.abort()
    }, ABORT_AT_MS - (Date.now() - startedAt))

    const aiStream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 16000,
      stream: true,
    }, { signal: abortController.signal })

    log(jobId, 'Stream opened')

    let fullContent = ''
    let charCount = 0
    let lastKvUpdate = 0
    let aborted = false

    try {
      for await (const chunk of aiStream) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (!delta) continue
        fullContent += delta
        charCount += delta.length
        if (charCount - lastKvUpdate >= 2000) {
          const elapsed = Math.round((Date.now() - startedAt) / 1000)
          log(jobId, `Streaming: ${charCount}chars elapsed=${elapsed}s`)
          await updateJob(jobId, { stage: 2, message: `AI生成中... (${charCount}文字 / ${elapsed}秒経過)` })
          lastKvUpdate = charCount
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError' || abortController.signal.aborted) {
        aborted = true
        log(jobId, `Stream aborted at ${charCount}chars`)
      } else {
        throw e
      }
    } finally {
      clearTimeout(abortTimer)
    }

    log(jobId, `Stream done: total=${charCount}chars aborted=${aborted}`)

    // Step 4: パース・保存
    await updateJob(jobId, { stage: 3, message: aborted ? '途中結果を保存中...' : 'テスト項目を保存中...' })

    let items = parseTestItems(fullContent, projectId)
    log(jobId, `Parsed: ${items.length} items`)

    // タイムアウトでJSONが不完全な場合、途中まで切り出して再パース
    if (items.length === 0 && aborted && fullContent.includes('{')) {
      const lastBrace = fullContent.lastIndexOf('},')
      if (lastBrace > 0) {
        try {
          items = parseTestItems(fullContent.slice(0, lastBrace) + '}]', projectId)
          log(jobId, `Partial parse: ${items.length} items`)
        } catch {
          log(jobId, 'Partial parse also failed')
        }
      }
    }

    if (items.length === 0) {
      throw new Error(
        aborted
          ? `タイムアウトにより生成を中断しました（${charCount}文字生成済）。\n使用モデル: ${model}\n推奨: google/gemini-flash-1.5 または openai/gpt-4o-mini`
          : 'AIの応答からテスト項目を取得できませんでした'
      )
    }

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

    const elapsed = Math.round((Date.now() - startedAt) / 1000)

    await updateJob(jobId, {
      status: 'completed',
      stage: 4,
      message: aborted ? `途中保存で完了` : `完了`,
      count: items.length,
      // @ts-ignore
      isPartial: aborted,
      breakdown: { documents: docChunks.length, siteAnalysis: siteChunks.length, sourceCode: sourceChunks.length },
      model,
      elapsed,
    })
    log(jobId, `DONE: ${items.length} items in ${elapsed}s partial=${aborted}`)

    return NextResponse.json({ jobId, status: 'completed', count: items.length, isPartial: aborted })

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? (e.stack || '') : ''
    log(jobId, 'ERROR:', message)
    await updateJob(jobId, {
      status: 'error',
      error: message,
      // @ts-ignore
      debugError: stack.slice(0, 500),
    })
    return NextResponse.json({ jobId, status: 'error', error: message }, { status: 500 })
  }
}
