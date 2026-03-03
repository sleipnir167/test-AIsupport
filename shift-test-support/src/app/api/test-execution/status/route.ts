import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId は必須です' }, { status: 400 })
  return NextResponse.json({ sessionId, note: 'Vercel環境では結果はSSEイベントで直接受け取ります。' })
}
