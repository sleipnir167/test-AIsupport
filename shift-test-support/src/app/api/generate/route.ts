import { NextResponse } from 'next/server'
import { getProject, updateProject, saveTestItems, clearTestItems } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { generateTestItems } from '@/lib/ai'

export const maxDuration = 120 // Vercel function timeout (seconds)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { projectId, maxItems = 50, perspectives } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
    }

    const project = await getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // 1. RAG検索 - プロジェクトに関連するチャンクを取得
    const query = `${project.targetSystem} テスト項目 機能一覧 要件 画面 操作`
    const chunks = await searchChunks(query, projectId, 15)

    // 2. AIでテスト項目生成
    const items = await generateTestItems(
      projectId,
      project.name,
      project.targetSystem,
      chunks,
      { maxItems, perspectives }
    )

    // 3. 既存テスト項目をクリアして新規保存
    await clearTestItems(projectId)
    await saveTestItems(items)

    // 4. プロジェクトのステータス・件数を更新
    await updateProject({
      ...project,
      status: 'generated',
      testItemCount: items.length,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      count: items.length,
      ragChunksUsed: chunks.length,
      provider: process.env.AI_PROVIDER || 'openrouter',
      model: process.env.AI_PROVIDER === 'openai'
        ? process.env.OPENAI_MODEL
        : process.env.OPENROUTER_MODEL,
    })
  } catch (e) {
    console.error('POST /api/generate error:', e)
    const message = e instanceof Error ? e.message : 'AI生成に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
