import { NextResponse } from 'next/server'
import { getProject, updateProject, updateJob } from '@/lib/db'
import type { PageInfo } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { jobId, projectId, count, isPartial, targetPages } : {
    jobId: string; projectId: string; count: number; isPartial: boolean; targetPages: PageInfo[] | null
  } = await req.json()

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const baseCount = targetPages?.length ? (project.testItemCount ?? 0) : 0
  await updateProject({
    ...project,
    status: 'generated',
    testItemCount: baseCount + count,
    updatedAt: new Date().toISOString(),
  })

  await updateJob(jobId, {
    status: 'completed',
    stage: 4,
    message: isPartial ? `途中保存（${count}件）` : `完了（${count}件）`,
    count,
    // @ts-ignore
    isPartial,
  })

  return NextResponse.json({ ok: true })
}
