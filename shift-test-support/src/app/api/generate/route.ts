import { NextResponse } from 'next/server'
import { getProject, updateProject, saveTestItems, clearTestItems, getSiteAnalysis } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { generateTestItems } from '@/lib/ai'
import type { PageInfo } from '@/types'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      projectId,
      maxItems = 100,
      perspectives,
      // 画面単位: null = 全体, 配列 = 指定ページのみ
      targetPages = null,
    }: {
      projectId: string
      maxItems: number
      perspectives?: string[]
      targetPages: PageInfo[] | null
    } = body

    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await getProject(projectId)
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    // RAGクエリ：画面単位指定がある場合はページタイトル・URLも含める
    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    // カテゴリを分けて検索してバランスよく取得
    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, 12, undefined),
      searchChunks(pageQuery, projectId, 8, 'site_analysis'),
      searchChunks(pageQuery, projectId, 6, 'source_code'),
    ])

    // 重複除去してマージ
    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    // AIでテスト項目生成
    const items = await generateTestItems(
      projectId,
      project.name,
      project.targetSystem,
      allChunks,
      { maxItems, perspectives, targetPages }
    )

    // 保存（画面単位の場合は既存に追記、全体の場合はクリアして新規）
    if (targetPages && targetPages.length > 0) {
      // 追記モード：既存を保持して追加
      await saveTestItems(items)
    } else {
      // 全体モード：クリアして新規
      await clearTestItems(projectId)
      await saveTestItems(items)
    }

    // プロジェクト更新
    await updateProject({
      ...project,
      status: 'generated',
      testItemCount: (targetPages?.length ? project.testItemCount : 0) + items.length,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      count: items.length,
      ragChunksUsed: allChunks.length,
      breakdown: {
        documents: docChunks.length,
        siteAnalysis: siteChunks.length,
        sourceCode: sourceChunks.length,
      },
      provider: process.env.AI_PROVIDER || 'openrouter',
      model: process.env.AI_PROVIDER === 'openai' ? process.env.OPENAI_MODEL : process.env.OPENROUTER_MODEL,
    })
  } catch (e) {
    console.error('POST /api/generate error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI生成に失敗しました' }, { status: 500 })
  }
}
