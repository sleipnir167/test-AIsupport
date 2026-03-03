/**
 * test-executor.ts
 *
 * AIエージェントによるテスト自動実行エンジン
 *
 * ─── 動作モード ───────────────────────────────────────────────
 *
 * [シミュレーションモード] ← PoCはこちら
 *   OPENROUTER_API_KEY/OPENAI_API_KEY 設定済み:
 *     Claude が tool_use でテスト手順を解釈・合否判定
 *     実際のブラウザは起動しないが AIが判定まで行う
 *
 *   APIキー未設定:
 *     モック実行（手順をそのまま passed として返す）
 *     UI・フロー確認に使用
 *
 * [実ブラウザモード]
 *   PLAYWRIGHT_ENDPOINT 設定 → Playwright サービスに接続
 *
 * ─── Vercel 対応 ─────────────────────────────────────────────
 *   Redis は使わずメモリで管理（SSEストリーム期間中のみ保持）
 */

import OpenAI from 'openai'
import type { TestItem } from '@/types'

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

const BROWSER_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  { type: 'function', function: { name: 'browser_navigate', description: '指定URLにナビゲートする', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'browser_click', description: 'CSS セレクタまたはテキストで要素をクリックする', parameters: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } } } } },
  { type: 'function', function: { name: 'browser_fill', description: 'フォーム要素に値を入力する', parameters: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } } },
  { type: 'function', function: { name: 'browser_assert_text', description: 'ページ上に指定テキストが存在するか確認する', parameters: { type: 'object', properties: { text: { type: 'string' }, selector: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'browser_assert_url', description: '現在のURLが期待値と一致するか確認する', parameters: { type: 'object', properties: { expected: { type: 'string' } }, required: ['expected'] } } },
  { type: 'function', function: { name: 'browser_assert_element', description: '要素の存在・状態を検証する', parameters: { type: 'object', properties: { selector: { type: 'string' }, assertion: { type: 'string', enum: ['exists', 'not_exists', 'enabled', 'disabled', 'visible', 'hidden'] } }, required: ['selector', 'assertion'] } } },
  { type: 'function', function: { name: 'browser_screenshot', description: '現在の画面スクリーンショットを取得する（証跡用）', parameters: { type: 'object', properties: { label: { type: 'string' } } } } },
  { type: 'function', function: { name: 'browser_wait', description: '指定ミリ秒待機する', parameters: { type: 'object', properties: { ms: { type: 'number' } }, required: ['ms'] } } },
  { type: 'function', function: { name: 'browser_get_text', description: '要素のテキストを取得する', parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } } },
  { type: 'function', function: { name: 'report_verdict', description: 'テスト項目の最終合否判定を報告する（必ずこれで終了すること）', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['passed', 'failed', 'error', 'skipped'] }, actualResult: { type: 'string' }, verdict: { type: 'string' } }, required: ['status', 'actualResult', 'verdict'] } } },
]

class BrowserController {
  private endpoint: string | null
  private sessionId: string
  private screenshots: string[] = []

  constructor(sessionId: string) {
    this.endpoint = process.env.PLAYWRIGHT_ENDPOINT || null
    this.sessionId = sessionId
  }

  get isSimulation() { return !this.endpoint }

  async execute(toolName: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: string; screenshotUrl?: string; error?: string }> {
    if (this.endpoint) return this.callRemote(toolName, args)
    return this.simulate(toolName, args)
  }

  private async callRemote(toolName: string, args: Record<string, unknown>) {
    try {
      const res = await fetch(`${this.endpoint}/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: this.sessionId, tool: toolName, args }), signal: AbortSignal.timeout(15000) })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
      const data = await res.json()
      if (data.screenshotUrl) this.screenshots.push(data.screenshotUrl)
      return { success: true, result: data.result, screenshotUrl: data.screenshotUrl }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  private async simulate(toolName: string, args: Record<string, unknown>) {
    await new Promise(r => setTimeout(r, 40))
    const makeSvgShot = (label: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#0f172a"/><rect x="0" y="0" width="800" height="38" fill="#1e293b"/><circle cx="18" cy="19" r="5" fill="#ef4444"/><circle cx="34" cy="19" r="5" fill="#f59e0b"/><circle cx="50" cy="19" r="5" fill="#22c55e"/><text x="400" y="210" fill="#475569" font-size="16" text-anchor="middle" font-family="monospace">[SIMULATION MODE]</text><text x="400" y="235" fill="#334155" font-size="12" text-anchor="middle">${label.replace(/</g,'&lt;').slice(0,50)}</text><text x="400" y="258" fill="#1e293b" font-size="10" text-anchor="middle">${new Date().toLocaleString('ja-JP')}</text></svg>`
      const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      this.screenshots.push(url)
      return url
    }
    switch (toolName) {
      case 'browser_navigate': return { success: true, result: `[SIM] ナビゲート: ${args.url}` }
      case 'browser_click': return { success: true, result: `[SIM] クリック: ${args.selector || args.text}` }
      case 'browser_fill': return { success: true, result: `[SIM] 入力: ${args.selector} = "${args.value}"` }
      case 'browser_assert_text': return { success: true, result: `[SIM] テキスト確認OK: "${args.text}"` }
      case 'browser_assert_url': return { success: true, result: `[SIM] URL確認OK: ${args.expected}` }
      case 'browser_assert_element': return { success: true, result: `[SIM] 要素確認OK: ${args.selector} → ${args.assertion}` }
      case 'browser_screenshot': { const url = makeSvgShot(String(args.label || 'Screenshot')); return { success: true, result: '[SIM] スクリーンショット取得', screenshotUrl: url } }
      case 'browser_wait': await new Promise(r => setTimeout(r, Math.min(Number(args.ms) || 0, 200))); return { success: true, result: `[SIM] 待機: ${args.ms}ms` }
      case 'browser_get_text': return { success: true, result: '[SIM] サンプルテキスト' }
      default: return { success: false, error: `未知のツール: ${toolName}` }
    }
  }

  getScreenshots() { return [...this.screenshots] }
  async close() { if (this.endpoint) { try { await fetch(`${this.endpoint}/close/${this.sessionId}`, { method: 'DELETE' }) } catch {} } }
}

// APIキー未設定時の完全モック実行
async function executeMock(item: TestItem): Promise<TestExecutionResult> {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const steps: TestStepResult[] = []
  const rawSteps = Array.isArray(item.steps) ? item.steps : []
  for (let i = 0; i < rawSteps.length; i++) {
    await new Promise(r => setTimeout(r, 60))
    steps.push({ stepIndex: i, stepDescription: rawSteps[i], action: 'mock', status: 'passed', actualResult: `[MOCK] ステップ ${i + 1} 実行完了`, durationMs: 60 })
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#0f172a"/><rect x="0" y="0" width="800" height="38" fill="#1e293b"/><circle cx="18" cy="19" r="5" fill="#ef4444"/><circle cx="34" cy="19" r="5" fill="#f59e0b"/><circle cx="50" cy="19" r="5" fill="#22c55e"/><text x="400" y="200" fill="#475569" font-size="16" text-anchor="middle" font-family="monospace">[MOCK MODE]</text><text x="400" y="225" fill="#334155" font-size="12" text-anchor="middle">APIキー未設定 - UIフロー確認モード</text><text x="400" y="250" fill="#334155" font-size="11" text-anchor="middle">${item.testId}: ${item.testTitle.slice(0,40).replace(/</g,'&lt;')}</text></svg>`
  steps.push({ stepIndex: steps.length, stepDescription: '最終合否判定（MOCK）', action: 'report_verdict', status: 'passed', actualResult: 'モック実行のため passed として扱います', durationMs: 10 })
  return {
    testItemId: item.id, testId: item.testId, testTitle: item.testTitle, status: 'passed', steps,
    actualResult: 'モック実行完了（実際のブラウザ操作・AI判定なし）',
    expectedResult: item.expectedResult,
    verdict: '【MOCKモード】APIキーが未設定のため、テスト手順を解釈せずに passed を返しています。OPENROUTER_API_KEY または OPENAI_API_KEY を設定するとAIによる判定が有効になります。',
    screenshotUrls: [`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`],
    startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - startMs,
  }
}

export async function executeTestItem(
  item: TestItem,
  targetUrl: string,
  sessionId: string,
  onProgress?: (msg: string) => void
): Promise<TestExecutionResult> {
  const hasApiKey = !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)
  if (!hasApiKey) {
    onProgress?.(`[MOCK] ${item.testId}: APIキー未設定のためモック実行`)
    return executeMock(item)
  }

  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const browser = new BrowserController(sessionId)
  const stepResults: TestStepResult[] = []
  const screenshotUrls: string[] = []

  const provider = process.env.AI_PROVIDER || 'openrouter'
  const client = provider === 'openai'
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    : new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY!, baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': 'https://shift-test-support.vercel.app', 'X-Title': 'Shift AI Test Executor' } })
  const model = provider === 'openai'
    ? (process.env.OPENAI_EXEC_MODEL || 'gpt-4o')
    : (process.env.OPENROUTER_EXEC_MODEL || 'anthropic/claude-sonnet-4-5')

  const systemPrompt = `あなたはWebアプリケーションのQAエンジニアです。テスト項目を実行し、ブラウザ操作ツールを使って合否を判定してください。\n\n## ルール\n1. テスト手順を1ステップずつブラウザツールで実行する\n2. 重要な操作の前後は browser_screenshot で証跡を残す\n3. 全ステップ完了後は必ず report_verdict で終了する\n4. エラー発生時も report_verdict(status=error) で終了する\n5. ${browser.isSimulation ? '[シミュレーションモード: ブラウザ操作はシミュレーションです]' : `対象URL: ${targetUrl}`}\n\n## 判定基準\n- passed: 期待結果と実際の結果が一致\n- failed: 期待結果と実際の結果が不一致\n- error: 実行中に予期せぬエラー\n- skipped: 前提条件を満たせない場合`

  const stepsText = Array.isArray(item.steps) ? item.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : (item.steps || 'なし')
  const userPrompt = `以下のテスト項目を実行してください。\n\n【テストID】${item.testId}\n【テスト項目名】${item.testTitle}\n【テスト観点】${item.testPerspective}\n【大分類】${item.categoryMajor}\n\n【事前条件】\n${item.precondition || 'なし'}\n\n【テスト手順】\n${stepsText}\n\n【期待結果】\n${item.expectedResult}\n\n対象URL: ${targetUrl}\n\n上記手順に従いブラウザツールを使って実行し、最後に report_verdict で結果を報告してください。`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let finalVerdict: { status: TestExecutionResult['status']; actualResult: string; verdict: string } | null = null

  try {
    for (let turn = 0; turn < 15; turn++) {
      onProgress?.(`[${item.testId}] ターン${turn + 1}: AI判断中...`)
      const response = await client.chat.completions.create({ model, messages, tools: BROWSER_TOOLS, tool_choice: 'auto', max_tokens: 2000, temperature: 0.1 })
      const assistantMsg = response.choices[0]?.message
      if (!assistantMsg) break
      messages.push(assistantMsg)
      if (!assistantMsg.tool_calls?.length) break

      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = []
      for (const toolCall of assistantMsg.tool_calls) {
        const fnName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments || '{}')
        const stepStart = Date.now()
        onProgress?.(`[${item.testId}] ${fnName}`)

        if (fnName === 'report_verdict') {
          finalVerdict = { status: args.status as TestExecutionResult['status'], actualResult: args.actualResult || '', verdict: args.verdict || '' }
          stepResults.push({ stepIndex: stepResults.length, stepDescription: '最終合否判定', action: 'report_verdict', status: finalVerdict.status === 'passed' ? 'passed' : finalVerdict.status === 'skipped' ? 'skipped' : 'failed', actualResult: finalVerdict.actualResult, durationMs: Date.now() - stepStart })
          toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ ok: true }) })
          continue
        }

        const execResult = await browser.execute(fnName, args)
        browser.getScreenshots().forEach(u => { if (!screenshotUrls.includes(u)) screenshotUrls.push(u) })
        stepResults.push({ stepIndex: stepResults.length, stepDescription: fnName, action: fnName, selector: args.selector as string | undefined, value: args.value as string | undefined, status: execResult.success ? 'passed' : 'failed', actualResult: execResult.result, screenshotUrl: execResult.screenshotUrl, errorMessage: execResult.error, durationMs: Date.now() - stepStart })
        if (execResult.screenshotUrl && !screenshotUrls.includes(execResult.screenshotUrl)) screenshotUrls.push(execResult.screenshotUrl)
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(execResult.success ? { success: true, result: execResult.result } : { success: false, error: execResult.error }) })
      }
      messages.push(...toolResults)
      if (finalVerdict) break
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    await browser.close()
    return { testItemId: item.id, testId: item.testId, testTitle: item.testTitle, status: 'error', steps: stepResults, actualResult: '', expectedResult: item.expectedResult, verdict: `実行エラー: ${errMsg}`, screenshotUrls, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - startMs, errorMessage: errMsg }
  }

  await browser.close()
  return { testItemId: item.id, testId: item.testId, testTitle: item.testTitle, status: finalVerdict?.status || 'error', steps: stepResults, actualResult: finalVerdict?.actualResult || '', expectedResult: item.expectedResult, verdict: finalVerdict?.verdict || 'タイムアウト: report_verdict が未呼び出し', screenshotUrls, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - startMs, errorMessage: finalVerdict ? undefined : 'MAX_TURNS超過' }
}
