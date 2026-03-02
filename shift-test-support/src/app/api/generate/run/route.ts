/**
 * POST /api/generate/run
 *
 * ⚠️ REMOVED: このルートは旧来の直接生成フローです。
 * 現在は /api/generate/plan → /api/generate/batch の2ステップフローを使用してください。
 *
 * このエンドポイントは出典ずれ修正（REFマップ pinnedRefMap 未対応）のため廃止しました。
 * 呼び出し元を /api/generate/plan + /api/generate/batch に移行してください。
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'このエンドポイントは廃止されました。' +
        '/api/generate/plan → /api/generate/batch の2ステップフローを使用してください。',
      deprecated: true,
    },
    { status: 410 }
  )
}
