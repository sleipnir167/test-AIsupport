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
  const [sidebarVis, setSidebarVis] = useState<Partial<AdminSettings>>({})

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setProject(data) })
      .catch(() => {})

    // AdminSettings を取得してサイドバー表示制御に反映
    fetch('/api/admin/public-settings')
      .then(r => r.json())
      .then((s: Partial<AdminSettings>) => { setSidebarVis(s) })
      .catch(() => {})
  }, [params.id])

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <ProjectSidebar
        projectId={params.id}
        projectName={project?.name || '読み込み中...'}
        showAiLogsTab={sidebarVis.showAiLogsTab ?? true}
        showSidebarDocuments={sidebarVis.showSidebarDocuments ?? true}
        showSidebarUrlAnalysis={sidebarVis.showSidebarUrlAnalysis ?? true}
        showSidebarSourceCode={sidebarVis.showSidebarSourceCode ?? true}
        showSidebarSystemAnalysis={sidebarVis.showSidebarSystemAnalysis ?? true}
        showSidebarRagChat={sidebarVis.showSidebarRagChat ?? true}
        showSidebarGenerate={sidebarVis.showSidebarGenerate ?? true}
        showSidebarTestItems={sidebarVis.showSidebarTestItems ?? true}
        showSidebarExport={sidebarVis.showSidebarExport ?? true}
        showSidebarReview={sidebarVis.showSidebarReview ?? true}
      />
      <main className="pt-14 pl-60 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
