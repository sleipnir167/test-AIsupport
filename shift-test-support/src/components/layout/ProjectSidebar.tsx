'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderOpen, FileText, Globe, Code2, Sparkles, ClipboardList,
  Download, ChevronLeft, LayoutDashboard, ShieldCheck
} from 'lucide-react'
import { clsx } from 'clsx'

interface SidebarProps {
  projectId: string
  projectName: string
}

export default function ProjectSidebar({ projectId, projectName }: SidebarProps) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  const navItems = [
    { href: base, label: 'プロジェクト概要', icon: FolderOpen, exact: true },
    { href: `${base}/documents`, label: 'ドキュメント管理', icon: FileText },
    { href: `${base}/url-analysis`, label: 'URL構造分析', icon: Globe },
    { href: `${base}/source-code`, label: 'ソースコード取込', icon: Code2 },
    { href: `${base}/generate`, label: 'AIテスト生成', icon: Sparkles },
    { href: `${base}/test-items`, label: 'テスト項目書', icon: ClipboardList },
    { href: `${base}/export`, label: 'Excel出力', icon: Download },
    { href: `${base}/review`, label: 'AIレビュー・評価', icon: ShieldCheck },
  ]

  return (
    <aside className="w-60 bg-white border-r border-gray-200 fixed top-14 bottom-0 left-0 flex flex-col z-40">
      <div className="p-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-shift-700 mb-3 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>ダッシュボードへ</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-shift-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="w-4 h-4 text-shift-700" />
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{projectName}</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-shift-800 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div className="bg-shift-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-shift-800 mb-1">ヘルプ</p>
          <p className="text-xs text-shift-600">ご不明な点はShiftサポートまでお問い合わせください。</p>
        </div>
      </div>
    </aside>
  )
}
