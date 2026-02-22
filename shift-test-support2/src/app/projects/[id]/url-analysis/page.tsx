'use client'
import { useState } from 'react'
import { Globe, Play, CheckCircle2, Link2, MousePointerClick, FormInput, ExternalLink, RefreshCw } from 'lucide-react'
import { mockSiteAnalysis } from '@/lib/mock-data'

export default function UrlAnalysisPage({ params }: { params: { id: string } }) {
  const [url, setUrl] = useState('https://demo-order-system.example.com')
  const [depth, setDepth] = useState(3)
  const [maxPages, setMaxPages] = useState(50)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(
    mockSiteAnalysis.projectId === params.id ? mockSiteAnalysis : null
  )

  const startAnalysis = async () => {
    setAnalyzing(true)
    setProgress(0)
    setResult(null)
    for (let i = 0; i <= 100; i += 4) {
      await new Promise(r => setTimeout(r, 80))
      setProgress(i)
    }
    setResult(mockSiteAnalysis)
    setAnalyzing(false)
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">URL構造分析</h1>
        <p className="text-sm text-gray-500 mt-0.5">対象サイトのURL・画面構造・UI要素を自動解析します</p>
      </div>

      {/* Settings card */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">分析設定</h2>
        <div className="space-y-4">
          <div>
            <label className="label">対象URL <span className="text-red-500">*</span></label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="url" className="input pl-9" placeholder="https://example.com"
                value={url} onChange={e => setUrl(e.target.value)} />
            </div>
            <p className="text-xs text-gray-400 mt-1">httpsで始まるURLを入力してください。同一ドメイン内のページを解析します。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">クロール深度</label>
              <select className="input" value={depth} onChange={e => setDepth(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>深度 {v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">最大ページ数</label>
              <select className="input" value={maxPages} onChange={e => setMaxPages(Number(e.target.value))}>
                {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}ページ</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="btn-primary" onClick={startAnalysis} disabled={analyzing || !url}>
            {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {analyzing ? '解析中...' : '解析を開始'}
          </button>
          {result && (
            <button className="btn-secondary" onClick={startAnalysis}>
              <RefreshCw className="w-4 h-4" /> 再解析
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {analyzing && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">サイトを解析中...</span>
            <span className="text-sm font-bold text-shift-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-shift-700 h-2.5 rounded-full progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {progress < 30 ? 'トップページを解析中...'
              : progress < 60 ? 'リンクを辿ってページを収集中...'
                : progress < 90 ? 'UI要素を抽出中...'
                  : 'データを整理中...'}
          </p>
        </div>
      )}

      {/* Results */}
      {result && !analyzing && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="font-semibold text-gray-900">解析完了</h2>
              <span className="text-xs text-gray-400">{result.targetUrl}</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '解析ページ数', value: result.pageCount, icon: Globe },
                { label: 'フォーム総数', value: result.pages.reduce((s, p) => s + p.forms, 0), icon: FormInput },
                { label: 'ボタン総数', value: result.pages.reduce((s, p) => s + p.buttons, 0), icon: MousePointerClick },
                { label: 'リンク総数', value: result.pages.reduce((s, p) => s + p.links, 0), icon: Link2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <Icon className="w-5 h-5 text-shift-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Page list */}
          <div className="card">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">解析済みページ一覧</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">URL</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">タイトル</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">フォーム</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">ボタン</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">リンク</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.pages.map(page => (
                    <tr key={page.url} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-shift-700 font-mono">
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-xs">{page.url}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{page.title}</td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-600">{page.forms}</td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-600">{page.buttons}</td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-600">{page.links}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
