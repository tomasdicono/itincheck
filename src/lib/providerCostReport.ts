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
/** Destino (Excel columna I): usado para clasificar vuelos internacionales en costos Rampa. */
const COL_DESTINO = 8
const COL_MATERIAL = 11

/** Costos Rampa (USD por vuelo, escalas distintas de REL/RES). */
export const RAMPA_DOM_320_USD = 223
export const RAMPA_DOM_321_USD = 262
export const RAMPA_INTER_320_USD = 1062
export const RAMPA_INTER_321_USD = 1261
export const RAMPA_ADICIONALES_USD = 31
/** REL y RES: tarifa plana por vuelo (sin adicional de 31 USD). */
export const RAMPA_REL_RES_USD = 550

/** ITC “tarifa vieja”: doméstico 320/321 (inter sigue con tarifas Rampa actuales). */
export const ITC_VIEJA_DOM_320_USD = 70
export const ITC_VIEJA_DOM_321_USD = 80

/** Descuento sobre la tarifa Rampa (incl. adicionales) si ETD 00:00–05:59 en vuelos DOM; no REL/RES ni inter. */
export const RAMPA_DESCUENTO_MADRUGADA = 0.375

const RAMPA_MADRUGADA_FIN_MIN = 5 * 60 + 59

/** Destinos en columna I que clasifican el vuelo como internacional para Rampa. */
export const RAMPA_INTER_DESTINOS = ['LIM', 'SCL', 'NAT', 'REC', 'GIG', 'FLN', 'IQQ', 'ASU'] as const

const RAMPA_INTER_DESTINO_CODES = new Set<string>(RAMPA_INTER_DESTINOS)

/**
 * Swissport AEP/EZE: dos vuelos son simultáneos si el STD/ETD (columna D) dista ≤ esta cantidad de minutos.
 */
const SWISSPORT_SIMULTANEIDAD_MAX_MINUTOS = 59

/** Materiales Swissport: ARS por vuelo. */
const SWISSPORT_MATERIALES_POR_VUELO_ARS = 39_336

/** Sillas de ruedas (WCH) facturadas por vuelo en FlySeg. */
export const FLYSEG_SILLAS_RUEDAS_POR_VUELO = 1

/** Sillas de ruedas facturadas por vuelo en Swissport (AEP/EZE). */
export const SWISSPORT_SILLAS_RUEDAS_POR_VUELO = 2

/** Sillas de ruedas: ARS unitario (FlySeg, escalas fuera de AEP/EZE). */
export const FLYSEG_SILLA_RUEDAS_UNITARIO_ARS = 55_418

/** Sillas de ruedas: ARS unitario (Swissport AEP/EZE). */
export const SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS = 60_300

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

/** Una fila por escala y mes calendario (FlySeg); el desglose se arma en la UI (franjas + sillas + total). */
export type ProviderCostLine = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  vuelosTotalMes: number
  promedioVuelosPorSemanaRef: number
  tramoTarifaReferencia: number
  precioUnitarioReferenciaArs: number | null
  /** Costo solo por tarifas de franjas (1–7, 8–14, …). */
  costoFranjasArs: number | null
  /** WCH por vuelo (FlySeg: 1) × valor unitario. */
  costoSillasRuedasArs: number
  /** Franjas + sillas de ruedas. */
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
  /** Sillas por vuelo (Swissport: 2) × valor unitario AEP/EZE. */
  costoSillasRuedasArs: number
  totalMesArs: number
}

/** Un mes y escala para costos Rampa (montos en USD; conversión ARS en la UI con dólar oficial venta / TC del encabezado). */
export type RampaMonthLine = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  vuelosTotalMes: number
  totalUsd: number
  dom320: number
  dom321: number
  inter320: number
  inter321: number
  otroDom: number
  otroInter: number
  relRes: number
  /** Vuelos domésticos (no REL/RES) con ETD 00:00–05:59 y −37,5 % sobre tarifa + adicionales (inter sin desc.). */
  vuelosConDescuentoMadrugada: number
}

export type ProviderCostReport = {
  flySeg: ProviderCostLine[]
  /** Suma de costos por franjas (tarifas) de todas las líneas FlySeg. */
  flySegTotalPasadasArs: number
  /** Suma de sillas de ruedas de todas las líneas FlySeg. */
  flySegTotalSillasRuedasArs: number
  /** Suma de pasadas + sillas (mismo criterio que el pie de tabla en 3 filas). */
  flySegTotalArs: number
  swissportBlocks: SwissportMonthBlock[]
  swissportTotalPasadasArs: number
  swissportTotalSimultaneidadArs: number
  swissportTotalMaterialesArs: number
  swissportTotalSillasRuedasArs: number
  /** Suma de los cuatro conceptos (criterio del pie en varias filas). */
  swissportTotalArs: number
  rampaLines: RampaMonthLine[]
  rampaTotalUsd: number
  /** Rampa sin REL/RES, mismas tarifas y desc. madrugada que la tabla principal. */
  itcRampaActualizadaLines: RampaMonthLine[]
  itcRampaActualizadaTotalUsd: number
  /** Rampa sin REL/RES: dom 70/80 + adic.; inter 1062/1261 + adic.; sin desc. madrugada. */
  itcRampaViejaLines: RampaMonthLine[]
  itcRampaViejaTotalUsd: number
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
    const costoFranjasArs =
      withPricing && vuelosTotalMes > 0 ? Math.round(costoBruto * 100) / 100 : null
    const costoSillasRuedasArs =
      withPricing && vuelosTotalMes > 0
        ? Math.round(vuelosTotalMes * FLYSEG_SILLAS_RUEDAS_POR_VUELO * FLYSEG_SILLA_RUEDAS_UNITARIO_ARS * 100) / 100
        : 0
    const costoTotalMesRealArs =
      costoFranjasArs != null ? Math.round((costoFranjasArs + costoSillasRuedasArs) * 100) / 100 : null

    lines.push({
      escala: b.escala,
      mesIso: b.mesIso,
      mesEtiqueta: b.mesEtiqueta,
      vuelosTotalMes,
      promedioVuelosPorSemanaRef: Math.round(promedioVuelosPorSemanaRef * 100) / 100,
      tramoTarifaReferencia,
      precioUnitarioReferenciaArs,
      costoFranjasArs,
      costoSillasRuedasArs,
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
    const costoSillasRuedasArs = Math.round(n * SWISSPORT_SILLAS_RUEDAS_POR_VUELO * SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS * 100) / 100
    const totalMesArs = Math.round(
      (costoPasadasArs + costoSimultaneidadArs + costoMaterialesArs + costoSillasRuedasArs) * 100,
    ) / 100

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
      costoSillasRuedasArs,
      totalMesArs,
    })
  }
  blocks.sort((a, b) => {
    if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
    return a.mesIso.localeCompare(b.mesIso)
  })
  return blocks
}

type RampaBucketKey = string

type RampaBucketAgg = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  /** Suma USD por vuelo (tarifa + adicionales; desc. madrugada solo DOM). */
  totalUsdAccum: number
  dom320: number
  dom321: number
  inter320: number
  inter321: number
  otroDom: number
  otroInter: number
  relRes: number
  vuelosConDescuentoMadrugada: number
}

function rampaInternacionalDesdeColumnaI(destino: unknown): boolean {
  const codes = String(destino ?? '')
    .toUpperCase()
    .match(/[A-Z]{3}/g)
  if (!codes?.length) return false
  return codes.some((c) => RAMPA_INTER_DESTINO_CODES.has(c))
}

function rampaEtdEnVentanaMadrugada(etd: unknown): boolean {
  const m = programmingRowEtdMinutesFromMidnight(etd)
  if (m == null) return false
  return m >= 0 && m <= RAMPA_MADRUGADA_FIN_MIN
}

type RampaTariffConfig = {
  /** Si true, no se cuenta ningún vuelo en REL ni RES. */
  omitRelResRows: boolean
  /** Tarifa REL/RES cuando no se omiten filas. */
  relResUsd: number
  dom320Base: number
  dom321Base: number
  inter320Base: number
  inter321Base: number
  adicionalesUsd: number
  applyMadrugadaDomDiscount: boolean
}

const RAMPA_CONFIG_FULL: RampaTariffConfig = {
  omitRelResRows: false,
  relResUsd: RAMPA_REL_RES_USD,
  dom320Base: RAMPA_DOM_320_USD,
  dom321Base: RAMPA_DOM_321_USD,
  inter320Base: RAMPA_INTER_320_USD,
  inter321Base: RAMPA_INTER_321_USD,
  adicionalesUsd: RAMPA_ADICIONALES_USD,
  applyMadrugadaDomDiscount: true,
}

const RAMPA_CONFIG_ITC_ACTUAL: RampaTariffConfig = {
  omitRelResRows: true,
  relResUsd: RAMPA_REL_RES_USD,
  dom320Base: RAMPA_DOM_320_USD,
  dom321Base: RAMPA_DOM_321_USD,
  inter320Base: RAMPA_INTER_320_USD,
  inter321Base: RAMPA_INTER_321_USD,
  adicionalesUsd: RAMPA_ADICIONALES_USD,
  applyMadrugadaDomDiscount: true,
}

const RAMPA_CONFIG_ITC_VIEJA: RampaTariffConfig = {
  omitRelResRows: true,
  relResUsd: RAMPA_REL_RES_USD,
  dom320Base: ITC_VIEJA_DOM_320_USD,
  dom321Base: ITC_VIEJA_DOM_321_USD,
  inter320Base: RAMPA_INTER_320_USD,
  inter321Base: RAMPA_INTER_321_USD,
  adicionalesUsd: RAMPA_ADICIONALES_USD,
  applyMadrugadaDomDiscount: false,
}

function rampaBumpBucketWithConfig(
  map: Map<RampaBucketKey, RampaBucketAgg>,
  escala: string,
  mesIso: string,
  mesEtiqueta: string,
  row: unknown[],
  cfg: RampaTariffConfig,
): void {
  if (cfg.omitRelResRows && (escala === 'REL' || escala === 'RES')) {
    return
  }

  const key: RampaBucketKey = `${escala}|${mesIso}`
  let b = map.get(key)
  if (!b) {
    b = {
      escala,
      mesIso,
      mesEtiqueta,
      totalUsdAccum: 0,
      dom320: 0,
      dom321: 0,
      inter320: 0,
      inter321: 0,
      otroDom: 0,
      otroInter: 0,
      relRes: 0,
      vuelosConDescuentoMadrugada: 0,
    }
    map.set(key, b)
  }

  if (escala === 'REL' || escala === 'RES') {
    b.relRes += 1
    b.totalUsdAccum += cfg.relResUsd
    return
  }

  const inter = rampaInternacionalDesdeColumnaI(row[COL_DESTINO])
  const eq = detectProgrammingEquipamiento(row[COL_MATERIAL])

  const packDom = cfg.dom320Base + cfg.adicionalesUsd
  const pack321Dom = cfg.dom321Base + cfg.adicionalesUsd
  const packInter = cfg.inter320Base + cfg.adicionalesUsd
  const pack321Inter = cfg.inter321Base + cfg.adicionalesUsd

  let baseUsd = 0
  if (eq === '321') {
    baseUsd = inter ? pack321Inter : pack321Dom
    if (inter) b.inter321 += 1
    else b.dom321 += 1
  } else if (eq === '320') {
    baseUsd = inter ? packInter : packDom
    if (inter) b.inter320 += 1
    else b.dom320 += 1
  } else {
    baseUsd = inter ? packInter : packDom
    if (inter) b.otroInter += 1
    else b.otroDom += 1
  }

  const madrugada = rampaEtdEnVentanaMadrugada(row[COL_ETD])
  const descMadrugadaDom = cfg.applyMadrugadaDomDiscount && madrugada && !inter
  if (descMadrugadaDom) {
    b.vuelosConDescuentoMadrugada += 1
  }
  const factor = descMadrugadaDom ? 1 - RAMPA_DESCUENTO_MADRUGADA : 1
  b.totalUsdAccum += Math.round(baseUsd * factor * 100) / 100
}

function buildRampaLinesFromBuckets(map: Map<RampaBucketKey, RampaBucketAgg>): RampaMonthLine[] {
  const lines: RampaMonthLine[] = []
  for (const b of map.values()) {
    const vuelos =
      b.dom320 + b.dom321 + b.inter320 + b.inter321 + b.otroDom + b.otroInter + b.relRes
    if (vuelos === 0) continue

    const totalUsd = Math.round(b.totalUsdAccum * 100) / 100

    lines.push({
      escala: b.escala,
      mesIso: b.mesIso,
      mesEtiqueta: b.mesEtiqueta,
      vuelosTotalMes: vuelos,
      totalUsd,
      dom320: b.dom320,
      dom321: b.dom321,
      inter320: b.inter320,
      inter321: b.inter321,
      otroDom: b.otroDom,
      otroInter: b.otroInter,
      relRes: b.relRes,
      vuelosConDescuentoMadrugada: b.vuelosConDescuentoMadrugada,
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
 * FlySeg: franjas 1–7 / 8–14 / 15–21 / 22–31; total mes = suma real por franja.
 * Swissport (AEP/EZE): brackets por vuelos del mes, +20% pasada si 321 (col. L), simultaneidad STD (|ETD−ETD|≤59 min
 * mismo día: +10% pasada si 2–3 vuelos en el grupo, +30% si ≥4), materiales por vuelo, sillas de ruedas (2 por vuelo).
 * FlySeg: además de franjas, sillas de ruedas (1 por vuelo) con arancel distinto al de AEP/EZE.
 * Rampa: USD por vuelo según equipamiento (col. L), destino (col. I) y escala (REL/RES tarifa plana). ETD col. D
 * 00:00–05:59 en vuelos domésticos (excepto REL/RES): −37,5 % sobre tarifa + adicionales; internacional sin ese desc.
 */
export function buildProviderCostReport(rawMatrix: unknown[][]): ProviderCostReport {
  const flySegPeriodMap = new Map<PeriodAggKey, PeriodCell>()
  const swissBuckets = new Map<SwissBucketKey, SwissBucket>()
  const swissFlightLists = new Map<SwissBucketKey, SwissFlightDetail[]>()
  const rampaBuckets = new Map<RampaBucketKey, RampaBucketAgg>()
  const itcRampaActualBuckets = new Map<RampaBucketKey, RampaBucketAgg>()
  const itcRampaViejaBuckets = new Map<RampaBucketKey, RampaBucketAgg>()

  const startRow = getProgrammingMatrixDataStartRow(rawMatrix)
  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row?.length) continue

    const opDate = parseProgrammingOperationDate(row[COL_FECHA])
    if (!opDate) continue

    const escala = normalizeProgrammingEscala(row[COL_ESCALA])
    if (escala === '—' || !ALLOWED.has(escala)) continue

    const { mesIso, mesEtiqueta } = monthKeyAndLabel(opDate)

    rampaBumpBucketWithConfig(rampaBuckets, escala, mesIso, mesEtiqueta, row, RAMPA_CONFIG_FULL)
    rampaBumpBucketWithConfig(itcRampaActualBuckets, escala, mesIso, mesEtiqueta, row, RAMPA_CONFIG_ITC_ACTUAL)
    rampaBumpBucketWithConfig(itcRampaViejaBuckets, escala, mesIso, mesEtiqueta, row, RAMPA_CONFIG_ITC_VIEJA)

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

  const flySegTotalPasadasArs = Math.round(
    flySeg.reduce((s, l) => s + (l.costoFranjasArs ?? 0), 0) * 100,
  ) / 100
  const flySegTotalSillasRuedasArs = Math.round(
    flySeg.reduce((s, l) => s + l.costoSillasRuedasArs, 0) * 100,
  ) / 100
  const flySegTotalArs =
    Math.round((flySegTotalPasadasArs + flySegTotalSillasRuedasArs) * 100) / 100

  const swissportTotalPasadasArs = Math.round(
    swissportBlocks.reduce((s, b) => s + b.costoPasadasArs, 0) * 100,
  ) / 100
  const swissportTotalSimultaneidadArs = Math.round(
    swissportBlocks.reduce((s, b) => s + b.costoSimultaneidadArs, 0) * 100,
  ) / 100
  const swissportTotalMaterialesArs = Math.round(
    swissportBlocks.reduce((s, b) => s + b.costoMaterialesArs, 0) * 100,
  ) / 100
  const swissportTotalSillasRuedasArs = Math.round(
    swissportBlocks.reduce((s, b) => s + b.costoSillasRuedasArs, 0) * 100,
  ) / 100
  const swissportTotalArs =
    Math.round(
      (swissportTotalPasadasArs +
        swissportTotalSimultaneidadArs +
        swissportTotalMaterialesArs +
        swissportTotalSillasRuedasArs) *
        100,
    ) / 100

  const rampaLines = buildRampaLinesFromBuckets(rampaBuckets)
  const rampaTotalUsd = Math.round(rampaLines.reduce((s, l) => s + l.totalUsd, 0) * 100) / 100

  const itcRampaActualizadaLines = buildRampaLinesFromBuckets(itcRampaActualBuckets)
  const itcRampaActualizadaTotalUsd =
    Math.round(itcRampaActualizadaLines.reduce((s, l) => s + l.totalUsd, 0) * 100) / 100
  const itcRampaViejaLines = buildRampaLinesFromBuckets(itcRampaViejaBuckets)
  const itcRampaViejaTotalUsd = Math.round(itcRampaViejaLines.reduce((s, l) => s + l.totalUsd, 0) * 100) / 100

  return {
    flySeg,
    flySegTotalPasadasArs,
    flySegTotalSillasRuedasArs,
    flySegTotalArs,
    swissportBlocks,
    swissportTotalPasadasArs,
    swissportTotalSimultaneidadArs,
    swissportTotalMaterialesArs,
    swissportTotalSillasRuedasArs,
    swissportTotalArs,
    rampaLines,
    rampaTotalUsd,
    itcRampaActualizadaLines,
    itcRampaActualizadaTotalUsd,
    itcRampaViejaLines,
    itcRampaViejaTotalUsd,
  }
}
