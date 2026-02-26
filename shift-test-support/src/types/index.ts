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
