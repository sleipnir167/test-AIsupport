/**
 * POST /api/rag-chat
 *
 * RAGの内容についてチャット形式で質問できるAPI
 * - 質問に関連するチャンクをVector DBで検索し、出典情報付きで回答する
 * - 出典チャンクのサマリーも同時に返す
 * - AIやり取りログに記録する
 */
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { getProject, saveAILog, getAdminSettings } from '@/lib/db'
import { searchChunks } from '@/lib/vector'
import { inferResponseFormat } from '@/lib/ai'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function estimateTokens(text: string): number {
  const japanese = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length
  return Math.ceil(japanese + (text.length - japanese) / 4)
}

function createAIClient(modelOverride?: string): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER || 'openrouter'
  if (provider === 'openai') {
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }), model: modelOverride || process.env.OPENAI_MODEL || 'gpt-4o' }
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://shift-test-support.vercel.app', 'X-Title': 'Shift AI Test Support' },
    }),
    model: modelOverride || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
  }
}

export interface RagChatSource {
  refId: string          // REF-1, REF-2 ...
  filename: string
  category: string       // customer_doc / MSOK_knowledge / source_code / site_analysis
  pageUrl: string | null
  excerpt: string        // 原文抜粋（300文字）
  summary: string        // AIが要約した内容（回答後に付与）
  chunkIndex: number
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    const body = await req.json()
    const {
      projectId,
      question,
      modelOverride,
      history = [],   // { role: 'user'|'assistant', content: string }[]
      ragTopK = { doc: 10, site: 5, src: 8 },
    } = body

    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
    if (!question?.trim()) return NextResponse.json({ error: '質問を入力してください' }, { status: 400 })

    const project = await getProject(projectId)
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    // モデル決定（RAGチャット専用モデル → プランニングモデル の優先順）
    let finalModel = modelOverride
    if (!finalModel) {
      try {
        const adminSettings = await getAdminSettings()
        finalModel = (adminSettings as { defaultRagChatModelId?: string; defaultPlanModelId?: string }).defaultRagChatModelId
          || (adminSettings as { defaultPlanModelId?: string }).defaultPlanModelId
      } catch {}
    }
    const { client, model } = createAIClient(finalModel)

    // 管理設定から RAG TopK を取得（リクエスト値が優先）
    let resolvedTopK = ragTopK
    try {
      const adminSettings = await getAdminSettings() as {
        ragChatTopKDoc?: number; ragChatTopKSite?: number; ragChatTopKSrc?: number
      }
      resolvedTopK = {
        doc:  ragTopK.doc  !== 10 ? ragTopK.doc  : (adminSettings.ragChatTopKDoc  ?? 12),
        site: ragTopK.site !== 5  ? ragTopK.site : (adminSettings.ragChatTopKSite ?? 5),
        src:  ragTopK.src  !== 8  ? ragTopK.src  : (adminSettings.ragChatTopKSrc  ?? 10),
      }
    } catch {}

    // RAG検索（質問文でベクトル検索）
    const [docChunks, siteChunks, srcChunks] = await Promise.all([
      searchChunks(question, projectId, resolvedTopK.doc),
      searchChunks(question, projectId, resolvedTopK.site, 'site_analysis'),
      searchChunks(question, projectId, resolvedTopK.src, 'source_code'),
    ])

    const allChunks = [...docChunks, ...siteChunks, ...srcChunks]

    // 出典情報を構築（後でsummaryを付与）
    const sources: Omit<RagChatSource, 'summary'>[] = allChunks.map((c, i) => ({
      refId: `REF-${i + 1}`,
      filename: c.filename,
      category: c.category,
      pageUrl: c.pageUrl ?? null,
      excerpt: c.text.slice(0, 300),
      chunkIndex: c.chunkIndex,
    }))

    // コンテキスト文字列を構築
    const buildCtx = (chunks: typeof allChunks, label: string, maxLen: number, offset: number) => {
      if (!chunks.length) return ''
      return `\n\n## ${label}\n` + chunks
        .map((c, i) => `[REF-${offset + i + 1}: ${c.filename}${c.pageUrl ? ' (' + c.pageUrl + ')' : ''}]\n${c.text}`)
        .join('\n\n')
        .slice(0, maxLen)
    }
    const context = [
      buildCtx(docChunks,  '仕様・要件ドキュメント', 30000, 0),
      buildCtx(siteChunks, 'サイト構造・画面情報',   8000,  docChunks.length),
      buildCtx(srcChunks,  'ソースコード',            20000, docChunks.length + siteChunks.length),
    ].join('')

    // 過去の会話履歴
    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = (history as { role: 'user' | 'assistant'; content: string }[])
      .slice(-10) // 直近10ターンのみ
      .map(h => ({ role: h.role, content: h.content }))

    const systemPrompt = `あなたはソフトウェアテスト・システム開発の専門家AIです。
プロジェクト「${project.name}」（対象システム: ${project.targetSystem}）の
ドキュメント・ソースコード・サイト情報を参照し、ユーザーの質問に正確・簡潔に回答します。

【回答ルール】
1. 提供されたドキュメント情報（RAGコンテキスト）に基づいて回答する
2. 情報がある場合は必ず参照した出典を [REF-N] 形式で本文中に明示する（例: 〜については[REF-1]に記載されています）
3. 複数の出典を参照した場合は [REF-1][REF-3] のように複数記載する
4. RAGコンテキストに情報がない場合は「取り込まれたドキュメントには該当情報がありません」と明記する
5. 推測で回答する場合は「ドキュメントには記載がないため、一般的な知識から回答します」と断る
6. 回答は日本語で、マークダウン形式で整理して出力する
7. テスト計画・要件・設計に関する質問は特に詳しく回答する

RAGコンテキスト（参照可能な情報）:${context || '\n（ドキュメントが登録されていません）'}`

    const userPrompt = question

    // 管理設定から Temperature・MaxTokens を取得
    let ragTemperature = 0.3
    let ragMaxTokens = 4000
    try {
      const adminSettings = await getAdminSettings() as { ragChatTemperature?: number; ragChatMaxTokens?: number }
      ragTemperature = adminSettings.ragChatTemperature ?? 0.3
      ragMaxTokens   = adminSettings.ragChatMaxTokens   ?? 4000
    } catch {}

    // AI呼び出し
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userPrompt },
    ]

    const res = await client.chat.completions.create({ model, messages, max_tokens: 2000, temperature: 0.3 })
    const answer = res.choices?.[0]?.message?.content ?? '回答を生成できませんでした。'

    // 回答中で参照されたREFを抽出
    const referencedRefs = new Set<string>()
    const refPattern = /\[REF-(\d+)\]/g
    let m
    while ((m = refPattern.exec(answer)) !== null) {
      referencedRefs.add(`REF-${m[1]}`)
    }

    // 参照された出典のみサマリーを生成（最大5件）
    const referencedSources = sources.filter(s => referencedRefs.has(s.refId))
    const unreferencedSources = sources.filter(s => !referencedRefs.has(s.refId) && sources.indexOf(s) < 5)
    const sourcesToSummarize = [...referencedSources, ...unreferencedSources].slice(0, 8)

    let sourcesWithSummary: RagChatSource[] = []
    if (sourcesToSummarize.length > 0 && allChunks.length > 0) {
      try {
        const summaryPrompt = `以下の各ドキュメントチャンクを日本語で1〜2文に要約してください。
JSON形式で {"summaries": [{"refId": "REF-N", "summary": "要約文"},...]} のみ出力。

${sourcesToSummarize.map(s => `${s.refId} [${s.filename}]:\n${s.excerpt}`).join('\n\n---\n\n').slice(0, 8000)}`

        const sumFmt = inferResponseFormat(model)
        const summaryRes = await client.chat.completions.create({
          model, messages: [{ role: 'user', content: summaryPrompt }],
          max_tokens: 800, temperature: 0,
          ...(sumFmt !== 'none' ? { response_format: { type: sumFmt } as OpenAI.ResponseFormatJSONObject } : {}),
        })

        const summaryRaw = summaryRes.choices?.[0]?.message?.content ?? '{}'
        const summaryData = JSON.parse(summaryRaw.replace(/```json|```/g, '').trim()) as { summaries: { refId: string; summary: string }[] }
        const summaryMap = new Map((summaryData.summaries ?? []).map((s: { refId: string; summary: string }) => [s.refId, s.summary]))

        sourcesWithSummary = sourcesToSummarize.map(s => ({
          ...s,
          summary: summaryMap.get(s.refId) ?? s.excerpt.slice(0, 100) + '...',
        }))
      } catch {
        sourcesWithSummary = sourcesToSummarize.map(s => ({
          ...s,
          summary: s.excerpt.slice(0, 150) + '...',
        }))
      }
    }

    // AIログ保存
    const sysT = estimateTokens(systemPrompt)
    const userT = estimateTokens(userPrompt)
    const respT = estimateTokens(answer)
    await saveAILog({
      id: uuidv4(),
      projectId,
      projectName: project.name,
      type: 'generation',
      logStage: 'rag_chat',
      modelId: model,
      modelLabel: model,
      createdAt: new Date().toISOString(),
      systemPrompt: systemPrompt.slice(0, 3000),
      userPrompt: `Q: ${question}`,
      responseText: answer.slice(0, 2000),
      outputItemCount: 0,
      aborted: false,
      systemTokensEst: sysT,
      userTokensEst: userT,
      responseTokensEst: respT,
      totalTokensEst: sysT + userT + respT,
      promptTokensActual: res.usage?.prompt_tokens,
      completionTokensActual: res.usage?.completion_tokens,
      totalTokensActual: res.usage?.total_tokens,
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length },
      elapsedMs: Date.now() - startedAt,
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      answer,
      sources: sourcesWithSummary,
      referencedRefIds: Array.from(referencedRefs),
      ragBreakdown: { doc: docChunks.length, site: siteChunks.length, src: srcChunks.length },
      model,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[rag-chat] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
