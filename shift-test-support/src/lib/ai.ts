import type { VectorMetadata } from './vector'
import type { TestItem, SourceRef } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export interface PerspectiveWeight {
  value: string
  count: number
}

export interface GenerateOptions {
  maxItems?: number
  perspectives?: string[]
  perspectiveWeights?: PerspectiveWeight[]
  targetPages?: Array<{ url: string; title: string }> | null
  customSystemPrompt?: string
  excerptLength?: number  // REF抜粋文字数（デフォルト: 250）
}

// refMapの型をエクスポート
export interface RefMapEntry {
  refId: string
  /** チャンクの一意識別子（docId + chunkIndex でREF照合に使用） */
  docId: string
  chunkIndex: number
  filename: string
  category: string
  excerpt: string
  pageUrl?: string | null
}

export interface BuildPromptsResult {
  systemPrompt: string
  userPrompt: string
  refMap: RefMapEntry[]
}

export function buildPrompts(
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: GenerateOptions = {}
): BuildPromptsResult {
  const maxItems = options.maxItems || 100
  const perspectives = options.perspectives || ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']
  const perspectiveWeights = options.perspectiveWeights
  const targetPages = options.targetPages
  const excerptLength = options.excerptLength ?? 250

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  // REF番号付きのチャンク一覧を構築（コンテキスト外部でも参照できるよう先に作る）
  const allChunksOrdered = [...docChunks, ...siteChunks, ...sourceChunks]
  const refMap: RefMapEntry[] = allChunksOrdered.map((c, i) => ({
    refId: `REF-${i + 1}`,
    docId: c.docId,
    chunkIndex: c.chunkIndex,
    filename: c.filename,
    category: c.category,
    excerpt: c.text.slice(0, excerptLength),
    pageUrl: c.pageUrl,
  }))

  const buildContext = (list: VectorMetadata[], label: string, maxLen: number, offset = 0) => {
    if (!list.length) return ''
    const text = list
      .map((c, i) => `[REF-${offset + i + 1}: ${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`)
      .join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }

  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 60000, 0),
    buildContext(siteChunks,   'サイト構造・画面情報',   15000, docChunks.length),
    buildContext(sourceChunks, 'ソースコード',            50000, docChunks.length + siteChunks.length),
  ].join('')

  const pagesFocus = targetPages?.length
    ? `\n\n## テスト対象画面\n${targetPages.map(p => `- ${p.title} (${p.url})`).join('\n')}`
    : ''

  let perspectivesInstruction: string
  if (perspectiveWeights && perspectiveWeights.length > 0) {
    const active = perspectiveWeights.filter(w => w.count > 0)
    const total = active.reduce((s, w) => s + w.count, 0)
    perspectivesInstruction = `テスト観点と件数配分（合計${total}件）:\n` +
      active.map(w => `  - ${w.value}: ${w.count}件`).join('\n')
  } else {
    perspectivesInstruction = `テスト観点: ${perspectives.join('、')}`
  }

  const actualMaxItems = perspectiveWeights
    ? perspectiveWeights.reduce((s, w) => s + w.count, 0)
    : maxItems

  // REFマップのサマリをプロンプトに含める（全件、ただしコンパクトに）
  const refMapSummary = refMap.length > 0
    ? `\n\n## 参照資料一覧（sourceRefsのrefIdに使用）\n` +
      refMap.map(r => `${r.refId}: [${r.category}] ${r.filename}${r.pageUrl ? ' (' + r.pageUrl + ')' : ''}`).join('\n')
    : ''

  const systemPrompt = `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたシステム仕様・設計書・サイト構造・ソースコードを分析し、品質を担保するための網羅的なテスト項目書を日本語で作成してください。
必ずJSON配列のみで回答し、マークダウンのコードブロックや説明文は一切含めないでください。
件数は必ず指定された数を出力してください。`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
${perspectivesInstruction}
【重要】生成件数: ちょうど${actualMaxItems}件を出力してください。
${pagesFocus}
${refMapSummary}

【参考資料（RAG検索結果）】${contextText || '\n※ 参考資料なし。一般的なWebシステムとして生成してください。'}

以下のJSON配列形式のみで出力してください。他のテキストは絶対に含めないでください。

[
  {
    "categoryMajor": "大分類（例: ログイン機能）",
    "categoryMinor": "中分類（例: 正常系）",
    "testPerspective": "テスト観点（機能テスト/正常系/異常系/境界値/セキュリティ/操作性/性能のいずれか）",
    "testTitle": "テスト項目名（60文字以内）",
    "precondition": "事前条件",
    "steps": ["手順1", "手順2", "手順3"],
    "expectedResult": "期待結果",
    "priority": "HIGH または MEDIUM または LOW",
    "priorityReason": "優先度をこの値にした根拠（40文字以内）",
    "automatable": "YES または NO または CONSIDER",
    "automatableReason": "自動化可否をこの値にした根拠（40文字以内）",
    "sourceRefs": [
      {
        "refId": "REF-1",
        "reason": "このテスト項目を導出した根拠（50文字以内）"
      }
    ]
  }
]

【sourceRefsの記載ルール】
- 上記「参照資料一覧」に掲載されているREF番号を使用すること
- 各テスト項目の根拠となった参照資料のREF番号と理由を1〜3件記載
- 参照資料から導出したテスト項目は必ずsourceRefsを記載すること
- 参照資料が存在しない場合のみ空配列[]`

  return { systemPrompt, userPrompt, refMap }
}

// ─────────────────────────────────────────────────────────────────────────────
// ① Structured Outputs — JSON スキーマ定義
// ─────────────────────────────────────────────────────────────────────────────
//
// OpenAI: response_format: { type: "json_schema", json_schema: TEST_ITEM_JSON_SCHEMA }
// OpenRouter 経由 Gemini 等: response_format: { type: "json_object" }
//   ↑ json_schema 非対応モデルでは json_object にフォールバックする。
//
// いずれの場合も repairJsonArray はフォールバックとして残す。
// Structured Outputs が有効なときは実質ノーオペレーションになる。

export const TEST_ITEM_JSON_SCHEMA = {
  name: 'test_items',
  strict: true,
  schema: {
    type: 'array',
    items: {
      type: 'object',
      required: [
        'categoryMajor', 'categoryMinor', 'testPerspective',
        'testTitle', 'precondition', 'steps', 'expectedResult',
        'priority', 'priorityReason', 'automatable', 'automatableReason',
        'sourceRefs',
      ],
      additionalProperties: false,
      properties: {
        categoryMajor:      { type: 'string' },
        categoryMinor:      { type: 'string' },
        testPerspective: {
          type: 'string',
          enum: ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性', '性能'],
        },
        testTitle:       { type: 'string' },
        precondition:    { type: 'string' },
        steps:           { type: 'array', items: { type: 'string' } },
        expectedResult:  { type: 'string' },
        priority:        { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        priorityReason:  { type: 'string' },
        automatable:     { type: 'string', enum: ['YES', 'NO', 'CONSIDER'] },
        automatableReason: { type: 'string' },
        sourceRefs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['refId', 'reason'],
            additionalProperties: false,
            properties: {
              refId:  { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const

/** プランニング用 JSON スキーマ */
export const TEST_PLAN_JSON_SCHEMA = {
  name: 'test_plan',
  strict: true,
  schema: {
    type: 'array',
    items: {
      type: 'object',
      required: ['batchId', 'category', 'perspective', 'titles', 'count'],
      additionalProperties: false,
      properties: {
        batchId:     { type: 'number' },
        category:    { type: 'string' },
        perspective: { type: 'string' },
        titles:      { type: 'array', items: { type: 'string' } },
        count:       { type: 'number' },
      },
    },
  },
} as const

/**
 * モデルIDからJSON出力モードを自動推定する。
 *
 * 重要: OpenRouter 経由の openai/* モデルは Structured Outputs（json_schema）を
 * サポートしないケースがあるため json_object に倒す。
 * json_schema を使いたい場合は管理画面で手動設定すること。
 *
 *   AI_PROVIDER=openai（ネイティブ直接呼び出し）→ json_schema
 *   openai/* (OpenRouter経由)                   → json_object
 *   google/*                                    → json_object
 *   anthropic/*                                 → json_object
 *   deepseek/*                                  → json_object
 *   meta-llama/*                                → json_object
 *   mistralai/*                                 → json_object
 *   その他 / 不明                               → none（安全側）
 */
export function inferResponseFormat(
  modelId: string
): 'json_schema' | 'json_object' | 'none' {
  // ネイティブ OpenAI（直接呼び出し）のみ json_schema
  if (process.env.AI_PROVIDER === 'openai') return 'json_schema'

  const id = modelId.toLowerCase()

  // JSON object mode をサポートするプロバイダ
  // ※ openai/ を含む — OpenRouter経由の OpenAI モデルも json_object に統一
  if (
    id.startsWith('openai/') ||
    id.startsWith('google/') ||
    id.startsWith('anthropic/') ||
    id.startsWith('deepseek/') ||
    id.startsWith('meta-llama/') ||
    id.startsWith('mistralai/') ||
    id.startsWith('x-ai/')
  ) return 'json_object'

  // 不明なプロバイダは安全側（response_format を送らない）
  return 'none'
}

/**
 * モデルIDと CustomModelEntry の設定から response_format オブジェクトを返す。
 *
 * 優先順位:
 *   1. CustomModelEntry.responseFormat（管理画面で明示設定）
 *   2. inferResponseFormat()（自動推定）
 */
export function getResponseFormat(
  modelId: string,
  schema: typeof TEST_ITEM_JSON_SCHEMA | typeof TEST_PLAN_JSON_SCHEMA,
  modelEntry?: { responseFormat?: 'json_schema' | 'json_object' | 'none' }
): Record<string, unknown> | undefined {
  // 管理画面で明示設定されている場合はそれを使う
  const mode = modelEntry?.responseFormat ?? inferResponseFormat(modelId)

  if (mode === 'json_schema') return { type: 'json_schema', json_schema: schema }
  if (mode === 'json_object') return { type: 'json_object' }
  // 'none': response_format を送らない（undefined を返す）
  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON 修復ユーティリティ（Structured Outputs 非対応時のフォールバック）
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeJson(raw: string): string {
  return raw.replace(/\"((?:[^\"\\]|\\.)*)\"/g, (match) => {
    return match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  })
}

function repairJsonArray(raw: string): string {
  let s = raw.replace(/```(?:json)?/gi, '').trim()
  const start = s.indexOf('[')
  if (start === -1) throw new Error('JSON配列の開始が見つかりません')
  s = s.slice(start)
  s = sanitizeJson(s)
  try { JSON.parse(s); return s } catch {}
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === '}') {
      const candidate = s.slice(0, i + 1) + ']'
      try { JSON.parse(candidate); return candidate } catch {}
    }
  }
  throw new Error('JSONの修復に失敗しました')
}

export function parseTestItems(
  content: string,
  projectId: string,
  refMap: RefMapEntry[] = [],
  chunkExcerptMap?: Map<string, string>   
): TestItem[] {
  let jsonStr: string
  try {
    jsonStr = repairJsonArray(content)
  } catch (e) {
    throw new Error(`AIの応答からJSONを抽出できませんでした: ${(e as Error).message}\n応答先頭: ${content.slice(0, 300)}`)
  }

  const rawItems = JSON.parse(jsonStr) as Array<{
    categoryMajor: string
    categoryMinor: string
    testPerspective: string
    testTitle: string
    precondition: string
    steps: string[]
    expectedResult: string
    priority: string
    priorityReason?: string
    automatable: string
    automatableReason?: string
    sourceRefs?: Array<{ refId: string; reason: string }>
  }>

  // REF番号 → メタ情報の索引
  const refIndex = new Map(refMap.map(r => [r.refId, r]))

  const counterMap = new Map<string, number>()
  return rawItems.map((item) => {
    const major = item.categoryMajor || '未分類'
    const count = (counterMap.get(major) || 0) + 1
    counterMap.set(major, count)
    const prefix = major.slice(0, 2)
    const testId = `${prefix}-${String(count).padStart(3, '0')}`

    // sourceRefsをSourceRef[]に変換
    const sourceRefs: SourceRef[] = []
    if (Array.isArray(item.sourceRefs)) {
      for (const sr of item.sourceRefs) {
        if (!sr.refId) continue
        const meta = refIndex.get(sr.refId)
        if (meta) {
          sourceRefs.push({
            refId: sr.refId,          // REF-N番号を保持して画面で表示できるようにする
            filename: meta.filename,
            category: meta.category,
            excerpt: meta.excerpt + (sr.reason ? `\n\n【導出根拠】${sr.reason}` : ''),
            pageUrl: meta.pageUrl ?? undefined,
          })
        } else {
          // REF番号が見つからない場合でも理由を保持
          sourceRefs.push({
            refId: sr.refId,
            filename: sr.refId,
            category: 'unknown',
            excerpt: sr.reason || '',
          })
        }
      }
    }

    return {
      id: uuidv4(),
      projectId,
      testId,
      categoryMajor: item.categoryMajor || '未分類',
      categoryMinor: item.categoryMinor || '正常系',
      testPerspective: (item.testPerspective || '機能テスト') as TestItem['testPerspective'],
      testTitle: item.testTitle || '',
      precondition: item.precondition || '',
      steps: Array.isArray(item.steps) ? item.steps : [String(item.steps || '')],
      expectedResult: item.expectedResult || '',
      priority: (['HIGH', 'MEDIUM', 'LOW'].includes(item.priority) ? item.priority : 'MEDIUM') as TestItem['priority'],
      priorityReason: item.priorityReason || undefined,
      automatable: (['YES', 'NO', 'CONSIDER'].includes(item.automatable) ? item.automatable : 'CONSIDER') as TestItem['automatable'],
      automatableReason: item.automatableReason || undefined,
      orderIndex: 0,
      isDeleted: false,
      sourceRefs: sourceRefs.length > 0 ? sourceRefs : undefined,
    }
  })
}

// ─── プランニング用プロンプト ────────────────────────────────────

export interface PlanningOptions {
  totalItems: number
  batchSize: number
  perspectives?: string[]
  perspectiveWeights?: PerspectiveWeight[]
  targetPages?: Array<{ url: string; title: string }> | null
  customSystemPrompt?: string          // バッチ実行兼用（後方互換）
  planningSystemPrompt?: string        // プランニング専用上書き
  testPhase?: string  // テスト工程（単体テスト/結合テスト/システムテスト等）
  excerptLength?: number  // REF抜粋文字数（デフォルト: 250）
}

export interface BuildPlanPromptsResult {
  systemPrompt: string
  userPrompt: string
  refMap: RefMapEntry[]
}

export function buildPlanningPrompts(
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: PlanningOptions
): BuildPlanPromptsResult {
  const { totalItems, batchSize, perspectiveWeights, targetPages, testPhase } = options
  const excerptLength = options.excerptLength ?? 250
  const perspectives = options.perspectives || ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  const allChunksOrdered = [...docChunks, ...siteChunks, ...sourceChunks]
  const refMap: RefMapEntry[] = allChunksOrdered.map((c, i) => ({
    refId: `REF-${i + 1}`,
    docId: c.docId,
    chunkIndex: c.chunkIndex,
    filename: c.filename,
    category: c.category,
    excerpt: c.text.slice(0, excerptLength),
    pageUrl: c.pageUrl,
  }))

  const buildContext = (list: VectorMetadata[], label: string, maxLen: number, offset = 0) => {
    if (!list.length) return ''
    const text = list
      .map((c, i) => `[REF-${offset + i + 1}: ${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`)
      .join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }

  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 60000, 0),
    buildContext(siteChunks,   'サイト構造・画面情報',   15000, docChunks.length),
    buildContext(sourceChunks, 'ソースコード',            30000, docChunks.length + siteChunks.length),
  ].join('')

  const pagesFocus = targetPages?.length
    ? `\n\n## テスト対象画面\n${targetPages.map(p => `- ${p.title} (${p.url})`).join('\n')}`
    : ''

  const refMapSummary = refMap.length > 0
    ? `\n\n## 参照資料一覧\n` + refMap.map(r => `${r.refId}: [${r.category}] ${r.filename}${r.pageUrl ? ' (' + r.pageUrl + ')' : ''}`).join('\n')
    : ''

  // 観点配分の指示を構築
  let perspDistribution: string
  if (perspectiveWeights && perspectiveWeights.length > 0) {
    const active = perspectiveWeights.filter(w => w.count > 0)
    const total = active.reduce((s, w) => s + w.count, 0)
    perspDistribution = `テスト観点と全体件数配分（合計${total}件）:\n` +
      active.map(w => `  - ${w.value}: ${w.count}件（${Math.round(w.count / total * 100)}%）`).join('\n')
  } else {
    perspDistribution = `テスト観点（均等配分）: ${perspectives.join('、')}`
  }

  const totalBatches = Math.ceil(totalItems / batchSize)

  // planningSystemPrompt を優先し、次に customSystemPrompt、最後にデフォルト
  const systemPrompt = options.planningSystemPrompt || options.customSystemPrompt || `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供された仕様書・ソースコード・サイト構造を分析し、テスト項目の「全体プラン（目次）」をJSON配列形式のみで出力してください。
説明文・マークダウン・コードブロックは一切含めないでください。`

  const testPhaseInstruction = testPhase
    ? `\nテスト工程: ${testPhase}（この工程に適した観点・粒度・フォーカスでプランを立案すること）`
    : ''

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
総生成件数: ${totalItems}件
1バッチあたりの件数: ${batchSize}件
バッチ総数: ${totalBatches}バッチ${testPhaseInstruction}
${perspDistribution}
${pagesFocus}
${refMapSummary}

【重要な設計方針】
1. RAG参照: 上記の仕様書・参照資料を分析し、各機能・画面のボリュームに比例して件数を割り振ること
2. 網羅性: 正常系だけでなく、境界値・異常系・セキュリティ・操作性などの観点を指定された重みに基づき配分すること
3. 具体性: testTitleはタイトルだけで「何をテストするか」が一意に判別できるユニークな名称にすること
   良い例: 「パスワード入力欄に256文字以上の文字列を入力した場合のバリデーションエラー表示」
   悪い例: 「パスワードの境界値テスト」「異常系テスト」
4. 重複なし: 全${totalItems}件のtitleはプロジェクト全体で重複しないこと
5. 件数厳守: 全バッチのtitles配列の合計が必ず${totalItems}件になること

【参考資料（RAG検索結果）】${contextText || '\n※ 参考資料なし。一般的なWebシステムとして設計してください。'}

以下のJSON配列形式のみで出力してください（他のテキストは絶対に含めないでください）:

[
  {
    "batchId": 1,
    "category": "大分類（例: ログイン・認証）",
    "perspective": "テスト観点（例: 正常系、境界値分析、セキュリティ）",
    "titles": [
      "具体的なテストタイトル1（何をテストするか明確に）",
      "具体的なテストタイトル2",
      ...（このバッチの件数ぴったり）
    ],
    "count": バッチ内の件数
  },
  ...（計${totalBatches}バッチ）
]`

  return { systemPrompt, userPrompt, refMap }
}

// ─── バッチ実行用プロンプト（プランのバッチ1件を詳細化） ──────────

export interface BatchFromPlanOptions {
  batchId: number
  totalBatches: number
  category: string
  perspective: string
  titles: string[]
  customSystemPrompt?: string
  /** REF番号をバッチをまたいで一意にするためのグローバルオフセット（省略時 = 0）*/
  refOffset?: number
  /**
   * プランニング時に確定したREFマップ（Redisから取得）。
   * 指定された場合はRAGの再検索結果ではなくこのマップをそのまま使用するため
   * バッチをまたいでREF番号が一致しないずれを完全に防ぐことができる。
   */
  pinnedRefMap?: RefMapEntry[]
  excerptLength?: number  // REF抜粋文字数（デフォルト: 250）
}

export function buildBatchFromPlanPrompts(
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: BatchFromPlanOptions
): BuildPromptsResult {
  const { batchId, totalBatches, category, perspective, titles } = options
  const refOffset = options.refOffset ?? 0
  const excerptLength = options.excerptLength ?? 250

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')
  const allChunksOrdered = [...docChunks, ...siteChunks, ...sourceChunks]

  // ★ pinnedRefMap が存在する場合: プランニング時に確定したREFマップをそのまま使用。
  //    これにより「バッチごとにRAGが異なるチャンクを返しREF番号がずれる」問題を完全に解消する。
  // ★ pinnedRefMap がない場合（旧バッチ等）: 従来通りRAG結果からrefMapを構築。
  const refMap: RefMapEntry[] = options.pinnedRefMap
    ? options.pinnedRefMap
    : allChunksOrdered.map((c, i) => ({
        refId: `REF-${refOffset + i + 1}`,
        docId: c.docId,
        chunkIndex: c.chunkIndex,
        filename: c.filename,
        category: c.category,
        excerpt: c.text.slice(0, excerptLength),
        pageUrl: c.pageUrl,
      }))

  // コンテキストテキストは常にRAG結果から構築（実際の内容を参照させるため）。
  // ただし各チャンクの [REF-N] ラベルは pinnedRefMap と一致させる。
  // pinnedRefMap を使う場合、RAGチャンクと pinnedRefMap のエントリを docId+chunkIndex で照合してREF番号を付ける。
  // ★ 修正: filename+category 照合から docId+chunkIndex 照合に変更。
  //    同一ファイルに複数チャンクが存在する場合に正しいREFが当たらない問題を解消。
  const buildContext = (list: VectorMetadata[], label: string, maxLen: number, localOffset = 0) => {
    if (!list.length) return ''
    const text = list.map((c) => {
      let refLabel: string
      if (options.pinnedRefMap) {
        // pinnedRefMap の中から同じ docId + chunkIndex のエントリを探してREF番号を使う
        const matched = options.pinnedRefMap.find(
          r => r.docId === c.docId && r.chunkIndex === c.chunkIndex
        )
        refLabel = matched ? matched.refId : `REF-UNKNOWN`
      } else {
        // 従来ロジック: allChunksOrdered 内の位置から計算
        const idx = allChunksOrdered.findIndex(ac => ac.docId === c.docId && ac.chunkIndex === c.chunkIndex)
        refLabel = `REF-${refOffset + (idx >= 0 ? idx : localOffset) + 1}`
      }
      return `[${refLabel}: ${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`
    }).join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }

  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 50000, 0),
    buildContext(siteChunks,   'サイト構造・画面情報',   12000, docChunks.length),
    buildContext(sourceChunks, 'ソースコード',            30000, docChunks.length + siteChunks.length),
  ].join('')

  const refMapSummary = refMap.length > 0
    ? `\n\n## 参照資料一覧（sourceRefsのrefIdに使用すること）\n` + refMap.map(r => `${r.refId}: [${r.category}] ${r.filename}${r.pageUrl ? ' (' + r.pageUrl + ')' : ''}`).join('\n')
    : ''

  const titleList = titles.map((t, i) => `${i + 1}. ${t}`).join('\n')

  const systemPrompt = options.customSystemPrompt || `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。以下の制約を「死守」してください。\n\n## 任務\n提供されたテストタイトルリストに対して、仕様書を参照しながら各テスト項目の詳細（手順・期待結果・事前条件など）を日本語で作成してください。\n\n## 出力形式（最優先事項）\n1. 回答は「純粋なJSON配列」のみとする。\n2. マークダウンのコードブロックは絶対に使用しない。\n3. 説明文・挨拶などの自然言語は1文字も出力しない。\n4. JSONは [ で始まり ] で終わること。\n5. 指定された件数を必ず厳守すること。\n\n## sourceRefsの記載ルール（厳守）\n- refIdには必ず「参照資料一覧」に記載のREF番号（REF-1等）を使用すること\n- 一覧に存在しないREF番号・ファイル名・コード行は絶対に使用しないこと`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
バッチ: ${batchId}/${totalBatches}
大分類: ${category}
テスト観点: ${perspective}
【重要】以下の${titles.length}件のタイトルに対して、それぞれの詳細を設計してください。タイトルは変更不可。
${refMapSummary}

【生成対象タイトル一覧（${titles.length}件）】
${titleList}

【参考資料（RAG検索結果）】${contextText || '\n※ 参考資料なし。一般的なWebシステムとして設計してください。'}

以下のJSON配列形式のみで出力してください（${titles.length}件ちょうど）:

[
  {
    "categoryMajor": "${category}",
    "categoryMinor": "中分類（サブ機能・フロー）",
    "testPerspective": "${perspective}（機能テスト/正常系/異常系/境界値/セキュリティ/操作性/性能のいずれか）",
    "testTitle": "上記タイトルリストから対応するもの（変更不可）",
    "precondition": "事前条件",
    "steps": ["手順1", "手順2", "手順3"],
    "expectedResult": "期待結果（具体的に）",
    "priority": "HIGH または MEDIUM または LOW",
    "priorityReason": "優先度をこの値にした根拠（40文字以内）",
    "automatable": "YES または NO または CONSIDER",
    "automatableReason": "自動化可否をこの値にした根拠（40文字以内）",
    "sourceRefs": [
      {
        "refId": "REF-1",
        "reason": "このテスト項目を導出した根拠（50文字以内）"
      }
    ]
  }
]

【sourceRefsの記載ルール】
- 参照資料一覧のREF番号を使用
- 各テスト項目の根拠となった参照資料を1〜3件記載
- 参照資料が存在しない場合のみ空配列[]`

  return { systemPrompt, userPrompt, refMap }
}
