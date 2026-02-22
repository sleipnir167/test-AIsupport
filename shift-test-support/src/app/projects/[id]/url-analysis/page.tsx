'use client'
import { useState, useEffect } from 'react'
import {
  Globe, Play, CheckCircle2, Link2, MousePointerClick,
  FormInput, ExternalLink, Trash2, AlertTriangle, Loader2
} from 'lucide-react'
import type { SiteAnalysis } from '@/types'

export default function UrlAnalysisPage({ params }: { params: { id: string } }) {
  const [url, setUrl] = useState('')
  const [depth, setDepth] = useState(3)
  const [maxPages, setMaxPages] = useState(50)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SiteAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/site-analysis?projectId=${params.id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setResult(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  const startAnalysis = async () => {
    if (!url) return
    setError('')
    setAnalyzing(true)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress(p => p >= 85 ? p : p + (85 - p) * 0.05 + 0.3)
    }, 400)

    try {
      const res = await fetch('/api/site-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, targetUrl: url, depth, maxPages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'URL分析に失敗しました')
      clearInterval(interval)
      setProgress(100)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'URL分析に失敗しました')
    } finally {
      clearInterval(interval)
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/site-analysis?projectId=${params.id}`, { method: 'DELETE' })
      setResult(null)
      setUrl('')
      setShowDeleteConfirm(false)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  // pages が null/undefined の場合に備えてフォールバック
  const pages = result?.pages ?? []
  const totalForms   = pages.reduce((s, p) => s + (p.forms   ?? 0), 0)
  const totalButtons = pages.reduce((s, p) => s + (p.buttons ?? 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">読み込み中...</span>
    </div>
  )

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">URL構造分析</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          対象サイトのURL・画面構造・UI要素を解析してRAGデータとして活用します
        </p>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">分析結果を削除しますか？</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              URL分析結果（{result?.pageCount}ページ）とRAGデータが完全に削除されます。
              削除後は再度分析を実行する必要があります。
            </p>
            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1 justify-center"
                onClick={() => setShowDeleteConfirm(false)}
              >
                キャンセル
              </button>
              <button
                className="btn-danger flex-1 justify-center"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分析設定（結果がない場合のみ表示） */}
      {!result && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">分析設定</h2>
          <div className="space-y-4">
            <div>
              <label className="label">対象URL <span className="text-red-500">*</span></label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  className="input pl-9"
                  placeholder="https://example.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                ※ Vercel環境ではJSを使わない静的ページのリンク収集のみ対応（SPA・認証不要ページ）
              </p>
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
          {error && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div className="mt-5">
            <button
              className="btn-primary"
              onClick={startAnalysis}
              disabled={analyzing || !url}
            >
              {analyzing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Play className="w-4 h-4" />}
              {analyzing ? '解析中...' : '解析を開始'}
            </button>
          </div>
        </div>
      )}

      {/* プログレス */}
      {analyzing && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">サイトを解析中...</span>
            <span className="text-sm font-bold text-shift-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-shift-700 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {progress < 30 ? 'トップページを取得中...'
              : progress < 60 ? 'リンクを辿ってページを収集中...'
              : progress < 85 ? 'ページ情報を整理中...'
              : 'RAGデータを格納中...'}
          </p>
        </div>
      )}

      {/* 結果 */}
      {result && !analyzing && (
        <div className="space-y-4 animate-slide-up">
          {/* サマリーカード */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <h2 className="font-semibold text-gray-900">解析完了</h2>
                <span className="text-xs text-gray-400 font-mono truncate">{result.targetUrl}</span>
              </div>
              {/* 削除ボタン */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger text-xs py-1.5 ml-3 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                削除して再設定
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                { label: '解析ページ数', value: result.pageCount,    icon: Globe },
                { label: 'フォーム総数', value: totalForms,          icon: FormInput },
                { label: 'ボタン総数',   value: totalButtons,        icon: MousePointerClick },
                { label: 'RAGチャンク',  value: result.chunkCount ?? 0, icon: Link2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <Icon className="w-5 h-5 text-shift-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
              ✅ このデータはRAGとして保存済みです。AIテスト生成時に自動的に活用されます。
            </div>
          </div>

          {/* ページ一覧 */}
          <div className="card">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">解析済みページ一覧</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                AIテスト生成時に「画面単位」で選択できます
              </p>
            </div>

            {pages.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ページ情報が取得できませんでした</p>
                <p className="text-xs mt-1">対象サイトがJSレンダリングのみの場合は取得できません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">URL</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">タイトル</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">フォーム</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">ボタン</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">リンク</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pages.map((page, idx) => (
                      <tr key={page.url ?? idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-shift-700 font-mono">
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-xs">{page.url}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{page.title}</td>
                        <td className="px-3 py-2.5 text-center text-sm text-gray-600">{page.forms ?? 0}</td>
                        <td className="px-3 py-2.5 text-center text-sm text-gray-600">{page.buttons ?? 0}</td>
                        <td className="px-3 py-2.5 text-center text-sm text-gray-600">{page.links ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
