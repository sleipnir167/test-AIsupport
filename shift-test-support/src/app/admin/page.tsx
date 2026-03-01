'use client'
import { useState, useEffect } from 'react'
import {
  Lock, Settings, FileText, Save, RefreshCw, Loader2,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Sliders,
  TerminalSquare, ChevronDown, ChevronUp, Info, Shield
} from 'lucide-react'
import { clsx } from 'clsx'
import type { AdminSettings, PromptTemplate } from '@/types'

const DEFAULT_SETTINGS: AdminSettings = {
  defaultTemperature: 0.4,
  reviewTemperature: 0.2,
  defaultMaxTokens: 12000,
  reviewMaxTokens: 5000,
  logRetentionDays: 30,
  updatedAt: '',
}

const DEFAULT_TEMPLATE: PromptTemplate = {
  id: 'default',
  name: 'デフォルト',
  description: '',
  systemPrompt: '',
  reviewSystemPrompt: '',
  updatedAt: '',
}

// モデル参考情報
const MODEL_LIMITS = [
  { name: 'DeepSeek V3.2',     context: '128K', maxOutput: '8K' },
  { name: 'Gemini 2.5 Flash',  context: '1M',   maxOutput: '65K' },
  { name: 'GPT-5 Nano',        context: '128K',  maxOutput: '16K' },
  { name: 'Claude Sonnet 4.6', context: '200K',  maxOutput: '64K' },
  { name: 'Llama 3.3 70B',     context: '128K',  maxOutput: '8K' },
]

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS)
  const [template, setTemplate] = useState<PromptTemplate>(DEFAULT_TEMPLATE)
  const [activeTab, setActiveTab] = useState<'settings' | 'prompts'>('settings')
  const [showModelLimits, setShowModelLimits] = useState(false)

  const login = async () => {
    setAuthError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        headers: { 'x-admin-password': password },
      })
      if (!res.ok) { setAuthError('パスワードが違います'); return }
      const data = await res.json()
      setSettings(data.settings)
      setTemplate(data.template)
      setAuthed(true)
      // パスワードをセッションストレージに保持
      sessionStorage.setItem('admin_pw', password)
    } catch {
      setAuthError('接続エラー')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (pw: string) => {
    const res = await fetch('/api/admin', { headers: { 'x-admin-password': pw } })
    if (!res.ok) return
    const data = await res.json()
    setSettings(data.settings)
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
    } finally {
      setSaving(false)
    }
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
    } finally {
      setSaving(false)
    }
  }

  // ─── ログイン画面 ─────────────────────────────────────────────
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

  // ─── 管理画面本体 ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ヘッダー */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-shift-800 rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-white" /></div>
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

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* タブ */}
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit">
          {[
            { id: 'settings' as const, label: 'AI実行設定', icon: Sliders },
            { id: 'prompts' as const, label: 'プロンプトテンプレート', icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
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

        {/* ─── AI実行設定タブ ─── */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* モデル参考情報 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <button onClick={() => setShowModelLimits(!showModelLimits)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors">
                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Info className="w-4 h-4 text-blue-400" />モデル別トークン制限（参考）</span>
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
                  <p className="text-xs text-gray-500 mt-2">※ Max Tokensは出力トークン数の上限です。コンテキスト上限はプロンプト全体（入力+出力）の上限。</p>
                </div>
              )}
            </div>

            {/* 生成AI設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2"><TerminalSquare className="w-4 h-4 text-shift-400" />テスト生成AI設定</h2>
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
                  <p className="text-xs text-gray-600 mt-1">推奨: 8000〜16000（モデルの出力上限内で設定）</p>
                </div>
              </div>
            </div>

            {/* レビューAI設定 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-purple-400" />レビューAI設定</h2>
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
                  <p className="text-xs text-gray-600 mt-1">低い=厳格・一貫 / 高い=柔軟（推奨: 0.1〜0.3）</p>
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
              <h2 className="font-bold text-white mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-green-400" />ログ設定</h2>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">ログ保持日数</label>
                <input type="number" min="1" max="90"
                  value={settings.logRetentionDays}
                  onChange={e => setSettings(s => ({ ...s, logRetentionDays: parseInt(e.target.value) }))}
                  className="w-40 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                <p className="text-xs text-gray-600 mt-1">Redisの有効期限に反映（現在: 30日固定）</p>
              </div>
            </div>

            <button onClick={saveSettings} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-shift-800 hover:bg-shift-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        )}

        {/* ─── プロンプトテンプレートタブ ─── */}
        {activeTab === 'prompts' && (
          <div className="space-y-6">
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">プロンプトの変更は生成品質に直接影響します</p>
                <p className="text-xs text-amber-400/80 mt-0.5">変更前に必ずバックアップしてください。空欄にするとデフォルト値が使用されます。</p>
              </div>
            </div>

            {/* 生成用システムプロンプト */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-shift-400" />テスト生成 システムプロンプト
                </h2>
                <span className="text-xs text-gray-500">{template.systemPrompt.length}文字 / 約{Math.ceil(template.systemPrompt.length / 4)}トークン</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">AIに「どんな専門家として振る舞うか」を指示するプロンプト。JSON出力の指示は必ず含めてください。</p>
              <textarea
                value={template.systemPrompt}
                onChange={e => setTemplate(t => ({ ...t, systemPrompt: e.target.value }))}
                rows={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono outline-none focus:border-shift-600 transition-colors resize-y"
                placeholder="テスト生成AIのシステムプロンプトを入力..."
              />
            </div>

            {/* レビュー用システムプロンプト */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />レビューAI システムプロンプト
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

        {/* 最終更新 */}
        {settings.updatedAt && (
          <p className="text-xs text-gray-600 text-center">最終更新: {new Date(settings.updatedAt).toLocaleString('ja-JP')}</p>
        )}
      </div>
    </div>
  )
}
