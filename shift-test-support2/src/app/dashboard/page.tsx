'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus, Search, FolderOpen, ChevronRight, FileText,
  ClipboardList, Sparkles, TrendingUp, Clock, Loader2
} from 'lucide-react'
import AppHeader from '@/components/layout/AppHeader'
import { statusLabels, statusColors, formatDate } from '@/lib/mock-data'
import { clsx } from 'clsx'
import type { Project } from '@/types'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', targetSystem: '' })
  const [error, setError] = useState('')

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.targetSystem.toLowerCase().includes(search.toLowerCase())
  )

  const stats = [
    { label: '総プロジェクト数', value: projects.length, icon: FolderOpen, color: 'text-shift-700 bg-shift-100' },
    { label: 'テスト項目総数', value: projects.reduce((s, p) => s + p.testItemCount, 0), icon: ClipboardList, color: 'text-green-700 bg-green-100' },
    { label: 'AI生成完了', value: projects.filter(p => p.status === 'generated' || p.status === 'completed').length, icon: Sparkles, color: 'text-purple-700 bg-purple-100' },
    { label: '設定中', value: projects.filter(p => p.status === 'setup').length, icon: TrendingUp, color: 'text-orange-700 bg-orange-100' },
  ]

  const handleCreate = async () => {
    if (!newProject.name || !newProject.targetSystem) {
      setError('プロジェクト名とシステム名は必須です')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '作成に失敗しました')
      }
      const created = await res.json()
      setProjects(prev => [created, ...prev])
      setShowModal(false)
      setNewProject({ name: '', description: '', targetSystem: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="pt-14 px-6 py-8 max-w-6xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">ダッシュボード</h1>
          <p className="text-gray-500 text-sm">プロジェクトを選択してテスト支援を開始します</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center mb-3', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="section-title">プロジェクト一覧</h2>
            <div className="flex items-center gap-3 flex-1 max-w-md ml-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="プロジェクトを検索..." value={search}
                  onChange={e => setSearch(e.target.value)} className="input pl-9 py-1.5" />
              </div>
              <button onClick={() => setShowModal(true)} className="btn-primary whitespace-nowrap">
                <Plus className="w-4 h-4" />新規作成
              </button>
            </div>
          </div>
          {loading ? (
            <div className="py-20 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">読み込み中...</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="p-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-shift-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-shift-200 transition-colors">
                          <FolderOpen className="w-5 h-5 text-shift-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <h3 className="font-semibold text-gray-900 text-sm">{project.name}</h3>
                            <span className={clsx('badge', statusColors[project.status])}>{statusLabels[project.status]}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{project.description || project.targetSystem}</p>
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0 ml-4">
                        <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /><span>{project.documentCount}件</span></div>
                        <div className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /><span>{project.testItemCount.toLocaleString()}件</span></div>
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /><span>{formatDate(project.updatedAt)}</span></div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-shift-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {filtered.length === 0 && (
                <div className="py-16 text-center text-gray-400">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">プロジェクトがありません。「新規作成」から始めてください。</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-5">新規プロジェクト作成</h3>
            <div className="space-y-4">
              <div>
                <label className="label">プロジェクト名 <span className="text-red-500">*</span></label>
                <input className="input" placeholder="例：受発注管理システム v2.0"
                  value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
              </div>
              <div>
                <label className="label">テスト対象システム名 <span className="text-red-500">*</span></label>
                <input className="input" placeholder="例：受発注管理システム"
                  value={newProject.targetSystem} onChange={e => setNewProject({ ...newProject, targetSystem: e.target.value })} />
              </div>
              <div>
                <label className="label">説明</label>
                <textarea className="input resize-none" rows={3} placeholder="プロジェクトの説明を入力してください"
                  value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1 justify-center" onClick={() => { setShowModal(false); setError('') }}>キャンセル</button>
              <button className="btn-primary flex-1 justify-center" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
