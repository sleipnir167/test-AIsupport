import OpenAI from 'openai'
import type { VectorMetadata } from './vector'
import type { TestItem } from '@/types'
import { v4 as uuidv4 } from 'uuid'

function createAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
  }
}

export interface GenerateOptions {
  maxItems?: number
  perspectives?: string[]
  // 画面単位指定（null = 全体）
  targetPages?: Array<{ url: string; title: string }> | null
}

export async function generateTestItems(
  projectId: string,
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: GenerateOptions = {}
): Promise<TestItem[]> {
  const { client, model } = createAIClient()
  const maxItems = options.maxItems || 100
  const perspectives = options.perspectives || ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']
  const targetPages = options.targetPages

  // カテゴリ別にチャンクを整理
  const docChunks    = chunks.filter(c => c.category === 'customer_doc' || c.category === 'shift_knowledge')
  const siteChunks   = chunks.filter(c => c.category === 'site_analysis')
  const sourceChunks = chunks.filter(c => c.category === 'source_code')

  // コンテキスト構築（カテゴリ別に分けて最大6000文字）
  const buildContext = (list: VectorMetadata[], label: string, maxLen: number) => {
    if (!list.length) return ''
    const text = list.map((c, i) => `[${label}${i + 1}: ${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`).join('\n\n')
    return `\n\n## ${label}\n${text.slice(0, maxLen)}`
  }

  const contextText = [
    buildContext(docChunks,    '仕様・要件ドキュメント', 2500),
    buildContext(siteChunks,   'サイト構造・画面情報',  2000),
    buildContext(sourceChunks, 'ソースコード',          1500),
  ].join('')

  // 画面単位指定がある場合はフォーカス指示を追加
  const pagesFocus = targetPages && targetPages.length > 0
    ? `\n\n## テスト対象画面（以下の画面に絞ってテスト項目を生成してください）\n${targetPages.map(p => `- ${p.title} (${p.url})`).join('\n')}`
    : ''

  const systemPrompt = `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたシステム仕様・設計書・サイト構造・ソースコードを分析し、品質を担保するための網羅的なテスト項目書を日本語で作成してください。
必ずJSON配列のみで回答し、マークダウンのコードブロックや説明文は一切含めないでください。`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
テスト観点: ${perspectives.join('、')}
生成件数: ${maxItems}件程度（超えても構いません）
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

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 16000,
  })

  const content = response.choices[0]?.message?.content || '[]'

  // JSONの配列部分を抽出（コードブロック対応）
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`AIの応答からJSONを抽出できませんでした。応答先頭: ${content.slice(0, 200)}`)

  const rawItems = JSON.parse(jsonMatch[0]) as Array<{
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
      priority: (['HIGH', 'MEDIUM', 'LOW'].includes(item.priority) ? item.priority : 'MEDIUM') as TestItem['priority'],
      automatable: (['YES', 'NO', 'CONSIDER'].includes(item.automatable) ? item.automatable : 'CONSIDER') as TestItem['automatable'],
      orderIndex: idx,
      isDeleted: false,
    }
  })
}
