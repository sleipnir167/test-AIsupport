/**
 * /api/generate/batch
 * 
 * 1バッチ分（50件）のAI生成を実行してKVに追記する。
 * 60秒以内に必ず完了する設計。
 * 呼び出し元（/start or フロント）が必要な回数だけ連続で呼ぶ。
 */
import { NextResponse } from 'next/server'
import {
  getProject, saveTestItems, updateJob,
} from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPrompts, parseTestItems } from '@/lib/ai'
import OpenAI from 'openai'
import type { PageInfo } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ABORT_AT_MS = 52_000

function log(jobId: string, ...args: unknown[]) {
  console.log(`[batch][${jobId}][${new Date().toISOString()}]`, ...args)
}

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
    model: modelOverride || process.env.OPENROUTER_MODEL || 'google/gemini-flash-1.5',
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const body = await req.json()
  const {
    jobId,
    projectId,
    batchNum,
    totalBatches,
    batchSize,
    alreadyCount,
    perspectives,
    targetPages = null,
    modelOverride,
  }: {
    jobId: string
    projectId: string
    batchNum: number
    totalBatches: number
    batchSize: number
    alreadyCount: number
    perspectives?: string[]
    targetPages: PageInfo[] | null
    modelOverride?: string
  } = body

  log(jobId, `batch ${batchNum}/${totalBatches} batchSize=${batchSize} already=${alreadyCount}`)

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  try {
    await updateJob(jobId, {
      stage: 2,
      message: `AI生成中... (バッチ ${batchNum}/${totalBatches} / ${alreadyCount}件生成済)`,
    })

    // RAG検索
    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, 20),
      searchChunks(pageQuery, projectId, 10, 'site_analysis'),
      searchChunks(pageQuery, projectId, 20, 'source_code'),
    ])

    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    const { systemPrompt, userPrompt } = buildPrompts(
      project.name, project.targetSystem, allChunks,
      { maxItems: batchSize, perspectives, targetPages }
    )

    const { client, model } = createAIClient(modelOverride)
    log(jobId, `model=${model} batchSize=${batchSize}`)

    const abortController = new AbortController()
    const remaining = ABORT_AT_MS - (Date.now() - startedAt)
    const abortTimer = setTimeout(() => {
      log(jobId, 'ABORT: timeout')
      abortController.abort()
    }, remaining)

    const aiStream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 12000,
      stream: true,
    }, { signal: abortController.signal })

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
          log(jobId, `streaming: ${charCount}c elapsed=${elapsed}s`)
          await updateJob(jobId, {
            stage: 2,
            message: `AI生成中... (バッチ ${batchNum}/${totalBatches} / ${alreadyCount}件生成済 / ${elapsed}秒)`,
          })
          lastKvUpdate = charCount
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError' || abortController.signal.aborted) {
        aborted = true
        log(jobId, `aborted at ${charCount}c`)
      } else {
        throw e
      }
    } finally {
      clearTimeout(abortTimer)
    }

    const items = parseTestItems(fullContent, projectId)
    log(jobId, `parsed ${items.length} items aborted=${aborted}`)

    if (items.length > 0) {
      await saveTestItems(items)
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    return NextResponse.json({
      ok: true,
      count: items.length,
      aborted,
      elapsed,
      model,
    })

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log(jobId, 'ERROR:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
