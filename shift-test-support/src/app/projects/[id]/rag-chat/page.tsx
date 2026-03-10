'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, Send, Loader2, FileText, Globe, Code2,
  ChevronDown, ChevronUp, Settings, AlertCircle, RotateCcw,
  BookOpen, X, ExternalLink, Sparkles, Database
} from 'lucide-react'
import type { CustomModelEntry } from '@/types'

// ─── 型定義 ─────────────────────────────────────────────────────
interface Source {
  refId: string
  filename: string
  category: string
  pageUrl: string | null
  excerpt: string
  summary: string
  chunkIndex: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  referencedRefIds?: string[]
  ragBreakdown?: { doc: number; site: number; src: number }
  model?: string
  isError?: boolean
}

// ─── 定数 ────────────────────────────────────────────────────────
const MODEL_OPTIONS: CustomModelEntry[] = [
  { id:'deepseek/deepseek-v3.2',            label:'DeepSeek V3.2',          inputCost:'$0.20', outputCost:'$0.35',  feature:'最安クラス',        speed:'高速' },
  { id:'google/gemini-2.5-flash',           label:'Gemini 2.5 Flash',        inputCost:'$0.15', outputCost:'$0.60',  feature:'高精度かつ爆速',    speed:'爆速' },
  { id:'google/gemini-3-flash-preview',     label:'Gemini 3 Flash Preview',  inputCost:'$0.10', outputCost:'$0.40',  feature:'Gemini最新Preview', speed:'爆速' },
  { id:'openai/gpt-5-nano',                 label:'GPT-5 Nano',              inputCost:'$0.05', outputCost:'$0.20',  feature:'最も安価なGPT',     speed:'爆速' },
  { id:'openai/gpt-5.2',                    label:'GPT-5.2',                 inputCost:'$1.75', outputCost:'$14.00', feature:'高精度',            speed:'標準' },
  { id:'anthropic/claude-sonnet-4.6',       label:'Claude Sonnet 4.6',       inputCost:'$3.00', outputCost:'$15.00', feature:'分析・論理に強い',  speed:'標準' },
  { id:'meta-llama/llama-3.3-70b-instruct', label:'Llama 3.3 70B',           inputCost:'$0.12', outputCost:'$0.30',  feature:'OSS・コスパ良好',   speed:'高速' },
  { id:'deepseek/deepseek-r1-0528:free',    label:'DeepSeek R1 (free)',       inputCost:'無料',  outputCost:'無料',   feature:'無料枠・お試し',    speed:'高速', isFree:true },
]

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  customer_doc:    { label: '仕様・要件',     icon: FileText },
  MSOK_knowledge:  { label: 'ナレッジ',       icon: BookOpen },
  source_code:     { label: 'ソースコード',   icon: Code2 },
  site_analysis:   { label: 'サイト構造',     icon: Globe },
}

const SUGGESTED_QUESTIONS = [
  'このシステムの主要な機能を教えてください',
  '認証・ログイン処理はどのように実装されていますか？',
  'テスト計画で特に重要なポイントは何ですか？',
  'APIのエンドポイント一覧と仕様を教えてください',
  'データベースのテーブル構成を教えてください',
  'セキュリティ要件はどのように定義されていますか？',
  'エラーハンドリングの方針を教えてください',
  '画面遷移の全体フローを説明してください',
]

// ─── マークダウン簡易レンダラー ──────────────────────────────────
function renderMarkdown(text: string, referencedRefs: Set<string>): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  const highlightRefs = (line: string): React.ReactNode => {
    const parts = line.split(/(\[REF-\d+\])/g)
    return parts.map((part, pi) => {
      const m = part.match(/^\[REF-(\d+)\]$/)
      if (m) {
        const refId = `REF-${m[1]}`
        const isReferenced = referencedRefs.has(refId)
        return (
          <span key={pi}
            className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer mx-0.5 transition-colors ${
              isReferenced
                ? 'bg-shift-100 text-shift-800 border border-shift-300 hover:bg-shift-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
            📎{refId}
          </span>
        )
      }
      return <span key={pi}>{part}</span>
    })
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{highlightRefs(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} className="text-base font-bold text-gray-900 mt-4 mb-1.5">{highlightRefs(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">{highlightRefs(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(<li key={i} className="text-sm text-gray-700 ml-4 my-0.5 list-disc">{highlightRefs(line.slice(2))}</li>)
    } else if (/^\d+\. /.test(line)) {
      nodes.push(<li key={i} className="text-sm text-gray-700 ml-4 my-0.5 list-decimal">{highlightRefs(line.replace(/^\d+\. /, ''))}</li>)
    } else if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      nodes.push(<pre key={i} className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto my-2 leading-relaxed font-mono">{codeLines.join('\n')}</pre>)
    } else if (line.startsWith('**') && line.endsWith('**')) {
      nodes.push(<p key={i} className="text-sm font-bold text-gray-900 my-1">{highlightRefs(line.slice(2, -2))}</p>)
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />)
    } else {
      // インラインの **bold** 処理
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      const rendered = parts.map((p, pi) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={pi} className="font-semibold">{p.slice(2, -2)}</strong>
        return <span key={pi}>{highlightRefs(p)}</span>
      })
      nodes.push(<p key={i} className="text-sm text-gray-700 my-1 leading-relaxed">{rendered}</p>)
    }
    i++
  }
  return nodes
}

// ─── 出典パネル（右側スライドイン）────────────────────────────────
function SourcePanel({ sources, referencedRefIds, onClose }: {
  sources: Source[]
  referencedRefIds: string[]
  onClose: () => void
}) {
  const referenced = sources.filter(s => referencedRefIds.includes(s.refId))
  const others = sources.filter(s => !referencedRefIds.includes(s.refId))

  return (
    <div className="fixed top-14 right-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-shift-700" />出典情報
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">参照チャンク {sources.length}件</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {referenced.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-shift-700 uppercase tracking-wide mb-2 px-1">
              📎 回答で引用された出典 ({referenced.length}件)
            </p>
            {referenced.map(src => <SourceCard key={src.refId} source={src} highlighted />)}
          </div>
        )}

        {others.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1 mt-3">
              関連する情報 ({others.length}件)
            </p>
            {others.map(src => <SourceCard key={src.refId} source={src} highlighted={false} />)}
          </div>
        )}

        {sources.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">出典情報なし</p>
            <p className="text-xs mt-1">ドキュメントを登録してください</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SourceCard({ source, highlighted }: { source: Source; highlighted: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const catInfo = CATEGORY_LABELS[source.category] ?? { label: source.category, icon: FileText }
  const CatIcon = catInfo.icon

  return (
    <div className={`rounded-xl border transition-all ${highlighted ? 'border-shift-200 bg-shift-50' : 'border-gray-100 bg-gray-50'}`}>
      <button className="w-full text-left p-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${highlighted ? 'bg-shift-200 text-shift-800' : 'bg-gray-200 text-gray-600'}`}>
            {source.refId}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <CatIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">{catInfo.label}</span>
            </div>
            <p className="text-xs font-medium text-gray-800 truncate">{source.filename}</p>
            {source.pageUrl && (
              <p className="text-xs text-blue-500 truncate mt-0.5">{source.pageUrl}</p>
            )}
            {/* サマリー（常に表示） */}
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{source.summary}</p>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 mt-1 pt-2">
          <p className="text-xs font-semibold text-gray-400 mb-1.5">原文抜粋</p>
          <p className="text-xs text-gray-600 leading-relaxed font-mono bg-white rounded-lg p-2 border border-gray-100 whitespace-pre-wrap">{source.excerpt}</p>
          {source.pageUrl && (
            <a href={source.pageUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-2">
              <ExternalLink className="w-3 h-3" />ページを開く
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 吹き出しのREFバッジ（ホバーでサマリーポップアップ）───────────
function RefBadge({ refId, sources }: { refId: string; sources: Source[] }) {
  const [showTip, setShowTip] = useState(false)
  const source = sources.find(s => s.refId === refId)
  if (!source) return null
  const catInfo = CATEGORY_LABELS[source.category] ?? { label: source.category, icon: FileText }
  const CatIcon = catInfo.icon

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className="inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded bg-shift-100 text-shift-800 border border-shift-300 hover:bg-shift-200 cursor-help mx-0.5 transition-colors">
        📎{refId}
      </span>
      {showTip && source && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
          <div className="flex items-center gap-1.5 mb-2">
            <CatIcon className="w-3.5 h-3.5 text-gray-300" />
            <span className="text-gray-300">{catInfo.label}</span>
            <span className="font-bold text-shift-300 ml-auto">{refId}</span>
          </div>
          <p className="font-semibold text-white mb-1 truncate">{source.filename}</p>
          {source.pageUrl && <p className="text-blue-300 truncate text-xs mb-1">{source.pageUrl}</p>}
          <p className="text-gray-300 leading-relaxed">{source.summary}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  )
}

// ─── メインページ ────────────────────────────────────────────────
export default function RagChatPage({ params }: { params: { id: string } }) {
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [modelId, setModelId]           = useState(MODEL_OPTIONS[0]?.id || '')
  const [customModel, setCustomModel]   = useState('')
  const [useCustom, setUseCustom]       = useState(false)
  const [adminModelList, setAdminModelList] = useState<CustomModelEntry[]>(MODEL_OPTIONS)
  const [showSettings, setShowSettings] = useState(false)
  const [ragTopK, setRagTopK]           = useState({ doc: 10, site: 5, src: 8 })
  const [showSourcePanel, setShowSourcePanel] = useState(false)
  const [activeSources, setActiveSources]     = useState<Source[]>([])
  const [activeRefIds, setActiveRefIds]        = useState<string[]>([])
  const [error, setError]               = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/admin/public-settings').then(r => r.json()).then((s: { defaultPlanModelId?: string; customModelList?: CustomModelEntry[] }) => {
      const ml = (s.customModelList && s.customModelList.length > 0) ? s.customModelList : MODEL_OPTIONS
      setAdminModelList(ml)
      if (s.defaultPlanModelId) { setModelId(s.defaultPlanModelId); setUseCustom(!ml.find(m => m.id === s.defaultPlanModelId)) }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const getModel = () => useCustom ? (customModel.trim() || modelId) : modelId

  const sendMessage = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim()
    if (!question || loading) return
    setInput('')
    setError('')

    const userMsg: Message = { id: uuidv4(), role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/rag-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, question, modelOverride: getModel(), history, ragTopK }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '回答の生成に失敗しました')

      const assistantMsg: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources ?? [],
        referencedRefIds: data.referencedRefIds ?? [],
        ragBreakdown: data.ragBreakdown,
        model: data.model,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      const errMsg: Message = {
        id: uuidv4(), role: 'assistant',
        content: `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}`,
        isError: true,
      }
      setMessages(prev => [...prev, errMsg])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, params.id, modelId, customModel, useCustom, ragTopK])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const openSourcePanel = (sources: Source[], refIds: string[]) => {
    setActiveSources(sources); setActiveRefIds(refIds); setShowSourcePanel(true)
  }

  const clearChat = () => {
    if (messages.length > 0 && !confirm('チャット履歴を消去しますか？')) return
    setMessages([]); setShowSourcePanel(false); setError('')
  }

  return (
    <div className={`flex h-[calc(100vh-3.5rem)] flex-col transition-all duration-300 ${showSourcePanel ? 'mr-80' : ''}`}>
      {/* ヘッダー */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-shift-700" />RAG検索チャット
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            ドキュメント・ソースコードの内容について自由に質問できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />クリア
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${showSettings ? 'bg-shift-700 text-white border-shift-700' : 'text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
            <Settings className="w-3.5 h-3.5" />設定
          </button>
        </div>
      </div>

      {/* 設定パネル */}
      {showSettings && (
        <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">AIモデル</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="w-6 px-2 py-2"></th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">モデル名</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">入力</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">出力</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">特徴</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {adminModelList.map(m => (
                    <tr key={m.id} onClick={() => { setModelId(m.id); setUseCustom(false) }}
                      className={`cursor-pointer ${!useCustom && modelId === m.id ? 'bg-shift-50 border-l-2 border-l-shift-700' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
                      <td className="px-2 py-2 text-center"><input type="radio" checked={!useCustom && modelId === m.id} onChange={() => { setModelId(m.id); setUseCustom(false) }} className="accent-shift-700" /></td>
                      <td className="px-3 py-2"><span className="font-medium text-gray-900">{m.label}</span></td>
                      <td className={`px-3 py-2 text-right font-mono ${m.isFree ? 'text-green-600' : 'text-gray-500'}`}>{m.inputCost}</td>
                      <td className={`px-3 py-2 text-right font-mono ${m.isFree ? 'text-green-600' : 'text-gray-500'}`}>{m.outputCost}</td>
                      <td className="px-3 py-2 text-gray-400">{m.feature}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="radio" checked={useCustom} onChange={() => setUseCustom(true)} className="accent-shift-700" id="customModelRadio" />
              <label htmlFor="customModelRadio" className="text-xs text-gray-600">任意のモデル:</label>
              <input type="text" value={customModel} onChange={e => { setCustomModel(e.target.value); setUseCustom(true) }}
                placeholder="例: meta-llama/llama-3.1-70b-instruct" className="input py-1 text-xs font-mono flex-1" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">RAG取得チャンク数</p>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: '📄 ドキュメント', key: 'doc' as const, max: 30 }, { label: '🌐 サイト構造', key: 'site' as const, max: 15 }, { label: '💻 ソースコード', key: 'src' as const, max: 20 }].map(({ label, key, max }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
                  <input type="range" min={0} max={max} step={1} value={ragTopK[key]} onChange={e => setRagTopK(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="flex-1 accent-shift-700" />
                  <span className="text-xs text-gray-500 w-8 text-right">{ragTopK[key]}件</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-3 py-2 bg-shift-50 rounded-lg text-xs text-shift-700">
            選択中: <span className="font-mono font-semibold">{useCustom ? customModel || '（未入力）' : modelId}</span>
          </div>
        </div>
      )}

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 初期画面 */}
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto mt-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-shift-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-shift-700" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">RAG検索チャット</h2>
              <p className="text-sm text-gray-500">
                取り込んだドキュメント・ソースコードに基づいて質問に回答します。<br />
                出典情報がある場合は 📎REF-N のマークと要約で確認できます。
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">よく使われる質問</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="text-left text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-shift-400 hover:bg-shift-50 hover:text-shift-800 transition-all">
                    <Sparkles className="w-3.5 h-3.5 text-shift-400 inline mr-1.5" />{q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[75%] bg-shift-700 text-white rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[88%] space-y-2">
                <div className={`bg-white border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm ${msg.isError ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                  {msg.isError ? (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="prose-sm">
                      {renderMarkdown(msg.content, new Set(msg.referencedRefIds ?? []))}
                    </div>
                  )}
                </div>

                {/* 出典情報バー */}
                {!msg.isError && msg.sources && msg.sources.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap px-1">
                    <button onClick={() => openSourcePanel(msg.sources!, msg.referencedRefIds ?? [])}
                      className="flex items-center gap-1.5 text-xs text-shift-600 bg-shift-50 border border-shift-200 hover:bg-shift-100 px-3 py-1.5 rounded-full transition-colors">
                      <BookOpen className="w-3.5 h-3.5" />
                      出典 {msg.sources.length}件を確認
                      {msg.referencedRefIds && msg.referencedRefIds.length > 0 && (
                        <span className="bg-shift-200 text-shift-800 text-xs font-bold px-1.5 rounded-full ml-1">
                          引用 {msg.referencedRefIds.length}件
                        </span>
                      )}
                    </button>
                    {/* 引用REFバッジ（ホバーでサマリー表示） */}
                    {(msg.referencedRefIds ?? []).map(refId => (
                      <RefBadge key={refId} refId={refId} sources={msg.sources!} />
                    ))}
                    {msg.ragBreakdown && (
                      <span className="text-xs text-gray-400 ml-auto">
                        RAG: Doc={msg.ragBreakdown.doc} Site={msg.ragBreakdown.site} Src={msg.ragBreakdown.src}
                      </span>
                    )}
                  </div>
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
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ドキュメントや設計について質問してください... (Shift+Enterで改行)"
              rows={1}
              className="w-full input py-3 pr-4 resize-none overflow-hidden text-sm leading-relaxed"
              style={{ minHeight: '48px', maxHeight: '160px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
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
        <p className="text-xs text-center text-gray-400 mt-2">
          Enter で送信 / Shift+Enter で改行 ／ 現在のモデル: <span className="font-mono">{useCustom ? customModel || '未入力' : adminModelList.find(m => m.id === modelId)?.label ?? modelId}</span>
        </p>
      </div>

      {/* 出典パネル（右側スライドイン） */}
      {showSourcePanel && (
        <SourcePanel sources={activeSources} referencedRefIds={activeRefIds} onClose={() => setShowSourcePanel(false)} />
      )}
    </div>
  )
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
