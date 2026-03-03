'use client'
/**
 * TestExecutionPanel.tsx
 * AIテスト自動実行パネル
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, StopCircle, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronRight, Loader2, ExternalLink,
  Camera, List, Info, Eye, FileText, BarChart3, Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import type { TestItem } from '@/types'
import type { TestExecutionResult, ExecutionSession } from '@/lib/test-executor'

interface Props {
  projectId: string
  testItems: TestItem[]
}

interface ProgressEvent {
  sessionId: string
  stage: number
  message: string
  completedItems: number
  totalItems: number
  currentTestId?: string
}

interface DoneEvent {
  sessionId: string
  summary: {
    totalItems: number
    passedItems: number
    failedItems: number
    errorItems: number
    passRate: number
  }
}

function StatusBadge({ status }: { status: TestExecutionResult['status'] }) {
  const cfg = {
    passed: { icon: CheckCircle2, label: 'PASSED', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
    failed: { icon: XCircle, label: 'FAILED', cls: 'text-red-400 bg-red-400/10 border-red-400/30' },
    error: { icon: AlertTriangle, label: 'ERROR', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
    skipped: { icon: ChevronRight, label: 'SKIP', cls: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
  }[status]
  const Icon = cfg.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-bold', cfg.cls)}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function ResultCard({ result }: { result: TestExecutionResult }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedShot, setSelectedShot] = useState<string | null>(null)
  return (
    <div className={clsx(
      'border rounded-lg overflow-hidden',
      result.status === 'passed' ? 'border-emerald-800/50 bg-emerald-950/20' :
      result.status === 'failed' ? 'border-red-800/50 bg-red-950/20' :
      result.status === 'error' ? 'border-amber-800/50 bg-amber-950/20' :
      'border-slate-700/50 bg-slate-900/20'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <StatusBadge status={result.status} />
        <span className="font-mono text-xs text-slate-500">{result.testId}</span>
        <span className="flex-1 text-sm text-slate-300 truncate">{result.testTitle}</span>
        <span className="text-xs text-slate-500 font-mono">{(result.durationMs / 1000).toFixed(1)}s</span>
        {result.screenshotUrls.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Camera size={10} />{result.screenshotUrls.length}
          </span>
        )}
        {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 space-y-3 pt-3">
          <div>
            <p className="text-xs text-slate-500 mb-1 font-mono uppercase tracking-wider">判定根拠</p>
            <p className="text-sm text-slate-300 leading-relaxed">{result.verdict}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded p-3">
              <p className="text-xs text-slate-500 mb-1 font-mono">期待結果</p>
              <p className="text-xs text-slate-400 leading-relaxed">{result.expectedResult || '—'}</p>
            </div>
            <div className="bg-slate-900/50 rounded p-3">
              <p className="text-xs text-slate-500 mb-1 font-mono">実際の結果</p>
              <p className="text-xs text-slate-400 leading-relaxed">{result.actualResult || '—'}</p>
            </div>
          </div>
          {result.steps.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">実行ステップ ({result.steps.length})</p>
              <div className="space-y-1">
                {result.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={clsx('mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
                      step.status === 'passed' ? 'bg-emerald-400' :
                      step.status === 'failed' ? 'bg-red-400' : 'bg-amber-400')} />
                    <span className="font-mono text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-slate-400 flex-1">{step.stepDescription}</span>
                    {step.actualResult && <span className="text-slate-600 truncate max-w-48">{step.actualResult}</span>}
                    <span className="text-slate-600 font-mono">{step.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.screenshotUrls.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">証跡スクリーンショット ({result.screenshotUrls.length})</p>
              <div className="flex gap-2 flex-wrap">
                {result.screenshotUrls.map((url, i) => (
                  <button key={i} onClick={() => setSelectedShot(url)}
                    className="relative w-24 h-16 rounded border border-slate-600 overflow-hidden hover:border-slate-400 transition-colors">
                    <img src={url} alt={`証跡${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 bg-black/70 text-xs px-1 font-mono">{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {result.errorMessage && (
            <div className="bg-red-950/30 border border-red-800/50 rounded p-3">
              <p className="text-xs text-red-400 font-mono">{result.errorMessage}</p>
            </div>
          )}
        </div>
      )}

      {selectedShot && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedShot(null)}>
          <img src={selectedShot} alt="証跡" className="max-w-full max-h-full rounded border border-slate-600"
            onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setSelectedShot(null)}>
            <XCircle size={24} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function TestExecutionPanel({ projectId, testItems }: Props) {
  const [targetUrl, setTargetUrl] = useState('')
  const [maxItems, setMaxItems] = useState(5)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const [results, setResults] = useState<TestExecutionResult[]>([])
  const [summary, setSummary] = useState<DoneEvent['summary'] | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'results' | 'logs'>('results')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const automatableItems = testItems.filter(t => t.automatable !== 'NO')
  const selectedItems = automatableItems.filter(t => selectedIds.has(t.id))

  const toggleAll = () => {
    if (selectedIds.size === automatableItems.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(automatableItems.map(t => t.id)))
  }

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('ja-JP', { hour12: false })
    setLogs(prev => [...prev.slice(-199), `[${ts}] ${msg}`])
  }, [])

  const runTests = async () => {
    if (!targetUrl || selectedItems.length === 0) return
    setIsRunning(true)
    setResults([])
    setSummary(null)
    setLogs([])
    setActiveTab('results')
    addLog(`実行開始: ${selectedItems.length}件 → ${targetUrl}`)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/test-execution/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, targetUrl, testItems: selectedItems.slice(0, maxItems), maxItems }),
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
                if (data.sessionId && !sessionId) setSessionId(data.sessionId)
                addLog(data.message)
                break
              case 'result':
                setResults(prev => [...prev, data.result])
                addLog(`${data.result.testId}: ${data.result.status.toUpperCase()} (${(data.result.durationMs / 1000).toFixed(1)}s)`)
                break
              case 'done':
                setSummary(data.summary)
                setSessionId(data.sessionId)
                addLog(`完了: PASS ${data.summary.passedItems}/${data.summary.totalItems} (${data.summary.passRate}%)`)
                break
              case 'error':
                addLog(`ERROR: ${data.message}`)
                break
            }
          } catch { /* parse error */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') addLog(`実行エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsRunning(false)
    }
  }

  const stopTests = () => {
    abortRef.current?.abort()
    addLog('実行を中断しました')
    setIsRunning(false)
  }

  const passCount = results.filter(r => r.status === 'passed').length
  const failCount = results.filter(r => r.status === 'failed').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <div className="space-y-4">
      {/* シミュレーションモード通知 */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-950/30 border border-blue-800/40">
        <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs text-blue-300 font-medium">PLAYWRIGHT_ENDPOINT 未設定時はシミュレーションモードで動作</p>
          <p className="text-xs text-blue-400/70 mt-0.5">
            実ブラウザ実行には Cloud Run 等で Playwright サービスを起動し PLAYWRIGHT_ENDPOINT 環境変数を設定してください。
          </p>
        </div>
      </div>

      {/* 実行設定 */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />実行設定
        </h3>

        <div>
          <label className="text-xs text-slate-500 mb-1.5 block font-mono">テスト対象URL</label>
          <div className="flex gap-2">
            <input type="url" value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
              placeholder="https://your-app.example.com"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-400"
              disabled={isRunning} />
            {targetUrl && (
              <a href={targetUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1.5 block font-mono">最大実行件数</label>
          <select value={maxItems} onChange={e => setMaxItems(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" disabled={isRunning}>
            {[3, 5, 10, 20].map(n => <option key={n} value={n}>{n}件</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-500 font-mono">テスト項目選択</label>
            <button onClick={toggleAll} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
              {selectedIds.size === automatableItems.length ? '全解除' : '全選択'}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-700/50 p-2">
            {automatableItems.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">自動化可能なテスト項目がありません</p>
            ) : automatableItems.map(item => (
              <label key={item.id} className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-xs',
                selectedIds.has(item.id) ? 'bg-slate-700/50 text-slate-200' : 'hover:bg-slate-800 text-slate-400'
              )}>
                <input type="checkbox" checked={selectedIds.has(item.id)} disabled={isRunning}
                  onChange={() => {
                    const next = new Set(selectedIds)
                    if (next.has(item.id)) {
                      next.delete(item.id);
                    } else {
                      next.add(item.id);
                    }
                    setSelectedIds(next)
                  }}
                <span className="font-mono text-slate-500">{item.testId}</span>
                <span className="flex-1 truncate">{item.testTitle}</span>
                <span className={clsx('text-xs px-1 rounded',
                  item.automatable === 'YES' ? 'text-emerald-400 bg-emerald-950/50' : 'text-amber-400 bg-amber-950/50')}>
                  {item.automatable === 'YES' ? '自動化可' : '要検討'}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-1">{selectedIds.size}件選択 / 自動化可能 {automatableItems.length}件</p>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={runTests} disabled={!targetUrl || selectedIds.size === 0}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                targetUrl && selectedIds.size > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed')}>
              <Play size={14} />テスト実行開始
            </button>
          ) : (
            <button onClick={stopTests}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors">
              <StopCircle size={14} />実行を中断
            </button>
          )}
          {results.length > 0 && !isRunning && (
            <button onClick={() => { setResults([]); setSummary(null); setLogs([]); setProgress(null) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw size={14} />クリア
            </button>
          )}
        </div>
      </div>

      {/* 進捗 */}
      {isRunning && progress && (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-emerald-400" />{progress.message}
            </span>
            <span className="text-xs text-slate-500 font-mono">{progress.completedItems}/{progress.totalItems}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.totalItems > 0 ? (progress.completedItems / progress.totalItems) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* サマリー */}
      {(summary || results.length > 0) && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '合計', value: summary?.totalItems ?? results.length, icon: List, cls: 'text-slate-300' },
            { label: 'PASS', value: summary?.passedItems ?? passCount, icon: CheckCircle2, cls: 'text-emerald-400' },
            { label: 'FAIL', value: summary?.failedItems ?? failCount, icon: XCircle, cls: 'text-red-400' },
            { label: 'ERROR', value: summary?.errorItems ?? errorCount, icon: AlertTriangle, cls: 'text-amber-400' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 text-center">
              <Icon size={16} className={clsx('mx-auto mb-1', cls)} />
              <p className={clsx('text-2xl font-bold font-mono', cls)}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <BarChart3 size={14} />合格率
            </span>
            <span className={clsx('text-2xl font-bold font-mono',
              summary.passRate >= 80 ? 'text-emerald-400' :
              summary.passRate >= 50 ? 'text-amber-400' : 'text-red-400')}>
              {summary.passRate}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div className={clsx('h-3 rounded-full transition-all duration-500',
              summary.passRate >= 80 ? 'bg-emerald-500' :
              summary.passRate >= 50 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${summary.passRate}%` }} />
          </div>
          {sessionId && <p className="text-xs text-slate-600 mt-2 font-mono">Session: {sessionId}</p>}
        </div>
      )}

      {/* 結果タブ */}
      {(results.length > 0 || logs.length > 0) && (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex border-b border-slate-700/50">
            {[
              { key: 'results' as const, label: `実行結果 (${results.length})`, icon: Eye },
              { key: 'logs' as const, label: `ログ (${logs.length})`, icon: FileText },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={clsx('flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors',
                  activeTab === key
                    ? 'text-slate-200 border-b-2 border-emerald-500 bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-300')}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          {activeTab === 'results' && (
            <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {results.length === 0
                ? <p className="text-xs text-slate-500 text-center py-8">実行中...</p>
                : results.map((r, i) => <ResultCard key={i} result={r} />)}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="p-3 font-mono text-xs bg-slate-950/50 max-h-[400px] overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className={clsx('leading-relaxed',
                  log.includes('ERROR') ? 'text-red-400' :
                  log.includes('PASSED') || log.includes('完了') ? 'text-emerald-400' :
                  log.includes('FAILED') ? 'text-amber-400' : 'text-slate-500')}>
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
