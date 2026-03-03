/**
 * GET  /api/test-execution/results?sessionId=xxx  全件取得
 * GET  /api/test-execution/results?projectId=xxx  プロジェクトの全セッション一覧
 * DELETE /api/test-execution/results?sessionId=xxx&projectId=xxx  削除
 */

import { NextResponse } from 'next/server'
import {
  getExecutionResults,
  getProjectExecutionSessions,
  deleteExecutionSession,
} from '@/lib/execution-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const projectId = searchParams.get('projectId')

  if (sessionId) {
    const results = await getExecutionResults(sessionId)
    return NextResponse.json(results)
  }

  if (projectId) {
    const sessions = await getProjectExecutionSessions(projectId)
    return NextResponse.json(sessions)
  }

  return NextResponse.json(
    { error: 'sessionId または projectId が必要です' },
    { status: 400 }
  )
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const projectId = searchParams.get('projectId')

  if (!sessionId || !projectId) {
    return NextResponse.json(
      { error: 'sessionId と projectId が必要です' },
      { status: 400 }
    )
  }

  await deleteExecutionSession(sessionId, projectId)
  return NextResponse.json({ ok: true })
}
