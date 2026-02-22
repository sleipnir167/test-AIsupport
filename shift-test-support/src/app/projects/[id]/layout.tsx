'use client'
import { useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import ProjectSidebar from '@/components/layout/ProjectSidebar'
import type { Project } from '@/types'

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const [project, setProject] = useState<Project | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setProject(data) })
      .catch(() => {})
  }, [params.id])

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <ProjectSidebar
        projectId={params.id}
        projectName={project?.name || '読み込み中...'}
      />
      <main className="pt-14 pl-60 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
