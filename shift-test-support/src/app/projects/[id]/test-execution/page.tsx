'use client'
/**
 * /projects/[id]/test-execution/page.tsx
 *
 * プロジェクト詳細の「テスト自動実行」タブページ
 *
 * 既存のプロジェクト詳細画面（/projects/[id]/）のタブ構成に
 * 「テスト自動実行」タブを追加する形で組み込みます。
 *
 * 組み込み方法:
 *   既存の projects/[id]/page.tsx または layout.tsx のタブリストに
 *   { href: `/projects/${id}/test-execution`, label: 'テスト自動実行' }
 *   を追加してください。
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Play, StopCircle, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, ExternalLink, Camera, Info,
  Eye, FileText, BarChart3, Zap, List, Square, CheckSquare, Filter
} from 'lucide-react'
import { clsx } from 'clsx'

// ─── 型定義（既存 @/types に合わせる） ─────────────────────────
interface TestItem {
  id: string
  testId: string
  categoryMajor: string
  categoryMinor: string
  testPerspective: string
  testTitle: string
  precondition: string
  steps: string[]
  expectedResult: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  automatable: 'YES' | 'NO' | 'CONSIDER'
  orderIndex: number
}

interface TestStepResult {
  stepIndex: number
  stepDescription: string
  action: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  actualResult?: string
  screenshotUrl?: string
  errorMessage?: string
  durationMs: number
}

interface TestExecutionResult {
  testItemId: string
  testId: string
  testTitle: string
  status: 'passed' | 'failed' | 'error' | 'skipped'
  steps: TestStepResult[]
  actualResult: string
  expectedResult: string
  verdict: string
  screenshotUrls: string[]
  startedAt: string
  finishedAt: string
  durationMs: number
  errorMessage?: string
}

interface ProgressEvent {
  sessionId: string
  stage: number
  message: string
  completedItems: number
  totalItems: number
}

interface Summary {
  totalItems: number
  passedItems: number
  failedItems: number
  errorItems: number
  passRate: number
}

// ─── ステータスバッジ ────────────────────────────────────────────
function StatusBadge({ status }: { status: TestExecutionResult['status'] }) {
  const cfg = {
    passed:  { icon: CheckCircle2, label: 'PASSED', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
    failed:  { icon: XCircle,      label: 'FAILED', cls: 'text-red-400 bg-red-400/10 border-red-400/30' },
    error:   { icon: AlertTriangle,label: 'ERROR',  cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
    skipped: { icon: ChevronRight, label: 'SKIP',   cls: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
  }[status]
  const Icon = cfg.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-bold', cfg.cls)}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

// ─── 結果カード ─────────────────────────────────────────────────
function ResultCard({ result }: { result: TestExecutionResult }) {
  const [open, setOpen] = useState(false)
  const [zoomShot, setZoomShot] = useState<string | null>(null)

  return (
    <div className={clsx('border rounded-lg overflow-hidden',
      result.status === 'passed' ? 'border-emerald-800/50 bg-emerald-950/20' :
      result.status === 'failed' ? 'border-red-800/50 bg-red-950/20' :
      result.status === 'error'  ? 'border-amber-800/50 bg-amber-950/20' :
                                   'border-slate-700/50 bg-slate-900/20')}>
      {/* ヘッダー行（クリックで展開） */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <StatusBadge status={result.status} />
        <span className="font-mono text-xs text-slate-500 flex-shrink-0">{result.testId}</span>
        <span className="flex-1 text-sm text-slate-300 truncate">{result.testTitle}</span>
        <span className="text-xs text-slate-500 font-mono flex-shrink-0">
          {(result.durationMs / 1000).toFixed(1)}s
        </span>
        {result.screenshotUrls.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Camera size={10} />{result.screenshotUrls.length}
          </span>
        )}
        {open ? <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
               : <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />}
      </button>

      {/* 展開詳細 */}
      {open && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
          {/* 判定根拠 */}
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1 font-mono">AI判定根拠</p>
            <p className="text-sm text-slate-300 leading-relaxed">{result.verdict}</p>
          </div>

          {/* 期待 vs 実際 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1 font-mono">期待結果</p>
              <p className="text-xs text-slate-400 leading-relaxed">{result.expectedResult || '—'}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1 font-mono">実際の結果</p>
              <p className="text-xs text-slate-400 leading-relaxed">{result.actualResult || '—'}</p>
            </div>
          </div>

          {/* ステップ詳細 */}
          {result.steps.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">
                実行ステップ ({result.steps.length})
              </p>
              <div className="space-y-1">
                {result.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                    <span className={clsx('mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                      step.status === 'passed' ? 'bg-emerald-400' :
                      step.status === 'failed' ? 'bg-red-400' : 'bg-amber-400')} />
                    <span className="font-mono text-slate-500 w-5 flex-shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-slate-400 flex-1">{step.stepDescription}</span>
                    {step.actualResult && (
                      <span className="text-slate-600 truncate max-w-xs">{step.actualResult}</span>
                    )}
                    <span className="text-slate-600 font-mono flex-shrink-0">{step.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* スクリーンショット証跡 */}
          {result.screenshotUrls.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-mono">
                <Camera size={10} className="inline mr-1" />証跡スクリーンショット
              </p>
              <div className="flex gap-2 flex-wrap">
                {result.screenshotUrls.map((url, i) => (
                  <button key={i} onClick={() => setZoomShot(url)}
                    className="relative w-28 h-18 rounded border border-slate-600 overflow-hidden hover:border-slate-400 transition-colors group">
                    <img src={url} alt={`証跡${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye size={16} className="text-white" />
                    </div>
                    <span className="absolute bottom-1 right-1 bg-black/70 text-xs px-1 rounded font-mono">{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {result.errorMessage && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3">
              <p className="text-xs text-red-400 font-mono">{result.errorMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* スクリーンショット拡大モーダル */}
      {zoomShot && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6"
          onClick={() => setZoomShot(null)}>
          <img src={zoomShot} alt="証跡" className="max-w-full max-h-full rounded-lg border border-slate-600"
            onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/50 rounded-full p-1"
            onClick={() => setZoomShot(null)}>
            <XCircle size={24} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── メインページ ────────────────────────────────────────────────
export default function TestExecutionPage() {
  const params = useParams()
  const projectId = params.id as string

  const [testItems, setTestItems] = useState<TestItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [targetUrl, setTargetUrl] = useState('')
  const [maxItems, setMaxItems] = useState(5)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterPerspective, setFilterPerspective] = useState<string>('all')
  const [filterAuto, setFilterAuto] = useState<'all' | 'YES' | 'CONSIDER'>('all')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const [results, setResults] = useState<TestExecutionResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'results' | 'logs'>('results')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [resultFilter, setResultFilter] = useState<'all' | 'passed' | 'failed' | 'error'>('all')
  const abortRef = useRef<AbortController | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // テスト項目をAPIから取得
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/test-items?projectId=${projectId}`)
      .then(r => r.json())
      .then(data => {
        setTestItems(Array.isArray(data) ? data : [])
        setLoadingItems(false)
      })
      .catch(() => setLoadingItems(false))
  }, [projectId])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('ja-JP', { hour12: false })
    setLogs(prev => [...prev.slice(-299), `[${ts}] ${msg}`])
  }, [])

  // フィルタ済みアイテム
  const filteredItems = testItems.filter(item => {
    if (item.automatable === 'NO') return false
    if (filterAuto !== 'all' && item.automatable !== filterAuto) return false
    if (filterPerspective !== 'all' && item.testPerspective !== filterPerspective) return false
    return true
  })

  const perspectives = [...new Set(testItems.map(t => t.testPerspective))].sort()
  const selectedItems = filteredItems.filter(t => selectedIds.has(t.id))

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(t => t.id)))
    }
  }

  // テスト実行
  const runTests = async () => {
    if (!targetUrl || selectedItems.length === 0) return
    setIsRunning(true)
    setResults([])
    setSummary(null)
    setLogs([])
    setResultFilter('all')
    setActiveTab('results')
    addLog(`▶ 実行開始: ${selectedItems.length}件 → ${targetUrl}`)
    addLog(`  モード: ${process.env.NEXT_PUBLIC_PLAYWRIGHT_ENDPOINT ? '実ブラウザ' : 'シミュレーション'}`)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/test-execution/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          targetUrl,
          testItems: selectedItems,
          maxItems,
        }),
        signal: abort.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop() ?? ''

        for (const block of blocks) {
          const eventLine = block.match(/^event: (.+)$/m)?.[1]
          const dataLine = block.match(/^data: (.+)$/m)?.[1]
          if (!eventLine || !dataLine) continue
          try {
            const data = JSON.parse(dataLine)
            switch (eventLine) {
              case 'progress':
                setProgress(data)
                if (data.sessionId) setSessionId(data.sessionId)
                addLog(`  ${data.message}`)
                break
              case 'result': {
                const r = data.result as TestExecutionResult
                setResults(prev => [...prev, r])
                const icon = r.status === 'passed' ? '✓' : r.status === 'failed' ? '✗' : '!'
                addLog(`${icon} ${r.testId} [${r.status.toUpperCase()}] ${(r.durationMs / 1000).toFixed(1)}s`)
                break
              }
              case 'done':
                setSummary(data.summary)
                setSessionId(data.sessionId)
                addLog(`■ 完了: PASS ${data.summary.passedItems}件 / FAIL ${data.summary.failedItems}件 / ERR ${data.summary.errorItems}件 (合格率 ${data.summary.passRate}%)`)
                break
              case 'error':
                addLog(`✗ ERROR: ${data.message}`)
                break
            }
          } catch { /* parse error */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') {
        addLog(`✗ 実行エラー: ${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setIsRunning(false)
    }
  }

  const stopTests = () => {
    abortRef.current?.abort()
    addLog('■ 実行を中断しました')
    setIsRunning(false)
  }

  // 表示フィルタ後の結果
  const filteredResults = resultFilter === 'all'
    ? results
    : results.filter(r => r.status === resultFilter)

  const passCount  = results.filter(r => r.status === 'passed').length
  const failCount  = results.filter(r => r.status === 'failed').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            AIテスト自動実行
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            生成済みのテスト項目を選択し、AIエージェントが自動実行・判定します
          </p>
        </div>

        {/* シミュレーションモード通知 */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-950/40 border border-blue-800/50">
          <Info size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-300 font-medium">
              {process.env.NEXT_PUBLIC_PLAYWRIGHT_ENDPOINT
                ? '実ブラウザモード（Playwright接続済み）'
                : 'シミュレーションモードで動作中'}
            </p>
            <p className="text-xs text-blue-400/80 mt-1 leading-relaxed">
              {process.env.NEXT_PUBLIC_PLAYWRIGHT_ENDPOINT
                ? `接続先: ${process.env.NEXT_PUBLIC_PLAYWRIGHT_ENDPOINT}`
                : 'PLAYWRIGHT_ENDPOINT 未設定のため、実際のブラウザ操作は行われません。AIがテスト手順を解釈し、実行フロー・判定ロジックの動作確認ができます。実ブラウザ実行は Cloud Run 等に Playwright サービスをデプロイ後、環境変数を設定してください。'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* 左カラム: 設定 + テスト項目選択 */}
          <div className="col-span-2 space-y-4">

            {/* 実行設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300">実行設定</h2>

              {/* 対象URL */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">テスト対象URL</label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={e => setTargetUrl(e.target.value)}
                    placeholder="https://your-app.example.com"
                    disabled={isRunning}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-50"
                  />
                  {targetUrl && (
                    <a href={targetUrl} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-2 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* 最大件数 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">最大実行件数</label>
                <select
                  value={maxItems}
                  onChange={e => setMaxItems(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none disabled:opacity-50"
                >
                  {[3, 5, 10, 20, 50].map(n => (
                    <option key={n} value={n}>{n}件まで実行</option>
                  ))}
                </select>
              </div>

              {/* 実行ボタン */}
              {!isRunning ? (
                <button
                  onClick={runTests}
                  disabled={!targetUrl || selectedIds.size === 0}
                  className={clsx('w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    targetUrl && selectedIds.size > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed')}
                >
                  <Play size={14} />
                  {selectedIds.size > 0
                    ? `選択した${selectedIds.size}件を実行`
                    : 'テスト項目を選択してください'}
                </button>
              ) : (
                <button onClick={stopTests}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors">
                  <StopCircle size={14} />実行を中断
                </button>
              )}

              {results.length > 0 && !isRunning && (
                <button
                  onClick={() => { setResults([]); setSummary(null); setLogs([]); setProgress(null); setSessionId(null) }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RefreshCw size={12} />結果をクリア
                </button>
              )}
            </div>

            {/* テスト項目選択 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300">テスト項目選択</h2>
                <button onClick={toggleAll} disabled={isRunning}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
                  {selectedIds.size === filteredItems.length
                    ? <><Square size={11} />全解除</>
                    : <><CheckSquare size={11} />全選択</>}
                </button>
              </div>

              {/* フィルター */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Filter size={10} className="text-gray-600" />
                  <select value={filterAuto} onChange={e => setFilterAuto(e.target.value as typeof filterAuto)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400 focus:outline-none">
                    <option value="all">自動化可否: すべて</option>
                    <option value="YES">自動化可のみ</option>
                    <option value="CONSIDER">要検討のみ</option>
                  </select>
                </div>
                <select value={filterPerspective} onChange={e => setFilterPerspective(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400 focus:outline-none">
                  <option value="all">テスト観点: すべて</option>
                  {perspectives.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 件数表示 */}
              <p className="text-xs text-gray-600">
                {selectedIds.size}件選択 / 表示中 {filteredItems.length}件
                {testItems.filter(t => t.automatable === 'NO').length > 0 && (
                  <span className="ml-1 text-gray-700">
                    （手動のみ {testItems.filter(t => t.automatable === 'NO').length}件は除外）
                  </span>
                )}
              </p>

              {/* テスト項目リスト */}
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {loadingItems ? (
                  <div className="flex items-center justify-center py-8 text-gray-600">
                    <Loader2 size={16} className="animate-spin mr-2" />読み込み中...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-8">
                    自動化可能なテスト項目がありません
                  </p>
                ) : (
                  filteredItems.map(item => {
                    const isSelected = selectedIds.has(item.id)
                    // この項目の実行結果があれば表示
                    const itemResult = results.find(r => r.testId === item.testId)
                    return (
                      <label key={item.id}
                        className={clsx('flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs',
                          isSelected ? 'bg-gray-800 text-gray-200' : 'hover:bg-gray-800/50 text-gray-500',
                          isRunning && 'cursor-not-allowed opacity-70')}>
                        <input type="checkbox" checked={isSelected} disabled={isRunning}
                          onChange={() => toggleItem(item.id)}
                          className="mt-0.5 rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-gray-600 flex-shrink-0">{item.testId}</span>
                            <span className={clsx('text-xs px-1 rounded flex-shrink-0',
                              item.automatable === 'YES'
                                ? 'text-emerald-500 bg-emerald-950/50'
                                : 'text-amber-500 bg-amber-950/50')}>
                              {item.automatable === 'YES' ? '自動化可' : '要検討'}
                            </span>
                            {itemResult && (
                              <span className={clsx('text-xs font-mono flex-shrink-0',
                                itemResult.status === 'passed' ? 'text-emerald-400' :
                                itemResult.status === 'failed' ? 'text-red-400' : 'text-amber-400')}>
                                {itemResult.status === 'passed' ? '✓' : itemResult.status === 'failed' ? '✗' : '!'}
                              </span>
                            )}
                          </div>
                          <p className="truncate mt-0.5 text-gray-400">{item.testTitle}</p>
                          <p className="text-gray-700 text-xs">{item.categoryMajor} / {item.testPerspective}</p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* 右カラム: 進捗 + 結果 */}
          <div className="col-span-3 space-y-4">

            {/* 進捗バー */}
            {isRunning && progress && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-emerald-400" />
                    {progress.message}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {progress.completedItems} / {progress.totalItems}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress.totalItems > 0 ? (progress.completedItems / progress.totalItems) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {/* サマリーカード */}
            {(summary || results.length > 0) && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '合計', value: results.length, cls: 'text-gray-300', icon: List },
                  { label: 'PASS', value: passCount,  cls: 'text-emerald-400', icon: CheckCircle2 },
                  { label: 'FAIL', value: failCount,  cls: 'text-red-400',     icon: XCircle },
                  { label: 'ERROR',value: errorCount, cls: 'text-amber-400',   icon: AlertTriangle },
                ].map(({ label, value, cls, icon: Icon }) => (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                    <Icon size={16} className={clsx('mx-auto mb-1', cls)} />
                    <p className={clsx('text-2xl font-bold font-mono', cls)}>{value}</p>
                    <p className="text-xs text-gray-600">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 合格率バー */}
            {summary && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <BarChart3 size={14} />合格率
                  </span>
                  <span className={clsx('text-3xl font-bold font-mono',
                    summary.passRate >= 80 ? 'text-emerald-400' :
                    summary.passRate >= 50 ? 'text-amber-400' : 'text-red-400')}>
                    {summary.passRate}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3">
                  <div className={clsx('h-3 rounded-full transition-all duration-700',
                    summary.passRate >= 80 ? 'bg-emerald-500' :
                    summary.passRate >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${summary.passRate}%` }} />
                </div>
                {sessionId && (
                  <p className="text-xs text-gray-700 mt-2 font-mono">Session: {sessionId}</p>
                )}
              </div>
            )}

            {/* 結果タブ */}
            {(results.length > 0 || logs.length > 0) && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* タブヘッダー */}
                <div className="flex items-center justify-between border-b border-gray-800 px-2">
                  <div className="flex">
                    {[
                      { key: 'results' as const, label: `実行結果 (${results.length})`, icon: Eye },
                      { key: 'logs' as const,    label: `ログ (${logs.length})`,       icon: FileText },
                    ].map(({ key, label, icon: Icon }) => (
                      <button key={key} onClick={() => setActiveTab(key)}
                        className={clsx('flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors border-b-2',
                          activeTab === key
                            ? 'text-white border-emerald-500'
                            : 'text-gray-500 hover:text-gray-300 border-transparent')}>
                        <Icon size={12} />{label}
                      </button>
                    ))}
                  </div>

                  {/* 結果フィルター（結果タブ時のみ） */}
                  {activeTab === 'results' && results.length > 0 && (
                    <div className="flex gap-1 pr-2">
                      {([
                        { key: 'all',    label: '全件' },
                        { key: 'passed', label: 'PASS' },
                        { key: 'failed', label: 'FAIL' },
                        { key: 'error',  label: 'ERR' },
                      ] as const).map(({ key, label }) => (
                        <button key={key} onClick={() => setResultFilter(key)}
                          className={clsx('px-2 py-1 rounded text-xs font-mono transition-colors',
                            resultFilter === key
                              ? key === 'passed' ? 'bg-emerald-900/50 text-emerald-400'
                              : key === 'failed' ? 'bg-red-900/50 text-red-400'
                              : key === 'error'  ? 'bg-amber-900/50 text-amber-400'
                              : 'bg-gray-700 text-gray-300'
                              : 'text-gray-600 hover:text-gray-400')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 結果一覧 */}
                {activeTab === 'results' && (
                  <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredResults.length === 0 ? (
                      <p className="text-xs text-gray-600 text-center py-10">
                        {isRunning ? '実行中...' : '該当する結果がありません'}
                      </p>
                    ) : (
                      filteredResults.map((r, i) => <ResultCard key={i} result={r} />)
                    )}
                  </div>
                )}

                {/* 実行ログ */}
                {activeTab === 'logs' && (
                  <div className="p-4 font-mono text-xs bg-gray-950/50 max-h-[500px] overflow-y-auto">
                    {logs.length === 0 ? (
                      <p className="text-gray-700 text-center py-8">ログはまだありません</p>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className={clsx('leading-6',
                          log.includes('✗') || log.includes('ERROR') ? 'text-red-400' :
                          log.includes('✓') || log.includes('完了') || log.includes('PASS') ? 'text-emerald-400' :
                          log.includes('!') || log.includes('FAIL') ? 'text-amber-400' :
                          log.startsWith('  ') ? 'text-gray-600' : 'text-gray-400')}>
                          {log}
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* 初期案内（何も実行していない場合） */}
            {results.length === 0 && !isRunning && (
              <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl p-8 text-center">
                <Zap size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">実行待ち</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  左側でテスト対象URLを入力し、<br />
                  実行するテスト項目を選択して「テスト実行開始」を押してください
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
