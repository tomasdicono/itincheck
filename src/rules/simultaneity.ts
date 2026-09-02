import { combineDayAndTime, coerceToDate } from '../lib/dates'
import type { EvaluationInput, OperationalRule, Violation } from './types'
import { getCell } from './types'

export type SimultaneityConfig = {
  /** Máximo de operaciones solapadas permitidas por mismo handler (>=1). */
  maxConcurrent: number
}

type Interval = { start: number; end: number; rowIndex: number; flight: string }

/** Fin exclusivo para no contar como solape el toque en el mismo instante. */
function endExclusive(iv: Interval): number {
  if (iv.end <= iv.start) return iv.start + 60_000
  return iv.end + 1
}

function maxOverlapOn(intervals: Interval[]): number {
  const points: { t: number; d: number }[] = []
  for (const iv of intervals) {
    points.push({ t: iv.start, d: 1 })
    points.push({ t: endExclusive(iv), d: -1 })
  }
  points.sort((p, q) => (p.t === q.t ? p.d - q.d : p.t - q.t))
  let cur = 0
  let best = 0
  for (const p of points) {
    cur += p.d
    best = Math.max(best, cur)
  }
  return best
}

export const simultaneityRule: OperationalRule = {
  id: 'handler-simultaneity',
  name: 'Simultaneidad handler',
  description:
    'Cuenta solapes de intervalos [inicio, fin] por mismo handler; alerta si supera el máximo permitido.',
  defaultConfig: { maxConcurrent: 1 },
  evaluate(input: EvaluationInput, config: unknown): Violation[] {
    const cfg = (config as SimultaneityConfig) ?? { maxConcurrent: 1 }
    const { rows, mapping } = input
    const maxOk = Math.max(1, Math.floor(Number(cfg.maxConcurrent) || 1))
    if (!mapping.handler || !mapping.fecha) return []

    const byHandler = new Map<string, Interval[]>()

    rows.forEach((row, idx) => {
      const h = String(getCell(row, mapping, 'handler') ?? '').trim()
      if (!h) return
      const fecha = getCell(row, mapping, 'fecha')
      const hi = getCell(row, mapping, 'hora_inicio')
      const startD = combineDayAndTime(fecha, hi ?? fecha)
      if (!startD || !coerceToDate(fecha)) return
      const start = startD.getTime()
      const aeropuerto = String(getCell(row, mapping, 'aeropuerto') ?? '').trim().toUpperCase()
      const isAepEze = aeropuerto === 'AEP' || aeropuerto === 'EZE'
      const windowMin = isAepEze ? 60 : 50
      
      const end = start + windowMin * 60 * 1000
      const list = byHandler.get(h) ?? []
      list.push({
        start,
        end,
        rowIndex: idx,
        flight: String(getCell(row, mapping, 'vuelo') ?? ''),
      })
      byHandler.set(h, list)
    })

    const out: Violation[] = []
    for (const [handler, intervals] of byHandler) {
      if (intervals.length < 2) continue
      const peak = maxOverlapOn(intervals)
      if (peak > maxOk) {
        out.push({
          ruleId: 'handler-simultaneity',
          ruleName: 'Simultaneidad handler',
          severity: 'warning',
          message: `Handler "${handler}": hasta ${peak} operaciones solapadas; máximo permitido ${maxOk}.`,
        })
      }
    }
    return out
  },
}
