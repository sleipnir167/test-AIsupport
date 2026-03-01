/**
 * POST /api/generate/run
 *
 * ⚠️ DEPRECATED: このルートは旧来の直接生成フローです。
 * 現在は /api/generate/plan → /api/generate/batch の2ステップフローを使用してください。
 * このルートは後方互換のために残していますが、RAGのtopKが非常に少ない（doc:12,site:8,src:6）など
 * 品質面で劣ります。新機能の開発はしないでください。
 *
 * フロントエンドはすべて /api/generate/plan + /api/generate/batch に移行済みです。
 */
import { NextResponse } from 'next/server'
import {
  getProject, updateProject,
  saveTestItems, clearTestItems,
  saveJob, updateJob,
} from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPrompts, parseTestItems } from '@/lib/ai'
import OpenAI from 'openai'
import type { PageInfo } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function createAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://shift-test-support.vercel.app',
        'X-Title': 'MSOK AI Test Support',
      },
    }),
    // ★ DEPRECATED: 旧来モデル設定。新フロー(/api/generate/batch)では modelOverride が使われる
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { jobId, projectId, maxItems = 100, perspectives, targetPages = null }:
    { jobId: string; projectId: string; maxItems: number; perspectives?: string[]; targetPages: PageInfo[] | null } = body

  if (!jobId || !projectId) {
    return NextResponse.json({ error: 'jobId, projectIdは必須です' }, { status: 400 })
  }

  const project = await getProject(projectId)
  if (!project) {
    await updateJob(jobId, { status: 'error', error: 'プロジェクトが見つかりません' })
    return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
  }

  // ⚠️ DEPRECATED WARNING LOG
  console.warn(
    `[DEPRECATED] /api/generate/run called for project=${projectId}. ` +
    `Migrate to /api/generate/plan + /api/generate/batch for better quality.`
  )

  try {
    await updateJob(jobId, { status: 'running', stage: 0, message: 'RAG検索中... (旧フロー)' })

    // ★ NOTE: topKが少ないのはレガシー実装のため。新フローでは doc:100, site:40, src:100 を使用。
    const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
    const pageQuery = targetPages?.length
      ? `${baseQuery} ${targetPages.map(p => p.title).join(' ')}`
      : baseQuery

    const [docChunks, siteChunks, sourceChunks] = await Promise.all([
      searchChunks(pageQuery, projectId, 12),
      searchChunks(pageQuery, projectId, 8, 'site_analysis'),
      searchChunks(pageQuery, projectId, 6, 'source_code'),
    ])

    const seenIds = new Set<string>()
    const allChunks = [...docChunks, ...siteChunks, ...sourceChunks].filter(c => {
      const key = `${c.docId}-${c.chunkIndex}`
      if (seenIds.has(key)) return false
      seenIds.add(key)
      return true
    })

    await updateJob(jobId, {
      stage: 1,
      message: `プロンプト構築中 (Doc:${docChunks.length} Site:${siteChunks.length} Code:${sourceChunks.length}) [旧フロー]`,
    })

    const { systemPrompt, userPrompt } = buildPrompts(
      project.name, project.targetSystem, allChunks,
      { maxItems, perspectives, targetPages }
    )

    await updateJob(jobId, { stage: 2, message: 'AI生成中... [旧フロー]' })

    const { client, model } = createAIClient()
    const aiStream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 16000,
      stream: true,
    })

    let fullContent = ''
    let charCount = 0
    let lastKvUpdate = 0

    for await (const chunk of aiStream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      if (!delta) continue
      fullContent += delta
      charCount += delta.length
      if (charCount - lastKvUpdate >= 3000) {
        await updateJob(jobId, { stage: 2, message: `AI生成中... (${charCount}文字) [旧フロー]` })
        lastKvUpdate = charCount
      }
    }

    await updateJob(jobId, { stage: 3, message: 'テスト項目を保存中...' })

    const items = parseTestItems(fullContent, projectId)

    if (targetPages && targetPages.length > 0) {
      await saveTestItems(items)
    } else {
      await clearTestItems(projectId)
      await saveTestItems(items)
    }

    await updateProject({
      ...project,
      status: 'generated',
      testItemCount: (targetPages?.length ? project.testItemCount : 0) + items.length,
      updatedAt: new Date().toISOString(),
    })

    await updateJob(jobId, {
      status: 'completed', stage: 4, message: '完了 [旧フロー]',
      count: items.length,
      breakdown: { documents: docChunks.length, siteAnalysis: siteChunks.length, sourceCode: sourceChunks.length },
      model,
    })

    return NextResponse.json({ ok: true, count: items.length, deprecated: true })

  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI生成に失敗しました'
    console.error('generate/run error:', message)
    await updateJob(jobId, { status: 'error', error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
