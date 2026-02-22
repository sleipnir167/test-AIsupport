'use client'
import { useState, useEffect, useRef } from 'react'
import { Code2, Upload, CheckCircle2, Cpu, GitBranch, Hash, FileCode2, Loader2, Trash2 } from 'lucide-react'
import type { Document } from '@/types'

export default function SourceCodePage({ params }: { params: { id: string } }) {
  const [sourceDocs, setSourceDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [dragging, setDragging] = useState(false)
  const [selectedSubCategory, setSelectedSubCategory] = useState('フロントエンド')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = async () => {
    try {
      const res = await fetch(`/api/documents?projectId=${params.id}`)
      const data = await res.json()
      setSourceDocs((Array.isArray(data) ? data : []).filter((d: Document) => d.category === 'source_code'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [params.id])

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadProgress('ファイルをアップロード中...')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', params.id)
    formData.append('category', 'source_code')
    formData.append('subCategory', selectedSubCategory)

    try {
      setUploadProgress('RAG処理中（コードを解析してベクトル化しています）...')
      const res = await fetch('/api/documents', { method: 'POST', body: formData })
      const doc = await res.json()
      setSourceDocs(prev => [doc, ...prev])
      setUploadProgress('')
    } catch (e) {
      console.error('Upload error:', e)
      setUploadProgress('エラーが発生しました')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(''), 3000)
    }
  }

  const removeDoc = async (id: string) => {
    if (!confirm('このソースコードを削除しますか？RAGデータも削除されます。')) return
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      setSourceDocs(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ソースコード取込</h1>
        <p className="text-sm text-gray-500 mt-0.5">ソースコードを解析してRAGデータ化し、テスト精度を向上させます</p>
      </div>

      <div className="card p-4 bg-shift-50 border border-shift-200">
        <div className="flex items-start gap-2 text-xs text-shift-700">
          <Code2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">ソースコードRAGの活用</p>
            <p>APIルート・バリデーションロジック・コンポーネント構造を解析し、AIがより正確なテスト項目（異常系・境界値・セキュリティ）を生成できるようになります。</p>
          </div>
        </div>
      </div>

      {/* 取込済みリスト */}
      {sourceDocs.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">取込済みソースコード</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {sourceDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 group">
                <FileCode2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{doc.subCategory}</span>
                    <span>{formatSize(doc.fileSize)}</span>
                    {doc.chunkCount && <span>チャンク: {doc.chunkCount}</span>}
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                      doc.status === 'completed' ? 'bg-green-100 text-green-700'
                      : doc.status === 'processing' ? 'bg-blue-100 text-blue-600'
                      : 'bg-red-100 text-red-600'
                    }`}>{doc.status === 'completed' ? 'RAG完了' : doc.status === 'processing' ? '処理中' : 'エラー'}</span>
                  </div>
                </div>
                {doc.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {doc.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                <button onClick={() => removeDoc(doc.id)}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 bg-green-50 border-t border-green-100">
            <p className="text-xs text-green-700">✅ ソースコードRAGデータが保存済みです。AIテスト生成時に自動的に活用されます。</p>
          </div>
        </div>
      )}

      {/* アップロードUI */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">ソースコードを追加</h3>
        <div className="mb-4">
          <label className="label">種別</label>
          <select className="input" value={selectedSubCategory} onChange={e => setSelectedSubCategory(e.target.value)}>
            <option>フロントエンド</option>
            <option>バックエンド</option>
            <option>インフラ</option>
          </select>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">対応形式</p>
          <div className="flex flex-wrap gap-2">
            {['JavaScript', 'TypeScript', 'Python', 'Java', 'PHP', 'Ruby', 'Go', 'Rust', 'C#'].map(lang => (
              <span key={lang} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-mono">{lang}</span>
            ))}
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
            ${dragging ? 'border-shift-500 bg-shift-50' : 'border-gray-300 hover:border-shift-400 hover:bg-gray-50'}
            ${uploading ? 'pointer-events-none' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Cpu className="w-10 h-10 text-shift-600 animate-pulse" />
              <p className="text-sm font-medium text-shift-700">{uploadProgress}</p>
              <p className="text-xs text-gray-400">コードの解析・ベクトル化には数十秒かかる場合があります</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-shift-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Code2 className="w-7 h-7 text-shift-700" />
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">ZIPまたはコードファイルをアップロード</p>
              <p className="text-xs text-gray-400">最大200MB（ZIP）/ 10MB（個別ファイル）</p>
            </>
          )}
          <input ref={fileInputRef} type="file" className="hidden"
            accept=".zip,.js,.ts,.jsx,.tsx,.py,.java,.php,.rb,.go,.rs,.cs,.swift,.kt"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      </div>
    </div>
  )
}
