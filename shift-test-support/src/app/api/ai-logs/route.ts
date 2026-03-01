import { NextResponse } from 'next/server'
import { getAILogs, getAllAILogs } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const all = searchParams.get('all')

  if (all === '1') {
    const logs = await getAllAILogs()
    return NextResponse.json(logs)
  }
  if (projectId) {
    const logs = await getAILogs(projectId)
    return NextResponse.json(logs)
  }
  return NextResponse.json([])
}
