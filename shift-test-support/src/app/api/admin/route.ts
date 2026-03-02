import { NextResponse } from 'next/server'
import { getAdminSettings, saveAdminSettings, getPromptTemplate, savePromptTemplate, getRefMap } from '@/lib/db'

export const dynamic = 'force-dynamic'

function checkAuth(req: Request): boolean {
  // process.env を関数内で参照することでランタイム評価を保証
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin1234'
  const auth = req.headers.get('x-admin-password')
  return typeof auth === 'string' && auth.trim() === expectedPassword.trim()
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // ?action=refmap&projectId=xxx で REFマップを返す
    const { searchParams } = new URL(req.url)
    if (searchParams.get('action') === 'refmap') {
      const projectId = searchParams.get('projectId')
      if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
      const refMap = await getRefMap(projectId)
      return NextResponse.json({ refMap: refMap ?? [] })
    }
    const [settings, template] = await Promise.all([getAdminSettings(), getPromptTemplate()])
    return NextResponse.json({ settings, template })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { action, settings, template } = body

    if (action === 'save_settings' && settings) {
      await saveAdminSettings(settings)
      return NextResponse.json({ ok: true })
    }
    if (action === 'save_template' && template) {
      await savePromptTemplate(template)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: '不明なaction' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
