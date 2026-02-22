'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Search, Filter, Download, Edit3, Trash2, Plus, ChevronDown, ChevronRight,
  X, Save, Loader2
} from 'lucide-react'
import { priorityColors, priorityLabels, automatableColors, automatableLabels } from '@/lib/mock-data'
import type { TestItem, Priority, Automatable, TestPerspective } from '@/types'
import { clsx } from 'clsx'
import Link from 'next/link'

export default function TestItemsPage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState<TestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL')
  const [filterAuto, setFilterAuto] = useState<Automatable | 'ALL'>('ALL')
  const [filterMajor, setFilterMajor] = useState('ALL')
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<TestItem>>({})
  const [saving, setSaving] = useState(false)

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/test-items?projectId=${params.id}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setItems(list)
      // 最初の2カテゴリを展開
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
    return true
  }), [items, searchText, filterPriority, filterAuto, filterMajor])

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
    autoYes: filtered.filter(t => t.automatable === 'YES').length,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">テスト項目書</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI生成されたテスト項目を確認・編集します</p>
        </div>
        <Link href={`/projects/${params.id}/export`} className="btn-primary">
          <Download className="w-4 h-4" />Excel出力
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '総テスト数', value: stats.total, color: 'text-gray-900' },
          { label: '優先度：高', value: stats.high, color: 'text-red-600' },
          { label: '優先度：中', value: stats.medium, color: 'text-yellow-600' },
          { label: '優先度：低', value: stats.low, color: 'text-green-600' },
          { label: '自動化可能', value: stats.autoYes, color: 'text-shift-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3 text-center">
            <p className={clsx('text-xl font-bold', color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

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
        <select className="input py-1.5 w-36" value={filterAuto} onChange={e => setFilterAuto(e.target.value as Automatable | 'ALL')}>
          <option value="ALL">自動化：全て</option>
          <option value="YES">自動化可</option><option value="NO">手動のみ</option><option value="CONSIDER">要検討</option>
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
                        <th className="w-28">中分類</th>
                        <th className="w-24">観点</th>
                        <th>テスト項目名</th>
                        <th className="w-16 text-center">優先度</th>
                        <th className="w-20 text-center">自動化</th>
                        <th className="w-20 text-center">操作</th>
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
                              <td className="text-center">
                                <span className={clsx('badge text-xs', priorityColors[item.priority])}>{priorityLabels[item.priority]}</span>
                              </td>
                              <td className="text-center">
                                <span className={clsx('badge text-xs', automatableColors[item.automatable])}>{automatableLabels[item.automatable]}</span>
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
