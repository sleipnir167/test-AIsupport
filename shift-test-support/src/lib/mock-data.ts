import type { Project, Document, SiteAnalysis, TestItem, User } from '@/types'

export const mockUser: User = {
  id: 'u-001',
  email: 'yamada@shift.co.jp',
  name: '山田 太郎',
  role: 'admin',
}

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: '受発注管理システム v2.0',
    description: 'ECサイト向け受発注管理システムのリニューアルプロジェクト',
    targetSystem: '受発注管理システム',
    status: 'generated',
    testItemCount: 287,
    documentCount: 5,
    createdAt: '2024-11-20T09:00:00Z',
    updatedAt: '2024-12-01T14:32:00Z',
  },
  {
    id: 'proj-002',
    name: '社内ポータルサイト刷新',
    description: '社内ポータルサイトのDX推進に伴うフルリニューアル',
    targetSystem: '社内ポータルシステム',
    status: 'analyzing',
    testItemCount: 0,
    documentCount: 3,
    createdAt: '2024-11-28T10:00:00Z',
    updatedAt: '2024-12-02T09:15:00Z',
  },
  {
    id: 'proj-003',
    name: '顧客管理システム（CRM）',
    description: 'Salesforce移行に伴うカスタム顧客管理システムのテスト支援',
    targetSystem: 'CRMシステム',
    status: 'completed',
    testItemCount: 412,
    documentCount: 8,
    createdAt: '2024-10-15T08:00:00Z',
    updatedAt: '2024-11-25T16:00:00Z',
  },
  {
    id: 'proj-004',
    name: '在庫管理システム',
    description: '倉庫管理システムの在庫機能追加対応',
    targetSystem: '在庫管理システム',
    status: 'setup',
    testItemCount: 0,
    documentCount: 1,
    createdAt: '2024-12-01T11:00:00Z',
    updatedAt: '2024-12-01T11:00:00Z',
  },
]

export const mockDocuments: Document[] = [
  {
    id: 'doc-001',
    projectId: 'proj-001',
    filename: '受発注管理システム_要件定義書_v2.0.pdf',
    category: 'customer_doc',
    subCategory: '要件定義書',
    fileSize: 2457600,
    mimeType: 'application/pdf',
    status: 'completed',
    chunkCount: 142,
    errorMessage: null,
    createdAt: '2024-11-20T09:30:00Z',
    isDeleted: false,
  },
  {
    id: 'doc-002',
    projectId: 'proj-001',
    filename: '受発注管理システム_機能設計書.docx',
    category: 'customer_doc',
    subCategory: '機能設計書',
    fileSize: 1843200,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    status: 'completed',
    chunkCount: 98,
    errorMessage: null,
    createdAt: '2024-11-20T09:35:00Z',
    isDeleted: false,
  },
  {
    id: 'doc-003',
    projectId: 'proj-001',
    filename: 'QAチェックリスト_ECシステム版.xlsx',
    category: 'shift_knowledge',
    subCategory: 'チェックリスト',
    fileSize: 524288,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    status: 'completed',
    chunkCount: 67,
    errorMessage: null,
    createdAt: '2024-11-20T10:00:00Z',
    isDeleted: false,
  },
  {
    id: 'doc-004',
    projectId: 'proj-001',
    filename: 'Shift_QAナレッジベース_2024.pdf',
    category: 'shift_knowledge',
    subCategory: 'ガイドライン',
    fileSize: 5242880,
    mimeType: 'application/pdf',
    status: 'completed',
    chunkCount: 312,
    errorMessage: null,
    createdAt: '2024-11-20T10:05:00Z',
    isDeleted: false,
  },
  {
    id: 'doc-005',
    projectId: 'proj-001',
    filename: 'frontend-src.zip',
    category: 'source_code',
    subCategory: 'フロントエンド',
    fileSize: 10485760,
    mimeType: 'application/zip',
    status: 'completed',
    chunkCount: 445,
    errorMessage: null,
    createdAt: '2024-11-21T09:00:00Z',
    isDeleted: false,
  },
]

export const mockSiteAnalysis: SiteAnalysis = {
  id: 'sa-001',
  projectId: 'proj-001',
  targetUrl: 'https://demo-order-system.example.com',
  status: 'completed',
  pageCount: 23,
  pages: [
    { url: '/', title: 'ホーム', forms: 0, buttons: 3, links: 12 },
    { url: '/login', title: 'ログイン', forms: 1, buttons: 2, links: 3 },
    { url: '/dashboard', title: 'ダッシュボード', forms: 0, buttons: 8, links: 15 },
    { url: '/orders', title: '受注一覧', forms: 2, buttons: 6, links: 20 },
    { url: '/orders/new', title: '新規受注登録', forms: 1, buttons: 4, links: 5 },
    { url: '/orders/:id', title: '受注詳細', forms: 1, buttons: 7, links: 8 },
    { url: '/products', title: '商品管理', forms: 2, buttons: 5, links: 18 },
    { url: '/products/new', title: '商品登録', forms: 1, buttons: 3, links: 4 },
    { url: '/customers', title: '顧客管理', forms: 2, buttons: 5, links: 16 },
    { url: '/settings', title: '設定', forms: 3, buttons: 6, links: 8 },
  ],
  createdAt: '2024-11-22T10:00:00Z',
}

export const mockTestItems: TestItem[] = [
  {
    id: 'ti-001', projectId: 'proj-001', testId: 'TC-001',
    categoryMajor: 'ログイン機能', categoryMinor: '正常系',
    testPerspective: '機能テスト',
    testTitle: '正しいメールアドレスとパスワードでログインできること',
    precondition: '有効なアカウントが存在すること',
    steps: ['メールアドレス入力欄に登録済みメールアドレスを入力する', 'パスワード入力欄に正しいパスワードを入力する', '「ログイン」ボタンをクリックする'],
    expectedResult: 'ダッシュボード画面に遷移し、ユーザー名が表示される',
    priority: 'HIGH', automatable: 'YES', orderIndex: 1, isDeleted: false,
  },
  {
    id: 'ti-002', projectId: 'proj-001', testId: 'TC-002',
    categoryMajor: 'ログイン機能', categoryMinor: '異常系',
    testPerspective: '異常系',
    testTitle: '誤ったパスワードでログインに失敗すること',
    precondition: '有効なアカウントが存在すること',
    steps: ['正しいメールアドレスを入力する', '誤ったパスワードを入力する', '「ログイン」ボタンをクリックする'],
    expectedResult: 'エラーメッセージ「メールアドレスまたはパスワードが正しくありません」が表示される',
    priority: 'HIGH', automatable: 'YES', orderIndex: 2, isDeleted: false,
  },
  {
    id: 'ti-003', projectId: 'proj-001', testId: 'TC-003',
    categoryMajor: 'ログイン機能', categoryMinor: '異常系',
    testPerspective: '境界値',
    testTitle: 'パスワードを5回連続で誤入力するとアカウントがロックされること',
    precondition: '有効なアカウントが存在すること',
    steps: ['誤ったパスワードでログインを5回試みる', '6回目のログイン試行を行う'],
    expectedResult: 'アカウントロックのエラーメッセージが表示され、ログインできない',
    priority: 'HIGH', automatable: 'YES', orderIndex: 3, isDeleted: false,
  },
  {
    id: 'ti-004', projectId: 'proj-001', testId: 'TC-004',
    categoryMajor: '受注登録機能', categoryMinor: '正常系',
    testPerspective: '機能テスト',
    testTitle: '必須項目を全て入力して受注を登録できること',
    precondition: '顧客・商品データが登録済みであること',
    steps: ['受注一覧画面から「新規受注」ボタンをクリックする', '顧客を選択する', '商品を1件以上追加する', '注文日を入力する', '「登録」ボタンをクリックする'],
    expectedResult: '受注が正常に登録され、受注一覧に追加されること。受注番号が自動採番される',
    priority: 'HIGH', automatable: 'YES', orderIndex: 4, isDeleted: false,
  },
  {
    id: 'ti-005', projectId: 'proj-001', testId: 'TC-005',
    categoryMajor: '受注登録機能', categoryMinor: '異常系',
    testPerspective: '異常系',
    testTitle: '必須項目が未入力の場合、バリデーションエラーが表示されること',
    precondition: '受注登録画面が表示されていること',
    steps: ['顧客・商品・注文日を入力せずに「登録」ボタンをクリックする'],
    expectedResult: '各必須項目の下にエラーメッセージが赤文字で表示される',
    priority: 'HIGH', automatable: 'YES', orderIndex: 5, isDeleted: false,
  },
  {
    id: 'ti-006', projectId: 'proj-001', testId: 'TC-006',
    categoryMajor: '受注登録機能', categoryMinor: '境界値',
    testPerspective: '境界値',
    testTitle: '商品数量に0を入力した場合エラーになること',
    precondition: '受注登録画面で商品を追加済みであること',
    steps: ['商品の数量入力欄に「0」を入力する', '「登録」ボタンをクリックする'],
    expectedResult: '「数量は1以上を入力してください」のエラーメッセージが表示される',
    priority: 'MEDIUM', automatable: 'YES', orderIndex: 6, isDeleted: false,
  },
  {
    id: 'ti-007', projectId: 'proj-001', testId: 'TC-007',
    categoryMajor: '受注一覧機能', categoryMinor: '検索・フィルタ',
    testPerspective: '機能テスト',
    testTitle: 'ステータスで絞り込み検索ができること',
    precondition: '複数のステータスの受注が登録されていること',
    steps: ['受注一覧画面を開く', 'ステータスフィルタで「処理中」を選択する'],
    expectedResult: '「処理中」ステータスの受注のみが一覧に表示される',
    priority: 'MEDIUM', automatable: 'YES', orderIndex: 7, isDeleted: false,
  },
  {
    id: 'ti-008', projectId: 'proj-001', testId: 'TC-008',
    categoryMajor: '商品管理機能', categoryMinor: '正常系',
    testPerspective: '機能テスト',
    testTitle: '商品を新規登録できること',
    precondition: '商品管理権限を持つユーザーでログインしていること',
    steps: ['商品管理画面から「商品追加」ボタンをクリックする', '商品名・商品コード・価格・在庫数を入力する', '「登録」ボタンをクリックする'],
    expectedResult: '商品が正常に登録され、商品一覧に表示される',
    priority: 'HIGH', automatable: 'YES', orderIndex: 8, isDeleted: false,
  },
  {
    id: 'ti-009', projectId: 'proj-001', testId: 'TC-009',
    categoryMajor: 'セキュリティ', categoryMinor: '認証・認可',
    testPerspective: 'セキュリティ',
    testTitle: '未ログイン状態でダッシュボードURLに直接アクセスするとログイン画面にリダイレクトされること',
    precondition: 'ブラウザのセッションがない状態',
    steps: ['ブラウザでダッシュボードのURLに直接アクセスする'],
    expectedResult: 'ログイン画面にリダイレクトされる',
    priority: 'HIGH', automatable: 'YES', orderIndex: 9, isDeleted: false,
  },
  {
    id: 'ti-010', projectId: 'proj-001', testId: 'TC-010',
    categoryMajor: 'セキュリティ', categoryMinor: 'XSS対策',
    testPerspective: 'セキュリティ',
    testTitle: 'テキスト入力欄にスクリプトを入力してもXSSが発生しないこと',
    precondition: 'ログイン済みであること',
    steps: ['商品名入力欄に「<script>alert(1)</script>」を入力し登録する', '登録した商品を一覧で表示する'],
    expectedResult: 'スクリプトが実行されず、文字列としてエスケープされて表示される',
    priority: 'HIGH', automatable: 'CONSIDER', orderIndex: 10, isDeleted: false,
  },
  {
    id: 'ti-011', projectId: 'proj-001', testId: 'TC-011',
    categoryMajor: '操作性', categoryMinor: 'フォーム操作',
    testPerspective: '操作性',
    testTitle: 'Tabキーでフォームのフォーカス移動が正しく動作すること',
    precondition: '受注登録画面が表示されていること',
    steps: ['最初の入力欄にフォーカスを当てる', 'Tabキーを順番に押す'],
    expectedResult: '論理的な順序でフォーカスが移動し、全ての入力欄にTabキーでアクセスできる',
    priority: 'MEDIUM', automatable: 'NO', orderIndex: 11, isDeleted: false,
  },
  {
    id: 'ti-012', projectId: 'proj-001', testId: 'TC-012',
    categoryMajor: '操作性', categoryMinor: 'レスポンシブ',
    testPerspective: '操作性',
    testTitle: 'スマートフォン画面幅（375px）でレイアウトが崩れないこと',
    precondition: 'ブラウザの幅を375pxに設定',
    steps: ['各主要画面（ログイン・ダッシュボード・受注一覧・受注詳細）を表示する'],
    expectedResult: '各画面がモバイルレイアウトで適切に表示され、操作可能な状態である',
    priority: 'MEDIUM', automatable: 'NO', orderIndex: 12, isDeleted: false,
  },
]

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const statusLabels = {
  setup: '設定中',
  analyzing: '分析中',
  generated: '生成済',
  completed: '完了',
} as const

export const statusColors = {
  setup: 'bg-gray-100 text-gray-600',
  analyzing: 'bg-blue-100 text-blue-700',
  generated: 'bg-green-100 text-green-700',
  completed: 'bg-shift-100 text-shift-800',
} as const

export const priorityColors = {
  HIGH: 'bg-red-100 text-red-700 border border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border border-green-200',
} as const

export const priorityLabels = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
} as const

export const automatableLabels = {
  YES: '自動化可',
  NO: '手動のみ',
  CONSIDER: '要検討',
} as const

export const automatableColors = {
  YES: 'bg-emerald-100 text-emerald-700',
  NO: 'bg-gray-100 text-gray-600',
  CONSIDER: 'bg-amber-100 text-amber-700',
} as const

export const categoryColors: Record<string, string> = {
  customer_doc: 'bg-blue-100 text-blue-700',
  shift_knowledge: 'bg-purple-100 text-purple-700',
  source_code: 'bg-orange-100 text-orange-700',
}

export const categoryLabels: Record<string, string> = {
  customer_doc: '顧客資料',
  shift_knowledge: 'Shiftナレッジ',
  source_code: 'ソースコード',
}

export const docStatusConfig = {
  pending:    { label: '待機中',  color: 'bg-gray-100 text-gray-500' },
  processing: { label: '処理中',  color: 'bg-blue-100 text-blue-600' },
  completed:  { label: '完了',    color: 'bg-green-100 text-green-700' },
  error:      { label: 'エラー',  color: 'bg-red-100 text-red-600' },
} as const
