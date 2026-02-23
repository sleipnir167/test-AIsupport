import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getProject, saveJob, type GenerationJob } from '@/lib/db'
import type { PageInfo } from '@/types'

// このルートはjobIdを即返すだけ。処理は /run が担う。
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json()
  const { projectId, maxItems = 100, perspectives, targetPages = null }:
    { projectId: string; maxItems: number; perspectives?: string[]; targetPages: PageInfo[] | null } = body

  if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

  // ジョブ登録
  const jobId = uuidv4()
  const now = new Date().toISOString()
  const job: GenerationJob = {
    id: jobId, projectId,
    status: 'pending', stage: 0, message: 'ジョブを登録しました',
    createdAt: now, updatedAt: now,
  }
  await saveJob(job)

  // /run を fire-and-forget で呼び出す
  // next/server のfetchは内部URLへのリクエストをサポートしている
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // awaitしない（fire-and-forget）
  fetch(`${baseUrl}/api/generate/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, projectId, maxItems, perspectives, targetPages }),
  }).catch(e => console.error('fire-and-forget run failed:', e))

  // jobIdをすぐ返す
  return NextResponse.json({ jobId })
}
