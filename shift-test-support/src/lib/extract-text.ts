/**
 * アップロードされたファイルからテキストを抽出する
 */
export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      return `[PDF解析エラー: ${filename}]`
    }
  }

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
        lines.push(`=== シート: ${name} ===\n${XLSX.utils.sheet_to_csv(ws)}`)
      })
      return lines.join('\n\n')
    } catch {
      return `[Excel解析エラー: ${filename}]`
    }
  }

  if (mimeType.startsWith('text/') || ['md', 'txt', 'csv'].includes(ext)) {
    return buffer.toString('utf-8')
  }

  // ZIP（ソースコード）→ ファイルごとにテキスト抽出
  if (mimeType === 'application/zip' || ext === 'zip') {
    return extractZipSource(buffer, filename)
  }

  // 単体コードファイル
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'php', 'rb', 'go', 'rs', 'cs', 'swift', 'kt'].includes(ext)) {
    return buffer.toString('utf-8')
  }

  return `[未対応形式: ${filename} (${mimeType})]`
}

/**
 * ZIPからソースコードを抽出してテキスト化する
 */
async function extractZipSource(buffer: Buffer, zipFilename: string): Promise<string> {
  try {
    // Vercel環境ではネイティブのunzipが使えないため、
    // JSZip または fflate を使用（package.jsonに追加が必要）
    // ここでは fflate を使用（軽量・Vercel対応）
    const { unzipSync } = await import('fflate')
    const uint8 = new Uint8Array(buffer)
    const unzipped = unzipSync(uint8)

    const CODE_EXTS = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'php', 'rb', 'go', 'rs', 'cs', 'swift', 'kt', 'vue', 'svelte'])
    const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor'])

    const sections: string[] = []
    let fileCount = 0

    for (const [path, data] of Object.entries(unzipped)) {
      // 無視ディレクトリのスキップ
      const parts = path.split('/')
      if (parts.some(p => IGNORE_DIRS.has(p))) continue

      const ext = path.split('.').pop()?.toLowerCase() || ''
      if (!CODE_EXTS.has(ext)) continue

      // 10MB超のファイルはスキップ
      if (data.length > 10 * 1024 * 1024) continue

      try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(data)
        if (text.trim().length < 10) continue

        sections.push(`=== ファイル: ${path} ===\n${text.slice(0, 3000)}`)
        fileCount++

        // 最大200ファイルまで
        if (fileCount >= 200) {
          sections.push('... (ファイル数上限に達したため以降は省略)')
          break
        }
      } catch {
        // バイナリファイルはスキップ
      }
    }

    if (sections.length === 0) {
      return `[ZIPファイル: ${zipFilename}]\nコードファイルが見つかりませんでした。`
    }

    return `=== ソースコード（${zipFilename}）- ${fileCount}ファイル ===\n\n${sections.join('\n\n')}`
  } catch (e) {
    return `[ZIP解析エラー: ${zipFilename}] ${e instanceof Error ? e.message : ''}`
  }
}
