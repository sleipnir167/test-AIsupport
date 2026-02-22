import { getProject, updateProject, saveTestItems, clearTestItems } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPrompts, parseTestItems } from '@/lib/ai'
import OpenAI from 'openai'
import type { PageInfo } from '@/types'

export const maxDuration = 60
// Node.js ランタイム（Upstash SDKのため。Edge非対応）
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
        'X-Title': 'Shift AI Test Support',
      },
    }),
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const {
    projectId,
    maxItems = 100,
    perspectives,
    targetPages = null,
  }: {
    projectId: string
    maxItems: number
    perspectives?: string[]
    targetPages: PageInfo[] | null
  } = body

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectIdは必須です' }), { status: 400 })
  }

  const encoder = new TextEncoder()

  // TransformStream で確実にSSEをフラッシュする
  let controller: ReadableStreamDefaultController<Uint8Array>

  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      // クライアントが切断した場合
    },
  })

  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      )
    } catch {
      // ストリームが閉じている場合は無視
    }
  }

  const close = () => {
    try { controller.close() } catch {}
  }

  // バックグラウンド処理
  ;(async () => {
    try {
      const project = await getProject(projectId)
      if (!project) {
        send('error', { message: 'プロジェクトが見つかりません' })
        close()
        return
      }

      // ── Step 1: RAG検索 ──────────────────────────────
      send('progress', { stage: 0, message: 'RAG検索中...' })

      const baseQuery = `${project.targetSystem} テスト項目 機能 要件 画面 操作 入力 エラー`
      const pageQuery = targetPages?.length
        ? `${baseQuery} ${targetPages.map((p: PageInfo) => p.title).join(' ')}`
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

      // ── Step 2: プロンプト構築 ────────────────────────
      send('progress', {
        stage: 1,
        message: `プロンプト構築中 (Doc:${docChunks.length} Site:${siteChunks.length} Src:${sourceChunks.length})`,
      })

      const { systemPrompt, userPrompt } = buildPrompts(
        project.name,
        project.targetSystem,
        allChunks,
        { maxItems, perspectives, targetPages }
      )

      // ── Step 3: AIストリーミング ──────────────────────
      send('progress', { stage: 2, message: 'AI生成中...' })

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

      for await (const chunk of aiStream) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (!delta) continue
        fullContent += delta
        charCount += delta.length
        // 1000文字ごとに進捗送信（接続を維持する）
        if (charCount % 1000 < delta.length + 2) {
          send('progress', { stage: 2, message: `AI生成中... (${charCount}文字)` })
        }
      }

      // ── Step 4: パース・保存 ──────────────────────────
      send('progress', { stage: 3, message: 'テスト項目を保存中...' })

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

      // ── Step 5: 完了 ──────────────────────────────────
      send('done', {
        count: items.length,
        breakdown: {
          documents: docChunks.length,
          siteAnalysis: siteChunks.length,
          sourceCode: sourceChunks.length,
        },
        model,
      })
    } catch (e) {
      console.error('generate error:', e)
      send('error', { message: e instanceof Error ? e.message : 'AI生成に失敗しました' })
    } finally {
      close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
