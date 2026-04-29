import { format } from 'date-fns'
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
export function monthDayPeriod(d: Date): 1 | 2 | 3 | 4 {
  const day = d.getDate()
  if (day <= 7) return 1
  if (day <= 14) return 2
  if (day <= 21) return 3
  return 4
}

export function monthPeriodLabel(period: 1 | 2 | 3 | 4): string {
  if (period === 1) return 'Días 1–7'
  if (period === 2) return 'Días 8–14'
  if (period === 3) return 'Días 15–21'
  return 'Días 22–31'
}

export type ProviderCostLine = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  periodo: 1 | 2 | 3 | 4
  periodoLabel: string
  vuelos: number
  tramoTarifa: number
  precioUnitarioArs: number | null
  subtotalArs: number | null
}

export type ProviderCostReport = {
  flySeg: ProviderCostLine[]
  flySegTotalArs: number
  swissport: ProviderCostLine[]
  swissportTotalArs: number | null
  swissportPendingPrices: boolean
}

type AggKey = string

function monthKeyAndLabel(d: Date): { mesIso: string; mesEtiqueta: string } {
  const mesIso = format(d, 'yyyy-MM')
  const mesEtiqueta = format(d, 'MMMM yyyy', { locale: es })
  return { mesIso, mesEtiqueta }
}

/**
 * Costos por proveedor a partir de la matriz ya filtrada (mismos filtros que operativo).
 * Solo cuenta filas con fecha válida y escala en `COST_REPORT_AIRPORTS`.
 */
export function buildProviderCostReport(rawMatrix: unknown[][]): ProviderCostReport {
  const flySegMap = new Map<AggKey, { escala: string; mesIso: string; mesEtiqueta: string; periodo: 1 | 2 | 3 | 4; n: number }>()
  const swissMap = new Map<AggKey, { escala: string; mesIso: string; mesEtiqueta: string; periodo: 1 | 2 | 3 | 4; n: number }>()

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
    const key: AggKey = `${escala}|${mesIso}|${periodo}`

    if (SWISSPORT_AIRPORTS.has(escala)) {
      const prev = swissMap.get(key)
      if (prev) prev.n += 1
      else swissMap.set(key, { escala, mesIso, mesEtiqueta, periodo, n: 1 })
    } else {
      const prev = flySegMap.get(key)
      if (prev) prev.n += 1
      else flySegMap.set(key, { escala, mesIso, mesEtiqueta, periodo, n: 1 })
    }
  }

  const toLines = (
    map: Map<AggKey, { escala: string; mesIso: string; mesEtiqueta: string; periodo: 1 | 2 | 3 | 4; n: number }>,
    withPricing: boolean,
  ): ProviderCostLine[] => {
    const lines = [...map.values()].map((v) => {
      const tramoTarifa = Math.min(v.n, 60)
      const precioUnitarioArs = withPricing ? flySegUnitForCount(v.n) : null
      const subtotalArs =
        withPricing && v.n > 0 ? Math.round(v.n * (precioUnitarioArs as number) * 100) / 100 : null
      return {
        escala: v.escala,
        mesIso: v.mesIso,
        mesEtiqueta: v.mesEtiqueta,
        periodo: v.periodo,
        periodoLabel: monthPeriodLabel(v.periodo),
        vuelos: v.n,
        tramoTarifa,
        precioUnitarioArs,
        subtotalArs,
      }
    })
    lines.sort((a, b) => {
      if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
      if (a.mesIso !== b.mesIso) return a.mesIso.localeCompare(b.mesIso)
      return a.periodo - b.periodo
    })
    return lines
  }

  const flySeg = toLines(flySegMap, true)
  const swissport = toLines(swissMap, false)

  const flySegTotalArs = flySeg.reduce((s, l) => s + (l.subtotalArs ?? 0), 0)

  return {
    flySeg,
    flySegTotalArs: Math.round(flySegTotalArs * 100) / 100,
    swissport,
    swissportTotalArs: null,
    swissportPendingPrices: true,
  }
}
