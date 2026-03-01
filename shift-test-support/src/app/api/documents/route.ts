export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { v4 as uuidv4 } from 'uuid'
import { getDocuments, saveDocument, updateDocument, getProject, updateProject } from '@/lib/db'
import { extractText } from '@/lib/extract-text'
import { chunkText, upsertChunks } from '@/lib/vector'
import type { Document } from '@/types'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    const docs = await getDocuments(projectId)
    return NextResponse.json(docs)
  } catch (e) {
    console.error('GET /api/documents error:', e)
    return NextResponse.json({ error: 'ドキュメント一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string
    const category = formData.get('category') as string
    const subCategory = formData.get('subCategory') as string

    if (!file || !projectId) {
      return NextResponse.json({ error: 'ファイルとprojectIdは必須です' }, { status: 400 })
    }

    const docId = uuidv4()
    const now = new Date().toISOString()

    // 1. Vercel Blob にアップロード
    const buffer = Buffer.from(await file.arrayBuffer())
    const blob = await put(`projects/${projectId}/docs/${docId}/${file.name}`, buffer, {
      access: 'public',
      contentType: file.type,
    })

    // 2. KVにドキュメントメタデータを保存（status: processing）
    const doc: Document = {
      id: docId,
      projectId,
      filename: file.name,
      category: category as Document['category'],
      subCategory: subCategory as Document['subCategory'],
      fileSize: file.size,
      mimeType: file.type,
      blobUrl: blob.url,
      status: 'processing',
      chunkCount: null,
      errorMessage: null,
      isDeleted: false,
      createdAt: now,
    }
    await saveDocument(doc)

    // 3. バックグラウンドでテキスト抽出 → ベクトルDB格納
    //    Vercel では waitUntil が使えるが、ここでは同期処理（小ファイル想定）
    try {
      const text = await extractText(buffer, file.type, file.name)
      const chunks = chunkText(text)
      const chunkCount = await upsertChunks(projectId, docId, file.name, category, chunks)

      await updateDocument({ id: docId, status: 'completed', chunkCount })

      // プロジェクトのドキュメント数を更新
      const project = await getProject(projectId)
      if (project) {
        const docs = await getDocuments(projectId)
        await updateProject({ ...project, documentCount: docs.length, updatedAt: now })
      }
    } catch (ragErr) {
      console.error('RAG ingest error:', ragErr)
      await updateDocument({
        id: docId,
        status: 'error',
        errorMessage: ragErr instanceof Error ? ragErr.message : 'RAG処理エラー',
      })
    }

    // 最新のdocを返す
    const updatedDoc = await getDocuments(projectId).then(docs => docs.find(d => d.id === docId))
    return NextResponse.json(updatedDoc || doc, { status: 201 })
  } catch (e) {
    console.error('POST /api/documents error:', e)
    return NextResponse.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 })
  }
}
