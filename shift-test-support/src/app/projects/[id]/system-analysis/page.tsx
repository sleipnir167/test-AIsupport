'use client'
import { useState, useEffect } from 'react'
import {
  BarChart2, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Cpu, Shield, Zap, Globe, Code2, FileText, Database,
  TrendingUp, AlertTriangle, CheckCircle2, Info,
  ClipboardList, Play, RotateCcw, Lightbulb, Settings
} from 'lucide-react'
import type { CustomModelEntry } from '@/types'
import { TEST_PHASE_DESCRIPTIONS, TEST_PHASE_PERSPECTIVES } from '@/types'
import type { TestPhase } from '@/types'

// ─── 型定義 ──────────────────────────────────────────────────────────────────
interface SystemSummary {
  overview: string
  architecture: string
  language: string
  scale: string
  realtimeRequirement: 'high' | 'medium' | 'low'
  securityLevel: 'high' | 'medium' | 'low'
  scalability: 'high' | 'medium' | 'low'
  complexityScore: number
  riskLevel: 'high' | 'medium' | 'low'
}

interface PolicyCategory {
  name: string
  priority: 'high' | 'medium' | 'low'
  allocation: number
  reason: string
}

interface PolicyPerspective {
  name: string
  priority: 'high' | 'medium' | 'low'
  description: string
}

interface TestPolicy {
  testPhase: string
  phaseDescription: string
  focusAreas: string[]
  categories: PolicyCategory[]
  perspectives: PolicyPerspective[]
}

interface QuantItem {
  metric: string
  recommendedCases: number
  basis: string
}

interface QuantitativeAnalysis {
  frontend: QuantItem
  backendApi: QuantItem
  database: QuantItem
  integration: QuantItem
  totalRecommendedCases: number
  estimatedEffortDays: number
  effortBasis: string
}

interface RiskItem {
  area: string
  level: 'high' | 'medium' | 'low'
  description: string
  recommendation: string
}

interface AnalysisResult {
  systemSummary: SystemSummary
  testPolicy: TestPolicy
  quantitativeAnalysis: QuantitativeAnalysis
  riskAnalysis: RiskItem[]
  keyInsights: string[]
}

// ─── 定数 ────────────────────────────────────────────────────────────────────
const TEST_PHASES: TestPhase[] = [
  '単体テスト', '結合テスト', 'システムテスト', '受入テスト',
  '回帰テスト', 'パフォーマンステスト', 'セキュリティテスト',
]

const MODEL_OPTIONS: CustomModelEntry[] = [
  { id: 'deepseek/deepseek-v3.2',             label: 'DeepSeek V3.2',         inputCost: '$0.20', outputCost: '$0.35',  feature: '最安クラス。出力量が多いならこれ一択',    speed: '高速' },
  { id: 'google/gemini-2.5-flash',            label: 'Gemini 2.5 Flash',       inputCost: '$0.15', outputCost: '$0.60',  feature: '最新Gemini。高精度かつ爆速',             speed: '爆速' },
  { id: 'google/gemini-3-flash-preview',      label: 'Gemini 3 Flash Preview', inputCost: '$0.10', outputCost: '$0.40',  feature: 'Gemini最新プレビュー。爆速で大量生成',   speed: '爆速' },
  { id: 'openai/gpt-5-nano',                  label: 'GPT-5 Nano',             inputCost: '$0.05', outputCost: '$0.20',  feature: '最も安価なGPT。軽量タスクに最適',        speed: '爆速' },
  { id: 'openai/gpt-5.2',                     label: 'GPT-5.2',                inputCost: '$1.75', outputCost: '$14.00', feature: '非常に高精度。複雑なロジックの網羅に強い', speed: '標準' },
  { id: 'anthropic/claude-sonnet-4.6',        label: 'Claude Sonnet 4.6',      inputCost: '$3.00', outputCost: '$15.00', feature: 'Anthropic最新。論理的な分析に最強',       speed: '標準' },
  { id: 'meta-llama/llama-3.3-70b-instruct',  label: 'Llama 3.3 70B',          inputCost: '$0.12', outputCost: '$0.30',  feature: 'Meta製OSS。コスパ良好',                  speed: '高速' },
  { id: 'deepseek/deepseek-r1-0528:free',     label: 'DeepSeek R1 (free)',      inputCost: '無料',  outputCost: '無料',   feature: 'OpenRouterの無料枠。お試しに最適',        speed: '高速', isFree: true },
]

const SPEED_COLOR: Record<string, string> = {
  '爆速': 'text-green-600 bg-green-50',
  '高速': 'text-blue-600 bg-blue-50',
  '標準': 'text-gray-600 bg-gray-100',
}

const LEVEL_COLOR = {
  high:   { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    label: '高' },
  medium: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  label: '中' },
  low:    { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200',  label: '低' },
}

// ─── サブコンポーネント ───────────────────────────────────────────────────────
function LevelBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const c = LEVEL_COLOR[level]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  )
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100))
  const color = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-8 text-right">{score}/{max}</span>
    </div>
  )
}

function AllocationBar({ categories }: { categories: PolicyCategory[] }) {
  const total = categories.reduce((s, c) => s + c.allocation, 0) || 100
  const colors = ['bg-shift-700', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500']
  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-lg overflow-hidden gap-px">
        {categories.map((cat, i) => (
          <div
            key={i}
            className={`${colors[i % colors.length]} transition-all duration-700`}
            style={{ width: `${(cat.allocation / total) * 100}%` }}
            title={`${cat.name}: ${cat.allocation}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${colors[i % colors.length]}`} />
            <span className="text-xs text-gray-600">{cat.name} {cat.allocation}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelSelector({
  selectedId, customModel, useCustom, onSelect, onCustomChange, onUseCustom, models,
}: {
  selectedId: string; customModel: string; useCustom: boolean
  onSelect: (id: string) => void; onCustomChange: (v: string) => void; onUseCustom: () => void
  models: CustomModelEntry[]
}) {
  return (
    <div className="card">
      <div className="p-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">分析用AIモデル</p>
        <p className="text-xs text-gray-400 mt-0.5">OpenRouter経由で呼び出します（OPENROUTER_API_KEY）</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="w-8 px-3 py-2"></th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">モデル名</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">入力/1M</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">出力/1M</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">特徴</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">速度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {models.map(m => (
              <tr key={m.id} onClick={() => onSelect(m.id)}
                className={`cursor-pointer transition-colors ${!useCustom && selectedId === m.id ? 'bg-shift-50 border-l-2 border-l-shift-700' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
                <td className="px-3 py-2.5 text-center">
                  <input type="radio" checked={!useCustom && selectedId === m.id} onChange={() => onSelect(m.id)} className="accent-shift-700" />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-400 font-mono">{m.id}</div>
                </td>
                <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree ? 'text-green-600 font-bold' : 'text-gray-600'}`}>{m.inputCost}</td>
                <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree ? 'text-green-600 font-bold' : 'text-gray-600'}`}>{m.outputCost}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 max-w-xs">{m.feature}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SPEED_COLOR[m.speed]}`}>
                    {m.speed === '爆速' && '⚡ '}{m.speed}
                  </span>
                </td>
              </tr>
            ))}
            <tr onClick={onUseCustom}
              className={`cursor-pointer transition-colors ${useCustom ? 'bg-shift-50 border-l-2 border-l-shift-700' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
              <td className="px-3 py-2.5 text-center">
                <input type="radio" checked={useCustom} onChange={onUseCustom} className="accent-shift-700" />
              </td>
              <td className="px-3 py-2.5" colSpan={5}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">任意のモデルを指定</span>
                  <input type="text" placeholder="例: meta-llama/llama-3.1-70b-instruct" value={customModel}
                    onChange={e => { onCustomChange(e.target.value); onUseCustom() }}
                    onClick={e => e.stopPropagation()} className="input py-1 text-xs font-mono flex-1" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-shift-50 border-t border-shift-100 text-xs text-shift-700">
        選択中: <span className="font-mono font-semibold">{useCustom ? customModel || '（未入力）' : selectedId}</span>
      </div>
    </div>
  )
}

// ─── メインページ ─────────────────────────────────────────────────────────────
export default function SystemAnalysisPage({ params }: { params: { id: string } }) {
  const [testPhase, setTestPhase] = useState<TestPhase>('システムテスト')
  const [showPhaseTooltip, setShowPhaseTooltip] = useState<TestPhase | null>(null)

  const [modelId, setModelId] = useState(MODEL_OPTIONS[0]?.id || '')
  const [customModel, setCustomModel] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [adminModelList, setAdminModelList] = useState<CustomModelEntry[]>(MODEL_OPTIONS)

  const [ragTopK, setRagTopK] = useState({ doc: 60, site: 20, src: 40 })
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ragBreakdown, setRagBreakdown] = useState<{ doc: number; site: number; src: number } | null>(null)
  const [usedModel, setUsedModel] = useState('')

  // RAGデータ状況
  const [siteAnalysisCount, setSiteAnalysisCount] = useState(0)
  const [sourceCodeCount, setSourceCodeCount] = useState(0)

  useEffect(() => {
    fetch(`/api/site-analysis?projectId=${params.id}`)
      .then(r => r.json())
      .then(d => { if (d?.pageCount) setSiteAnalysisCount(d.pageCount) })
      .catch(() => {})

    fetch(`/api/documents?projectId=${params.id}`)
      .then(r => r.json())
      .then((docs: Array<{ category: string }>) => {
        if (!Array.isArray(docs)) return
        setSourceCodeCount(docs.filter(d => d.category === 'source_code').length)
      })
      .catch(() => {})

    // Admin設定からモデルリストを取得
    fetch('/api/admin/public-settings')
      .then(r => r.json())
      .then((s: { defaultPlanModelId?: string; customModelList?: CustomModelEntry[] }) => {
        if (s.customModelList && s.customModelList.length > 0) setAdminModelList(s.customModelList)
        const modelList = (s.customModelList && s.customModelList.length > 0) ? s.customModelList : MODEL_OPTIONS
        if (s.defaultPlanModelId) {
          setModelId(s.defaultPlanModelId)
          setUseCustom(!modelList.find(m => m.id === s.defaultPlanModelId))
        }
      })
      .catch(() => {})
  }, [params.id])

  const getModel = () => useCustom ? (customModel.trim() || modelId) : modelId

  const runAnalysis = async () => {
    setLoading(true)
    setError('')
    setAnalysis(null)
    setRagBreakdown(null)
    setUsedModel('')
    try {
      const res = await fetch('/api/system-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          testPhase,
          modelOverride: getModel(),
          ragTopK,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '分析に失敗しました')
      setAnalysis(data.analysis)
      setRagBreakdown(data.ragBreakdown)
      setUsedModel(data.model)
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const ss = analysis?.systemSummary
  const tp = analysis?.testPolicy
  const qa = analysis?.quantitativeAnalysis

  return (
    <div className="max-w-4xl animate-fade-in space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-shift-700" />
          システム分析
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          RAGで取り込んだドキュメント・ソースコードを解析し、テスト工程別のテスト方針・定量的分析レポートを生成します
        </p>
      </div>

      {/* RAGデータ状況 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RAGデータ利用状況</p>
        <div className="space-y-2">
          {[
            { icon: FileText, label: 'ドキュメント（要件定義書・設計書・ナレッジ）', available: true,               note: 'ドキュメント管理で確認' },
            { icon: Globe,    label: 'URL構造分析',                                  available: siteAnalysisCount > 0, note: siteAnalysisCount > 0 ? `${siteAnalysisCount}ページ` : '未実施（任意）' },
            { icon: Code2,    label: 'ソースコード',                                  available: sourceCodeCount > 0,   note: sourceCodeCount > 0 ? `${sourceCodeCount}件` : '未取込（任意）' },
          ].map(({ icon: Icon, label, available, note }) => (
            <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Icon className={`w-4 h-4 flex-shrink-0 ${available ? 'text-green-600' : 'text-gray-300'}`} />
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* テスト工程選択 */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-shift-700" />テスト工程
          <span className="text-xs font-normal text-gray-400">（工程に応じた分析観点でレポートを生成します）</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
          {TEST_PHASES.map(phase => (
            <div key={phase} className="relative">
              <button
                onClick={() => setTestPhase(phase)}
                onMouseEnter={() => setShowPhaseTooltip(phase)}
                onMouseLeave={() => setShowPhaseTooltip(null)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${testPhase === phase ? 'border-shift-700 bg-shift-50 text-shift-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                {testPhase === phase ? '✓ ' : ''}{phase}
              </button>
              {showPhaseTooltip === phase && (
                <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none leading-relaxed">
                  <p className="font-semibold mb-1">{phase}</p>
                  <p className="text-gray-300">{TEST_PHASE_DESCRIPTIONS[phase]}</p>
                  <p className="mt-1.5 text-gray-400">推奨観点: {TEST_PHASE_PERSPECTIVES[phase].join('・')}</p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          選択中: <span className="font-semibold text-shift-700">{testPhase}</span> — {TEST_PHASE_DESCRIPTIONS[testPhase]}
        </p>
      </div>

      {/* モデル選択 */}
      <ModelSelector
        selectedId={modelId} customModel={customModel} useCustom={useCustom}
        onSelect={id => { setModelId(id); setUseCustom(false) }}
        onCustomChange={setCustomModel} onUseCustom={() => setUseCustom(true)}
        models={adminModelList}
      />

      {/* 詳細設定 */}
      <div className="card">
        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900 text-sm">RAG詳細設定</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
            <label className="label">RAG取得チャンク数</label>
            <div className="space-y-2">
              {[
                { label: '📄 ドキュメント', key: 'doc' as const, max: 200 },
                { label: '🌐 サイト構造',   key: 'site' as const, max: 100 },
                { label: '💻 ソースコード', key: 'src' as const,  max: 200 },
              ].map(({ label, key, max }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-600 flex-shrink-0">{label}</span>
                  <input type="range" min={0} max={max} step={10} value={ragTopK[key]}
                    onChange={e => setRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="flex-1 accent-shift-700" />
                  <input type="number" min={0} max={max} value={ragTopK[key]}
                    onChange={e => setRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="input py-1 w-16 text-xs text-right" />
                  <span className="text-xs text-gray-400">件</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">分析に失敗しました</p>
            <p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{error}</p>
          </div>
        </div>
      )}

      {/* 実行ボタン */}
      <button disabled={loading} onClick={runAnalysis}
        className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60">
        {loading
          ? <><Loader2 className="w-5 h-5 animate-spin" />AIがシステムを分析中...</>
          : <><BarChart2 className="w-5 h-5" />「{testPhase}」のシステム分析レポートを生成する</>
        }
      </button>

      {loading && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center gap-3 text-shift-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <div>
              <p className="font-semibold text-sm">ドキュメント・ソースコードを分析中...</p>
              <p className="text-xs text-gray-500 mt-0.5">RAG検索 → システム特性解析 → テスト方針立案（30〜60秒程度）</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 分析結果 ─── */}
      {analysis && (
        <div className="space-y-5 animate-fade-in">
          {/* 使用情報バー */}
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {usedModel && (
              <span className="bg-gray-100 rounded-full px-3 py-1 font-mono">🤖 {usedModel}</span>
            )}
            {ragBreakdown && (
              <span className="bg-gray-100 rounded-full px-3 py-1">
                📚 RAG: Doc={ragBreakdown.doc} / Site={ragBreakdown.site} / Src={ragBreakdown.src}
              </span>
            )}
            <button onClick={runAnalysis} className="flex items-center gap-1 text-shift-600 hover:underline ml-auto">
              <RotateCcw className="w-3.5 h-3.5" />再分析
            </button>
          </div>

          {/* 1. システム特性サマリー */}
          {ss && (
            <div className="card">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-shift-700" />
                <h2 className="font-bold text-gray-900">1. システム特性の要約と分析</h2>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">{ss.overview}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">解析結果サマリー</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">言語/FW</span><span className="text-gray-800 font-medium">{ss.language}</span></div>
                      <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">規模感</span><span className="text-gray-800">{ss.scale}</span></div>
                      <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">アーキテクチャ</span><span className="text-gray-800">{ss.architecture}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">リスク指標</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600"><Zap className="w-3.5 h-3.5" />リアルタイム性</span>
                        <LevelBadge level={ss.realtimeRequirement} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600"><Shield className="w-3.5 h-3.5" />セキュリティ</span>
                        <LevelBadge level={ss.securityLevel} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600"><TrendingUp className="w-3.5 h-3.5" />スケーラビリティ</span>
                        <LevelBadge level={ss.scalability} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">総合リスク</span>
                        <LevelBadge level={ss.riskLevel} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500">複雑度スコア</p>
                    <span className="text-xs text-gray-400">(10点満点)</span>
                  </div>
                  <ScoreBar score={ss.complexityScore} />
                </div>
              </div>
            </div>
          )}

          {/* 2. 推奨テスト方針 */}
          {tp && (
            <div className="card">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-shift-700" />
                <h2 className="font-bold text-gray-900">2. 推奨テスト方針</h2>
                <span className="ml-auto text-xs bg-shift-100 text-shift-700 px-3 py-1 rounded-full font-semibold">{tp.testPhase}</span>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-sm text-gray-700 leading-relaxed">{tp.phaseDescription}</p>

                {/* 重点エリア */}
                {tp.focusAreas?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">重点テストエリア</p>
                    <div className="flex flex-wrap gap-2">
                      {tp.focusAreas.map((area, i) => (
                        <span key={i} className="bg-shift-50 text-shift-800 border border-shift-200 text-xs px-3 py-1.5 rounded-full font-medium">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* テスト分類配分 */}
                {tp.categories?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3">テスト分類別 重点配分</p>
                    <AllocationBar categories={tp.categories} />
                    <div className="mt-4 space-y-2">
                      {tp.categories.map((cat, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <LevelBadge level={cat.priority} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                              <span className="text-xs text-gray-500 font-mono">{cat.allocation}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{cat.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* テスト観点 */}
                {tp.perspectives?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3">テスト観点 優先順位</p>
                    <div className="space-y-2">
                      {tp.perspectives.map((persp, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                          <LevelBadge level={persp.priority} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{persp.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{persp.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. 定量的テスト分析 */}
          {qa && (
            <div className="card">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-shift-700" />
                <h2 className="font-bold text-gray-900">3. 定量的テスト分析</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-24">項目</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">分析指標</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-28">推奨TC数</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">算出根拠</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        { icon: Globe,    label: 'フロントエンド', data: qa.frontend },
                        { icon: Cpu,      label: 'バックエンドAPI', data: qa.backendApi },
                        { icon: Database, label: 'データベース',    data: qa.database },
                        { icon: Zap,      label: '外部連携',        data: qa.integration },
                      ].map(({ icon: Icon, label, data }) => (
                        <tr key={label} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-800 text-xs">{label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{data.metric}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-shift-700 text-base">{data.recommendedCases.toLocaleString()}</span>
                            <span className="text-xs text-gray-400 ml-1">件</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{data.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-shift-50 border-t-2 border-shift-200">
                        <td colSpan={2} className="px-4 py-3 font-bold text-shift-800 text-sm">合計推奨テストケース数</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-shift-700 text-xl">{qa.totalRecommendedCases.toLocaleString()}</span>
                          <span className="text-sm text-shift-600 ml-1">件</span>
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">
                        推定テスト工数: <span className="text-xl">{qa.estimatedEffortDays}</span> 人日
                      </p>
                      <p className="text-xs text-blue-600 mt-1">{qa.effortBasis}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. リスク分析 */}
          {analysis.riskAnalysis?.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-shift-700" />
                <h2 className="font-bold text-gray-900">4. リスク分析</h2>
              </div>
              <div className="p-5 space-y-3">
                {analysis.riskAnalysis.map((risk, i) => (
                  <div key={i} className={`rounded-xl border p-4 ${LEVEL_COLOR[risk.level].border} ${risk.level === 'high' ? 'bg-red-50' : risk.level === 'medium' ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <div className="flex items-start gap-3">
                      <LevelBadge level={risk.level} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{risk.area}</p>
                        <p className="text-xs text-gray-600 mt-1">{risk.description}</p>
                        <div className="flex items-start gap-1.5 mt-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700">{risk.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. 重要な洞察 */}
          {analysis.keyInsights?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900">重要な洞察</h2>
              </div>
              <div className="space-y-2">
                {analysis.keyInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <span className="text-amber-600 font-bold text-sm flex-shrink-0">💡</span>
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
