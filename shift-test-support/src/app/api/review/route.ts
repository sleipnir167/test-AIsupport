import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { TestItem, DesignMeta, ReviewResult, ExcelCompareResult, CoverageScore, PerspectiveHeatmapCell } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { saveAILog, getPromptTemplate, getAdminSettings, getProject } from '@/lib/db'
import { searchChunks } from '@/lib/vector'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function createClient(modelId: string): { client: OpenAI; model: string } {
  const isOpenAI = modelId.startsWith('gpt-') || modelId.startsWith('openai/')
  if (isOpenAI && process.env.OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model: modelId.replace('openai/', '') }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://msok-test-support.vercel.app', 'X-Title': 'MSOK AI Test Support' },
    }),
    model: modelId,
  }
}

function estimateTokens(text: string): number {
  const japanese = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length
  return Math.ceil(japanese + (text.length - japanese) / 4)
}

function calcPerspectiveHeatmap(items: TestItem[]): PerspectiveHeatmapCell[] {
  const ALL = ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性', '性能']
  const ideal: Record<string, number> = {
    '機能テスト': 0.25, '正常系': 0.20, '異常系': 0.20,
    '境界値': 0.12, 'セキュリティ': 0.10, '操作性': 0.08, '性能': 0.05,
  }
  const total = items.length || 1
  const countMap = new Map<string, number>()
  ALL.forEach(p => countMap.set(p, 0))
  items.forEach(t => countMap.set(t.testPerspective, (countMap.get(t.testPerspective) ?? 0) + 1))
  return ALL.map(p => {
    const count = countMap.get(p) ?? 0
    const ratio = count / total
    const dev = ratio - (ideal[p] ?? 0.1)
    const biasLevel = dev > 0.1 ? 'over' : dev < -0.07 ? 'under' : 'balanced'
    const recommendation = biasLevel === 'over'
      ? `${Math.round(ratio * 100)}%（${count}件）と過多。理想は${Math.round((ideal[p] ?? 0.1) * 100)}%程度。`
      : biasLevel === 'under'
        ? count === 0 ? `0件。この観点は未カバーです。追加を強く推奨。`
          : `${Math.round(ratio * 100)}%（${count}件）と少なめ。理想は${Math.round((ideal[p] ?? 0.1) * 100)}%程度。`
        : `${count}件（${Math.round(ratio * 100)}%）。適切なカバレッジです。`
    return { perspective: p, count, ratio, biasLevel, recommendation }
  })
}

async function runSingleReview(
  items: TestItem[], designMeta: DesignMeta | undefined,
  reviewModelId: string, reviewModelLabel: string, projectId: string,
): Promise<ReviewResult> {
  const startedAt = Date.now()
  const { client, model } = createClient(reviewModelId)
  const [adminSettings, promptTemplate, project] = await Promise.all([getAdminSettings(), getPromptTemplate(), getProject(projectId)])

  // ── RAG: 仕様書をレビューコンテキストに含める ────────────────
  const ragQuery = `${project?.targetSystem ?? ''} 仕様 要件 機能 テスト観点 画面`
  const [docChunks, siteChunks] = await Promise.all([
    searchChunks(ragQuery, projectId, 40),
    searchChunks(ragQuery, projectId, 15, 'site_analysis'),
  ])

  const buildRagContext = (list: typeof docChunks, label: string, maxLen: number) => {
    if (!list.length) return ''
    const text = list.map((c, i) => `[REF-${i + 1}: ${c.filename}]\n${c.text}`).join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }
  const ragContext = [
    buildRagContext(docChunks, '仕様・要件ドキュメント', 25000),
    buildRagContext(siteChunks, 'サイト構造・画面情報', 6000),
  ].join('')

  const specFunctionHints = docChunks.length > 0
    ? `\n\n【仕様書から抽出した主要機能・画面（網羅性評価に使用）】\n${docChunks.slice(0, 20).map(c => `- ${c.filename}: ${c.text.slice(0, 100)}`).join('\n')}`
    : ''

  const metaContext = designMeta ? `\n【テスト設計メタ情報】\n- 対象業界: ${designMeta.industry}\n- システム特性: ${designMeta.systemCharacteristics.join('、')}\n- 設計アプローチ: ${designMeta.designApproaches.join('、')}\n- 使用モデル: ${designMeta.modelLabel}\n- 生成件数: ${designMeta.maxItems}件\n- テスト観点: ${designMeta.perspectives.join('、')}\n` : ''

  const perspCountMap: Record<string, number> = {}
  items.forEach(t => { perspCountMap[t.testPerspective] = (perspCountMap[t.testPerspective] ?? 0) + 1 })
  const majors = [...new Set(items.map(t => t.categoryMajor))]
  const perspBreakdown = Object.entries(perspCountMap).map(([k, v]) => `${k}:${v}件`).join('、')
  const itemsSummary = items.slice(0, 150).map(t => `[${t.testId}] ${t.categoryMajor}/${t.testPerspective}: ${t.testTitle}`).join('\n')

  // カスタムプロンプト対応
  const systemPrompt = promptTemplate.reviewSystemPrompt

  const userPrompt = `以下のテスト設計を、仕様書との照合を含めて第三者評価してください。
${metaContext}
【テスト項目概要】
総件数: ${items.length}件 / カテゴリ: ${majors.join('、')} / 観点別: ${perspBreakdown}

【テスト項目リスト（先頭150件）】
${itemsSummary}
${specFunctionHints}

以下の形式でJSONのみ出力（コードブロック不要）:
{
  "coverageScore": { "iso25010": 0-1, "iso29119": 0-1, "owasp": 0-1, "istqb": 0-1 },
  "scoreReason": "各スコアの根拠（300文字以内）",
  "overallSummary": "総評（400文字以内）。強み・弱み・業界適合度・仕様書との網羅性を含む",
  "specCoverageAnalysis": {
    "coveredFunctions": ["仕様書に記載があり、テスト項目でカバーできている機能・画面"],
    "uncoveredFunctions": ["仕様書に記載があるが、テスト項目が不足または欠落している機能・画面"],
    "coverageRate": 0.0,
    "coverageSummary": "網羅性の総評（200文字以内）。件数が十分かどうかも判断"
  },
  "missingPerspectives": ["【観点名】欠落内容と影響の説明（具体例付き）"],
  "defectRiskAnalysis": "欠陥混入リスク分析（300文字以内）",
  "improvementSuggestions": ["【タイトル】実装可能な粒度の具体的改善内容"],
  "heatmap": [{ "category": "名前", "riskLevel": "critical|high|medium|low", "score": 0-1, "reason": "理由" }],
  "coverageMissingAreas": [{
    "area": "領域名", "severity": "critical|high|medium",
    "description": "不足内容の具体的説明（仕様書の記載と照合した結果を含む）",
    "suggestedTests": ["具体的なテストケース例（そのまま使えるレベルで）"],
    "relatedStandard": "ISO25010|ISO29119|OWASP|ISTQB"
  }]
}

スコア基準: iso25010×0.3=品質特性, iso29119×0.3=テスト標準, owasp×0.2=セキュリティ(${designMeta?.systemCharacteristics?.includes('セキュリティ重要') ? '特に重視' : '標準'}), istqb×0.2=テスト技法
業界: ${designMeta?.industry ?? '不明'} / 特性: ${designMeta?.systemCharacteristics?.join('、') ?? '不明'}
【参照仕様書（網羅性評価に使用）】${ragContext || '※仕様書なし。テスト項目のみで評価。'}`

  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: adminSettings.reviewTemperature,
    max_tokens: adminSettings.reviewMaxTokens,
  })

  const raw = res.choices[0]?.message?.content ?? '{}'
  const clean = raw.replace(/```(?:json)?/gi, '').trim()
  const parsed = JSON.parse(clean)
  const cs = parsed.coverageScore ?? {}
  const composite = 0.3 * (cs.iso25010 ?? 0) + 0.3 * (cs.iso29119 ?? 0) + 0.2 * (cs.owasp ?? 0) + 0.2 * (cs.istqb ?? 0)

  const sysT = estimateTokens(systemPrompt)
  const userT = estimateTokens(userPrompt)
  const respT = estimateTokens(raw)
  await saveAILog({
    id: uuidv4(),
    projectId,
    projectName: project?.name ?? '',
    type: 'review',
    modelId: reviewModelId,
    modelLabel: reviewModelLabel,
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
    elapsedMs: Date.now() - startedAt,
  })

  return {
    id: uuidv4(),
    projectId,
    createdAt: new Date().toISOString(),
    reviewModelId,
    reviewModelLabel,
    targetSource: 'generated',
    totalItems: items.length,
    coverageScore: {
      iso25010: cs.iso25010 ?? 0, iso29119: cs.iso29119 ?? 0,
      owasp: cs.owasp ?? 0, istqb: cs.istqb ?? 0,
      composite: Math.round(composite * 100) / 100,
    },
    scoreReason: parsed.scoreReason ?? '',
    overallSummary: parsed.overallSummary ?? '',
    specCoverageAnalysis: parsed.specCoverageAnalysis ? {
      coveredFunctions: parsed.specCoverageAnalysis.coveredFunctions ?? [],
      uncoveredFunctions: parsed.specCoverageAnalysis.uncoveredFunctions ?? [],
      coverageRate: parsed.specCoverageAnalysis.coverageRate ?? 0,
      coverageSummary: parsed.specCoverageAnalysis.coverageSummary ?? '',
    } : undefined,
    missingPerspectives: parsed.missingPerspectives ?? [],
    defectRiskAnalysis: parsed.defectRiskAnalysis ?? '',
    improvementSuggestions: parsed.improvementSuggestions ?? [],
    heatmap: parsed.heatmap ?? [],
    perspectiveHeatmap: calcPerspectiveHeatmap(items),
    coverageMissingAreas: parsed.coverageMissingAreas ?? [],
    designMeta,
  }
}

async function runCompareReview(
  files: Array<{ filename: string; items: TestItem[] }>,
  reviewModelId: string,
  designMeta: DesignMeta | undefined,
  projectId: string,
): Promise<ExcelCompareResult> {
  const startedAt = Date.now()
  const { client, model } = createClient(reviewModelId)
  const [adminSettings] = await Promise.all([getAdminSettings()])

  const fileSummaries = files.map((f, i) => {
    const perspectives = [...new Set(f.items.map(t => t.testPerspective))]
    const majors = [...new Set(f.items.map(t => t.categoryMajor))]
    const sample = f.items.slice(0, 80).map(t => `[${t.testId}] ${t.categoryMajor}/${t.testPerspective}: ${t.testTitle}`).join('\n')
    return `【ファイル${i + 1}: ${f.filename}】\n件数: ${f.items.length}件 / カテゴリ: ${majors.join('、')} / 観点: ${perspectives.join('、')}\n${sample}`
  }).join('\n\n---\n\n')

  const prompt = `${files.length}つのテスト設計ファイルを意味論的に比較分析してください。
${fileSummaries}

JSON形式のみ出力:
{
  "matchRate": 0-1,
  "differenceAnalysis": "差異の全体分析（400文字以内）",
  "differenceDetails": [{ "area": "領域", "fileA": "ファイル1の傾向", "fileB": "ファイル2の傾向", "description": "差異の解説（200文字以内）" }],
  "recommendation": "統合推奨（300文字以内）"
}`

  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: adminSettings.reviewTemperature,
    max_tokens: adminSettings.reviewMaxTokens,
  })
  const raw = res.choices[0]?.message?.content ?? '{}'
  const clean = raw.replace(/```(?:json)?/gi, '').trim()
  const parsed = JSON.parse(clean)

  const pT = estimateTokens(prompt)
  const rT = estimateTokens(raw)
  await saveAILog({
    id: uuidv4(), projectId, projectName: '', type: 'compare',
    modelId: reviewModelId, modelLabel: reviewModelId,
    createdAt: new Date().toISOString(),
    systemPrompt: '', userPrompt: prompt.slice(0, 4000),
    responseText: raw.slice(0, 2000), outputItemCount: 0, aborted: false,
    systemTokensEst: 0, userTokensEst: pT, responseTokensEst: rT, totalTokensEst: pT + rT,
    promptTokensActual: res.usage?.prompt_tokens,
    completionTokensActual: res.usage?.completion_tokens,
    totalTokensActual: res.usage?.total_tokens,
    elapsedMs: Date.now() - startedAt,
  })

  const fileScores = files.map(f => {
    const p = [...new Set(f.items.map(t => t.testPerspective))]
    const has = (v: any) => p.includes(v) ? 1 : 0
    const ps = (has('正常系') + has('異常系') + has('セキュリティ') + has('境界値') + has('性能')) / 5
    return {
      filename: f.filename, itemCount: f.items.length,
      coverageScore: {
        iso25010: Math.min(ps * 0.8 + 0.1, 1), iso29119: Math.min(ps * 0.7 + 0.15, 1),
        owasp: has('セキュリティ') * 0.6 + 0.1, istqb: Math.min(ps * 0.75 + 0.1, 1),
        composite: Math.min(ps * 0.75 + 0.12, 1),
      } as CoverageScore,
      uniquePerspectives: p,
    }
  })

  return {
    files: fileScores, matchRate: parsed.matchRate ?? 0.5,
    differenceAnalysis: parsed.differenceAnalysis ?? '',
    differenceDetails: parsed.differenceDetails ?? [],
    recommendation: parsed.recommendation ?? '',
  }
}

function parseExcelItems(rows: string[][]): TestItem[] {
  if (rows.length < 2) return []
  const header = rows[0]
  const idxOf = (name: string) => header.findIndex(h => h?.includes(name))
  const idIdx = idxOf('テストID'), majorIdx = idxOf('大分類'), minorIdx = idxOf('中分類')
  const perspIdx = idxOf('テスト観点'), titleIdx = idxOf('テスト項目名'), preIdx = idxOf('事前条件')
  const stepsIdx = idxOf('テスト手順'), expIdx = idxOf('期待結果'), prioIdx = idxOf('優先度'), autoIdx = idxOf('自動化可否')
  return rows.slice(1).filter(r => r.some(c => c?.trim())).map((row, i) => ({
    id: uuidv4(), projectId: '',
    testId: row[idIdx] || `TC-${String(i + 1).padStart(3, '0')}`,
    categoryMajor: row[majorIdx] || '未分類', categoryMinor: row[minorIdx] || '正常系',
    testPerspective: (row[perspIdx] || '機能テスト') as TestItem['testPerspective'],
    testTitle: row[titleIdx] || '', precondition: row[preIdx] || '',
    steps: row[stepsIdx] ? [row[stepsIdx]] : [], expectedResult: row[expIdx] || '',
    priority: (row[prioIdx] === '高' ? 'HIGH' : row[prioIdx] === '低' ? 'LOW' : 'MEDIUM') as TestItem['priority'],
    automatable: (row[autoIdx] === '自動化可' ? 'YES' : row[autoIdx] === '手動のみ' ? 'NO' : 'CONSIDER') as TestItem['automatable'],
    orderIndex: i, isDeleted: false,
  }))
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const action = formData.get('action') as string
    const reviewModelId = formData.get('reviewModelId') as string || 'google/gemini-2.0-flash-001'
    const reviewModelLabel = formData.get('reviewModelLabel') as string || 'Gemini 2.0 Flash'
    const projectId = formData.get('projectId') as string || ''
    const designMeta: DesignMeta | undefined = (() => { try { return JSON.parse(formData.get('designMeta') as string) } catch { return undefined } })()

    if (action === 'review_generated') {
      const items: TestItem[] = JSON.parse(formData.get('items') as string)
      const result = await runSingleReview(items, designMeta, reviewModelId, reviewModelLabel, projectId)
      return NextResponse.json(result)
    }
    if (action === 'review_excel') {
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
      const XLSX = await import('xlsx')
      const fileList: Array<{ filename: string; items: TestItem[] }> = []
      let i = 0
      while (true) {
        const f = formData.get(`file_${i}`) as File | null
        if (!f) break
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as string[][]
        fileList.push({ filename: f.name, items: parseExcelItems(rows) })
        i++
      }
      if (fileList.length < 2) return NextResponse.json({ error: '2ファイル以上必要です' }, { status: 400 })
      const result = await runCompareReview(fileList, reviewModelId, designMeta, projectId)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: '不明なaction' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[review]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
