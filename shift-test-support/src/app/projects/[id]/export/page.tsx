'use client'
import { useState } from 'react'
import clsx from 'clsx'
import { Download, FileSpreadsheet, CheckCircle2, Settings2, Layers, Table2 } from 'lucide-react'
import { mockTestItems, mockProjects, priorityLabels, automatableLabels } from '@/lib/mock-data'

export default function ExportPage({ params }: { params: { id: string } }) {
  const project = mockProjects.find(p => p.id === params.id) || mockProjects[0]
  const items = mockTestItems.filter(t => t.projectId === params.id && !t.isDeleted)

  const [sheetMode, setSheetMode] = useState<'single' | 'split'>('single')
  const [includeColumns, setIncludeColumns] = useState({
    testId: true, categoryMajor: true, categoryMinor: true, testPerspective: true,
    testTitle: true, precondition: true, steps: true, expectedResult: true,
    priority: true, automatable: true, result: true, notes: true,
  })
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const colLabels: Record<string, string> = {
    testId: 'テストID', categoryMajor: '大分類', categoryMinor: '中分類',
    testPerspective: 'テスト観点', testTitle: 'テスト項目名', precondition: '事前条件',
    steps: 'テスト手順', expectedResult: '期待結果', priority: '優先度',
    automatable: '自動化可否', result: '実施結果', notes: '備考',
  }

  const handleDownload = async () => {
    setDownloading(true)
    // Dynamic import to avoid SSR issues
    const XLSX = await import('xlsx')
    
    const headers = Object.entries(colLabels)
      .filter(([k]) => includeColumns[k as keyof typeof includeColumns])
      .map(([, v]) => v)

    const rows = items.map(item => {
      const row: (string | number)[] = []
      if (includeColumns.testId) row.push(item.testId)
      if (includeColumns.categoryMajor) row.push(item.categoryMajor)
      if (includeColumns.categoryMinor) row.push(item.categoryMinor)
      if (includeColumns.testPerspective) row.push(item.testPerspective)
      if (includeColumns.testTitle) row.push(item.testTitle)
      if (includeColumns.precondition) row.push(item.precondition)
      if (includeColumns.steps) row.push(item.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
      if (includeColumns.expectedResult) row.push(item.expectedResult)
      if (includeColumns.priority) row.push(priorityLabels[item.priority])
      if (includeColumns.automatable) row.push(automatableLabels[item.automatable])
      if (includeColumns.result) row.push('')
      if (includeColumns.notes) row.push('')
      return row
    })

    const wb = XLSX.utils.book_new()

    if (sheetMode === 'single') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      // Column widths
      ws['!cols'] = headers.map((_, i) => ({ wch: [8, 16, 16, 14, 36, 20, 40, 30, 8, 10, 10, 12][i] || 12 }))
      XLSX.utils.book_append_sheet(wb, ws, 'テスト項目書')
    } else {
      const majors = [...new Set(items.map(t => t.categoryMajor))]
      majors.forEach(major => {
        const majorItems = items.filter(t => t.categoryMajor === major)
        const majorRows = majorItems.map(item => {
          const row: (string | number)[] = []
          if (includeColumns.testId) row.push(item.testId)
          if (includeColumns.categoryMajor) row.push(item.categoryMajor)
          if (includeColumns.categoryMinor) row.push(item.categoryMinor)
          if (includeColumns.testPerspective) row.push(item.testPerspective)
          if (includeColumns.testTitle) row.push(item.testTitle)
          if (includeColumns.precondition) row.push(item.precondition)
          if (includeColumns.steps) row.push(item.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
          if (includeColumns.expectedResult) row.push(item.expectedResult)
          if (includeColumns.priority) row.push(priorityLabels[item.priority])
          if (includeColumns.automatable) row.push(automatableLabels[item.automatable])
          if (includeColumns.result) row.push('')
          if (includeColumns.notes) row.push('')
          return row
        })
        const ws = XLSX.utils.aoa_to_sheet([headers, ...majorRows])
        ws['!cols'] = headers.map((_, i) => ({ wch: [8, 16, 16, 14, 36, 20, 40, 30, 8, 10, 10, 12][i] || 12 }))
        XLSX.utils.book_append_sheet(wb, ws, major.slice(0, 30))
      })
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    XLSX.writeFile(wb, `テスト項目書_${project.name}_${today}.xlsx`)

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
            <p className="text-xs text-gray-500">{items.length}件のテスト項目</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600">
          テスト項目書_{project.name}_{new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx
        </div>
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
            { value: 'split', label: '大分類ごとに分割', desc: '機能別にシートを分けて出力' },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setSheetMode(value as 'single' | 'split')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${sheetMode === value ? 'border-shift-700 bg-shift-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
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
              <input
                type="checkbox"
                checked={includeColumns[key as keyof typeof includeColumns]}
                onChange={e => setIncludeColumns(c => ({ ...c, [key]: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-shift-700 accent-shift-700"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={clsx(
          'w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-200',
          downloaded
            ? 'bg-green-600 text-white'
            : 'bg-shift-800 hover:bg-shift-700 text-white shadow-sm hover:shadow-card-hover'
        )}
      >
        {downloading ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Excelファイルを生成中...
          </>
        ) : downloaded ? (
          <><CheckCircle2 className="w-5 h-5" /> ダウンロード完了！</>
        ) : (
          <><Download className="w-5 h-5" /> Excelファイルをダウンロード</>
        )}
      </button>

      <div className="text-xs text-gray-400 text-center">
        ヘッダー行はShiftコーポレートカラー（濃紺）で出力されます。<br />
        実施結果・備考列は空欄で出力されます（テスト実施後に記入してください）。
      </div>
    </div>
  )
}
