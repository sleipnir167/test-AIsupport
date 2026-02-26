'use client'
import { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, CheckCircle2, Settings2, Layers, Table2, Loader2 } from 'lucide-react'
import { priorityLabels, automatableLabels } from '@/lib/mock-data'
import type { TestItem } from '@/types'
import { clsx } from 'clsx'

export default function ExportPage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState<TestItem[]>([])
  const [projectName, setProjectName] = useState('プロジェクト')
  const [loading, setLoading] = useState(true)
  const [sheetMode, setSheetMode] = useState<'single' | 'split'>('single')
  const [includeColumns, setIncludeColumns] = useState({
    testId: true, categoryMajor: true, categoryMinor: true, testPerspective: true,
    testTitle: true, precondition: true, steps: true, expectedResult: true,
    priority: true, automatable: true, sourceFile: true, sourceExcerpt: true, result: true, notes: true,
  })
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const colLabels: Record<string, string> = {
    testId: 'テストID', categoryMajor: '大分類', categoryMinor: '中分類',
    testPerspective: 'テスト観点', testTitle: 'テスト項目名', precondition: '事前条件',
    steps: 'テスト手順', expectedResult: '期待結果', priority: '優先度',
    automatable: '自動化可否', sourceFile: '出典ファイル', sourceExcerpt: '出典内容', result: '実施結果', notes: '備考',
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/test-items?projectId=${params.id}`).then(r => r.json()),
      fetch(`/api/projects?id=${params.id}`).then(r => r.json()).catch(() => null),
    ]).then(([itemData, projectData]) => {
      const list = Array.isArray(itemData) ? itemData.filter((t: TestItem) => !t.isDeleted) : []
      setItems(list)
      if (projectData?.name) setProjectName(projectData.name)
    }).catch(console.error).finally(() => setLoading(false))
  }, [params.id])

  const buildRow = (item: TestItem): (string | number)[] => {
    const row: (string | number)[] = []
    if (includeColumns.testId) row.push(item.testId)
    if (includeColumns.categoryMajor) row.push(item.categoryMajor)
    if (includeColumns.categoryMinor) row.push(item.categoryMinor)
    if (includeColumns.testPerspective) row.push(item.testPerspective)
    if (includeColumns.testTitle) row.push(item.testTitle)
    if (includeColumns.precondition) row.push(item.precondition)
    if (includeColumns.steps) row.push(item.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
    if (includeColumns.expectedResult) row.push(item.expectedResult)
    if (includeColumns.priority) row.push(priorityLabels[item.priority] ?? item.priority)
    if (includeColumns.automatable) row.push(automatableLabels[item.automatable] ?? item.automatable)
    if (includeColumns.sourceFile) row.push(item.sourceRefs?.map(r => r.filename).join(' / ') ?? '')
    if (includeColumns.sourceExcerpt) row.push(item.sourceRefs?.map(r => r.excerpt).join('\n---\n') ?? '')
    if (includeColumns.result) row.push('')
    if (includeColumns.notes) row.push('')
    return row
  }

  const handleDownload = async () => {
    if (items.length === 0) {
      alert('テスト項目が0件です。先にAI生成を実行してください。')
      return
    }
    setDownloading(true)
    const XLSX = await import('xlsx')

    const headers = Object.entries(colLabels)
      .filter(([k]) => includeColumns[k as keyof typeof includeColumns])
      .map(([, v]) => v)

    const colWidths = [8, 16, 16, 14, 36, 20, 40, 30, 8, 10, 24, 40, 10, 12]

    const applyHeaderStyle = (ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>, headerCount: number) => {
      ws['!cols'] = headers.map((_, i) => ({ wch: colWidths[i] || 12 }))
      // ヘッダー行スタイル（行高・折返し）
      if (!ws['!rows']) ws['!rows'] = []
      ws['!rows'][0] = { hpx: 20 }
    }

    const wb = XLSX.utils.book_new()

    if (sheetMode === 'single') {
      const rows = items.map(buildRow)
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      applyHeaderStyle(ws, headers.length)
      XLSX.utils.book_append_sheet(wb, ws, 'テスト項目書')
    } else {
      const majors = [...new Set(items.map(t => t.categoryMajor))]
      majors.forEach(major => {
        const rows = items.filter(t => t.categoryMajor === major).map(buildRow)
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        applyHeaderStyle(ws, headers.length)
        XLSX.utils.book_append_sheet(wb, ws, major.slice(0, 30))
      })
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    XLSX.writeFile(wb, `テスト項目書_${projectName}_${today}.xlsx`)

    await new Promise(r => setTimeout(r, 600))
    setDownloading(false)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 3000)
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Excel出力</h1>
        <p className="text-sm text-gray-500 mt-0.5">テスト項目書をExcelファイルにエクスポートします</p>
      </div>

      {/* Preview */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileSpreadsheet className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-gray-900">出力対象</p>
            {loading
              ? <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> 読み込み中...</p>
              : <p className="text-xs text-gray-500">{items.length}件のテスト項目</p>
            }
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600">
          テスト項目書_{projectName}_{new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx
        </div>
        {!loading && items.length === 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            ⚠️ テスト項目がありません。AI生成ページで先に生成してください。
          </div>
        )}
      </div>

      {/* Sheet mode */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">シート構成</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'single', label: '1シートにまとめる', desc: '全テスト項目を1枚のシートに出力' },
            { value: 'split',  label: '大分類ごとに分割',  desc: '機能別にシートを分けて出力' },
          ].map(({ value, label, desc }) => (
            <button key={value} onClick={() => setSheetMode(value as 'single' | 'split')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${sheetMode === value ? 'border-shift-700 bg-shift-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Table2 className={`w-4 h-4 ${sheetMode === value ? 'text-shift-700' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${sheetMode === value ? 'text-shift-800' : 'text-gray-700'}`}>{label}</p>
              </div>
              <p className="text-xs text-gray-500">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Column selection */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">出力列の選択</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(colLabels).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox"
                checked={includeColumns[key as keyof typeof includeColumns]}
                onChange={e => setIncludeColumns(c => ({ ...c, [key]: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-shift-700 accent-shift-700" />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Download button */}
      <button onClick={handleDownload} disabled={downloading || loading}
        className={clsx(
          'w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-200',
          downloading || loading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : downloaded
              ? 'bg-green-600 text-white'
              : 'bg-shift-800 hover:bg-shift-700 text-white shadow-sm hover:shadow-card-hover'
        )}>
        {downloading ? (
          <><Loader2 className="animate-spin h-5 w-5" />Excelファイルを生成中...</>
        ) : downloaded ? (
          <><CheckCircle2 className="w-5 h-5" /> ダウンロード完了！</>
        ) : (
          <><Download className="w-5 h-5" /> Excelファイルをダウンロード ({items.length}件)</>
        )}
      </button>

      <div className="text-xs text-gray-400 text-center">
        ヘッダー行はMSOKコーポレートカラー（濃紺）で出力されます。<br />
        実施結果・備考列は空欄で出力されます（テスト実施後に記入してください）。
      </div>
    </div>
  )
}
