/**
 * POST /api/system-analysis
 *
 * RAGを使ってシステム特性を分析し、テスト方針レポートを生成する
 * generate/plan と同じモデル・RAG構成を踏襲
 */
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { getProject, saveAILog, getAdminSettings } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import type { CustomModelEntry } from '@/types'

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

function buildMessages(
  model: string,
  systemPrompt: string,
  userPrompt: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const isAnthropic = model.startsWith('anthropic/') || model.startsWith('claude-')
  if (isAnthropic) {
    type WithCacheControl = OpenAI.Chat.ChatCompletionContentPartText & {
      cache_control: { type: string }
    }
    const sysContent: WithCacheControl[] = [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ]
    const userContent: WithCacheControl[] = [
      { type: 'text', text: userPrompt, cache_control: { type: 'ephemeral' } },
    ]
    return [
      { role: 'system', content: sysContent as unknown as OpenAI.Chat.ChatCompletionContentPartText[] },
      { role: 'user',   content: userContent as unknown as OpenAI.Chat.ChatCompletionContentPartText[] },
    ]
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ]
}

function sanitizeJson(raw: string): string {
  let s = raw.replace(/```(?:json)?/gi, '').trim()
  s = s.replace(/"((?:[^"\\]|\\.)*)"/g, (match) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  )
  if (!s || s === 'null') return '{}'
  const objStart = s.indexOf('{')
  if (objStart !== -1) {
    const objStr = s.slice(objStart)
    try { JSON.parse(objStr); return objStr } catch {}
    for (let i = objStr.length - 1; i >= 0; i--) {
      if (objStr[i] === '}') {
        const candidate = objStr.slice(0, i + 1)
        try { JSON.parse(candidate); return candidate } catch {}
      }
    }
  }
  return '{}'
}

// ─── テスト工程ごとのシステム分析プロンプトを構築 ─────────────────────────
function buildAnalysisPrompts(
  projectName: string,
  targetSystem: string,
  testPhase: string,
  chunks: { category: string; filename: string; text: string; pageUrl?: string | null }[]
): { systemPrompt: string; userPrompt: string } {
  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  const buildContext = (list: typeof chunks, label: string, maxLen: number) => {
    if (!list.length) return ''
    const text = list
      .map(c => `[${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`)
      .join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }

  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 50000),
    buildContext(siteChunks,   'サイト構造・画面情報',   12000),
    buildContext(sourceChunks, 'ソースコード',            30000),
  ].join('')

  const systemPrompt = `あなたはソフトウェアテストの専門家AIです。
提供されたドキュメント・ソースコード・サイト構造情報を詳細に分析し、
「${testPhase}」の観点からシステム特性・テスト方針・定量的テスト分析を日本語でレポートします。

必ず以下のJSON形式のみで回答してください（前置き・説明不要）:
{
  "systemSummary": {
    "overview": "システム全体の概要（3〜5文）",
    "architecture": "アーキテクチャの概要（技術スタック・構成）",
    "language": "主要言語・フレームワーク（カンマ区切り）",
    "scale": "規模感（LOC推定、画面数、API数など）",
    "realtimeRequirement": "リアルタイム性の要件（high/medium/low のいずれか）",
    "securityLevel": "セキュリティ重要度（high/medium/low）",
    "scalability": "スケーラビリティ要件（high/medium/low）",
    "complexityScore": "複雑度スコア（1〜10の整数）",
    "riskLevel": "全体リスクレベル（high/medium/low）"
  },
  "testPolicy": {
    "testPhase": "${testPhase}",
    "phaseDescription": "この工程でのテスト方針（2〜3文）",
    "focusAreas": ["重点テストエリア1", "重点テストエリア2", "重点テストエリア3"],
    "categories": [
      {
        "name": "テスト分類名（例: 機能テスト）",
        "priority": "high/medium/low",
        "allocation": 30,
        "reason": "この分類を重視する理由"
      }
    ],
    "perspectives": [
      {
        "name": "テスト観点名（例: 境界値）",
        "priority": "high/medium/low",
        "description": "この観点の説明と重点箇所"
      }
    ]
  },
  "quantitativeAnalysis": {
    "frontend": {
      "metric": "LOC / 画面数の推定値",
      "recommendedCases": 0,
      "basis": "算出根拠"
    },
    "backendApi": {
      "metric": "LOC / エンドポイント数の推定値",
      "recommendedCases": 0,
      "basis": "算出根拠"
    },
    "database": {
      "metric": "テーブル数 / ストアド数の推定値",
      "recommendedCases": 0,
      "basis": "算出根拠"
    },
    "integration": {
      "metric": "外部API / 連携システム数",
      "recommendedCases": 0,
      "basis": "算出根拠"
    },
    "totalRecommendedCases": 0,
    "estimatedEffortDays": 0,
    "effortBasis": "工数算出の根拠（難易度・規模・複雑度から）"
  },
  "riskAnalysis": [
    {
      "area": "リスク箇所",
      "level": "high/medium/low",
      "description": "リスクの詳細説明",
      "recommendation": "対処・テスト方針の推奨"
    }
  ],
  "keyInsights": ["重要な洞察1", "重要な洞察2", "重要な洞察3"]
}`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
分析対象テスト工程: ${testPhase}

以下のドキュメント・ソースコード・サイト情報を解析し、「${testPhase}」に最適化したシステム分析レポートをJSONで出力してください。
${contextText || '\n\n（ドキュメント未登録のため、プロジェクト情報のみで一般的な分析を行ってください）'}`

  return { systemPrompt, userPrompt }
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    const body = await req.json()
    const { projectId, testPhase = 'システムテスト', modelOverride, ragTopK = { doc: 60, site: 20, src: 40 } } = body

    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await getProject(projectId)
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    // 管理者設定を取得してモデルリストを確認
    let finalModel = modelOverride
    if (!finalModel) {
      try {
        const settings = await getAdminSettings()
        finalModel = (settings as { defaultPlanModelId?: string }).defaultPlanModelId
      } catch {}
    }

    const { client, model } = createAIClient(finalModel)

    // RAG検索
    const query = `${project.name} ${project.targetSystem} システム特性 技術スタック アーキテクチャ`
    const [docChunks, siteChunks, srcChunks] = await Promise.all([
      searchChunks(query, projectId, ragTopK.doc),
      searchChunks(query, projectId, ragTopK.site, 'site_analysis'),
      searchChunks(query, projectId, ragTopK.src, 'source_code'),
    ])

    const allChunks = [...docChunks, ...siteChunks, ...srcChunks]

    const { systemPrompt, userPrompt } = buildAnalysisPrompts(
      project.name,
      project.targetSystem,
      testPhase,
      allChunks
    )

    const messages = buildMessages(model, systemPrompt, userPrompt)

    const res = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 4000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      stream: false, // 明示的にストリームをオフにする（推奨）
    }) as OpenAI.Chat.ChatCompletion // ここで型を確定させる

    const raw = res.choices?.[0]?.message?.content ?? '{}'
    const cleaned = sanitizeJson(raw)
    const analysisResult = JSON.parse(cleaned)

    // AIログ保存
    const sysT = estimateTokens(systemPrompt)
    const userT = estimateTokens(userPrompt)
    const respT = estimateTokens(raw)
    await saveAILog({
      id: uuidv4(),
      projectId,
      projectName: project.name,
      type: 'generation',
      logStage: 'system_analysis',
      modelId: model,
      modelLabel: model,
      createdAt: new Date().toISOString(),
      systemPrompt: systemPrompt.slice(0, 3000),
      userPrompt: userPrompt.slice(0, 4000),
      responseText: raw.slice(0, 2000),
      outputItemCount: 0,
      aborted: false,
      systemTokensEst: sysT,
      userTokensEst: userT,
      responseTokensEst: respT,
      totalTokensEst: sysT + userT + respT,
      promptTokensActual: res.usage?.prompt_tokens,
      completionTokensActual: res.usage?.completion_tokens,
      totalTokensActual: res.usage?.total_tokens,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length },
      elapsedMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      ok: true,
      analysis: analysisResult,
      model,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[system-analysis] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
