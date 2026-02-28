'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShieldCheck, BarChart2, AlertTriangle, Lightbulb, Upload, Loader2,
  RefreshCw, FileSpreadsheet, ChevronDown, ChevronUp, Info, X,
  CheckCircle2, XCircle, AlertCircle, GitCompare, Star, TrendingUp,
  Map, BookOpen, Layers
} from 'lucide-react'
import { clsx } from 'clsx'
import type { ReviewResult, ExcelCompareResult, DesignMeta, CoverageScore, TestItem } from '@/types'

// ─── レビューモデル選択肢 ─────────────────────────────────────
const REVIEW_MODELS = [
  { id: 'google/gemini-2.5-flash',         label: 'Gemini 2.5 Flash', note: '高精度・推奨' },
  { id: 'google/gemini-3-flash-preview',   label: 'Gemini 3 Flash Preview', note: '最新' },
  { id: 'openai/gpt-5-nano',               label: 'GPT-5 Nano', note: 'OpenAI系' },
  { id: 'anthropic/claude-sonnet-4.6',     label: 'Claude Sonnet 4.6', note: '高品質分析' },
  { id: 'deepseek/deepseek-v3.2',          label: 'DeepSeek V3.2', note: '低コスト' },
  { id: 'deepseek/deepseek-r1-0528:free',  label: 'DeepSeek R1 (無料)', note: '無料枠' },
]

// ─── スコアカラー ─────────────────────────────────────────────
function scoreColor(v: number) {
  if (v >= 0.8) return 'text-green-600'
  if (v >= 0.6) return 'text-blue-600'
  if (v >= 0.4) return 'text-yellow-600'
  return 'text-red-600'
}
function scoreBg(v: number) {
  if (v >= 0.8) return 'bg-green-500'
  if (v >= 0.6) return 'bg-blue-500'
  if (v >= 0.4) return 'bg-yellow-400'
  return 'bg-red-500'
}
function riskBg(level: string) {
  switch (level) {
    case 'critical': return 'bg-red-600'
    case 'high':     return 'bg-orange-500'
    case 'medium':   return 'bg-yellow-400'
    default:         return 'bg-green-400'
  }
}
function riskLabel(level: string) {
  switch (level) {
    case 'critical': return '致命的'
    case 'high':     return '高'
    case 'medium':   return '中'
    default:         return '低'
  }
}
function severityIcon(s: string) {
  if (s === 'critical') return <XCircle className="w-4 h-4 text-red-500" />
  if (s === 'high')     return <AlertCircle className="w-4 h-4 text-orange-500" />
  return                       <AlertTriangle className="w-4 h-4 text-yellow-500" />
}

// ─── スコアゲージ ─────────────────────────────────────────────
function ScoreGauge({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none"
            stroke={value >= 0.8 ? '#16a34a' : value >= 0.6 ? '#2563eb' : value >= 0.4 ? '#ca8a04' : '#dc2626'}
            strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" />
        </svg>
        <span className={clsx('absolute text-lg font-bold', scoreColor(value))}>{pct}</span>
      </div>
      <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
      {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
    </div>
  )
}

// ─── 欠陥リスクヒートマップ ────────────────────────────────────
function HeatmapView({ cells }: { cells: ReviewResult['heatmap'] }) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  if (!cells.length) return <p className="text-sm text-gray-400 text-center py-4">データなし</p>
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="font-medium">リスクレベル：</span>
        {[
          { label: '致命的', cls: 'bg-red-600' },
          { label: '高',     cls: 'bg-orange-500' },
          { label: '中',     cls: 'bg-yellow-400' },
          { label: '低',     cls: 'bg-green-400' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={clsx('w-3 h-3 rounded-sm', cls)} />{label}
          </span>
        ))}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {cells.map((cell, i) => (
          <div key={i}
            className="relative group cursor-default"
            onMouseEnter={() => setTooltip(cell.reason)}
            onMouseLeave={() => setTooltip(null)}>
            <div className={clsx('rounded-xl p-3 text-white text-center', riskBg(cell.riskLevel))}>
              <p className="text-xs font-semibold truncate">{cell.category}</p>
              <p className="text-2xl font-bold mt-1">{Math.round(cell.score * 100)}</p>
              <p className="text-xs opacity-80">{riskLabel(cell.riskLevel)}</p>
            </div>
            {tooltip === cell.reason && (
              <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-xl pointer-events-none">
                {cell.reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── カバレッジスコア詳細 ─────────────────────────────────────
function CoveragePanel({ score }: { score: CoverageScore }) {
  const items = [
    { key: 'iso25010', label: 'ISO/IEC 25010', sublabel: '品質特性', weight: '×0.3', value: score.iso25010 },
    { key: 'iso29119', label: 'ISO/IEC/IEEE 29119', sublabel: 'テスト設計標準', weight: '×0.3', value: score.iso29119 },
    { key: 'owasp',    label: 'OWASP ASVS', sublabel: 'セキュリティ', weight: '×0.2', value: score.owasp },
    { key: 'istqb',    label: 'ISTQB',       sublabel: 'テスト技法', weight: '×0.2', value: score.istqb },
  ]
  return (
    <div className="space-y-3">
      {items.map(({ key, label, sublabel, weight, value }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-sm font-medium text-gray-800">{label}</span>
              <span className="text-xs text-gray-400 ml-1">{sublabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{weight}</span>
              <span className={clsx('text-sm font-bold', scoreColor(value))}>{Math.round(value * 100)}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={clsx('h-2 rounded-full transition-all duration-700', scoreBg(value))}
              style={{ width: `${value * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">複合スコア</span>
          <span className={clsx('text-2xl font-black', scoreColor(score.composite))}>
            {Math.round(score.composite * 100)}
            <span className="text-sm font-normal text-gray-400">/100</span>
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          0.3×ISO25010 + 0.3×ISO29119 + 0.2×OWASP + 0.2×ISTQB
        </p>
      </div>
    </div>
  )
}

// ─── 設計メタ表示 ─────────────────────────────────────────────
function DesignMetaPanel({ meta }: { meta: DesignMeta }) {
  const industryColor: Record<string, string> = {
    '金融': 'bg-blue-100 text-blue-800',
    '医療': 'bg-green-100 text-green-800',
    'EC':   'bg-orange-100 text-orange-800',
    'SaaS': 'bg-purple-100 text-purple-800',
    '製造': 'bg-gray-100 text-gray-800',
    '公共': 'bg-teal-100 text-teal-800',
  }
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-xs text-gray-400 mb-1">対象業界</p>
        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', industryColor[meta.industry] ?? 'bg-gray-100 text-gray-700')}>
          {meta.industry}
        </span>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">使用モデル</p>
        <p className="font-medium text-gray-800 truncate">{meta.modelLabel}</p>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-gray-400 mb-1">システム特性</p>
        <div className="flex flex-wrap gap-1">
          {meta.systemCharacteristics.map(c => (
            <span key={c} className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs">{c}</span>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-gray-400 mb-1">設計アプローチ</p>
        <div className="flex flex-wrap gap-1">
          {meta.designApproaches.map(a => (
            <span key={a} className="px-2 py-0.5 bg-shift-50 text-shift-700 border border-shift-200 rounded-full text-xs">{a}</span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">生成件数</p>
        <p className="font-medium">{meta.maxItems}件</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">生成日時</p>
        <p className="font-medium text-xs">{new Date(meta.generatedAt).toLocaleString('ja-JP')}</p>
      </div>
    </div>
  )
}

// ─── 複数Excel比較結果 ────────────────────────────────────────
function CompareResultView({ result }: { result: ExcelCompareResult }) {
  return (
    <div className="space-y-6">
      {/* 一致率 */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <GitCompare className="w-5 h-5 text-shift-700" />
          <h3 className="font-bold text-gray-900">ファイル間一致率</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.9" fill="none"
                stroke={result.matchRate >= 0.7 ? '#16a34a' : result.matchRate >= 0.5 ? '#2563eb' : '#dc2626'}
                strokeWidth="3.5"
                strokeDasharray={`${Math.round(result.matchRate * 100)} 100`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={clsx('text-3xl font-black', scoreColor(result.matchRate))}>
                {Math.round(result.matchRate * 100)}
              </span>
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed">{result.differenceAnalysis}</p>
          </div>
        </div>
      </div>

      {/* 個別スコア */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-shift-700" />ファイル別スコア
        </h3>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${result.files.length}, 1fr)` }}>
          {result.files.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-600 mb-1 truncate" title={f.filename}>
                📄 {f.filename}
              </p>
              <p className="text-xs text-gray-400 mb-3">{f.itemCount}件</p>
              <CoveragePanel score={f.coverageScore} />
            </div>
          ))}
        </div>
      </div>

      {/* 差分詳細 */}
      {result.differenceDetails.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-shift-700" />差分詳細（意味論的分析）
          </h3>
          <div className="space-y-3">
            {result.differenceDetails.map((d, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">📍 {d.area}</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  {result.files.map((f, fi) => (
                    <div key={fi} className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-500 font-medium mb-1 truncate">{f.filename}</p>
                      <p className="text-xs text-gray-700">{fi === 0 ? d.fileA : d.fileB}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  💡 {d.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 推奨 */}
      {result.recommendation && (
        <div className="card p-5 bg-shift-50 border border-shift-200">
          <h3 className="font-bold text-shift-800 mb-2 flex items-center gap-2">
            <Star className="w-4 h-4" />統合推奨
          </h3>
          <p className="text-sm text-shift-700 leading-relaxed">{result.recommendation}</p>
        </div>
      )}
    </div>
  )
}

// ─── メインページ ─────────────────────────────────────────────
type TabType = 'review' | 'compare'

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<TabType>('review')
  const [reviewModelId, setReviewModelId] = useState(REVIEW_MODELS[0].id)
  const [reviewModelLabel, setReviewModelLabel] = useState(REVIEW_MODELS[0].label)
  const [reviewSource, setReviewSource] = useState<'generated' | 'excel'>('generated')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [compareFiles, setCompareFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [compareResult, setCompareResult] = useState<ExcelCompareResult | null>(null)
  const [designMeta, setDesignMeta] = useState<DesignMeta | null>(null)
  const [generatedItems, setGeneratedItems] = useState<TestItem[]>([])
  const [showMeta, setShowMeta] = useState(true)

  // 生成済み項目と設計メタを取得
  useEffect(() => {
    fetch(`/api/test-items?projectId=${params.id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setGeneratedItems(data.filter((t: TestItem) => !t.isDeleted))
      }).catch(console.error)

    const saved = localStorage.getItem(`designMeta_${params.id}`)
    if (saved) {
      try { setDesignMeta(JSON.parse(saved)) } catch {}
    }
  }, [params.id])

  const handleReview = async () => {
    setLoading(true)
    setError('')
    setReviewResult(null)
    try {
      const fd = new FormData()
      fd.append('action', reviewSource === 'generated' ? 'review_generated' : 'review_excel')
      fd.append('reviewModelId', reviewModelId)
      fd.append('reviewModelLabel', reviewModelLabel)
      fd.append('projectId', params.id)
      if (designMeta) fd.append('designMeta', JSON.stringify(designMeta))

      if (reviewSource === 'generated') {
        fd.append('items', JSON.stringify(generatedItems))
      } else {
        if (!excelFile) { setError('Excelファイルを選択してください'); setLoading(false); return }
        fd.append('file', excelFile)
      }

      const res = await fetch('/api/review', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error)
      setReviewResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleCompare = async () => {
    if (compareFiles.length < 2) { setError('2ファイル以上選択してください'); return }
    setLoading(true)
    setError('')
    setCompareResult(null)
    try {
      const fd = new FormData()
      fd.append('action', 'compare_excel')
      fd.append('reviewModelId', reviewModelId)
      fd.append('reviewModelLabel', reviewModelLabel)
      if (designMeta) fd.append('designMeta', JSON.stringify(designMeta))
      compareFiles.forEach((f, i) => fd.append(`file_${i}`, f))

      const res = await fetch('/api/review', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error)
      setCompareResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const selectModel = (id: string) => {
    setReviewModelId(id)
    setReviewModelLabel(REVIEW_MODELS.find(m => m.id === id)?.label ?? id)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIレビュー・品質評価</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          別LLMがテスト設計を第三者評価。ISO/IEC・OWASP・ISTQBの複合スコアで妥当性を定量化します。
        </p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'review' as const, label: 'レビュー', icon: ShieldCheck },
          { id: 'compare' as const, label: 'Excelファイル比較', icon: GitCompare },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === id
              ? 'bg-white text-shift-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* 設計メタ表示 */}
      {designMeta && (
        <div className="card overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            onClick={() => setShowMeta(!showMeta)}>
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-shift-600" />
              <span className="font-semibold text-gray-900 text-sm">テスト設計メタ情報</span>
              <span className="text-xs text-gray-400">（AI生成時の条件）</span>
            </div>
            {showMeta ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showMeta && (
            <div className="border-t border-gray-100 p-4">
              <DesignMetaPanel meta={designMeta} />
            </div>
          )}
        </div>
      )}
      {!designMeta && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          設計メタ情報が見つかりません。「AIテスト生成」ページで業界・特性・アプローチを設定して生成すると詳細評価が可能になります。
        </div>
      )}

      {/* レビューモデル選択（共通） */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-shift-700" />レビューに使用するAIモデル
          <span className="text-xs font-normal text-gray-400">（生成に使ったモデルとは別のモデルを推奨）</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {REVIEW_MODELS.map(m => (
            <button key={m.id} onClick={() => selectModel(m.id)}
              className={clsx('p-3 rounded-xl border-2 text-left transition-all', reviewModelId === m.id
                ? 'border-shift-700 bg-shift-50'
                : 'border-gray-200 hover:border-gray-300')}>
              <p className={clsx('text-xs font-semibold', reviewModelId === m.id ? 'text-shift-800' : 'text-gray-700')}>
                {m.label}
              </p>
              <p className="text-xs text-gray-400">{m.note}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── レビュータブ ─── */}
      {tab === 'review' && (
        <>
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">レビュー対象</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { v: 'generated' as const, label: '生成済みテスト項目', desc: `DBに保存された${generatedItems.length}件を評価` },
                { v: 'excel' as const,     label: 'Excelファイルを取込', desc: 'エクスポートしたExcelをアップロード' },
              ].map(({ v, label, desc }) => (
                <button key={v} onClick={() => setReviewSource(v)}
                  className={clsx('p-4 rounded-xl border-2 text-left transition-all', reviewSource === v
                    ? 'border-shift-700 bg-shift-50'
                    : 'border-gray-200 hover:border-gray-300')}>
                  <p className={clsx('text-sm font-semibold', reviewSource === v ? 'text-shift-800' : 'text-gray-700')}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            {reviewSource === 'excel' && (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-shift-400 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-600">
                  {excelFile ? <span className="text-shift-700 font-medium">✓ {excelFile.name}</span> : 'Excelファイルを選択'}
                </p>
                <p className="text-xs text-gray-400 mt-1">.xlsx形式</p>
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => setExcelFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <button onClick={handleReview} disabled={loading}
            className={clsx('w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all',
              loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-shift-800 hover:bg-shift-700 text-white shadow-sm')}>
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" />AIレビュー実行中...</>
              : <><ShieldCheck className="w-5 h-5" />AIレビューを実行</>}
          </button>

          {/* レビュー結果 */}
          {reviewResult && (
            <div className="space-y-5">
              {/* 複合スコア サマリ */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <h2 className="font-bold text-gray-900">総合評価スコア</h2>
                  <span className="text-xs text-gray-400">{reviewResult.reviewModelLabel}による評価</span>
                </div>
                <div className="flex items-center gap-8 flex-wrap">
                  <ScoreGauge value={reviewResult.coverageScore.composite} label="複合スコア" sublabel="総合" />
                  <ScoreGauge value={reviewResult.coverageScore.iso25010} label="ISO 25010" sublabel="品質特性" />
                  <ScoreGauge value={reviewResult.coverageScore.iso29119} label="ISO 29119" sublabel="テスト標準" />
                  <ScoreGauge value={reviewResult.coverageScore.owasp} label="OWASP ASVS" sublabel="セキュリティ" />
                  <ScoreGauge value={reviewResult.coverageScore.istqb} label="ISTQB" sublabel="テスト技法" />
                </div>
              </div>

              {/* スコア詳細バー */}
              <div className="card p-5">
                <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-shift-700" />基準別スコア詳細
                </h2>
                <CoveragePanel score={reviewResult.coverageScore} />
              </div>

              {/* 欠陥リスクヒートマップ */}
              <div className="card p-5">
                <h2 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Map className="w-4 h-4 text-red-500" />欠陥リスクヒートマップ
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  第三者視点による欠陥予測マップ。スコアが高いほど欠陥混入リスクが高いカテゴリです。
                </p>
                <HeatmapView cells={reviewResult.heatmap} />
              </div>

              {/* 欠陥混入リスク分析 */}
              <div className="card p-5">
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />欠陥混入リスク分析
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed bg-orange-50 border border-orange-200 rounded-xl p-4">
                  {reviewResult.defectRiskAnalysis}
                </p>
              </div>

              {/* 不足カバレッジ警告 */}
              {reviewResult.coverageMissingAreas.length > 0 && (
                <div className="card p-5">
                  <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    外部基準・システム特性に基づく不足領域の警告
                  </h2>
                  <div className="space-y-3">
                    {reviewResult.coverageMissingAreas.map((area, i) => (
                      <div key={i} className={clsx('rounded-xl p-4 border', area.severity === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : area.severity === 'high'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-yellow-50 border-yellow-200')}>
                        <div className="flex items-center gap-2 mb-2">
                          {severityIcon(area.severity)}
                          <span className="font-semibold text-gray-900 text-sm">{area.area}</span>
                          <span className="text-xs text-gray-400 ml-auto">{area.relatedStandard}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{area.description}</p>
                        {area.suggestedTests.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">📝 追加すべきテスト：</p>
                            <ul className="space-y-0.5">
                              {area.suggestedTests.map((t, j) => (
                                <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                  <span className="text-gray-400 mt-0.5">•</span>{t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 観点漏れ */}
              {reviewResult.missingPerspectives.length > 0 && (
                <div className="card p-5">
                  <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-shift-700" />観点漏れ指摘
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {reviewResult.missingPerspectives.map((p, i) => (
                      <span key={i} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-sm">
                        ⚠️ {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 改善提案 */}
              {reviewResult.improvementSuggestions.length > 0 && (
                <div className="card p-5">
                  <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />改善提案
                  </h2>
                  <div className="space-y-2">
                    {reviewResult.improvementSuggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <span className="w-6 h-6 bg-yellow-400 text-white rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-700">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Excel比較タブ ─── */}
      {tab === 'compare' && (
        <>
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-shift-700" />比較するExcelファイルを選択
            </p>
            <p className="text-xs text-gray-400 mb-4">
              2つ以上のExcelファイルをアップロードし、テスト設計の意味論的差異をAIが分析します
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-shift-400 transition-colors mb-3">
              <Upload className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-600">Excelファイルを選択（複数可）</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx形式・2ファイル以上</p>
              <input type="file" accept=".xlsx,.xls" multiple className="hidden"
                onChange={e => setCompareFiles(Array.from(e.target.files ?? []))} />
            </label>
            {compareFiles.length > 0 && (
              <div className="space-y-1">
                {compareFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <button onClick={() => setCompareFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <button onClick={handleCompare} disabled={loading || compareFiles.length < 2}
            className={clsx('w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all',
              loading || compareFiles.length < 2
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-shift-800 hover:bg-shift-700 text-white shadow-sm')}>
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" />AI比較分析中...</>
              : <><GitCompare className="w-5 h-5" />{compareFiles.length}ファイルをAI比較分析</>}
          </button>

          {compareResult && <CompareResultView result={compareResult} />}
        </>
      )}
    </div>
  )
}
