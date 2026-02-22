'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Play, FileText, Globe, Code2, CheckCircle2, AlertCircle, Settings, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

const stages = [
  { label: 'RAG検索中（関連ドキュメントを取得）', pct: 15 },
  { label: 'プロンプト構築中', pct: 25 },
  { label: 'AI生成中（テスト項目を作成しています）', pct: 90 },
  { label: 'データを保存中', pct: 98 },
  { label: '完了', pct: 100 },
]

export default function GeneratePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageIdx, setStageIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [resultCount, setResultCount] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxItems, setMaxItems] = useState(50)
  const [weights, setWeights] = useState({
    functional: 30, boundary: 20, error: 25, security: 15, usability: 10
  })

  const generate = async () => {
    setGenerating(true)
    setProgress(0)
    setStageIdx(0)
    setDone(false)
    setError('')

    // プログレスアニメーション（stg0→stg1まで表示しながらAPIを待つ）
    const animateTo = (target: number, duration: number) =>
      new Promise<void>(resolve => {
        const start = Date.now()
        const startVal = progress
        const tick = () => {
          const elapsed = Date.now() - start
          const p = Math.min(startVal + (target - startVal) * (elapsed / duration), target)
          setProgress(p)
          if (elapsed < duration) requestAnimationFrame(tick)
          else resolve()
        }
        requestAnimationFrame(tick)
      })

    // Stage 0: RAG検索中
    setStageIdx(0)
    await animateTo(15, 1500)

    // Stage 1: プロンプト構築中
    setStageIdx(1)
    await animateTo(25, 800)

    // Stage 2: AI生成（実際のAPIコール）
    setStageIdx(2)
    const perspectives = Object.entries(weights)
      .filter(([, v]) => v > 0)
      .map(([k]) => ({
        functional: '機能テスト', boundary: '境界値', error: '異常系', security: 'セキュリティ', usability: '操作性'
      }[k]!))

    // ゆっくりプログレスを進める（API応答を待ちながら）
    let aiDone = false
    let apiResult: { count: number; provider: string; model: string } | null = null
    let apiError = ''

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 0.5, 88))
    }, 500)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, maxItems, perspectives }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI生成に失敗しました')
      apiResult = { count: data.count, provider: data.provider, model: data.model }
    } catch (e) {
      apiError = e instanceof Error ? e.message : 'AI生成に失敗しました'
    } finally {
      clearInterval(progressInterval)
      aiDone = true
    }

    if (apiError) {
      setError(apiError)
      setGenerating(false)
      return
    }

    // Stage 3: 保存中
    setStageIdx(3)
    await animateTo(98, 500)

    // Stage 4: 完了
    setStageIdx(4)
    setProgress(100)
    setResultCount(apiResult?.count || 0)
    setDone(true)
    setGenerating(false)
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIテスト項目生成</h1>
        <p className="text-sm text-gray-500 mt-0.5">アップロードされた資料をRAGで解析し、AIがテスト項目書を自動生成します</p>
      </div>

      <div className="card p-4 bg-shift-50 border border-shift-200">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-shift-700 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-shift-700">
            <p className="font-semibold mb-0.5">RAG + AI生成の仕組み</p>
            <p>アップロードされたドキュメントをベクトルDBで検索し、関連する仕様・要件をAIへ提供してテスト項目を生成します。<br />
            資料が多いほど、より精度の高いテスト項目が生成されます。</p>
          </div>
        </div>
      </div>

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
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <label className="label">最大生成件数</label>
              <select className="input" value={maxItems} onChange={e => setMaxItems(Number(e.target.value))}>
                {[20, 50, 100, 200].map(v => <option key={v} value={v}>{v}件</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">※ モデルの出力制限により実際の件数は前後します</p>
            </div>
            <div>
              <label className="label mb-3">テスト観点の重み付け</label>
              {[
                { key: 'functional', label: '機能テスト' },
                { key: 'boundary', label: '境界値テスト' },
                { key: 'error', label: '異常系テスト' },
                { key: 'security', label: 'セキュリティ' },
                { key: 'usability', label: '操作性テスト' },
              ].map(({ key, label }) => (
                <div key={key} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-600">{label}</span>
                    <span className="text-xs font-semibold text-shift-700">{weights[key as keyof typeof weights]}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5}
                    value={weights[key as keyof typeof weights]}
                    onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))}
                    className="w-full accent-shift-700" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!generating && !done && (
        <button className="btn-primary w-full justify-center py-4 text-base" onClick={generate}>
          <Sparkles className="w-5 h-5" />AIテスト項目を生成する
        </button>
      )}

      {generating && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-shift-600 animate-spin" />
              <span className="font-semibold text-gray-900">AI生成中...</span>
            </div>
            <span className="text-lg font-bold text-shift-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div className="bg-gradient-to-r from-shift-700 to-shift-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="space-y-2">
            {stages.map((stage, i) => (
              <div key={stage.label} className={`flex items-center gap-2 text-xs transition-all
                ${i === stageIdx ? 'text-shift-700 font-semibold' : i < stageIdx ? 'text-green-600' : 'text-gray-400'}`}>
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

      {error && (
        <div className="card p-4 border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">生成に失敗しました</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <button className="btn-secondary mt-3 text-xs py-1" onClick={() => setError('')}>再試行</button>
          </div>
        </div>
      )}

      {done && (
        <div className="card p-6 text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">生成完了！</h3>
          <p className="text-sm text-gray-500 mb-5">{resultCount}件のテスト項目を生成しました</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => { setDone(false); setProgress(0) }}>再生成する</button>
            <button className="btn-primary" onClick={() => router.push(`/projects/${params.id}/test-items`)}>
              テスト項目書を確認
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
