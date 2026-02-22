import { Index } from '@upstash/vector'

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

export interface VectorMetadata {
  projectId: string
  docId: string
  filename: string
  category: string
  chunkIndex: number
  text: string
  [key: string]: string | number | boolean | null
}

/**
 * テキストをチャンク分割する
 */
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

/**
 * ドキュメントのチャンクをベクトルDBに格納する
 * Upstash Vector は自動でEmbeddingを生成（モデル設定が必要）
 * ※ フリープランではtext embeddingが使えるため、テキストとして格納
 */
export async function upsertChunks(
  projectId: string,
  docId: string,
  filename: string,
  category: string,
  chunks: string[]
): Promise<number> {
  const batchSize = 100
  let total = 0

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const vectors = batch.map((text, j) => ({
      id: `${docId}-chunk-${i + j}`,
      data: text, // Upstash Vector の「data」フィールドで自動Embedding
      metadata: {
        projectId,
        docId,
        filename,
        category,
        chunkIndex: i + j,
        text,
      } as VectorMetadata,
    }))

    await vectorIndex.upsert(vectors)
    total += batch.length
  }

  return total
}

/**
 * プロジェクトに関連するチャンクを検索する
 */
export async function searchChunks(
  query: string,
  projectId: string,
  topK = 15,
  category?: string // 4つ目の引数を追加
): Promise<VectorMetadata[]> {
  // 基本のフィルター条件（projectIdの一致）
  let filterString = `projectId = '${projectId}'`;
  
  // もしcategoryが指定されていれば、フィルター条件に追加する
  if (category) {
    filterString += ` AND category = '${category}'`;
  }

  const results = await vectorIndex.query<VectorMetadata>({
    data: query,
    topK,
    includeMetadata: true,
    filter: filterString, // 動的に作成したフィルターを使用
  })

  return results
    .filter(r => (r.score ?? 0) > 0.5) // scoreがundefinedの場合を考慮して修正
    .map(r => r.metadata!)
    .filter(Boolean)
}

/**
 * ドキュメントのチャンクを削除する
 */
export async function deleteDocumentChunks(docId: string, chunkCount: number): Promise<void> {
  const ids = Array.from({ length: chunkCount }, (_, i) => `${docId}-chunk-${i}`)
  // バッチで削除
  const batchSize = 100
  for (let i = 0; i < ids.length; i += batchSize) {
    await vectorIndex.delete(ids.slice(i, i + batchSize))
  }
}
