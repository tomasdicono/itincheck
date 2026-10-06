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

/**
 * Matriz con índices de columna absolutos (A=0, B=1, …) y valores crudos de celda (`cell.v`).
 * Evita el corrimiento de columnas cuando el rango usado del sheet no empieza en A.
 */
export function sheetToAbsoluteRawMatrix(ws: XLSX.WorkSheet): unknown[][] {
  const ref = ws['!ref']
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const matrix: unknown[][] = []

  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: unknown[] = new Array(range.e.c + 1).fill(null)
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })] as XLSX.CellObject | undefined
      if (!cell) continue
      // Preferir Date real si SheetJS ya la materializó; si no, valor crudo (número/serial/texto).
      if (cell.t === 'd' && cell.v instanceof Date) row[C] = cell.v
      else if (cell.v !== undefined) row[C] = cell.v
      else row[C] = null
    }
    matrix.push(row)
  }
  return matrix
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
        // Matriz para informes de programación (formato string, compatible con código existente).
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

/** Lectura orientada a HH:EE: valores crudos + columnas absolutas A=0. */
export function parseExcelFileAbsoluteRaw(file: File): Promise<{
  sheetName: string
  rawMatrix: unknown[][]
  rowCount: number
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true, dense: false })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const rawMatrix = sheetToAbsoluteRawMatrix(ws)
        const rowCount = rawMatrix.filter((row) => row.some((c) => c != null && String(c).trim() !== '')).length
        resolve({ sheetName, rawMatrix, rowCount })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
