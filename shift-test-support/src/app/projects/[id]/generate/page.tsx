'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, CheckCircle2, AlertCircle, Settings,
  ChevronDown, ChevronUp, Loader2, Globe, FileText, Code2,
  LayoutGrid, List, Bug, Copy, CheckCheck, AlertTriangle, Zap
} from 'lucide-react'
import type { SiteAnalysis, PageInfo } from '@/types'

const STAGES = [
  'RAG検索中（関連ドキュメント・サイト構造・ソースコードを取得）',
  'プロンプト構築中',
  'AI生成中...',
  'テスト項目を解析・保存中',
  '完了',
]
const STAGE_PROGRESS = [10, 22, 88, 97, 100]

const PERSPECTIVE_OPTIONS = [
  { label: '機能テスト',   value: '機能テスト' },
  { label: '正常系',       value: '正常系' },
  { label: '異常系',       value: '異常系' },
  { label: '境界値',       value: '境界値' },
  { label: 'セキュリティ', value: 'セキュリティ' },
  { label: '操作性',       value: '操作性' },
  { label: '性能',         value: '性能' },
]

interface ModelOption {
  id: string
  label: string
  inputCost: string
  outputCost: string
  feature: string
  speed: '爆速' | '高速' | '標準'
  isDefault?: boolean
  isFree?: boolean
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'deepseek/deepseek-v3-0324',
    label: 'DeepSeek V3.2',
    inputCost: '$0.20',
    outputCost: '$0.35',
    feature: '最安クラス。出力量が多いならこれ一択',
    speed: '高速',
    isDefault: true,
  },
  {
    id: 'google/gemini-2.0-flash-001',
    label: 'Gemini 2.0 Flash',
    inputCost: '$0.10',
    outputCost: '$0.40',
    feature: 'RAGに最適。爆速で大量生成可能',
    speed: '爆速',
  },
  {
    id: 'google/gemini-2.5-flash-preview',
    label: 'Gemini 2.5 Flash',
    inputCost: '$0.15',
    outputCost: '$0.60',
    feature: '最新Gemini。高精度かつ高速',
    speed: '爆速',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    inputCost: '$0.15',
    outputCost: '$0.60',
    feature: 'OpenAIの高速・軽量モデル',
    speed: '高速',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    inputCost: '$2.50',
    outputCost: '$10.00',
    feature: '非常に高精度。複雑なロジックの網羅に強い',
    speed: '標準',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    inputCost: '$0.12',
    outputCost: '$0.30',
    feature: 'Meta製OSS。コスパ良好',
    speed: '高速',
  },
]

const SPEED_COLOR: Record<string, string> = {
  '爆速': 'text-green-600 bg-green-50',
  '高速': 'text-blue-600 bg-blue-50',
  '標準': 'text-gray-600 bg-gray-100',
}

interface JobDebug {
  status: string
  stage: number
  message: string
  error?: string
  debugError?: string
  debugPrompt?: { system: string; user: string; totalChunks: number }
  model?: string
  count?: number
  isPartial?: boolean
  elapsed?: number
  updatedAt?: string
  breakdown?: { documents: number; siteAnalysis: number; sourceCode: number }
}

export default function GeneratePage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysis | null>(null)
  const [sourceCodeCount, setSourceCodeCount] = useState(0)   // 取込済みソースコード件数
  const [sourceCodeChunks, setSourceCodeChunks] = useState(0) // 取込済みチャンク数
  const [maxItems, setMaxItems] = useState(100)
  const [selectedPerspectives, setSelectedPerspectives] = useState<Set<string>>(
    new Set(['機能テスト', '正常系', '異常系', '境界値', 'セキュリティ', '操作性'])
  )
  const [targetMode, setTargetMode] = useState<'all' | 'pages'>('all')
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set())
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  // モデル選択
  const [selectedModelId, setSelectedModelId] = useState(MODEL_OPTIONS.find(m => m.isDefault)!.id)
  const [customModel, setCustomModel] = useState('')
  const [useCustomModel, setUseCustomModel] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [stageMessage, setStageMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const [error, setError] = useState('')
  const [resultCount, setResultCount] = useState(0)
  const [jobDebug, setJobDebug] = useState<JobDebug | null>(null)
  const [copied, setCopied] = useState(false)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef(0)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const jobIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetch(`/api/site-analysis?projectId=${params.id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setSiteAnalysis(data) })
      .catch(() => {})
    // ソースコード取込状況を取得
    fetch(`/api/documents?projectId=${params.id}`)
      .then(r => r.json())
      .then((docs: Array<{ category: string; chunkCount?: number }>) => {
        if (!Array.isArray(docs)) return
        const srcDocs = docs.filter(d => d.category === 'source_code')
        setSourceCodeCount(srcDocs.length)
        setSourceCodeChunks(srcDocs.reduce((s, d) => s + (d.chunkCount ?? 0), 0))
      })
      .catch(() => {})
  }, [params.id])

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (progressTimer.current) clearInterval(progressTimer.current)
  }, [])

  const animateTo = (target: number) => {
    if (progressTimer.current) clearInterval(progressTimer.current)
    progressTimer.current = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + (target - progressRef.current) * 0.1 + 0.2, target)
      setProgress(Math.round(progressRef.current * 10) / 10)
      if (progressRef.current >= target - 0.1) clearInterval(progressTimer.current!)
    }, 150)
  }

  const finishSuccess = (job: JobDebug) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (progressTimer.current) clearInterval(progressTimer.current)
    progressRef.current = 100
    setProgress(100)
    setStageIdx(4)
    setResultCount(job.count ?? 0)
    setIsPartial(job.isPartial ?? false)
    setJobDebug(job)
    setDone(true)
    setGenerating(false)
  }

  const finishError = (msg: string, job?: JobDebug) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (progressTimer.current) clearInterval(progressTimer.current)
    setError(msg)
    if (job) setJobDebug(job)
    setGenerating(false)
    setShowDebug(true)
  }

  const startPolling = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/status?jobId=${jobId}`)
        if (!res.ok) return
        const job: JobDebug = await res.json()
        setJobDebug(job)

        if (typeof job.stage === 'number') {
          setStageIdx(job.stage)
          setStageMessage(job.message || '')
          animateTo(STAGE_PROGRESS[Math.min(job.stage, STAGE_PROGRESS.length - 2)])
        }
        if (job.status === 'completed') finishSuccess(job)
        else if (job.status === 'error') finishError(job.error || 'AI生成に失敗しました', job)
      } catch (e) {
        console.warn('Polling error:', e)
      }
    }, 3000)
  }

  const getTargetPages = (): PageInfo[] | null => {
    if (targetMode === 'all' || !siteAnalysis) return null
    return (siteAnalysis.pages ?? []).filter(p => selectedPages.has(p.url))
  }

  const getModelId = () => useCustomModel ? (customModel.trim() || selectedModelId) : selectedModelId

  const generate = async () => {
    const targetPages = getTargetPages()
    if (targetMode === 'pages' && (!targetPages || targetPages.length === 0)) {
      setError('画面単位モードでは1ページ以上を選択してください')
      return
    }

    setGenerating(true)
    progressRef.current = 0
    setProgress(0)
    setStageIdx(1)
    setStageMessage('ジョブを登録中...')
    setDone(false)
    setIsPartial(false)
    setError('')
    setJobDebug(null)
    jobIdRef.current = null
    animateTo(8)

    try {
      // Step1: jobId取得 & バッチ設定を受け取る
      const startRes = await fetch('/api/generate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          maxItems,
          perspectives: Array.from(selectedPerspectives),
          targetPages,
          modelOverride: getModelId(),
        }),
      })

      const startData = await startRes.json()
      if (!startData.jobId) throw new Error(startData.error || 'jobIdが返されませんでした')

      const { jobId, totalBatches, batchSize, perspectives: persp, modelOverride } = startData
      jobIdRef.current = jobId

      // Step2: バッチを順番に実行
      let totalGenerated = 0
      let isTimeout = false
      let usedModel = modelOverride || getModelId()
      let ragBreakdown = { doc: 0, site: 0, src: 0 }

      for (let batch = 1; batch <= totalBatches; batch++) {
        const remaining = maxItems - totalGenerated
        if (remaining <= 0) break

        const currentBatch = Math.min(batchSize, remaining)
        const progressPct = 10 + ((batch - 1) / totalBatches) * 75
        animateTo(progressPct)
        setStageIdx(2)
        setStageMessage(`バッチ ${batch}/${totalBatches} 実行中（${totalGenerated}件生成済）`)

        // 各バッチのfetchをawaitする（完了するまで待つ）
        const batchRes = await fetch('/api/generate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            projectId: params.id,
            batchNum: batch,
            totalBatches,
            batchSize: currentBatch,
            alreadyCount: totalGenerated,
            perspectives: persp,
            targetPages,
            modelOverride,
          }),
        })

        const batchData = await batchRes.json()
        console.log(`[batch ${batch}/${totalBatches}]`, batchData)

        if (!batchRes.ok || batchData.error) {
          throw new Error(`バッチ${batch}でエラー: ${batchData.error}`)
        }

        totalGenerated += batchData.count ?? 0
        if (batchData.model) usedModel = batchData.model
        if (batchData.ragBreakdown) ragBreakdown = batchData.ragBreakdown

        if (batchData.aborted) {
          isTimeout = true
          console.warn(`Batch ${batch} was aborted (timeout)`)
          break
        }
      }

      // Step3: 完了処理
      animateTo(97)
      setStageIdx(3)
      setStageMessage('完了処理中...')

      // KVのジョブを完了状態に更新
      await fetch('/api/generate/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          projectId: params.id,
          count: totalGenerated,
          isPartial: isTimeout,
          targetPages,
        }),
      }).catch(() => {}) // 失敗しても続行

      const finalJob: JobDebug = {
        status: 'completed',
        stage: 4,
        message: isTimeout ? `タイムアウトのため途中保存（${totalGenerated}件）` : `完了（${totalGenerated}件）`,
        count: totalGenerated,
        isPartial: isTimeout,
        model: usedModel,
        breakdown: {
          documents: ragBreakdown.doc,
          siteAnalysis: ragBreakdown.site,
          sourceCode: ragBreakdown.src,
        },
      }
      finishSuccess(finalJob)

    } catch (e) {
      console.error('[generate] error:', e)
      finishError(e instanceof Error ? e.message : 'AI生成に失敗しました')
    }
  }

  const copyDebug = () => {
    navigator.clipboard.writeText(JSON.stringify(jobDebug, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedModel = MODEL_OPTIONS.find(m => m.id === selectedModelId)

  return (
    <div className="max-w-3xl animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIテスト項目生成</h1>
        <p className="text-sm text-gray-500 mt-0.5">ドキュメント・URL分析・ソースコードをRAGで活用してテスト項目を生成します</p>
      </div>

      {/* RAGデータ状況 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RAGデータ利用状況</p>
        <div className="space-y-2">
          {[
            { icon: FileText, label: 'ドキュメント（要件定義書・設計書・ナレッジ）', available: true,              note: 'ドキュメント管理で確認' },
            { icon: Globe,    label: 'URL構造分析',  available: !!siteAnalysis,             note: siteAnalysis ? `${siteAnalysis.pageCount}ページ / チャンク: ${siteAnalysis.chunkCount ?? 0}` : '未実施（任意）' },
            { icon: Code2,    label: 'ソースコード',  available: sourceCodeCount > 0,        note: sourceCodeCount > 0 ? `${sourceCodeCount}件取込済 / チャンク: ${sourceCodeChunks}` : '未取込（任意）' },
          ].map(({ icon: Icon, label, available, note }) => (
            <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Icon className={`w-4 h-4 flex-shrink-0 ${available ? 'text-green-600' : 'text-gray-300'}`} />
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* モデル選択 */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">使用AIモデル</p>
          <p className="text-xs text-gray-400 mt-0.5">OpenRouter経由で呼び出します。APIキー: OPENROUTER_API_KEY</p>
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
              {MODEL_OPTIONS.map(m => (
                <tr
                  key={m.id}
                  onClick={() => { setSelectedModelId(m.id); setUseCustomModel(false) }}
                  className={`cursor-pointer transition-colors ${
                    !useCustomModel && selectedModelId === m.id
                      ? 'bg-shift-50 border-l-2 border-l-shift-700'
                      : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="radio"
                      name="model"
                      checked={!useCustomModel && selectedModelId === m.id}
                      onChange={() => { setSelectedModelId(m.id); setUseCustomModel(false) }}
                      className="accent-shift-700"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-400 font-mono">{m.id}</div>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                    {m.inputCost}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.isFree ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                    {m.outputCost}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-xs">{m.feature}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SPEED_COLOR[m.speed]}`}>
                      {m.speed === '爆速' && <span>⚡ </span>}{m.speed}
                    </span>
                  </td>
                </tr>
              ))}
              {/* カスタム入力行 */}
              <tr
                onClick={() => setUseCustomModel(true)}
                className={`cursor-pointer transition-colors ${
                  useCustomModel
                    ? 'bg-shift-50 border-l-2 border-l-shift-700'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="radio"
                    name="model"
                    checked={useCustomModel}
                    onChange={() => setUseCustomModel(true)}
                    className="accent-shift-700"
                  />
                </td>
                <td className="px-3 py-2.5" colSpan={5}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 flex-shrink-0">任意のモデルを指定</span>
                    <input
                      type="text"
                      placeholder="例: meta-llama/llama-3.1-70b-instruct"
                      value={customModel}
                      onChange={e => { setCustomModel(e.target.value); setUseCustomModel(true) }}
                      onClick={e => e.stopPropagation()}
                      className="input py-1 text-xs font-mono flex-1"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {!useCustomModel && selectedModel && (
          <div className="px-4 py-2 bg-shift-50 border-t border-shift-100 text-xs text-shift-700">
            選択中: <span className="font-mono font-semibold">{selectedModel.id}</span>
          </div>
        )}
        {useCustomModel && customModel && (
          <div className="px-4 py-2 bg-shift-50 border-t border-shift-100 text-xs text-shift-700">
            選択中: <span className="font-mono font-semibold">{customModel}</span>
          </div>
        )}
      </div>

      {/* 画面単位選択 */}
      {siteAnalysis && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">生成対象</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { mode: 'all' as const,   icon: List,       label: '全体を対象',     desc: 'すべての資料・画面を対象に生成' },
              { mode: 'pages' as const, icon: LayoutGrid, label: '画面単位で指定', desc: '特定の画面に絞って生成・追記' },
            ].map(({ mode, icon: Icon, label, desc }) => (
              <button key={mode} onClick={() => setTargetMode(mode)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${targetMode === mode ? 'border-shift-700 bg-shift-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Icon className={`w-4 h-4 ${targetMode === mode ? 'text-shift-700' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-sm font-semibold ${targetMode === mode ? 'text-shift-800' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
          {targetMode === 'pages' && (
            <>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">画面を選択（{selectedPages.size}件）</span>
                  <div className="flex gap-3">
                    <button className="text-xs text-shift-700 hover:underline"
                      onClick={() => setSelectedPages(new Set((siteAnalysis.pages ?? []).map(p => p.url)))}>全選択</button>
                    <button className="text-xs text-gray-500 hover:underline"
                      onClick={() => setSelectedPages(new Set())}>全解除</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {(siteAnalysis.pages ?? []).map(page => (
                    <label key={page.url} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-shift-700 flex-shrink-0"
                        checked={selectedPages.has(page.url)}
                        onChange={() => setSelectedPages(prev => { const next = new Set(prev); next.has(page.url) ? next.delete(page.url) : next.add(page.url); return next })} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{page.title}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{page.url}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">F:{page.forms} B:{page.buttons}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-2">※ 画面単位モードは既存のテスト項目に追記されます</p>
            </>
          )}
        </div>
      )}

      {/* 詳細設定 */}
      <div className="card">
        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900 text-sm">生成パラメータ</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
            <div>
              <label className="label">最大生成件数</label>
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 200, 300, 500].map(v => (
                  <button key={v} onClick={() => setMaxItems(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${maxItems === v ? 'bg-shift-800 text-white border-shift-800' : 'bg-white text-gray-600 border-gray-200 hover:border-shift-400'}`}>
                    {v}件
                  </button>
                ))}
                <input type="number" min={10} max={5000} value={maxItems}
                  onChange={e => setMaxItems(Number(e.target.value))}
                  className="input py-1.5 w-28 text-sm" />
              </div>
              <p className="text-xs text-gray-400 mt-1">⚠️ Vercel無料プランは60秒制限。DeepSeekは <strong>50〜100件推奨</strong>。爆速モデルなら300件以上も可能。</p>
            </div>
            <div>
              <label className="label">テスト観点</label>
              <div className="flex flex-wrap gap-2">
                {PERSPECTIVE_OPTIONS.map(({ value, label }) => (
                  <button key={value} onClick={() => setSelectedPerspectives(prev => {
                    const next = new Set(prev); next.has(value) ? next.delete(value) : next.add(value); return next
                  })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedPerspectives.has(value) ? 'bg-shift-100 text-shift-800 border-shift-400' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
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
        <button className="btn-primary w-full justify-center py-4 text-base" onClick={generate}>
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
            <div className="bg-gradient-to-r from-shift-700 to-shift-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="space-y-2">
            {STAGES.map((stage, i) => (
              <div key={stage} className={`flex items-center gap-2 text-xs transition-all ${i === stageIdx ? 'text-shift-700 font-semibold' : i < stageIdx ? 'text-green-600' : 'text-gray-400'}`}>
                {i < stageIdx ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  : i === stageIdx ? <div className="w-3.5 h-3.5 rounded-full border-2 border-shift-600 border-t-transparent animate-spin flex-shrink-0" />
                  : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                <span>{stage}</span>
                {i === stageIdx && stageMessage && <span className="text-gray-400 truncate max-w-xs">— {stageMessage}</span>}
              </div>
            ))}
          </div>
          {jobIdRef.current && (
            <p className="text-xs text-gray-300 mt-3 font-mono">Job: {jobIdRef.current}</p>
          )}
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">エラーが発生しました</p>
            <p className="text-xs text-red-600 mt-0.5 break-all whitespace-pre-wrap">{error}</p>
            <div className="flex gap-2 mt-3">
              <button className="btn-secondary text-xs py-1.5" onClick={() => { setError(''); setShowDebug(false) }}>再試行</button>
              <button className="btn-secondary text-xs py-1.5"
                onClick={() => router.push(`/projects/${params.id}/test-items`)}>テスト項目書を確認</button>
            </div>
          </div>
        </div>
      )}

      {/* デバッグパネル */}
      {(jobDebug || generating || error) && (
        <div className="card border border-amber-200">
          <button className="w-full flex items-center justify-between p-3 hover:bg-amber-50 transition-colors"
            onClick={() => setShowDebug(!showDebug)}>
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">デバッグ情報</span>
              {jobDebug && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${jobDebug.status === 'completed' ? 'bg-green-100 text-green-700' : jobDebug.status === 'error' ? 'bg-red-100 text-red-700' : jobDebug.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {jobDebug.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {jobDebug && (
                <button onClick={e => { e.stopPropagation(); copyDebug() }}
                  className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1">
                  {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'コピー済' : 'コピー'}
                </button>
              )}
              {showDebug ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
            </div>
          </button>
          {showDebug && (
            <div className="border-t border-amber-200 p-4 space-y-4">
              {jobDebug && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">ジョブ状態</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Job ID',   value: jobIdRef.current || '-' },
                      { label: 'Status',   value: jobDebug.status },
                      { label: 'Stage',    value: String(jobDebug.stage) },
                      { label: 'Message',  value: jobDebug.message },
                      { label: 'Model',    value: jobDebug.model || '-' },
                      { label: 'Count',    value: String(jobDebug.count ?? '-') },
                      { label: 'Elapsed',  value: jobDebug.elapsed ? `${jobDebug.elapsed}s` : '-' },
                      { label: 'Updated',  value: jobDebug.updatedAt ? new Date(jobDebug.updatedAt).toLocaleTimeString('ja-JP') : '-' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded p-2">
                        <p className="text-gray-400 text-xs">{label}</p>
                        <p className="text-gray-800 font-mono break-all">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {jobDebug?.error && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-2">エラー詳細</p>
                  <pre className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 overflow-x-auto whitespace-pre-wrap break-all">
                    {jobDebug.error}{jobDebug.debugError && `\n\nStack:\n${jobDebug.debugError}`}
                  </pre>
                </div>
              )}
              {jobDebug?.debugPrompt && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">使用プロンプト（RAGチャンク: {jobDebug.debugPrompt.totalChunks}件）</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">System Prompt</p>
                      <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap max-h-40">{jobDebug.debugPrompt.system}</pre>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">User Prompt</p>
                      <pre className="bg-gray-900 text-blue-300 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap max-h-60">{jobDebug.debugPrompt.user}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 完了 */}
      {done && (
        <div className={`card p-6 text-center animate-slide-up ${isPartial ? 'border border-amber-300' : ''}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPartial ? 'bg-amber-100' : 'bg-green-100'}`}>
            {isPartial
              ? <AlertTriangle className="w-8 h-8 text-amber-600" />
              : <CheckCircle2 className="w-8 h-8 text-green-600" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {isPartial ? '途中保存で完了' : '生成完了！'}
          </h3>
          <p className="text-sm text-gray-600 mb-1">{resultCount.toLocaleString()}件のテスト項目を生成しました</p>
          {isPartial && (
            <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left">
              <p className="font-semibold flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> 60秒タイムアウトにより途中で打ち切りました
              </p>
              <p>生成できた分（{resultCount}件）は保存されています。</p>
              <p className="mt-1">より多く生成したい場合は <span className="font-mono bg-amber-100 px-1 rounded">⚡ 爆速</span> モデルを選択してください。</p>
            </div>
          )}
          {jobDebug?.breakdown && (
            <div className="flex justify-center gap-4 text-xs text-gray-500 mb-5">
              <span>📄 Doc: {jobDebug.breakdown.documents}</span>
              <span>🌐 Site: {jobDebug.breakdown.siteAnalysis}</span>
              <span>💻 Src: {jobDebug.breakdown.sourceCode}</span>
              {jobDebug.elapsed && <span>⏱ {jobDebug.elapsed}s</span>}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => { setDone(false); setProgress(0); progressRef.current = 0 }}>
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
