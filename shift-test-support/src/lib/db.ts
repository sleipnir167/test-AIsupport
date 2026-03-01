import { Redis } from '@upstash/redis'
import type { Project, TestItem, Document, SiteAnalysis, AILogEntry, PromptTemplate, AdminSettings, TestPlan } from '@/types'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const KEY = {
  projectList:   (userId: string)    => `user:${userId}:projects`,
  project:       (id: string)        => `project:${id}`,
  docList:       (projectId: string) => `project:${projectId}:docs`,
  doc:           (id: string)        => `doc:${id}`,
  testList:      (projectId: string) => `project:${projectId}:testitems`,
  testItem:      (id: string)        => `testitem:${id}`,
  siteAnalysis:  (projectId: string) => `project:${projectId}:siteanalysis`,
  testPlan:      (projectId: string) => `project:${projectId}:testplan`,
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

// ─── サイト分析 ──────────────────────────────────────────────
export async function getSiteAnalysis(projectId: string): Promise<SiteAnalysis | null> {
  return redis.get<SiteAnalysis>(KEY.siteAnalysis(projectId))
}

export async function saveSiteAnalysis(analysis: SiteAnalysis): Promise<void> {
  await redis.set(KEY.siteAnalysis(analysis.projectId), analysis)
}

export async function deleteSiteAnalysis(projectId: string): Promise<void> {
  await redis.del(KEY.siteAnalysis(projectId))
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

/**
 * テスト項目を一括保存する。
 * Upstash Redis の pipeline を使ってリクエスト数を大幅削減する。
 * pipeline は set / sadd を 1 回のHTTPリクエストにまとめる。
 */
export async function saveTestItems(items: TestItem[]): Promise<void> {
  if (!items.length) return
  const CHUNK = 50  // 1パイプラインあたりの最大コマンド数（set + sadd = 2コマンド × 50件 = 100コマンド）
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = items.slice(i, i + CHUNK)
    const pl = redis.pipeline()
    for (const item of batch) {
      pl.set(KEY.testItem(item.id), item)
      pl.sadd(KEY.testList(item.projectId), item.id)
    }
    await pl.exec()
  }
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

// ─── 生成ジョブ ──────────────────────────────────────────────
export interface GenerationJob {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'completed' | 'error'
  stage: number
  message: string
  count?: number
  breakdown?: { documents: number; siteAnalysis: number; sourceCode: number }
  model?: string
  error?: string
  createdAt: string
  updatedAt: string
}

const JOB_KEY = (jobId: string) => `genjob:${jobId}`
const JOB_TTL = 60 * 60 // 1時間でジョブを自動削除

export async function saveJob(job: GenerationJob): Promise<void> {
  await redis.set(JOB_KEY(job.id), job, { ex: JOB_TTL })
}

export async function getJob(jobId: string): Promise<GenerationJob | null> {
  return redis.get<GenerationJob>(JOB_KEY(jobId))
}

export async function updateJob(jobId: string, patch: Partial<GenerationJob>): Promise<void> {
  const existing = await redis.get<GenerationJob>(JOB_KEY(jobId))
  if (!existing) return
  await redis.set(JOB_KEY(jobId), { ...existing, ...patch, updatedAt: new Date().toISOString() }, { ex: JOB_TTL })
}

// ─── AIログ ────────────────────────────────────────────────────

const LOG_KEY = {
  logList:   (projectId: string) => `project:${projectId}:ailogs`,
  log:       (id: string)        => `ailog:${id}`,
  allLogs:                         'global:ailogs',
  template:                        'admin:prompttemplate',
  settings:                        'admin:settings',
}
const LOG_TTL = 60 * 60 * 24 * 30 // 30日

export async function saveAILog(entry: AILogEntry): Promise<void> {
  await redis.set(LOG_KEY.log(entry.id), entry, { ex: LOG_TTL })
  await redis.lpush(LOG_KEY.logList(entry.projectId), entry.id)
  await redis.ltrim(LOG_KEY.logList(entry.projectId), 0, 199) // 最大200件/プロジェクト
  await redis.lpush(LOG_KEY.allLogs, entry.id)
  await redis.ltrim(LOG_KEY.allLogs, 0, 999) // 全体最大1000件
}

export async function getAILogs(projectId: string): Promise<AILogEntry[]> {
  const ids = await redis.lrange(LOG_KEY.logList(projectId), 0, 99)
  if (!ids.length) return []
  const entries = await Promise.all(ids.map(id => redis.get<AILogEntry>(LOG_KEY.log(String(id)))))
  return entries.filter((e): e is AILogEntry => e !== null)
}

export async function getAllAILogs(): Promise<AILogEntry[]> {
  const ids = await redis.lrange(LOG_KEY.allLogs, 0, 299)
  if (!ids.length) return []
  const entries = await Promise.all(ids.map(id => redis.get<AILogEntry>(LOG_KEY.log(String(id)))))
  return entries.filter((e): e is AILogEntry => e !== null)
}

// ─── プロンプトテンプレート ─────────────────────────────────────
const DEFAULT_TEMPLATE: PromptTemplate = {
  id: 'default',
  name: 'デフォルト',
  description: 'システムデフォルトのプロンプトテンプレート',
  systemPrompt: `あなたはソフトウェア品質保証の専門家です。15年以上のQA経験を持ち、E2Eテスト設計・境界値分析・同値分割・デシジョンテーブル・状態遷移テストに精通しています。
提供されたシステム仕様・設計書・サイト構造・ソースコードを分析し、品質を担保するための網羅的なテスト項目書を日本語で作成してください。
必ずJSON配列のみで回答し、マークダウンのコードブロックや説明文は一切含めないでください。
件数は必ず指定された数を出力してください。`,
  reviewSystemPrompt: `あなたはソフトウェアテスト品質保証の第三者評価専門家です。
ISO/IEC 25010、ISO/IEC/IEEE 29119、OWASP ASVS、ISTQBの各標準に精通し、
テスト設計の妥当性を定量的かつ客観的に評価します。
自己正当化バイアスを排除し、第三者視点で厳正に評価してください。
必ずJSON形式のみで回答し、説明文やコードブロックは含めないでください。
improvementSuggestions と coverageMissingAreas の suggestedTests には、
現場エンジニアが「なるほど、こういうテストか」と即理解できる具体的なテストケース例を必ず含めてください。`,
  updatedAt: new Date().toISOString(),
}

export async function getPromptTemplate(): Promise<PromptTemplate> {
  const saved = await redis.get<PromptTemplate>(LOG_KEY.template)
  return saved ?? DEFAULT_TEMPLATE
}

export async function savePromptTemplate(template: Partial<PromptTemplate>): Promise<void> {
  const current = await getPromptTemplate()
  await redis.set(LOG_KEY.template, { ...current, ...template, updatedAt: new Date().toISOString() })
}

// ─── 管理設定 ──────────────────────────────────────────────────
const DEFAULT_SETTINGS: AdminSettings = {
  defaultTemperature: 0.4,
  reviewTemperature: 0.2,
  defaultMaxTokens: 12000,
  reviewMaxTokens: 5000,
  logRetentionDays: 30,
  updatedAt: new Date().toISOString(),
  // モデル初期値
  defaultPlanModelId:   'deepseek/deepseek-v3.2',
  defaultExecModelId:   'deepseek/deepseek-v3.2',
  defaultReviewModelId: 'google/gemini-2.5-flash',
  // 表示制御
  showAiLogsTab:      true,
  showAdvancedParams: false,
  // UI文言
  labelProjectName:   'プロジェクト名',
  labelTargetSystem:  'テスト対象システム',
  labelGenerateButton: 'AIテスト項目を生成する',
  labelReviewButton:  'AIレビューを実行',
  siteTitle:          'AI テスト支援システム',
  // モデルリスト（管理者が追加・編集可能）
  customModelList: [
    { id: 'deepseek/deepseek-v3.2',            label: 'DeepSeek V3.2',         inputCost: '$0.20', outputCost: '$0.35',  feature: '最安クラス。出力量が多いならこれ一択',     speed: '高速' as const },
    { id: 'google/gemini-2.5-flash',           label: 'Gemini 2.5 Flash',       inputCost: '$0.15', outputCost: '$0.60',  feature: '最新Gemini。高精度かつ爆速',              speed: '爆速' as const },
    { id: 'google/gemini-3-flash-preview',     label: 'Gemini 3 Flash Preview', inputCost: '$0.10', outputCost: '$0.40',  feature: 'Gemini最新プレビュー。爆速で大量生成',    speed: '爆速' as const },
    { id: 'openai/gpt-5-nano',                 label: 'GPT-5 Nano',             inputCost: '$0.05', outputCost: '$0.20',  feature: '最も安価なGPT。軽量タスクに最適',         speed: '爆速' as const },
    { id: 'openai/gpt-5.2',                    label: 'GPT-5.2',                inputCost: '$1.75', outputCost: '$14.00', feature: '非常に高精度。複雑なロジックの網羅に強い', speed: '標準' as const },
    { id: 'anthropic/claude-sonnet-4.6',       label: 'Claude Sonnet 4.6',      inputCost: '$3.00', outputCost: '$15.00', feature: 'Anthropic最新。論理的な分析に最強',       speed: '標準' as const },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B',          inputCost: '$0.12', outputCost: '$0.30',  feature: 'Meta製OSS。コスパ良好',                  speed: '高速' as const },
    { id: 'deepseek/deepseek-r1-0528:free',    label: 'DeepSeek R1 (free)',      inputCost: '無料',  outputCost: '無料',   feature: 'OpenRouterの無料枠。お試しに最適',        speed: '高速' as const, isFree: true },
  ],
  // バッチサイズ初期値
  defaultBatchSize: 50,
}
export async function getAdminSettings(): Promise<AdminSettings> {
  const saved = await redis.get<AdminSettings>(LOG_KEY.settings)
  return saved ?? DEFAULT_SETTINGS
}

export async function saveAdminSettings(settings: Partial<AdminSettings>): Promise<void> {
  const current = await getAdminSettings()
  await redis.set(LOG_KEY.settings, { ...current, ...settings, updatedAt: new Date().toISOString() })
}

// ─── テストプラン ──────────────────────────────────────────────
const PLAN_TTL = 60 * 60 * 24 * 7 // 7日

export async function getTestPlan(projectId: string): Promise<TestPlan | null> {
  return redis.get<TestPlan>(KEY.testPlan(projectId))
}

export async function saveTestPlan(plan: TestPlan): Promise<void> {
  await redis.set(KEY.testPlan(plan.projectId), { ...plan, updatedAt: new Date().toISOString() }, { ex: PLAN_TTL })
}

export async function deleteTestPlan(projectId: string): Promise<void> {
  await redis.del(KEY.testPlan(projectId))
}
