'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, Zap, FileCheck2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('masu@msok.co.jp')
  const [password, setPassword] = useState('password')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    if (email && password) {
      router.push('/dashboard')
    } else {
      setError('メールアドレスとパスワードを入力してください')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-shift-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 right-0 w-48 h-48 bg-shift-400 rounded-full translate-x-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-wide">MSOK</span>
          </div>
          <p className="text-shift-200 text-sm">品質保証のプロフェッショナル</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-white text-4xl font-bold leading-tight mb-4">
              AIが品質保証の<br />
              <span className="text-shift-300">専門家</span>として<br />
              テストを設計します
            </h1>
            <p className="text-shift-200 text-lg leading-relaxed">
              要件定義書・設計書・サイト構造を読み込み、<br />
              網羅的なテスト項目書を自動生成。
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: FileCheck2, title: 'ドキュメントRAG', desc: '要件定義書・設計書・ナレッジを解析' },
              { icon: Zap, title: 'AIテスト生成', desc: '品質プロとしてのAIが項目を自動作成' },
              { icon: Shield, title: 'Excel出力', desc: 'テスト項目書をそのまま活用可能' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-shift-200" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-shift-300 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-shift-400 text-xs">
          © 2026 MSOK株式会社
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 text-shift-800 font-bold text-xl">
              <Shield className="w-6 h-6" />
              <span>MSOK</span>
            </div>
          </div>

          <div className="card p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">ログイン</h2>
            <p className="text-gray-500 text-sm mb-8">AIテスト支援システムにサインイン</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="example@msok.co.jp"
                  required
                />
              </div>

              <div>
                <label className="label">パスワード</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="パスワードを入力"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    認証中...
                  </span>
                ) : 'ログイン'}
              </button>
            </form>

            <div className="mt-6 p-3 bg-shift-50 rounded-lg border border-shift-100">
              <p className="text-xs text-shift-700 font-medium mb-1">デモ用アカウント</p>
              <p className="text-xs text-shift-600">メール: masu@msok.co.jp</p>
              <p className="text-xs text-shift-600">パスワード: 任意</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
