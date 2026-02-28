import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { TestItem, DesignMeta, ReviewResult, ExcelCompareResult, CoverageScore, HeatmapCell, CoverageMissing } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function createClient(modelId: string): { client: OpenAI; model: string } {
  const isOpenAI = modelId.startsWith('gpt-') || modelId.startsWith('openai/')
  if (isOpenAI && process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: modelId.replace('openai/', ''),
    }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://msok-test-support.vercel.app',
        'X-Title': 'MSOK AI Test Support',
      },
    }),
    model: modelId,
  }
}

// ─── 単一ファイルレビュー ──────────────────────────────────────
async function runSingleReview(
  items: TestItem[],
  designMeta: DesignMeta | undefined,
  reviewModelId: string,
  reviewModelLabel: string,
  projectId: string,
): Promise<ReviewResult> {
  const { client, model } = createClient(reviewModelId)

  const metaContext = designMeta
    ? `
【テスト設計メタ情報】
- 対象業界: ${designMeta.industry}
- システム特性: ${designMeta.systemCharacteristics.join('、')}
- 設計アプローチ: ${designMeta.designApproaches.join('、')}
- 使用モデル: ${designMeta.modelLabel}
- 生成件数: ${designMeta.maxItems}件
- テスト観点: ${designMeta.perspectives.join('、')}
`
    : ''

  const itemsSummary = items.slice(0, 200).map(t =>
    `[${t.testId}] ${t.categoryMajor} / ${t.categoryMinor} / ${t.testPerspective}: ${t.testTitle}`
  ).join('\n')

  const perspectives = [...new Set(items.map(t => t.testPerspective))]
  const majors = [...new Set(items.map(t => t.categoryMajor))]

  const systemPrompt = `あなたはソフトウェアテスト品質保証の第三者評価専門家です。
ISO/IEC 25010、ISO/IEC/IEEE 29119、OWASP ASVS、ISTQBの各標準に精通し、
テスト設計の妥当性を定量的かつ客観的に評価します。
自己正当化バイアスを排除し、第三者視点で厳正に評価してください。
必ずJSON形式のみで回答し、説明文やコードブロックは含めないでください。`

  const userPrompt = `以下のテスト設計を第三者評価してください。
${metaContext}
【テスト項目概要】
総件数: ${items.length}件
カテゴリ: ${majors.join('、')}
テスト観点: ${perspectives.join('、')}

【テスト項目リスト（先頭200件）】
${itemsSummary}

以下の形式でJSONのみ出力してください:
{
  "coverageScore": {
    "iso25010": 0.0から1.0,
    "iso29119": 0.0から1.0,
    "owasp": 0.0から1.0,
    "istqb": 0.0から1.0
  },
  "missingPerspectives": ["不足している観点1", "不足している観点2"],
  "defectRiskAnalysis": "欠陥混入リスク分析の説明文（300文字以内）",
  "improvementSuggestions": ["改善提案1", "改善提案2", "改善提案3"],
  "heatmap": [
    {
      "category": "カテゴリ名",
      "riskLevel": "critical|high|medium|low",
      "score": 0.0から1.0,
      "reason": "リスク理由（100文字以内）"
    }
  ],
  "coverageMissingAreas": [
    {
      "area": "不足領域名",
      "severity": "critical|high|medium",
      "description": "不足内容の説明（150文字以内）",
      "suggestedTests": ["追加すべきテスト1", "追加すべきテスト2"],
      "relatedStandard": "関連標準（ISO25010/ISO29119/OWASP/ISTQB）"
    }
  ]
}

評価基準:
- iso25010: 機能性・信頼性・使用性・効率性・保守性・移植性の各品質特性のカバレッジ
- iso29119: テスト計画・設計・実行・報告の標準手順適合度
- owasp: OWASP ASVSのセキュリティ検証項目カバレッジ（${designMeta?.systemCharacteristics.includes('セキュリティ重要') ? '特に重視' : '標準評価'}）
- istqb: 同値分割・境界値分析・デシジョンテーブル・状態遷移などのテスト技法適用率
- heatmapはカテゴリごとの欠陥リスクを分析（scoreが高いほどリスク大）
- coverageMissingAreasはシステム特性（${designMeta?.systemCharacteristics.join('、') || '不明'}）と業界特性（${designMeta?.industry || '不明'}）を考慮した不足領域`

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  })

  const raw = res.choices[0]?.message?.content ?? '{}'
  const clean = raw.replace(/```(?:json)?/gi, '').trim()
  const parsed = JSON.parse(clean)

  const cs = parsed.coverageScore ?? {}
  const composite =
    0.3 * (cs.iso25010 ?? 0) +
    0.3 * (cs.iso29119 ?? 0) +
    0.2 * (cs.owasp ?? 0) +
    0.2 * (cs.istqb ?? 0)

  return {
    id: uuidv4(),
    projectId,
    createdAt: new Date().toISOString(),
    reviewModelId,
    reviewModelLabel,
    targetSource: 'generated',
    totalItems: items.length,
    coverageScore: {
      iso25010: cs.iso25010 ?? 0,
      iso29119: cs.iso29119 ?? 0,
      owasp: cs.owasp ?? 0,
      istqb: cs.istqb ?? 0,
      composite: Math.round(composite * 100) / 100,
    },
    missingPerspectives: parsed.missingPerspectives ?? [],
    defectRiskAnalysis: parsed.defectRiskAnalysis ?? '',
    improvementSuggestions: parsed.improvementSuggestions ?? [],
    heatmap: parsed.heatmap ?? [],
    coverageMissingAreas: parsed.coverageMissingAreas ?? [],
    designMeta,
  }
}

// ─── 複数Excel比較レビュー ──────────────────────────────────────
async function runCompareReview(
  files: Array<{ filename: string; items: TestItem[] }>,
  reviewModelId: string,
  designMeta: DesignMeta | undefined,
): Promise<ExcelCompareResult> {
  const { client, model } = createClient(reviewModelId)

  const fileSummaries = files.map((f, i) => {
    const perspectives = [...new Set(f.items.map(t => t.testPerspective))]
    const majors = [...new Set(f.items.map(t => t.categoryMajor))]
    const sample = f.items.slice(0, 80).map(t =>
      `[${t.testId}] ${t.categoryMajor}/${t.testPerspective}: ${t.testTitle}`
    ).join('\n')
    return `【ファイル${i + 1}: ${f.filename}】
件数: ${f.items.length}件
カテゴリ: ${majors.join('、')}
観点: ${perspectives.join('、')}
項目サンプル:
${sample}`
  }).join('\n\n---\n\n')

  const prompt = `以下の${files.length}つのテスト設計ファイルを意味論的に比較分析してください。
純粋な文字列比較ではなく、テスト意図・カバレッジ・設計思想の差異を抽出してください。

${fileSummaries}

JSON形式のみで出力:
{
  "matchRate": 0.0から1.0,
  "differenceAnalysis": "差異の全体的な分析（400文字以内）",
  "differenceDetails": [
    {
      "area": "差異が生じている領域",
      "fileA": "ファイル1の特徴・傾向",
      "fileB": "ファイル2の特徴・傾向",
      "description": "差異の意味論的な解説（200文字以内）"
    }
  ],
  "recommendation": "どのファイルの設計が優れているか、または統合推奨（300文字以内）"
}`

  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 3000,
  })

  const raw = res.choices[0]?.message?.content ?? '{}'
  const clean = raw.replace(/```(?:json)?/gi, '').trim()
  const parsed = JSON.parse(clean)

  // 各ファイルの個別スコアも並行計算（簡易版）
  const fileScores = files.map(f => {
    const p = [...new Set(f.items.map(t => t.testPerspective))]
    const hasNormal = p.includes('正常系') ? 1 : 0
    const hasAbnormal = p.includes('異常系') ? 1 : 0
    const hasSecurity = p.includes('セキュリティ') ? 1 : 0
    const hasBoundary = p.includes('境界値') ? 1 : 0
    const hasPerfomance = p.includes('性能') ? 1 : 0
    const perspectiveScore = (hasNormal + hasAbnormal + hasSecurity + hasBoundary + hasPerfomance) / 5
    return {
      filename: f.filename,
      itemCount: f.items.length,
      coverageScore: {
        iso25010: Math.min(perspectiveScore * 0.8 + 0.1, 1),
        iso29119: Math.min(perspectiveScore * 0.7 + 0.15, 1),
        owasp: hasSecurity * 0.6 + 0.1,
        istqb: Math.min(perspectiveScore * 0.75 + 0.1, 1),
        composite: Math.min(perspectiveScore * 0.75 + 0.12, 1),
      } as CoverageScore,
      uniquePerspectives: p,
    }
  })

  return {
    files: fileScores,
    matchRate: parsed.matchRate ?? 0.5,
    differenceAnalysis: parsed.differenceAnalysis ?? '',
    differenceDetails: parsed.differenceDetails ?? [],
    recommendation: parsed.recommendation ?? '',
  }
}

// ─── テスト項目をXLSXデータから変換 ─────────────────────────────
function parseExcelItems(rows: string[][]): TestItem[] {
  if (rows.length < 2) return []
  const header = rows[0]
  const idxOf = (name: string) => header.findIndex(h => h && h.includes(name))

  const idIdx      = idxOf('テストID')
  const majorIdx   = idxOf('大分類')
  const minorIdx   = idxOf('中分類')
  const perspIdx   = idxOf('テスト観点')
  const titleIdx   = idxOf('テスト項目名')
  const preIdx     = idxOf('事前条件')
  const stepsIdx   = idxOf('テスト手順')
  const expIdx     = idxOf('期待結果')
  const prioIdx    = idxOf('優先度')
  const autoIdx    = idxOf('自動化可否')

  return rows.slice(1).filter(r => r.some(c => c?.trim())).map((row, i) => ({
    id: uuidv4(),
    projectId: '',
    testId: row[idIdx] || `TC-${String(i + 1).padStart(3, '0')}`,
    categoryMajor: row[majorIdx] || '未分類',
    categoryMinor: row[minorIdx] || '正常系',
    testPerspective: (row[perspIdx] || '機能テスト') as TestItem['testPerspective'],
    testTitle: row[titleIdx] || '',
    precondition: row[preIdx] || '',
    steps: row[stepsIdx] ? [row[stepsIdx]] : [],
    expectedResult: row[expIdx] || '',
    priority: (row[prioIdx] === '高' ? 'HIGH' : row[prioIdx] === '低' ? 'LOW' : 'MEDIUM') as TestItem['priority'],
    automatable: (row[autoIdx] === '自動化可' ? 'YES' : row[autoIdx] === '手動のみ' ? 'NO' : 'CONSIDER') as TestItem['automatable'],
    orderIndex: i,
    isDeleted: false,
  }))
}

// ─── APIハンドラ ──────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const action = formData.get('action') as string
    const reviewModelId = formData.get('reviewModelId') as string || 'google/gemini-2.0-flash-001'
    const reviewModelLabel = formData.get('reviewModelLabel') as string || 'Gemini 2.0 Flash'
    const projectId = formData.get('projectId') as string || ''
    const designMetaRaw = formData.get('designMeta') as string | null
    const designMeta: DesignMeta | undefined = designMetaRaw ? JSON.parse(designMetaRaw) : undefined

    if (action === 'review_generated') {
      // 生成済みテスト項目をレビュー
      const itemsRaw = formData.get('items') as string
      const items: TestItem[] = JSON.parse(itemsRaw)
      const result = await runSingleReview(items, designMeta, reviewModelId, reviewModelLabel, projectId)
      return NextResponse.json(result)
    }

    if (action === 'review_excel') {
      // アップロードされたExcelをレビュー
      const XLSX = await import('xlsx')
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
      const items = parseExcelItems(rows)
      const result = await runSingleReview(items, designMeta, reviewModelId, reviewModelLabel, projectId)
      result.targetSource = 'excel'
      return NextResponse.json(result)
    }

    if (action === 'compare_excel') {
      // 複数ExcelファイルをAI比較
      const XLSX = await import('xlsx')
      const fileList: Array<{ filename: string; items: TestItem[] }> = []
      let i = 0
      while (true) {
        const f = formData.get(`file_${i}`) as File | null
        if (!f) break
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
        fileList.push({ filename: f.name, items: parseExcelItems(rows) })
        i++
      }
      if (fileList.length < 2) return NextResponse.json({ error: '2ファイル以上必要です' }, { status: 400 })
      const result = await runCompareReview(fileList, reviewModelId, designMeta)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: '不明なaction' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[review]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
