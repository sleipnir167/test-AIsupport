/**
 * test-executor.ts
 *
 * AIエージェントによるテスト自動実行エンジン
 *
 * アーキテクチャ:
 *   Claude (tool_use) → BrowserController → 実行判定 → 証跡保存
 *
 * フロー:
 *   TestItem → AIがステップ解釈 → ブラウザ操作ツール呼び出し → 期待結果と比較 → TestExecutionResult
 *
 * 実行環境:
 *   - PLAYWRIGHT_ENDPOINT 未設定 → シミュレーションモード（PoC確認用）
 *   - PLAYWRIGHT_ENDPOINT 設定済 → Cloud Run 等のPlaywrightサービスと接続
 */

import OpenAI from 'openai'
import type { TestItem } from '@/types'

// ─── 型定義 ─────────────────────────────────────────────────────
export interface TestStepResult {
  stepIndex: number
  stepDescription: string
  action: string
  selector?: string
  value?: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  actualResult?: string
  screenshotUrl?: string
  errorMessage?: string
  durationMs: number
}

export interface TestExecutionResult {
  testItemId: string
  testId: string
  testTitle: string
  status: 'passed' | 'failed' | 'error' | 'skipped'
  steps: TestStepResult[]
  actualResult: string
  expectedResult: string
  verdict: string
  screenshotUrls: string[]
  startedAt: string
  finishedAt: string
  durationMs: number
  errorMessage?: string
}

export interface ExecutionSession {
  sessionId: string
  projectId: string
  targetUrl: string
  status: 'running' | 'completed' | 'failed' | 'aborted'
  totalItems: number
  completedItems: number
  passedItems: number
  failedItems: number
  errorItems: number
  results: TestExecutionResult[]
  startedAt: string
  finishedAt?: string
}

// ─── Claude tool_use ツール定義 ─────────────────────────────────
export const BROWSER_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: '指定URLにナビゲートする',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '遷移先URL' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'CSS セレクタまたはテキストで要素をクリックする',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS セレクタ' },
          text: { type: 'string', description: '要素のテキスト（セレクタ代替）' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_fill',
      description: 'フォーム要素に値を入力する',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'input/textarea の CSS セレクタ' },
          value: { type: 'string', description: '入力値' },
        },
        required: ['selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_select',
      description: 'セレクトボックスを選択する',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          value: { type: 'string', description: '選択するoption値またはテキスト' },
        },
        required: ['selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_assert_text',
      description: 'ページ上に指定テキストが存在するか確認する',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '期待するテキスト' },
          selector: { type: 'string', description: '探索範囲セレクタ（省略可）' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_assert_url',
      description: '現在のURLが期待値と一致するか確認する',
      parameters: {
        type: 'object',
        properties: {
          expected: { type: 'string', description: '期待するURL（部分一致可）' },
        },
        required: ['expected'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_assert_element',
      description: '要素の存在・状態を検証する',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          assertion: {
            type: 'string',
            enum: ['exists', 'not_exists', 'enabled', 'disabled', 'visible', 'hidden'],
          },
        },
        required: ['selector', 'assertion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: '現在の画面スクリーンショットを取得する（証跡用）',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'スクリーンショットのラベル' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_wait',
      description: '指定ミリ秒待機する',
      parameters: {
        type: 'object',
        properties: {
          ms: { type: 'number', description: '待機ミリ秒（最大5000）' },
        },
        required: ['ms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_text',
      description: '要素のテキストを取得する',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'report_verdict',
      description: 'テスト項目の最終合否判定を報告する（必ずこれで終了すること）',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['passed', 'failed', 'error', 'skipped'],
          },
          actualResult: {
            type: 'string',
            description: '実際の動作・状態の詳細',
          },
          verdict: {
            type: 'string',
            description: '合否判定の根拠',
          },
        },
        required: ['status', 'actualResult', 'verdict'],
      },
    },
  },
]

// ─── AIクライアント生成 ─────────────────────────────────────────
function createAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: process.env.OPENAI_EXEC_MODEL || 'gpt-4o',
    }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://shift-test-support.vercel.app',
        'X-Title': 'Shift AI Test Executor',
      },
    }),
    // tool_use 対応モデル（Claude推奨）
    model: process.env.OPENROUTER_EXEC_MODEL || 'anthropic/claude-sonnet-4-5',
  }
}

// ─── ブラウザコントローラー ─────────────────────────────────────
/**
 * PLAYWRIGHT_ENDPOINT 設定時 → 実際のPlaywrightサービスに接続
 * 未設定時 → シミュレーションモード（PoC動作確認用）
 */
export class BrowserController {
  private endpoint: string | null
  private sessionId: string
  private screenshotBuffer: string[] = []

  constructor(sessionId: string) {
    this.endpoint = process.env.PLAYWRIGHT_ENDPOINT || null
    this.sessionId = sessionId
  }

  isSimulation(): boolean {
    return !this.endpoint
  }

  async execute(toolName: string, args: Record<string, unknown>): Promise<{
    success: boolean
    result?: string
    screenshotUrl?: string
    error?: string
  }> {
    if (this.endpoint) {
      return this.executeRemote(toolName, args)
    }
    return this.executeSimulation(toolName, args)
  }

  private async executeRemote(toolName: string, args: Record<string, unknown>) {
    try {
      const res = await fetch(`${this.endpoint}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, tool: toolName, args }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${await res.text()}` }
      }
      const data = await res.json()
      if (data.screenshotUrl) {
        this.screenshotBuffer.push(data.screenshotUrl)
      }
      return { success: true, result: data.result, screenshotUrl: data.screenshotUrl }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  private async executeSimulation(toolName: string, args: Record<string, unknown>) {
    await new Promise(r => setTimeout(r, 30))
    switch (toolName) {
      case 'browser_navigate':
        return { success: true, result: `[SIMULATION] ナビゲート: ${args.url}` }
      case 'browser_click':
        return { success: true, result: `[SIMULATION] クリック: ${args.selector || args.text}` }
      case 'browser_fill':
        return { success: true, result: `[SIMULATION] 入力: ${args.selector} = "${args.value}"` }
      case 'browser_select':
        return { success: true, result: `[SIMULATION] 選択: ${args.selector} = ${args.value}` }
      case 'browser_assert_text':
        return { success: true, result: `[SIMULATION] テキスト確認OK: "${args.text}"` }
      case 'browser_assert_url':
        return { success: true, result: `[SIMULATION] URL確認OK: ${args.expected}` }
      case 'browser_assert_element':
        return { success: true, result: `[SIMULATION] 要素確認OK: ${args.selector} is ${args.assertion}` }
      case 'browser_screenshot': {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
          <rect width="800" height="450" fill="#0f172a"/>
          <rect x="0" y="0" width="800" height="40" fill="#1e293b"/>
          <circle cx="20" cy="20" r="6" fill="#ef4444"/>
          <circle cx="38" cy="20" r="6" fill="#f59e0b"/>
          <circle cx="56" cy="20" r="6" fill="#22c55e"/>
          <text x="400" y="200" fill="#94a3b8" font-size="18" text-anchor="middle" font-family="monospace">[SIMULATION MODE]</text>
          <text x="400" y="230" fill="#64748b" font-size="13" text-anchor="middle">${args.label || 'Screenshot'}</text>
          <text x="400" y="255" fill="#475569" font-size="11" text-anchor="middle">${new Date().toLocaleString('ja-JP')}</text>
        </svg>`
        const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
        this.screenshotBuffer.push(url)
        return { success: true, result: '[SIMULATION] スクリーンショット取得', screenshotUrl: url }
      }
      case 'browser_wait':
        await new Promise(r => setTimeout(r, Math.min(Number(args.ms) || 0, 200)))
        return { success: true, result: `[SIMULATION] 待機: ${args.ms}ms` }
      case 'browser_get_text':
        return { success: true, result: '[SIMULATION] サンプルテキスト' }
      default:
        return { success: false, error: `未知のツール: ${toolName}` }
    }
  }

  getScreenshots(): string[] {
    return [...this.screenshotBuffer]
  }

  async close() {
    if (this.endpoint) {
      try {
        await fetch(`${this.endpoint}/close/${this.sessionId}`, { method: 'DELETE' })
      } catch { /* 無視 */ }
    }
  }
}

// ─── テスト項目実行（メイン） ───────────────────────────────────
export async function executeTestItem(
  item: TestItem,
  targetUrl: string,
  sessionId: string,
  onProgress?: (msg: string) => void
): Promise<TestExecutionResult> {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const browser = new BrowserController(sessionId)
  const stepResults: TestStepResult[] = []
  const screenshotUrls: string[] = []

  const { client, model } = createAIClient()
  const isSimulation = browser.isSimulation()

  const systemPrompt = `あなたはWebアプリケーションのQAエンジニアです。
提供されたテスト項目を忠実に実行し、ブラウザ操作ツールを使って合否を判定してください。

## ルール
1. テスト手順を1ステップずつブラウザツールで実行する
2. 重要な操作の前後は browser_screenshot で証跡を残す
3. 全ステップ完了後は必ず report_verdict で終了する
4. エラー発生時も report_verdict(status=error) で終了する
5. ${isSimulation ? '[シミュレーションモード: 実際のブラウザ操作なし、テスト手順の解釈・実行フローの検証を行う]' : `対象URL: ${targetUrl}`}

## 判定基準
- passed: 期待結果と実際の結果が一致
- failed: 期待結果と実際の結果が不一致（バグの可能性）
- error: テスト実行中に予期せぬエラー
- skipped: 前提条件が満たせない場合`

  const userPrompt = `以下のテスト項目を実行してください。

【テストID】${item.testId}
【テスト項目名】${item.testTitle}
【テスト観点】${item.testPerspective}
【大分類】${item.categoryMajor}

【事前条件】
${item.precondition || 'なし'}

【テスト手順】
${Array.isArray(item.steps) ? item.steps.join('\n') : (item.steps || 'なし')}

【期待結果】
${item.expectedResult}

対象URL: ${targetUrl}

手順に従い実行し、最後に report_verdict で結果を報告してください。`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let finalVerdict: { status: TestExecutionResult['status']; actualResult: string; verdict: string } | null = null
  const MAX_TURNS = 20

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      onProgress?.(`[${item.testId}] ターン ${turn + 1}: AI思考中...`)

      const response = await client.chat.completions.create({
        model,
        messages,
        tools: BROWSER_TOOLS,
        tool_choice: 'auto',
        max_tokens: 2000,
        temperature: 0.1,
      })

      const assistantMessage = response.choices[0]?.message
      if (!assistantMessage) break
      messages.push(assistantMessage)

      if (!assistantMessage.tool_calls?.length) break

      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = []

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments || '{}')
        const stepStart = Date.now()

        onProgress?.(`[${item.testId}] ${fnName}(${JSON.stringify(args).slice(0, 60)})`)

        if (fnName === 'report_verdict') {
          finalVerdict = {
            status: args.status as TestExecutionResult['status'],
            actualResult: args.actualResult || '',
            verdict: args.verdict || '',
          }
          stepResults.push({
            stepIndex: stepResults.length,
            stepDescription: '最終合否判定',
            action: 'report_verdict',
            status: finalVerdict.status === 'passed' ? 'passed' : finalVerdict.status === 'skipped' ? 'skipped' : 'failed',
            actualResult: finalVerdict.actualResult,
            durationMs: Date.now() - stepStart,
          })
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: true }),
          })
          continue
        }

        const execResult = await browser.execute(fnName, args)
        const newScreenshots = browser.getScreenshots()
        newScreenshots.forEach(u => { if (!screenshotUrls.includes(u)) screenshotUrls.push(u) })

        stepResults.push({
          stepIndex: stepResults.length,
          stepDescription: `${fnName}`,
          action: fnName,
          selector: args.selector as string | undefined,
          value: args.value as string | undefined,
          status: execResult.success ? 'passed' : 'failed',
          actualResult: execResult.result,
          screenshotUrl: execResult.screenshotUrl,
          errorMessage: execResult.error,
          durationMs: Date.now() - stepStart,
        })

        if (execResult.screenshotUrl && !screenshotUrls.includes(execResult.screenshotUrl)) {
          screenshotUrls.push(execResult.screenshotUrl)
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(
            execResult.success
              ? { success: true, result: execResult.result }
              : { success: false, error: execResult.error }
          ),
        })
      }

      messages.push(...toolResults)
      if (finalVerdict) break
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    await browser.close()
    return {
      testItemId: item.id,
      testId: item.testId,
      testTitle: item.testTitle,
      status: 'error',
      steps: stepResults,
      actualResult: '',
      expectedResult: item.expectedResult,
      verdict: `実行エラー: ${errMsg}`,
      screenshotUrls,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      errorMessage: errMsg,
    }
  }

  await browser.close()

  return {
    testItemId: item.id,
    testId: item.testId,
    testTitle: item.testTitle,
    status: finalVerdict?.status || 'error',
    steps: stepResults,
    actualResult: finalVerdict?.actualResult || '',
    expectedResult: item.expectedResult,
    verdict: finalVerdict?.verdict || 'タイムアウト: report_verdict が未呼び出し',
    screenshotUrls,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    errorMessage: finalVerdict ? undefined : 'MAX_TURNS超過によるタイムアウト',
  }
}
