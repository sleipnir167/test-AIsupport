import type { VectorMetadata } from './vector'
import type { TestItem } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export interface PerspectiveWeight {
  value: string
  count: number // 0 = 生成しない
}

export interface GenerateOptions {
  maxItems?: number
  perspectives?: string[]
  perspectiveWeights?: PerspectiveWeight[] // 観点ごとの件数指定（指定時はmaxItems/perspectivesより優先）
  targetPages?: Array<{ url: string; title: string }> | null
}

/**
 * プロンプトを構築して返す（AIクライアントには依存しない）
 */
export function buildPrompts(
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: GenerateOptions = {}
): { systemPrompt: string; userPrompt: string } {
  const maxItems = options.maxItems || 100
  const perspectives = options.perspectives || ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']
  const perspectiveWeights = options.perspectiveWeights
  const targetPages = options.targetPages

  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'shift_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  const buildContext = (list: VectorMetadata[], label: string, maxLen: number) => {
    if (!list.length) return ''
    const text = list
      .map((c, i) => `[${label}${i + 1}: ${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`)
      .join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }

  // コンテキストサイズ：Gemini等の高速モデルは大きくても問題ない
  // GPT-4o-miniの場合は大きすぎると60秒タイムアウトになるが、バッチ方式のため許容
  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 10000),
    buildContext(siteChunks,   'サイト構造・画面情報',    4000),
    buildContext(sourceChunks, 'ソースコード',            8000),
  ].join('')

  const pagesFocus = targetPages?.length
    ? `\n\n## テスト対象画面（以下の画面に絞ってテスト項目を生成してください）\n${targetPages.map(p => `- ${p.title} (${p.url})`).join('\n')}`
    : ''

  // テスト観点の指示文を組み立て
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

  const systemPrompt = `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたシステム仕様・設計書・サイト構造・ソースコードを分析し、品質を担保するための網羅的なテスト項目書を日本語で作成してください。
必ずJSON配列のみで回答し、マークダウンのコードブロックや説明文は一切含めないでください。
件数は必ず指定された数を出力してください。少なすぎる場合は網羅性が不足しています。`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
${perspectivesInstruction}
【重要】生成件数: ちょうど${actualMaxItems}件を出力してください。${actualMaxItems}件未満は不合格です。各機能・画面・操作パターン・エラーケースを漏れなく列挙してください。
${pagesFocus}

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
    "automatable": "YES または NO または CONSIDER"
  }
]`

  return { systemPrompt, userPrompt }
}

/**
 * JSON文字列内の不正な制御文字・改行をエスケープして修復する
 */
function sanitizeJson(raw: string): string {
  return raw.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
    return match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  })
}

/**
 * 不完全なJSON配列を末尾から切り詰めて修復する
 */
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

/**
 * AIのテキスト応答をパースしてTestItem配列に変換する
 */
export function parseTestItems(content: string, projectId: string): TestItem[] {
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
  }>

  const counterMap = new Map<string, number>()
  return rawItems.map((item) => {
    const major = item.categoryMajor || '未分類'
    const count = (counterMap.get(major) || 0) + 1
    counterMap.set(major, count)
    const prefix = major.slice(0, 2)
    const testId = `${prefix}-${String(count).padStart(3, '0')}`

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
      orderIndex: index, // 配列内での順序を保持
      isDeleted: false,  // 初期値として false を設定
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })
}
