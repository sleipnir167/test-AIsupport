'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Play, FileText, Globe, Code2, CheckCircle2, AlertCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react'
import { mockDocuments, mockSiteAnalysis } from '@/lib/mock-data'

const stages = [
  { label: 'RAG検索中', pct: 20 },
  { label: 'プロンプト構築中', pct: 40 },
  { label: 'AI生成中（テスト項目を作成しています）', pct: 85 },
  { label: 'データを保存中', pct: 95 },
  { label: '完了', pct: 100 },
]

export default function GeneratePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const docs = mockDocuments.filter(d => d.projectId === params.id && d.status === 'completed')
  const hasAnalysis = mockSiteAnalysis.projectId === params.id

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageIdx, setStageIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [weights, setWeights] = useState({
    functional: 30, boundary: 20, error: 25, security: 15, usability: 10
  })
  const [maxItems, setMaxItems] = useState(300)

  const generate = async () => {
    setGenerating(true)
    setProgress(0)
    setStageIdx(0)
    setDone(false)

    for (let s = 0; s < stages.length; s++) {
      setStageIdx(s)
      const target = stages[s].pct
      const prev = s === 0 ? 0 : stages[s - 1].pct
      const step = (target - prev) / 15
      for (let p = prev; p <= target; p += step) {
        await new Promise(r => setTimeout(r, 80))
        setProgress(Math.min(p, target))
      }
    }
    setDone(true)
    setGenerating(false)
  }

  const canGenerate = docs.length > 0

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIテスト項目生成</h1>
        <p className="text-sm text-gray-500 mt-0.5">読み込んだ資料を元にAIがテスト項目書を自動生成します</p>
      </div>

      {/* Analysis checklist */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">分析対象の確認</h2>
        <div className="space-y-3">
          {[
            { icon: FileText, label: `ドキュメント`, status: docs.length > 0, detail: `${docs.length}件のファイル（チャンク: ${docs.reduce((s, d) => s + (d.chunkCount || 0), 0)}）` },
            { icon: Globe, label: 'URLサイト構造', status: hasAnalysis, detail: hasAnalysis ? `${mockSiteAnalysis.pageCount}ページ解析済` : '未実施（任意）' },
            { icon: Code2, label: 'ソースコード', status: false, detail: '未取込（任意）' },
          ].map(({ icon: Icon, label, status, detail }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status ? 'bg-green-100' : 'bg-gray-200'}`}>
                <Icon className={`w-4 h-4 ${status ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{detail}</p>
              </div>
              {status
                ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              }
            </div>
          ))}
        </div>

        {!canGenerate && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">AI生成を開始するには、ドキュメント管理から資料を1件以上アップロードしてください。</p>
          </div>
        )}
      </div>

      {/* Advanced settings */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900 text-sm">生成パラメータ（詳細設定）</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <label className="label">最大生成件数</label>
              <select className="input" value={maxItems} onChange={e => setMaxItems(Number(e.target.value))}>
                {[100, 200, 300, 500, 1000].map(v => <option key={v} value={v}>{v}件</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-3">テスト観点の重み付け（合計: {Object.values(weights).reduce((a, b) => a + b, 0)}%）</label>
              <div className="space-y-3">
                {[
                  { key: 'functional', label: '機能テスト' },
                  { key: 'boundary', label: '境界値テスト' },
                  { key: 'error', label: '異常系テスト' },
                  { key: 'security', label: 'セキュリティ' },
                  { key: 'usability', label: '操作性テスト' },
                ].map(({ key, label }) => (
                  <div key={key}>
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
          </div>
        )}
      </div>

      {/* Generate button */}
      {!generating && !done && (
        <button
          className="btn-primary w-full justify-center py-4 text-base"
          onClick={generate}
          disabled={!canGenerate}
        >
          <Sparkles className="w-5 h-5" />
          AIテスト項目を生成する
        </button>
      )}

      {/* Progress */}
      {generating && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-shift-600 animate-pulse" />
            <span className="font-semibold text-gray-900">AI生成中...</span>
            <span className="ml-auto text-lg font-bold text-shift-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
            <div className="bg-gradient-to-r from-shift-700 to-shift-500 h-3 rounded-full progress-bar"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="space-y-1.5">
            {stages.map((stage, i) => (
              <div key={stage.label} className={`flex items-center gap-2 text-xs transition-all ${i === stageIdx ? 'text-shift-700 font-semibold' : i < stageIdx ? 'text-green-600' : 'text-gray-400'}`}>
                {i < stageIdx
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : i === stageIdx
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-shift-600 border-t-transparent animate-spin" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                }
                {stage.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {done && (
        <div className="card p-6 text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">生成完了！</h3>
          <p className="text-sm text-gray-500 mb-5">287件のテスト項目を生成しました</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => setDone(false)}>再生成する</button>
            <button className="btn-primary" onClick={() => router.push(`/projects/${params.id}/test-items`)}>
              テスト項目書を確認
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
