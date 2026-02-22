'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Trash2, RefreshCw, FileSpreadsheet,
  FileCode2, Archive, CheckCircle2, Clock, AlertCircle, Plus, Loader2
} from 'lucide-react'
import { formatFileSize, formatDateTime, categoryColors, categoryLabels, docStatusConfig } from '@/lib/mock-data'
import type { Document, DocumentCategory, DocumentSubCategory } from '@/types'
import { clsx } from 'clsx'

const FileIcon = ({ mimeType }: { mimeType: string }) => {
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  if (mimeType.includes('zip')) return <Archive className="w-5 h-5 text-orange-500" />
  if (mimeType.includes('word')) return <FileText className="w-5 h-5 text-blue-600" />
  return <FileCode2 className="w-5 h-5 text-gray-500" />
}

export default function DocumentsPage({ params }: { params: { id: string } }) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('customer_doc')
  const [selectedSubCategory, setSelectedSubCategory] = useState<DocumentSubCategory>('要件定義書')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const subCategoryOptions: Record<DocumentCategory, DocumentSubCategory[]> = {
    customer_doc: ['要件定義書', '機能設計書', 'テスト計画書', 'その他'],
    shift_knowledge: ['チェックリスト', 'テスト事例', 'ガイドライン'],
    source_code: ['フロントエンド', 'バックエンド', 'インフラ'],
  }

  const fetchDocs = async () => {
    try {
      const res = await fetch(`/api/documents?projectId=${params.id}`)
      const data = await res.json()
      setDocs(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [params.id])

  const handleFiles = async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', params.id)
      formData.append('category', selectedCategory)
      formData.append('subCategory', selectedSubCategory)
      try {
        const res = await fetch('/api/documents', { method: 'POST', body: formData })
        const doc = await res.json()
        setDocs(prev => [doc, ...prev])
      } catch (e) {
        console.error('Upload error:', e)
      }
    }
    setUploading(false)
    setShowUpload(false)
    // ステータスが processing の場合は数秒後に再取得
    setTimeout(() => fetchDocs(), 4000)
  }

  const removeDoc = async (id: string) => {
    if (!confirm('このドキュメントを削除しますか？')) return
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const grouped = {
    customer_doc: docs.filter(d => d.category === 'customer_doc'),
    shift_knowledge: docs.filter(d => d.category === 'shift_knowledge'),
    source_code: docs.filter(d => d.category === 'source_code'),
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ドキュメント管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">資料をアップロードしてRAGデータを構築します</p>
        </div>
        <button className="btn-primary" onClick={() => setShowUpload(true)}>
          <Plus className="w-4 h-4" />ファイルを追加
        </button>
      </div>

      {showUpload && (
        <div className="card p-6 animate-slide-up">
          <h3 className="font-semibold text-gray-900 mb-4">ファイルアップロード</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">カテゴリ</label>
              <select className="input" value={selectedCategory}
                onChange={e => {
                  const cat = e.target.value as DocumentCategory
                  setSelectedCategory(cat)
                  setSelectedSubCategory(subCategoryOptions[cat][0])
                }}>
                <option value="customer_doc">顧客資料</option>
                <option value="shift_knowledge">Shiftナレッジ</option>
                <option value="source_code">ソースコード</option>
              </select>
            </div>
            <div>
              <label className="label">サブカテゴリ</label>
              <select className="input" value={selectedSubCategory}
                onChange={e => setSelectedSubCategory(e.target.value as DocumentSubCategory)}>
                {subCategoryOptions[selectedCategory].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div
            className={clsx('border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer',
              dragging ? 'border-shift-500 bg-shift-50' : 'border-gray-300 hover:border-shift-400 hover:bg-gray-50')}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(Array.from(e.dataTransfer.files)) }}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-shift-600 animate-spin" />
                <p className="text-sm text-gray-600">アップロード・RAG処理中...</p>
              </div>
            ) : (
              <>
                <Upload className={clsx('w-10 h-10 mx-auto mb-3', dragging ? 'text-shift-500' : 'text-gray-300')} />
                <p className="text-sm font-medium text-gray-700">ファイルをドロップ または クリックして選択</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word(.docx), Excel(.xlsx), Markdown, ZIP（最大50MB）</p>
              </>
            )}
            <input ref={fileInputRef} type="file" multiple className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.md,.txt,.zip"
              onChange={e => e.target.files && handleFiles(Array.from(e.target.files))} />
          </div>
          <button className="btn-secondary mt-4" onClick={() => setShowUpload(false)}>キャンセル</button>
        </div>
      )}

      {loading ? (
        <div className="card py-16 flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">読み込み中...</span>
        </div>
      ) : (
        (['customer_doc', 'shift_knowledge', 'source_code'] as DocumentCategory[]).map(cat => (
          <div key={cat} className="card">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <span className={clsx('badge', categoryColors[cat])}>{categoryLabels[cat]}</span>
              <span className="text-xs text-gray-400">{grouped[cat].length}件</span>
            </div>
            {grouped[cat].length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ファイルがありません</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {grouped[cat].map(doc => (
                  <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 group">
                    <FileIcon mimeType={doc.mimeType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
                        <span className="text-xs text-gray-400">{doc.subCategory}</span>
                        {doc.chunkCount && <span className="text-xs text-gray-400">チャンク: {doc.chunkCount}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        {doc.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {doc.status === 'processing' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                        {doc.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        {doc.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', docStatusConfig[doc.status].color)}>
                          {docStatusConfig[doc.status].label}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 hidden sm:block">{formatDateTime(doc.createdAt)}</span>
                      <button onClick={() => removeDoc(doc.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
