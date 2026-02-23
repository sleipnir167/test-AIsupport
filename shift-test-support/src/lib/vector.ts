import { Index } from '@upstash/vector'

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

export interface VectorMetadata {
  projectId: string
  docId: string
  filename: string
  category: string   // customer_doc / shift_knowledge / source_code / site_analysis
  chunkIndex: number
  text: string
  pageUrl?: string   // site_analysis 時のページURL
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

export async function searchChunks(
  query: string,
  projectId: string,
  topK = 20,
  categoryFilter?: string
): Promise<VectorMetadata[]> {
  const filter = categoryFilter
    ? `projectId = '${projectId}' AND category = '${categoryFilter}'`
    : `projectId = '${projectId}'`

  // source_code は多様なコードが含まれるため閾値を低めに設定
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

export async function deleteDocumentChunks(docId: string, chunkCount: number): Promise<void> {
  const ids = Array.from({ length: chunkCount }, (_, i) => `${docId}-chunk-${i}`)
  const batchSize = 100
  for (let i = 0; i < ids.length; i += batchSize) {
    await vectorIndex.delete(ids.slice(i, i + batchSize))
  }
}
