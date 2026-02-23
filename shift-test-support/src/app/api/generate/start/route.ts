/**
 * /api/generate/start
 * 
 * jobIdを登録してすぐ返す。
 * フロント側がbatch APIを必要回数呼んで生成を完結させる。
 */
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getProject, clearTestItems, saveJob, updateJob, updateProject, type GenerationJob } from '@/lib/db'
import type { PageInfo } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json()
  const { projectId, maxItems = 100, perspectives, targetPages = null, modelOverride }:
    { projectId: string; maxItems: number; perspectives?: string[]; targetPages: PageInfo[] | null; modelOverride?: string } = body

  if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

  // 全体をクリア（追記モードでない場合）
  if (!targetPages || targetPages.length === 0) {
    await clearTestItems(projectId)
  }

  const BATCH_SIZE = 50
  const totalBatches = Math.ceil(maxItems / BATCH_SIZE)

  const jobId = uuidv4()
  const now = new Date().toISOString()
  const job: GenerationJob = {
    id: jobId, projectId,
    status: 'running', stage: 0, message: 'ジョブ開始...',
    createdAt: now, updatedAt: now,
  }
  await saveJob(job)
  console.log(`[start][${jobId}] projectId=${projectId} maxItems=${maxItems} batches=${totalBatches}`)

  // フロントに必要な情報を全部返す
  return NextResponse.json({
    jobId,
    totalBatches,
    batchSize: BATCH_SIZE,
    maxItems,
    perspectives,
    targetPages,
    modelOverride,
    projectId,
  })
}
