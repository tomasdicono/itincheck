import { format, getDaysInMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  detectProgrammingEquipamiento,
  getProgrammingMatrixDataStartRow,
  normalizeProgrammingEscala,
  parseProgrammingOperationDate,
  programmingRowEtdMinutesFromMidnight,
} from './programmingReport'

/** Columnas plantilla JetSMART (misma que informe de programación). */
const COL_FECHA = 0
const COL_ETD = 3
const COL_ESCALA = 7
const COL_MATERIAL = 11

/**
 * Swissport AEP/EZE: dos vuelos son simultáneos si el STD/ETD (columna D) dista ≤ esta cantidad de minutos.
 */
const SWISSPORT_SIMULTANEIDAD_MAX_MINUTOS = 59

/** Materiales Swissport: ARS por vuelo. */
const SWISSPORT_MATERIALES_POR_VUELO_ARS = 39_336

/** Recargo sobre pasada si el avión es 321 (columna L). */
const SWISSPORT_RECARGO_321 = 0.2

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

/** AEP y EZE: Swissport (tarifa mensual por bracket). */
export const SWISSPORT_AIRPORTS = new Set(['AEP', 'EZE'])

type SwissBracket = { min: number; max: number | null; unit: number; label: string }

/** Precio por pasada según vuelos del mes (brackets Swissport AEP). */
const AEP_SWISS_BRACKETS: SwissBracket[] = [
  { min: 133, max: 196, unit: 425_949, label: '133–196' },
  { min: 197, max: 261, unit: 407_126, label: '197–261' },
  { min: 262, max: 390, unit: 389_133, label: '262–390' },
  { min: 391, max: 519, unit: 371_942, label: '391–519' },
  { min: 520, max: 691, unit: 354_823, label: '520–691' },
  { min: 692, max: 820, unit: 348_439, label: '692–820' },
  { min: 821, max: 992, unit: 343_209, label: '821–992' },
  { min: 993, max: 1164, unit: 339_777, label: '993–1164' },
  { min: 1165, max: 1336, unit: 336_381, label: '1165–1336' },
  { min: 1337, max: null, unit: 333_019, label: '1337+' },
]

const EZE_SWISS_BRACKETS: SwissBracket[] = [
  { min: 133, max: 196, unit: 368_003, label: '133–196' },
  { min: 197, max: 261, unit: 335_360, label: '197–261' },
  { min: 262, max: 390, unit: 305_660, label: '262–390' },
  { min: 391, max: 519, unit: 296_492, label: '391–519' },
  { min: 520, max: 691, unit: 287_599, label: '520–691' },
  { min: 692, max: 820, unit: 278_970, label: '692–820' },
  { min: 821, max: 992, unit: 270_601, label: '821–992' },
  { min: 993, max: 1164, unit: 262_481, label: '993–1164' },
  { min: 1165, max: 1336, unit: 254_608, label: '1165–1336' },
  { min: 1337, max: null, unit: 246_971, label: '1337+' },
]

function swissBracketUnit(airport: 'AEP' | 'EZE', monthlyFlights: number): { unit: number; label: string } {
  if (monthlyFlights <= 0) return { unit: 0, label: '—' }
  const brackets = airport === 'AEP' ? AEP_SWISS_BRACKETS : EZE_SWISS_BRACKETS
  if (monthlyFlights < 133) {
    const b = brackets[0]
    return { unit: b.unit, label: `${b.label} (<133 vuelos)` }
  }
  for (const b of brackets) {
    if (monthlyFlights >= b.min && (b.max == null || monthlyFlights <= b.max)) {
      return { unit: b.unit, label: b.label }
    }
  }
  const last = brackets[brackets.length - 1]!
  return { unit: last.unit, label: last.label }
}

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

/** Una fila por escala y mes calendario (FlySeg). */
export type ProviderCostLine = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  vuelosTotalMes: number
  promedioVuelosPorSemanaRef: number
  tramoTarifaReferencia: number
  precioUnitarioReferenciaArs: number | null
  costoTotalMesRealArs: number | null
}

/** Un mes en AEP o EZE con desglose Swissport. */
export type SwissportMonthBlock = {
  escala: 'AEP' | 'EZE'
  mesIso: string
  mesEtiqueta: string
  vuelosTotalMes: number
  vuelos321Mes: number
  bracketRango: string
  /** Tarifa base por pasada del bracket (sin 321). */
  unitPasadaBracketArs: number
  /** Pasadas: U×no-321 + U×1,2×321 (sin simultaneidad). */
  costoPasadasArs: number
  /** Recargo por simultaneidad STD (mismo día, |ETD−ETD|≤59 min). */
  costoSimultaneidadArs: number
  costoMaterialesArs: number
  totalMesArs: number
}

export type ProviderCostReport = {
  flySeg: ProviderCostLine[]
  flySegTotalArs: number
  swissportBlocks: SwissportMonthBlock[]
  swissportTotalArs: number
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

type SwissBucketKey = string

type SwissBucket = {
  escala: 'AEP' | 'EZE'
  mesIso: string
  mesEtiqueta: string
  vuelos: number
  vuelos321: number
}

type SwissFlightDetail = {
  dayIso: string
  etdMinFromMidnight: number | null
  is321: boolean
}

/**
 * Cantidad de vuelos en el mismo grupo de simultaneidad (este + otros con STD a ≤59 min).
 * Si no hay ETD válido, se considera solo el propio vuelo (sin recargo).
 */
function swissSimultaneityGroupSizeForFlight(dayFlights: SwissFlightDetail[], index: number): number {
  const self = dayFlights[index]
  if (!self) return 1
  if (self.etdMinFromMidnight == null) return 1
  let others = 0
  for (let j = 0; j < dayFlights.length; j++) {
    if (j === index) continue
    const o = dayFlights[j]!
    if (o.etdMinFromMidnight == null) continue
    if (Math.abs(self.etdMinFromMidnight - o.etdMinFromMidnight) <= SWISSPORT_SIMULTANEIDAD_MAX_MINUTOS) {
      others++
    }
  }
  return others + 1
}

/** Recargo sobre la pasada (base con 321 si aplica): 10% si 2–3 vuelos en simultaneidad; 30% si 4 o más. */
function swissSimultaneitySurchargeRate(groupSize: number): number {
  if (groupSize <= 1) return 0
  if (groupSize <= 3) return 0.1
  return 0.3
}

function computeSwissportSimultaneitySurchargeArs(U: number, flights: SwissFlightDetail[]): number {
  if (flights.length === 0 || U <= 0) return 0

  const byDay = new Map<string, SwissFlightDetail[]>()
  for (const f of flights) {
    const arr = byDay.get(f.dayIso) ?? []
    arr.push(f)
    byDay.set(f.dayIso, arr)
  }

  let sum = 0
  for (const dayFlights of byDay.values()) {
    for (let i = 0; i < dayFlights.length; i++) {
      const f = dayFlights[i]!
      const basePasada = U * (f.is321 ? 1 + SWISSPORT_RECARGO_321 : 1)
      const g = swissSimultaneityGroupSizeForFlight(dayFlights, i)
      const rate = swissSimultaneitySurchargeRate(g)
      sum += basePasada * rate
    }
  }
  return Math.round(sum * 100) / 100
}

function buildSwissportBlocksFromBuckets(
  buckets: Map<SwissBucketKey, SwissBucket>,
  flightLists: Map<SwissBucketKey, SwissFlightDetail[]>,
): SwissportMonthBlock[] {
  const blocks: SwissportMonthBlock[] = []
  for (const b of buckets.values()) {
    const n = b.vuelos
    const n321 = b.vuelos321
    if (n <= 0) continue

    const { unit: U, label: bracketRango } = swissBracketUnit(b.escala, n)
    const nOtros = n - n321
    const costoPasadasBruto = U * nOtros + U * (1 + SWISSPORT_RECARGO_321) * n321
    const costoPasadasArs = Math.round(costoPasadasBruto * 100) / 100

    const flights = flightLists.get(`${b.escala}|${b.mesIso}`) ?? []
    const costoSimultaneidadArs = computeSwissportSimultaneitySurchargeArs(U, flights)

    const costoMaterialesArs = Math.round(n * SWISSPORT_MATERIALES_POR_VUELO_ARS * 100) / 100
    const totalMesArs = Math.round((costoPasadasArs + costoSimultaneidadArs + costoMaterialesArs) * 100) / 100

    blocks.push({
      escala: b.escala,
      mesIso: b.mesIso,
      mesEtiqueta: b.mesEtiqueta,
      vuelosTotalMes: n,
      vuelos321Mes: n321,
      bracketRango,
      unitPasadaBracketArs: U,
      costoPasadasArs,
      costoSimultaneidadArs,
      costoMaterialesArs,
      totalMesArs,
    })
  }
  blocks.sort((a, b) => {
    if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
    return a.mesIso.localeCompare(b.mesIso)
  })
  return blocks
}

/**
 * Costos por proveedor a partir de la matriz ya filtrada (mismos filtros que operativo).
 * FlySeg: franjas 1–7 / 8–14 / 15–21 / 22–31; total mes = suma real por franja.
 * Swissport (AEP/EZE): brackets por vuelos del mes, +20% pasada si 321 (col. L), simultaneidad STD (|ETD−ETD|≤59 min
 * mismo día: +10% pasada si 2–3 vuelos en el grupo, +30% si ≥4), materiales por vuelo.
 */
export function buildProviderCostReport(rawMatrix: unknown[][]): ProviderCostReport {
  const flySegPeriodMap = new Map<PeriodAggKey, PeriodCell>()
  const swissBuckets = new Map<SwissBucketKey, SwissBucket>()
  const swissFlightLists = new Map<SwissBucketKey, SwissFlightDetail[]>()

  const startRow = getProgrammingMatrixDataStartRow(rawMatrix)
  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row?.length) continue

    const opDate = parseProgrammingOperationDate(row[COL_FECHA])
    if (!opDate) continue

    const escala = normalizeProgrammingEscala(row[COL_ESCALA])
    if (escala === '—' || !ALLOWED.has(escala)) continue

    const { mesIso, mesEtiqueta } = monthKeyAndLabel(opDate)

    if (SWISSPORT_AIRPORTS.has(escala)) {
      const ap = escala as 'AEP' | 'EZE'
      const key: SwissBucketKey = `${ap}|${mesIso}`
      let b = swissBuckets.get(key)
      if (!b) {
        b = { escala: ap, mesIso, mesEtiqueta, vuelos: 0, vuelos321: 0 }
        swissBuckets.set(key, b)
      }
      b.vuelos += 1
      if (detectProgrammingEquipamiento(row[COL_MATERIAL]) === '321') b.vuelos321 += 1

      const list = swissFlightLists.get(key) ?? []
      list.push({
        dayIso: format(opDate, 'yyyy-MM-dd'),
        etdMinFromMidnight: programmingRowEtdMinutesFromMidnight(row[COL_ETD]),
        is321: detectProgrammingEquipamiento(row[COL_MATERIAL]) === '321',
      })
      swissFlightLists.set(key, list)
      continue
    }

    const periodo = monthDayPeriod(opDate)
    const key: PeriodAggKey = `${escala}|${mesIso}|${periodo}`
    const prev = flySegPeriodMap.get(key)
    if (prev) prev.n += 1
    else flySegPeriodMap.set(key, { escala, mesIso, mesEtiqueta, periodo, n: 1 })
  }

  const flySeg = rollupToMonthLines(flySegPeriodMap, true)
  const swissportBlocks = buildSwissportBlocksFromBuckets(swissBuckets, swissFlightLists)

  const flySegTotalArs = flySeg.reduce((s, l) => s + (l.costoTotalMesRealArs ?? 0), 0)
  const swissportTotalArs = swissportBlocks.reduce((s, b) => s + b.totalMesArs, 0)

  return {
    flySeg,
    flySegTotalArs: Math.round(flySegTotalArs * 100) / 100,
    swissportBlocks,
    swissportTotalArs: Math.round(swissportTotalArs * 100) / 100,
  }
}
