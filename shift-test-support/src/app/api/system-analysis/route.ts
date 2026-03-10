/**
 * POST /api/system-analysis  - 分析実行 → Redisに保存
 * GET  /api/system-analysis?projectId=xxx&testPhase=yyy  - 保存済み結果を取得
 * DELETE /api/system-analysis?projectId=xxx&testPhase=yyy - 削除
 */
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { getProject, saveAILog, getAdminSettings, getSystemAnalysis, saveSystemAnalysis } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { inferResponseFormat } from '@/lib/ai'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function estimateTokens(text: string): number {
  const japanese = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length
  return Math.ceil(japanese + (text.length - japanese) / 4)
}

function createAIClient(modelOverride?: string): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }), model: modelOverride || process.env.OPENAI_MODEL || 'gpt-4o' }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://shift-test-support.vercel.app', 'X-Title': 'Shift AI Test Support' },
    }),
    model: modelOverride || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
  }
}

function buildMessages(model: string, sys: string, usr: string): OpenAI.Chat.ChatCompletionMessageParam[] {
  const isAnthropic = model.startsWith('anthropic/') || model.startsWith('claude-')
  if (isAnthropic) {
    type WCC = OpenAI.Chat.ChatCompletionContentPartText & { cache_control: { type: string } }
    const sc: WCC[] = [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }]
    const uc: WCC[] = [{ type: 'text', text: usr, cache_control: { type: 'ephemeral' } }]
    return [
      { role: 'system', content: sc as unknown as OpenAI.Chat.ChatCompletionContentPartText[] },
      { role: 'user',   content: uc as unknown as OpenAI.Chat.ChatCompletionContentPartText[] },
    ]
  }
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }]
}

function sanitizeJson(raw: string): string {
  let s = raw.replace(/```(?:json)?/gi, '').trim()
  s = s.replace(/"((?:[^"\\]|\\.)*)"/g, (m) =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''))
  if (!s || s === 'null') return '{}'
  const start = s.indexOf('{')
  if (start !== -1) {
    const obj = s.slice(start)
    try { JSON.parse(obj); return obj } catch {}
    for (let i = obj.length - 1; i >= 0; i--) {
      if (obj[i] === '}') { try { JSON.parse(obj.slice(0, i + 1)); return obj.slice(0, i + 1) } catch {} }
    }
  }
  return '{}'
}

function buildAnalysisPrompts(
  projectName: string, targetSystem: string, testPhase: string,
  chunks: { category: string; filename: string; text: string; pageUrl?: string | null }[]
): { systemPrompt: string; userPrompt: string } {
  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  const buildCtx = (list: typeof chunks, label: string, maxLen: number) => {
    if (!list.length) return ''
    return `\n\n## ${label}\n` + list.map(c => `[${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`).join('\n\n').slice(0, maxLen)
  }

  const contextText = [
    buildCtx(docChunks,    '仕様・要件ドキュメント', 50000),
    buildCtx(siteChunks,   'サイト構造・画面情報',   12000),
    buildCtx(sourceChunks, 'ソースコード',            30000),
  ].join('')

  const dc = docChunks.length, sc = siteChunks.length, src = sourceChunks.length

  const systemPrompt = `あなたはソフトウェアテストの専門家（JSTQB FL/AL・ISTQB Expert Level相当）です。
提供されたドキュメント・ソースコード・サイト構造を精密に分析し、「${testPhase}」観点から
上司・顧客への説明資料として提示可能な高品質システム分析レポートをJSONで出力します。

【絶対遵守ルール】
1. 数値は必ず「算出根拠」とセットで記載する（例: 「APIエンドポイント推定12個 × 正常系1+異常系2+境界値1=4TC/エンドポイント = 48TC」）
2. ドキュメントに記載がある情報はそちらを優先する（推測より根拠ある事実を選ぶ）
3. 情報が不足している場合は「情報不足のため業界標準値から推定」と明示する
4. テスト工程「${testPhase}」の目的・範囲に特化した分析を行う
5. temperature=0で実行されるため、論理的・決定論的な推論ステップで数値を算出する

以下のJSON形式のみで出力（前置き・説明・コードブロック禁止）:
{
  "systemSummary": {
    "overview": "システムの目的・対象ユーザー・主要機能・規模感の要約（5文程度。ドキュメントから読み取れる事実を優先）",
    "architecture": "アーキテクチャ種別と主要構成要素の詳細説明",
    "techStack": {
      "frontend": "フロントエンド技術（言語・FW・主要ライブラリ）",
      "backend": "バックエンド技術（言語・FW・API形式）",
      "database": "DB種別・ORM・データストア",
      "infrastructure": "クラウド/オンプレ・CI/CD・コンテナ等",
      "externalApis": "外部API・連携サービスの一覧（不明な場合は「不明」）"
    },
    "scale": {
      "estimatedLoc": 0,
      "locBasis": "LOC推定根拠（例: ソースファイル推定N個 × 平均M行 = N*M行）",
      "screenCount": 0,
      "screenBasis": "画面数の根拠（サイト分析・ドキュメントから）",
      "apiEndpointCount": 0,
      "apiBasis": "API数の根拠（コード・設計書から）",
      "tableCount": 0,
      "tableBasis": "テーブル数の根拠（DB設計書・コードから）"
    },
    "qualityAttributes": {
      "realtimeRequirement": "high",
      "realtimeBasis": "リアルタイム性要件の根拠",
      "securityLevel": "high",
      "securityBasis": "セキュリティ重要度の根拠（扱うデータの機密性・法規制等）",
      "scalability": "medium",
      "scalabilityBasis": "スケーラビリティ要件の根拠",
      "availability": "medium",
      "availabilityBasis": "可用性要件の根拠（SLA・稼働要件等）"
    },
    "complexityAnalysis": {
      "score": 5,
      "basis": "複雑度スコア(1-10)の算出根拠（画面遷移数・ビジネスロジック分岐・外部連携数の合計から5段階評価）",
      "cyclomaticEstimate": "循環的複雑度の推定説明",
      "nestingDepth": "UIネスト深さ・処理フローの深さ推定"
    },
    "riskLevel": "high",
    "riskBasis": "総合リスクレベルの根拠"
  },
  "testPolicy": {
    "testPhase": "${testPhase}",
    "phaseObjective": "この工程のテスト目標（JSTQB/ISTQB定義に基づく本システム向け説明）",
    "phaseDescription": "本システムの特性を踏まえた「${testPhase}」のテスト方針（4文程度）",
    "entryExitCriteria": {
      "entry": ["開始基準1", "開始基準2", "開始基準3"],
      "exit": ["終了基準1", "終了基準2", "終了基準3"]
    },
    "focusAreas": [
      {
        "area": "重点テストエリア名",
        "reason": "この工程でこのエリアを重点とする具体的な理由",
        "testApproach": "具体的なテストアプローチ・技法"
      }
    ],
    "categories": [
      {
        "name": "テスト分類名（例: 機能テスト・セキュリティテスト）",
        "priority": "high",
        "allocation": 30,
        "reason": "配分根拠（リスク・重要度・工程目標から論理的に説明）",
        "keyTestPoints": ["主要テストポイント1", "主要テストポイント2"]
      }
    ],
    "perspectives": [
      {
        "name": "テスト観点名",
        "priority": "high",
        "description": "この観点の具体的なテスト方針と対象範囲",
        "targetAreas": ["具体的な対象機能・画面・モジュール名"]
      }
    ],
    "automationRecommendation": {
      "automatable": 0,
      "manual": 0,
      "automatableBasis": "自動化適性の判断根拠（安定度・実行頻度・ROI等から）"
    }
  },
  "quantitativeAnalysis": {
    "calculationBasis": "定量分析全体の算出ロジック・前提条件の説明",
    "frontend": {
      "metric": "LOC推定値・画面数・コンポーネント数の具体値",
      "complexity": "複雑度評価（high/medium/low）と根拠",
      "recommendedCases": 0,
      "caseBreakdown": "TC算出式（例: 画面数12 × 平均TC数4 × リスク係数1.2 = 58TC）",
      "basis": "算出根拠の詳細"
    },
    "backendApi": {
      "metric": "LOC推定値・エンドポイント数・ビジネスロジック数の具体値",
      "complexity": "複雑度評価と根拠",
      "recommendedCases": 0,
      "caseBreakdown": "TC算出式（例: エンドポイント12 × 正常1+異常2+境界1 = 48TC）",
      "basis": "算出根拠の詳細"
    },
    "database": {
      "metric": "テーブル数・リレーション数・制約数の具体値",
      "complexity": "複雑度評価と根拠",
      "recommendedCases": 0,
      "caseBreakdown": "TC算出式（例: テーブル8 × データ整合性3 + 制約違反2 = 26TC）",
      "basis": "算出根拠の詳細"
    },
    "integration": {
      "metric": "外部API数・連携システム数・イベント数の具体値",
      "complexity": "複雑度評価と根拠",
      "recommendedCases": 0,
      "caseBreakdown": "TC算出式",
      "basis": "算出根拠の詳細"
    },
    "totalRecommendedCases": 0,
    "coverageBreakdown": {
      "normal": 0,
      "abnormal": 0,
      "boundary": 0,
      "security": 0,
      "performance": 0
    },
    "estimatedEffortDays": 0,
    "effortBreakdown": {
      "design": 0,
      "execution": 0,
      "bugReport": 0,
      "regression": 0
    },
    "effortBasis": "工数算出の詳細根拠（TC数 × 1TC平均工数 × 難易度係数 + 管理工数）",
    "teamSizeRecommendation": 0,
    "scheduleSuggestionDays": 0
  },
  "riskAnalysis": [
    {
      "area": "リスク箇所（具体的な機能・モジュール名）",
      "level": "high",
      "category": "機能|セキュリティ|性能|データ整合性|外部連携|ユーザビリティ",
      "description": "リスクの詳細（ドキュメント・コードから特定した根拠を含む）",
      "impact": "障害発生時の影響範囲・業務への具体的な影響",
      "probability": "high|medium|low",
      "probabilityBasis": "発生可能性の根拠",
      "recommendation": "具体的なテスト方針・テストケース設計の方向性",
      "testTechnique": "適用すべきテスト技法（例: 境界値分析・同値分割・デシジョンテーブル等）"
    }
  ],
  "defectTendency": {
    "analysis": "このタイプのシステム・技術スタックで一般的に多い不具合傾向の分析",
    "highRiskModules": ["高リスクモジュール・機能名1", "高リスクモジュール・機能名2"],
    "recommendedChecklists": ["推奨チェックリスト1（例: OWASP Top10チェック）", "推奨チェックリスト2"]
  },
  "keyInsights": [
    {
      "title": "洞察タイトル（簡潔に）",
      "detail": "詳細説明（具体的な根拠・数値・ドキュメント参照を含む）",
      "action": "推奨する具体的なアクション"
    }
  ],
  "executiveSummary": "経営層・顧客向け1段落サマリー（技術専門用語を避け、ビジネスリスクと推奨事項を100〜150字で簡潔に）"
}`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
分析対象テスト工程: ${testPhase}
利用可能なRAG情報: ドキュメント=${dc}チャンク / サイト構造=${sc}チャンク / ソースコード=${src}チャンク

【算出ルール（必ず遵守）】
- LOC: ソースファイル数が読み取れる場合はそこから算出。不明な場合は「業界標準値から推定」と明記
- TC数: 各カテゴリの算出式を必ず記載（「根拠なしの数値」は不可）
- 工数: 1TC設計=0.5h、1TC実行=0.25h、バグ票=0.5h/件 を基準に難易度係数を乗じて算出
- 数値が推定の場合は []内に「推定」と付記すること（例: 「画面数[推定]: 15画面」）

以下の情報をもとに詳細な分析を実施してください:
${contextText || '\n（ドキュメント・ソースコード未登録のため、プロジェクト情報と工程特性のみで分析してください）'}`

  return { systemPrompt, userPrompt }
}

// ─── GET ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const testPhase  = searchParams.get('testPhase')
  if (!projectId || !testPhase) return NextResponse.json({ error: 'projectId と testPhase は必須です' }, { status: 400 })
  const record = await getSystemAnalysis(projectId, testPhase)
  return NextResponse.json(record ?? null)
}

// ─── DELETE ──────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const testPhase  = searchParams.get('testPhase')
  if (!projectId || !testPhase) return NextResponse.json({ error: 'projectId と testPhase は必須です' }, { status: 400 })
  const { deleteSystemAnalysis } = await import('@/lib/db')
  await deleteSystemAnalysis(projectId, testPhase)
  return NextResponse.json({ ok: true })
}

// ─── POST ────────────────────────────────────────────────────
export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    const body = await req.json()
    const { projectId, testPhase = 'システムテスト', modelOverride, ragTopK = { doc: 80, site: 30, src: 60 } } = body
    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await getProject(projectId)
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    let finalModel = modelOverride
    if (!finalModel) {
      try { finalModel = ((await getAdminSettings()) as { defaultPlanModelId?: string }).defaultPlanModelId } catch {}
    }
    const { client, model } = createAIClient(finalModel)

    // 複数クエリでRAGを多角的に検索
    const q1 = `${project.name} ${project.targetSystem} システム特性 技術スタック アーキテクチャ`
    const q2 = `${project.targetSystem} 機能要件 画面 API 設計`
    const q3 = `${project.targetSystem} セキュリティ 性能 可用性`

    const [a1d, a1s, a1r, a2d, a2r, a3d] = await Promise.all([
      searchChunks(q1, projectId, Math.ceil(ragTopK.doc  * 0.5)),
      searchChunks(q1, projectId, Math.ceil(ragTopK.site * 0.5), 'site_analysis'),
      searchChunks(q1, projectId, Math.ceil(ragTopK.src  * 0.5), 'source_code'),
      searchChunks(q2, projectId, Math.ceil(ragTopK.doc  * 0.3)),
      searchChunks(q2, projectId, Math.ceil(ragTopK.src  * 0.3), 'source_code'),
      searchChunks(q3, projectId, Math.ceil(ragTopK.doc  * 0.2)),
    ])

    const dedup = <T extends { docId: string; chunkIndex: number }>(arr: T[]): T[] => {
      const seen = new Set<string>()
      return arr.filter(c => { const k = `${c.docId}:${c.chunkIndex}`; if (seen.has(k)) return false; seen.add(k); return true })
    }
    const docChunks  = dedup([...a1d, ...a2d, ...a3d])
    const siteChunks = dedup([...a1s])
    const srcChunks  = dedup([...a1r, ...a2r])
    const allChunks  = [...docChunks, ...siteChunks, ...srcChunks]

    const { systemPrompt, userPrompt } = buildAnalysisPrompts(project.name, project.targetSystem, testPhase, allChunks)
    const messages = buildMessages(model, systemPrompt, userPrompt)

    const fmt = inferResponseFormat(model)
    const res = await client.chat.completions.create({
      model, messages, max_tokens: 6000,
      temperature: 0,
      ...(fmt !== 'none' ? { response_format: { type: fmt } as OpenAI.ResponseFormatJSONObject } : {}),
    })

    const raw = res.choices?.[0]?.message?.content ?? '{}'
    const analysisResult = JSON.parse(sanitizeJson(raw))
    const now = new Date().toISOString()

    await saveSystemAnalysis({
      projectId, testPhase, analysis: analysisResult, model,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length },
      createdAt: now, updatedAt: now,
    })

    const sysT = estimateTokens(systemPrompt), userT = estimateTokens(userPrompt), respT = estimateTokens(raw)
    await saveAILog({
      id: uuidv4(), projectId, projectName: project.name,
      type: 'generation', logStage: 'system_analysis',
      modelId: model, modelLabel: model, createdAt: now,
      systemPrompt: systemPrompt.slice(0, 3000), userPrompt: userPrompt.slice(0, 4000), responseText: raw.slice(0, 2000),
      outputItemCount: 0, aborted: false,
      systemTokensEst: sysT, userTokensEst: userT, responseTokensEst: respT, totalTokensEst: sysT + userT + respT,
      promptTokensActual: res.usage?.prompt_tokens, completionTokensActual: res.usage?.completion_tokens, totalTokensActual: res.usage?.total_tokens,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length },
      elapsedMs: Date.now() - startedAt,
    })

    return NextResponse.json({ ok: true, analysis: analysisResult, model, ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length }, savedAt: now })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[system-analysis] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
