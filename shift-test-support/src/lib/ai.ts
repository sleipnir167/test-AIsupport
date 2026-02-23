import type { VectorMetadata } from './vector'
import type { TestItem } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export interface GenerateOptions {
  maxItems?: number
  perspectives?: string[]
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

  // コンテキストサイズ：1回のAI呼び出しが20〜30秒で完了するよう調整
  // 大きすぎるとAIの応答生成に時間がかかり、60秒タイムアウトで打ち切られる
  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 6000),
    buildContext(siteChunks,   'サイト構造・画面情報',   3000),
    buildContext(sourceChunks, 'ソースコード',           5000),
  ].join('')

  const pagesFocus = targetPages?.length
    ? `\n\n## テスト対象画面（以下の画面に絞ってテスト項目を生成してください）\n${targetPages.map(p => `- ${p.title} (${p.url})`).join('\n')}`
    : ''

  const systemPrompt = `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたシステム仕様・設計書・サイト構造・ソースコードを分析し、品質を担保するための網羅的なテスト項目書を日本語で作成してください。
必ずJSON配列のみで回答し、マークダウンのコードブロックや説明文は一切含めないでください。`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
テスト観点: ${perspectives.join('、')}
生成件数: ${maxItems}件（必ず${maxItems}件以上出力してください。少なすぎる場合は網羅性が不足しています）
${pagesFocus}

【参考資料（RAG検索結果）】${contextText || '\n※ 参考資料なし。一般的なWebシステムとして生成してください。'}

上記を元に、以下のJSON配列形式のみで出力してください。他のテキストは絶対に含めないでください。

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
  // 文字列値の中にある生の制御文字（タブ・改行など）をエスケープ
  // JSON仕様では文字列内の \n \t \r は \\n \\t \\r でなければならない
  return raw.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
    return match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      // U+0000–U+001F の制御文字（\n\r\t 以外）を除去
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  })
}

/**
 * 不完全なJSON配列を末尾から切り詰めて修復する
 */
function repairJsonArray(raw: string): string {
  // コードブロックを除去
  let s = raw.replace(/```(?:json)?/gi, '').trim()

  // 先頭の [ を探す
  const start = s.indexOf('[')
  if (start === -1) throw new Error('JSON配列の開始が見つかりません')
  s = s.slice(start)

  // まず制御文字をサニタイズ
  s = sanitizeJson(s)

  // そのままパースできれば返す
  try { JSON.parse(s); return s } catch {}

  // 末尾から } を探して切り詰め、配列として閉じる
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
  return rawItems.map((item, idx) => {
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
      steps: Array.isArray(item.steps) ? item.steps : [],
      expectedResult: item.expectedResult || '',
      priority: (['HIGH', 'MEDIUM', 'LOW'].includes(item.priority)
        ? item.priority : 'MEDIUM') as TestItem['priority'],
      automatable: (['YES', 'NO', 'CONSIDER'].includes(item.automatable)
        ? item.automatable : 'CONSIDER') as TestItem['automatable'],
      orderIndex: idx,
      isDeleted: false,
    }
  })
}
