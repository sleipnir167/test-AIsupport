'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FileText, Globe, Code2, Sparkles, ClipboardList, Download,
  CheckCircle2, Circle, ArrowRight, AlertCircle, Loader2
} from 'lucide-react'
import { statusLabels, statusColors, formatDateTime } from '@/lib/mock-data'
import { clsx } from 'clsx'
import type { Project, Document, SiteAnalysis } from '@/types'

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${params.id}`).then(r => r.json()),
      fetch(`/api/documents?projectId=${params.id}`).then(r => r.json()),
      fetch(`/api/site-analysis?projectId=${params.id}`).then(r => r.json()),
    ]).then(([p, d, sa]) => {
      if (p?.id) setProject(p)
      setDocs(Array.isArray(d) ? d : [])
      if (sa?.id) setSiteAnalysis(sa)
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

  const completedDocs = docs.filter(d => d.status === 'completed')
  const sourceDocs = docs.filter(d => d.category === 'source_code' && d.status === 'completed')
  const hasAnalysis = !!siteAnalysis

  const steps = [
    {
      href: `/projects/${params.id}/documents`,
      icon: FileText,
      title: 'ドキュメント管理',
      desc: '要件定義書・設計書・QAナレッジをアップロード（RAG）',
      done: completedDocs.length > 0,
      count: completedDocs.length > 0 ? `${completedDocs.length}件処理完了` : '未追加',
      required: true,
    },
    {
      href: `/projects/${params.id}/url-analysis`,
      icon: Globe,
      title: 'URL構造分析',
      desc: '対象サイトの画面構造・UI要素を解析してRAGに格納',
      done: hasAnalysis,
      count: hasAnalysis ? `${siteAnalysis.pageCount}ページ解析・保存済` : '未実施（任意）',
      required: false,
    },
    {
      href: `/projects/${params.id}/source-code`,
      icon: Code2,
      title: 'ソースコード取込',
      desc: 'ソースコードを解析してRAGに格納（精度向上）',
      done: sourceDocs.length > 0,
      count: sourceDocs.length > 0 ? `${sourceDocs.length}件取込済` : '未実施（任意）',
      required: false,
    },
    {
      href: `/projects/${params.id}/generate`,
      icon: Sparkles,
      title: 'AIテスト生成',
      desc: 'RAGデータを活用してAIがテスト項目を自動生成',
      done: project.testItemCount > 0,
      count: project.testItemCount > 0 ? `${project.testItemCount.toLocaleString()}件生成済` : '未実行',
      required: true,
    },
    {
      href: `/projects/${params.id}/test-items`,
      icon: ClipboardList,
      title: 'テスト項目書確認',
      desc: 'テスト項目を確認・編集する',
      done: project.status === 'completed',
      count: '',
      required: false,
    },
    {
      href: `/projects/${params.id}/export`,
      icon: Download,
      title: 'Excel出力',
      desc: 'テスト項目書をExcelファイルでダウンロード',
      done: false,
      count: '',
      required: false,
    },
  ]

  // RAG活用状況
  const ragItems = [
    { label: 'ドキュメント', ready: completedDocs.length > 0, detail: `${completedDocs.length}件` },
    { label: 'URL構造', ready: hasAnalysis, detail: hasAnalysis ? `${siteAnalysis.pageCount}ページ` : '未取得' },
    { label: 'ソースコード', ready: sourceDocs.length > 0, detail: sourceDocs.length > 0 ? `${sourceDocs.length}件` : '未取得' },
  ]

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      {/* ヘッダー */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          <span className={clsx('badge', statusColors[project.status])}>
            {statusLabels[project.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500">{project.description}</p>
        <p className="text-xs text-gray-400 mt-1">最終更新：{formatDateTime(project.updatedAt)}</p>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'ドキュメント', value: completedDocs.length, sub: '処理完了' },
          { label: 'URL解析ページ', value: siteAnalysis?.pageCount || 0, sub: 'RAG格納済' },
          { label: 'ソースコード', value: sourceDocs.length, sub: 'RAG格納済' },
          { label: 'テスト項目数', value: project.testItemCount.toLocaleString(), sub: '生成済' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-shift-800">{value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* RAG活用状況 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          AIテスト生成に使用されるRAGデータ
        </p>
        <div className="flex gap-4">
          {ragItems.map(({ label, ready, detail }) => (
            <div key={label} className={clsx(
              'flex-1 flex items-center gap-2 p-3 rounded-xl border',
              ready ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            )}>
              {ready
                ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <div>
                <p className={clsx('text-xs font-semibold', ready ? 'text-green-800' : 'text-gray-500')}>
                  {label}
                </p>
                <p className={clsx('text-xs', ready ? 'text-green-600' : 'text-gray-400')}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* テスト作成フロー */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="section-title">テスト作成フロー</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="text-red-500">*</span> 必須ステップ
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {steps.map(({ href, icon: Icon, title, desc, done, count, required }, i) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group">
                <div className="flex-shrink-0">
                  {done
                    ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                    : <Circle className="w-6 h-6 text-gray-300" />}
                </div>
                <div className="w-9 h-9 bg-shift-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-shift-100 transition-colors">
                  <Icon className="w-5 h-5 text-shift-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Step {i + 1}</span>
                    <span className="text-sm font-semibold text-gray-900">{title}</span>
                    {required && <span className="text-xs text-red-500">*</span>}
                    {!required && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">任意</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                {count && (
                  <span className={clsx(
                    'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                    done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}>{count}</span>
                )}
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-shift-600 flex-shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 警告 */}
      {completedDocs.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">ドキュメントを追加してください（必須）</p>
            <p className="text-xs text-amber-600 mt-0.5">
              AI生成を開始するには「ドキュメント管理」から要件定義書などをアップロードしてください。
              URL分析・ソースコード取込はテスト精度を向上させる任意のステップです。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
