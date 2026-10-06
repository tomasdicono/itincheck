import { coerceToDate } from './dates'

/** Columnas por defecto del Excel de vuelos operados (A=0). */
const DEFAULT_COLS = {
  origen: 6, // G
  arribo: 7, // H
  std: 25, // Z
  sta: 26, // AA
  atd: 30, // AE
  ata: 32, // AG
} as const

const UMBRAL_MINUTOS = 45

const ICAO_TO_IATA: Record<string, string> = {
  SABE: 'AEP',
  SAEZ: 'EZE',
}

const BUE_AIRPORTS = new Set(['AEP', 'EZE'])

export type HheeBueLineKey = 'depAep' | 'arrAep' | 'depEze' | 'arrEze'

export type HheeBueLine = {
  key: HheeBueLineKey
  label: string
  minutos: number
  horas: number
  vuelos: number
}

export type HheeBueDiagnostics = {
  filasConOrigenOArribo: number
  filasBueDep: number
  filasBueArr: number
  demorasDepParseadas: number
  demorasArrParseadas: number
  demorasDepSobreUmbral: number
  demorasArrSobreUmbral: number
  columnas: {
    origen: number
    arribo: number
    std: number
    sta: number
    atd: number
    ata: number
    fuente: 'fijas' | 'encabezados'
  }
  muestra: {
    origen: string
    arribo: string
    std: string
    atd: string
    sta: string
    ata: string
    demoraDepMin: number | null
    demoraArrMin: number | null
  } | null
}

export type HheeBueReport = {
  totalFilasDatos: number
  lineas: HheeBueLine[]
  totalMinutos: number
  totalHoras: number
  totalVuelos: number
  diagnostics: HheeBueDiagnostics
}

type ColMap = {
  origen: number
  arribo: number
  std: number
  sta: number
  atd: number
  ata: number
}

function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function normalizeHeaderToken(v: unknown): string {
  return cellText(v)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ]/g, '')
}

/** Extrae IATA (AEP/EZE) también desde ICAO o textos tipo "AEP - Aeroparque". */
export function normalizeAirport(v: unknown): string {
  const raw = cellText(v).toUpperCase()
  if (!raw) return ''

  if (ICAO_TO_IATA[raw]) return ICAO_TO_IATA[raw]
  if (BUE_AIRPORTS.has(raw)) return raw

  const icao = raw.match(/\b(SABE|SAEZ)\b/)
  if (icao) return ICAO_TO_IATA[icao[1]!]!

  const iata = raw.match(/\b(AEP|EZE)\b/)
  if (iata) return iata[1]!

  // Código puro de 3 letras
  if (/^[A-Z]{3}$/.test(raw)) return raw

  return raw
}

function looksLikeAirportCode(v: unknown): boolean {
  const n = normalizeAirport(v)
  return /^[A-Z]{3}$/.test(n) || BUE_AIRPORTS.has(n)
}

function findHeaderRow(rawMatrix: unknown[][]): number {
  const maxScan = Math.min(rawMatrix.length, 15)
  for (let r = 0; r < maxScan; r++) {
    const row = rawMatrix[r]
    if (!row) continue
    const joined = row.map(normalizeHeaderToken).join('|')
    if (
      (joined.includes('STD') && joined.includes('STA')) ||
      (joined.includes('ATD') && joined.includes('ATA')) ||
      (joined.includes('ORIG') && (joined.includes('DEST') || joined.includes('ARR')))
    ) {
      return r
    }
  }
  // Si la primera fila no parece dato IATA, trátala como encabezado.
  const first = rawMatrix[0]
  if (first && !(looksLikeAirportCode(first[DEFAULT_COLS.origen]) && looksLikeAirportCode(first[DEFAULT_COLS.arribo]))) {
    return 0
  }
  return -1
}

function findColByHeaders(headerRow: unknown[], patterns: RegExp[]): number {
  for (let c = 0; c < headerRow.length; c++) {
    const token = normalizeHeaderToken(headerRow[c])
    if (!token) continue
    if (patterns.some((re) => re.test(token))) return c
  }
  return -1
}

function resolveColumns(rawMatrix: unknown[][]): { cols: ColMap; fuente: 'fijas' | 'encabezados'; headerRowIdx: number } {
  const headerRowIdx = findHeaderRow(rawMatrix)
  if (headerRowIdx >= 0) {
    const headerRow = rawMatrix[headerRowIdx] ?? []
    const origen = findColByHeaders(headerRow, [/^ORIG/, /^FROM$/, /^DEP\s*AIRPORT$/, /^AEROPUERTO\s*SALIDA$/, /^ORIGIN$/])
    const arribo = findColByHeaders(headerRow, [/^DEST/, /^TO$/, /^ARR\s*AIRPORT$/, /^AEROPUERTO\s*LLEGADA$/, /^ARRIBO$/, /^ARRIVAL$/])
    const std = findColByHeaders(headerRow, [/^STD$/, /^STD\b/, /^SCHEDULED\s*DEP/, /^ETD$/])
    const sta = findColByHeaders(headerRow, [/^STA$/, /^STA\b/, /^SCHEDULED\s*ARR/, /^ETA$/])
    const atd = findColByHeaders(headerRow, [/^ATD$/, /^ATD\b/, /^ACTUAL\s*DEP/, /^OFF\s*BLOCK/])
    const ata = findColByHeaders(headerRow, [/^ATA$/, /^ATA\b/, /^ACTUAL\s*ARR/, /^ON\s*BLOCK/])

    const resolved: ColMap = {
      origen: origen >= 0 ? origen : DEFAULT_COLS.origen,
      arribo: arribo >= 0 ? arribo : DEFAULT_COLS.arribo,
      std: std >= 0 ? std : DEFAULT_COLS.std,
      sta: sta >= 0 ? sta : DEFAULT_COLS.sta,
      atd: atd >= 0 ? atd : DEFAULT_COLS.atd,
      ata: ata >= 0 ? ata : DEFAULT_COLS.ata,
    }

    const anyFound = [origen, arribo, std, sta, atd, ata].some((n) => n >= 0)
    return { cols: resolved, fuente: anyFound ? 'encabezados' : 'fijas', headerRowIdx }
  }

  return { cols: { ...DEFAULT_COLS }, fuente: 'fijas', headerRowIdx: -1 }
}

/** Minutos desde medianoche si el valor es solo hora; null si no se puede. */
function clockMinutes(value: unknown): number | null {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Fracción de día Excel (hora sola)
    if (value >= 0 && value < 1) {
      return Math.round(value * 1440) % 1440
    }
    // Serial Excel con fecha+hora
    if (value >= 1) {
      const frac = value % 1
      // Evitar error de punto flotante: 0.999999 → casi día siguiente
      const mins = Math.round(((frac + 1e-10) % 1) * 1440) % 1440
      return mins
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes()
  }

  const s = String(value).trim()
  if (!s) return null

  // 14:30 / 14:30:00 / 2:30:00 PM
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\b/i)
  if (ampm) {
    let h = Number(ampm[1])
    const min = Number(ampm[2])
    const mer = ampm[4]!.toUpperCase()
    if (mer === 'PM' && h < 12) h += 12
    if (mer === 'AM' && h === 12) h = 0
    if (Number.isFinite(h) && Number.isFinite(min)) return (h * 60 + min) % 1440
  }

  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (Number.isFinite(h) && Number.isFinite(min) && h >= 0 && h <= 47 && min >= 0 && min < 60) {
      return (h * 60 + min) % 1440
    }
  }

  const d = coerceToDate(value)
  if (d) return d.getHours() * 60 + d.getMinutes()
  return null
}

function hasFullDateHint(value: unknown): boolean {
  if (value instanceof Date) return true
  if (typeof value === 'number' && value >= 1) return true
  if (typeof value === 'string') {
    return /\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)
  }
  return false
}

/**
 * Demora en minutos (ATD−STD o ATA−STA).
 * Si ambos traen fecha completa, usa diferencia real (puede cruzar medianoche).
 * Si son solo horas, asume mismo día; adelantos chicos no se tratan como día siguiente.
 */
export function delayMinutes(scheduled: unknown, actual: unknown): number | null {
  if (scheduled == null || scheduled === '' || actual == null || actual === '') return null

  if (hasFullDateHint(scheduled) && hasFullDateHint(actual)) {
    const s = coerceToDate(scheduled)
    const a = coerceToDate(actual)
    if (s && a) {
      const diff = Math.round((a.getTime() - s.getTime()) / 60000)
      return Number.isFinite(diff) ? diff : null
    }
  }

  const sMin = clockMinutes(scheduled)
  const aMin = clockMinutes(actual)
  if (sMin == null || aMin == null) return null

  let diff = aMin - sMin
  if (diff < 0) {
    if (-diff <= 120) return diff
    diff += 1440
  }
  return diff
}

/** Formato HH:MM a partir de minutos totales (puede superar 24 h). */
export function formatHheeMinutes(totalMin: number): string {
  const n = Math.max(0, Math.round(totalMin))
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function previewValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (v instanceof Date) {
    const hh = String(v.getHours()).padStart(2, '0')
    const mm = String(v.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  if (typeof v === 'number') {
    const mins = clockMinutes(v)
    if (mins != null) {
      const hh = String(Math.floor(mins / 60)).padStart(2, '0')
      const mm = String(mins % 60).padStart(2, '0')
      return `${hh}:${mm}`
    }
  }
  const s = String(v).trim()
  return s.length > 40 ? `${s.slice(0, 40)}…` : s
}

export function buildHheeBueReport(rawMatrix: unknown[][]): HheeBueReport | null {
  if (!rawMatrix.length) return null

  const { cols, fuente, headerRowIdx } = resolveColumns(rawMatrix)
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0

  const buckets: Record<HheeBueLineKey, { minutos: number; vuelos: number }> = {
    depAep: { minutos: 0, vuelos: 0 },
    arrAep: { minutos: 0, vuelos: 0 },
    depEze: { minutos: 0, vuelos: 0 },
    arrEze: { minutos: 0, vuelos: 0 },
  }

  let totalFilasDatos = 0
  let filasBueDep = 0
  let filasBueArr = 0
  let demorasDepParseadas = 0
  let demorasArrParseadas = 0
  let demorasDepSobreUmbral = 0
  let demorasArrSobreUmbral = 0
  let muestra: HheeBueDiagnostics['muestra'] = null

  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row?.length) continue

    const origen = normalizeAirport(row[cols.origen])
    const arribo = normalizeAirport(row[cols.arribo])
    if (!origen && !arribo) continue

    totalFilasDatos++

    const isBueDep = BUE_AIRPORTS.has(origen)
    const isBueArr = BUE_AIRPORTS.has(arribo)

    if (isBueDep) filasBueDep++
    if (isBueArr) filasBueArr++

    let demoraDep: number | null = null
    let demoraArr: number | null = null

    if (isBueDep) {
      demoraDep = delayMinutes(row[cols.std], row[cols.atd])
      if (demoraDep != null) {
        demorasDepParseadas++
        if (demoraDep >= UMBRAL_MINUTOS) {
          demorasDepSobreUmbral++
          const key: HheeBueLineKey = origen === 'AEP' ? 'depAep' : 'depEze'
          buckets[key].minutos += demoraDep
          buckets[key].vuelos += 1
        }
      }
    }

    if (isBueArr) {
      demoraArr = delayMinutes(row[cols.sta], row[cols.ata])
      if (demoraArr != null) {
        demorasArrParseadas++
        if (demoraArr >= UMBRAL_MINUTOS) {
          demorasArrSobreUmbral++
          const key: HheeBueLineKey = arribo === 'AEP' ? 'arrAep' : 'arrEze'
          buckets[key].minutos += demoraArr
          buckets[key].vuelos += 1
        }
      }
    }

    if (!muestra && (isBueDep || isBueArr)) {
      muestra = {
        origen: origen || '—',
        arribo: arribo || '—',
        std: previewValue(row[cols.std]),
        atd: previewValue(row[cols.atd]),
        sta: previewValue(row[cols.sta]),
        ata: previewValue(row[cols.ata]),
        demoraDepMin: demoraDep,
        demoraArrMin: demoraArr,
      }
    }
  }

  const defs: { key: HheeBueLineKey; label: string }[] = [
    { key: 'depAep', label: 'HHEE Operadas DEP AEP' },
    { key: 'arrAep', label: 'HHEE Operadas ARR AEP' },
    { key: 'depEze', label: 'HHEE Operadas DEP EZE' },
    { key: 'arrEze', label: 'HHEE Operadas ARR EZE' },
  ]

  const lineas: HheeBueLine[] = defs.map(({ key, label }) => {
    const { minutos, vuelos } = buckets[key]
    return {
      key,
      label,
      minutos,
      horas: minutos / 60,
      vuelos,
    }
  })

  const totalMinutos = lineas.reduce((acc, l) => acc + l.minutos, 0)
  const totalVuelos = lineas.reduce((acc, l) => acc + l.vuelos, 0)

  return {
    totalFilasDatos,
    lineas,
    totalMinutos,
    totalHoras: totalMinutos / 60,
    totalVuelos,
    diagnostics: {
      filasConOrigenOArribo: totalFilasDatos,
      filasBueDep,
      filasBueArr,
      demorasDepParseadas,
      demorasArrParseadas,
      demorasDepSobreUmbral,
      demorasArrSobreUmbral,
      columnas: { ...cols, fuente },
      muestra,
    },
  }
}
