'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FileText, Globe, Code2, Sparkles, ClipboardList, Download,
  CheckCircle2, Circle, ArrowRight, AlertCircle, Loader2
} from 'lucide-react'
import { statusLabels, statusColors, formatDateTime } from '@/lib/mock-data'
import { clsx } from 'clsx'
import type { Project, Document } from '@/types'

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${params.id}`).then(r => r.json()),
      fetch(`/api/documents?projectId=${params.id}`).then(r => r.json()),
    ]).then(([p, d]) => {
      if (p?.id) setProject(p)
      setDocs(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }, [params.id])

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">読み込み中...</span>
    </div>
  )

  if (!project) return (
    <div className="text-center py-20 text-gray-400">プロジェクトが見つかりません</div>
  )

  const hasAnalysis = false // URL分析はモック
  const sourceDocs = docs.filter(d => d.category === 'source_code')

  const steps = [
    { href: `/projects/${params.id}/documents`, icon: FileText, title: 'ドキュメント管理',
      desc: '要件定義書・設計書・QAナレッジをアップロード', done: docs.length > 0,
      count: docs.length > 0 ? `${docs.length}件のファイル` : '未追加' },
    { href: `/projects/${params.id}/url-analysis`, icon: Globe, title: 'URL構造分析',
      desc: 'テスト対象サイトのURL・画面構造を解析', done: hasAnalysis,
      count: hasAnalysis ? '解析済' : '未実施（任意）' },
    { href: `/projects/${params.id}/source-code`, icon: Code2, title: 'ソースコード取込',
      desc: 'ソースコードを読み込んでテスト精度を向上', done: sourceDocs.length > 0,
      count: sourceDocs.length > 0 ? `${sourceDocs.length}件取込済` : '任意' },
    { href: `/projects/${params.id}/generate`, icon: Sparkles, title: 'AIテスト生成',
      desc: 'AIが品質プロとしてテスト項目を自動生成', done: project.testItemCount > 0,
      count: project.testItemCount > 0 ? `${project.testItemCount}件生成済` : '未実行' },
    { href: `/projects/${params.id}/test-items`, icon: ClipboardList, title: 'テスト項目書確認',
      desc: 'テスト項目を確認・編集・調整する', done: project.status === 'completed', count: '' },
    { href: `/projects/${params.id}/export`, icon: Download, title: 'Excel出力',
      desc: 'テスト項目書をExcelファイルでダウンロード', done: false, count: '' },
  ]

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <span className={clsx('badge', statusColors[project.status])}>{statusLabels[project.status]}</span>
          </div>
          <p className="text-sm text-gray-500">{project.description}</p>
          <p className="text-xs text-gray-400 mt-1">最終更新：{formatDateTime(project.updatedAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'ドキュメント', value: docs.length, sub: `${docs.filter(d=>d.status==='completed').length}件処理完了` },
          { label: 'テスト項目数', value: project.testItemCount.toLocaleString(), sub: '生成済テスト項目' },
          { label: 'ステータス', value: statusLabels[project.status], sub: project.targetSystem },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-shift-800">{value}</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="section-title">テスト作成フロー</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {steps.map(({ href, icon: Icon, title, desc, done, count }, i) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group">
                <div className="flex-shrink-0">
                  {done ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-gray-300" />}
                </div>
                <div className="w-9 h-9 bg-shift-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-shift-100 transition-colors">
                  <Icon className="w-5 h-5 text-shift-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Step {i + 1}</span>
                    <span className="text-sm font-semibold text-gray-900">{title}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                {count && (
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                    done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}>{count}</span>
                )}
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-shift-600 flex-shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {docs.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">ドキュメントを追加してください</p>
            <p className="text-xs text-amber-600 mt-0.5">AI生成を開始するには「ドキュメント管理」から資料をアップロードしてください。</p>
          </div>
        </div>
      )}
    </div>
  )
}
