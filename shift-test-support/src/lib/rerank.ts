/**
 * lib/rerank.ts
 *
 * ④ Reranking — Cohere Rerank v3 によるチャンク再スコアリング
 *
 * 環境変数:
 *   COHERE_API_KEY      — セットされている場合のみ rerank が有効になる
 *   RERANK_TOP_N        — rerank 後に残す件数（デフォルト: 20）
 *
 * 使い方:
 *   const reranked = await rerankChunks(query, chunks, { topN: 20 })
 *
 * COHERE_API_KEY が未設定の場合は chunks をそのまま返すため、
 * 呼び出し側で条件分岐する必要はありません。
 */

import type { VectorMetadata } from './vector'

export interface RerankOptions {
  /** 返す最大件数（デフォルト: 20） */
  topN?: number
}

interface CohereRerankResult {
  results: Array<{
    index: number
    relevance_score: number
  }>
}

/**
 * Cohere Rerank v3 でチャンクを再スコアリングして上位 topN 件を返す。
 * COHERE_API_KEY が未設定の場合は入力をそのまま返す（ノーオペレーション）。
 */
export async function rerankChunks(
  query: string,
  chunks: VectorMetadata[],
  options: RerankOptions = {}
): Promise<VectorMetadata[]> {
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey || chunks.length === 0) {
    // 未設定 or チャンクなし → パススルー
    return chunks
  }

  const topN = options.topN ?? Number(process.env.RERANK_TOP_N ?? '20')

  // Cohere は 1 リクエストあたり最大 1000 ドキュメント
  const docs = chunks.map(c => c.text.slice(0, 512))

  try {
    const res = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: docs,
        top_n: Math.min(topN, chunks.length),
        return_documents: false,
      }),
    })

    if (!res.ok) {
      console.warn(`[rerank] Cohere API error ${res.status}: ${await res.text()}`)
      return chunks // エラー時はパススルー
    }

    const json: CohereRerankResult = await res.json()

    // スコア順に並んだインデックスで元のチャンクを並べ替えて返す
    return json.results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map(r => chunks[r.index])
      .filter(Boolean)
  } catch (e) {
    console.warn('[rerank] unexpected error, falling back to original order:', e)
    return chunks
  }
}
