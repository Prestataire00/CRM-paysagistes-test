import * as XLSX from 'xlsx'

export interface ExcelColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
  width?: number
}

/**
 * Export data to a real .xlsx Excel file.
 * Replaces CSV exports for better compatibility with Excel on Windows/Mac.
 */
export function exportToExcel<T>(
  filename: string,
  columns: ExcelColumn<T>[],
  rows: T[],
  sheetName = 'Données',
): void {
  // Build data array: header row + data rows
  const header = columns.map(c => c.header)
  const data = rows.map(row =>
    columns.map(c => {
      const val = c.accessor(row)
      return val == null ? '' : val
    }),
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...data])

  // Set column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? Math.max(c.header.length + 2, 14) }))

  // Style header row as bold (via cell format)
  for (let i = 0; i < header.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Ensure .xlsx extension
  const fname = filename.endsWith('.xlsx') ? filename : filename.replace(/\.\w+$/, '') + '.xlsx'
  XLSX.writeFile(wb, fname)
}
