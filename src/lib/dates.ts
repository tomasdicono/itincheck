import { format, isValid, parse, parseISO, startOfDay } from 'date-fns'

/** Excel serial date to JS Date (local). */
function excelSerialToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30)
  const ms = epoch + serial * 86400000
  return new Date(ms)
}

function isExcelSerial(n: number): boolean {
  return n > 20000 && n < 60000
}

function parseTimeFraction(n: number): { h: number; m: number; s: number } {
  const dayFrac = n >= 0 && n < 1 ? n : n % 1
  const totalSeconds = Math.round(dayFrac * 86400)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return { h, m, s }
}

export function coerceToDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date && isValid(value)) return value
  if (typeof value === 'number') {
    if (value >= 0 && value < 1) {
      const base = startOfDay(new Date())
      const { h, m, s } = parseTimeFraction(value)
      base.setHours(h, m, s, 0)
      return base
    }
    if (isExcelSerial(value)) return excelSerialToDate(value)
    if (Number.isFinite(value)) {
      const d = new Date(value)
      return isValid(d) ? d : null
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const iso = parseISO(trimmed.replace(' ', 'T'))
    if (isValid(iso)) return iso
    const patterns = [
      'HH:mm',
      'H:mm',
      'HH:mm:ss',
      'dd/MM/yyyy HH:mm',
      'dd/MM/yyyy',
      'yyyy-MM-dd',
      'yyyy/MM/dd',
    ]
    for (const p of patterns) {
      const d = parse(trimmed, p, new Date())
      if (isValid(d)) return d
    }
  }
  return null
}

/**
 * Combines calendar `day` with clock from `timePart`.
 * If `timePart` is solo hora (string "HH:mm" o fracción de día), usa el día de `day`.
 */
export function combineDayAndTime(day: unknown, timePart: unknown): Date | null {
  const dDay = day != null ? coerceToDate(day) : null

  if (timePart == null || timePart === '') {
    return dDay ? startOfDay(dDay) : null
  }

  if (typeof timePart === 'number' && timePart >= 0 && timePart < 1) {
    const base = dDay ? startOfDay(dDay) : startOfDay(new Date())
    const { h, m, s } = parseTimeFraction(timePart)
    base.setHours(h, m, s, 0)
    return base
  }

  if (typeof timePart === 'string') {
    const t = timePart.trim()
    const timeOnly = /^\d{1,2}:\d{2}/.test(t) && !t.includes('/') && t.length <= 12
    if (timeOnly && dDay) {
      const ref = startOfDay(dDay)
      const parsed = parse(t, t.length > 5 ? 'HH:mm:ss' : 'HH:mm', ref)
      if (isValid(parsed)) return parsed
    }
  }

  const t = coerceToDate(timePart)
  if (t && dDay) {
    const fullDatetimeHint =
      typeof timePart === 'string' &&
      (/\d{4}-\d{2}-\d{2}/.test(timePart) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(timePart))
    if (fullDatetimeHint) return t
    const base = startOfDay(dDay)
    base.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0)
    return base
  }

  if (t && isValid(t)) return t
  return dDay
}

export function formatDateTime(d: Date): string {
  return format(d, 'dd/MM/yyyy HH:mm')
}
