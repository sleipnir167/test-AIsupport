export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getSiteAnalysis, saveSiteAnalysis, deleteSiteAnalysis, getProject, updateProject } from '@/lib/db'
import { upsertChunks, deleteDocumentChunks } from '@/lib/vector'
import type { SiteAnalysis, PageInfo } from '@/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const analysis = await getSiteAnalysis(projectId)
  return NextResponse.json(analysis || null)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const existing = await getSiteAnalysis(projectId)
  if (existing?.chunkCount) {
    await deleteDocumentChunks(`site-${projectId}`, existing.chunkCount)
  }
  await deleteSiteAnalysis(projectId)

  // プロジェクトのhasUrlAnalysisをfalseに
  const project = await getProject(projectId)
  if (project) await updateProject({ ...project, hasUrlAnalysis: false })

  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { projectId, targetUrl, depth = 3, maxPages = 50 } = body

    if (!projectId || !targetUrl) {
      return NextResponse.json({ error: 'projectIdとtargetUrlは必須です' }, { status: 400 })
    }

    // URL検証
    let parsedUrl: URL
    try {
      parsedUrl = new URL(targetUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
    } catch {
      return NextResponse.json({ error: '有効なURLを入力してください（https://...）' }, { status: 400 })
    }

    // Vercel環境ではPlaywrightが使えないため、
    // fetch + 簡易HTMLパースでページ情報を取得するモックシミュレーション
    // 実際のクローリングは別サーバー（Cloud Run等）が必要
    const pages = await crawlSite(parsedUrl, depth, maxPages)

    const analysisId = `site-${projectId}`
    const now = new Date().toISOString()

    // ページ情報をテキスト化してベクトルDBに格納
    const chunks: string[] = pages.map(page =>
      `【画面】${page.title}\nURL: ${page.url}\n` +
      (page.description ? `説明: ${page.description}\n` : '') +
      `フォーム: ${page.forms}個, ボタン: ${page.buttons}個, リンク: ${page.links}個`
    )

    // サイト全体のサマリーチャンクも追加
    const summaryChunk = `【サイト構造サマリー】\n対象URL: ${targetUrl}\n総ページ数: ${pages.length}\n\n画面一覧:\n${pages.map(p => `- ${p.title} (${p.url})`).join('\n')}`
    chunks.unshift(summaryChunk)

    const chunkCount = await upsertChunks(
      projectId,
      analysisId,
      `サイト構造: ${targetUrl}`,
      'site_analysis',
      chunks,
      { pageUrl: targetUrl }
    )

    const analysis: SiteAnalysis = {
      id: uuidv4(),
      projectId,
      targetUrl,
      status: 'completed',
      pageCount: pages.length,
      pages,
      chunkCount,
      createdAt: now,
    }

    await saveSiteAnalysis(analysis)

    // プロジェクトのフラグを更新
    const project = await getProject(projectId)
    if (project) await updateProject({ ...project, hasUrlAnalysis: true })

    return NextResponse.json(analysis, { status: 201 })
  } catch (e) {
    console.error('POST /api/site-analysis error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'URL分析に失敗しました' }, { status: 500 })
  }
}

/**
 * 簡易クローリング（fetchベース）
 * Vercel環境でPlaywrightが使えないため、fetchでHTMLを取得してリンクを辿る
 * SSR/SPAサイトはJSが実行されないため完全ではないが、静的リンクは収集可能
 */
async function crawlSite(baseUrl: URL, maxDepth: number, maxPages: number): Promise<PageInfo[]> {
  const visited = new Set<string>()
  const pages: PageInfo[] = []
  const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl.href, depth: 0 }]

  while (queue.length > 0 && pages.length < maxPages) {
    const { url, depth } = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MSOKTestSupport/1.0 (site analysis bot)' }
      })
      clearTimeout(timeout)

      if (!res.ok) continue
      const html = await res.text()

      const pageInfo = parseHtml(html, url)
      pages.push(pageInfo)

      // リンクを収集して次のキューに追加
      if (depth < maxDepth) {
        const links = extractLinks(html, baseUrl)
        for (const link of links) {
          if (!visited.has(link) && pages.length + queue.length < maxPages * 2) {
            queue.push({ url: link, depth: depth + 1 })
          }
        }
      }
    } catch {
      // タイムアウトやエラーは無視して続行
    }
  }

  return pages
}

function parseHtml(html: string, url: string): PageInfo {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim().slice(0, 100) : url

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
  const description = descMatch ? descMatch[1].slice(0, 200) : undefined

  const forms = (html.match(/<form[\s>]/gi) || []).length
  const buttons = (html.match(/<button[\s>]/gi) || []).length +
                  (html.match(/type=["']submit["']/gi) || []).length
  const links = (html.match(/<a\s[^>]*href=/gi) || []).length

  return { url, title, forms, buttons, links, description }
}

function extractLinks(html: string, baseUrl: URL): string[] {
  const links: string[] = []
  const hrefRegex = /href=["']([^"'#?][^"']*)["']/gi
  let match: RegExpExecArray | null

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const href = match[1]
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
      const resolved = new URL(href, baseUrl)
      // 同一オリジンのみ
      if (resolved.origin === baseUrl.origin) {
        // クエリとハッシュを除いたパスをキーとする
        resolved.search = ''
        resolved.hash = ''
        links.push(resolved.href)
      }
    } catch {
      // 無効なURLはスキップ
    }
  }
  return [...new Set(links)]
}
