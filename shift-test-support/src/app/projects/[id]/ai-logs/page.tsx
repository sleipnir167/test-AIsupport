'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  MessageSquare, Loader2, ChevronDown, ChevronUp,
  Clock, AlertTriangle, BarChart2,
  Search, Zap, ArrowUpDown
} from 'lucide-react'
import { clsx } from 'clsx'
import type { AILogEntry } from '@/types'

function fmtDate(s: string) { return new Date(s).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function fmtMs(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms` }
function fmtT(n?: number) { if (!n && n !== 0) return '-'; return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n) }

function LogCard({ entry }: { entry: AILogEntry }) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'system' | 'user' | 'response'>('user')

  const typeLabel = entry.type === 'generation' ? 'テスト生成' : entry.type === 'review' ? 'AIレビュー' : 'Excel比較'
  const typeBg = entry.type === 'generation' ? 'bg-shift-100 text-shift-800 border-shift-200'
    : entry.type === 'review' ? 'bg-purple-100 text-purple-800 border-purple-200'
    : 'bg-blue-100 text-blue-800 border-blue-200'

  const totalActual = entry.totalTokensActual
  const totalEst = entry.totalTokensEst
  const totalDisplay = totalActual ?? totalEst
  const isHigh = totalDisplay > 10000

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0', typeBg)}>{typeLabel}</span>
            <span className="text-sm font-medium text-gray-700 truncate">{entry.modelId}</span>
            {entry.batchNum && <span className="text-xs text-gray-400">バッチ {entry.batchNum}/{entry.totalBatches}</span>}
            {entry.aborted && <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 rounded">中断</span>}
            {entry.error && <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-1.5 rounded">エラー</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtMs(entry.elapsedMs)}</span>
            <span>{fmtDate(entry.createdAt)}</span>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* トークンサマリー行 */}
        <div className="flex items-center gap-5 mt-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Zap className={clsx('w-3 h-3', isHigh ? 'text-orange-500' : 'text-green-500')} />
            <span className="text-gray-500">総トークン:</span>
            <span className={clsx('font-mono font-bold', isHigh ? 'text-orange-600' : 'text-gray-800')}>
              {fmtT(totalDisplay)}
              <span className={clsx('font-normal ml-1', totalActual ? 'text-green-600' : 'text-gray-400')}>
                {totalActual ? '(実績)' : '(概算)'}
              </span>
            </span>
            {isHigh && <span className="text-orange-500 font-semibold">⚠️ 上限に注意</span>}
          </div>
          <span className="text-gray-400">入力: <span className="font-mono text-gray-600">{fmtT(entry.promptTokensActual ?? entry.systemTokensEst + entry.userTokensEst)}</span></span>
          <span className="text-gray-400">出力: <span className="font-mono text-gray-600">{fmtT(entry.completionTokensActual ?? entry.responseTokensEst)}</span></span>
          {entry.outputItemCount > 0 && <span className="text-gray-400">生成: <span className="font-mono text-gray-600">{entry.outputItemCount}件</span></span>}
          {entry.ragBreakdown && (
            <span className="text-gray-400">RAG: <span className="font-mono text-gray-600">Doc:{entry.ragBreakdown.doc} Site:{entry.ragBreakdown.site} Src:{entry.ragBreakdown.src}</span></span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          {/* トークン詳細 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" />トークン詳細</h4>
            {totalActual ? (
              <div className="space-y-2">
                {[
                  { label: 'プロンプト(入力)', v: entry.promptTokensActual, max: 100000, color: 'bg-blue-400' },
                  { label: '出力', v: entry.completionTokensActual, max: 16000, color: 'bg-green-400' },
                ].map(({ label, v, max, color }) => {
                  const pct = Math.min(((v ?? 0) / max) * 100, 100)
                  const warn = pct > 80
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span className={clsx('font-mono font-semibold', warn ? 'text-orange-600' : 'text-gray-700')}>{fmtT(v)}{warn && ' ⚠️'}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={clsx('h-1.5 rounded-full', warn ? 'bg-orange-400' : color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-700">合計 (API実績値)</span>
                  <span className="font-mono text-gray-900">{fmtT(entry.totalTokensActual)}</span>
                </div>
                <p className="text-xs text-green-600 flex items-center gap-1"><span>✓</span> APIから実際のトークン数を取得済み</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: 'システムプロンプト', v: entry.systemTokensEst, color: 'text-blue-600' },
                    { label: 'ユーザープロンプト', v: entry.userTokensEst, color: 'text-yellow-600' },
                    { label: 'レスポンス(概算)', v: entry.responseTokensEst, color: 'text-green-600' },
                  ].map(({ label, v, color }) => (
                    <div key={label} className="text-center bg-gray-50 rounded-lg p-2">
                      <p className={clsx('text-lg font-bold font-mono', color)}>{fmtT(v)}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
                  <span className="text-gray-700">合計 (概算)</span>
                  <span className="font-mono text-gray-900">{fmtT(entry.totalTokensEst)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">※ 概算値 (日本語≒1文字1トークン、英語≒4文字1トークン)</p>
              </div>
            )}
          </div>

          {/* エラー */}
          {entry.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />エラー内容</p>
              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{entry.error}</pre>
            </div>
          )}

          {/* プロンプト/レスポンスビューア */}
          {(entry.systemPrompt || entry.userPrompt || entry.responseText) && (
            <div>
              <div className="flex gap-1 mb-2 bg-white border border-gray-200 p-1 rounded-xl w-fit">
                {[
                  { id: 'system' as const, label: 'システム', show: !!entry.systemPrompt },
                  { id: 'user' as const, label: 'ユーザー', show: !!entry.userPrompt },
                  { id: 'response' as const, label: 'AIレスポンス', show: !!entry.responseText },
                ].filter(t => t.show).map(({ id, label }) => (
                  <button key={id} onClick={() => setActiveSection(id)}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      activeSection === id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700')}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="bg-gray-900 rounded-xl p-4 max-h-72 overflow-y-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {activeSection === 'system' ? entry.systemPrompt
                    : activeSection === 'user' ? entry.userPrompt
                    : entry.responseText}
                </pre>
                <p className="text-xs text-gray-600 mt-3 pt-2 border-t border-gray-800">
                  ※ 先頭{activeSection === 'response' ? '2,000' : activeSection === 'system' ? '3,000' : '4,000'}文字のみ保存・表示
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AILogsPage({ params }: { params: { id: string } }) {
  const [logs, setLogs] = useState<AILogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'generation' | 'review' | 'compare'>('all')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    fetch(`/api/ai-logs?projectId=${params.id}`)
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params.id])

  const filtered = useMemo(() => {
    const list = logs.filter(l => {
      if (filterType !== 'all' && l.type !== filterType) return false
      if (search && !l.modelId.includes(search) && !(l.error ?? '').includes(search)) return false
      return true
    })
    return sortOrder === 'desc' ? list : [...list].reverse()
  }, [logs, filterType, search, sortOrder])

  const stats = useMemo(() => ({
    count: logs.length,
    totalTokens: logs.reduce((s, l) => s + (l.totalTokensActual ?? l.totalTokensEst), 0),
    totalItems: logs.filter(l => l.type === 'generation').reduce((s, l) => s + l.outputItemCount, 0),
    errors: logs.filter(l => !!l.error).length,
    avgMs: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + l.elapsedMs, 0) / logs.length) : 0,
  }), [logs])

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" /><span>読み込み中...</span>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AIやり取りログ</h1>
        <p className="text-sm text-gray-500 mt-0.5">このプロジェクトのAIへの問い合わせ履歴・プロンプト・トークン使用量を確認できます</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'やり取り数', value: `${stats.count}件`, color: 'text-gray-900' },
          { label: '生成テスト項目', value: `${stats.totalItems}件`, color: 'text-shift-700' },
          { label: '推定総トークン', value: fmtT(stats.totalTokens), color: 'text-blue-600' },
          { label: '平均応答時間', value: fmtMs(stats.avgMs), color: 'text-green-600' },
          { label: 'エラー数', value: `${stats.errors}件`, color: stats.errors > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3 text-center">
            <p className={clsx('text-xl font-bold', color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="モデル名・エラーで絞り込み..."
            className="input pl-9 py-1.5" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([['all','すべて'],['generation','テスト生成'],['review','レビュー'],['compare','Excel比較']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterType === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
          <ArrowUpDown className="w-3.5 h-3.5" />{sortOrder === 'desc' ? '新しい順' : '古い順'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card py-20 text-center text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">AIとのやり取りがありません</p>
          <p className="text-xs mt-1">テスト生成またはレビューを実行するとここに記録されます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => <LogCard key={entry.id} entry={entry} />)}
        </div>
      )}
    </div>
  )
}
