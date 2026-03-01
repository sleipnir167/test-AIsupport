// プロジェクト
export type ProjectStatus = 'setup' | 'analyzing' | 'generated' | 'completed'

export interface Project {
  id: string
  name: string
  description: string
  targetSystem: string
  status: ProjectStatus
  testItemCount: number
  documentCount: number
  hasUrlAnalysis: boolean
  hasSourceCode: boolean
  createdAt: string
  updatedAt: string
}

// ドキュメント
export type DocumentCategory = 'customer_doc' | 'MSOK_knowledge' | 'source_code'
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'error'
export type DocumentSubCategory =
  | '要件定義書' | '機能設計書' | 'テスト計画書' | 'その他'
  | 'チェックリスト' | 'テスト事例' | 'ガイドライン'
  | 'フロントエンド' | 'バックエンド' | 'インフラ'

export interface Document {
  id: string
  projectId: string
  filename: string
  category: DocumentCategory
  subCategory: DocumentSubCategory
  fileSize: number
  mimeType: string
  blobUrl?: string
  status: DocumentStatus
  chunkCount: number | null
  errorMessage: string | null
  isDeleted: boolean
  createdAt: string
}

// サイト分析
export type SiteAnalysisStatus = 'idle' | 'running' | 'completed' | 'error'

export interface PageInfo {
  url: string
  title: string
  forms: number
  buttons: number
  links: number
  description?: string
}

export interface SiteAnalysis {
  id: string
  projectId: string
  targetUrl: string
  status: SiteAnalysisStatus
  pageCount: number
  pages: PageInfo[]
  chunkCount?: number
  createdAt: string
}

// テスト項目
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
export type Automatable = 'YES' | 'NO' | 'CONSIDER'
export type TestPerspective = '機能テスト' | '正常系' | '異常系' | '境界値' | 'セキュリティ' | '操作性' | '性能'

export interface SourceRef {
  filename: string      // 出典ファイル名（例: "要件定義書.pdf"）
  category: string      // customer_doc / MSOK_knowledge / source_code / site_analysis
  excerpt: string       // 該当箇所の抜粋（200文字程度）
  pageUrl?: string      // サイト分析の場合はURL
}

export interface TestItem {
  id: string
  projectId: string
  testId: string
  categoryMajor: string
  categoryMinor: string
  testPerspective: TestPerspective
  testTitle: string
  precondition: string
  steps: string[]
  expectedResult: string
  priority: Priority
  automatable: Automatable
  orderIndex: number
  isDeleted: boolean
  sourceRefs?: SourceRef[]  // 出典情報（AIが参照したドキュメント）
}

// ユーザー
export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

// ─── テスト設計メタ情報 ────────────────────────────────────────
export type Industry = '金融' | '医療' | 'EC' | 'SaaS' | '製造' | '公共' | 'その他'
export type SystemCharacteristic = 'セキュリティ重要' | '高可用性要求' | '並行処理あり' | 'リアルタイム処理' | '大規模データ' | '外部連携多数'
export type DesignApproach = 'リスクベースドテスト' | 'セキュリティ重点設計' | '境界値分析中心' | '状態遷移重視' | 'ユーザビリティ重点' | '性能重点'

export interface DesignMeta {
  industry: Industry
  systemCharacteristics: SystemCharacteristic[]
  designApproaches: DesignApproach[]
  modelId: string
  modelLabel: string
  generatedAt: string
  maxItems: number
  batchSize: number
  ragTopK: { doc: number; site: number; src: number }
  perspectives: string[]
}

// ─── レビュー結果 ──────────────────────────────────────────────
export interface CoverageScore {
  iso25010: number      // ISO/IEC 25010適合率 0-1
  iso29119: number      // ISO/IEC/IEEE 29119観点適合率 0-1
  owasp: number         // OWASP ASVS適合率 0-1
  istqb: number         // ISTQB技法適用率 0-1
  composite: number     // 複合スコア 0-1
}

export interface HeatmapCell {
  category: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  score: number         // 0-1 (高いほど欠陥リスク高)
  reason: string
}

export interface CoverageMissing {
  area: string
  severity: 'critical' | 'high' | 'medium'
  description: string
  suggestedTests: string[]
  relatedStandard: string
}

export interface PerspectiveHeatmapCell {
  perspective: string        // テスト観点名
  count: number             // 実際の件数
  ratio: number             // 全体に占める割合 0-1
  biasLevel: 'over' | 'balanced' | 'under'  // 過多・適正・不足
  recommendation: string    // 推奨コメント
}

export interface ReviewResult {
  id: string
  projectId: string
  createdAt: string
  reviewModelId: string
  reviewModelLabel: string
  targetSource: 'generated' | 'excel'
  totalItems: number
  coverageScore: CoverageScore
  scoreReason: string            // スコアを付けた根拠・説明
  overallSummary: string         // 総評
  missingPerspectives: string[]
  defectRiskAnalysis: string
  improvementSuggestions: string[]
  heatmap: HeatmapCell[]
  perspectiveHeatmap: PerspectiveHeatmapCell[]   // 観点カバレッジヒートマップ
  coverageMissingAreas: CoverageMissing[]
  designMeta?: DesignMeta
}

// 複数Excel比較
export interface ExcelCompareResult {
  files: Array<{
    filename: string
    itemCount: number
    coverageScore: CoverageScore
    uniquePerspectives: string[]
  }>
  matchRate: number       // 一致率 0-1
  differenceAnalysis: string
  differenceDetails: Array<{
    area: string
    fileA: string
    fileB: string
    description: string
  }>
  recommendation: string
}

// ─── AIログ ────────────────────────────────────────────────────
export interface AILogEntry {
  id: string
  projectId: string
  projectName: string
  type: 'generation' | 'review' | 'compare'
  modelId: string
  modelLabel: string
  batchNum?: number
  totalBatches?: number
  createdAt: string

  // プロンプト
  systemPrompt: string
  userPrompt: string

  // レスポンス
  responseText: string         // 生のレスポンス（先頭2000文字）
  outputItemCount: number       // 生成件数（テスト項目数）
  aborted: boolean

  // トークン概算（chars÷4）
  systemTokensEst: number
  userTokensEst: number
  responseTokensEst: number
  totalTokensEst: number

  // 実際のトークン（APIから取得できた場合）
  promptTokensActual?: number
  completionTokensActual?: number
  totalTokensActual?: number

  // RAG情報
  ragBreakdown?: { doc: number; site: number; src: number }
  refMapCount?: number

  // エラー
  error?: string
  elapsedMs: number
}

// ─── プロンプトテンプレート ─────────────────────────────────────
export interface PromptTemplate {
  id: string
  name: string
  description: string
  systemPrompt: string      // 生成AI用システムプロンプト
  reviewSystemPrompt: string  // レビューAI用システムプロンプト
  updatedAt: string
}

// ─── 管理設定 ──────────────────────────────────────────────────
export interface AdminSettings {
  defaultTemperature: number      // 生成AI温度（0-1）
  reviewTemperature: number       // レビューAI温度（0-1）
  defaultMaxTokens: number        // 生成AI max_tokens
  reviewMaxTokens: number         // レビューAI max_tokens
  logRetentionDays: number        // ログ保持日数
  updatedAt: string
}
