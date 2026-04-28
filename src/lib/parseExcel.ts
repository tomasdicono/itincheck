import * as XLSX from 'xlsx'

export type ParsedSheet = {
  sheetName: string
  headers: string[]
  rows: Record<string, unknown>[]
  /** Filas como en Excel: índice 0 = primera fila (encabezados o datos), columnas A=0, B=1, … */
  rawMatrix: unknown[][]
}

function normalizeHeader(h: unknown): string {
  if (h == null) return ''
  return String(h).trim()
}

export function parseExcelFile(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true, dense: false })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: null,
          raw: false,
        })
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: null,
          raw: false,
        }) as unknown[][]

        if (json.length === 0) {
          resolve({ sheetName, headers: [], rows: [], rawMatrix: matrix })
          return
        }
        const headers = Object.keys(json[0]!).map(normalizeHeader)
        resolve({ sheetName, headers, rows: json, rawMatrix: matrix })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
