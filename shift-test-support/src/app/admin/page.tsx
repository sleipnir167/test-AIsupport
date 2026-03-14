'use client'
import { useState, useEffect } from 'react'
import {
  Lock, Settings, FileText, Save, Loader2,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Sliders,
  TerminalSquare, ChevronDown, ChevronUp, Info, Shield,
  Monitor, MessageSquare, MessageCircle, Type, ToggleLeft, ToggleRight,
  Plus, Trash2, RefreshCw, BookOpen, Search, Database, ChevronRight, ExternalLink, Edit3
} from 'lucide-react'
import { clsx } from 'clsx'
import type { AdminSettings, PromptTemplate, CustomModelEntry } from '@/types'

// ─── デフォルト値 ──────────────────────────────────────────────
const DEFAULT_SETTINGS: AdminSettings = {
  defaultTemperature:    0.4,
  reviewTemperature:     0.2,
  defaultMaxTokens:      12000,
  reviewMaxTokens:       5000,
  logRetentionDays:      30,
  updatedAt:             '',
  defaultPlanModelId:    'deepseek/deepseek-v3.2',
  defaultExecModelId:    'deepseek/deepseek-v3.2',
  defaultReviewModelId:  'google/gemini-2.5-flash',
  showAiLogsTab:         true,
  showAdvancedParams:    false,
  labelProjectName:      'プロジェクト名',
  labelTargetSystem:     'テスト対象システム',
  labelGenerateButton:   'AIテスト項目を生成する',
  labelReviewButton:     'AIレビューを実行',
  siteTitle:             'AI テスト支援システム',
  customModelList:       [],
  defaultBatchSize:      50,
  refExcerptLength:      250,
  useHybridSearch:             false,
  useReranking:                false,
  showSidebarDocuments:        true,
  showSidebarUrlAnalysis:      true,
  showSidebarSourceCode:       true,
  showSidebarSystemAnalysis:   true,
  showSidebarRagChat:          true,
  showSidebarGenerate:         true,
  showSidebarTestItems:        true,
  showSidebarExport:           true,
  showSidebarReview:           true,
  defaultRagChatModelId:       '',
  defaultDesignChatModelId:    '',
  ragChatTemperature:          0.3,
  ragChatMaxTokens:            4000,
  designChatTemperature:       0.3,
  designChatMaxTokens:         4000,
  ragChatTopKDoc:              12,
  ragChatTopKSite:             5,
  ragChatTopKSrc:              10,
}

const DEFAULT_TEMPLATE: PromptTemplate = {
  id: 'default', name: 'デフォルト', description: '',
  planningSystemPrompt: '', systemPrompt: '', reviewSystemPrompt: '', updatedAt: '',
}

// ─── 既定モデル一覧（選択肢） ──────────────────────────────────
const KNOWN_MODELS = [
  { id: 'deepseek/deepseek-v3.2',            label: 'DeepSeek V3.2' },
  { id: 'google/gemini-2.5-flash',           label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-3-flash-preview',     label: 'Gemini 3 Flash Preview' },
  { id: 'openai/gpt-5-nano',                 label: 'GPT-5 Nano' },
  { id: 'openai/gpt-5.2',                    label: 'GPT-5.2' },
  { id: 'anthropic/claude-sonnet-4.6',       label: 'Claude Sonnet 4.6' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'deepseek/deepseek-r1-0528:free',    label: 'DeepSeek R1 (free)' },
]

const MODEL_LIMITS = [
  { name: 'DeepSeek V3.2',     context: '128K', maxOutput: '8K' },
  { name: 'Gemini 2.5 Flash',  context: '1M',   maxOutput: '65K' },
  { name: 'GPT-5 Nano',        context: '128K', maxOutput: '16K' },
  { name: 'Claude Sonnet 4.6', context: '200K', maxOutput: '64K' },
  { name: 'Llama 3.3 70B',     context: '128K', maxOutput: '8K' },
]

// ─── タブ型 ────────────────────────────────────────────────────
type TabType = 'settings' | 'models' | 'modellist' | 'ragchat' | 'display' | 'labels' | 'prompts' | 'refmap'

// ─── ModelPickerコンポーネント ─────────────────────────────────
function ModelPicker({
  label, value, onChange, description, models: modelsProp
}: {
  label: string; value: string; onChange: (v: string) => void
  description?: string
  /** カスタムモデルリスト。省略時は KNOWN_MODELS を使用 */
  models?: Array<{ id: string; label: string }>
}) {
  const displayModels = (modelsProp && modelsProp.length > 0) ? modelsProp : KNOWN_MODELS
  const [customMode, setCustomMode] = useState(!displayModels.find(m => m.id === value))
  const [customVal, setCustomVal] = useState(displayModels.find(m => m.id === value) ? '' : value)

  // value が変わったら customMode を再評価
  const isKnown = displayModels.some(m => m.id === value)
  const effectiveCustomMode = customMode && !isKnown || (!customMode && !isKnown && value !== '')

  const handleSelect = (id: string) => {
    setCustomMode(false)
    onChange(id)
  }
  const handleCustom = (v: string) => {
    setCustomVal(v)
    onChange(v)
  }

  return (
    <div>
      <label className="text-xs text-gray-400 mb-2 block">{label}</label>
      {description && <p className="text-xs text-gray-600 mb-2">{description}</p>}
      <div className="space-y-1 mb-2">
        {displayModels.map(m => (
          <label key={m.id} className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
            !effectiveCustomMode && value === m.id ? 'bg-shift-900 border border-shift-700' : 'hover:bg-gray-800'
          )}>
            <input type="radio" name={label} checked={!effectiveCustomMode && value === m.id}
              onChange={() => handleSelect(m.id)} className="accent-shift-500" />
            <span className="text-sm text-gray-200">{m.label}</span>
            <span className="text-xs text-gray-500 font-mono ml-auto">{m.id}</span>
          </label>
        ))}
        <label className={clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
          effectiveCustomMode ? 'bg-shift-900 border border-shift-700' : 'hover:bg-gray-800'
        )}>
          <input type="radio" name={label} checked={effectiveCustomMode}
            onChange={() => { setCustomMode(true); onChange(customVal) }} className="accent-shift-500" />
          <span className="text-sm text-gray-200 flex-shrink-0">任意のモデルIDを指定</span>
          <input
            type="text"
            value={customVal}
            onChange={e => { setCustomMode(true); handleCustom(e.target.value) }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono outline-none focus:border-shift-600"
            placeholder="例: anthropic/claude-opus-4"
          />
        </label>
      </div>
      <p className="text-xs text-shift-400">現在の設定: <span className="font-mono">{value || '（未設定）'}</span></p>
    </div>
  )
}

// ─── ToggleRow ─────────────────────────────────────────────────
function ToggleRow({
  label, description, value, onChange
}: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!value)} className="ml-4 flex-shrink-0">
        {value
          ? <ToggleRight className="w-8 h-8 text-shift-400" />
          : <ToggleLeft className="w-8 h-8 text-gray-600" />}
      </button>
    </div>
  )
}

// ─── LabelEditor ───────────────────────────────────────────────
function LabelEditor({
  label, value, onChange, placeholder
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 w-44 flex-shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-shift-600 transition-colors"
      />
    </div>
  )
}

// ─── ModelListEditor ───────────────────────────────────────────
const SPEED_OPTIONS: CustomModelEntry['speed'][] = ['爆速', '高速', '標準']
const RESPONSE_FORMAT_OPTIONS: Array<{
  value: NonNullable<CustomModelEntry['responseFormat']>
  label: string
  desc: string
}> = [
  { value: 'json_schema', label: 'json_schema（Structured Outputs）', desc: 'OpenAI 系。スキーマ完全準拠保証' },
  { value: 'json_object',  label: 'json_object（JSON モード）',        desc: 'Gemini / DeepSeek / Claude 等' },
  { value: 'none',         label: 'none（送らない）',                  desc: 'エラーが出るモデル向け。プロンプトのみで制御' },
]

function ModelListEditor({
  models, onChange, onSave, saving
}: {
  models: CustomModelEntry[]
  onChange: (list: CustomModelEntry[]) => void
  onSave: () => void
  saving: boolean
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editBuf, setEditBuf] = useState<CustomModelEntry>({
    id: '', label: '', inputCost: '', outputCost: '', feature: '', speed: '高速'
  })

  const startEdit = (idx: number) => {
    setEditIdx(idx)
    setEditBuf({ ...models[idx] })
  }
  const startAdd = () => {
    setEditIdx(-1)
    setEditBuf({ id: '', label: '', inputCost: '', outputCost: '', feature: '', speed: '高速' })
  }
  const cancelEdit = () => setEditIdx(null)
  const commitEdit = () => {
    if (!editBuf.id.trim()) return
    if (editIdx === -1) {
      onChange([...models, { ...editBuf }])
    } else if (editIdx !== null) {
      onChange(models.map((m, i) => i === editIdx ? { ...editBuf } : m))
    }
    setEditIdx(null)
  }
  const removeModel = (idx: number) => onChange(models.filter((_, i) => i !== idx))
  const moveUp = (idx: number) => {
    if (idx === 0) return
    const arr = [...models]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    onChange(arr)
  }
  const moveDown = (idx: number) => {
    if (idx === models.length - 1) return
    const arr = [...models]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    onChange(arr)
  }

  /** モデルIDからレスポンスフォーマットを自動推定して表示するラベル */
  function autoInferLabel(id: string): string {
    const lower = id.toLowerCase()
    if (lower.startsWith('openai/')) return 'json_schema（自動）'
    if (lower.startsWith('google/') || lower.startsWith('anthropic/') ||
        lower.startsWith('deepseek/') || lower.startsWith('meta-llama/') ||
        lower.startsWith('mistralai/') || lower.startsWith('x-ai/')) return 'json_object（自動）'
    return 'none（自動）'
  }

  const EditRow = () => (
    <div className="border-2 border-dashed border-shift-600 rounded-xl p-4 space-y-3 bg-shift-900/20">
      <p className="text-xs font-semibold text-shift-300">{editIdx === -1 ? '新しいモデルを追加' : 'モデルを編集'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">モデルID（OpenRouter形式）</label>
          <input value={editBuf.id} onChange={e => setEditBuf(b => ({ ...b, id: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono outline-none focus:border-shift-600"
            placeholder="例: google/gemini-2.5-pro" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">表示名</label>
          <input value={editBuf.label} onChange={e => setEditBuf(b => ({ ...b, label: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-shift-600"
            placeholder="例: Gemini 2.5 Pro" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">入力コスト（表示用）</label>
          <input value={editBuf.inputCost} onChange={e => setEditBuf(b => ({ ...b, inputCost: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono outline-none focus:border-shift-600"
            placeholder="例: $0.15" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">出力コスト（表示用）</label>
          <input value={editBuf.outputCost} onChange={e => setEditBuf(b => ({ ...b, outputCost: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono outline-none focus:border-shift-600"
            placeholder="例: $0.60" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">特徴説明</label>
          <input value={editBuf.feature} onChange={e => setEditBuf(b => ({ ...b, feature: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-shift-600"
            placeholder="例: 高精度かつコスパ良好" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">速度</label>
          <select value={editBuf.speed} onChange={e => setEditBuf(b => ({ ...b, speed: e.target.value as CustomModelEntry['speed'] }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none">
            {SPEED_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!editBuf.isFree} onChange={e => setEditBuf(b => ({ ...b, isFree: e.target.checked }))}
              className="accent-shift-500 w-4 h-4" />
            <span className="text-xs text-gray-300">無料モデル（緑色強調）</span>
          </label>
        </div>

        {/* ─── JSON出力モード設定 ─── */}
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
            JSON 出力モード
            <span className="text-gray-600 font-normal">（未設定 = モデルIDから自動推定）</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={editBuf.responseFormat ?? ''}
              onChange={e => setEditBuf(b => ({
                ...b,
                responseFormat: e.target.value === ''
                  ? undefined
                  : e.target.value as CustomModelEntry['responseFormat']
              }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-shift-600 w-72"
            >
              <option value="">自動推定（{autoInferLabel(editBuf.id)}）</option>
              {RESPONSE_FORMAT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {editBuf.responseFormat && (
              <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-lg border border-amber-700/40">
                ⚠️ 手動設定中
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {editBuf.responseFormat
              ? RESPONSE_FORMAT_OPTIONS.find(o => o.value === editBuf.responseFormat)?.desc
              : 'モデルIDのプレフィックス（openai/ → json_schema、google/ → json_object 等）から自動判定します。'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={commitEdit} disabled={!editBuf.id.trim() || !editBuf.label.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-shift-700 hover:bg-shift-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40">
          <Save className="w-3.5 h-3.5" />{editIdx === -1 ? '追加' : '保存'}
        </button>
        <button onClick={cancelEdit}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors">
          キャンセル
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 text-blue-300 text-sm flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">モデル一覧管理</p>
          <p className="text-xs text-blue-400/80 mt-0.5">
            テスト生成・レビュー画面のモデル選択肢を管理します。ここで追加したモデルが画面に反映されます。
            モデルIDは <a href="https://openrouter.ai/models" target="_blank" rel="noopener" className="underline">OpenRouter</a> で確認できます。
          </p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-shift-400" />モデル一覧（{models.length}件）
          </h2>
          <button onClick={startAdd} disabled={editIdx !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-shift-800 hover:bg-shift-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" />モデルを追加
          </button>
        </div>

        <div className="divide-y divide-gray-800">
          {models.length === 0 && editIdx !== -1 && (
            <p className="text-center text-gray-500 text-sm py-8">
              モデルがありません。「モデルを追加」から登録してください。
            </p>
          )}
          {editIdx === -1 && <div className="p-4"><EditRow /></div>}
          {models.map((m, idx) => (
            <div key={idx}>
              {editIdx === idx ? (
                <div className="p-4"><EditRow /></div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveUp(idx)} disabled={idx === 0}
                      className="text-gray-600 hover:text-gray-300 disabled:opacity-20 leading-none">▲</button>
                    <button onClick={() => moveDown(idx)} disabled={idx === models.length - 1}
                      className="text-gray-600 hover:text-gray-300 disabled:opacity-20 leading-none">▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200 text-sm">{m.label}</span>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                        m.speed === '爆速' ? 'bg-green-900/50 text-green-300' :
                        m.speed === '高速' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-300'
                      )}>{m.speed === '爆速' ? '⚡ ' : ''}{m.speed}</span>
                      {m.isFree && <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full font-medium">FREE</span>}
                      {m.responseFormat && (
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-mono',
                          m.responseFormat === 'json_schema' ? 'bg-purple-900/50 text-purple-300' :
                          m.responseFormat === 'json_object' ? 'bg-blue-900/40 text-blue-300' :
                          'bg-gray-700/50 text-gray-400'
                        )}>
                          {m.responseFormat}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{m.id}</div>
                    {m.feature && <div className="text-xs text-gray-400 mt-0.5 truncate">{m.feature}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400">
                      <span className={m.isFree ? 'text-emerald-400 font-bold' : ''}>{m.inputCost}</span>
                      {' / '}
                      <span className={m.isFree ? 'text-emerald-400 font-bold' : ''}>{m.outputCost}</span>
                    </div>
                    <div className="text-xs text-gray-600">入力 / 出力 per 1M tokens</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(idx)} disabled={editIdx !== null}
                      className="text-gray-400 hover:text-shift-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-30">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeModel(idx)} disabled={editIdx !== null}
                      className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button onClick={onSave} disabled={saving || editIdx !== null}
        className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? '保存中...' : 'モデル一覧を保存'}
      </button>
    </div>
  )
}

// ─── メインコンポーネント ──────────────────────────────────────
export default function AdminPage() {
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [authed, setAuthed]         = useState(false)
  const [authError, setAuthError]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveOk, setSaveOk]         = useState<string | null>(null)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const [settings, setSettings]   = useState<AdminSettings>(DEFAULT_SETTINGS)
  const [template, setTemplate]   = useState<PromptTemplate>(DEFAULT_TEMPLATE)
  const [activeTab, setActiveTab] = useState<TabType>('settings')
  const [showModelLimits, setShowModelLimits] = useState(false)

  const login = async () => {
    setAuthError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin', { headers: { 'x-admin-password': password } })
      if (!res.ok) { setAuthError('パスワードが違います'); return }
      const data = await res.json()
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      setTemplate(data.template)
      setAuthed(true)
      sessionStorage.setItem('admin_pw', password)
    } catch {
      setAuthError('接続エラー')
    } finally { setLoading(false) }
  }

  const fetchData = async (pw: string) => {
    const res = await fetch('/api/admin', { headers: { 'x-admin-password': pw } })
    if (!res.ok) return
    const data = await res.json()
    setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    setTemplate(data.template)
    setAuthed(true)
  }

  useEffect(() => {
    const pw = sessionStorage.getItem('admin_pw')
    if (pw) { setPassword(pw); fetchData(pw) }
  }, [])

  const saveSettings = async () => {
    setSaving(true); setSaveOk(null); setSaveError(null)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'x-admin-password': password, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_settings', settings }),
      })
      if (!res.ok) throw new Error('保存失敗')
      setSaveOk('設定を保存しました')
      setTimeout(() => setSaveOk(null), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失敗')
    } finally { setSaving(false) }
  }

  const saveTemplate = async () => {
    setSaving(true); setSaveOk(null); setSaveError(null)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'x-admin-password': password, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_template', template }),
      })
      if (!res.ok) throw new Error('保存失敗')
      setSaveOk('プロンプトを保存しました')
      setTimeout(() => setSaveOk(null), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失敗')
    } finally { setSaving(false) }
  }

  // ─── ログイン画面 ──────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-shift-800 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold">管理者設定</h1>
              <p className="text-gray-400 text-xs">Hidden Admin Console</p>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1.5 block">管理者パスワード</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && login()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-shift-600 transition-colors pr-10"
                  placeholder="パスワードを入力..."
                  autoFocus
                />
                <button onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {authError && <p className="text-red-400 text-xs mb-3 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{authError}</p>}
            <button onClick={login} disabled={loading || !password}
              className="w-full py-2.5 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
            <p className="text-gray-600 text-xs text-center mt-3">このページのURLは公開しないでください</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── 管理画面本体 ──────────────────────────────────────────
  const TABS: { id: TabType; label: string; icon: typeof Sliders }[] = [
    { id: 'settings',   label: 'AI実行設定',             icon: Sliders },
    { id: 'models',     label: 'モデル初期値',            icon: Settings },
    { id: 'modellist',  label: 'モデル一覧管理',          icon: Plus },
    { id: 'ragchat',    label: 'チャット設定',            icon: MessageSquare },
    { id: 'display',    label: '表示制御',               icon: Monitor },
    { id: 'labels',     label: 'UI文言',                 icon: Type },
    { id: 'prompts',    label: 'プロンプトテンプレート',  icon: FileText },
    { id: 'refmap',     label: 'REF確認',                icon: BookOpen },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ヘッダー */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-shift-800 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">管理者設定パネル</h1>
            <p className="text-xs text-gray-500">Admin Console · Hidden Page</p>
          </div>
        </div>
        <button onClick={() => { sessionStorage.removeItem('admin_pw'); setAuthed(false) }}
          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          ログアウト
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* タブ */}
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200')}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* 保存通知 */}
        {saveOk && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-900/40 border border-green-700 rounded-xl text-green-300 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{saveOk}
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-900/40 border border-red-700 rounded-xl text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{saveError}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ AI実行設定 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* モデル参考情報 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <button onClick={() => setShowModelLimits(!showModelLimits)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors">
                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />モデル別トークン制限（参考）
                </span>
                {showModelLimits ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showModelLimits && (
                <div className="border-t border-gray-800 p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-800">
                        <th className="text-left pb-2">モデル</th>
                        <th className="text-center pb-2">コンテキスト上限</th>
                        <th className="text-center pb-2">最大出力</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODEL_LIMITS.map(m => (
                        <tr key={m.name} className="border-b border-gray-800/50 text-gray-300">
                          <td className="py-2">{m.name}</td>
                          <td className="text-center py-2 text-blue-300">{m.context}</td>
                          <td className="text-center py-2 text-green-300">{m.maxOutput}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-500 mt-2">※ Max Tokensは出力トークン数の上限です。コンテキスト上限はプロンプト全体の上限。</p>
                </div>
              )}
            </div>

            {/* 生成AI設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-shift-400" />テスト生成AI設定
              </h2>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Temperature（創造性）</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.05"
                      value={settings.defaultTemperature}
                      onChange={e => setSettings(s => ({ ...s, defaultTemperature: parseFloat(e.target.value) }))}
                      className="flex-1 accent-shift-600" />
                    <span className="text-white font-mono w-10 text-right">{settings.defaultTemperature.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">低い=安定・決定的 / 高い=多様・創造的</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Max Output Tokens（最大出力）</label>
                  <input type="number" min="1000" max="64000" step="1000"
                    value={settings.defaultMaxTokens}
                    onChange={e => setSettings(s => ({ ...s, defaultMaxTokens: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 8000〜16000</p>
                </div>
              </div>
            </div>

            {/* レビューAI設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />レビューAI設定
              </h2>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Temperature（判定の厳格さ）</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.05"
                      value={settings.reviewTemperature}
                      onChange={e => setSettings(s => ({ ...s, reviewTemperature: parseFloat(e.target.value) }))}
                      className="flex-1 accent-purple-600" />
                    <span className="text-white font-mono w-10 text-right">{settings.reviewTemperature.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">低い=厳格・一貫（推奨: 0.1〜0.3）</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Max Output Tokens（最大出力）</label>
                  <input type="number" min="1000" max="32000" step="500"
                    value={settings.reviewMaxTokens}
                    onChange={e => setSettings(s => ({ ...s, reviewMaxTokens: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 4000〜8000</p>
                </div>
              </div>
            </div>

            {/* ログ設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-400" />ログ設定
              </h2>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">ログ保持日数</label>
                <input type="number" min="1" max="90"
                  value={settings.logRetentionDays}
                  onChange={e => setSettings(s => ({ ...s, logRetentionDays: parseInt(e.target.value) }))}
                  className="w-40 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                <p className="text-xs text-gray-600 mt-1">Redisの有効期限に反映（現在: 30日固定）</p>
              </div>
            </div>

            {/* バッチサイズ初期値 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />バッチサイズ初期値
              </h2>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">1回のAI呼び出しで生成する件数（バッチサイズ）の初期値</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {[25, 50, 75, 100].map(v => (
                    <button key={v} onClick={() => setSettings(s => ({ ...s, defaultBatchSize: v }))}
                      className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        settings.defaultBatchSize === v
                          ? 'bg-shift-700 text-white border-shift-700'
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500')}>
                      {v}件
                    </button>
                  ))}
                  <input type="number" min={10} max={200}
                    value={settings.defaultBatchSize ?? 50}
                    onChange={e => setSettings(s => ({ ...s, defaultBatchSize: parseInt(e.target.value) || 50 }))}
                    className="w-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  ユーザーのテスト生成画面で初期表示される値です。ユーザーは画面から変更できます。
                  ⚠️ 爆速モデルは100件も可。DeepSeekは50件以下推奨（Vercel 60秒制限）
                </p>
              </div>
            </div>

            {/* REF抜粋文字数 (■3) */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />REF抜粋・出典情報の文字数
              </h2>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">
                  出典情報「該当箇所」の表示文字数（REFマップのexcerpt・テスト項目書の出典モーダル一律適用）
                </label>
                <div className="flex gap-2 items-center flex-wrap">
                  {[100, 250, 500, 800].map(v => (
                    <button key={v} onClick={() => setSettings(s => ({ ...s, refExcerptLength: v }))}
                      className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        (settings.refExcerptLength ?? 250) === v
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500')}>
                      {v}文字
                    </button>
                  ))}
                  <input type="number" min={50} max={2000} step={50}
                    value={settings.refExcerptLength ?? 250}
                    onChange={e => setSettings(s => ({ ...s, refExcerptLength: parseInt(e.target.value) || 250 }))}
                    className="w-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <span className="text-xs text-gray-500">文字</span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  変更はプランニング実行後に反映されます。既存のREFマップには影響しません。<br />
                  大きいほど出典根拠の可視性が上がりますが、プロンプト長が増加します（推奨: 250〜500）。
                </p>
              </div>
            </div>

            <button onClick={saveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ モデル初期値 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">モデル初期値について</p>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  ここで設定したモデルIDがユーザーの画面でデフォルト選択されます。
                  ユーザーは画面上でいつでも変更できます。
                </p>
              </div>
            </div>

            {/* モデル一覧管理タブの内容が反映される旨を案内 */}
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 text-gray-400 text-xs flex items-start gap-2">
              <span className="text-shift-400 font-mono mt-0.5">ℹ</span>
              <span>
                以下の選択肢は<strong className="text-gray-300">「モデル一覧管理」タブ</strong>で登録したモデルと連動します。
                モデルを追加・削除した場合は再読み込みしてください。
              </span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-8">
              <ModelPicker
                label="① プランニング用デフォルトモデル"
                description="generate ページ「プランニング用AIモデル」の初期選択。テスト設計方針の立案に使用します。"
                value={settings.defaultPlanModelId}
                onChange={v => setSettings(s => ({ ...s, defaultPlanModelId: v }))}
                models={settings.customModelList ?? []}
              />
              <hr className="border-gray-800" />
              <ModelPicker
                label="② 実行用デフォルトモデル"
                description="generate ページ「実行用AIモデル」の初期選択。テスト項目詳細の生成に使用します。"
                value={settings.defaultExecModelId}
                onChange={v => setSettings(s => ({ ...s, defaultExecModelId: v }))}
                models={settings.customModelList ?? []}
              />
              <hr className="border-gray-800" />
              <ModelPicker
                label="③ レビュー用デフォルトモデル"
                description="review ページ「レビューに使用するAIモデル」の初期選択。生成とは別モデルの使用を推奨します。"
                value={settings.defaultReviewModelId}
                onChange={v => setSettings(s => ({ ...s, defaultReviewModelId: v }))}
                models={settings.customModelList ?? []}
              />
              <hr className="border-gray-800" />
              <ModelPicker
                label="④ RAGチャット用デフォルトモデル"
                description="テスト項目書・RAGチャット画面で使用するモデル。空欄の場合は①プランニング用モデルが適用されます。"
                value={settings.defaultRagChatModelId ?? ''}
                onChange={v => setSettings(s => ({ ...s, defaultRagChatModelId: v }))}
                models={[{ id: '', label: '（プランニング用モデルと共通）' }, ...(settings.customModelList ?? [])]}
              />
              <hr className="border-gray-800" />
              <ModelPicker
                label="⑤ テスト設計チャット用デフォルトモデル"
                description="テスト設計チャットポップアップで使用するモデル。空欄の場合は①プランニング用モデルが適用されます。"
                value={settings.defaultDesignChatModelId ?? ''}
                onChange={v => setSettings(s => ({ ...s, defaultDesignChatModelId: v }))}
                models={[{ id: '', label: '（プランニング用モデルと共通）' }, ...(settings.customModelList ?? [])]}
              />
            </div>

            <button onClick={saveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : 'モデル初期値を保存'}
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ チャット設定 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'ragchat' && (
          <div className="space-y-6">
            <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 text-blue-300 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">RAGチャット・テスト設計チャットの設定</p>
                <p className="text-xs text-blue-400/80 mt-0.5">
                  モデルの初期値は「モデル初期値」タブで設定できます。ここではTemperature・MaxTokens・RAG検索件数を設定します。
                </p>
              </div>
            </div>

            {/* RAGチャット設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />RAGチャット設定
              </h2>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Temperature（回答の創造性）</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.05"
                      value={settings.ragChatTemperature ?? 0.3}
                      onChange={e => setSettings(s => ({ ...s, ragChatTemperature: parseFloat(e.target.value) }))}
                      className="flex-1 accent-blue-600" />
                    <span className="text-white font-mono w-10 text-right">{(settings.ragChatTemperature ?? 0.3).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">推奨: 0.2〜0.4（事実回答なので低め推奨）</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Max Output Tokens</label>
                  <input type="number" min="500" max="16000" step="500"
                    value={settings.ragChatMaxTokens ?? 4000}
                    onChange={e => setSettings(s => ({ ...s, ragChatMaxTokens: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 2000〜6000</p>
                </div>
              </div>

              <hr className="border-gray-800 my-5" />
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-shift-400" />RAG検索件数（TopK）
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                チャット時にベクトル検索で取得するチャンク件数。多いほど精度が上がりますが、コンテキスト長・コストが増加します。
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">ドキュメント（仕様書等）</label>
                  <input type="number" min="1" max="30"
                    value={settings.ragChatTopKDoc ?? 12}
                    onChange={e => setSettings(s => ({ ...s, ragChatTopKDoc: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 10〜15</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">サイト分析</label>
                  <input type="number" min="1" max="20"
                    value={settings.ragChatTopKSite ?? 5}
                    onChange={e => setSettings(s => ({ ...s, ragChatTopKSite: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 3〜8</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">ソースコード</label>
                  <input type="number" min="1" max="30"
                    value={settings.ragChatTopKSrc ?? 10}
                    onChange={e => setSettings(s => ({ ...s, ragChatTopKSrc: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 8〜15</p>
                </div>
              </div>
            </div>

            {/* テスト設計チャット設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-violet-400" />テスト設計チャット設定
              </h2>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Temperature（提案の多様性）</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.05"
                      value={settings.designChatTemperature ?? 0.3}
                      onChange={e => setSettings(s => ({ ...s, designChatTemperature: parseFloat(e.target.value) }))}
                      className="flex-1 accent-violet-600" />
                    <span className="text-white font-mono w-10 text-right">{(settings.designChatTemperature ?? 0.3).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">推奨: 0.2〜0.4（安定したテスト項目生成向け）</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Max Output Tokens</label>
                  <input type="number" min="500" max="16000" step="500"
                    value={settings.designChatMaxTokens ?? 4000}
                    onChange={e => setSettings(s => ({ ...s, designChatMaxTokens: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                  <p className="text-xs text-gray-600 mt-1">推奨: 3000〜6000（テスト項目が多い場合は増やす）</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 text-xs">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />モデルの設定について
              </p>
              <p>各チャットで使用するモデルは「モデル初期値」タブの ④RAGチャット用・⑤テスト設計チャット用 で設定できます。未設定の場合は①プランニング用モデルが使われます。</p>
            </div>

            <button onClick={saveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : 'チャット設定を保存'}
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ モデル一覧管理 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'modellist' && (
          <ModelListEditor
            models={settings.customModelList ?? []}
            onChange={list => setSettings(s => ({ ...s, customModelList: list }))}
            onSave={saveSettings}
            saving={saving}
          />
        )}

        {/* ━━━━━━━━━━━━━━━━━ 表示制御 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'display' && (
          <div className="space-y-6">
            {/* 画面表示制御（AI関連） */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-400" />画面表示制御
              </h2>
              <ToggleRow
                label="詳細パラメータを初期展開"
                description="generate ページの「生成パラメータ」アコーディオンを最初から開いた状態にします。"
                value={settings.showAdvancedParams}
                onChange={v => setSettings(s => ({ ...s, showAdvancedParams: v }))}
              />
            </div>

            {/* サイドバー項目制御 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-1 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-shift-400" />サイドバーナビゲーション項目
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                OFFにした項目はサイドバーから非表示になります。アプリの表示順と同じ順番で設定できます。
              </p>
              {([
                { key: 'showSidebarDocuments',      label: 'ドキュメント管理',   desc: '仕様書・設計書・QAナレッジの管理画面' },
                { key: 'showSidebarUrlAnalysis',    label: 'URL構造分析',        desc: 'WebアプリのURL・サイト構造解析' },
                { key: 'showSidebarSourceCode',     label: 'ソースコード取込',   desc: 'ソースコードのアップロード・RAGインデックス' },
                { key: 'showSidebarSystemAnalysis', label: 'システム分析',       desc: 'AIによるシステム理解・テスト方針分析' },
                { key: 'showSidebarRagChat',        label: 'RAG検索チャット',    desc: 'ドキュメントへの質問応答チャット' },
                { key: 'showSidebarGenerate',       label: 'AIテスト生成',       desc: 'テスト項目の自動生成（メイン機能）' },
                { key: 'showSidebarTestItems',      label: 'テスト項目書',       desc: 'テスト項目の表示・編集・設計チャット' },
                { key: 'showSidebarExport',         label: 'Excel出力',          desc: 'テスト項目書のExcelダウンロード' },
                { key: 'showSidebarReview',         label: 'AIレビュー・評価',   desc: 'テスト品質のAI評価・スコアリング' },
                { key: 'showAiLogsTab',             label: 'AIやり取りログ',     desc: 'AI処理のプロンプト・レスポンス・トークン数の閲覧（非表示でもログは記録）' },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, [key]: !(s[key] ?? true) }))}
                    className="ml-4 flex-shrink-0">
                    {(settings[key] ?? true)
                      ? <ToggleRight className="w-8 h-8 text-shift-400" />
                      : <ToggleLeft className="w-8 h-8 text-gray-600" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 text-xs">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />表示制御の反映タイミング
              </p>
              <p>変更を保存後、ユーザーがページを再読み込みすると新しい設定が反映されます。セッション中は即時反映されません。</p>
            </div>

            <button onClick={saveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : '表示設定を保存'}
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ UI文言 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'labels' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-1 flex items-center gap-2">
                <Type className="w-4 h-4 text-yellow-400" />UI文言カスタマイズ
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                空欄にするとデフォルト値が使用されます。変更はページ再読み込み後に反映されます。
              </p>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">サイト全体</p>
                <LabelEditor
                  label="サイトタイトル"
                  value={settings.siteTitle}
                  onChange={v => setSettings(s => ({ ...s, siteTitle: v }))}
                  placeholder="AI テスト支援システム"
                />
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">プロジェクト・フォーム</p>
                <LabelEditor
                  label="「プロジェクト名」ラベル"
                  value={settings.labelProjectName}
                  onChange={v => setSettings(s => ({ ...s, labelProjectName: v }))}
                  placeholder="プロジェクト名"
                />
                <LabelEditor
                  label="「テスト対象システム」ラベル"
                  value={settings.labelTargetSystem}
                  onChange={v => setSettings(s => ({ ...s, labelTargetSystem: v }))}
                  placeholder="テスト対象システム"
                />
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ボタン文言</p>
                <LabelEditor
                  label="テスト生成ボタン"
                  value={settings.labelGenerateButton}
                  onChange={v => setSettings(s => ({ ...s, labelGenerateButton: v }))}
                  placeholder="AIテスト項目を生成する"
                />
                <LabelEditor
                  label="レビュー実行ボタン"
                  value={settings.labelReviewButton}
                  onChange={v => setSettings(s => ({ ...s, labelReviewButton: v }))}
                  placeholder="AIレビューを実行"
                />
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 text-xs">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-yellow-400" />文言変更の反映方法
              </p>
              <p>保存後、各ページがAdminSettingsを参照して文言を表示します。ユーザーがページを再読み込みすると反映されます。</p>
            </div>

            <button onClick={saveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : 'UI文言を保存'}
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ プロンプトテンプレート ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'prompts' && (
          <div className="space-y-6">
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">プロンプトの変更は生成品質に直接影響します</p>
                <p className="text-xs text-amber-400/80 mt-0.5">変更前に必ずバックアップしてください。空欄にするとデフォルト値が使用されます。</p>
              </div>
            </div>

            {/* ① プランニング用システムプロンプト */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-blue-400" />
                  <span>① プランニング システムプロンプト</span>
                  <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full font-normal">LLM①</span>
                </h2>
                <span className="text-xs text-gray-500">{(template.planningSystemPrompt ?? '').length}文字 / 約{Math.ceil((template.planningSystemPrompt ?? '').length / 4)}トークン</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                「テスト全体プランの立案」フェーズで使用。AIに「テスト設計のプランナーとして振る舞うか」を指示します。
                <br />空欄の場合はシステムデフォルト（「プラン目次をJSONで出力してください」）が使われます。
              </p>
              <textarea
                value={template.planningSystemPrompt ?? ''}
                onChange={e => setTemplate(t => ({ ...t, planningSystemPrompt: e.target.value }))}
                rows={8}
                className="w-full bg-gray-800 border border-blue-900/40 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono outline-none focus:border-blue-700 transition-colors resize-y"
                placeholder={`（空欄 = デフォルト）\nあなたはソフトウェア品質保証の専門家です。提供された仕様書・ソースコード・サイト構造を分析し、テスト項目の「全体プラン（目次）」をJSON配列形式のみで出力してください。...`}
              />
            </div>

            {/* ② バッチ実行用システムプロンプト */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-shift-400" />
                  <span>② バッチ実行 システムプロンプト</span>
                  <span className="text-xs bg-shift-900/60 text-shift-300 border border-shift-700/50 px-2 py-0.5 rounded-full font-normal">LLM②</span>
                </h2>
                <span className="text-xs text-gray-500">{template.systemPrompt.length}文字 / 約{Math.ceil(template.systemPrompt.length / 4)}トークン</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                「テスト項目の詳細生成」バッチ実行フェーズで使用。JSON出力の指示は必ず含めてください。
                <br />空欄の場合はシステムデフォルトが使われます。
              </p>
              <textarea
                value={template.systemPrompt}
                onChange={e => setTemplate(t => ({ ...t, systemPrompt: e.target.value }))}
                rows={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono outline-none focus:border-shift-600 transition-colors resize-y"
                placeholder="テスト生成AIのシステムプロンプトを入力..."
              />
            </div>

            {/* ③ レビュー用システムプロンプト */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span>③ レビューAI システムプロンプト</span>
                  <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full font-normal">LLM③</span>
                </h2>
                <span className="text-xs text-gray-500">{template.reviewSystemPrompt.length}文字 / 約{Math.ceil(template.reviewSystemPrompt.length / 4)}トークン</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">AIレビュー・品質評価タブで使用。JSON形式のみ出力するよう指示を含めてください。</p>
              <textarea
                value={template.reviewSystemPrompt}
                onChange={e => setTemplate(t => ({ ...t, reviewSystemPrompt: e.target.value }))}
                rows={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono outline-none focus:border-purple-600 transition-colors resize-y"
                placeholder="レビューAIのシステムプロンプトを入力..."
              />
            </div>

            <button onClick={saveTemplate} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : 'プロンプトを保存'}
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━ REF確認 ━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'refmap' && (
          <RefMapViewer password={password} />
        )}

        {/* 最終更新 */}
        {settings.updatedAt && (
          <p className="text-xs text-gray-600 text-center">最終更新: {new Date(settings.updatedAt).toLocaleString('ja-JP')}</p>
        )}
      </div>
    </div>
  )
}

// ─── REFマップビューア ──────────────────────────────────────────
function RefMapViewer({ password }: { password: string }) {
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [refMap, setRefMap] = useState<Array<{
    refId: string; filename: string; category: string; excerpt: string; pageUrl?: string | null; chunkKey?: string
  }> | null>(null)
  const [error, setError] = useState('')
  // ■1: 複数同時展開 (Set で管理)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // ■2: 2つの検索窓 (メタ絞り込み + 本文テキスト絞り込み)
  const [searchMeta, setSearchMeta] = useState('')
  const [searchText, setSearchText] = useState('')

  const CATEGORY_LABELS: Record<string, string> = {
    customer_doc:    '仕様書',
    MSOK_knowledge:  'MSOKナレッジ',
    source_code:     'ソースコード',
    site_analysis:   'サイト分析',
  }
  const CATEGORY_COLORS: Record<string, string> = {
    customer_doc:    'bg-blue-900/40 text-blue-300 border-blue-700/50',
    MSOK_knowledge:  'bg-purple-900/40 text-purple-300 border-purple-700/50',
    source_code:     'bg-gray-700/60 text-gray-300 border-gray-600',
    site_analysis:   'bg-green-900/40 text-green-300 border-green-700/50',
  }

  const load = async () => {
    if (!projectId.trim()) { setError('プロジェクトIDを入力してください'); return }
    setLoading(true); setError(''); setRefMap(null); setExpandedIds(new Set())
    try {
      const res = await fetch(
        `/api/admin?action=refmap&projectId=${encodeURIComponent(projectId.trim())}`,
        { headers: { 'x-admin-password': password } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラーが発生しました')
      setRefMap(data.refMap ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // ■1: トグル関数（Set の add/delete）
  const toggleExpand = (refId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(refId) ? next.delete(refId) : next.add(refId)
      return next
    })
  }

  // 全展開 / 全閉じ
  const expandAll = () => setExpandedIds(new Set(filtered.map(r => r.refId)))
  const collapseAll = () => setExpandedIds(new Set())

  // ■2: メタ絞り込み（REF番号・ファイル名・カテゴリ）と 本文テキスト絞り込みを分離
  const filtered = (refMap ?? []).filter(r => {
    // 検索1: メタ情報（REF番号・ファイル名・カテゴリ）
    if (searchMeta) {
      const q = searchMeta.toLowerCase()
      const hitMeta = r.refId.toLowerCase().includes(q)
        || r.filename.toLowerCase().includes(q)
        || r.category.toLowerCase().includes(q)
        || (CATEGORY_LABELS[r.category] ?? '').toLowerCase().includes(q)
      if (!hitMeta) return false
    }
    // 検索2: 抜粋本文
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!r.excerpt.toLowerCase().includes(q)) return false
    }
    return true
  })

  // 本文マッチ行のハイライト（検索2がある場合のみ）
  const highlightExcerpt = (text: string) => {
    if (!searchText) return text
    const q = searchText.toLowerCase()
    // マッチする行だけ返す
    const lines = text.split('\n')
    const matchedLines = lines.filter(l => l.toLowerCase().includes(q))
    return matchedLines.length > 0 ? matchedLines.join('\n') : text
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 text-blue-300 text-sm flex items-start gap-2">
        <Database className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">REFマップ確認</p>
          <p className="text-xs text-blue-400/80 mt-0.5">
            プランニング時に確定したREF番号とチャンクの対応表を確認できます。
            バッチ実行時はこのマップを使用するためREF番号がずれません。
          </p>
        </div>
      </div>

      {/* 入力 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <label className="text-xs text-gray-400 block">プロジェクトID</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="例: proj-xxxxxxxx"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-200 font-mono outline-none focus:border-shift-600"
          />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-shift-800 hover:bg-shift-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? '取得中...' : '取得'}
          </button>
        </div>
        {error && (
          <div className="text-red-400 text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />{error}
          </div>
        )}
      </div>

      {/* 結果 */}
      {refMap !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* ヘッダー + 検索 */}
          <div className="px-5 py-3 border-b border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-shift-400" />
                <span className="font-semibold text-white">REFマップ</span>
                <span className="text-xs text-gray-400 font-mono">{refMap.length}件 / 表示:{filtered.length}件</span>
              </div>
              {/* 全展開・全閉じ ボタン (■1) */}
              <div className="flex gap-2">
                <button onClick={expandAll}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors">
                  全展開
                </button>
                <button onClick={collapseAll}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors">
                  全閉じ
                </button>
              </div>
            </div>

            {/* ■2: 2つの検索窓 */}
            <div className="flex gap-2 flex-wrap">
              {/* 検索1: メタ情報絞り込み */}
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  value={searchMeta}
                  onChange={e => setSearchMeta(e.target.value)}
                  placeholder="REF番号・ファイル名・カテゴリで絞り込み"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 outline-none focus:border-shift-600"
                />
              </div>
              {/* 検索2: 本文テキスト絞り込み (■2) */}
              <div className="relative flex-1 min-w-48">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500" />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="抜粋本文テキストで絞り込み（マッチ行のみ表示）"
                  className="w-full bg-gray-800 border border-amber-900/40 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 outline-none focus:border-amber-700"
                />
              </div>
            </div>
            {(searchMeta || searchText) && (
              <p className="text-xs text-gray-500">
                {searchMeta && <span className="text-blue-400">メタ:「{searchMeta}」</span>}
                {searchMeta && searchText && <span className="mx-1">+</span>}
                {searchText && <span className="text-amber-400">本文:「{searchText}」</span>}
                {' '}→ {filtered.length}件ヒット
              </p>
            )}
          </div>

          {refMap.length === 0 ? (
            <div className="py-16 text-center text-gray-500 space-y-2">
              <Database className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">このプロジェクトのREFマップは存在しません</p>
              <p className="text-xs">プランニングを実行するとREFマップが保存されます</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm">検索条件に一致するREFがありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {filtered.map(r => {
                const catColor = CATEGORY_COLORS[r.category] ?? 'bg-gray-700/60 text-gray-300 border-gray-600'
                const catLabel = CATEGORY_LABELS[r.category] ?? r.category
                // ■1: Set で展開状態管理
                const isExpanded = expandedIds.has(r.refId)
                const excerptDisplay = highlightExcerpt(r.excerpt)
                return (
                  <div key={r.refId} className="hover:bg-gray-800/40 transition-colors">
                    <button
                      onClick={() => toggleExpand(r.refId)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left">
                      <ChevronRight className={clsx('w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                      {/* REF番号 */}
                      <span className="font-mono font-bold text-shift-400 w-16 flex-shrink-0 text-sm">{r.refId}</span>
                      {/* カテゴリバッジ */}
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border flex-shrink-0', catColor)}>{catLabel}</span>
                      {/* ファイル名 */}
                      <span className="text-sm text-gray-200 flex-1 truncate">{r.filename}</span>
                      {/* 本文ヒット表示 */}
                      {searchText && r.excerpt.toLowerCase().includes(searchText.toLowerCase()) && (
                        <span className="flex-shrink-0 text-xs bg-amber-900/40 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full">本文一致</span>
                      )}
                      {/* URL */}
                      {r.pageUrl && (
                        <a href={r.pageUrl} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 text-xs text-shift-400 hover:underline flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3" />URL
                        </a>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 pl-[calc(1.25rem+1rem+3.5rem)]">
                        <div className="bg-gray-800 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-500 font-semibold">
                              📄 抜粋テキスト{searchText ? '（本文マッチ行のみ）' : ''}
                            </p>
                            {r.chunkKey && (
                              <span className="text-xs text-gray-600 font-mono">{r.chunkKey}</span>
                            )}
                          </div>
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                            {searchText ? (
                              // ■2: 本文検索時はマッチ行をハイライト表示
                              excerptDisplay.split('\n').map((line, i) => {
                                const q = searchText.toLowerCase()
                                const hit = line.toLowerCase().includes(q)
                                return hit ? (
                                  <span key={i} className="bg-amber-900/40 rounded">{line}\n</span>
                                ) : (
                                  <span key={i} className="text-gray-500">{line}\n</span>
                                )
                              })
                            ) : r.excerpt}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}