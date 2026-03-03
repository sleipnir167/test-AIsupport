/**
 * lib/vector.ts
 *
 * Upstash Vector を使った RAG チャンク管理。
 *
 * ③ ハイブリッド検索 (Dense + Sparse / BM25)
 *   環境変数 USE_HYBRID_SEARCH=true をセットすると、
 *   Dense（意味検索）と Sparse（BM25 キーワード検索）を RRF で融合した
 *   ハイブリッド検索を使用します。
 *   固有名詞・数値・製品名などキーワード一致が重要なクエリで特に効果的です。
 *
 *   ⚠️ Upstash Vector インデックスがハイブリッドモード（HYBRID タイプ）で
 *      作成されている必要があります。Dense-only インデックスでは
 *      sparseVector パラメータは無視されます。
 *
 * 環境変数:
 *   UPSTASH_VECTOR_REST_URL   — Upstash Vector REST URL
 *   UPSTASH_VECTOR_REST_TOKEN — Upstash Vector REST Token
 *   USE_HYBRID_SEARCH         — "true" でハイブリッド検索を有効化（デフォルト: false）
 */

import { Index } from '@upstash/vector'

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

export interface VectorMetadata {
  projectId: string
  docId: string
  filename: string
  category: string   // customer_doc / MSOK_knowledge / source_code / site_analysis
  chunkIndex: number
  text: string
  pageUrl: string | null //  site_analysis 時のページURL
  [key: string]: string | number | boolean | null
}

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
    if (start >= text.length) break
  }
  return chunks.filter(c => c.trim().length > 50)
}

export async function upsertChunks(
  projectId: string,
  docId: string,
  filename: string,
  category: string,
  chunks: string[],
  extraMeta: Record<string, string> = {}
): Promise<number> {
  const batchSize = 100
  let total = 0
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const vectors = batch.map((text, j) => ({
      id: `${docId}-chunk-${i + j}`,
      data: text,
      metadata: {
        projectId, docId, filename, category,
        chunkIndex: i + j,
        text,
        ...extraMeta,
      } as VectorMetadata,
    }))
    await vectorIndex.upsert(vectors)
    total += batch.length
  }
  return total
}

// ─── ③ ハイブリッド検索 ────────────────────────────────────────

/**
 * Dense + Sparse (BM25) のハイブリッド検索を実行する。
 * Upstash Vector の fusionAlgorithm: "RRF" を使って両スコアを統合する。
 *
 * ⚠️ インデックスが HYBRID タイプである必要がある。
 *    Dense-only インデックスの場合は通常の Dense 検索にフォールバックする。
 */
async function hybridSearchChunks(
  query: string,
  projectId: string,
  topK: number,
  categoryFilter?: string
): Promise<VectorMetadata[]> {
  const filter = categoryFilter
    ? `projectId = '${projectId}' AND category = '${categoryFilter}'`
    : `projectId = '${projectId}'`

  const scoreThreshold = categoryFilter === 'source_code' ? 0.2 : 0.4

  try {
    // Upstash Vector ハイブリッド検索:
    //   data       → Dense embedding を自動生成
    //   sparseData → Sparse (BM25) ベクトルを自動生成（HYBRID インデックス必須）
    //   fusionAlgorithm: "RRF" → Reciprocal Rank Fusion で統合
    const results = await vectorIndex.query<VectorMetadata>({
      data: query,
      sparseData: query,   // HYBRID インデックスで BM25 ベクトルを自動生成
      fusionAlgorithm: 'RRF',
      topK,
      includeMetadata: true,
      filter,
    } as Parameters<typeof vectorIndex.query>[0])

    return results
      .filter(r => r.score > scoreThreshold)
      .map(r => r.metadata!)
      .filter(Boolean)
  } catch (e) {
    // ハイブリッド非対応インデックスの場合はフォールバック
    console.warn('[vector] hybrid search failed, falling back to dense:', (e as Error).message)
    return denseSearchChunks(query, projectId, topK, categoryFilter)
  }
}

/**
 * 従来の Dense（コサイン類似度）検索。
 */
async function denseSearchChunks(
  query: string,
  projectId: string,
  topK: number,
  categoryFilter?: string
): Promise<VectorMetadata[]> {
  const filter = categoryFilter
    ? `projectId = '${projectId}' AND category = '${categoryFilter}'`
    : `projectId = '${projectId}'`

  const scoreThreshold = categoryFilter === 'source_code' ? 0.2 : 0.4

  const results = await vectorIndex.query<VectorMetadata>({
    data: query,
    topK,
    includeMetadata: true,
    filter,
  })

  return results
    .filter(r => r.score > scoreThreshold)
    .map(r => r.metadata!)
    .filter(Boolean)
}

/**
 * チャンク検索のエントリーポイント。
 * USE_HYBRID_SEARCH=true の場合はハイブリッド検索、それ以外は Dense 検索を使用。
 */
export async function searchChunks(
  query: string,
  projectId: string,
  topK = 20,
  categoryFilter?: string
): Promise<VectorMetadata[]> {
  const useHybrid = process.env.USE_HYBRID_SEARCH === 'true'
  if (useHybrid) {
    return hybridSearchChunks(query, projectId, topK, categoryFilter)
  }
  return denseSearchChunks(query, projectId, topK, categoryFilter)
}

export async function deleteDocumentChunks(docId: string, chunkCount: number): Promise<void> {
  const ids = Array.from({ length: chunkCount }, (_, i) => `${docId}-chunk-${i}`)
  const batchSize = 100
  for (let i = 0; i < ids.length; i += batchSize) {
    await vectorIndex.delete(ids.slice(i, i + batchSize))
  }
}
