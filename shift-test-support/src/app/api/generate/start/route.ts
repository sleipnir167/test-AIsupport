import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getProject, updateProject, saveTestItems, clearTestItems, saveJob, updateJob, GenerationJob } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPrompts, parseTestItems } from '@/lib/ai'
import OpenAI from 'openai'
import type { PageInfo } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function createAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
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

  // ジョブを作成して即座にIDを返す
  const jobId = uuidv4()
  const now = new Date().toISOString()
  const job: GenerationJob = {
    id: jobId, projectId,
    status: 'pending', stage: 0, message: 'ジョブを開始しています...',
    createdAt: now, updatedAt: now,
  }
  await saveJob(job)

  // バックグラウンドで非同期処理（waitUntil相当 - Vercelでは同一リクエスト内で実行）
  runGeneration(jobId, projectId, maxItems, perspectives, targetPages, project).catch(e => {
    console.error('Background generation error:', e)
    updateJob(jobId, { status: 'error', error: e instanceof Error ? e.message : 'AI生成に失敗しました' })
  })

  // jobIdを即返す（処理はバックグラウンドで継続）
  return NextResponse.json({ jobId })
}

async function runGeneration(
  jobId: string,
  projectId: string,
  maxItems: number,
  perspectives: string[] | undefined,
  targetPages: PageInfo[] | null,
  project: Awaited<ReturnType<typeof getProject>>
) {
  if (!project) return

  try {
    // Step 1: RAG検索
    await updateJob(jobId, { status: 'running', stage: 0, message: 'RAG検索中...' })

    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, 12),
      searchChunks(pageQuery, projectId, 8, 'site_analysis'),
      searchChunks(pageQuery, projectId, 6, 'source_code'),
    ])

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

    // Step 3: AI生成（ストリーミングで受信しつつKVに進捗を書く）
    await updateJob(jobId, { stage: 2, message: 'AI生成中...' })

    const { client, model } = createAIClient()
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

    let fullContent = ''
    let charCount = 0
    let lastKvUpdate = 0

    for await (const chunk of aiStream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      if (!delta) continue
      fullContent += delta
      charCount += delta.length
      // 2000文字ごとにKVに進捗を書き込む（KVへの書き込み回数を抑制）
      if (charCount - lastKvUpdate >= 2000) {
        await updateJob(jobId, { stage: 2, message: `AI生成中... (${charCount}文字)` })
        lastKvUpdate = charCount
      }
    }

    // Step 4: 保存
    await updateJob(jobId, { stage: 3, message: 'テスト項目を保存中...' })

    const items = parseTestItems(fullContent, projectId)

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

    // 完了
    await updateJob(jobId, {
      status: 'completed',
      stage: 4,
      message: '完了',
      count: items.length,
      breakdown: {
        documents: docChunks.length,
        siteAnalysis: siteChunks.length,
        sourceCode: sourceChunks.length,
      },
      model,
    })
  } catch (e) {
    await updateJob(jobId, {
      status: 'error',
      error: e instanceof Error ? e.message : 'AI生成に失敗しました',
    })
  }
}
