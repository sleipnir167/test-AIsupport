'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Bell, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useState } from 'react'
import { mockUser } from '@/lib/mock-data'

export default function AppHeader() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="h-14 bg-shift-800 text-white flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50 shadow-md">
      <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="leading-none">
          <span className="font-bold text-sm tracking-wide">MSOK</span>
          <span className="text-shift-300 text-xs ml-2">AIテスト支援</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 bg-shift-600 rounded-full flex items-center justify-center text-xs font-bold">
              {mockUser.name[0]}
            </div>
            <span className="text-sm font-medium">{mockUser.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-shift-300" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-modal border border-gray-100 py-1 animate-fade-in">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-900">{mockUser.name}</p>
                <p className="text-xs text-gray-500">{mockUser.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <User className="w-4 h-4" /> プロフィール
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Settings className="w-4 h-4" /> 設定
              </button>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
