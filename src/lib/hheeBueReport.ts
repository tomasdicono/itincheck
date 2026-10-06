import { coerceToDate } from './dates'

/** Columnas del Excel de vuelos operados (A=0). */
const COL_ORIGEN = 6 // G
const COL_ARRIBO = 7 // H
const COL_STD = 25 // Z
const COL_STA = 26 // AA
const COL_ATD = 30 // AE
const COL_ATA = 32 // AG

const UMBRAL_MINUTOS = 45
const BUE_AIRPORTS = new Set(['AEP', 'EZE'])

export type HheeBueLineKey = 'depAep' | 'arrAep' | 'depEze' | 'arrEze'

export type HheeBueLine = {
  key: HheeBueLineKey
  label: string
  minutos: number
  horas: number
  vuelos: number
}

export type HheeBueReport = {
  totalFilasDatos: number
  lineas: HheeBueLine[]
  totalMinutos: number
  totalHoras: number
  totalVuelos: number
}

function normalizeIata(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toUpperCase()
}

function looksLikeIata(v: unknown): boolean {
  return /^[A-Z]{3}$/.test(normalizeIata(v))
}

function isHeaderRow(row: unknown[] | undefined): boolean {
  if (!row?.length) return false
  const g = normalizeIata(row[COL_ORIGEN])
  const h = normalizeIata(row[COL_ARRIBO])
  if (looksLikeIata(g) && looksLikeIata(h)) return false
  const blob = [g, h, String(row[COL_STD] ?? ''), String(row[COL_STA] ?? '')]
    .join(' ')
    .toUpperCase()
  return (
    blob.includes('ORIG') ||
    blob.includes('FROM') ||
    blob.includes('STD') ||
    blob.includes('STA') ||
    blob.includes('DEP') ||
    blob.includes('ARR') ||
    g === 'G' ||
    h === 'H'
  )
}

/** Minutos desde medianoche si el valor es solo hora; null si no se puede. */
function clockMinutes(value: unknown): number | null {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      return Math.round(value * 1440) % 1440
    }
    // Serial Excel con fracción de día
    if (value > 1) {
      const frac = value % 1
      if (frac !== 0) return Math.round(frac * 1440) % 1440
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes()
  }

  const s = String(value).trim()
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
  if (typeof value === 'number' && value > 1) return true
  if (typeof value === 'string') {
    return /\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)
  }
  return false
}

/**
 * Demora en minutos (ATD−STD o ATA−STA).
 * Si ambos traen fecha completa, usa diferencia real (puede cruzar medianoche).
 * Si son solo horas, asume mismo día; si el real es menor al programado, suma 24 h.
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
    // Sin fecha: un adelanto chico (p. ej. −10 min) no es “día siguiente”.
    // Solo sumamos 24 h si el adelanto aparente supera 2 h (cruce de medianoche).
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

export function buildHheeBueReport(rawMatrix: unknown[][]): HheeBueReport | null {
  if (!rawMatrix.length) return null

  let startRow = 0
  if (isHeaderRow(rawMatrix[0])) startRow = 1

  const buckets: Record<HheeBueLineKey, { minutos: number; vuelos: number }> = {
    depAep: { minutos: 0, vuelos: 0 },
    arrAep: { minutos: 0, vuelos: 0 },
    depEze: { minutos: 0, vuelos: 0 },
    arrEze: { minutos: 0, vuelos: 0 },
  }

  let totalFilasDatos = 0

  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row?.length) continue

    const origen = normalizeIata(row[COL_ORIGEN])
    const arribo = normalizeIata(row[COL_ARRIBO])
    if (!origen && !arribo) continue

    totalFilasDatos++

    if (BUE_AIRPORTS.has(origen)) {
      const demora = delayMinutes(row[COL_STD], row[COL_ATD])
      if (demora != null && demora >= UMBRAL_MINUTOS) {
        const key: HheeBueLineKey = origen === 'AEP' ? 'depAep' : 'depEze'
        buckets[key].minutos += demora
        buckets[key].vuelos += 1
      }
    }

    if (BUE_AIRPORTS.has(arribo)) {
      const demora = delayMinutes(row[COL_STA], row[COL_ATA])
      if (demora != null && demora >= UMBRAL_MINUTOS) {
        const key: HheeBueLineKey = arribo === 'AEP' ? 'arrAep' : 'arrEze'
        buckets[key].minutos += demora
        buckets[key].vuelos += 1
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
  }
}
