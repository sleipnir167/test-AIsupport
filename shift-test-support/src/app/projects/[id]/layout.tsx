'use client'
import { useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import ProjectSidebar from '@/components/layout/ProjectSidebar'
import type { Project, AdminSettings } from '@/types'

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const [project, setProject] = useState<Project | null>(null)
  const [sidebarVis, setSidebarVis] = useState<Partial<AdminSettings> | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setProject(data) })
      .catch(() => {})

    // AdminSettings を取得してサイドバー表示制御に反映
    // null のうちはサイドバーを描画しないことでフラッシュを防止
    fetch('/api/admin/public-settings')
      .then(r => r.json())
      .then((s: Partial<AdminSettings>) => { setSidebarVis(s) })
      .catch(() => { setSidebarVis({}) }) // 失敗時はデフォルト（全表示）
  }, [params.id])

  // 設定取得前はサイドバーを描画しない（非表示項目の一瞬表示を防ぐ）
  const vis = sidebarVis ?? {}
  const settingsLoaded = sidebarVis !== null

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      {settingsLoaded && (
        <ProjectSidebar
          projectId={params.id}
          projectName={project?.name || '読み込み中...'}
          showAiLogsTab={vis.showAiLogsTab ?? true}
          showSidebarDocuments={vis.showSidebarDocuments ?? true}
          showSidebarUrlAnalysis={vis.showSidebarUrlAnalysis ?? true}
          showSidebarSourceCode={vis.showSidebarSourceCode ?? true}
          showSidebarSystemAnalysis={vis.showSidebarSystemAnalysis ?? true}
          showSidebarRagChat={vis.showSidebarRagChat ?? true}
          showSidebarGenerate={vis.showSidebarGenerate ?? true}
          showSidebarTestItems={vis.showSidebarTestItems ?? true}
          showSidebarExport={vis.showSidebarExport ?? true}
          showSidebarReview={vis.showSidebarReview ?? true}
        />
      )}
      <main className={`pt-14 min-h-screen transition-[padding] duration-150 ${settingsLoaded ? 'pl-60' : 'pl-0'}`}>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
