import { NextResponse } from 'next/server'
import { getProject, saveTestItems, updateJob } from '@/lib/db'
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
    model: modelOverride || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const body = await req.json()
  const {
    jobId, projectId, batchNum, totalBatches, batchSize, alreadyCount,
    perspectives, targetPages = null, modelOverride,
  }: {
    jobId: string; projectId: string; batchNum: number; totalBatches: number
    batchSize: number; alreadyCount: number; perspectives?: string[]
    targetPages: PageInfo[] | null; modelOverride?: string
  } = body

  log(jobId, `batch ${batchNum}/${totalBatches} size=${batchSize} already=${alreadyCount}`)

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
    log(jobId, `RAG: doc=${docChunks.length} site=${siteChunks.length} src=${sourceChunks.length}`)

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
    log(jobId, `Prompt: system=${systemPrompt.length}c user=${userPrompt.length}c`)
    log(jobId, '[SYSTEM PROMPT]\n' + systemPrompt)
    log(jobId, '[USER PROMPT]\n' + userPrompt.slice(0, 2000))

    // KVにデバッグ情報を保存（バッチ1のみ、その後は上書きしない）
    if (batchNum === 1) {
      await updateJob(jobId, {
        stage: 2,
        message: `AI生成中... (バッチ 1/${totalBatches})`,
        // @ts-ignore
        debugPrompt: {
          system: systemPrompt.slice(0, 1500),
          user: userPrompt.slice(0, 3000),
          totalChunks: allChunks.length,
          ragBreakdown: `Doc:${docChunks.length} Site:${siteChunks.length} Src:${sourceChunks.length}`,
        },
        breakdown: {
          documents: docChunks.length,
          siteAnalysis: siteChunks.length,
          sourceCode: sourceChunks.length,
        },
      })
    }

    const { client, model } = createAIClient(modelOverride)
    log(jobId, `model=${model}`)

    const abortController = new AbortController()
    const remaining = ABORT_AT_MS - (Date.now() - startedAt)
    const abortTimer = setTimeout(() => {
      log(jobId, 'ABORT: timeout')
      abortController.abort()
    }, Math.max(remaining, 1000))

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
          log(jobId, `streaming: ${charCount}c elapsed=${elapsed}s`)
          await updateJob(jobId, {
            stage: 2,
            message: `AI生成中... (バッチ ${batchNum}/${totalBatches} / ${alreadyCount}件生成済 / ${charCount}文字 / ${elapsed}秒)`,
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

    log(jobId, `Stream done: ${charCount}chars aborted=${aborted}`)
    log(jobId, `[AI OUTPUT preview]\n${fullContent.slice(0, 500)}`)

    const items = parseTestItems(fullContent, projectId)
    log(jobId, `Parsed: ${items.length} items`)

    if (items.length > 0) {
      await saveTestItems(items)
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    return NextResponse.json({ ok: true, count: items.length, aborted, elapsed, model,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: sourceChunks.length }
    })

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? (e.stack || '').slice(0, 500) : ''
    log(jobId, 'ERROR:', message, stack)
    await updateJob(jobId, { status: 'error', error: message, // @ts-ignore
      debugError: stack })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
