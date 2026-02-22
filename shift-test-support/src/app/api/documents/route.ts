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
    console.log('[UPLOAD] start')
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string
    const category = formData.get('category') as string
    const subCategory = formData.get('subCategory') as string

    console.log('[UPLOAD] file:', file?.name, 'size:', file?.size)
    console.log('[UPLOAD] projectId:', projectId)

    if (!file || !projectId) {
      return NextResponse.json({ error: 'ファイルとprojectIdは必須です' }, { status: 400 })
    }

    const docId = uuidv4()
    const now = new Date().toISOString()

    // 1. Vercel Blob にアップロード
    console.log('[UPLOAD] uploading to blob...')
    const buffer = Buffer.from(await file.arrayBuffer())
    const blob = await put(`projects/${projectId}/docs/${docId}/${file.name}`, buffer, {
      access: 'public',
      contentType: file.type,
    })
    console.log('[UPLOAD] blob uploaded:', blob.url)

    // 2. KVにドキュメントメタデータを保存（status: processing）
    console.log('[UPLOAD] saving document metadata...')
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
    console.log('[UPLOAD] metadata saved')

    // 3. バックグラウンドでテキスト抽出 → ベクトルDB格納
    //    Vercel では waitUntil が使えるが、ここでは同期処理（小ファイル想定）
    try {
      console.log('[RAG] extracting text...')
      const text = await extractText(buffer, file.type, file.name)
      console.log('[RAG] text length:', text?.length)
      console.log('[RAG] chunking...')
      const chunks = chunkText(text)
      console.log('[RAG] chunk count:', chunks.length)
      console.log('[RAG] upserting vectors...')
      const chunkCount = await upsertChunks(projectId, docId, file.name, category, chunks)

	  console.log('[RAG] upsert done. stored:', chunkCount)
      await updateDocument({ id: docId, status: 'completed', chunkCount })
      console.log('[RAG] document status updated to completed')

      // プロジェクトのドキュメント数を更新
      const project = await getProject(projectId)
      if (project) {
        const docs = await getDocuments(projectId)
        await updateProject({ ...project, documentCount: docs.length, updatedAt: now })
        console.log('[RAG] project documentCount updated:', docs.length)
      }
    } catch (ragErr) {
      console.error('RAG ingest error:', ragErr)
      await updateDocument({
        id: docId,
        status: 'error',
        errorMessage: ragErr instanceof Error ? ragErr.message : 'RAG処理エラー',
      })
    }

	console.log('[UPLOAD] finished successfully')
    // 最新のdocを返す
    const updatedDoc = await getDocuments(projectId).then(docs => docs.find(d => d.id === docId))
    return NextResponse.json(updatedDoc || doc, { status: 201 })
  } catch (e) {
    console.error('POST /api/documents error:', e)
    return NextResponse.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 })
  }
}
