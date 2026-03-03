/**
 * GET /api/test-execution/status?sessionId=xxx
 *
 * 実行セッションのステータス取得
 * 既存の /api/generate/status と同パターン
 */

import { NextResponse } from 'next/server'
import { getExecutionSession } from '@/lib/execution-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId は必須です' }, { status: 400 })
  }

  const session = await getExecutionSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'セッションが見つかりません（TTL切れの可能性）' }, { status: 404 })
  }

  return NextResponse.json(session)
}
