'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, Settings,
  ChevronDown, ChevronUp, Loader2, Globe, FileText, Code2,
  ClipboardList, Play, Edit3, Trash2, Plus, ChevronRight, RotateCcw, AlertTriangle, X, Save
} from 'lucide-react'
import type { SiteAnalysis, TestPlan, TestPlanBatch, CustomModelEntry } from '@/types'
import { TEST_PHASE_DESCRIPTIONS, TEST_PHASE_PERSPECTIVES } from '@/types'
import type { TestPhase } from '@/types'

const TEST_PHASES: TestPhase[] = [
  '単体テスト','結合テスト','システムテスト','受入テスト','回帰テスト','パフォーマンステスト','セキュリティテスト',
]

const ALL_PERSPECTIVES = ['機能テスト','正常系','異常系','境界値','セキュリティ','操作性','性能']
const PERSPECTIVE_OPTIONS = ALL_PERSPECTIVES.map(v => ({ label: v, value: v }))

// モデル一覧は管理者設定から動的に取得する。フォールバック用デフォルト値。
const MODEL_OPTIONS: CustomModelEntry[] = [
  { id:'deepseek/deepseek-v3.2',           label:'DeepSeek V3.2',          inputCost:'$0.20', outputCost:'$0.35',  feature:'最安クラス。出力量が多いならこれ一択',  speed:'高速' },
  { id:'google/gemini-2.5-flash',          label:'Gemini 2.5 Flash',        inputCost:'$0.15', outputCost:'$0.60',  feature:'最新Gemini。高精度かつ爆速',          speed:'爆速' },
  { id:'google/gemini-3-flash-preview',    label:'Gemini 3 Flash Preview',  inputCost:'$0.10', outputCost:'$0.40',  feature:'Gemini最新プレビュー。爆速で大量生成', speed:'爆速' },
  { id:'openai/gpt-5-nano',               label:'GPT-5 Nano',              inputCost:'$0.05', outputCost:'$0.20',  feature:'最も安価なGPT。軽量タスクに最適',     speed:'爆速' },
  { id:'openai/gpt-5.2',                  label:'GPT-5.2',                 inputCost:'$1.75', outputCost:'$14.00', feature:'非常に高精度。複雑なロジックの網羅に強い', speed:'標準' },
  { id:'anthropic/claude-sonnet-4.6',     label:'Claude Sonnet 4.6',       inputCost:'$3.00', outputCost:'$15.00', feature:'Anthropic最新。論理的な分析に最強',    speed:'標準' },
  { id:'meta-llama/llama-3.3-70b-instruct',label:'Llama 3.3 70B',          inputCost:'$0.12', outputCost:'$0.30',  feature:'Meta製OSS。コスパ良好',               speed:'高速' },
  { id:'deepseek/deepseek-r1-0528:free',  label:'DeepSeek R1 (free)',       inputCost:'無料',  outputCost:'無料',   feature:'OpenRouterの無料枠。お試しに最適',    speed:'高速', isFree:true },
]
const SPEED_COLOR: Record<string,string> = { '爆速':'text-green-600 bg-green-50', '高速':'text-blue-600 bg-blue-50', '標準':'text-gray-600 bg-gray-100' }

function ModelSelector({ selectedId, customModel, useCustom, onSelect, onCustomChange, onUseCustom, label, models }: {
  selectedId:string; customModel:string; useCustom:boolean
  onSelect:(id:string)=>void; onCustomChange:(v:string)=>void; onUseCustom:()=>void; label:string
  models: CustomModelEntry[]
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
            {models.map(m => (
              <tr key={m.id} onClick={()=>onSelect(m.id)}
                className={`cursor-pointer transition-colors ${!useCustom&&selectedId===m.id?'bg-shift-50 border-l-2 border-l-shift-700':'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
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
                    onChange={e=>{onCustomChange(e.target.value);onUseCustom()}}
                    onClick={e=>e.stopPropagation()} className="input py-1 text-xs font-mono flex-1"/>
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

// ─── プランエディタ ───────────────────────────────────────────────
function PlanEditor({ plan, onSave, onClose }: { plan:TestPlan; onSave:(u:TestPlan)=>void; onClose:()=>void }) {
  const [batches, setBatches] = useState<TestPlanBatch[]>(plan.batches.map(b=>({...b,titles:[...b.titles]})))
  const [openBatch, setOpenBatch] = useState<number|null>(0)
  const [editingBatch, setEditingBatch] = useState<number|null>(null)
  const [batchCat, setBatchCat] = useState('')
  const [batchPersp, setBatchPersp] = useState('')
  const [editingTitle, setEditingTitle] = useState<{bi:number;ti:number}|null>(null)
  const [titleInput, setTitleInput] = useState('')
  const [showAddBatch, setShowAddBatch] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newPersp, setNewPersp] = useState('')

  const total = batches.reduce((s,b)=>s+b.titles.length,0)

  const saveTitle = () => {
    if (!editingTitle) return
    setBatches(prev=>prev.map((b,i)=>i===editingTitle.bi?{...b,titles:b.titles.map((t,j)=>j===editingTitle.ti?titleInput:t)}:b))
    setEditingTitle(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">テストプランの編集</h2>
            <p className="text-sm text-gray-500 mt-0.5">合計 <strong>{total}</strong> 件 / {batches.length} バッチ
              <span className="text-xs text-gray-400 ml-2">（親項目＝バッチ、子項目＝テストタイトル）</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">キャンセル</button>
            <button onClick={()=>onSave({...plan,batches:batches.map(b=>({...b,count:b.titles.length})),totalItems:total})} className="btn-primary">
              <Save className="w-4 h-4"/>保存
            </button>
          </div>
        </div>
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          {batches.map((batch,bIdx)=>(
            <div key={bIdx} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center bg-gray-50 px-4 py-3 gap-2">
                <button onClick={()=>setOpenBatch(openBatch===bIdx?null:bIdx)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                  {openBatch===bIdx?<ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0"/>:<ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0"/>}
                  <span className="text-xs text-gray-400 font-mono flex-shrink-0">Batch {batch.batchId}</span>
                  {editingBatch===bIdx?(
                    <div className="flex items-center gap-2 flex-1" onClick={e=>e.stopPropagation()}>
                      <input value={batchCat} onChange={e=>setBatchCat(e.target.value)} className="input py-1 text-sm flex-1 min-w-0" placeholder="大分類"/>
                      <input value={batchPersp} onChange={e=>setBatchPersp(e.target.value)} className="input py-1 text-sm w-32" placeholder="テスト観点"/>
                      <button onClick={()=>{setBatches(prev=>prev.map((b,i)=>i===bIdx?{...b,category:batchCat,perspective:batchPersp}:b));setEditingBatch(null)}} className="btn-primary py-1 text-xs flex-shrink-0"><Save className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>setEditingBatch(null)} className="btn-secondary py-1 text-xs flex-shrink-0"><X className="w-3.5 h-3.5"/></button>
                    </div>
                  ):(
                    <>
                      <span className="font-semibold text-gray-800 truncate">{batch.category}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">{batch.perspective}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{batch.titles.length}件</span>
                    </>
                  )}
                </button>
                {editingBatch!==bIdx&&(
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={()=>{setBatchCat(batch.category);setBatchPersp(batch.perspective);setEditingBatch(bIdx)}} className="text-gray-400 hover:text-shift-600 p-1.5 rounded-lg hover:bg-gray-100" title="編集"><Edit3 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>{setBatches(prev=>prev.filter((_,i)=>i!==bIdx).map((b,i)=>({...b,batchId:i+1})));if(openBatch===bIdx)setOpenBatch(null)}} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50" title="削除"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                )}
              </div>
              {openBatch===bIdx&&(
                <div className="p-4 space-y-1.5">
                  {batch.titles.length===0&&<p className="text-xs text-gray-400 text-center py-2">テスト項目がありません。追加してください。</p>}
                  {batch.titles.map((title,tIdx)=>(
                    <div key={tIdx} className="group">
                      {editingTitle?.bi===bIdx&&editingTitle?.ti===tIdx?(
                        <div className="flex gap-2">
                          <input value={titleInput} onChange={e=>setTitleInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveTitle()} className="input flex-1 text-sm py-1.5" autoFocus/>
                          <button onClick={saveTitle} className="btn-primary py-1.5 text-xs">保存</button>
                          <button onClick={()=>setEditingTitle(null)} className="btn-secondary py-1.5 text-xs">×</button>
                        </div>
                      ):(
                        <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                          <span className="text-xs text-gray-400 font-mono mt-0.5 w-6 flex-shrink-0">{tIdx+1}.</span>
                          <span className="text-sm text-gray-700 flex-1 leading-relaxed">{title}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                            <button onClick={()=>{setEditingTitle({bi:bIdx,ti:tIdx});setTitleInput(title)}} className="text-gray-400 hover:text-shift-600 p-1 rounded"><Edit3 className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>setBatches(prev=>prev.map((b,i)=>i===bIdx?{...b,titles:b.titles.filter((_,j)=>j!==tIdx)}:b))} className="text-gray-400 hover:text-red-500 p-1 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={()=>{
                    const t=`新しいテスト項目 ${batch.titles.length+1}`
                    setBatches(prev=>prev.map((b,i)=>i===bIdx?{...b,titles:[...b.titles,t]}:b))
                    setEditingTitle({bi:bIdx,ti:batch.titles.length});setTitleInput(t)
                  }} className="flex items-center gap-1.5 text-xs text-shift-600 hover:text-shift-800 mt-2 px-2 py-1.5 rounded-lg hover:bg-shift-50 transition-colors">
                    <Plus className="w-3.5 h-3.5"/>テスト項目（子）を追加
                  </button>
                </div>
              )}
            </div>
          ))}
          {showAddBatch?(
            <div className="border-2 border-dashed border-shift-300 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">新しいバッチ（親項目）を追加</p>
              <div className="flex gap-3">
                <input value={newCat} onChange={e=>setNewCat(e.target.value)} className="input flex-1 text-sm" placeholder="大分類（例: ログイン・認証）"/>
                <select value={newPersp} onChange={e=>setNewPersp(e.target.value)} className="input text-sm w-40">
                  <option value="">テスト観点を選択</option>
                  {ALL_PERSPECTIVES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{
                  if(!newCat.trim())return
                  setBatches(prev=>[...prev,{batchId:prev.length+1,category:newCat.trim(),perspective:newPersp||'機能テスト',titles:[],count:0}])
                  setOpenBatch(batches.length);setNewCat('');setNewPersp('');setShowAddBatch(false)
                }} disabled={!newCat.trim()} className="btn-primary text-sm py-1.5 disabled:opacity-50">
                  <Plus className="w-4 h-4"/>追加
                </button>
                <button onClick={()=>setShowAddBatch(false)} className="btn-secondary text-sm py-1.5">キャンセル</button>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowAddBatch(true)} className="w-full flex items-center justify-center gap-2 text-sm text-shift-600 hover:text-shift-800 border-2 border-dashed border-gray-200 hover:border-shift-300 rounded-xl py-3 transition-colors">
              <Plus className="w-4 h-4"/>バッチ（親項目）を追加
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GeneratePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysis|null>(null)
  const [sourceCodeCount, setSourceCodeCount] = useState(0)
  const [sourceCodeChunks, setSourceCodeChunks] = useState(0)
  const [step, setStep] = useState<'plan'|'execute'>('plan')

  const [testPhase, setTestPhase] = useState<TestPhase>('システムテスト')
  const [showPhaseTooltip, setShowPhaseTooltip] = useState<TestPhase|null>(null)

  const [totalItems, setTotalItems] = useState(100)
  const [batchSize, setBatchSize] = useState(50)
  const [planModelId, setPlanModelId] = useState(MODEL_OPTIONS.find(m=>m.isDefault)!.id)
  const [planCustomModel, setPlanCustomModel] = useState('')
  const [usePlanCustom, setUsePlanCustom] = useState(false)
  const [perspectiveMode, setPerspectiveMode] = useState<'ai'|'weighted'>('ai')
  const [selectedPerspectives, setSelectedPerspectives] = useState<Set<string>>(new Set(TEST_PHASE_PERSPECTIVES['システムテスト']))
  const [perspectiveWeights, setPerspectiveWeights] = useState<Record<string,number>>({'機能テスト':30,'正常系':20,'異常系':20,'境界値':10,'セキュリティ':10,'操作性':10})
  const [ragTopK, setRagTopK] = useState({doc:80,site:30,src:50})
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [execModelId, setExecModelId] = useState(MODEL_OPTIONS.find(m=>m.isDefault)!.id)
  const [execCustomModel, setExecCustomModel] = useState('')
  const [useExecCustom, setUseExecCustom] = useState(false)
  const [execRagTopK, setExecRagTopK] = useState({doc:100,site:40,src:100})
  // 管理者設定から取得したモデル一覧
  const [adminModelList, setAdminModelList] = useState<CustomModelEntry[]>(DEFAULT_MODEL_OPTIONS)
  // バッチごとのabort警告メッセージ
  const [abortWarnings, setAbortWarnings] = useState<string[]>([])

  const [plan, setPlan] = useState<TestPlan|null>(null)
  const [showPlanEditor, setShowPlanEditor] = useState(false)

  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')

  const [executing, setExecuting] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [totalGenerated, setTotalGenerated] = useState(0)
  const [execError, setExecError] = useState('')
  const [execDone, setExecDone] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const [currentBatchLabel, setCurrentBatchLabel] = useState('')

  useEffect(()=>{
    fetch(`/api/site-analysis?projectId=${params.id}`).then(r=>r.json()).then(d=>{if(d?.id)setSiteAnalysis(d)}).catch(()=>{})
    fetch(`/api/documents?projectId=${params.id}`).then(r=>r.json()).then((docs:Array<{category:string;chunkCount?:number}>)=>{
      if(!Array.isArray(docs))return
      const src=docs.filter(d=>d.category==='source_code')
      setSourceCodeCount(src.length);setSourceCodeChunks(src.reduce((s,d)=>s+(d.chunkCount??0),0))
    }).catch(()=>{})
    fetch(`/api/generate/plan?projectId=${params.id}`).then(r=>r.json()).then(p=>{
      if(p?.id){setPlan(p);setStep('execute')}
    }).catch(()=>{})
    // AdminSettings からデフォルトモデルを取得
    fetch('/api/admin/public-settings').then(r=>r.json()).then((s:{
      defaultPlanModelId?:string; defaultExecModelId?:string; labelGenerateButton?:string
      customModelList?: CustomModelEntry[]; defaultBatchSize?: number
    })=>{
      // モデルリストを管理者設定から上書き（空なら DEFAULT_MODEL_OPTIONS を維持）
      if(s.customModelList && s.customModelList.length > 0) setAdminModelList(s.customModelList)
      // バッチサイズ初期値を適用
      if(s.defaultBatchSize) setBatchSize(s.defaultBatchSize)
      const modelList = (s.customModelList && s.customModelList.length > 0) ? s.customModelList : DEFAULT_MODEL_OPTIONS
      if(s.defaultPlanModelId) { setPlanModelId(s.defaultPlanModelId); setUsePlanCustom(!modelList.find(m=>m.id===s.defaultPlanModelId)) }
      if(s.defaultExecModelId) { setExecModelId(s.defaultExecModelId); setUseExecCustom(!modelList.find(m=>m.id===s.defaultExecModelId)) }
    }).catch(()=>{})
  },[params.id])

  const handlePhaseChange=(phase:TestPhase)=>{
    setTestPhase(phase)
    setSelectedPerspectives(new Set(TEST_PHASE_PERSPECTIVES[phase]))
  }

  const getPlanModel=()=>usePlanCustom?(planCustomModel.trim()||planModelId):planModelId
  const getExecModel=()=>useExecCustom?(execCustomModel.trim()||execModelId):execModelId

  const runPlanning=async()=>{
    setPlanning(true);setPlanError('');setPlan(null)
    try {
      const weights=perspectiveMode==='weighted'
        ?Array.from(selectedPerspectives).filter(p=>(perspectiveWeights[p]??0)>0).map(p=>({value:p,count:perspectiveWeights[p]}))
        :undefined
      const res=await fetch('/api/generate/plan',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId:params.id,totalItems,batchSize,
          perspectives:perspectiveMode==='ai'?Array.from(selectedPerspectives):undefined,
          perspectiveWeights:weights,modelOverride:getPlanModel(),ragTopK,testPhase}),
      })
      const data=await res.json()
      if(!res.ok||!data.ok)throw new Error(data.error||'プランニングに失敗しました')
      setPlan(data.plan);setStep('execute')
    }catch(e){setPlanError(e instanceof Error?e.message:'プランニングに失敗しました')}
    finally{setPlanning(false)}
  }

  const savePlan=async(updated:TestPlan)=>{
    await fetch('/api/generate/plan',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:updated})})
    setPlan(updated);setShowPlanEditor(false)
  }

  const runExecution=async()=>{
    if(!plan)return
    setExecuting(true);setExecError('');setExecDone(false);setTotalGenerated(0);setCurrentBatch(0);setIsPartial(false);setAbortWarnings([])
    try {
      const startRes=await fetch('/api/generate/start',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId:params.id,maxItems:plan.totalItems,modelOverride:getExecModel()}),
      })
      const startData=await startRes.json()
      if(!startData.jobId)throw new Error(startData.error||'ジョブ開始に失敗しました')
      const batches=plan.batches;setTotalBatches(batches.length)
      let generated=0;let aborted=false;let globalRefOffset=0
      for(let i=0;i<batches.length;i++){
        const batch=batches[i];setCurrentBatch(i+1);setCurrentBatchLabel(`${batch.category} / ${batch.perspective}`)
        const batchRes=await fetch('/api/generate/batch',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            jobId:startData.jobId,projectId:params.id,batchNum:i+1,totalBatches:batches.length,
            alreadyCount:generated,planBatch:batch,modelOverride:getExecModel(),
            ragTopK:execRagTopK,
            refOffset:globalRefOffset, // ★ グローバルREF番号オフセット（バッチをまたいで一意）
          }),
        })
        const batchData=await batchRes.json()
        if(!batchRes.ok||batchData.error)throw new Error(`バッチ${i+1}でエラー: ${batchData.error}`)
        const batchCount = batchData.count??0
        generated+=batchCount;setTotalGenerated(generated)
        // REF番号オフセットを加算（次バッチのREF番号が前バッチと重複しないよう）
        globalRefOffset += batchCount
        if(batchData.aborted){
          aborted=true
          if(batchData.abortedWarning){
            setAbortWarnings(prev=>[...prev, batchData.abortedWarning])
          }
          break
        }
      }
      await fetch('/api/generate/complete',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jobId:startData.jobId,projectId:params.id,count:generated,isPartial:aborted,targetPages:null}),
      }).catch(()=>{})
      const completedPlan={...plan,status:'completed' as const,execModelId:getExecModel()}
      await fetch('/api/generate/plan',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:completedPlan})})
      setPlan(completedPlan);setIsPartial(aborted);setExecDone(true)
    }catch(e){setExecError(e instanceof Error?e.message:'テスト項目の生成に失敗しました')}
    finally{setExecuting(false)}
  }

  const totalPlanItems=plan?.batches.reduce((s,b)=>s+b.titles.length,0)??0
  const progressPct=totalBatches>0?Math.round((currentBatch/totalBatches)*100):0

  return (
    <div className="max-w-3xl animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIテスト項目生成</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="font-semibold text-shift-700">① プランニング</span> → 仕様書を分析してテスト設計方針を立案 →
          確認・編集 → <span className="font-semibold text-shift-700">② 実行</span> → 詳細生成
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={()=>setStep('plan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${step==='plan'?'bg-shift-700 text-white shadow-sm':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          <ClipboardList className="w-4 h-4"/>① プランニング
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400"/>
        <button onClick={()=>plan&&setStep('execute')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${step==='execute'?'bg-shift-700 text-white shadow-sm':plan?'bg-gray-100 text-gray-500 hover:bg-gray-200':'bg-gray-50 text-gray-300 cursor-not-allowed'}`}>
          <Play className="w-4 h-4"/>② 実行{plan&&<span className="text-xs opacity-80">({totalPlanItems}件)</span>}
        </button>
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RAGデータ利用状況</p>
        <div className="space-y-2">
          {[
            {icon:FileText,label:'ドキュメント（要件定義書・設計書・ナレッジ）',available:true,note:'ドキュメント管理で確認'},
            {icon:Globe,label:'URL構造分析',available:!!siteAnalysis,note:siteAnalysis?`${siteAnalysis.pageCount}ページ`:'未実施（任意）'},
            {icon:Code2,label:'ソースコード',available:sourceCodeCount>0,note:sourceCodeCount>0?`${sourceCodeCount}件 / チャンク: ${sourceCodeChunks}`:'未取込（任意）'},
          ].map(({icon:Icon,label,available,note})=>(
            <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Icon className={`w-4 h-4 flex-shrink-0 ${available?'text-green-600':'text-gray-300'}`}/>
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {step==='plan'&&(
        <>
          {/* テスト工程選択 */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-shift-700"/>テスト工程
              <span className="text-xs font-normal text-gray-400">（工程に応じた観点・粒度でプランを立案します）</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
              {TEST_PHASES.map(phase=>(
                <div key={phase} className="relative">
                  <button
                    onClick={()=>handlePhaseChange(phase)}
                    onMouseEnter={()=>setShowPhaseTooltip(phase)}
                    onMouseLeave={()=>setShowPhaseTooltip(null)}
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
            <p className="text-xs text-gray-400 mt-2">
              選択中: <span className="font-semibold text-shift-700">{testPhase}</span> — {TEST_PHASE_DESCRIPTIONS[testPhase]}
            </p>
          </div>

          <ModelSelector label="① プランニング用AIモデル（テスト設計方針の立案）"
            selectedId={planModelId} customModel={planCustomModel} useCustom={usePlanCustom}
            onSelect={id=>{setPlanModelId(id);setUsePlanCustom(false)}}
            onCustomChange={setPlanCustomModel} onUseCustom={()=>setUsePlanCustom(true)}
            models={adminModelList}/>

          <div className="card">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={()=>setShowAdvanced(!showAdvanced)}>
              <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-gray-500"/><span className="font-semibold text-gray-900 text-sm">生成パラメータ</span></div>
              {showAdvanced?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
            </button>
            {showAdvanced&&(
              <div className="px-4 pb-4 space-y-6 border-t border-gray-100 pt-4">
                <div>
                  <label className="label">総生成件数</label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {[50,100,200,300,500].map(v=>(
                      <button key={v} onClick={()=>setTotalItems(v)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${totalItems===v?'bg-shift-800 text-white border-shift-800':'bg-white text-gray-600 border-gray-200 hover:border-shift-400'}`}>{v}件</button>
                    ))}
                    <input type="number" min={10} max={5000} value={totalItems} onChange={e=>setTotalItems(Number(e.target.value))} className="input py-1.5 w-28 text-sm"/>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">※ 1000件以上も入力可。バッチ数が増えます（{Math.ceil(totalItems/batchSize)}バッチ）</p>
                </div>
                <div>
                  <label className="label">1回のAI呼び出しで生成する件数（バッチサイズ）</label>
                  <p className="text-xs text-gray-400 mb-2">{totalItems}件 ÷ {batchSize}件 = <strong className="text-shift-700">{Math.ceil(totalItems/batchSize)}バッチ</strong> 実行されます</p>
                  <div className="flex gap-2 flex-wrap items-center">
                    {[25,50,75,100].map(v=>(
                      <button key={v} onClick={()=>setBatchSize(v)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${batchSize===v?'bg-shift-800 text-white border-shift-800':'bg-white text-gray-600 border-gray-200 hover:border-shift-400'}`}>{v}件</button>
                    ))}
                    <input type="number" min={10} max={200} value={batchSize} onChange={e=>setBatchSize(Number(e.target.value))} className="input py-1.5 w-28 text-sm"/>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">⚠️ Vercel無料プランは60秒/リクエスト制限。爆速モデルなら100件/バッチも可。DeepSeekは50件以下推奨。</p>
                </div>
                <div>
                  <label className="label">テスト観点の配分</label>
                  <div className="flex gap-2 mb-3">
                    {[{mode:'ai' as const,label:'AIに任せる'},{mode:'weighted' as const,label:'件数で指定'}].map(({mode,label})=>(
                      <button key={mode} onClick={()=>setPerspectiveMode(mode)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${perspectiveMode===mode?'bg-shift-800 text-white border-shift-800':'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{label}</button>
                    ))}
                  </div>
                  {perspectiveMode==='ai'&&(
                    <div>
                      <p className="text-xs text-gray-400 mb-2">テスト工程「{testPhase}」に推奨する観点が自動選択されています</p>
                      <div className="flex flex-wrap gap-2">
                        {PERSPECTIVE_OPTIONS.map(({value,label})=>(
                          <button key={value} onClick={()=>setSelectedPerspectives(prev=>{const n=new Set(prev);n.has(value)?n.delete(value):n.add(value);return n})}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedPerspectives.has(value)?'bg-shift-100 text-shift-800 border-shift-400':'bg-white text-gray-500 border-gray-200'}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {perspectiveMode==='weighted'&&(
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400">合計: <span className="font-semibold text-shift-700">{PERSPECTIVE_OPTIONS.filter(p=>selectedPerspectives.has(p.value)).reduce((s,p)=>s+(perspectiveWeights[p.value]??0),0)}件</span></p>
                      {PERSPECTIVE_OPTIONS.map(({value,label})=>{
                        const en=selectedPerspectives.has(value);const cnt=perspectiveWeights[value]??0
                        return(
                          <div key={value} className="flex items-center gap-3">
                            <button onClick={()=>setSelectedPerspectives(prev=>{const n=new Set(prev);n.has(value)?n.delete(value):n.add(value);return n})}
                              className={`w-20 flex-shrink-0 text-xs px-2 py-1 rounded-lg border text-center font-medium ${en?'bg-shift-100 text-shift-800 border-shift-400':'bg-gray-50 text-gray-400 border-gray-200'}`}>{label}</button>
                            <input type="range" min={0} max={200} step={5} value={cnt} disabled={!en} onChange={e=>setPerspectiveWeights(prev=>({...prev,[value]:Number(e.target.value)}))} className="flex-1 accent-shift-700 disabled:opacity-30"/>
                            <span className={`w-12 text-right text-xs font-mono font-semibold ${en?'text-shift-700':'text-gray-300'}`}>{en?`${cnt}件`:'OFF'}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">RAG取得チャンク数</label>
                  <div className="space-y-2">
                    {[{label:'📄 ドキュメント',key:'doc' as const,max:200},{label:'🌐 サイト構造',key:'site' as const,max:100},{label:'💻 ソースコード',key:'src' as const,max:200}].map(({label,key,max})=>(
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-28 text-xs text-gray-600 flex-shrink-0">{label}</span>
                        <input type="range" min={0} max={max} step={10} value={ragTopK[key]} onChange={e=>setRagTopK(prev=>({...prev,[key]:Number(e.target.value)}))} className="flex-1 accent-shift-700"/>
                        <input type="number" min={0} max={max} value={ragTopK[key]} onChange={e=>setRagTopK(prev=>({...prev,[key]:Number(e.target.value)}))} className="input py-1 w-16 text-xs text-right"/>
                        <span className="text-xs text-gray-400">件</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {planError&&(
            <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
              <div><p className="text-sm font-semibold text-red-800">プランニングに失敗しました</p><p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{planError}</p></div>
            </div>
          )}

          <button disabled={planning} onClick={runPlanning} className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60">
            {planning?<><Loader2 className="w-5 h-5 animate-spin"/>AIがテスト設計プランを立案中...</>:<><ClipboardList className="w-5 h-5"/>「{testPhase}」のテスト設計プランを立案する</>}
          </button>

          {planning&&(
            <div className="card p-5 animate-fade-in">
              <div className="flex items-center gap-3 text-shift-700">
                <Loader2 className="w-5 h-5 animate-spin"/>
                <div><p className="font-semibold text-sm">仕様書を分析してプランを立案中...</p><p className="text-xs text-gray-500 mt-0.5">RAG検索 → プロンプト構築 → LLMによる設計計画の生成（30〜60秒程度）</p></div>
              </div>
            </div>
          )}
        </>
      )}

      {step==='execute'&&plan&&(
        <>
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">テスト設計プラン</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {plan.testPhase&&<span className="font-semibold text-shift-700 mr-2">[{plan.testPhase}]</span>}
                  合計 <strong className="text-shift-700">{totalPlanItems}</strong> 件 / {plan.batches.length} バッチ /
                  プランモデル: <span className="font-mono text-gray-600">{plan.planModelId}</span>
                  {plan.ragBreakdown&&<span className="ml-2 text-gray-400">RAG: Doc={plan.ragBreakdown.doc} Site={plan.ragBreakdown.site} Src={plan.ragBreakdown.src}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setShowPlanEditor(true)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5"/>編集</button>
                <button onClick={()=>{setStep('plan');setPlan(null);setExecDone(false)}} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5"/>再立案</button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {plan.batches.map((batch,i)=>(
                <div key={i} className={`px-4 py-3 transition-colors ${executing&&currentBatch===i+1?'bg-shift-50':'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">Batch {batch.batchId}</span>
                    <span className="font-medium text-gray-800 text-sm flex-1">{batch.category}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">{batch.perspective}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0 w-10 text-right">{batch.titles.length}件</span>
                    <div className="w-5 flex-shrink-0">
                      {executing&&currentBatch===i+1&&<Loader2 className="w-3.5 h-3.5 text-shift-600 animate-spin"/>}
                      {(execDone||(executing&&currentBatch>i+1))&&<CheckCircle2 className="w-3.5 h-3.5 text-green-500"/>}
                    </div>
                  </div>
                  <div className="mt-1 ml-20 space-y-0.5">
                    {batch.titles.slice(0,2).map((t,ti)=><p key={ti} className="text-xs text-gray-400 truncate">• {t}</p>)}
                    {batch.titles.length>2&&<p className="text-xs text-gray-300">... 他 {batch.titles.length-2} 件</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ModelSelector label="② 実行用AIモデル（テスト項目詳細の生成）"
            selectedId={execModelId} customModel={execCustomModel} useCustom={useExecCustom}
            onSelect={id=>{setExecModelId(id);setUseExecCustom(false)}}
            onCustomChange={setExecCustomModel} onUseCustom={()=>setUseExecCustom(true)}
            models={adminModelList}/>

          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">RAG取得チャンク数（実行用）</p>
            <div className="space-y-2">
              {[{label:'📄 ドキュメント',key:'doc' as const,max:200},{label:'🌐 サイト構造',key:'site' as const,max:100},{label:'💻 ソースコード',key:'src' as const,max:200}].map(({label,key,max})=>(
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-600 flex-shrink-0">{label}</span>
                  <input type="range" min={0} max={max} step={10} value={execRagTopK[key]} onChange={e=>setExecRagTopK(prev=>({...prev,[key]:Number(e.target.value)}))} className="flex-1 accent-shift-700"/>
                  <input type="number" min={0} max={max} value={execRagTopK[key]} onChange={e=>setExecRagTopK(prev=>({...prev,[key]:Number(e.target.value)}))} className="input py-1 w-16 text-xs text-right"/>
                  <span className="text-xs text-gray-400">件</span>
                </div>
              ))}
            </div>
          </div>

          {execError&&(
            <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
              <div><p className="text-sm font-semibold text-red-800">エラーが発生しました</p><p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{execError}</p>
                <button onClick={()=>setExecError('')} className="btn-secondary text-xs py-1.5 mt-2">再試行</button>
              </div>
            </div>
          )}

          {executing&&(
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Loader2 className="w-5 h-5 text-shift-600 animate-spin"/><span className="font-semibold text-gray-900 text-sm">テスト項目を生成中...</span></div>
                <span className="text-lg font-bold text-shift-700">{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div className="bg-gradient-to-r from-shift-700 to-shift-400 h-3 rounded-full transition-all duration-500" style={{width:`${progressPct}%`}}/>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">バッチ</p><p className="font-bold text-shift-700">{currentBatch} / {totalBatches}</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">生成済み</p><p className="font-bold text-green-600">{totalGenerated} 件</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">目標</p><p className="font-bold text-gray-700">{totalPlanItems} 件</p></div>
              </div>
              {currentBatchLabel&&<p className="text-xs text-gray-400 mt-3 text-center"><span className="bg-gray-100 rounded px-2 py-0.5">{currentBatchLabel}</span></p>}
            </div>
          )}

          {execDone&&(
            <div className={`card p-6 text-center animate-slide-up ${isPartial?'border border-amber-300':''}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPartial?'bg-amber-100':'bg-green-100'}`}>
                {isPartial?<AlertTriangle className="w-8 h-8 text-amber-600"/>:<CheckCircle2 className="w-8 h-8 text-green-600"/>}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{isPartial?'途中保存で完了':'生成完了！'}</h3>
              <p className="text-sm text-gray-600 mb-4">{totalGenerated}件のテスト項目を生成しました</p>
              {isPartial&&abortWarnings.length>0&&(
                <div className="mb-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5"/>途中中断したバッチの詳細
                  </p>
                  {abortWarnings.map((w,i)=>(
                    <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{w}</div>
                  ))}
                  <p className="text-xs text-gray-500 mt-1">
                    ※ タイムアウト（52秒）により途中で中断されました。生成済みの項目は保存されています。
                    再実行するか、テスト項目書を確認して不足分を手動で追加してください。
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <button className="btn-secondary" onClick={()=>{setExecDone(false);setTotalGenerated(0);setCurrentBatch(0);setAbortWarnings([])}}>再実行</button>
                <button className="btn-primary" onClick={()=>router.push(`/projects/${params.id}/test-items`)}>テスト項目書を確認</button>
              </div>
            </div>
          )}

          {!executing&&!execDone&&(
            <button onClick={runExecution} className="btn-primary w-full justify-center py-4 text-base">
              <Play className="w-5 h-5"/>{plan.batches.length}バッチ・{totalPlanItems}件のテスト項目を生成する
            </button>
          )}
        </>
      )}

      {showPlanEditor&&plan&&<PlanEditor plan={plan} onSave={savePlan} onClose={()=>setShowPlanEditor(false)}/>}
    </div>
  )
}
