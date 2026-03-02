'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Search, Filter, Download, Edit3, Trash2, ChevronDown, ChevronRight,
  X, Save, Loader2, BookOpen, FileText, Globe, Code2, ExternalLink,
  AlertCircle, Zap
} from 'lucide-react'
import { priorityColors, priorityLabels, automatableColors, automatableLabels } from '@/lib/mock-data'
import type { TestItem, Priority, Automatable, TestPerspective, SourceRef } from '@/types'
import { clsx } from 'clsx'
import Link from 'next/link'

// カテゴリ表示ラベル
const CATEGORY_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  customer_doc:   { label: '仕様書',       icon: FileText, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  MSOK_knowledge: { label: 'MSOKナレッジ', icon: BookOpen,  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  source_code:    { label: 'ソースコード', icon: Code2,     color: 'bg-gray-100 text-gray-700 border-gray-300' },
  site_analysis:  { label: 'サイト分析',   icon: Globe,     color: 'bg-green-50 text-green-700 border-green-200' },
}

// excerpt から 【導出根拠】 を分離するユーティリティ
function splitExcerpt(excerpt: string): { body: string; derivation: string } {
  const marker = '\n\n【導出根拠】'
  const idx = excerpt.indexOf(marker)
  if (idx === -1) return { body: excerpt, derivation: '' }
  return {
    body: excerpt.slice(0, idx),
    derivation: excerpt.slice(idx + marker.length),
  }
}

// 出典モーダル
function SourceRefModal({ item, onClose }: { item: TestItem; onClose: () => void }) {
  const refs = item.sourceRefs ?? []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-shift-700" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">出典情報</h2>
              <p className="text-xs text-gray-500 truncate max-w-sm">{item.testTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {refs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">出典情報がありません</p>
              <p className="text-xs mt-1">（一般的なWebシステムの知識から生成）</p>
            </div>
          ) : (
            refs.map((ref, i) => {
              const meta = CATEGORY_LABELS[ref.category] ?? CATEGORY_LABELS.customer_doc
              const Icon = meta.icon
              const { body, derivation } = splitExcerpt(ref.excerpt ?? '')
              return (
                <div key={i} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {/* REF番号バッジ (■4) */}
                    {ref.refId && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-shift-100 text-shift-700 border border-shift-200 font-mono">
                        {ref.refId}
                      </span>
                    )}
                    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', meta.color)}>
                      <Icon className="w-3 h-3" />{meta.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">{ref.filename}</span>
                    {ref.pageUrl && (
                      <a href={ref.pageUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-shift-700 hover:underline flex-shrink-0">
                        <ExternalLink className="w-3 h-3" />URL
                      </a>
                    )}
                  </div>
                  {/* 該当箇所（excerpt本文） (■3 fix) */}
                  {body && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-2">
                      <p className="text-xs text-gray-500 mb-1 font-medium">📄 該当箇所</p>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{body}</p>
                    </div>
                  )}
                  {/* 導出根拠（分離表示） (■3 fix & ■4) */}
                  {derivation && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 mb-1 font-medium">🔍 導出根拠</p>
                      <p className="text-xs text-amber-800 leading-relaxed">{derivation}</p>
                    </div>
                  )}
                  {/* excerpt が空の場合（REF不明等） */}
                  {!body && !derivation && ref.excerpt && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{ref.excerpt}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {refs.length > 0 ? `${refs.length}件の出典` : '出典なし'}
          </p>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 優先度根拠モーダル (■2)
function PriorityReasonModal({ item, onClose }: { item: TestItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">優先度の判定根拠</h2>
              <p className="text-xs text-gray-500 truncate max-w-xs">{item.testTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className={clsx('badge text-sm px-3 py-1', priorityColors[item.priority])}>
              優先度：{priorityLabels[item.priority]}
            </span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium">🤖 AIによる判定根拠</p>
            {item.priorityReason ? (
              <p className="text-sm text-gray-800 leading-relaxed">{item.priorityReason}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">判定根拠の記録がありません</p>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 自動化根拠モーダル (■2)
function AutomatableReasonModal({ item, onClose }: { item: TestItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">自動化可否の判定根拠</h2>
              <p className="text-xs text-gray-500 truncate max-w-xs">{item.testTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className={clsx('badge text-sm px-3 py-1', automatableColors[item.automatable])}>
              {automatableLabels[item.automatable]}
            </span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium">🤖 AIによる判定根拠</p>
            {item.automatableReason ? (
              <p className="text-sm text-gray-800 leading-relaxed">{item.automatableReason}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">判定根拠の記録がありません</p>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 出典バッジ（テーブル行用）
function SourceBadge({ item, onClick }: { item: TestItem; onClick: () => void }) {
  const count = item.sourceRefs?.length ?? 0
  if (count === 0) {
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-gray-300 hover:bg-gray-50 transition-colors"
        title="出典なし">
        <BookOpen className="w-3 h-3" />
        <span>なし</span>
      </button>
    )
  }
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
      title={`${count}件の出典あり`}>
      <BookOpen className="w-3 h-3" />
      <span>{count}件</span>
    </button>
  )
}

export default function TestItemsPage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState<TestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL')
  const [filterAuto, setFilterAuto] = useState<Automatable | 'ALL'>('ALL')
  const [filterMajor, setFilterMajor] = useState('ALL')
  const [filterSource, setFilterSource] = useState<'ALL' | 'WITH' | 'WITHOUT'>('ALL')
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<TestItem>>({})
  const [saving, setSaving] = useState(false)
  const [sourceModalItem, setSourceModalItem] = useState<TestItem | null>(null)
  // ■2: 優先度・自動化根拠モーダル用state
  const [priorityReasonItem, setPriorityReasonItem] = useState<TestItem | null>(null)
  const [automatableReasonItem, setAutomatableReasonItem] = useState<TestItem | null>(null)

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/test-items?projectId=${params.id}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const majors = [...new Set(list.map((t: TestItem) => t.categoryMajor))].slice(0, 2)
      setExpandedMajors(new Set(majors as string[]))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [params.id])

  const majors = useMemo(() => [...new Set(items.map(t => t.categoryMajor))], [items])

  const filtered = useMemo(() => items.filter(t => {
    if (t.isDeleted) return false
    if (searchText && !t.testTitle.includes(searchText) && !t.categoryMajor.includes(searchText)) return false
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false
    if (filterAuto !== 'ALL' && t.automatable !== filterAuto) return false
    if (filterMajor !== 'ALL' && t.categoryMajor !== filterMajor) return false
    if (filterSource === 'WITH' && !(t.sourceRefs && t.sourceRefs.length > 0)) return false
    if (filterSource === 'WITHOUT' && (t.sourceRefs && t.sourceRefs.length > 0)) return false
    return true
  }), [items, searchText, filterPriority, filterAuto, filterMajor, filterSource])

  const grouped = useMemo(() => {
    const g: Record<string, TestItem[]> = {}
    filtered.forEach(t => {
      if (!g[t.categoryMajor]) g[t.categoryMajor] = []
      g[t.categoryMajor].push(t)
    })
    return g
  }, [filtered])

  const stats = useMemo(() => ({
    total: filtered.length,
    high: filtered.filter(t => t.priority === 'HIGH').length,
    medium: filtered.filter(t => t.priority === 'MEDIUM').length,
    low: filtered.filter(t => t.priority === 'LOW').length,
    withSource: filtered.filter(t => t.sourceRefs && t.sourceRefs.length > 0).length,
  }), [filtered])

  const toggleMajor = (m: string) =>
    setExpandedMajors(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  const startEdit = (item: TestItem) => { setEditingId(item.id); setEditDraft({ ...item }) }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await fetch('/api/test-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editDraft }),
      })
      setItems(prev => prev.map(t => t.id === editingId ? { ...t, ...editDraft } : t))
      setEditingId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('このテスト項目を削除しますか？')) return
    try {
      await fetch(`/api/test-items?id=${id}`, { method: 'DELETE' })
      setItems(prev => prev.map(t => t.id === id ? { ...t, isDeleted: true } : t))
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" /><span>テスト項目を読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* 出典モーダル */}
      {sourceModalItem && (
        <SourceRefModal item={sourceModalItem} onClose={() => setSourceModalItem(null)} />
      )}
      {/* 優先度根拠モーダル (■2) */}
      {priorityReasonItem && (
        <PriorityReasonModal item={priorityReasonItem} onClose={() => setPriorityReasonItem(null)} />
      )}
      {/* 自動化根拠モーダル (■2) */}
      {automatableReasonItem && (
        <AutomatableReasonModal item={automatableReasonItem} onClose={() => setAutomatableReasonItem(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">テスト項目書</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI生成されたテスト項目を確認・編集します</p>
        </div>
        <Link href={`/projects/${params.id}/export`} className="btn-primary">
          <Download className="w-4 h-4" />Excel出力
        </Link>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '総テスト数',  value: stats.total,      color: 'text-gray-900' },
          { label: '優先度：高',  value: stats.high,       color: 'text-red-600' },
          { label: '優先度：中',  value: stats.medium,     color: 'text-yellow-600' },
          { label: '優先度：低',  value: stats.low,        color: 'text-green-600' },
          { label: '出典あり',    value: stats.withSource, color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3 text-center">
            <p className={clsx('text-xl font-bold', color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* フィルタ */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="テスト項目を検索..." className="input pl-9 py-1.5"
            value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="input py-1.5 w-36" value={filterMajor} onChange={e => setFilterMajor(e.target.value)}>
          <option value="ALL">全カテゴリ</option>
          {majors.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input py-1.5 w-32" value={filterPriority} onChange={e => setFilterPriority(e.target.value as Priority | 'ALL')}>
          <option value="ALL">全優先度</option>
          <option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option>
        </select>
        <select className="input py-1.5 w-36" value={filterSource} onChange={e => setFilterSource(e.target.value as 'ALL' | 'WITH' | 'WITHOUT')}>
          <option value="ALL">出典：全て</option>
          <option value="WITH">出典あり</option>
          <option value="WITHOUT">出典なし</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card py-20 text-center text-gray-400">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">テスト項目がありません</p>
          <p className="text-xs mt-1">「AIテスト生成」からテスト項目を生成してください</p>
          <Link href={`/projects/${params.id}/generate`} className="btn-primary mt-4 inline-flex">
            AIテスト生成へ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([major, groupItems]) => (
            <div key={major} className="card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => toggleMajor(major)}>
                <div className="flex items-center gap-3">
                  {expandedMajors.has(major)
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="font-semibold text-gray-900">{major}</span>
                  <span className="badge bg-shift-100 text-shift-700">{groupItems.length}件</span>
                  {/* 出典あり件数 */}
                  {(() => {
                    const withSrc = groupItems.filter(t => t.sourceRefs && t.sourceRefs.length > 0).length
                    return withSrc > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                        <BookOpen className="w-3 h-3" />出典{withSrc}件
                      </span>
                    ) : null
                  })()}
                </div>
                <div className="flex gap-1.5">
                  {(['HIGH', 'MEDIUM', 'LOW'] as Priority[]).map(p => {
                    const cnt = groupItems.filter(t => t.priority === p).length
                    return cnt > 0 ? (
                      <span key={p} className={clsx('badge text-xs', priorityColors[p])}>{priorityLabels[p]}:{cnt}</span>
                    ) : null
                  })}
                </div>
              </button>
              {expandedMajors.has(major) && (
                <div className="border-t border-gray-100">
                  <table className="w-full test-table">
                    <thead>
                      <tr>
                        <th className="w-20">テストID</th>
                        <th className="w-24">中分類</th>
                        <th className="w-24">観点</th>
                        <th>テスト項目名</th>
                        <th className="w-16 text-center">優先度</th>
                        <th className="w-20 text-center">自動化</th>
                        <th className="w-16 text-center">出典</th>
                        <th className="w-16 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map(item => (
                        <tr key={item.id}>
                          {editingId === item.id ? (
                            <>
                              <td className="font-mono text-xs text-gray-500">{item.testId}</td>
                              <td><input className="input py-1 text-xs" value={editDraft.categoryMinor || ''}
                                onChange={e => setEditDraft(d => ({ ...d, categoryMinor: e.target.value }))} /></td>
                              <td>
                                <select className="input py-1 text-xs" value={editDraft.testPerspective || ''}
                                  onChange={e => setEditDraft(d => ({ ...d, testPerspective: e.target.value as TestPerspective }))}>
                                  {['機能テスト','正常系','異常系','境界値','セキュリティ','操作性','性能'].map(p => <option key={p}>{p}</option>)}
                                </select>
                              </td>
                              <td><input className="input py-1 text-xs" value={editDraft.testTitle || ''}
                                onChange={e => setEditDraft(d => ({ ...d, testTitle: e.target.value }))} /></td>
                              <td>
                                <select className="input py-1 text-xs" value={editDraft.priority || 'HIGH'}
                                  onChange={e => setEditDraft(d => ({ ...d, priority: e.target.value as Priority }))}>
                                  <option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option>
                                </select>
                              </td>
                              <td>
                                <select className="input py-1 text-xs" value={editDraft.automatable || 'YES'}
                                  onChange={e => setEditDraft(d => ({ ...d, automatable: e.target.value as Automatable }))}>
                                  <option value="YES">自動化可</option><option value="NO">手動のみ</option><option value="CONSIDER">要検討</option>
                                </select>
                              </td>
                              <td />
                              <td>
                                <div className="flex gap-1 justify-center">
                                  <button onClick={saveEdit} disabled={saving} className="p-1 rounded text-green-600 hover:bg-green-50">
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="font-mono text-xs text-gray-500">{item.testId}</td>
                              <td><span className="text-xs text-gray-600">{item.categoryMinor}</span></td>
                              <td><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.testPerspective}</span></td>
                              <td>
                                <div>
                                  <p className="text-sm text-gray-900 font-medium leading-snug">{item.testTitle}</p>
                                  {item.expectedResult && (
                                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">期待: {item.expectedResult}</p>
                                  )}
                                </div>
                              </td>
                              {/* 優先度セル: クリックで根拠モーダル表示 (■2) */}
                              <td className="text-center">
                                <button
                                  onClick={() => setPriorityReasonItem(item)}
                                  title={item.priorityReason ? `根拠: ${item.priorityReason}` : '優先度の根拠を確認'}
                                  className={clsx(
                                    'badge text-xs cursor-pointer hover:opacity-80 transition-opacity',
                                    priorityColors[item.priority],
                                    item.priorityReason ? 'underline decoration-dotted' : ''
                                  )}
                                >
                                  {priorityLabels[item.priority]}
                                </button>
                              </td>
                              {/* 自動化セル: クリックで根拠モーダル表示 (■2) */}
                              <td className="text-center">
                                <button
                                  onClick={() => setAutomatableReasonItem(item)}
                                  title={item.automatableReason ? `根拠: ${item.automatableReason}` : '自動化可否の根拠を確認'}
                                  className={clsx(
                                    'badge text-xs cursor-pointer hover:opacity-80 transition-opacity',
                                    automatableColors[item.automatable],
                                    item.automatableReason ? 'underline decoration-dotted' : ''
                                  )}
                                >
                                  {automatableLabels[item.automatable]}
                                </button>
                              </td>
                              <td className="text-center">
                                <SourceBadge item={item} onClick={() => setSourceModalItem(item)} />
                              </td>
                              <td>
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => startEdit(item)} className="p-1 rounded text-gray-400 hover:bg-shift-50 hover:text-shift-700">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteItem(item.id)} className="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
