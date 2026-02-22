/**
 * アップロードされたファイルからテキストを抽出する
 * PDF: pdf-parse / DOCX: mammoth / XLSX: xlsx / その他: プレーンテキスト
 */
export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      return `[PDF解析エラー: ${filename}]`
    }
  }

  // Word (.docx)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch {
      return `[DOCX解析エラー: ${filename}]`
    }
  }

  // Excel (.xlsx / .xls)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    ext === 'xlsx' || ext === 'xls'
  ) {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const lines: string[] = []
      wb.SheetNames.forEach(name => {
        const ws = wb.Sheets[name]
        const csv = XLSX.utils.sheet_to_csv(ws)
        lines.push(`=== シート: ${name} ===\n${csv}`)
      })
      return lines.join('\n\n')
    } catch {
      return `[Excel解析エラー: ${filename}]`
    }
  }

  // Markdown / テキスト
  if (
    mimeType.startsWith('text/') ||
    ['md', 'txt', 'csv'].includes(ext)
  ) {
    return buffer.toString('utf-8')
  }

  // ZIP（ソースコード）- ファイル名のみリスト
  if (mimeType === 'application/zip' || ext === 'zip') {
    return `[ZIPファイル: ${filename}]\nZIPの内容は別途解析されます。`
  }

  return `[未対応形式: ${filename} (${mimeType})]`
}
