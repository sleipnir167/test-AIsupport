import { getProject, updateProject, saveTestItems, clearTestItems } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { buildPrompts, parseTestItems } from '@/lib/ai'
import OpenAI from 'openai'
import type { PageInfo } from '@/types'

export const maxDuration = 60

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

  const project = await getProject(projectId)
  if (!project) {
    return new Response(JSON.stringify({ error: 'プロジェクトが見つかりません' }), { status: 404 })
  }

  // SSE ストリームを返す
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // Step 1: RAG検索
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

        send('progress', {
          stage: 1,
          message: `プロンプト構築中... (RAG: ドキュメント${docChunks.length}・サイト${siteChunks.length}・コード${sourceChunks.length}チャンク)`,
        })

        // Step 2: プロンプト構築
        const { systemPrompt, userPrompt } = buildPrompts(
          project.name,
          project.targetSystem,
          allChunks,
          { maxItems, perspectives, targetPages }
        )

        send('progress', { stage: 2, message: 'AI生成中（ストリーミング）...' })

        // Step 3: AIストリーミング呼び出し
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

        // ストリームを受け取りながら進捗を送信
        let fullContent = ''
        let tokenCount = 0
        for await (const chunk of aiStream) {
          const delta = chunk.choices[0]?.delta?.content || ''
          fullContent += delta
          tokenCount += delta.length
          // 500文字ごとに進捗通知（フロントのプログレスバーを動かすため）
          if (tokenCount % 500 < delta.length) {
            send('progress', { stage: 2, message: `AI生成中... (${tokenCount}文字生成済)` })
          }
        }

        // Step 4: パースして保存
        send('progress', { stage: 3, message: 'テスト項目を解析・保存中...' })

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

        // Step 5: 完了
        send('done', {
          count: items.length,
          breakdown: {
            documents: docChunks.length,
            siteAnalysis: siteChunks.length,
            sourceCode: sourceChunks.length,
          },
          provider: process.env.AI_PROVIDER || 'openrouter',
          model,
        })
      } catch (e) {
        console.error('generate stream error:', e)
        send('error', { message: e instanceof Error ? e.message : 'AI生成に失敗しました' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
