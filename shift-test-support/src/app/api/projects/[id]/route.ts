import { NextResponse } from 'next/server'
import { getProject, updateProject, deleteProject } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id)
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    return NextResponse.json(project)
  } catch (e) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id)
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    const body = await req.json()
    await updateProject({ ...project, ...body, id: params.id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const userId = getCurrentUserId()
    await deleteProject(userId, params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
