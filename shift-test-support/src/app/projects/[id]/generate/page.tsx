'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, Settings,
  ChevronDown, ChevronUp, Loader2, Globe, FileText, Code2,
  ClipboardList, Play, Edit3, Trash2, Plus, ChevronRight, RotateCcw, AlertTriangle
} from 'lucide-react'
import type { SiteAnalysis, TestPlan, TestPlanBatch } from '@/types'

const PERSPECTIVE_OPTIONS = [
  { label: '機能テスト', value: '機能テスト' },
  { label: '正常系',     value: '正常系' },
  { label: '異常系',     value: '異常系' },
  { label: '境界値',     value: '境界値' },
  { label: 'セキュリティ', value: 'セキュリティ' },
  { label: '操作性',     value: '操作性' },
  { label: '性能',       value: '性能' },
]

interface ModelOption {
  id: string; label: string; inputCost: string; outputCost: string
  feature: string; speed: '爆速' | '高速' | '標準'; isDefault?: boolean; isFree?: boolean
}
const MODEL_OPTIONS: ModelOption[] = [
  { id: 'deepseek/deepseek-v3.2',           label: 'DeepSeek V3.2',          inputCost: '$0.20', outputCost: '$0.35',  feature: '最安クラス。出力量が多いならこれ一択',  speed: '高速', isDefault: true },
  { id: 'google/gemini-2.5-flash',          label: 'Gemini 2.5 Flash',        inputCost: '$0.15', outputCost: '$0.60',  feature: '最新Gemini。高精度かつ爆速',          speed: '爆速' },
  { id: 'google/gemini-3-flash-preview',    label: 'Gemini 3 Flash Preview',  inputCost: '$0.10', outputCost: '$0.40',  feature: 'Gemini最新プレビュー。爆速で大量生成', speed: '爆速' },
  { id: 'openai/gpt-5-nano',               label: 'GPT-5 Nano',              inputCost: '$0.05', outputCost: '$0.20',  feature: '最も安価なGPT。軽量タスクに最適',     speed: '爆速' },
  { id: 'openai/gpt-5.2',                  label: 'GPT-5.2',                 inputCost: '$1.75', outputCost: '$14.00', feature: '非常に高精度。複雑なロジックの網羅に強い', speed: '標準' },
  { id: 'anthropic/claude-sonnet-4.6',     label: 'Claude Sonnet 4.6',       inputCost: '$3.00', outputCost: '$15.00', feature: 'Anthropic最新。論理的な分析に最強',    speed: '標準' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B',        inputCost: '$0.12', outputCost: '$0.30',  feature: 'Meta製OSS。コスパ良好',               speed: '高速' },
  { id: 'deepseek/deepseek-r1-0528:free',  label: 'DeepSeek R1 (free)',      inputCost: '無料',  outputCost: '無料',   feature: 'OpenRouterの無料枠。お試しに最適',    speed: '高速', isFree: true },
]
const SPEED_COLOR: Record<string, string> = { '爆速': 'text-green-600 bg-green-50', '高速': 'text-blue-600 bg-blue-50', '標準': 'text-gray-600 bg-gray-100' }

function ModelSelector({ selectedId, customModel, useCustom, onSelect, onCustomChange, onUseCustom, label }: {
  selectedId: string; customModel: string; useCustom: boolean
  onSelect: (id: string) => void; onCustomChange: (v: string) => void; onUseCustom: () => void; label: string
}) {
  return (
    <div className="card">
      <div className="p-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">OpenRouter経由で呼び出します（OPENROUTER_API_KEY）</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">
            <th className="w-8 px-3 py-2"></th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">モデル名</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">入力/1M</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">出力/1M</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">特徴</th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">速度</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {MODEL_OPTIONS.map(m => (
              <tr key={m.id} onClick={() => onSelect(m.id)}
                className={`cursor-pointer transition-colors ${!useCustom && selectedId === m.id ? 'bg-shift-50 border-l-2 border-l-shift-700' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
                <td className="px-3 py-2.5 text-center"><input type="radio" checked={!useCustom && selectedId === m.id} onChange={() => onSelect(m.id)} className="accent-shift-700" /></td>
                <td className="px-3 py-2.5"><div className="font-medium text-gray-900">{m.label}</div><div className="text-xs text-gray-400 font-mono">{m.id}</div></td>
                <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree ? 'text-green-600 font-bold' : 'text-gray-600'}`}>{m.inputCost}</td>
                <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree ? 'text-green-600 font-bold' : 'text-gray-600'}`}>{m.outputCost}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 max-w-xs">{m.feature}</td>
                <td className="px-3 py-2.5 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SPEED_COLOR[m.speed]}`}>{m.speed === '爆速' && '⚡ '}{m.speed}</span></td>
              </tr>
            ))}
            <tr onClick={onUseCustom} className={`cursor-pointer transition-colors ${useCustom ? 'bg-shift-50 border-l-2 border-l-shift-700' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
              <td className="px-3 py-2.5 text-center"><input type="radio" checked={useCustom} onChange={onUseCustom} className="accent-shift-700" /></td>
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

function PlanEditor({ plan, onSave, onClose }: { plan: TestPlan; onSave: (updated: TestPlan) => void; onClose: () => void }) {
  const [batches, setBatches] = useState<TestPlanBatch[]>(plan.batches.map(b => ({ ...b, titles: [...b.titles] })))
  const [openBatch, setOpenBatch] = useState<number | null>(0)
  const [editingTitle, setEditingTitle] = useState<{ batchIdx: number; titleIdx: number } | null>(null)
  const [titleInput, setTitleInput] = useState('')
  const totalTitles = batches.reduce((s, b) => s + b.titles.length, 0)

  const saveTitle = () => {
    if (!editingTitle) return
    setBatches(prev => prev.map((b, i) => i === editingTitle.batchIdx ? { ...b, titles: b.titles.map((t, j) => j === editingTitle.titleIdx ? titleInput : t) } : b))
    setEditingTitle(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">テストプランの編集</h2>
            <p className="text-sm text-gray-500 mt-0.5">合計 <strong>{totalTitles}</strong> 件 / {batches.length} バッチ</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">キャンセル</button>
            <button onClick={() => onSave({ ...plan, batches: batches.map(b => ({ ...b, count: b.titles.length })), totalItems: totalTitles })} className="btn-primary">
              <CheckCircle2 className="w-4 h-4" />保存
            </button>
          </div>
        </div>
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          {batches.map((batch, bIdx) => (
            <div key={bIdx} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                <button onClick={() => setOpenBatch(openBatch === bIdx ? null : bIdx)} className="flex items-center gap-2 flex-1 text-left">
                  {openBatch === bIdx ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs text-gray-400 font-mono">Batch {batch.batchId}</span>
                  <span className="font-semibold text-gray-800">{batch.category}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{batch.perspective}</span>
                  <span className="text-xs text-gray-500">{batch.titles.length}件</span>
                </button>
                <button onClick={() => setBatches(prev => prev.filter((_, i) => i !== bIdx).map((b, i) => ({ ...b, batchId: i + 1 })))} className="text-red-400 hover:text-red-600 p-1 ml-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {openBatch === bIdx && (
                <div className="p-4 space-y-1.5">
                  {batch.titles.map((title, tIdx) => (
                    <div key={tIdx} className="group">
                      {editingTitle?.batchIdx === bIdx && editingTitle?.titleIdx === tIdx ? (
                        <div className="flex gap-2">
                          <input value={titleInput} onChange={e => setTitleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTitle()} className="input flex-1 text-sm py-1.5" autoFocus />
                          <button onClick={saveTitle} className="btn-primary py-1.5 text-xs">保存</button>
                          <button onClick={() => setEditingTitle(null)} className="btn-secondary py-1.5 text-xs">×</button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                          <span className="text-xs text-gray-400 font-mono mt-0.5 w-6 flex-shrink-0">{tIdx + 1}.</span>
                          <span className="text-sm text-gray-700 flex-1 leading-relaxed">{title}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                            <button onClick={() => { setEditingTitle({ batchIdx: bIdx, titleIdx: tIdx }); setTitleInput(title) }} className="text-gray-400 hover:text-shift-600 p-1"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setBatches(prev => prev.map((b, i) => i === bIdx ? { ...b, titles: b.titles.filter((_, j) => j !== tIdx), count: b.titles.length - 1 } : b))} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => {
                    const newTitle = `新しいテスト項目 ${batch.titles.length + 1}`
                    setBatches(prev => prev.map((b, i) => i === bIdx ? { ...b, titles: [...b.titles, newTitle], count: b.titles.length + 1 } : b))
                    setEditingTitle({ batchIdx: bIdx, titleIdx: batch.titles.length }); setTitleInput(newTitle)
                  }} className="flex items-center gap-1.5 text-xs text-shift-600 hover:text-shift-800 mt-2">
                    <Plus className="w-3.5 h-3.5" />タイトルを追加
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GeneratePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysis | null>(null)
  const [sourceCodeCount, setSourceCodeCount] = useState(0)
  const [sourceCodeChunks, setSourceCodeChunks] = useState(0)
  const [step, setStep] = useState<'plan' | 'execute'>('plan')

  // プランニング設定
  const [totalItems, setTotalItems] = useState(100)
  const [batchSize, setBatchSize] = useState(50)
  const [planModelId, setPlanModelId] = useState(MODEL_OPTIONS.find(m => m.isDefault)!.id)
  const [planCustomModel, setPlanCustomModel] = useState('')
  const [usePlanCustom, setUsePlanCustom] = useState(false)
  const [perspectiveMode, setPerspectiveMode] = useState<'ai' | 'weighted'>('ai')
  const [selectedPerspectives, setSelectedPerspectives] = useState<Set<string>>(new Set(['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性']))
  const [perspectiveWeights, setPerspectiveWeights] = useState<Record<string, number>>({ '機能テスト': 30, '正常系': 20, '異常系': 20, '境界値': 10, 'セキュリティ': 10, '操作性': 10 })
  const [ragTopK, setRagTopK] = useState({ doc: 80, site: 30, src: 50 })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 実行設定
  const [execModelId, setExecModelId] = useState(MODEL_OPTIONS.find(m => m.isDefault)!.id)
  const [execCustomModel, setExecCustomModel] = useState('')
  const [useExecCustom, setUseExecCustom] = useState(false)
  const [execRagTopK, setExecRagTopK] = useState({ doc: 100, site: 40, src: 100 })

  // プラン状態
  const [plan, setPlan] = useState<TestPlan | null>(null)
  const [showPlanEditor, setShowPlanEditor] = useState(false)

  // プランニング進捗
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')

  // 実行進捗
  const [executing, setExecuting] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [totalGenerated, setTotalGenerated] = useState(0)
  const [execError, setExecError] = useState('')
  const [execDone, setExecDone] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const [currentBatchLabel, setCurrentBatchLabel] = useState('')

  useEffect(() => {
    fetch(`/api/site-analysis?projectId=${params.id}`).then(r => r.json()).then(d => { if (d?.id) setSiteAnalysis(d) }).catch(() => {})
    fetch(`/api/documents?projectId=${params.id}`).then(r => r.json()).then((docs: Array<{ category: string; chunkCount?: number }>) => {
      if (!Array.isArray(docs)) return
      const src = docs.filter(d => d.category === 'source_code')
      setSourceCodeCount(src.length); setSourceCodeChunks(src.reduce((s, d) => s + (d.chunkCount ?? 0), 0))
    }).catch(() => {})
    fetch(`/api/generate/plan?projectId=${params.id}`).then(r => r.json()).then(p => {
      if (p?.id) { setPlan(p); setStep('execute') }
    }).catch(() => {})
  }, [params.id])

  const getPlanModel = () => usePlanCustom ? (planCustomModel.trim() || planModelId) : planModelId
  const getExecModel = () => useExecCustom ? (execCustomModel.trim() || execModelId) : execModelId

  const runPlanning = async () => {
    setPlanning(true); setPlanError(''); setPlan(null)
    try {
      const weights = perspectiveMode === 'weighted'
        ? Array.from(selectedPerspectives).filter(p => (perspectiveWeights[p] ?? 0) > 0).map(p => ({ value: p, count: perspectiveWeights[p] }))
        : undefined
      const res = await fetch('/api/generate/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, totalItems, batchSize,
          perspectives: perspectiveMode === 'ai' ? Array.from(selectedPerspectives) : undefined,
          perspectiveWeights: weights, modelOverride: getPlanModel(), ragTopK }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'プランニングに失敗しました')
      setPlan(data.plan); setStep('execute')
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'プランニングに失敗しました')
    } finally { setPlanning(false) }
  }

  const savePlan = async (updated: TestPlan) => {
    await fetch('/api/generate/plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: updated }) })
    setPlan(updated); setShowPlanEditor(false)
  }

  const runExecution = async () => {
    if (!plan) return
    setExecuting(true); setExecError(''); setExecDone(false); setTotalGenerated(0); setCurrentBatch(0); setIsPartial(false)
    try {
      const startRes = await fetch('/api/generate/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, maxItems: plan.totalItems, modelOverride: getExecModel() }),
      })
      const startData = await startRes.json()
      if (!startData.jobId) throw new Error(startData.error || 'ジョブ開始に失敗しました')

      const batches = plan.batches; setTotalBatches(batches.length)
      let generated = 0; let aborted = false

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]; setCurrentBatch(i + 1); setCurrentBatchLabel(`${batch.category} / ${batch.perspective}`)
        const batchRes = await fetch('/api/generate/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: startData.jobId, projectId: params.id, batchNum: i + 1, totalBatches: batches.length, alreadyCount: generated, planBatch: batch, modelOverride: getExecModel(), ragTopK: execRagTopK }),
        })
        const batchData = await batchRes.json()
        if (!batchRes.ok || batchData.error) throw new Error(`バッチ${i + 1}でエラー: ${batchData.error}`)
        generated += batchData.count ?? 0; setTotalGenerated(generated)
        if (batchData.aborted) { aborted = true; break }
      }

      await fetch('/api/generate/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: startData.jobId, projectId: params.id, count: generated, isPartial: aborted, targetPages: null }),
      }).catch(() => {})

      const completedPlan = { ...plan, status: 'completed' as const, execModelId: getExecModel() }
      await fetch('/api/generate/plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: completedPlan }) })
      setPlan(completedPlan); setIsPartial(aborted); setExecDone(true)
    } catch (e) {
      setExecError(e instanceof Error ? e.message : 'テスト項目の生成に失敗しました')
    } finally { setExecuting(false) }
  }

  const totalPlanItems = plan?.batches.reduce((s, b) => s + b.titles.length, 0) ?? 0
  const progressPct = totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0

  return (
    <div className="max-w-3xl animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIテスト項目生成</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="font-semibold text-shift-700">① プランニング</span> → 仕様書を分析してテスト設計方針を立案 →
          確認・編集 → <span className="font-semibold text-shift-700">② 実行</span> → 詳細生成
        </p>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-3">
        <button onClick={() => setStep('plan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${step === 'plan' ? 'bg-shift-700 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          <ClipboardList className="w-4 h-4" />① プランニング
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <button onClick={() => plan && setStep('execute')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${step === 'execute' ? 'bg-shift-700 text-white shadow-sm' : plan ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}>
          <Play className="w-4 h-4" />② 実行{plan && <span className="text-xs opacity-80">({totalPlanItems}件)</span>}
        </button>
      </div>

      {/* RAGデータ状況 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RAGデータ利用状況</p>
        <div className="space-y-2">
          {[
            { icon: FileText, label: 'ドキュメント（要件定義書・設計書・ナレッジ）', available: true, note: 'ドキュメント管理で確認' },
            { icon: Globe, label: 'URL構造分析', available: !!siteAnalysis, note: siteAnalysis ? `${siteAnalysis.pageCount}ページ` : '未実施（任意）' },
            { icon: Code2, label: 'ソースコード', available: sourceCodeCount > 0, note: sourceCodeCount > 0 ? `${sourceCodeCount}件 / チャンク: ${sourceCodeChunks}` : '未取込（任意）' },
          ].map(({ icon: Icon, label, available, note }) => (
            <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Icon className={`w-4 h-4 flex-shrink-0 ${available ? 'text-green-600' : 'text-gray-300'}`} />
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* STEP 1: プランニング */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 'plan' && (
        <>
          <ModelSelector label="① プランニング用AIモデル（テスト設計方針の立案）"
            selectedId={planModelId} customModel={planCustomModel} useCustom={usePlanCustom}
            onSelect={id => { setPlanModelId(id); setUsePlanCustom(false) }}
            onCustomChange={setPlanCustomModel} onUseCustom={() => setUsePlanCustom(true)} />

          <div className="card">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={() => setShowAdvanced(!showAdvanced)}>
              <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-gray-500" /><span className="font-semibold text-gray-900 text-sm">生成パラメータ</span></div>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 space-y-6 border-t border-gray-100 pt-4">
                <div>
                  <label className="label">総生成件数</label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {[50, 100, 200, 300, 500].map(v => (
                      <button key={v} onClick={() => setTotalItems(v)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${totalItems === v ? 'bg-shift-800 text-white border-shift-800' : 'bg-white text-gray-600 border-gray-200 hover:border-shift-400'}`}>{v}件</button>
                    ))}
                    <input type="number" min={10} max={5000} value={totalItems} onChange={e => setTotalItems(Number(e.target.value))} className="input py-1.5 w-28 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="label">1バッチあたりの件数</label>
                  <p className="text-xs text-gray-400 mb-2">{totalItems}件 ÷ {batchSize}件 = <strong className="text-shift-700">{Math.ceil(totalItems / batchSize)}バッチ</strong></p>
                  <div className="flex gap-2 flex-wrap items-center">
                    {[25, 50, 75, 100].map(v => (
                      <button key={v} onClick={() => setBatchSize(v)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${batchSize === v ? 'bg-shift-800 text-white border-shift-800' : 'bg-white text-gray-600 border-gray-200 hover:border-shift-400'}`}>{v}件</button>
                    ))}
                    <input type="number" min={10} max={200} value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} className="input py-1.5 w-28 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="label">テスト観点の配分</label>
                  <div className="flex gap-2 mb-3">
                    {[{ mode: 'ai' as const, label: 'AIに任せる' }, { mode: 'weighted' as const, label: '件数で指定' }].map(({ mode, label }) => (
                      <button key={mode} onClick={() => setPerspectiveMode(mode)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${perspectiveMode === mode ? 'bg-shift-800 text-white border-shift-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{label}</button>
                    ))}
                  </div>
                  {perspectiveMode === 'ai' && (
                    <div className="flex flex-wrap gap-2">
                      {PERSPECTIVE_OPTIONS.map(({ value, label }) => (
                        <button key={value} onClick={() => setSelectedPerspectives(prev => { const next = new Set(prev); next.has(value) ? next.delete(value) : next.add(value); return next })}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedPerspectives.has(value) ? 'bg-shift-100 text-shift-800 border-shift-400' : 'bg-white text-gray-500 border-gray-200'}`}>{label}</button>
                      ))}
                    </div>
                  )}
                  {perspectiveMode === 'weighted' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400">合計: <span className="font-semibold text-shift-700">{PERSPECTIVE_OPTIONS.filter(p => selectedPerspectives.has(p.value)).reduce((s, p) => s + (perspectiveWeights[p.value] ?? 0), 0)}件</span></p>
                      {PERSPECTIVE_OPTIONS.map(({ value, label }) => {
                        const enabled = selectedPerspectives.has(value); const count = perspectiveWeights[value] ?? 0
                        return (
                          <div key={value} className="flex items-center gap-3">
                            <button onClick={() => setSelectedPerspectives(prev => { const next = new Set(prev); next.has(value) ? next.delete(value) : next.add(value); return next })}
                              className={`w-20 flex-shrink-0 text-xs px-2 py-1 rounded-lg border text-center font-medium ${enabled ? 'bg-shift-100 text-shift-800 border-shift-400' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{label}</button>
                            <input type="range" min={0} max={200} step={5} value={count} disabled={!enabled} onChange={e => setPerspectiveWeights(prev => ({ ...prev, [value]: Number(e.target.value) }))} className="flex-1 accent-shift-700 disabled:opacity-30" />
                            <span className={`w-12 text-right text-xs font-mono font-semibold ${enabled ? 'text-shift-700' : 'text-gray-300'}`}>{enabled ? `${count}件` : 'OFF'}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">RAG取得チャンク数</label>
                  <div className="space-y-2">
                    {[{ label: '📄 ドキュメント', key: 'doc' as const, max: 200 }, { label: '🌐 サイト構造', key: 'site' as const, max: 100 }, { label: '💻 ソースコード', key: 'src' as const, max: 200 }].map(({ label, key, max }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-28 text-xs text-gray-600 flex-shrink-0">{label}</span>
                        <input type="range" min={0} max={max} step={10} value={ragTopK[key]} onChange={e => setRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="flex-1 accent-shift-700" />
                        <input type="number" min={0} max={max} value={ragTopK[key]} onChange={e => setRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="input py-1 w-16 text-xs text-right" />
                        <span className="text-xs text-gray-400">件</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {planError && (
            <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div><p className="text-sm font-semibold text-red-800">プランニングに失敗しました</p><p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{planError}</p></div>
            </div>
          )}

          <button disabled={planning} onClick={runPlanning} className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60">
            {planning ? <><Loader2 className="w-5 h-5 animate-spin" />AIがテスト設計プランを立案中...</> : <><ClipboardList className="w-5 h-5" />テスト設計プランを立案する</>}
          </button>

          {planning && (
            <div className="card p-5 animate-fade-in">
              <div className="flex items-center gap-3 text-shift-700">
                <Loader2 className="w-5 h-5 animate-spin" />
                <div><p className="font-semibold text-sm">仕様書を分析してプランを立案中...</p><p className="text-xs text-gray-500 mt-0.5">RAG検索 → プロンプト構築 → LLMによる設計計画の生成（30〜60秒程度）</p></div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* STEP 2: プラン確認・実行 */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 'execute' && plan && (
        <>
          {/* プラン概要カード */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">テスト設計プラン</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  合計 <strong className="text-shift-700">{totalPlanItems}</strong> 件 / {plan.batches.length} バッチ /
                  プランモデル: <span className="font-mono text-gray-600">{plan.planModelId}</span>
                  {plan.ragBreakdown && (
                    <span className="ml-2 text-gray-400">
                      RAG: Doc={plan.ragBreakdown.doc} Site={plan.ragBreakdown.site} Src={plan.ragBreakdown.src}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPlanEditor(true)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />編集</button>
                <button onClick={() => { setStep('plan'); setPlan(null); setExecDone(false) }} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />再立案</button>
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {plan.batches.map((batch, i) => (
                <div key={i} className={`px-4 py-3 transition-colors ${executing && currentBatch === i + 1 ? 'bg-shift-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">Batch {batch.batchId}</span>
                    <span className="font-medium text-gray-800 text-sm flex-1">{batch.category}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">{batch.perspective}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0 w-10 text-right">{batch.titles.length}件</span>
                    <div className="w-5 flex-shrink-0">
                      {executing && currentBatch === i + 1 && <Loader2 className="w-3.5 h-3.5 text-shift-600 animate-spin" />}
                      {(execDone || (executing && currentBatch > i + 1)) && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                  </div>
                  <div className="mt-1 ml-20 space-y-0.5">
                    {batch.titles.slice(0, 2).map((t, ti) => <p key={ti} className="text-xs text-gray-400 truncate">• {t}</p>)}
                    {batch.titles.length > 2 && <p className="text-xs text-gray-300">... 他 {batch.titles.length - 2} 件</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 実行モデル選択 */}
          <ModelSelector label="② 実行用AIモデル（テスト項目詳細の生成）"
            selectedId={execModelId} customModel={execCustomModel} useCustom={useExecCustom}
            onSelect={id => { setExecModelId(id); setUseExecCustom(false) }}
            onCustomChange={setExecCustomModel} onUseCustom={() => setUseExecCustom(true)} />

          {/* 実行RAG設定 */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">RAG取得チャンク数（実行用）</p>
            <div className="space-y-2">
              {[{ label: '📄 ドキュメント', key: 'doc' as const, max: 200 }, { label: '🌐 サイト構造', key: 'site' as const, max: 100 }, { label: '💻 ソースコード', key: 'src' as const, max: 200 }].map(({ label, key, max }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-600 flex-shrink-0">{label}</span>
                  <input type="range" min={0} max={max} step={10} value={execRagTopK[key]} onChange={e => setExecRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="flex-1 accent-shift-700" />
                  <input type="number" min={0} max={max} value={execRagTopK[key]} onChange={e => setExecRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="input py-1 w-16 text-xs text-right" />
                  <span className="text-xs text-gray-400">件</span>
                </div>
              ))}
            </div>
          </div>

          {execError && (
            <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div><p className="text-sm font-semibold text-red-800">エラーが発生しました</p><p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{execError}</p>
                <button onClick={() => setExecError('')} className="btn-secondary text-xs py-1.5 mt-2">再試行</button>
              </div>
            </div>
          )}

          {/* 実行進捗 */}
          {executing && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Loader2 className="w-5 h-5 text-shift-600 animate-spin" /><span className="font-semibold text-gray-900 text-sm">テスト項目を生成中...</span></div>
                <span className="text-lg font-bold text-shift-700">{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div className="bg-gradient-to-r from-shift-700 to-shift-400 h-3 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">バッチ</p><p className="font-bold text-shift-700">{currentBatch} / {totalBatches}</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">生成済み</p><p className="font-bold text-green-600">{totalGenerated} 件</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">目標</p><p className="font-bold text-gray-700">{totalPlanItems} 件</p></div>
              </div>
              {currentBatchLabel && <p className="text-xs text-gray-400 mt-3 text-center"><span className="bg-gray-100 rounded px-2 py-0.5">{currentBatchLabel}</span></p>}
            </div>
          )}

          {/* 完了 */}
          {execDone && (
            <div className={`card p-6 text-center animate-slide-up ${isPartial ? 'border border-amber-300' : ''}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPartial ? 'bg-amber-100' : 'bg-green-100'}`}>
                {isPartial ? <AlertTriangle className="w-8 h-8 text-amber-600" /> : <CheckCircle2 className="w-8 h-8 text-green-600" />}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{isPartial ? '途中保存で完了' : '生成完了！'}</h3>
              <p className="text-sm text-gray-600 mb-4">{totalGenerated}件のテスト項目を生成しました</p>
              <div className="flex gap-3 justify-center">
                <button className="btn-secondary" onClick={() => { setExecDone(false); setTotalGenerated(0); setCurrentBatch(0) }}>再実行</button>
                <button className="btn-primary" onClick={() => router.push(`/projects/${params.id}/test-items`)}>テスト項目書を確認</button>
              </div>
            </div>
          )}

          {!executing && !execDone && (
            <button onClick={runExecution} className="btn-primary w-full justify-center py-4 text-base">
              <Play className="w-5 h-5" />{plan.batches.length}バッチ・{totalPlanItems}件のテスト項目を生成する
            </button>
          )}
        </>
      )}

      {showPlanEditor && plan && <PlanEditor plan={plan} onSave={savePlan} onClose={() => setShowPlanEditor(false)} />}
    </div>
  )
}
