import OpenAI from 'openai'
import type { VectorMetadata } from './vector'
import type { TestItem } from '@/types'
import { v4 as uuidv4 } from 'uuid'

/**
 * AI プロバイダーを環境変数で切り替える
 * AI_PROVIDER=openrouter → OpenRouter（DeepSeek等）
 * AI_PROVIDER=openai    → OpenAI（GPT-4o等）
 */
function createAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'

  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    }
  }

  // OpenRouter（デフォルト）
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

/**
 * RAGコンテキストからプロンプトを構築してテスト項目を生成する
 */
export async function generateTestItems(
  projectId: string,
  projectName: string,
  targetSystem: string,
  chunks: VectorMetadata[],
  options: {
    maxItems?: number
    perspectives?: string[]
  } = {}
): Promise<TestItem[]> {
  const { client, model } = createAIClient()
  const maxItems = options.maxItems || 50
  const perspectives = options.perspectives || ['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']

  // コンテキスト構築（最大4000文字）
  const contextText = chunks
    .map((c, i) => `【参考資料${i + 1}: ${c.filename}（${c.category}）】\n${c.text}`)
    .join('\n\n')
    .slice(0, 4000)

  const systemPrompt = `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたシステム仕様・設計書・サイト構造・ソースコードを分析し、品質を担保するための網羅的なテスト項目書を日本語で作成してください。
必ずJSON形式のみで回答し、それ以外のテキストは含めないでください。`

  const userPrompt = `プロジェクト名: ${projectName}
テスト対象システム: ${targetSystem}
テスト観点: ${perspectives.join('、')}
生成件数目安: ${maxItems}件以内

【参考資料（RAG検索結果）】
${contextText || '※ 参考資料なし。一般的なWebシステムとしてテスト項目を生成してください。'}

上記を元に、テスト項目を以下のJSON配列形式で出力してください。他のテキストは一切含めず、JSONのみ返してください。

[
  {
    "categoryMajor": "大分類（例: ログイン機能）",
    "categoryMinor": "中分類（例: 正常系）",
    "testPerspective": "テスト観点（機能テスト/正常系/異常系/境界値/セキュリティ/操作性のいずれか）",
    "testTitle": "テスト項目名（50文字以内）",
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
    max_tokens: 8000,
  })

  const content = response.choices[0]?.message?.content || '[]'

  // JSON部分を抽出（Markdown コードブロック対応）
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AIの応答からJSONを抽出できませんでした')

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

  // カテゴリ別に連番を振る
  const counterMap = new Map<string, number>()

  return rawItems.map((item, idx) => {
    const major = item.categoryMajor || '未分類'
    const count = (counterMap.get(major) || 0) + 1
    counterMap.set(major, count)
    const prefix = major.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'T')
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
