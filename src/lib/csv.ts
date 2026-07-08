// Small client-side CSV export helper.

type Cell = string | number | null | undefined

/**
 * Trigger a CSV file download in the browser. Prepends a UTF-8 BOM so Excel
 * opens Hebrew text correctly, and quotes/escapes cells that need it.
 */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const esc = (v: Cell) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
