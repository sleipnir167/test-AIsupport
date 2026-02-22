import AppHeader from '@/components/layout/AppHeader'
import ProjectSidebar from '@/components/layout/ProjectSidebar'
import { mockProjects } from '@/lib/mock-data'

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const project = mockProjects.find(p => p.id === params.id) || mockProjects[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <ProjectSidebar projectId={params.id} projectName={project.name} />
      <main className="pt-14 pl-60 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
