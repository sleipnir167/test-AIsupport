'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Search, Filter, Download, Edit3, Trash2, ChevronDown, ChevronRight,
  X, Save, Loader2, BookOpen, FileText, Globe, Code2, ExternalLink,
  AlertCircle, Zap, MessageCircle, Send, Sparkles, Database, RotateCcw,
  Bot, GripVertical, CheckCircle, PlusCircle, RefreshCw, Minimize2, Maximize2
} from 'lucide-react'
import { priorityColors, priorityLabels, automatableColors, automatableLabels } from '@/lib/mock-data'
import type { TestItem, Priority, Automatable, TestPerspective } from '@/types'
import { clsx } from 'clsx'
import Link from 'next/link'

// カテゴリ表示ラベル
const CATEGORY_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  customer_doc:   { label: '仕様書',       icon: FileText, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  MSOK_knowledge: { label: 'MSOKナレッジ', icon: BookOpen,  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  source_code:    { label: 'ソースコード', icon: Code2,     color: 'bg-gray-100 text-gray-700 border-gray-300' },
  site_analysis:  { label: 'サイト分析',   icon: Globe,     color: 'bg-green-50 text-green-700 border-green-200' },
}

// excerpt から 【導出根拠】 を分離するユーティリティ
function splitExcerpt(excerpt: string): { body: string; derivation: string } {
  const marker = '\n\n【導出根拠】'
  const idx = excerpt.indexOf(marker)
  if (idx === -1) return { body: excerpt, derivation: '' }
  return {
    body: excerpt.slice(0, idx),
    derivation: excerpt.slice(idx + marker.length),
  }
}

// 出典モーダル
function SourceRefModal({ item, onClose }: { item: TestItem; onClose: () => void }) {
  const refs = item.sourceRefs ?? []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-shift-700" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">出典情報</h2>
              <p className="text-xs text-gray-500 truncate max-w-sm">{item.testTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {refs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">出典情報がありません</p>
              <p className="text-xs mt-1">（一般的なWebシステムの知識から生成）</p>
            </div>
          ) : (
            refs.map((ref, i) => {
              const meta = CATEGORY_LABELS[ref.category] ?? CATEGORY_LABELS.customer_doc
              const Icon = meta.icon
              const { body, derivation } = splitExcerpt(ref.excerpt ?? '')
              return (
                <div key={i} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {/* REF番号バッジ (■4) */}
                    {ref.refId && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-shift-100 text-shift-700 border border-shift-200 font-mono">
                        {ref.refId}
                      </span>
                    )}
                    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', meta.color)}>
                      <Icon className="w-3 h-3" />{meta.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">{ref.filename}</span>
                    {ref.pageUrl && (
                      <a href={ref.pageUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-shift-700 hover:underline flex-shrink-0">
                        <ExternalLink className="w-3 h-3" />URL
                      </a>
                    )}
                  </div>
                  {/* 導出根拠（先頭に表示） */}
                  {derivation && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 mb-2">
                      <p className="text-xs text-amber-600 mb-1 font-medium">🔍 導出根拠</p>
                      <p className="text-xs text-amber-800 leading-relaxed">{derivation}</p>
                    </div>
                  )}
                  {/* 該当箇所（excerpt本文） */}
                  {body && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1 font-medium">📄 該当箇所</p>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{body}</p>
                    </div>
                  )}
                  {/* excerpt が空の場合（REF不明等） */}
                  {!body && !derivation && ref.excerpt && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{ref.excerpt}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {refs.length > 0 ? `${refs.length}件の出典` : '出典なし'}
          </p>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 優先度根拠モーダル (■2)
function PriorityReasonModal({ item, onClose }: { item: TestItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">優先度の判定根拠</h2>
              <p className="text-xs text-gray-500 truncate max-w-xs">{item.testTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className={clsx('badge text-sm px-3 py-1', priorityColors[item.priority])}>
              優先度：{priorityLabels[item.priority]}
            </span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium">🤖 AIによる判定根拠</p>
            {item.priorityReason ? (
              <p className="text-sm text-gray-800 leading-relaxed">{item.priorityReason}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">判定根拠の記録がありません</p>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 自動化根拠モーダル (■2)
function AutomatableReasonModal({ item, onClose }: { item: TestItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">自動化可否の判定根拠</h2>
              <p className="text-xs text-gray-500 truncate max-w-xs">{item.testTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className={clsx('badge text-sm px-3 py-1', automatableColors[item.automatable])}>
              {automatableLabels[item.automatable]}
            </span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium">🤖 AIによる判定根拠</p>
            {item.automatableReason ? (
              <p className="text-sm text-gray-800 leading-relaxed">{item.automatableReason}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">判定根拠の記録がありません</p>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 出典バッジ（テーブル行用）
// ─── RAGチャットモーダル ──────────────────────────────────────
interface RagMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function renderSimpleMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('## ')) return <h2 key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.slice(3)}</h2>
    if (line.startsWith('# ')) return <h2 key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.slice(2)}</h2>
    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="text-sm text-gray-700 ml-4 my-0.5 list-disc">{line.slice(2)}</li>
    if (line.trim() === '') return <div key={i} className="h-2" />
    // inline bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={i} className="text-sm text-gray-700 my-0.5 leading-relaxed">
        {parts.map((p, pi) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={pi} className="font-semibold">{p.slice(2, -2)}</strong>
            : <span key={pi}>{p}</span>
        )}
      </p>
    )
  })
}

const TEST_CONTEXT_SUGGESTIONS = [
  'このテストケースの期待結果をより詳しく教えてください',
  '類似するテストケースはありますか？',
  'このテストの前提条件を確認させてください',
  'このテストで想定されるバグパターンは？',
  'テスト手順の詳細を教えてください',
  '関連するAPIや画面はどれですか？',
]

function RagChatModal({ item, projectId, onClose }: {
  item: TestItem
  projectId: string
  onClose: () => void
}) {
  const [messages, setMessages] = useState<RagMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const testContext = `【対象テストケース】\nテストID: ${item.testId}\nカテゴリ: ${item.categoryMajor} > ${item.categoryMinor}\n観点: ${item.testPerspective}\nテスト項目名: ${item.testTitle}${item.expectedResult ? `\n期待結果: ${item.expectedResult}` : ''}${item.priorityReason ? `\n優先度根拠: ${item.priorityReason}` : ''}`

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim()
    if (!question || loading) return
    setInput('')

    const userMsg: RagMessage = { id: uuidv4(), role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const fullQuestion = `${testContext}\n\n【質問】\n${question}`
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/rag-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          question: fullQuestion,
          history,
          ragTopK: { doc: 12, site: 5, src: 10 },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '回答の生成に失敗しました')

      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant', content: data.answer,
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant',
        content: `エラー: ${e instanceof Error ? e.message : String(e)}`,
        isError: true,
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, projectId, testContext])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-3xl h-[85vh] sm:h-[82vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-shift-800 to-shift-700 text-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-shift-300 font-medium mb-0.5">RAGチャット — テストケースに質問</p>
                <p className="text-sm font-bold text-white leading-snug truncate">{item.testTitle}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-shift-300 font-mono">{item.testId}</span>
                  <span className="text-xs text-shift-300">·</span>
                  <span className="text-xs text-shift-300">{item.categoryMajor}</span>
                  <span className="text-xs text-shift-300">·</span>
                  <span className="text-xs bg-white/15 px-1.5 py-0.5 rounded text-shift-100">{item.testPerspective}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-shift-300 hover:text-white"
                  title="チャットをクリア"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-4">

          {/* 初期状態 */}
          {messages.length === 0 && (
            <div className="space-y-5">
              {/* テストケース概要カード */}
              <div className="bg-white border border-shift-100 rounded-xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-shift-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />対象テストケース
                </p>
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.testTitle}</p>
                {item.expectedResult && (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    <span className="font-medium text-gray-600">期待結果:</span> {item.expectedResult}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.categoryMajor}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.categoryMinor}</span>
                  <span className="text-xs bg-shift-50 text-shift-700 px-2 py-0.5 rounded-full border border-shift-200">{item.testPerspective}</span>
                </div>
              </div>

              {/* サジェスト質問 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5 px-1">
                  よく使われる質問
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEST_CONTEXT_SUGGESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)}
                      className="text-left text-xs text-gray-700 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 hover:border-shift-400 hover:bg-shift-50 hover:text-shift-800 transition-all shadow-sm">
                      <Sparkles className="w-3 h-3 text-shift-400 inline mr-1.5" />{q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-2">
                <Database className="w-3.5 h-3.5 text-gray-300" />
                <p className="text-xs text-gray-400">登録済みドキュメント・ソースコードをもとに回答します</p>
              </div>
            </div>
          )}

          {/* メッセージ */}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[78%] bg-shift-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div className={`max-w-[88%] bg-white border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm ${msg.isError ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                  {msg.isError ? (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{msg.content}</p>
                    </div>
                  ) : (
                    <div>{renderSimpleMarkdown(msg.content)}</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">RAGを検索して回答を生成中...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 入力エリア */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="このテストケースについて質問してください... (Shift+Enterで改行)"
                rows={1}
                className="w-full input py-3 pr-4 resize-none overflow-hidden text-sm leading-relaxed"
                style={{ minHeight: '48px', maxHeight: '140px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
                }}
                disabled={loading}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="btn-primary px-4 py-3 flex-shrink-0 disabled:opacity-50 rounded-xl">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-center text-gray-400 mt-1.5">
            Enter で送信 / Shift+Enter で改行 ／ テストケースの内容を踏まえて回答します
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── テスト設計チャットポップアップ ──────────────────────────────
interface DesignAction {
  type: 'add' | 'update' | 'delete'
  item: Partial<TestItem> & { id?: string; testId?: string }
  description: string
}

interface DesignMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: DesignAction[]
  appliedActions?: Set<number>
  isError?: boolean
}

const DESIGN_SUGGESTIONS = [
  '二重申請で不正な挙動をしないことを確認するパターンを作成してください',
  'ログイン画面の異常系テストパターンを追加してください',
  '決済フローの境界値テストを網羅してください',
  'セッションタイムアウトに関するテストケースを追加してください',
  'SQLインジェクション対策のセキュリティテストを追加してください',
  '同時アクセス（並行処理）の異常系テストを作成してください',
]

function DesignChatPopup({
  projectId,
  onClose,
  onItemsChanged,
}: {
  projectId: string
  onClose: () => void
  onItemsChanged: () => void
}) {
  const [messages, setMessages] = useState<DesignMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<number | null>(null)
  const [minimized, setMinimized] = useState(false)

  const popupRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: Math.max(0, window.innerWidth - 680), y: 80 })
  const [size, setSize] = useState({ w: 640, h: 560 })
  const dragging = useRef(false)
  const resizing = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPosition({
          x: Math.max(0, dragStart.current.px + e.clientX - dragStart.current.x),
          y: Math.max(0, dragStart.current.py + e.clientY - dragStart.current.y),
        })
      }
      if (resizing.current) {
        setSize({
          w: Math.max(380, resizeStart.current.w + e.clientX - resizeStart.current.x),
          h: Math.max(300, resizeStart.current.h + e.clientY - resizeStart.current.y),
        })
      }
    }
    const onUp = () => { dragging.current = false; resizing.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const onResizeMouseDown = (e: React.MouseEvent) => {
    resizing.current = true
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    e.preventDefault()
    e.stopPropagation()
  }

  const sendMessage = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim()
    if (!question || loading) return
    setInput('')
    const userMsg: DesignMessage = { id: uuidv4(), role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/design-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userMessage: question, history }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '生成に失敗しました')
      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant', content: data.message,
        actions: data.actions || [], appliedActions: new Set<number>(),
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant',
        content: `エラー: ${e instanceof Error ? e.message : String(e)}`,
        isError: true,
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, projectId])

  const applyAction = async (msgId: string, actionIndex: number, action: DesignAction) => {
    setApplying(actionIndex)
    try {
      const res = await fetch('/api/design-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, actions: [action] }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '適用に失敗しました')
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, appliedActions: new Set([...(m.appliedActions || []), actionIndex]) } : m
      ))
      onItemsChanged()
    } catch (e) {
      alert(`適用エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setApplying(null)
    }
  }

  const applyAllActions = async (msgId: string, actions: DesignAction[], allIndices: number[]) => {
    setApplying(-1)
    try {
      const res = await fetch('/api/design-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, actions }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '適用に失敗しました')
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, appliedActions: new Set(allIndices) } : m
      ))
      onItemsChanged()
    } catch (e) {
      alert(`適用エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setApplying(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const priorityBadge = (p?: string) => {
    if (p === 'HIGH') return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">高</span>
    if (p === 'MEDIUM') return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">中</span>
    return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">低</span>
  }

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: minimized ? 280 : size.w,
        height: minimized ? 'auto' : size.h,
        zIndex: 9999,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        minWidth: 280,
      }}
    >
      {/* ヘッダー（ドラッグ可能） */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{ cursor: 'grab', userSelect: 'none' }}
        className="flex-shrink-0 bg-gradient-to-r from-violet-700 to-indigo-600 text-white px-4 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/70 font-medium">AIテスト設計チャット</p>
              <p className="text-xs font-bold text-white truncate">AIとテスト項目を作成・編集</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {messages.length > 0 && !minimized && (
              <button onClick={() => setMessages([])}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/70 hover:text-white"
                title="チャットをクリア">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setMinimized(v => !v)}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/70 hover:text-white"
              title={minimized ? '展開' : '最小化'}>
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/70 hover:text-white"
              title="閉じる">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {!minimized && (
        <>
          {/* チャットエリア */}
          <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-4" style={{ userSelect: 'text' }}>
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="bg-white border border-violet-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-violet-600" />
                    <p className="text-xs font-semibold text-violet-700">AIテスト設計アシスタント</p>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    テスト項目の追加・編集についてお気軽にご相談ください。
                    AIが現在のテスト項目を把握した上で、具体的なテストケースを提案します。
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">よく使われる依頼</p>
                  <div className="space-y-2">
                    {DESIGN_SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s)}
                        className="w-full text-left text-xs text-gray-700 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-800 transition-all shadow-sm">
                        <Sparkles className="w-3 h-3 text-violet-400 inline mr-1.5" />{s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={clsx(
                  'max-w-[92%] rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-white border border-violet-200 shadow-sm rounded-br-md'
                    : msg.isError
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-white border border-gray-200 shadow-sm rounded-bl-md'
                )}>
                  <div className={clsx('text-sm leading-relaxed', msg.role === 'user' ? 'text-gray-800' : 'text-gray-700')}>
                    {renderSimpleMarkdown(msg.content)}
                  </div>

                  {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500">提案アクション（{msg.actions.length}件）</p>
                        {msg.actions.length > 1 && msg.appliedActions?.size !== msg.actions.length && (
                          <button
                            onClick={() => {
                              const unapplied = msg.actions!.filter((_, i) => !msg.appliedActions?.has(i))
                              const unappliedIndices = msg.actions!.map((_, i) => i).filter(i => !msg.appliedActions?.has(i))
                              applyAllActions(msg.id, unapplied, msg.actions!.map((_, i) => i))
                            }}
                            disabled={applying !== null}
                            className="text-xs px-2.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            {applying === -1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            すべて適用
                          </button>
                        )}
                      </div>
                      {msg.actions.map((action, ai) => {
                        const isApplied = msg.appliedActions?.has(ai)
                        return (
                          <div key={ai} className={clsx(
                            'rounded-xl border p-3 transition-all',
                            isApplied ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-violet-200 hover:bg-violet-50/50'
                          )}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <span className={clsx(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                                    action.type === 'add' ? 'bg-blue-100 text-blue-700' :
                                    action.type === 'delete' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  )}>
                                    {action.type === 'add' ? <PlusCircle className="w-3 h-3" /> :
                                     action.type === 'delete' ? <Trash2 className="w-3 h-3" /> :
                                     <Edit3 className="w-3 h-3" />}
                                    {action.type === 'add' ? '追加' : action.type === 'delete' ? '削除' : '編集'}
                                  </span>
                                  {action.item.priority && priorityBadge(action.item.priority as string)}
                                  {action.item.testPerspective && (
                                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{action.item.testPerspective}</span>
                                  )}
                                </div>
                                {action.item.categoryMajor && (
                                  <p className="text-xs text-gray-400 mb-0.5">
                                    {action.item.categoryMajor}{action.item.categoryMinor ? ` > ${action.item.categoryMinor}` : ''}
                                  </p>
                                )}
                                <p className="text-xs font-semibold text-gray-800 leading-snug">
                                  {action.item.testTitle || action.description}
                                </p>
                                {action.item.expectedResult && (
                                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">期待: {action.item.expectedResult}</p>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {isApplied ? (
                                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" />適用済
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => applyAction(msg.id, ai, action)}
                                    disabled={applying !== null}
                                    className="text-xs px-2.5 py-1 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-600 hover:text-white hover:border-violet-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                                  >
                                    {applying === ai ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                    適用
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    <span className="text-sm">テスト項目を設計中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 入力エリア */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="テスト設計の依頼を入力... (Enterで送信、Shift+Enterで改行)"
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-gray-50"
                rows={2}
                style={{ userSelect: 'text', minHeight: 56 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* リサイズハンドル */}
          <div
            onMouseDown={onResizeMouseDown}
            style={{
              position: 'absolute', right: 4, bottom: 4,
              width: 16, height: 16, cursor: 'nwse-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af',
            }}
          >
            <GripVertical className="w-3.5 h-3.5 rotate-45" />
          </div>
        </>
      )}
    </div>
  )
}

function SourceBadge({ item, onClick }: { item: TestItem; onClick: () => void }) {
  const count = item.sourceRefs?.length ?? 0
  if (count === 0) {
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-gray-300 hover:bg-gray-50 transition-colors"
        title="出典なし">
        <BookOpen className="w-3 h-3" />
        <span>なし</span>
      </button>
    )
  }
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
      title={`${count}件の出典あり`}>
      <BookOpen className="w-3 h-3" />
      <span>{count}件</span>
    </button>
  )
}

export default function TestItemsPage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState<TestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL')
  const [filterAuto, setFilterAuto] = useState<Automatable | 'ALL'>('ALL')
  const [filterMajor, setFilterMajor] = useState('ALL')
  const [filterSource, setFilterSource] = useState<'ALL' | 'WITH' | 'WITHOUT'>('ALL')
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<TestItem>>({})
  const [saving, setSaving] = useState(false)
  const [sourceModalItem, setSourceModalItem] = useState<TestItem | null>(null)
  // ■2: 優先度・自動化根拠モーダル用state
  const [priorityReasonItem, setPriorityReasonItem] = useState<TestItem | null>(null)
  const [automatableReasonItem, setAutomatableReasonItem] = useState<TestItem | null>(null)
  // RAGチャットモーダル
  const [ragChatItem, setRagChatItem] = useState<TestItem | null>(null)
  // テスト設計チャット
  const [showDesignChat, setShowDesignChat] = useState(false)

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/test-items?projectId=${params.id}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const majors = [...new Set(list.map((t: TestItem) => t.categoryMajor))].slice(0, 2)
      setExpandedMajors(new Set(majors as string[]))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [params.id])

  const majors = useMemo(() => [...new Set(items.map(t => t.categoryMajor))], [items])

  const filtered = useMemo(() => items.filter(t => {
    if (t.isDeleted) return false
    if (searchText && !t.testTitle.includes(searchText) && !t.categoryMajor.includes(searchText)) return false
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false
    if (filterAuto !== 'ALL' && t.automatable !== filterAuto) return false
    if (filterMajor !== 'ALL' && t.categoryMajor !== filterMajor) return false
    if (filterSource === 'WITH' && !(t.sourceRefs && t.sourceRefs.length > 0)) return false
    if (filterSource === 'WITHOUT' && (t.sourceRefs && t.sourceRefs.length > 0)) return false
    return true
  }), [items, searchText, filterPriority, filterAuto, filterMajor, filterSource])

  const grouped = useMemo(() => {
    const g: Record<string, TestItem[]> = {}
    filtered.forEach(t => {
      if (!g[t.categoryMajor]) g[t.categoryMajor] = []
      g[t.categoryMajor].push(t)
    })
    return g
  }, [filtered])

  const stats = useMemo(() => ({
    total: filtered.length,
    high: filtered.filter(t => t.priority === 'HIGH').length,
    medium: filtered.filter(t => t.priority === 'MEDIUM').length,
    low: filtered.filter(t => t.priority === 'LOW').length,
    withSource: filtered.filter(t => t.sourceRefs && t.sourceRefs.length > 0).length,
  }), [filtered])

  const toggleMajor = (m: string) =>
    setExpandedMajors(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  const startEdit = (item: TestItem) => { setEditingId(item.id); setEditDraft({ ...item }) }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await fetch('/api/test-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editDraft }),
      })
      setItems(prev => prev.map(t => t.id === editingId ? { ...t, ...editDraft } : t))
      setEditingId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('このテスト項目を削除しますか？')) return
    try {
      await fetch(`/api/test-items?id=${id}`, { method: 'DELETE' })
      setItems(prev => prev.map(t => t.id === id ? { ...t, isDeleted: true } : t))
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" /><span>テスト項目を読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* 出典モーダル */}
      {sourceModalItem && (
        <SourceRefModal item={sourceModalItem} onClose={() => setSourceModalItem(null)} />
      )}
      {/* 優先度根拠モーダル (■2) */}
      {priorityReasonItem && (
        <PriorityReasonModal item={priorityReasonItem} onClose={() => setPriorityReasonItem(null)} />
      )}
      {/* 自動化根拠モーダル (■2) */}
      {automatableReasonItem && (
        <AutomatableReasonModal item={automatableReasonItem} onClose={() => setAutomatableReasonItem(null)} />
      )}
      {/* RAGチャットモーダル */}
      {ragChatItem && (
        <RagChatModal item={ragChatItem} projectId={params.id} onClose={() => setRagChatItem(null)} />
      )}
      {/* テスト設計チャットポップアップ */}
      {showDesignChat && (
        <DesignChatPopup
          projectId={params.id}
          onClose={() => setShowDesignChat(false)}
          onItemsChanged={fetchItems}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">テスト項目書</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI生成されたテスト項目を確認・編集します</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDesignChat(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border bg-violet-600 text-white border-violet-600 hover:bg-violet-700 shadow-sm"
          >
            <Bot className="w-4 h-4" />テスト設計チャット
          </button>
          <Link href={`/projects/${params.id}/export`} className="btn-primary">
            <Download className="w-4 h-4" />Excel出力
          </Link>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '総テスト数',  value: stats.total,      color: 'text-gray-900' },
          { label: '優先度：高',  value: stats.high,       color: 'text-red-600' },
          { label: '優先度：中',  value: stats.medium,     color: 'text-yellow-600' },
          { label: '優先度：低',  value: stats.low,        color: 'text-green-600' },
          { label: '出典あり',    value: stats.withSource, color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3 text-center">
            <p className={clsx('text-xl font-bold', color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* フィルタ */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="テスト項目を検索..." className="input pl-9 py-1.5"
            value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="input py-1.5 w-36" value={filterMajor} onChange={e => setFilterMajor(e.target.value)}>
          <option value="ALL">全カテゴリ</option>
          {majors.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input py-1.5 w-32" value={filterPriority} onChange={e => setFilterPriority(e.target.value as Priority | 'ALL')}>
          <option value="ALL">全優先度</option>
          <option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option>
        </select>
        <select className="input py-1.5 w-36" value={filterSource} onChange={e => setFilterSource(e.target.value as 'ALL' | 'WITH' | 'WITHOUT')}>
          <option value="ALL">出典：全て</option>
          <option value="WITH">出典あり</option>
          <option value="WITHOUT">出典なし</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card py-20 text-center text-gray-400">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">テスト項目がありません</p>
          <p className="text-xs mt-1">「AIテスト生成」からテスト項目を生成してください</p>
          <Link href={`/projects/${params.id}/generate`} className="btn-primary mt-4 inline-flex">
            AIテスト生成へ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([major, groupItems]) => (
            <div key={major} className="card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => toggleMajor(major)}>
                <div className="flex items-center gap-3">
                  {expandedMajors.has(major)
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="font-semibold text-gray-900">{major}</span>
                  <span className="badge bg-shift-100 text-shift-700">{groupItems.length}件</span>
                  {/* 出典あり件数 */}
                  {(() => {
                    const withSrc = groupItems.filter(t => t.sourceRefs && t.sourceRefs.length > 0).length
                    return withSrc > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                        <BookOpen className="w-3 h-3" />出典{withSrc}件
                      </span>
                    ) : null
                  })()}
                </div>
                <div className="flex gap-1.5">
                  {(['HIGH', 'MEDIUM', 'LOW'] as Priority[]).map(p => {
                    const cnt = groupItems.filter(t => t.priority === p).length
                    return cnt > 0 ? (
                      <span key={p} className={clsx('badge text-xs', priorityColors[p])}>{priorityLabels[p]}:{cnt}</span>
                    ) : null
                  })}
                </div>
              </button>
              {expandedMajors.has(major) && (
                <div className="border-t border-gray-100">
                  <table className="w-full test-table">
                    <thead>
                      <tr>
                        <th className="w-20">テストID</th>
                        <th className="w-24">中分類</th>
                        <th className="w-24">観点</th>
                        <th>テスト項目名</th>
                        <th className="w-16 text-center">優先度</th>
                        <th className="w-20 text-center">自動化</th>
                        <th className="w-16 text-center">出典</th>
                        <th className="w-20 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map(item => (
                        <tr key={item.id}>
                          {editingId === item.id ? (
                            <>
                              <td className="font-mono text-xs text-gray-500">{item.testId}</td>
                              <td><input className="input py-1 text-xs" value={editDraft.categoryMinor || ''}
                                onChange={e => setEditDraft(d => ({ ...d, categoryMinor: e.target.value }))} /></td>
                              <td>
                                <select className="input py-1 text-xs" value={editDraft.testPerspective || ''}
                                  onChange={e => setEditDraft(d => ({ ...d, testPerspective: e.target.value as TestPerspective }))}>
                                  {['機能テスト','正常系','異常系','境界値','セキュリティ','操作性','性能'].map(p => <option key={p}>{p}</option>)}
                                </select>
                              </td>
                              <td><input className="input py-1 text-xs" value={editDraft.testTitle || ''}
                                onChange={e => setEditDraft(d => ({ ...d, testTitle: e.target.value }))} /></td>
                              <td>
                                <select className="input py-1 text-xs" value={editDraft.priority || 'HIGH'}
                                  onChange={e => setEditDraft(d => ({ ...d, priority: e.target.value as Priority }))}>
                                  <option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option>
                                </select>
                              </td>
                              <td>
                                <select className="input py-1 text-xs" value={editDraft.automatable || 'YES'}
                                  onChange={e => setEditDraft(d => ({ ...d, automatable: e.target.value as Automatable }))}>
                                  <option value="YES">自動化可</option><option value="NO">手動のみ</option><option value="CONSIDER">要検討</option>
                                </select>
                              </td>
                              <td />
                              <td>
                                <div className="flex gap-1 justify-center">
                                  <button onClick={saveEdit} disabled={saving} className="p-1 rounded text-green-600 hover:bg-green-50">
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="font-mono text-xs text-gray-500">{item.testId}</td>
                              <td><span className="text-xs text-gray-600">{item.categoryMinor}</span></td>
                              <td><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.testPerspective}</span></td>
                              <td>
                                <div>
                                  <p className="text-sm text-gray-900 font-medium leading-snug">{item.testTitle}</p>
                                  {item.expectedResult && (
                                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">期待: {item.expectedResult}</p>
                                  )}
                                </div>
                              </td>
                              {/* 優先度セル: クリックで根拠モーダル表示 (■2) */}
                              <td className="text-center">
                                <button
                                  onClick={() => setPriorityReasonItem(item)}
                                  title={item.priorityReason ? `根拠: ${item.priorityReason}` : '優先度の根拠を確認'}
                                  className={clsx(
                                    'badge text-xs cursor-pointer hover:opacity-80 transition-opacity',
                                    priorityColors[item.priority],
                                    item.priorityReason ? 'underline decoration-dotted' : ''
                                  )}
                                >
                                  {priorityLabels[item.priority]}
                                </button>
                              </td>
                              {/* 自動化セル: クリックで根拠モーダル表示 (■2) */}
                              <td className="text-center">
                                <button
                                  onClick={() => setAutomatableReasonItem(item)}
                                  title={item.automatableReason ? `根拠: ${item.automatableReason}` : '自動化可否の根拠を確認'}
                                  className={clsx(
                                    'badge text-xs cursor-pointer hover:opacity-80 transition-opacity',
                                    automatableColors[item.automatable],
                                    item.automatableReason ? 'underline decoration-dotted' : ''
                                  )}
                                >
                                  {automatableLabels[item.automatable]}
                                </button>
                              </td>
                              <td className="text-center">
                                <SourceBadge item={item} onClick={() => setSourceModalItem(item)} />
                              </td>
                              <td>
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => setRagChatItem(item)}
                                    title="このテストケースについてRAGチャットで質問"
                                    className="p-1 rounded text-gray-400 hover:bg-shift-50 hover:text-shift-700"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => startEdit(item)} className="p-1 rounded text-gray-400 hover:bg-shift-50 hover:text-shift-700">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteItem(item.id)} className="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
