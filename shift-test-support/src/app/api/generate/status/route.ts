import { NextResponse } from 'next/server'
import { getJob } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobIdは必須です' }, { status: 400 })

  const job = await getJob(jobId)
  if (!job) return NextResponse.json({ error: 'ジョブが見つかりません（TTL切れの可能性）' }, { status: 404 })

  // debugPrompt, debugError も含めてそのまま返す
  return NextResponse.json(job)
}
