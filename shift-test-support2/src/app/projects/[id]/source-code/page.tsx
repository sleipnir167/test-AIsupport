'use client'
import { useState, useRef } from 'react'
import { Code2, Upload, FileCode2, CheckCircle2, Cpu, GitBranch, Hash } from 'lucide-react'

interface ParsedResult {
  fileCount: number
  lineCount: number
  functions: number
  classes: number
  apiRoutes: number
  chunkCount: number
  languages: { name: string; files: number; percent: number }[]
}

export default function SourceCodePage({ params }: { params: { id: string } }) {
  const [uploaded, setUploaded] = useState(false)
  const [filename, setFilename] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ParsedResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setFilename(file.name)
    setUploaded(true)
    setAnalyzing(true)
    setProgress(0)
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 60))
      setProgress(i)
    }
    setResult({
      fileCount: 127,
      lineCount: 18432,
      functions: 342,
      classes: 48,
      apiRoutes: 23,
      chunkCount: 445,
      languages: [
        { name: 'TypeScript', files: 89, percent: 70 },
        { name: 'JavaScript', files: 23, percent: 18 },
        { name: 'CSS/SCSS', files: 15, percent: 12 },
      ],
    })
    setAnalyzing(false)
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ソースコード取込</h1>
        <p className="text-sm text-gray-500 mt-0.5">ソースコードを解析してテスト精度を向上させます（任意）</p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-2">対応形式</h2>
        <div className="flex flex-wrap gap-2 mb-5">
          {['JavaScript', 'TypeScript', 'Python', 'Java', 'PHP', 'Ruby'].map(lang => (
            <span key={lang} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-mono">{lang}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400">ZIPファイルまたは個別ファイルでアップロードできます。最大200MB（ZIP）/ 10MB（個別）</p>
      </div>

      {!uploaded && (
        <div
          className={`card p-10 text-center border-2 border-dashed transition-all cursor-pointer ${dragging ? 'border-shift-500 bg-shift-50' : 'border-gray-300 hover:border-shift-400 hover:bg-gray-50'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 bg-shift-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Code2 className="w-8 h-8 text-shift-700" />
          </div>
          <p className="text-base font-semibold text-gray-800 mb-1">ソースコードをアップロード</p>
          <p className="text-sm text-gray-500">ZIPファイルまたは個別コードファイルをドロップ</p>
          <input ref={fileInputRef} type="file" className="hidden" accept=".zip,.js,.ts,.py,.java,.php,.rb"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {analyzing && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <Cpu className="w-5 h-5 text-shift-600 animate-pulse" />
            <span className="text-sm font-medium text-gray-700">ソースコードを解析中: {filename}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div className="bg-shift-700 h-2.5 rounded-full progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400">
            {progress < 30 ? 'ファイルを展開中...'
              : progress < 60 ? '関数・クラスを解析中...'
                : progress < 90 ? 'APIルートを検出中...'
                  : 'ベクトル化してRAGに格納中...'}
          </p>
        </div>
      )}

      {result && !analyzing && (
        <div className="space-y-4 animate-slide-up">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="font-semibold text-gray-900">解析完了: {filename}</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'ファイル数', value: result.fileCount, icon: FileCode2 },
                { label: '総行数', value: result.lineCount.toLocaleString(), icon: Hash },
                { label: '関数数', value: result.functions, icon: GitBranch },
                { label: 'クラス数', value: result.classes, icon: Code2 },
                { label: 'APIルート', value: result.apiRoutes, icon: Upload },
                { label: 'チャンク数', value: result.chunkCount, icon: Cpu },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <Icon className="w-4 h-4 text-shift-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">言語構成</p>
              {result.languages.map(lang => (
                <div key={lang.name} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-mono">{lang.name}</span>
                    <span className="text-gray-400">{lang.files}ファイル ({lang.percent}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-shift-600 h-1.5 rounded-full" style={{ width: `${lang.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="btn-secondary" onClick={() => { setUploaded(false); setResult(null); setFilename('') }}>
            別のファイルをアップロード
          </button>
        </div>
      )}
    </div>
  )
}
