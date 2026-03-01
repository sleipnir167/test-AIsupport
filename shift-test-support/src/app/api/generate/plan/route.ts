/**
 * POST /api/generate/plan
 *
 * RAGを使ってテスト設計プランを生成する（LLM①）
 * プランはRedisに保存され、フロントで確認・編集後に実行フェーズへ進む
 */
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { getProject, saveAILog, getPromptTemplate, getAdminSettings, saveTestPlan } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPlanningPrompts } from '@/lib/ai'
import type { TestPlan, TestPlanBatch } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function estimateTokens(text: string): number {
  const japanese = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length
  return Math.ceil(japanese + (text.length - japanese) / 4)
}

function createAIClient(modelOverride?: string): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: modelOverride || process.env.OPENAI_MODEL || 'gpt-4o',
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

function sanitizeAndRepairJson(raw: string): string {
  let s = raw.replace(/```(?:json)?/gi, '').trim()
  const start = s.indexOf('[')
  if (start === -1) throw new Error('JSON配列の開始が見つかりません')
  s = s.slice(start)
  // 文字列内の制御文字を除去
  s = s.replace(/"((?:[^"\\]|\\.)*)"/g, (match) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  )
  try { JSON.parse(s); return s } catch {}
  // 末尾が切れている場合の修復
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === '}') {
      const candidate = s.slice(0, i + 1) + ']'
      try { JSON.parse(candidate); return candidate } catch {}
    }
  }
  throw new Error('JSONの修復に失敗しました')
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const body = await req.json()
  const {
    projectId,
    totalItems = 100,
    batchSize = 50,
    perspectives,
    perspectiveWeights,
    targetPages = null,
    modelOverride,
    ragTopK = { doc: 80, site: 30, src: 50 },
    testPhase,
  }: {
    projectId: string
    totalItems: number
    batchSize: number
    perspectives?: string[]
    perspectiveWeights?: Array<{ value: string; count: number }>
    targetPages: Array<{ url: string; title: string }> | null
    modelOverride?: string
    ragTopK?: { doc: number; site: number; src: number }
    testPhase?: string
  } = body

  if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

  const [adminSettings, promptTemplate] = await Promise.all([getAdminSettings(), getPromptTemplate()])
  const { client, model } = createAIClient(modelOverride)

  try {
    // ── RAG検索 ──────────────────────────────────────────────────
    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, ragTopK.doc),
      searchChunks(pageQuery, projectId, ragTopK.site, 'site_analysis'),
      searchChunks(pageQuery, projectId, ragTopK.src, 'source_code'),
    ])

    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    // ── プロンプト構築 ──────────────────────────────────────────
    const { systemPrompt, userPrompt, refMap } = buildPlanningPrompts(
      project.name,
      project.targetSystem,
      allChunks,
      {
        totalItems,
        batchSize,
        perspectives,
        perspectiveWeights,
        targetPages,
        customSystemPrompt: promptTemplate.systemPrompt,
        testPhase,
      }
    )

    // ── LLM呼び出し（非ストリーミング：プランは全体が必要） ────
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: adminSettings.defaultTemperature,
      max_tokens: adminSettings.defaultMaxTokens,
    })

    const raw = res.choices[0]?.message?.content ?? '[]'
    const repaired = sanitizeAndRepairJson(raw)
    const rawBatches = JSON.parse(repaired) as Array<{
      batchId: number
      category: string
      perspective: string
      titles: string[]
      count?: number
    }>

    const batches: TestPlanBatch[] = rawBatches.map((b, i) => ({
      batchId: b.batchId ?? i + 1,
      category: b.category ?? '未分類',
      perspective: b.perspective ?? '機能テスト',
      titles: Array.isArray(b.titles) ? b.titles : [],
      count: b.titles?.length ?? b.count ?? 0,
    }))

    // ── プランを保存 ──────────────────────────────────────────
    const plan: TestPlan = {
      id: uuidv4(),
      projectId,
      status: 'draft',
      totalItems,
      batchSize,
      batches,
      testPhase,
      planModelId: model,
      planModelLabel: model,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: sourceChunks.length },
      refMapCount: refMap.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await saveTestPlan(plan)

    // ── AIログ保存 ──────────────────────────────────────────────
    const sysT = estimateTokens(systemPrompt)
    const userT = estimateTokens(userPrompt)
    const respT = estimateTokens(raw)
    await saveAILog({
      id: uuidv4(),
      projectId,
      projectName: project.name,
      type: 'generation',
      modelId: model,
      modelLabel: model,
      createdAt: new Date().toISOString(),
      systemPrompt: systemPrompt.slice(0, 3000),
      userPrompt: userPrompt.slice(0, 4000),
      responseText: raw.slice(0, 2000),
      outputItemCount: batches.reduce((s, b) => s + b.count, 0),
      aborted: false,
      systemTokensEst: sysT,
      userTokensEst: userT,
      responseTokensEst: respT,
      totalTokensEst: sysT + userT + respT,
      promptTokensActual: res.usage?.prompt_tokens,
      completionTokensActual: res.usage?.completion_tokens,
      totalTokensActual: res.usage?.total_tokens,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: sourceChunks.length },
      refMapCount: refMap.length,
      elapsedMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      ok: true,
      plan,
      model,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: sourceChunks.length },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[plan] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// GET: 保存されたプランを取得
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
  const { getTestPlan } = await import('@/lib/db')
  const plan = await getTestPlan(projectId)
  return NextResponse.json(plan ?? null)
}

// PUT: プランを編集保存
export async function PUT(req: Request) {
  const body = await req.json()
  const { plan }: { plan: TestPlan } = body
  if (!plan?.projectId) return NextResponse.json({ error: '不正なプランデータ' }, { status: 400 })
  await saveTestPlan({ ...plan, updatedAt: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}
