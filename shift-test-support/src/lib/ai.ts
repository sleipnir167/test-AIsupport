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
}

// refMapの型をエクスポート
export interface RefMapEntry {
  refId: string
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

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  // REF番号付きのチャンク一覧を構築（コンテキスト外部でも参照できるよう先に作る）
  const allChunksOrdered = [...docChunks, ...siteChunks, ...sourceChunks]
  const refMap: RefMapEntry[] = allChunksOrdered.map((c, i) => ({
    refId: `REF-${i + 1}`,
    filename: c.filename,
    category: c.category,
    excerpt: c.text.slice(0, 250),
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
    "automatable": "YES または NO または CONSIDER",
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
  refMap: RefMapEntry[] = []
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
    automatable: string
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
            filename: meta.filename,
            category: meta.category,
            excerpt: meta.excerpt + (sr.reason ? `\n\n【導出根拠】${sr.reason}` : ''),
            pageUrl: meta.pageUrl ?? undefined,
          })
        } else {
          // REF番号が見つからない場合でも理由を保持
          sourceRefs.push({
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
      automatable: (['YES', 'NO', 'CONSIDER'].includes(item.automatable) ? item.automatable : 'CONSIDER') as TestItem['automatable'],
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
  customSystemPrompt?: string
  testPhase?: string  // テスト工程（単体テスト/結合テスト/システムテスト等）
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
  const perspectives = options.perspectives || ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  const allChunksOrdered = [...docChunks, ...siteChunks, ...sourceChunks]
  const refMap: RefMapEntry[] = allChunksOrdered.map((c, i) => ({
    refId: `REF-${i + 1}`,
    filename: c.filename,
    category: c.category,
    excerpt: c.text.slice(0, 250),
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

  const systemPrompt = options.customSystemPrompt || `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
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
}

export function buildBatchFromPlanPrompts(
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: BatchFromPlanOptions
): BuildPromptsResult {
  const { batchId, totalBatches, category, perspective, titles } = options

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'MSOK_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  const allChunksOrdered = [...docChunks, ...siteChunks, ...sourceChunks]
  const refMap: RefMapEntry[] = allChunksOrdered.map((c, i) => ({
    refId: `REF-${i + 1}`,
    filename: c.filename,
    category: c.category,
    excerpt: c.text.slice(0, 250),
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
    buildContext(docChunks,    '仕様・要件ドキュメント', 50000, 0),
    buildContext(siteChunks,   'サイト構造・画面情報',   12000, docChunks.length),
    buildContext(sourceChunks, 'ソースコード',            30000, docChunks.length + siteChunks.length),
  ].join('')

  const refMapSummary = refMap.length > 0
    ? `\n\n## 参照資料一覧\n` + refMap.map(r => `${r.refId}: [${r.category}] ${r.filename}${r.pageUrl ? ' (' + r.pageUrl + ')' : ''}`).join('\n')
    : ''

  const titleList = titles.map((t, i) => `${i + 1}. ${t}`).join('\n')

  const systemPrompt = options.customSystemPrompt || `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたテストタイトルリストに対して、仕様書を参照しながら各テスト項目の詳細（手順・期待結果・事前条件など）を日本語で作成してください。
必ずJSON配列のみで回答し、マークダウンのコードブロックや説明文は一切含めないでください。
件数は必ず指定された数を出力してください。`

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
    "automatable": "YES または NO または CONSIDER",
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
