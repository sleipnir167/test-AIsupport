import { NextResponse } from 'next/server'
import { getDocument, softDeleteDocument } from '@/lib/db'
import { deleteDocumentChunks } from '@/lib/vector'

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const doc = await getDocument(params.id)
    if (!doc) return NextResponse.json({ error: 'ドキュメントが見つかりません' }, { status: 404 })

    // ベクトルDBからチャンク削除
    if (doc.chunkCount) {
      await deleteDocumentChunks(doc.id, doc.chunkCount)
    }

    // KVのステータスをソフトデリート
    await softDeleteDocument(params.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/documents/[id] error:', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
