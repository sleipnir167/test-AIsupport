/**
 * POST /api/test-execution/run
 *
 * テスト項目をAIエージェントで自動実行するAPI（SSEストリーミング）
 *
 * 既存の /api/generate/route.ts と同じSSEパターンを採用
 *
 * リクエスト: { projectId, targetUrl, testItems, maxItems? }
 *
 * SSE イベント:
 *   progress  進捗通知
 *   result    テスト1件の実行結果
 *   done      全件完了サマリー
 *   error     エラー通知
 */

import { v4 as uuidv4 } from 'uuid'
import { executeTestItem } from '@/lib/test-executor'
import type { ExecutionSession } from '@/lib/test-executor'
import { saveExecutionSession, updateExecutionSession, saveExecutionResult } from '@/lib/execution-db'
import type { TestItem } from '@/types'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId,
    targetUrl,
    testItems,
    maxItems = 10,
  }: {
    projectId: string
    targetUrl: string
    testItems: TestItem[]
    maxItems?: number
  } = body

  if (!projectId || !targetUrl || !testItems?.length) {
    return new Response(
      JSON.stringify({ error: 'projectId, targetUrl, testItems は必須です' }),
      { status: 400 }
    )
  }

  const sessionId = uuidv4()
  const items = testItems.slice(0, maxItems)
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array>

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
    const session: ExecutionSession = {
      sessionId,
      projectId,
      targetUrl,
      status: 'running',
      totalItems: items.length,
      completedItems: 0,
      passedItems: 0,
      failedItems: 0,
      errorItems: 0,
      results: [],
      startedAt: new Date().toISOString(),
    }
    await saveExecutionSession(session)

    send('progress', {
      sessionId,
      stage: 0,
      message: `テスト実行開始: ${items.length}件`,
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

        await saveExecutionResult(sessionId, result)
        session.results.push(result)
        session.completedItems = i + 1
        if (result.status === 'passed') session.passedItems++
        else if (result.status === 'failed') session.failedItems++
        else session.errorItems++
        await updateExecutionSession(session)

        send('result', { result })
      }

      session.status = 'completed'
      session.finishedAt = new Date().toISOString()
      await updateExecutionSession(session)

      const passRate = items.length > 0
        ? Math.round((session.passedItems / session.totalItems) * 100)
        : 0

      send('done', {
        sessionId,
        summary: {
          totalItems: session.totalItems,
          passedItems: session.passedItems,
          failedItems: session.failedItems,
          errorItems: session.errorItems,
          passRate,
        },
      })
    } catch (e) {
      session.status = 'failed'
      session.finishedAt = new Date().toISOString()
      await updateExecutionSession(session)
      send('error', { message: e instanceof Error ? e.message : 'テスト実行に失敗しました' })
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
