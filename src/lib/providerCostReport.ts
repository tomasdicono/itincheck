import { format, getDaysInMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  getProgrammingMatrixDataStartRow,
  normalizeProgrammingEscala,
  parseProgrammingOperationDate,
} from './programmingReport'

/** Columnas plantilla JetSMART (misma que informe de programación). */
const COL_FECHA = 0
const COL_ESCALA = 7

/** Escalas incluidas en análisis de costos (proveedores). */
export const COST_REPORT_AIRPORTS = [
  'AEP',
  'BRC',
  'CPC',
  'COR',
  'CRD',
  'EZE',
  'FTE',
  'IGR',
  'MDZ',
  'NQN',
  'REL',
  'RES',
  'SLA',
  'TUC',
  'USH',
] as const

const ALLOWED = new Set<string>(COST_REPORT_AIRPORTS)

/** AEP y EZE: tabla Swissport (tarifas pendientes). */
export const SWISSPORT_AIRPORTS = new Set(['AEP', 'EZE'])

/**
 * Precio por vuelo (llegada + salida) en ARS según cantidad de vuelos en la franja mensual (1–7, 8–14, etc.).
 * Índice = cantidad de vuelos en esa franja; >60 usa tarifa 60.
 */
function buildFlySegUnitPriceByFlightCount(): number[] {
  const p = new Array<number>(61).fill(0)
  p[1] = 2_229_207.85
  p[2] = 1_981_507.29
  p[3] = 1_486_128.6
  for (let i = 4; i <= 7; i++) p[i] = 743_064.29
  for (let i = 8; i <= 14; i++) p[i] = 618_956.01
  for (let i = 15; i <= 21; i++) p[i] = 495_386.17
  for (let i = 22; i <= 28; i++) p[i] = 441_160.78
  for (let i = 29; i <= 40; i++) p[i] = 419_102.74
  for (let i = 41; i <= 60; i++) p[i] = 398_214.23
  return p
}

const FLYSEG_UNIT = buildFlySegUnitPriceByFlightCount()

function flySegUnitForCount(n: number): number {
  if (n <= 0) return 0
  const tier = Math.min(n, 60)
  return FLYSEG_UNIT[tier] ?? FLYSEG_UNIT[60]
}

/** 1 = días 1–7, 2 = 8–14, 3 = 15–21, 4 = 22–31 */
function monthDayPeriod(d: Date): 1 | 2 | 3 | 4 {
  const day = d.getDate()
  if (day <= 7) return 1
  if (day <= 14) return 2
  if (day <= 21) return 3
  return 4
}

/** Una fila por escala y mes calendario. */
export type ProviderCostLine = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  /** Total de vuelos en el mes (todas las franjas). */
  vuelosTotalMes: number
  /**
   * Referencia: vuelos del mes × 7 / días del mes (promedio de vuelos por semana calendario).
   */
  promedioVuelosPorSemanaRef: number
  /** Tramo 1–60 de la grilla usado para el precio unitario de referencia (según promedio redondeado). */
  tramoTarifaReferencia: number
  /** Precio unitario FlySeg del tramo de referencia (solo informativo). */
  precioUnitarioReferenciaArs: number | null
  /** Σ (vuelos en cada franja × tarifa unitaria de esa franja). */
  costoTotalMesRealArs: number | null
}

export type ProviderCostReport = {
  flySeg: ProviderCostLine[]
  flySegTotalArs: number
  swissport: ProviderCostLine[]
  swissportTotalArs: number | null
  swissportPendingPrices: boolean
}

type PeriodAggKey = string

type PeriodCell = { escala: string; mesIso: string; mesEtiqueta: string; periodo: 1 | 2 | 3 | 4; n: number }

function monthKeyAndLabel(d: Date): { mesIso: string; mesEtiqueta: string } {
  const mesIso = format(d, 'yyyy-MM')
  const mesEtiqueta = format(d, 'MMMM yyyy', { locale: es })
  return { mesIso, mesEtiqueta }
}

function rollupToMonthLines(
  periodMap: Map<PeriodAggKey, PeriodCell>,
  withPricing: boolean,
): ProviderCostLine[] {
  const monthBuckets = new Map<
    string,
    { escala: string; mesIso: string; mesEtiqueta: string; counts: [number, number, number, number] }
  >()

  for (const v of periodMap.values()) {
    const mk = `${v.escala}|${v.mesIso}`
    let b = monthBuckets.get(mk)
    if (!b) {
      b = { escala: v.escala, mesIso: v.mesIso, mesEtiqueta: v.mesEtiqueta, counts: [0, 0, 0, 0] }
      monthBuckets.set(mk, b)
    }
    b.counts[v.periodo - 1] = v.n
  }

  const lines: ProviderCostLine[] = []
  for (const b of monthBuckets.values()) {
    const [c1, c2, c3, c4] = b.counts
    const vuelosTotalMes = c1 + c2 + c3 + c4
    const dim = getDaysInMonth(parseISO(`${b.mesIso}-01`))
    const promedioVuelosPorSemanaRef = dim > 0 ? (vuelosTotalMes * 7) / dim : 0

    const roundedAvg = Math.round(promedioVuelosPorSemanaRef)
    const tramoTarifaReferencia =
      vuelosTotalMes === 0 ? 0 : Math.min(60, Math.max(1, roundedAvg === 0 ? 1 : roundedAvg))

    const precioUnitarioReferenciaArs =
      withPricing && vuelosTotalMes > 0 ? flySegUnitForCount(tramoTarifaReferencia) : null

    const costoBruto =
      c1 * flySegUnitForCount(c1) + c2 * flySegUnitForCount(c2) + c3 * flySegUnitForCount(c3) + c4 * flySegUnitForCount(c4)
    const costoTotalMesRealArs =
      withPricing && vuelosTotalMes > 0 ? Math.round(costoBruto * 100) / 100 : null

    lines.push({
      escala: b.escala,
      mesIso: b.mesIso,
      mesEtiqueta: b.mesEtiqueta,
      vuelosTotalMes,
      promedioVuelosPorSemanaRef: Math.round(promedioVuelosPorSemanaRef * 100) / 100,
      tramoTarifaReferencia,
      precioUnitarioReferenciaArs,
      costoTotalMesRealArs,
    })
  }

  lines.sort((a, b) => {
    if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
    return a.mesIso.localeCompare(b.mesIso)
  })
  return lines
}

/**
 * Costos por proveedor a partir de la matriz ya filtrada (mismos filtros que operativo).
 * Solo cuenta filas con fecha válida y escala en `COST_REPORT_AIRPORTS`.
 * Internamente usa franjas 1–7 / 8–14 / 15–21 / 22–31; el costo del mes es la suma real por franja.
 */
export function buildProviderCostReport(rawMatrix: unknown[][]): ProviderCostReport {
  const flySegPeriodMap = new Map<PeriodAggKey, PeriodCell>()
  const swissPeriodMap = new Map<PeriodAggKey, PeriodCell>()

  const startRow = getProgrammingMatrixDataStartRow(rawMatrix)
  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row?.length) continue

    const opDate = parseProgrammingOperationDate(row[COL_FECHA])
    if (!opDate) continue

    const escala = normalizeProgrammingEscala(row[COL_ESCALA])
    if (escala === '—' || !ALLOWED.has(escala)) continue

    const { mesIso, mesEtiqueta } = monthKeyAndLabel(opDate)
    const periodo = monthDayPeriod(opDate)
    const key: PeriodAggKey = `${escala}|${mesIso}|${periodo}`

    const target = SWISSPORT_AIRPORTS.has(escala) ? swissPeriodMap : flySegPeriodMap
    const prev = target.get(key)
    if (prev) prev.n += 1
    else target.set(key, { escala, mesIso, mesEtiqueta, periodo, n: 1 })
  }

  const flySeg = rollupToMonthLines(flySegPeriodMap, true)
  const swissport = rollupToMonthLines(swissPeriodMap, false)

  const flySegTotalArs = flySeg.reduce((s, l) => s + (l.costoTotalMesRealArs ?? 0), 0)

  return {
    flySeg,
    flySegTotalArs: Math.round(flySegTotalArs * 100) / 100,
    swissport,
    swissportTotalArs: null,
    swissportPendingPrices: true,
  }
}
