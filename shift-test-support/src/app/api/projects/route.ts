export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getProjects, saveProject } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth'
import type { Project } from '@/types'

export async function GET() {
  try {
    const userId = getCurrentUserId()
    const projects = await getProjects(userId)
    return NextResponse.json(projects)
  } catch (e) {
    console.error('GET /api/projects error:', e)
    return NextResponse.json({ error: 'プロジェクト一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = getCurrentUserId()
    const body = await req.json()
    const { name, description, targetSystem } = body

    if (!name || !targetSystem) {
      return NextResponse.json({ error: 'プロジェクト名とシステム名は必須です' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const project: Project = {
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || '',
      targetSystem: targetSystem.trim(),
      status: 'setup',
      testItemCount: 0,
      documentCount: 0,
      createdAt: now,
      updatedAt: now,
      hasUrlAnalysis: false,
      hasSourceCode: false,
    }

    await saveProject(userId, project)
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    console.error('POST /api/projects error:', e)
    return NextResponse.json({ error: 'プロジェクトの作成に失敗しました' }, { status: 500 })
  }
}
