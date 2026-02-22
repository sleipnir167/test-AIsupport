'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Plus, Search, FolderOpen, ChevronRight, FileText,
  ClipboardList, Sparkles, TrendingUp, Clock
} from 'lucide-react'
import AppHeader from '@/components/layout/AppHeader'
import { mockProjects, statusLabels, statusColors, formatDate } from '@/lib/mock-data'
import { clsx } from 'clsx'

export default function DashboardPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', targetSystem: '' })

  const filtered = mockProjects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.targetSystem.toLowerCase().includes(search.toLowerCase())
  )

  const stats = [
    { label: '総プロジェクト数', value: mockProjects.length, icon: FolderOpen, color: 'text-shift-700 bg-shift-100' },
    { label: 'テスト項目総数', value: mockProjects.reduce((s, p) => s + p.testItemCount, 0), icon: ClipboardList, color: 'text-green-700 bg-green-100' },
    { label: 'AI生成完了', value: mockProjects.filter(p => p.status === 'generated' || p.status === 'completed').length, icon: Sparkles, color: 'text-purple-700 bg-purple-100' },
    { label: '今月の新規', value: 2, icon: TrendingUp, color: 'text-orange-700 bg-orange-100' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="pt-14 px-6 py-8 max-w-6xl mx-auto">

        {/* Hero */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">ダッシュボード</h1>
          <p className="text-gray-500 text-sm">プロジェクトを選択してテスト支援を開始します</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
                  <Icon className="w-4.5 h-4.5 w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Projects list */}
        <div className="card animate-slide-up">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="section-title">プロジェクト一覧</h2>
            <div className="flex items-center gap-3 flex-1 max-w-md ml-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="プロジェクトを検索..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input pl-9 py-1.5"
                />
              </div>
              <button onClick={() => setShowModal(true)} className="btn-primary whitespace-nowrap">
                <Plus className="w-4 h-4" />
                新規作成
              </button>
            </div>
          </div>

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
                          <span className={clsx('badge', statusColors[project.status])}>
                            {statusLabels[project.status]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{project.description}</p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0 ml-4">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{project.documentCount}件</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>{project.testItemCount.toLocaleString()}件</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(project.updatedAt)}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-shift-600 transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {filtered.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">プロジェクトが見つかりません</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Project Modal */}
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
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn-primary flex-1 justify-center" onClick={() => setShowModal(false)}>作成する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
