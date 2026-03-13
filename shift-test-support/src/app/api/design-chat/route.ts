/**
 * POST /api/design-chat
 *
 * テスト設計チャットAPI
 * - ユーザーの要求を理解し、テスト項目の追加・編集提案を生成する
 * - AIの提案をJSON形式で返し、フロントエンドで確認・適用できるようにする
 */
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { getTestItems, saveTestItem, updateTestItem, softDeleteTestItem, getAdminSettings } from '@/lib/db'
import type { TestItem, Priority, Automatable, TestPerspective } from '@/types'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

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

export interface DesignAction {
  type: 'add' | 'update' | 'delete'
  item: Partial<TestItem> & { id?: string }
  description: string // AIが生成した変更説明
}

export interface DesignChatResponse {
  ok: boolean
  message: string      // AIの回答メッセージ
  actions: DesignAction[]  // 提案するアクション一覧
  applied?: boolean    // 適用済みかどうか（自動適用モード時）
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      projectId,
      userMessage,
      history = [],
      autoApply = false,  // trueなら確認なしで即時適用
      modelOverride,
    } = body

    if (!projectId || !userMessage) {
      return NextResponse.json({ error: 'projectIdとuserMessageは必須です' }, { status: 400 })
    }

    // 現在のテスト項目を取得
    const existingItems = await getTestItems(projectId)
    const activeItems = existingItems.filter(t => !t.isDeleted)

    // モデル決定（設計チャット専用 → プランニングモデル の優先順）
    let resolvedModel = modelOverride
    if (!resolvedModel) {
      try {
        const adminSettings = await getAdminSettings()
        resolvedModel = (adminSettings as { defaultDesignChatModelId?: string; defaultPlanModelId?: string }).defaultDesignChatModelId
          || (adminSettings as { defaultPlanModelId?: string }).defaultPlanModelId
      } catch {}
    }
    const { client, model } = createAIClient(resolvedModel)

    // Temperature・MaxTokens を管理設定から取得
    let designTemperature = 0.3
    let designMaxTokens = 4000
    try {
      const adminSettings = await getAdminSettings() as { designChatTemperature?: number; designChatMaxTokens?: number }
      designTemperature = adminSettings.designChatTemperature ?? 0.3
      designMaxTokens   = adminSettings.designChatMaxTokens   ?? 4000
    } catch {}

    // 現在のテスト項目サマリーを作成
    // AIが update/delete 時に内部ID(uuid)を正しく参照できるよう id も含める
    const itemsSummary = activeItems.slice(0, 50).map(t =>
      `- [${t.testId}] id:${t.id} | ${t.categoryMajor} > ${t.categoryMinor} | ${t.testPerspective} | ${t.testTitle} (優先度:${t.priority})`
    ).join('\n')

    const systemPrompt = `あなたはソフトウェアテスト設計の専門家AIです。
ユーザーの要求に基づいて、テスト項目の追加・編集を提案します。

【現在のテスト項目一覧（${activeItems.length}件）】
${itemsSummary || '（まだテスト項目がありません）'}

【重要なルール】
1. ユーザーの要求を理解し、具体的なテスト項目を提案してください
2. 二重申請、境界値、異常系などのパターンを漏れなくカバーしてください
3. 回答は必ず以下のJSON形式で返してください（それ以外のテキストは含めないこと）

【出力形式】
{
  "message": "AIの説明メッセージ（日本語で分かりやすく）",
  "actions": [
    {
      "type": "add",
      "description": "このアクションの説明",
      "item": {
        "categoryMajor": "大分類",
        "categoryMinor": "中分類",
        "testPerspective": "機能テスト|正常系|異常系|境界値|セキュリティ|操作性|性能",
        "testTitle": "テスト項目名",
        "precondition": "前提条件",
        "steps": ["手順1", "手順2"],
        "expectedResult": "期待結果",
        "priority": "HIGH|MEDIUM|LOW",
        "automatable": "YES|NO|CONSIDER"
      }
    },
    {
      "type": "update",
      "description": "このアクションの説明",
      "item": {
        "id": "テスト項目一覧の id:xxxxx の部分（UUIDそのまま）",
        "testTitle": "更新後のテスト項目名",
        "expectedResult": "更新後の期待結果"
      }
    },
    {
      "type": "delete",
      "description": "このアクションの説明（削除理由）",
      "item": {
        "id": "テスト項目一覧の id:xxxxx の部分（UUIDそのまま）"
      }
    }
  ]
}

【重要】update/deleteのidは必ずテスト項目一覧の「id:xxxxx」の値（UUID）を使用してください。testId（TC-001など）ではありません。
testPerspectiveは必ず以下のいずれかにしてください: 機能テスト, 正常系, 異常系, 境界値, セキュリティ, 操作性, 性能`

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ]

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: designTemperature,
      max_tokens: designMaxTokens,
    })

    const rawContent = completion.choices[0]?.message?.content || '{}'

    // JSONを抽出してパース
    let parsed: { message: string; actions: DesignAction[] }
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent)
    } catch {
      // JSON解析失敗時はテキスト応答として返す
      return NextResponse.json({
        ok: true,
        message: rawContent,
        actions: [],
      })
    }

    const actions: DesignAction[] = parsed.actions || []

    // autoApplyモードの場合、即時にDBへ適用
    if (autoApply && actions.length > 0) {
      const currentItems = await getTestItems(projectId)
      const activeCount = currentItems.filter(t => !t.isDeleted).length

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]
        if (action.type === 'add') {
          const newItem: TestItem = {
            id: uuidv4(),
            projectId,
            testId: `TC-${String(activeCount + i + 1).padStart(3, '0')}`,
            categoryMajor: action.item.categoryMajor || '未分類',
            categoryMinor: action.item.categoryMinor || '正常系',
            testPerspective: (action.item.testPerspective as TestPerspective) || '機能テスト',
            testTitle: action.item.testTitle || '',
            precondition: action.item.precondition || '',
            steps: action.item.steps || [],
            expectedResult: action.item.expectedResult || '',
            priority: (action.item.priority as Priority) || 'MEDIUM',
            automatable: (action.item.automatable as Automatable) || 'CONSIDER',
            orderIndex: activeCount + i,
            isDeleted: false,
            priorityReason: 'テスト設計チャットにより追加',
          }
          await saveTestItem(newItem)
          // actionにIDを付与（フロント側で参照できるよう）
          action.item.id = newItem.id
          action.item.testId = newItem.testId
        } else if (action.type === 'update' && action.item.id) {
          const { id, ...rest } = action.item
          await updateTestItem({ id, ...rest })
        } else if (action.type === 'delete' && action.item.id) {
          await softDeleteTestItem(action.item.id)
        }
      }

      return NextResponse.json({
        ok: true,
        message: parsed.message || '',
        actions,
        applied: true,
      })
    }

    return NextResponse.json({
      ok: true,
      message: parsed.message || '',
      actions,
      applied: false,
    })
  } catch (e) {
    console.error('[design-chat] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// 提案を確定適用するエンドポイント
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { projectId, actions } = body as { projectId: string; actions: DesignAction[] }

    if (!projectId || !actions?.length) {
      return NextResponse.json({ error: 'projectIdとactionsは必須です' }, { status: 400 })
    }

    const currentItems = await getTestItems(projectId)
    const activeCount = currentItems.filter(t => !t.isDeleted).length
    const appliedItems: TestItem[] = []

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      if (action.type === 'add') {
        const newItem: TestItem = {
          id: uuidv4(),
          projectId,
          testId: `TC-${String(activeCount + i + 1).padStart(3, '0')}`,
          categoryMajor: action.item.categoryMajor || '未分類',
          categoryMinor: action.item.categoryMinor || '正常系',
          testPerspective: (action.item.testPerspective as TestPerspective) || '機能テスト',
          testTitle: action.item.testTitle || '',
          precondition: action.item.precondition || '',
          steps: action.item.steps || [],
          expectedResult: action.item.expectedResult || '',
          priority: (action.item.priority as Priority) || 'MEDIUM',
          automatable: (action.item.automatable as Automatable) || 'CONSIDER',
          orderIndex: activeCount + i,
          isDeleted: false,
          priorityReason: 'テスト設計チャットにより追加',
        }
        await saveTestItem(newItem)
        appliedItems.push(newItem)
      } else if (action.type === 'update' && action.item.id) {
        const { id, ...rest } = action.item
        await updateTestItem({ id, ...rest })
      } else if (action.type === 'delete' && action.item.id) {
        await softDeleteTestItem(action.item.id)
      }
    }

    return NextResponse.json({ ok: true, appliedItems })
  } catch (e) {
    console.error('[design-chat PUT] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
