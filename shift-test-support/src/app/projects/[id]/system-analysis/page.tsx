'use client'
import { useState, useEffect } from 'react'
import {
  BarChart2, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Cpu, Shield, Zap, Globe, Code2, FileText, Database,
  TrendingUp, AlertTriangle, CheckCircle2, Info,
  ClipboardList, RotateCcw, Lightbulb, Settings, Trash2,
  Clock, BookOpen, Target, Users, Calendar, Activity
} from 'lucide-react'
import type { CustomModelEntry } from '@/types'
import { TEST_PHASE_DESCRIPTIONS, TEST_PHASE_PERSPECTIVES } from '@/types'
import type { TestPhase } from '@/types'

// ─── 型定義 ────────────────────────────────────────────────────
interface TechStack { frontend: string; backend: string; database: string; infrastructure: string; externalApis: string }
interface Scale { estimatedLoc: number; locBasis: string; screenCount: number; screenBasis: string; apiEndpointCount: number; apiBasis: string; tableCount: number; tableBasis: string }
interface QualityAttributes { realtimeRequirement: string; realtimeBasis: string; securityLevel: string; securityBasis: string; scalability: string; scalabilityBasis: string; availability: string; availabilityBasis: string }
interface ComplexityAnalysis { score: number; basis: string; cyclomaticEstimate: string; nestingDepth: string }
interface SystemSummary { overview: string; architecture: string; techStack: TechStack; scale: Scale; qualityAttributes: QualityAttributes; complexityAnalysis: ComplexityAnalysis; riskLevel: string; riskBasis: string }
interface FocusArea { area: string; reason: string; testApproach: string }
interface PolicyCategory { name: string; priority: string; allocation: number; reason: string; keyTestPoints: string[] }
interface PolicyPerspective { name: string; priority: string; description: string; targetAreas: string[] }
interface AutomationRec { automatable: number; manual: number; automatableBasis: string }
interface EntryCriteria { entry: string[]; exit: string[] }
interface TestPolicy { testPhase: string; phaseObjective: string; phaseDescription: string; entryExitCriteria: EntryCriteria; focusAreas: FocusArea[]; categories: PolicyCategory[]; perspectives: PolicyPerspective[]; automationRecommendation: AutomationRec }
interface QuantItem { metric: string; complexity: string; recommendedCases: number; caseBreakdown: string; basis: string }
interface CoverageBreakdown { normal: number; abnormal: number; boundary: number; security: number; performance: number }
interface EffortBreakdown { design: number; execution: number; bugReport: number; regression: number }
interface QuantitativeAnalysis { calculationBasis: string; frontend: QuantItem; backendApi: QuantItem; database: QuantItem; integration: QuantItem; totalRecommendedCases: number; coverageBreakdown: CoverageBreakdown; estimatedEffortDays: number; effortBreakdown: EffortBreakdown; effortBasis: string; teamSizeRecommendation: number; scheduleSuggestionDays: number }
interface RiskItem { area: string; level: string; category: string; description: string; impact: string; probability: string; probabilityBasis: string; recommendation: string; testTechnique: string }
interface DefectTendency { analysis: string; highRiskModules: string[]; recommendedChecklists: string[] }
interface KeyInsight { title: string; detail: string; action: string }
interface AnalysisResult { systemSummary: SystemSummary; testPolicy: TestPolicy; quantitativeAnalysis: QuantitativeAnalysis; riskAnalysis: RiskItem[]; defectTendency: DefectTendency; keyInsights: KeyInsight[]; executiveSummary: string }

// ─── 定数 ──────────────────────────────────────────────────────
const TEST_PHASES: TestPhase[] = ['単体テスト','結合テスト','システムテスト','受入テスト','回帰テスト','パフォーマンステスト','セキュリティテスト']
const MODEL_OPTIONS: CustomModelEntry[] = [
  { id:'deepseek/deepseek-v3.2',             label:'DeepSeek V3.2',          inputCost:'$0.20', outputCost:'$0.35',  feature:'最安クラス。出力量が多いならこれ一択',     speed:'高速' },
  { id:'google/gemini-2.5-flash',            label:'Gemini 2.5 Flash',        inputCost:'$0.15', outputCost:'$0.60',  feature:'最新Gemini。高精度かつ爆速',              speed:'爆速' },
  { id:'google/gemini-3-flash-preview',      label:'Gemini 3 Flash Preview',  inputCost:'$0.10', outputCost:'$0.40',  feature:'Gemini最新プレビュー。爆速で大量生成',    speed:'爆速' },
  { id:'openai/gpt-5-nano',                  label:'GPT-5 Nano',              inputCost:'$0.05', outputCost:'$0.20',  feature:'最も安価なGPT。軽量タスクに最適',         speed:'爆速' },
  { id:'openai/gpt-5.2',                     label:'GPT-5.2',                 inputCost:'$1.75', outputCost:'$14.00', feature:'非常に高精度。複雑なロジックの網羅に強い', speed:'標準' },
  { id:'anthropic/claude-sonnet-4.6',        label:'Claude Sonnet 4.6',       inputCost:'$3.00', outputCost:'$15.00', feature:'Anthropic最新。論理的な分析に最強',        speed:'標準' },
  { id:'meta-llama/llama-3.3-70b-instruct',  label:'Llama 3.3 70B',           inputCost:'$0.12', outputCost:'$0.30',  feature:'Meta製OSS。コスパ良好',                   speed:'高速' },
  { id:'deepseek/deepseek-r1-0528:free',     label:'DeepSeek R1 (free)',       inputCost:'無料',  outputCost:'無料',   feature:'OpenRouterの無料枠。お試しに最適',         speed:'高速', isFree:true },
]
const SPEED_COLOR: Record<string,string> = { '爆速':'text-green-600 bg-green-50','高速':'text-blue-600 bg-blue-50','標準':'text-gray-600 bg-gray-100' }
const LEVEL: Record<string,{ bg:string; text:string; border:string; label:string }> = {
  high:   { bg:'bg-red-100',   text:'text-red-700',   border:'border-red-200',   label:'高' },
  medium: { bg:'bg-amber-100', text:'text-amber-700', border:'border-amber-200', label:'中' },
  low:    { bg:'bg-green-100', text:'text-green-700', border:'border-green-200', label:'低' },
}

// ─── ユーティリティ ─────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const c = LEVEL[level] ?? LEVEL.medium
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>{c.label}</span>
}
function ScoreBar({ score, max=10 }: { score:number; max?:number }) {
  const pct = Math.min(100, Math.round((score/max)*100))
  const color = pct>=70?'bg-red-500':pct>=40?'bg-amber-500':'bg-green-500'
  return <div className="flex items-center gap-2"><div className="flex-1 bg-gray-200 rounded-full h-2.5"><div className={`${color} h-2.5 rounded-full transition-all duration-700`} style={{width:`${pct}%`}}/></div><span className="text-sm font-bold text-gray-700 w-10 text-right">{score}/{max}</span></div>
}
function InfoRow({ label, value, basis }: { label:string; value:string; basis?:string }) {
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-baseline gap-3">
        <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
        <span className="text-sm font-medium text-gray-800 flex-1">{value}</span>
      </div>
      {basis && <p className="text-xs text-gray-400 mt-0.5 ml-[7.5rem] leading-relaxed">{basis}</p>}
    </div>
  )
}
function Section({ title, icon: Icon, children, defaultOpen=true }: { title:string; icon:React.ComponentType<{className?:string}>; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100" onClick={()=>setOpen(!open)}>
        <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-shift-700"/><h2 className="font-bold text-gray-900">{title}</h2></div>
        {open?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

function ModelSelector({ selectedId, customModel, useCustom, onSelect, onCustomChange, onUseCustom, models }: {
  selectedId:string; customModel:string; useCustom:boolean
  onSelect:(id:string)=>void; onCustomChange:(v:string)=>void; onUseCustom:()=>void; models:CustomModelEntry[]
}) {
  return (
    <div className="card">
      <div className="p-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">分析用AIモデル</p>
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
            {models.map(m=>(
              <tr key={m.id} onClick={()=>onSelect(m.id)} className={`cursor-pointer transition-colors ${!useCustom&&selectedId===m.id?'bg-shift-50 border-l-2 border-l-shift-700':'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
                <td className="px-3 py-2.5 text-center"><input type="radio" checked={!useCustom&&selectedId===m.id} onChange={()=>onSelect(m.id)} className="accent-shift-700"/></td>
                <td className="px-3 py-2.5"><div className="font-medium text-gray-900">{m.label}</div><div className="text-xs text-gray-400 font-mono">{m.id}</div></td>
                <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree?'text-green-600 font-bold':'text-gray-600'}`}>{m.inputCost}</td>
                <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree?'text-green-600 font-bold':'text-gray-600'}`}>{m.outputCost}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 max-w-xs">{m.feature}</td>
                <td className="px-3 py-2.5 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SPEED_COLOR[m.speed]}`}>{m.speed==='爆速'&&'⚡ '}{m.speed}</span></td>
              </tr>
            ))}
            <tr onClick={onUseCustom} className={`cursor-pointer transition-colors ${useCustom?'bg-shift-50 border-l-2 border-l-shift-700':'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
              <td className="px-3 py-2.5 text-center"><input type="radio" checked={useCustom} onChange={onUseCustom} className="accent-shift-700"/></td>
              <td className="px-3 py-2.5" colSpan={5}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">任意のモデルを指定</span>
                  <input type="text" placeholder="例: meta-llama/llama-3.1-70b-instruct" value={customModel}
                    onChange={e=>{onCustomChange(e.target.value);onUseCustom()}} onClick={e=>e.stopPropagation()} className="input py-1 text-xs font-mono flex-1"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-shift-50 border-t border-shift-100 text-xs text-shift-700">
        選択中: <span className="font-mono font-semibold">{useCustom?customModel||'（未入力）':selectedId}</span>
      </div>
    </div>
  )
}

// ─── メインページ ───────────────────────────────────────────────
export default function SystemAnalysisPage({ params }: { params: { id: string } }) {
  const [testPhase, setTestPhase]   = useState<TestPhase>('システムテスト')
  const [showPhaseTooltip, setShowPhaseTooltip] = useState<TestPhase|null>(null)
  const [modelId, setModelId]       = useState(MODEL_OPTIONS[0]?.id||'')
  const [customModel, setCustomModel] = useState('')
  const [useCustom, setUseCustom]   = useState(false)
  const [adminModelList, setAdminModelList] = useState<CustomModelEntry[]>(MODEL_OPTIONS)
  const [ragTopK, setRagTopK]       = useState({ doc:80, site:30, src:60 })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [analysis, setAnalysis]     = useState<AnalysisResult|null>(null)
  const [loading, setLoading]       = useState(false)
  const [loadingCache, setLoadingCache] = useState(true)
  const [error, setError]           = useState('')
  const [ragBreakdown, setRagBreakdown] = useState<{doc:number;site:number;src:number}|null>(null)
  const [usedModel, setUsedModel]   = useState('')
  const [savedAt, setSavedAt]       = useState<string|null>(null)
  const [siteAnalysisCount, setSiteAnalysisCount] = useState(0)
  const [sourceCodeCount, setSourceCodeCount]     = useState(0)

  // キャッシュ読み込み（ページ初期表示時）
  useEffect(() => {
    fetch(`/api/system-analysis?projectId=${params.id}&testPhase=${encodeURIComponent(testPhase)}`)
      .then(r=>r.json())
      .then(data=>{
        if (data?.analysis) {
          setAnalysis(data.analysis as AnalysisResult)
          setRagBreakdown(data.ragBreakdown)
          setUsedModel(data.model)
          setSavedAt(data.updatedAt)
        }
      })
      .catch(()=>{})
      .finally(()=>setLoadingCache(false))

    fetch(`/api/site-analysis?projectId=${params.id}`)
      .then(r=>r.json()).then(d=>{ if(d?.pageCount) setSiteAnalysisCount(d.pageCount) }).catch(()=>{})
    fetch(`/api/documents?projectId=${params.id}`)
      .then(r=>r.json()).then((docs:Array<{category:string}>)=>{ if(Array.isArray(docs)) setSourceCodeCount(docs.filter(d=>d.category==='source_code').length) }).catch(()=>{})
    fetch('/api/admin/public-settings').then(r=>r.json()).then((s:{defaultPlanModelId?:string;customModelList?:CustomModelEntry[]})=>{
      const ml = (s.customModelList&&s.customModelList.length>0)?s.customModelList:MODEL_OPTIONS
      setAdminModelList(ml)
      if (s.defaultPlanModelId) { setModelId(s.defaultPlanModelId); setUseCustom(!ml.find(m=>m.id===s.defaultPlanModelId)) }
    }).catch(()=>{})
  }, [params.id])

  // テスト工程変更時にキャッシュ切り替え
  useEffect(() => {
    setAnalysis(null); setRagBreakdown(null); setUsedModel(''); setSavedAt(null); setLoadingCache(true)
    fetch(`/api/system-analysis?projectId=${params.id}&testPhase=${encodeURIComponent(testPhase)}`)
      .then(r=>r.json())
      .then(data=>{
        if (data?.analysis) {
          setAnalysis(data.analysis as AnalysisResult)
          setRagBreakdown(data.ragBreakdown); setUsedModel(data.model); setSavedAt(data.updatedAt)
        }
      }).catch(()=>{}).finally(()=>setLoadingCache(false))
  }, [testPhase, params.id])

  const getModel = () => useCustom?(customModel.trim()||modelId):modelId

  const runAnalysis = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/system-analysis', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ projectId:params.id, testPhase, modelOverride:getModel(), ragTopK }),
      })
      const data = await res.json()
      if (!res.ok||!data.ok) throw new Error(data.error||'分析に失敗しました')
      setAnalysis(data.analysis); setRagBreakdown(data.ragBreakdown); setUsedModel(data.model); setSavedAt(data.savedAt)
    } catch(e) {
      setError(e instanceof Error?e.message:'分析に失敗しました')
    } finally { setLoading(false) }
  }

  const clearResult = async () => {
    if (!confirm(`「${testPhase}」の分析結果を削除しますか？`)) return
    await fetch(`/api/system-analysis?projectId=${params.id}&testPhase=${encodeURIComponent(testPhase)}`, { method:'DELETE' }).catch(()=>{})
    setAnalysis(null); setRagBreakdown(null); setUsedModel(''); setSavedAt(null)
  }

  const ss  = analysis?.systemSummary
  const tp  = analysis?.testPolicy
  const qa  = analysis?.quantitativeAnalysis
  const dt  = analysis?.defectTendency

  const allocTotal = (tp?.categories??[]).reduce((s,c)=>s+c.allocation,0)||100
  const allocColors = ['bg-shift-700','bg-blue-500','bg-green-500','bg-amber-500','bg-purple-500','bg-pink-500','bg-indigo-500']

  return (
    <div className="max-w-4xl animate-fade-in space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="w-6 h-6 text-shift-700"/>システム分析</h1>
        <p className="text-sm text-gray-500 mt-0.5">取り込んだドキュメント・ソースコードをAIが多角的に解析。テスト工程別の方針・定量分析・リスク評価を生成します。結果はサーバーに保存され、リロード後も復元されます。</p>
      </div>

      {/* RAGデータ状況 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RAGデータ利用状況</p>
        <div className="space-y-2">
          {[
            { icon:FileText, label:'ドキュメント（要件定義書・設計書・ナレッジ）', available:true,                  note:'ドキュメント管理で確認' },
            { icon:Globe,    label:'URL構造分析',                                  available:siteAnalysisCount>0,    note:siteAnalysisCount>0?`${siteAnalysisCount}ページ`:'未実施（任意）' },
            { icon:Code2,    label:'ソースコード',                                  available:sourceCodeCount>0,      note:sourceCodeCount>0?`${sourceCodeCount}件`:'未取込（任意）' },
          ].map(({icon:Icon,label,available,note})=>(
            <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Icon className={`w-4 h-4 flex-shrink-0 ${available?'text-green-600':'text-gray-300'}`}/>
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* テスト工程選択 */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-shift-700"/>テスト工程
          <span className="text-xs font-normal text-gray-400">（工程ごとに分析・保存されます）</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
          {TEST_PHASES.map(phase=>(
            <div key={phase} className="relative">
              <button onClick={()=>setTestPhase(phase)}
                onMouseEnter={()=>setShowPhaseTooltip(phase)} onMouseLeave={()=>setShowPhaseTooltip(null)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${testPhase===phase?'border-shift-700 bg-shift-50 text-shift-800':'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                {testPhase===phase?'✓ ':''}{phase}
              </button>
              {showPhaseTooltip===phase&&(
                <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none leading-relaxed">
                  <p className="font-semibold mb-1">{phase}</p>
                  <p className="text-gray-300">{TEST_PHASE_DESCRIPTIONS[phase]}</p>
                  <p className="mt-1.5 text-gray-400">推奨観点: {TEST_PHASE_PERSPECTIVES[phase].join('・')}</p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"/>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">選択中: <span className="font-semibold text-shift-700">{testPhase}</span> — {TEST_PHASE_DESCRIPTIONS[testPhase]}</p>
      </div>

      {/* モデル選択 */}
      <ModelSelector selectedId={modelId} customModel={customModel} useCustom={useCustom}
        onSelect={id=>{setModelId(id);setUseCustom(false)}} onCustomChange={setCustomModel} onUseCustom={()=>setUseCustom(true)} models={adminModelList}/>

      {/* 詳細設定 */}
      <div className="card">
        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={()=>setShowAdvanced(!showAdvanced)}>
          <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-gray-500"/><span className="font-semibold text-gray-900 text-sm">RAG詳細設定</span></div>
          {showAdvanced?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
        </button>
        {showAdvanced&&(
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">各情報ソースから取得するチャンク数（多いほど精度向上・処理時間増加）</p>
            {[{label:'📄 ドキュメント',key:'doc' as const,max:200},{label:'🌐 サイト構造',key:'site' as const,max:100},{label:'💻 ソースコード',key:'src' as const,max:200}].map(({label,key,max})=>(
              <div key={key} className="flex items-center gap-3">
                <span className="w-28 text-xs text-gray-600 flex-shrink-0">{label}</span>
                <input type="range" min={0} max={max} step={10} value={ragTopK[key]} onChange={e=>setRagTopK(prev=>({...prev,[key]:Number(e.target.value)}))} className="flex-1 accent-shift-700"/>
                <input type="number" min={0} max={max} value={ragTopK[key]} onChange={e=>setRagTopK(prev=>({...prev,[key]:Number(e.target.value)}))} className="input py-1 w-16 text-xs text-right"/>
                <span className="text-xs text-gray-400">件</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error&&(
        <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
          <div><p className="text-sm font-semibold text-red-800">分析に失敗しました</p><p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{error}</p></div>
        </div>
      )}

      {/* 実行ボタン */}
      <button disabled={loading} onClick={runAnalysis} className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60">
        {loading?<><Loader2 className="w-5 h-5 animate-spin"/>AIがシステムを分析中（temperature=0・決定論的推論）...</>
               :<><BarChart2 className="w-5 h-5"/>「{testPhase}」の詳細システム分析レポートを生成する</>}
      </button>
      {loading&&(
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center gap-3 text-shift-700">
            <Loader2 className="w-5 h-5 animate-spin"/>
            <div><p className="font-semibold text-sm">ドキュメント・ソースコードを多角的に分析中...</p><p className="text-xs text-gray-500 mt-0.5">複数クエリでRAG検索 → システム特性解析 → 定量的指標算出（30〜60秒程度）</p></div>
          </div>
        </div>
      )}

      {/* キャッシュ読み込み中 */}
      {loadingCache&&!analysis&&(
        <div className="card p-4 flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin"/><span className="text-sm">保存済み分析結果を読み込み中...</span>
        </div>
      )}

      {/* ─── 分析結果 ─── */}
      {analysis&&(
        <div className="space-y-5 animate-fade-in">
          {/* メタ情報バー */}
          <div className="card p-3 flex items-center gap-3 flex-wrap text-xs text-gray-500">
            {savedAt&&<span className="flex items-center gap-1 bg-green-50 text-green-700 rounded-full px-3 py-1"><Clock className="w-3.5 h-3.5"/>保存済み: {new Date(savedAt).toLocaleString('ja-JP')}</span>}
            {usedModel&&<span className="bg-gray-100 rounded-full px-3 py-1 font-mono">🤖 {usedModel}</span>}
            {ragBreakdown&&<span className="bg-gray-100 rounded-full px-3 py-1">📚 RAG: Doc={ragBreakdown.doc} / Site={ragBreakdown.site} / Src={ragBreakdown.src}</span>}
            <div className="ml-auto flex gap-2">
              <button onClick={runAnalysis} disabled={loading} className="flex items-center gap-1 text-shift-600 hover:underline disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5"/>再分析</button>
              <button onClick={clearResult} className="flex items-center gap-1 text-red-400 hover:underline"><Trash2 className="w-3.5 h-3.5"/>削除</button>
            </div>
          </div>

          {/* エグゼクティブサマリー */}
          {analysis.executiveSummary&&(
            <div className="card p-5 bg-shift-50 border border-shift-200">
              <div className="flex items-center gap-2 mb-2"><BookOpen className="w-4 h-4 text-shift-700"/><p className="text-xs font-semibold text-shift-700 uppercase tracking-wide">エグゼクティブサマリー（経営層・顧客向け）</p></div>
              <p className="text-sm text-shift-900 leading-relaxed">{analysis.executiveSummary}</p>
            </div>
          )}

          {/* 1. システム特性サマリー */}
          {ss&&(
            <Section title="1. システム特性の要約と分析" icon={Cpu}>
              <div className="space-y-5">
                <p className="text-sm text-gray-700 leading-relaxed">{ss.overview}</p>

                {/* 技術スタック */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">技術スタック</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    {[
                      ['フロントエンド', ss.techStack?.frontend],
                      ['バックエンド',   ss.techStack?.backend],
                      ['データベース',   ss.techStack?.database],
                      ['インフラ',       ss.techStack?.infrastructure],
                      ['外部API連携',    ss.techStack?.externalApis],
                    ].filter(([,v])=>v).map(([label,value])=>(
                      <div key={label as string} className="flex gap-2 py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
                        <span className="text-xs font-medium text-gray-800">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">{ss.architecture}</p>
                </div>

                {/* 規模感 */}
                {ss.scale&&(
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">規模推定値（算出根拠付き）</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {[
                        { label:'推定LOC', value:ss.scale.estimatedLoc?.toLocaleString()??'-', unit:'行', basis:ss.scale.locBasis },
                        { label:'画面数',  value:String(ss.scale.screenCount??'-'),             unit:'画面', basis:ss.scale.screenBasis },
                        { label:'API数',   value:String(ss.scale.apiEndpointCount??'-'),        unit:'EP', basis:ss.scale.apiBasis },
                        { label:'テーブル数', value:String(ss.scale.tableCount??'-'),           unit:'表', basis:ss.scale.tableBasis },
                      ].map(({label,value,unit,basis})=>(
                        <div key={label} className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="text-xl font-bold text-shift-700 mt-0.5">{value}<span className="text-xs text-gray-400 ml-1">{unit}</span></p>
                          {basis&&<p className="text-xs text-gray-400 mt-1 leading-relaxed">{basis}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 品質属性 */}
                {ss.qualityAttributes&&(
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label:'リアルタイム性', level:ss.qualityAttributes.realtimeRequirement, basis:ss.qualityAttributes.realtimeBasis, icon:Zap },
                      { label:'セキュリティ',   level:ss.qualityAttributes.securityLevel,        basis:ss.qualityAttributes.securityBasis,   icon:Shield },
                      { label:'スケーラビリティ', level:ss.qualityAttributes.scalability,         basis:ss.qualityAttributes.scalabilityBasis, icon:TrendingUp },
                      { label:'可用性',          level:ss.qualityAttributes.availability,         basis:ss.qualityAttributes.availabilityBasis, icon:Activity },
                    ].map(({label,level,basis,icon:Icon})=>(
                      <div key={label} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 text-sm text-gray-700"><Icon className="w-3.5 h-3.5 text-gray-400"/>{label}</span>
                          <LevelBadge level={level}/>
                        </div>
                        {basis&&<p className="text-xs text-gray-500 leading-relaxed">{basis}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 複雑度 */}
                {ss.complexityAnalysis&&(
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500">複雑度スコア</p>
                      <span className="text-xs text-gray-400">(10点満点)</span>
                    </div>
                    <ScoreBar score={ss.complexityAnalysis.score}/>
                    <p className="text-xs text-gray-500 mt-2">{ss.complexityAnalysis.basis}</p>
                    {ss.complexityAnalysis.cyclomaticEstimate&&<p className="text-xs text-gray-400 mt-1">循環的複雑度: {ss.complexityAnalysis.cyclomaticEstimate}</p>}
                    {ss.complexityAnalysis.nestingDepth&&<p className="text-xs text-gray-400">ネスト深さ: {ss.complexityAnalysis.nestingDepth}</p>}
                  </div>
                )}

                <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                  <span className="text-sm text-gray-600">総合リスクレベル:</span>
                  <LevelBadge level={ss.riskLevel}/>
                  {ss.riskBasis&&<p className="text-xs text-gray-500 flex-1">{ss.riskBasis}</p>}
                </div>
              </div>
            </Section>
          )}

          {/* 2. 推奨テスト方針 */}
          {tp&&(
            <Section title="2. 推奨テスト方針" icon={ClipboardList}>
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-shift-100 text-shift-700 px-3 py-1 rounded-full font-semibold">{tp.testPhase}</span>
                </div>

                {tp.phaseObjective&&(
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">テスト目標（JSTQB/ISTQB基準）</p>
                    <p className="text-sm text-blue-800">{tp.phaseObjective}</p>
                  </div>
                )}
                <p className="text-sm text-gray-700 leading-relaxed">{tp.phaseDescription}</p>

                {/* 開始/終了基準 */}
                {tp.entryExitCriteria&&(
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[{title:'開始基準 (Entry Criteria)',items:tp.entryExitCriteria.entry,color:'green'},{title:'終了基準 (Exit Criteria)',items:tp.entryExitCriteria.exit,color:'blue'}].map(({title,items,color})=>(
                      <div key={title} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
                        <p className={`text-xs font-semibold text-${color}-700 mb-2`}>{title}</p>
                        <ul className="space-y-1">{(items??[]).map((item,i)=><li key={i} className={`text-xs text-${color}-800 flex items-start gap-1.5`}><span className="mt-0.5 flex-shrink-0">•</span>{item}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* 重点エリア */}
                {tp.focusAreas?.length>0&&(
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3">重点テストエリア</p>
                    <div className="space-y-2">
                      {tp.focusAreas.map((fa,i)=>(
                        <div key={i} className="bg-shift-50 border border-shift-100 rounded-xl p-4">
                          <p className="text-sm font-semibold text-shift-800 mb-1">{fa.area}</p>
                          <p className="text-xs text-shift-700 mb-1">{fa.reason}</p>
                          {fa.testApproach&&<p className="text-xs text-gray-500">アプローチ: {fa.testApproach}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* テスト分類配分 */}
                {tp.categories?.length>0&&(
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3">テスト分類別 重点配分</p>
                    <div className="space-y-3">
                      <div className="flex h-7 rounded-xl overflow-hidden gap-px">
                        {tp.categories.map((cat,i)=>(
                          <div key={i} className={`${allocColors[i%allocColors.length]} transition-all duration-700`}
                            style={{width:`${(cat.allocation/allocTotal)*100}%`}} title={`${cat.name}: ${cat.allocation}%`}/>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tp.categories.map((cat,i)=>(
                          <div key={i} className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${allocColors[i%allocColors.length]}`}/>
                            <span className="text-xs text-gray-600">{cat.name} {cat.allocation}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      {tp.categories.map((cat,i)=>(
                        <div key={i} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                          <div className="flex items-start gap-3">
                            <LevelBadge level={cat.priority}/>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                                <span className="text-xs text-gray-400 font-mono">{cat.allocation}%</span>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">{cat.reason}</p>
                              {cat.keyTestPoints?.length>0&&(
                                <div className="flex flex-wrap gap-1.5">
                                  {cat.keyTestPoints.map((pt,j)=><span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">• {pt}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* テスト観点 */}
                {tp.perspectives?.length>0&&(
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3">テスト観点 優先順位</p>
                    <div className="space-y-2">
                      {tp.perspectives.map((p,i)=>(
                        <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                          <LevelBadge level={p.priority}/>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                            {p.targetAreas?.length>0&&<p className="text-xs text-gray-400 mt-1">対象: {p.targetAreas.join(' / ')}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 自動化推奨 */}
                {tp.automationRecommendation&&(
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-3">自動化推奨</p>
                    <div className="flex items-center gap-6 mb-2">
                      <div className="text-center"><p className="text-2xl font-bold text-green-600">{tp.automationRecommendation.automatable}<span className="text-xs text-gray-400 ml-1">件</span></p><p className="text-xs text-gray-500">自動化推奨</p></div>
                      <div className="text-center"><p className="text-2xl font-bold text-amber-600">{tp.automationRecommendation.manual}<span className="text-xs text-gray-400 ml-1">件</span></p><p className="text-xs text-gray-500">手動テスト</p></div>
                    </div>
                    {tp.automationRecommendation.automatableBasis&&<p className="text-xs text-gray-500">{tp.automationRecommendation.automatableBasis}</p>}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 3. 定量的テスト分析 */}
          {qa&&(
            <Section title="3. 定量的テスト分析" icon={BarChart2}>
              <div className="space-y-5">
                {qa.calculationBasis&&<div className="bg-blue-50 border border-blue-100 rounded-xl p-3"><p className="text-xs font-semibold text-blue-700 mb-1">算出ロジック・前提条件</p><p className="text-xs text-blue-800">{qa.calculationBasis}</p></div>}

                {/* 内訳テーブル */}
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-28">対象領域</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">分析指標</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-20">複雑度</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-24">推奨TC数</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">算出式・根拠</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        {icon:Globe,    label:'フロントエンド',  data:qa.frontend},
                        {icon:Cpu,      label:'バックエンドAPI', data:qa.backendApi},
                        {icon:Database, label:'データベース',    data:qa.database},
                        {icon:Zap,      label:'外部連携',        data:qa.integration},
                      ].map(({icon:Icon,label,data})=>(
                        <tr key={label} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><div className="flex items-center gap-1.5"><Icon className="w-4 h-4 text-gray-400"/><span className="font-medium text-gray-800 text-xs">{label}</span></div></td>
                          <td className="px-4 py-3 text-xs text-gray-600">{data?.metric}</td>
                          <td className="px-4 py-3 text-center"><LevelBadge level={data?.complexity||'medium'}/></td>
                          <td className="px-4 py-3 text-right"><span className="font-bold text-shift-700 text-lg">{(data?.recommendedCases??0).toLocaleString()}</span><span className="text-xs text-gray-400 ml-1">件</span></td>
                          <td className="px-4 py-3 text-xs text-gray-500"><p className="font-mono text-gray-600 mb-1">{data?.caseBreakdown}</p><p>{data?.basis}</p></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="bg-shift-50 border-t-2 border-shift-200">
                      <td colSpan={3} className="px-4 py-3 font-bold text-shift-800 text-sm">合計推奨テストケース数</td>
                      <td className="px-4 py-3 text-right"><span className="font-bold text-shift-700 text-2xl">{(qa.totalRecommendedCases??0).toLocaleString()}</span><span className="text-sm text-shift-600 ml-1">件</span></td>
                      <td className="px-4 py-3"/>
                    </tr></tfoot>
                  </table>
                </div>

                {/* カバレッジ内訳 */}
                {qa.coverageBreakdown&&(
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-3">テスト観点別カバレッジ内訳</p>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {[
                        {label:'正常系',  value:qa.coverageBreakdown.normal,      color:'text-green-600'},
                        {label:'異常系',  value:qa.coverageBreakdown.abnormal,    color:'text-red-600'},
                        {label:'境界値',  value:qa.coverageBreakdown.boundary,    color:'text-amber-600'},
                        {label:'セキュリティ', value:qa.coverageBreakdown.security, color:'text-purple-600'},
                        {label:'性能',    value:qa.coverageBreakdown.performance, color:'text-blue-600'},
                      ].map(({label,value,color})=>(
                        <div key={label} className="bg-white rounded-lg p-2 border border-gray-100">
                          <p className={`text-xl font-bold ${color}`}>{value??0}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 工数・体制 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-amber-600"/><p className="text-xs font-semibold text-amber-700">推定テスト工数</p></div>
                    <p className="text-3xl font-bold text-amber-700">{qa.estimatedEffortDays}<span className="text-sm text-amber-600 ml-1">人日</span></p>
                    {qa.effortBreakdown&&(
                      <div className="mt-2 space-y-0.5 text-xs text-amber-700">
                        <p>設計: {qa.effortBreakdown.design}人日</p>
                        <p>実行: {qa.effortBreakdown.execution}人日</p>
                        <p>バグ票: {qa.effortBreakdown.bugReport}人日</p>
                        <p>回帰: {qa.effortBreakdown.regression}人日</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-blue-600"/><p className="text-xs font-semibold text-blue-700">推奨体制</p></div>
                    <p className="text-3xl font-bold text-blue-700">{qa.teamSizeRecommendation}<span className="text-sm text-blue-600 ml-1">名</span></p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-green-600"/><p className="text-xs font-semibold text-green-700">推奨スケジュール</p></div>
                    <p className="text-3xl font-bold text-green-700">{qa.scheduleSuggestionDays}<span className="text-sm text-green-600 ml-1">日</span></p>
                  </div>
                </div>
                {qa.effortBasis&&<div className="bg-gray-50 rounded-xl p-3"><p className="text-xs font-semibold text-gray-500 mb-1">工数算出根拠</p><p className="text-xs text-gray-600">{qa.effortBasis}</p></div>}
              </div>
            </Section>
          )}

          {/* 4. リスク分析 */}
          {analysis.riskAnalysis?.length>0&&(
            <Section title="4. リスク分析" icon={AlertTriangle}>
              <div className="space-y-3">
                {analysis.riskAnalysis.map((risk,i)=>(
                  <div key={i} className={`rounded-xl border p-4 ${risk.level==='high'?'border-red-200 bg-red-50':risk.level==='medium'?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <LevelBadge level={risk.level}/>
                        {risk.category&&<span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{risk.category}</span>}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-semibold text-gray-900">{risk.area}</p>
                        <p className="text-xs text-gray-700">{risk.description}</p>
                        {risk.impact&&<div className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"/><p className="text-xs text-red-700">影響: {risk.impact}</p></div>}
                        {risk.probability&&<p className="text-xs text-gray-500">発生可能性: <span className="font-medium">{risk.probability}</span>{risk.probabilityBasis&&` — ${risk.probabilityBasis}`}</p>}
                        <div className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5"/><p className="text-xs text-gray-700">{risk.recommendation}</p></div>
                        {risk.testTechnique&&<p className="text-xs text-shift-700 bg-shift-50 px-2 py-1 rounded">適用技法: {risk.testTechnique}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 5. 不具合傾向分析 */}
          {dt&&(
            <Section title="5. 不具合傾向・高リスクモジュール" icon={Activity}>
              <div className="space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">{dt.analysis}</p>
                {dt.highRiskModules?.length>0&&(
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">高リスクモジュール</p>
                    <div className="flex flex-wrap gap-2">
                      {dt.highRiskModules.map((m,i)=><span key={i} className="text-xs bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-full font-medium">⚠️ {m}</span>)}
                    </div>
                  </div>
                )}
                {dt.recommendedChecklists?.length>0&&(
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">推奨チェックリスト</p>
                    <div className="space-y-1">
                      {dt.recommendedChecklists.map((cl,i)=><div key={i} className="flex items-center gap-2 text-xs text-gray-600"><CheckCircle2 className="w-3.5 h-3.5 text-shift-600 flex-shrink-0"/>{cl}</div>)}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 6. 重要な洞察 */}
          {analysis.keyInsights?.length>0&&(
            <Section title="6. 重要な洞察" icon={Lightbulb}>
              <div className="space-y-3">
                {analysis.keyInsights.map((ins,i)=>(
                  <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-900 mb-1">💡 {typeof ins==='string'?ins:ins.title}</p>
                    {typeof ins!=='string'&&ins.detail&&<p className="text-xs text-amber-800 leading-relaxed mb-1">{ins.detail}</p>}
                    {typeof ins!=='string'&&ins.action&&<div className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5"/><p className="text-xs text-amber-700 font-medium">{ins.action}</p></div>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
