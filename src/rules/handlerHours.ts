import { combineDayAndTime, coerceToDate } from '../lib/dates'
import type { DayWindow, EvaluationInput, OperationalRule, Violation } from './types'
import { getCell } from './types'

export type HandlerHoursConfig = Record<string, DayWindow>

function parseHHmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function isWithinWindow(instant: Date, openStr: string, closeStr: string): boolean {
  const openM = parseHHmmToMinutes(openStr)
  const closeM = parseHHmmToMinutes(closeStr)
  if (openM == null || closeM == null) return true
  const cur = minutesOf(instant)
  if (openM <= closeM) return cur >= openM && cur <= closeM
  return cur >= openM || cur <= closeM
}

function normHandler(s: string): string {
  return s.trim().toUpperCase()
}

export const handlerHoursRule: OperationalRule = {
  id: 'handler-hours',
  name: 'Horario handler (ITC)',
  description: 'Ventana operativa por proveedor de rampa / ITC.',
  defaultConfig: {
    ITC: { open: '05:00', close: '22:00' },
    'SWISSPORT': { open: '04:30', close: '23:00' },
  },
  evaluate(input: EvaluationInput, config: unknown): Violation[] {
    const cfg = config as HandlerHoursConfig
    const { rows, mapping } = input
    const out: Violation[] = []
    if (!mapping.handler || !mapping.fecha) return out

    rows.forEach((row, idx) => {
      const hRaw = String(getCell(row, mapping, 'handler') ?? '').trim()
      if (!hRaw) return
      const key = normHandler(hRaw)
      const win =
        cfg[key] ||
        cfg[hRaw] ||
        Object.entries(cfg).find(([k]) => normHandler(k) === key)?.[1]
      if (!win) return

      const fecha = getCell(row, mapping, 'fecha')
      const hi = mapping.hora_inicio ? getCell(row, mapping, 'hora_inicio') : undefined
      const hf = mapping.hora_fin ? getCell(row, mapping, 'hora_fin') : undefined

      const instInicio = combineDayAndTime(fecha, hi ?? fecha)
      if (instInicio && coerceToDate(fecha) && !isWithinWindow(instInicio, win.open, win.close)) {
        out.push({
          ruleId: 'handler-hours',
          ruleName: 'Horario handler (ITC)',
          severity: 'error',
          message: `${hRaw}: inicio fuera de ventana (${win.open}–${win.close}).`,
          rowIndex: idx + 2,
          flight: String(getCell(row, mapping, 'vuelo') ?? ''),
        })
      }
      if (mapping.hora_fin) {
        const instFin = combineDayAndTime(fecha, hf ?? hi ?? fecha)
        if (instFin && coerceToDate(fecha) && !isWithinWindow(instFin, win.open, win.close)) {
          out.push({
            ruleId: 'handler-hours',
            ruleName: 'Horario handler (ITC)',
            severity: 'error',
            message: `${hRaw}: fin fuera de ventana (${win.open}–${win.close}).`,
            rowIndex: idx + 2,
            flight: String(getCell(row, mapping, 'vuelo') ?? ''),
          })
        }
      }
    })
    return out
  },
}
