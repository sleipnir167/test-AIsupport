import { Redis } from '@upstash/redis'
import type { Project, TestItem, Document } from '@/types'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// ─── キー命名規則 ────────────────────────────────────────────
const KEY = {
  projectList: (userId: string) => `user:${userId}:projects`,
  project:     (id: string)     => `project:${id}`,
  docList:     (projectId: string) => `project:${projectId}:docs`,
  doc:         (id: string)     => `doc:${id}`,
  testList:    (projectId: string) => `project:${projectId}:testitems`,
  testItem:    (id: string)     => `testitem:${id}`,
}

// ─── プロジェクト ────────────────────────────────────────────
export async function getProjects(userId: string): Promise<Project[]> {
  const ids = await redis.smembers(KEY.projectList(userId))
  if (!ids.length) return []
  const projects = await Promise.all(ids.map(id => redis.get<Project>(KEY.project(id))))
  return projects
    .filter((p): p is Project => p !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function getProject(id: string): Promise<Project | null> {
  return redis.get<Project>(KEY.project(id))
}

export async function saveProject(userId: string, project: Project): Promise<void> {
  await redis.set(KEY.project(project.id), project)
  await redis.sadd(KEY.projectList(userId), project.id)
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await redis.del(KEY.project(projectId))
  await redis.srem(KEY.projectList(userId), projectId)
}

export async function updateProject(project: Project): Promise<void> {
  await redis.set(KEY.project(project.id), { ...project, updatedAt: new Date().toISOString() })
}

// ─── ドキュメント ────────────────────────────────────────────
export async function getDocuments(projectId: string): Promise<Document[]> {
  const ids = await redis.smembers(KEY.docList(projectId))
  if (!ids.length) return []
  const docs = await Promise.all(ids.map(id => redis.get<Document>(KEY.doc(id))))
  return docs
    .filter((d): d is Document => d !== null && !d.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getDocument(id: string): Promise<Document | null> {
  return redis.get<Document>(KEY.doc(id))
}

export async function saveDocument(doc: Document): Promise<void> {
  await redis.set(KEY.doc(doc.id), doc)
  await redis.sadd(KEY.docList(doc.projectId), doc.id)
}

export async function updateDocument(doc: Partial<Document> & { id: string }): Promise<void> {
  const existing = await redis.get<Document>(KEY.doc(doc.id))
  if (!existing) return
  await redis.set(KEY.doc(doc.id), { ...existing, ...doc })
}

export async function softDeleteDocument(id: string): Promise<void> {
  const doc = await redis.get<Document>(KEY.doc(id))
  if (!doc) return
  await redis.set(KEY.doc(id), { ...doc, isDeleted: true })
}

// ─── テスト項目 ──────────────────────────────────────────────
export async function getTestItems(projectId: string): Promise<TestItem[]> {
  const ids = await redis.smembers(KEY.testList(projectId))
  if (!ids.length) return []
  const items = await Promise.all(ids.map(id => redis.get<TestItem>(KEY.testItem(id))))
  return items
    .filter((t): t is TestItem => t !== null && !t.isDeleted)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export async function saveTestItem(item: TestItem): Promise<void> {
  await redis.set(KEY.testItem(item.id), item)
  await redis.sadd(KEY.testList(item.projectId), item.id)
}

export async function saveTestItems(items: TestItem[]): Promise<void> {
  if (!items.length) return
  await Promise.all(items.map(item => saveTestItem(item)))
}

export async function updateTestItem(item: Partial<TestItem> & { id: string }): Promise<void> {
  const existing = await redis.get<TestItem>(KEY.testItem(item.id))
  if (!existing) return
  await redis.set(KEY.testItem(item.id), { ...existing, ...item })
}

export async function softDeleteTestItem(id: string): Promise<void> {
  const item = await redis.get<TestItem>(KEY.testItem(id))
  if (!item) return
  await redis.set(KEY.testItem(id), { ...item, isDeleted: true })
}

export async function clearTestItems(projectId: string): Promise<void> {
  const ids = await redis.smembers(KEY.testList(projectId))
  if (!ids.length) return
  await Promise.all(ids.map(id => redis.del(KEY.testItem(id))))
  await redis.del(KEY.testList(projectId))
}
