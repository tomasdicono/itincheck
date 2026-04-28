import { combineDayAndTime, coerceToDate } from '../lib/dates'
import type { ColumnMapping } from '../types/columns'
import type { DayWindow, EvaluationInput, OperationalRule, Violation } from './types'
import { getCell } from './types'

export type AirportHoursConfig = Record<string, DayWindow>

function parseHHmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function isWithinWindow(
  instant: Date,
  openStr: string,
  closeStr: string,
): { ok: boolean; openM: number; closeM: number; cur: number } {
  const openM = parseHHmmToMinutes(openStr)
  const closeM = parseHHmmToMinutes(closeStr)
  if (openM == null || closeM == null) return { ok: true, openM: 0, closeM: 24 * 60, cur: 0 }
  const cur = minutesOf(instant)
  if (openM <= closeM) {
    return { ok: cur >= openM && cur <= closeM, openM, closeM, cur }
  }
  /* overnight window e.g. 22:00–06:00 */
  const ok = cur >= openM || cur <= closeM
  return { ok, openM, closeM, cur }
}

function checkInstant(
  rowIndex: number,
  mapping: ColumnMapping,
  row: Record<string, unknown>,
  iata: string,
  cfg: AirportHoursConfig,
  ruleName: string,
  label: string,
): Violation | null {
  const win = cfg[iata.toUpperCase()]
  if (!win) return null
  const fecha = getCell(row, mapping, 'fecha')
  const hi = mapping.hora_inicio ? getCell(row, mapping, 'hora_inicio') : undefined
  const hf = mapping.hora_fin ? getCell(row, mapping, 'hora_fin') : undefined
  const instant = label.includes('inicio')
    ? combineDayAndTime(fecha, hi ?? fecha)
    : combineDayAndTime(fecha, hf ?? hi ?? fecha)

  if (!instant || !coerceToDate(fecha)) return null

  const { ok, openM, closeM } = isWithinWindow(instant, win.open, win.close)
  if (ok) return null
  const openDisp = `${Math.floor(openM / 60)}:${String(openM % 60).padStart(2, '0')}`
  const closeDisp = `${Math.floor(closeM / 60)}:${String(closeM % 60).padStart(2, '0')}`
  return {
    ruleId: 'airport-hours',
    ruleName,
    severity: 'error',
    message: `${iata}: ${label} a las ${instant.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} fuera de ventana operativa (${openDisp}–${closeDisp}).`,
    rowIndex: rowIndex + 2,
    flight: String(getCell(row, mapping, 'vuelo') ?? ''),
  }
}

export const airportHoursRule: OperationalRule = {
  id: 'airport-hours',
  name: 'Horario aeropuerto',
  description:
    'Comprueba que inicio y fin de servicio caigan dentro del horario declarado por aeropuerto (IATA).',
  defaultConfig: {
    SCL: { open: '06:00', close: '23:30' },
    LSC: { open: '07:00', close: '21:00' },
  },
  evaluate(input: EvaluationInput, config: unknown): Violation[] {
    const cfg = config as AirportHoursConfig
    const { rows, mapping } = input
    const out: Violation[] = []
    if (!mapping.aeropuerto || !mapping.fecha) return out

    rows.forEach((row, idx) => {
      const apt = String(getCell(row, mapping, 'aeropuerto') ?? '').trim()
      if (!apt) return
      const iata = apt.slice(0, 3).toUpperCase()
      if (!cfg[iata]) return

      const v1 = checkInstant(idx, mapping, row, iata, cfg, 'Horario aeropuerto', 'inicio de servicio')
      if (v1) out.push(v1)
      if (mapping.hora_fin) {
        const v2 = checkInstant(idx, mapping, row, iata, cfg, 'Horario aeropuerto', 'fin de servicio')
        if (v2) out.push(v2)
      }
    })
    return out
  },
}
