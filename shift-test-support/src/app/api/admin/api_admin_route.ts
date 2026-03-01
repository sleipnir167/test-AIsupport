import { NextResponse } from 'next/server'
import { getAdminSettings, saveAdminSettings, getPromptTemplate, savePromptTemplate } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

function checkAuth(req: Request): boolean {
  const auth = req.headers.get('x-admin-password')
  return auth === ADMIN_PASSWORD
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [settings, template] = await Promise.all([getAdminSettings(), getPromptTemplate()])
  return NextResponse.json({ settings, template })
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
}
