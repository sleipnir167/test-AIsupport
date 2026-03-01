/**
 * POST /api/generate/batch
 *
 * プランのバッチ1件を受け取り、詳細なテスト項目を生成して保存する（LLM②）
 * フロントエンドがtotalBatches回呼び出す。
 */
import { NextResponse } from 'next/server'
import { getProject, saveTestItems, updateJob, saveAILog, getPromptTemplate, getAdminSettings } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildBatchFromPlanPrompts, parseTestItems, type BuildPromptsResult } from '@/lib/ai'
import OpenAI from 'openai'
import type { TestPlanBatch } from '@/types'
import { v4 as uuidv4 } from 'uuid'

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

function estimateTokens(text: string): number {
  const japanese = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length
  return Math.ceil(japanese + (text.length - japanese) / 4)
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const body = await req.json()
  const {
    jobId,
    projectId,
    batchNum,
    totalBatches,
    alreadyCount,
    planBatch,
    batchSize,
    perspectives,
    perspectiveWeights,
    targetPages = null,
    modelOverride,
    ragTopK = { doc: 100, site: 40, src: 100 },
  }: {
    jobId: string
    projectId: string
    batchNum: number
    totalBatches: number
    alreadyCount: number
    planBatch?: TestPlanBatch
    batchSize?: number
    perspectives?: string[]
    perspectiveWeights?: Array<{ value: string; count: number }>
    targetPages?: Array<{ url: string; title: string }> | null
    modelOverride?: string
    ragTopK?: { doc: number; site: number; src: number }
  } = body

  log(jobId, `batch ${batchNum}/${totalBatches} planBatch=${!!planBatch} already=${alreadyCount}`)

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const [adminSettings, promptTemplate] = await Promise.all([
    getAdminSettings(),
    getPromptTemplate(),
  ])

  try {
    await updateJob(jobId, {
      stage: 2,
      message: planBatch
        ? `AI生成中... (バッチ ${batchNum}/${totalBatches}: ${planBatch.category} / ${planBatch.perspective} / ${alreadyCount}件生成済)`
        : `AI生成中... (バッチ ${batchNum}/${totalBatches} / ${alreadyCount}件生成済)`,
    })

    // RAGクエリをプランのカテゴリ・観点に特化させる
    const baseQuery = planBatch
      ? `${project.targetSystem} ${planBatch.category} ${planBatch.perspective} テスト 要件 画面 操作`
      : `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, ragTopK.doc),
      searchChunks(pageQuery, projectId, ragTopK.site, 'site_analysis'),
      searchChunks(pageQuery, projectId, ragTopK.src, 'source_code'),
    ])
    log(jobId, `RAG: doc=${docChunks.length} site=${siteChunks.length} src=${sourceChunks.length}`)

    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    let result: BuildPromptsResult
    if (planBatch) {
      result = buildBatchFromPlanPrompts(
        project.name,
        project.targetSystem,
        allChunks,
        {
          batchId: batchNum,
          totalBatches,
          category: planBatch.category,
          perspective: planBatch.perspective,
          titles: planBatch.titles,
          customSystemPrompt: promptTemplate.systemPrompt,
        }
      )
    } else {
      const { buildPrompts } = await import('@/lib/ai')
      result = buildPrompts(
        project.name,
        project.targetSystem,
        allChunks,
        {
          maxItems: batchSize ?? 50,
          perspectives,
          perspectiveWeights,
          targetPages,
          customSystemPrompt: promptTemplate.systemPrompt,
        }
      )
    }

    const { systemPrompt, userPrompt, refMap } = result
    log(jobId, `Prompt: system=${systemPrompt.length}c user=${userPrompt.length}c`)

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
      temperature: adminSettings.defaultTemperature,
      max_tokens: adminSettings.defaultMaxTokens,
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
          await updateJob(jobId, {
            stage: 2,
            message: planBatch
              ? `AI生成中... (バッチ ${batchNum}/${totalBatches}: ${planBatch.category} / ${charCount}文字 / ${elapsed}秒)`
              : `AI生成中... (バッチ ${batchNum}/${totalBatches} / ${alreadyCount}件生成済 / ${charCount}文字 / ${elapsed}秒)`,
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

    const items = parseTestItems(fullContent, projectId, refMap ?? [])
    log(jobId, `Parsed: ${items.length} items`)

    const itemsWithOrder = items.map((item, i) => ({
      ...item,
      orderIndex: alreadyCount + i,
    }))

    if (itemsWithOrder.length > 0) {
      await saveTestItems(itemsWithOrder)
    }

    const elapsedMs = Date.now() - startedAt
    const sysTokens = estimateTokens(systemPrompt)
    const userTokens = estimateTokens(userPrompt)
    const respTokens = estimateTokens(fullContent)
    await saveAILog({
      id: uuidv4(),
      projectId,
      projectName: project.name,
      type: 'generation',
      modelId: model,
      modelLabel: model,
      batchNum,
      totalBatches,
      createdAt: new Date().toISOString(),
      systemPrompt: systemPrompt.slice(0, 3000),
      userPrompt: userPrompt.slice(0, 4000),
      responseText: fullContent.slice(0, 2000),
      outputItemCount: itemsWithOrder.length,
      aborted,
      systemTokensEst: sysTokens,
      userTokensEst: userTokens,
      responseTokensEst: respTokens,
      totalTokensEst: sysTokens + userTokens + respTokens,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: sourceChunks.length },
      refMapCount: refMap.length,
      elapsedMs,
    })

    return NextResponse.json({
      ok: true,
      count: itemsWithOrder.length,
      aborted,
      elapsed: Math.round(elapsedMs / 1000),
      model,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: sourceChunks.length },
    })

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? (e.stack || '').slice(0, 500) : ''
    log(jobId, 'ERROR:', message, stack)
    await updateJob(jobId, { status: 'error', error: message, // @ts-ignore
      debugError: stack })
    await saveAILog({
      id: uuidv4(),
      projectId,
      projectName: project.name,
      type: 'generation',
      modelId: modelOverride || 'unknown',
      modelLabel: modelOverride || 'unknown',
      batchNum,
      totalBatches,
      createdAt: new Date().toISOString(),
      systemPrompt: '',
      userPrompt: '',
      responseText: '',
      outputItemCount: 0,
      aborted: false,
      systemTokensEst: 0,
      userTokensEst: 0,
      responseTokensEst: 0,
      totalTokensEst: 0,
      elapsedMs: Date.now() - startedAt,
      error: message,
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
