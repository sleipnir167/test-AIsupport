/**
 * POST /api/test-execution/run
 *
 * テスト項目をAIエージェントで自動実行するAPI（SSEストリーミング）
 *
 * ─── Vercel 対応 ────────────────────────────────────────────
 * - Redis/Upstash に依存しない（ステートレス）
 * - 結果はSSEで直接クライアントに送信、永続化不要
 * - Vercel Hobby: maxDuration=60秒 → 3〜5件推奨
 * - Vercel Pro:   maxDuration=300秒 → 20件程度まで対応
 *
 * ─── 動作モード ──────────────────────────────────────────────
 * APIキーなし                            → モックモード（UI確認）
 * APIキーあり + PLAYWRIGHT_ENDPOINT なし → AIシミュレーション
 * APIキーあり + PLAYWRIGHT_ENDPOINT あり → 実ブラウザ
 */

import { v4 as uuidv4 } from 'uuid'
import { executeTestItem } from '@/lib/test-executor'
import type { TestItem } from '@/types'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: {
    projectId?: string
    targetUrl?: string
    testItems?: TestItem[]
    maxItems?: number
  }

  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'リクエストボディのパースに失敗しました' }),
      { status: 400 }
    )
  }

  const { projectId, targetUrl, testItems, maxItems = 10 } = body

  if (!projectId || !targetUrl || !testItems?.length) {
    return new Response(
      JSON.stringify({ error: 'projectId, targetUrl, testItems は必須です' }),
      { status: 400 }
    )
  }

  const sessionId = uuidv4()
  const items = testItems.slice(0, Math.min(maxItems, 50))
  const encoder = new TextEncoder()

  // ReadableStream + controller（既存の /api/generate と同一パターン）
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const readable = new ReadableStream<Uint8Array>({
    start(c) { controller = c },
  })

  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      )
    } catch { /* ストリーム閉鎖時は無視 */ }
  }

  const close = () => { try { controller.close() } catch {} }

  ;(async () => {
    let passedItems = 0
    let failedItems = 0
    let errorItems = 0

    const mode = process.env.PLAYWRIGHT_ENDPOINT
      ? '実ブラウザ'
      : (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)
        ? 'AIシミュレーション'
        : 'モック（APIキー未設定）'

    send('progress', {
      sessionId,
      stage: 0,
      message: `テスト実行開始: ${items.length}件 | ${mode}`,
      completedItems: 0,
      totalItems: items.length,
    })

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        send('progress', {
          sessionId,
          stage: 1,
          message: `[${i + 1}/${items.length}] ${item.testId}: ${item.testTitle}`,
          completedItems: i,
          totalItems: items.length,
          currentTestId: item.testId,
        })

        const result = await executeTestItem(
          item,
          targetUrl,
          sessionId,
          (msg) => send('progress', {
            sessionId,
            stage: 1,
            message: msg,
            completedItems: i,
            totalItems: items.length,
          })
        )

        if (result.status === 'passed')      passedItems++
        else if (result.status === 'failed') failedItems++
        else                                 errorItems++

        send('result', { result })
      }

      send('done', {
        sessionId,
        summary: {
          totalItems: items.length,
          passedItems,
          failedItems,
          errorItems,
          passRate: items.length > 0
            ? Math.round((passedItems / items.length) * 100)
            : 0,
        },
      })
    } catch (e) {
      send('error', {
        message: e instanceof Error ? e.message : 'テスト実行に失敗しました',
      })
    } finally {
      close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
