import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getTestItems, saveTestItem, updateTestItem, softDeleteTestItem } from '@/lib/db'
import type { TestItem } from '@/types'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    const items = await getTestItems(projectId)
    return NextResponse.json(items)
  } catch (e) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { projectId, categoryMajor, categoryMinor, testPerspective, testTitle, precondition, steps, expectedResult, priority, automatable } = body

    if (!projectId || !testTitle) {
      return NextResponse.json({ error: 'projectIdとtestTitleは必須です' }, { status: 400 })
    }

    const items = await getTestItems(projectId)
    const item: TestItem = {
      id: uuidv4(),
      projectId,
      testId: `TC-${String(items.length + 1).padStart(3, '0')}`,
      categoryMajor: categoryMajor || '未分類',
      categoryMinor: categoryMinor || '正常系',
      testPerspective: testPerspective || '機能テスト',
      testTitle,
      precondition: precondition || '',
      steps: steps || [],
      expectedResult: expectedResult || '',
      priority: priority || 'MEDIUM',
      automatable: automatable || 'CONSIDER',
      orderIndex: items.length,
      isDeleted: false,
    }
    await saveTestItem(item)
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: '追加に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'idは必須です' }, { status: 400 })
    await updateTestItem({ id, ...rest })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'idは必須です' }, { status: 400 })
    await softDeleteTestItem(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
