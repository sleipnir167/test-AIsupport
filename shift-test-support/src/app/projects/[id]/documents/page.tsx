'use client'
import { useState, useRef } from 'react'
import {
  Upload, FileText, Trash2, RefreshCw, FileSpreadsheet,
  FileCode2, Archive, CheckCircle2, Clock, AlertCircle, Plus
} from 'lucide-react'
import { mockDocuments, formatFileSize, formatDateTime, categoryColors, categoryLabels, docStatusConfig } from '@/lib/mock-data'
import type { Document, DocumentCategory, DocumentSubCategory } from '@/types'
import { clsx } from 'clsx'

const FileIcon = ({ mimeType }: { mimeType: string }) => {
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  if (mimeType.includes('zip')) return <Archive className="w-5 h-5 text-orange-500" />
  if (mimeType.includes('word')) return <FileText className="w-5 h-5 text-blue-600" />
  return <FileCode2 className="w-5 h-5 text-gray-500" />
}

const StatusIcon = ({ status }: { status: Document['status'] }) => {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === 'processing') return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
  if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />
  return <Clock className="w-4 h-4 text-gray-400" />
}

export default function DocumentsPage({ params }: { params: { id: string } }) {
  const [docs, setDocs] = useState<Document[]>(mockDocuments.filter(d => d.projectId === params.id))
  const [showUpload, setShowUpload] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('customer_doc')
  const [selectedSubCategory, setSelectedSubCategory] = useState<DocumentSubCategory>('要件定義書')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const subCategoryOptions: Record<DocumentCategory, DocumentSubCategory[]> = {
    customer_doc: ['要件定義書', '機能設計書', 'テスト計画書', 'その他'],
    shift_knowledge: ['チェックリスト', 'テスト事例', 'ガイドライン'],
    source_code: ['フロントエンド', 'バックエンド', 'インフラ'],
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  const addFiles = (files: File[]) => {
    const newDocs: Document[] = files.map((f, i) => ({
      id: `doc-new-${Date.now()}-${i}`,
      projectId: params.id,
      filename: f.name,
      category: selectedCategory,
      subCategory: selectedSubCategory,
      fileSize: f.size,
      mimeType: f.type || 'application/octet-stream',
      status: 'processing',
      chunkCount: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
    }))
    setDocs(prev => [...prev, ...newDocs])
    setShowUpload(false)
    // Simulate processing complete
    setTimeout(() => {
      setDocs(prev => prev.map(d =>
        newDocs.find(n => n.id === d.id)
          ? { ...d, status: 'completed', chunkCount: Math.floor(Math.random() * 200) + 50 }
          : d
      ))
    }, 2500)
  }

  const removeDoc = (id: string) => setDocs(prev => prev.filter(d => d.id !== id))

  const groupedDocs = {
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
          <Plus className="w-4 h-4" />
          ファイルを追加
        </button>
      </div>

      {/* Upload area */}
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
            className={clsx(
              'border-2 border-dashed rounded-xl p-10 text-center transition-all duration-150 cursor-pointer',
              dragging ? 'border-shift-500 bg-shift-50' : 'border-gray-300 hover:border-shift-400 hover:bg-gray-50'
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={clsx('w-10 h-10 mx-auto mb-3', dragging ? 'text-shift-500' : 'text-gray-300')} />
            <p className="text-sm font-medium text-gray-700">ファイルをドロップ または クリックして選択</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, ZIP（最大200MB）</p>
            <input ref={fileInputRef} type="file" multiple className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.md,.txt,.zip"
              onChange={e => e.target.files && addFiles(Array.from(e.target.files))} />
          </div>

          <div className="flex gap-3 mt-4">
            <button className="btn-secondary" onClick={() => setShowUpload(false)}>キャンセル</button>
          </div>
        </div>
      )}

      {/* Documents by category */}
      {(['customer_doc', 'shift_knowledge', 'source_code'] as DocumentCategory[]).map(cat => (
        <div key={cat} className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={clsx('badge', categoryColors[cat])}>{categoryLabels[cat]}</span>
              <span className="text-xs text-gray-400">{groupedDocs[cat].length}件</span>
            </div>
          </div>

          {groupedDocs[cat].length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ファイルがありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {groupedDocs[cat].map(doc => (
                <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 group">
                  <div className="flex-shrink-0">
                    <FileIcon mimeType={doc.mimeType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
                      <span className="text-xs text-gray-400">{doc.subCategory}</span>
                      {doc.chunkCount && <span className="text-xs text-gray-400">チャンク数: {doc.chunkCount}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={doc.status} />
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', docStatusConfig[doc.status].color)}>
                        {docStatusConfig[doc.status].label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 hidden sm:block">{formatDateTime(doc.createdAt)}</span>
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
