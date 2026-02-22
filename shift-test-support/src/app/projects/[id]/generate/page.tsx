'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Play, CheckCircle2, AlertCircle, Settings,
  ChevronDown, ChevronUp, Loader2, Globe, FileText, Code2,
  LayoutGrid, List
} from 'lucide-react'
import type { SiteAnalysis, PageInfo } from '@/types'

const STAGES = [
  { label: 'RAG検索中（関連ドキュメント・サイト構造・ソースコードを取得）', pct: 15 },
  { label: 'プロンプト構築中', pct: 25 },
  { label: 'AI生成中（テスト項目を作成しています）', pct: 90 },
  { label: 'データを保存中', pct: 98 },
  { label: '完了', pct: 100 },
]

const PERSPECTIVE_KEYS = [
  { key: 'functional', label: '機能テスト', value: '機能テスト' },
  { key: 'normal',     label: '正常系',     value: '正常系' },
  { key: 'error',      label: '異常系',     value: '異常系' },
  { key: 'boundary',   label: '境界値',     value: '境界値' },
  { key: 'security',   label: 'セキュリティ', value: 'セキュリティ' },
  { key: 'usability',  label: '操作性',     value: '操作性' },
  { key: 'performance',label: '性能',       value: '性能' },
]

export default function GeneratePage({ params }: { params: { id: string } }) {
  const router = useRouter()

  // データ
  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysis | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [ragBreakdown, setRagBreakdown] = useState<{ documents: number; siteAnalysis: number; sourceCode: number } | null>(null)

  // 生成設定
  const [maxItems, setMaxItems] = useState(300)
  const [selectedPerspectives, setSelectedPerspectives] = useState<Set<string>>(
    new Set(['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性'])
  )
  const [targetMode, setTargetMode] = useState<'all' | 'pages'>('all')
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set())
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 生成状態
  const [generating, setGenerating] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [resultCount, setResultCount] = useState(0)

  useEffect(() => {
    fetch(`/api/site-analysis?projectId=${params.id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setSiteAnalysis(data) })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }, [params.id])

  const togglePerspective = (value: string) => {
    setSelectedPerspectives(prev => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  const togglePage = (url: string) => {
    setSelectedPages(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const getTargetPages = (): PageInfo[] | null => {
    if (targetMode === 'all' || !siteAnalysis) return null
    return siteAnalysis.pages.filter(p => selectedPages.has(p.url))
  }

  const generate = async () => {
    const targetPages = getTargetPages()
    if (targetMode === 'pages' && (!targetPages || targetPages.length === 0)) {
      setError('画面単位モードでは1ページ以上を選択してください')
      return
    }

    setGenerating(true)
    setProgress(0)
    setStageIdx(0)
    setDone(false)
    setError('')
    setRagBreakdown(null)

    // アニメーション用インターバル
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + (88 - p) * 0.04 + 0.2, 88))
    }, 400)

    // ステージ表示を時間で進める
    const stageTimers = [
      setTimeout(() => setStageIdx(1), 2000),
      setTimeout(() => setStageIdx(2), 4000),
    ]

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          maxItems,
          perspectives: Array.from(selectedPerspectives),
          targetPages,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI生成に失敗しました')

      clearInterval(interval)
      stageTimers.forEach(t => clearTimeout(t))
      setStageIdx(3)
      setProgress(98)
      await new Promise(r => setTimeout(r, 400))
      setStageIdx(4)
      setProgress(100)
      setResultCount(data.count)
      setRagBreakdown(data.breakdown)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI生成に失敗しました')
    } finally {
      clearInterval(interval)
      stageTimers.forEach(t => clearTimeout(t))
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIテスト項目生成</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          アップロードされた資料・URL分析・ソースコードをRAGで活用してテスト項目を生成します
        </p>
      </div>

      {/* RAGデータ状況 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RAGデータ利用状況</p>
        <div className="space-y-2">
          {[
            { icon: FileText, label: 'ドキュメント（要件定義書・設計書・ナレッジ）', available: true, note: 'ドキュメント管理で確認' },
            { icon: Globe,    label: 'URL構造分析',  available: !!siteAnalysis, note: siteAnalysis ? `${siteAnalysis.pageCount}ページ取込済` : '未実施（任意）' },
            { icon: Code2,    label: 'ソースコード',  available: false, note: 'ソースコード取込で確認' },
          ].map(({ icon: Icon, label, available, note }) => (
            <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Icon className={`w-4 h-4 flex-shrink-0 ${available ? 'text-green-600' : 'text-gray-300'}`} />
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {note}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 生成対象：画面選択 */}
      {siteAnalysis && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">生成対象</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setTargetMode('all')}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                targetMode === 'all'
                  ? 'border-shift-700 bg-shift-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <List className={`w-4 h-4 ${targetMode === 'all' ? 'text-shift-700' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${targetMode === 'all' ? 'text-shift-800' : 'text-gray-700'}`}>
                  全体を対象
                </p>
                <p className="text-xs text-gray-400">すべての資料・画面を対象に生成</p>
              </div>
            </button>
            <button
              onClick={() => setTargetMode('pages')}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                targetMode === 'pages'
                  ? 'border-shift-700 bg-shift-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${targetMode === 'pages' ? 'text-shift-700' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${targetMode === 'pages' ? 'text-shift-800' : 'text-gray-700'}`}>
                  画面単位で指定
                </p>
                <p className="text-xs text-gray-400">特定の画面に絞って生成・追記</p>
              </div>
            </button>
          </div>

          {targetMode === 'pages' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">
                  画面を選択（{selectedPages.size}件選択中）
                </span>
                <div className="flex gap-2">
                  <button className="text-xs text-shift-700 hover:underline"
                    onClick={() => setSelectedPages(new Set(siteAnalysis.pages.map(p => p.url)))}>
                    全選択
                  </button>
                  <button className="text-xs text-gray-500 hover:underline"
                    onClick={() => setSelectedPages(new Set())}>
                    全解除
                  </button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                {siteAnalysis.pages.map(page => (
                  <label key={page.url} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPages.has(page.url)}
                      onChange={() => togglePage(page.url)}
                      className="w-4 h-4 accent-shift-700 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{page.title}</p>
                      <p className="text-xs text-gray-400 font-mono truncate">{page.url}</p>
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      フォーム:{page.forms} ボタン:{page.buttons}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          {targetMode === 'pages' && (
            <p className="text-xs text-amber-600 mt-2">
              ※ 画面単位モードは既存のテスト項目に追記されます（既存を削除しません）
            </p>
          )}
        </div>
      )}

      {/* 詳細設定 */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900 text-sm">生成パラメータ</span>
          </div>
          {showAdvanced
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
            {/* 最大件数 */}
            <div>
              <label className="label">最大生成件数</label>
              <div className="flex gap-2 flex-wrap">
                {[100, 200, 300, 500, 1000, 2000].map(v => (
                  <button
                    key={v}
                    onClick={() => setMaxItems(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      maxItems === v
                        ? 'bg-shift-800 text-white border-shift-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-shift-400'
                    }`}
                  >
                    {v.toLocaleString()}件
                  </button>
                ))}
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={maxItems}
                  onChange={e => setMaxItems(Number(e.target.value))}
                  className="input py-1.5 w-28 text-sm"
                  placeholder="カスタム"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                ※ モデルの出力制限により実際の件数は前後します。大量生成時はOpenAI GPT-4o推奨。
              </p>
            </div>

            {/* テスト観点 */}
            <div>
              <label className="label">テスト観点（複数選択）</label>
              <div className="flex flex-wrap gap-2">
                {PERSPECTIVE_KEYS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => togglePerspective(value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedPerspectives.has(value)
                        ? 'bg-shift-100 text-shift-800 border-shift-400'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 生成ボタン */}
      {!generating && !done && (
        <button
          className="btn-primary w-full justify-center py-4 text-base"
          onClick={generate}
        >
          <Sparkles className="w-5 h-5" />
          {targetMode === 'pages' && selectedPages.size > 0
            ? `選択した${selectedPages.size}画面のテスト項目を生成（追記）`
            : 'AIテスト項目を生成する'}
        </button>
      )}

      {/* プログレス */}
      {generating && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-shift-600 animate-spin" />
              <span className="font-semibold text-gray-900 text-sm">AI生成中...</span>
            </div>
            <span className="text-lg font-bold text-shift-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-shift-700 to-shift-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-2">
            {STAGES.map((stage, i) => (
              <div key={stage.label} className={`flex items-center gap-2 text-xs transition-all ${
                i === stageIdx ? 'text-shift-700 font-semibold'
                : i < stageIdx ? 'text-green-600'
                : 'text-gray-400'
              }`}>
                {i < stageIdx
                  ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  : i === stageIdx
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-shift-600 border-t-transparent animate-spin flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                {stage.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">生成に失敗しました</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <button className="btn-secondary mt-3 text-xs py-1.5" onClick={() => setError('')}>
              再試行
            </button>
          </div>
        </div>
      )}

      {/* 完了 */}
      {done && (
        <div className="card p-6 text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">生成完了！</h3>
          <p className="text-sm text-gray-600 mb-3">{resultCount}件のテスト項目を生成しました</p>
          {ragBreakdown && (
            <div className="flex justify-center gap-4 text-xs text-gray-500 mb-5">
              <span>📄 ドキュメント: {ragBreakdown.documents}チャンク</span>
              <span>🌐 サイト構造: {ragBreakdown.siteAnalysis}チャンク</span>
              <span>💻 ソースコード: {ragBreakdown.sourceCode}チャンク</span>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => { setDone(false); setProgress(0) }}>
              再生成する
            </button>
            <button className="btn-primary" onClick={() => router.push(`/projects/${params.id}/test-items`)}>
              テスト項目書を確認
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
