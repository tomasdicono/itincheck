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
/** Operador (Excel columna J): filtros para Swissport e ITC. */
const COL_OPERADOR = 9
const COL_MATERIAL = 11

function programmingOperadorCodigo(row: unknown[]): string {
  return String(row[COL_OPERADOR] ?? '')
    .trim()
    .toUpperCase()
}

/** Swissport (AEP/EZE): no contar vuelos con operador JA ni JZ (columna J). */
function operadorExcluyeSwissport(row: unknown[]): boolean {
  const o = programmingOperadorCodigo(row)
  return o === 'JA' || o === 'JZ'
}

/** Caso ITC (Rampa ITC): no contar vuelos con operador JA; JZ sí entra. */
function operadorExcluyeItc(row: unknown[]): boolean {
  return programmingOperadorCodigo(row) === 'JA'
}

/** Costos Rampa (USD por vuelo, escalas distintas de REL/RES). */
export const RAMPA_DOM_320_USD = 223
export const RAMPA_DOM_321_USD = 262
export const RAMPA_INTER_320_USD = 1544
export const RAMPA_INTER_321_USD = 1743
/** Suma solo a tarifas domésticas 320/321; internacional va con listado completo (sin +31). */
export const RAMPA_ADICIONALES_USD = 31
/** REL y RES: tarifa plana por vuelo (sin adicional de 31 USD). */
export const RAMPA_REL_RES_USD = 550

/** ITC tarifa actualizada — pasada internacional y adicionales (USD). */
export const ITC_INTER_320_USD = 1062
export const ITC_INTER_321_USD = 1261
export const ITC_ADICIONALES_DOM_USD = 30
export const ITC_ADICIONALES_INTER_USD = 58

/** ITC “tarifa vieja”: doméstico 320/321 (inter usa pasada ITC actual). */
export const ITC_VIEJA_DOM_320_USD = 70
export const ITC_VIEJA_DOM_321_USD = 80

/** Comparativa FB / ITC (USD por vuelo en AEP/EZE). */
/** FB pasada escalonada por nº de vuelo del mes (por tipo 320/321 en col. L), no por total del mes. */
export const FB_ESCALON_TIER1_MAX = 200
export const FB_ESCALON_TIER2_MAX = 399
/** Vuelos 1–200 del mes (por equipamiento). */
export const FB_TARIFA_320_USD = 449
export const FB_TARIFA_321_USD = 473
/** Vuelos 201–399. */
export const FB_BRACKET_200_399_TARIFA_320_USD = 427
export const FB_BRACKET_200_399_TARIFA_321_USD = 449
/** Vuelos 400 en adelante. */
export const FB_BRACKET_400_PLUS_TARIFA_320_USD = 406
export const FB_BRACKET_400_PLUS_TARIFA_321_USD = 427
/** @deprecated Usar FB_ESCALON_TIER1_MAX */
export const FB_BRACKET_MID_MIN = FB_ESCALON_TIER1_MAX
/** @deprecated Usar FB_ESCALON_TIER2_MAX + 1 */
export const FB_BRACKET_HIGH_MIN = FB_ESCALON_TIER2_MAX + 1

export const FB_ESCALONADO_ETIQUETA = 'Escalonado 1–200 / 201–399 / 400+ (por 320 y 321)'

export const FB_ADICIONALES_USD = 30
export const FB_MICROS_USD = 72

/** ITC micros: fracción de vuelos con uso de micros en AEP (60 % con, 40 % sin). */
export const ITC_MICROS_AEP_USO_FRACCION = 0.6

export const ITC_MICROS_EZE_INTER_USD = 270
export const ITC_MICROS_EZE_DOM_USD = 12
export const ITC_MICROS_AEP_INTER_USD = 228
export const ITC_MICROS_AEP_DOM_USD = 10

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
export const FLYSEG_SILLA_RUEDAS_UNITARIO_ARS = 63_730.70

/** CRD (proveedor NFS): materiales fijos por vuelo (ARS). */
export const NFS_CRD_MATERIALES_POR_VUELO_ARS = 32_580

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
export const AEP_SWISS_BRACKETS: SwissBracket[] = [
  { min: 133, max: 196, unit: 489_841.5, label: '133–196' },
  { min: 197, max: 261, unit: 468_195, label: '197–261' },
  { min: 262, max: 390, unit: 447_503.5, label: '262–390' },
  { min: 391, max: 519, unit: 427_733.5, label: '391–519' },
  { min: 520, max: 691, unit: 408_046.5, label: '520–691' },
  { min: 692, max: 820, unit: 400_705, label: '692–820' },
  { min: 821, max: 992, unit: 394_691, label: '821–992' },
  { min: 993, max: 1164, unit: 390_743.5, label: '993–1164' },
  { min: 1165, max: 1336, unit: 386_838, label: '1165–1336' },
  { min: 1337, max: null, unit: 382_972.5, label: '1337+' },
]

export const EZE_SWISS_BRACKETS: SwissBracket[] = [
  { min: 133, max: 196, unit: 423_204, label: '133–196' },
  { min: 197, max: 261, unit: 385_664, label: '197–261' },
  { min: 262, max: 390, unit: 351_509, label: '262–390' },
  { min: 391, max: 519, unit: 340_966, label: '391–519' },
  { min: 520, max: 691, unit: 330_739, label: '520–691' },
  { min: 692, max: 820, unit: 320_816, label: '692–820' },
  { min: 821, max: 992, unit: 311_192, label: '821–992' },
  { min: 993, max: 1164, unit: 301_854, label: '993–1164' },
  { min: 1165, max: 1336, unit: 292_800, label: '1165–1336' },
  { min: 1337, max: null, unit: 284_017, label: '1337+' },
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
  p[1] = 2_563_589.03
  p[2] = 2_278_733.38
  p[3] = 1_709_047.89
  for (let i = 4; i <= 7; i++) p[i] = 854_523.93
  for (let i = 8; i <= 14; i++) p[i] = 711_799.41
  for (let i = 15; i <= 21; i++) p[i] = 569_694.09
  for (let i = 22; i <= 28; i++) p[i] = 507_334.89
  p[29] = 481_968.15
  for (let i = 30; i <= 39; i++) p[i] = 469_395.07
  p[40] = 481_968.15
  p[41] = 457_946.37
  for (let i = 42; i <= 59; i++) p[i] = 445_999.94
  p[60] = 457_946.37
  return p
}

export const FLYSEG_UNIT = buildFlySegUnitPriceByFlightCount()

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

/** CRD (NFS): tarifa por pasada según vuelos semanales (promedio del mes, redondeado). */
export type NfsMonthLine = {
  escala: 'CRD'
  mesIso: string
  mesEtiqueta: string
  vuelosTotalMes: number
  promedioVuelosPorSemanaRef: number
  /** Promedio semanal redondeado usado para elegir tramo de tarifa. */
  vuelosSemanalesTarifaRef: number
  /** Etiqueta del tramo (p. ej. «5–7 / semana»). */
  tramoTarifaEtiqueta: string
  precioUnitarioPasadaArs: number | null
  costoPasadasArs: number | null
  costoMaterialesArs: number
  costoSillasRuedasArs: number
  costoTotalMesArs: number | null
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

/** AEP/EZE: comparativa costo FB vs ITC (pasada + adicional + micros por vuelo). */
export type FbItcMicrosMonthLine = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  vuelosDom: number
  vuelosInter: number
  vuelosTotalMes: number
  costoFbUsd: number
  costoItcUsd: number
  /** Desglose FB (suma = costoFbUsd). */
  fbPasadaUsd: number
  fbAdicionalUsd: number
  fbMicrosUsd: number
  vuelosEquip320: number
  vuelosEquip321: number
  vuelosEquipOtro: number
  fbBracketEtiqueta: string
  fbTarifaPasada320Usd: number
  fbTarifaPasada321Usd: number
  /** Desglose ITC (suma = costoItcUsd). */
  itcPasadaUsd: number
  itcAdicionalUsd: number
  itcMicrosUsd: number
  itcVuelosDescMadrugada: number
}

export type ProviderCostReport = {
  flySeg: ProviderCostLine[]
  /** Suma de costos por franjas (tarifas) de todas las líneas FlySeg. */
  flySegTotalPasadasArs: number
  /** Suma de sillas de ruedas de todas las líneas FlySeg. */
  flySegTotalSillasRuedasArs: number
  /** Suma de pasadas + sillas (mismo criterio que el pie de tabla en 3 filas). */
  flySegTotalArs: number
  /** CRD (NFS): tarifa por vuelos semanales + materiales + sillas (mismo WCH que FlySeg). */
  nfsLines: NfsMonthLine[]
  nfsTotalPasadasArs: number
  nfsTotalMaterialesArs: number
  nfsTotalSillasRuedasArs: number
  nfsTotalArs: number
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
  /** Rampa sin REL/RES: dom 70/80 + adic.; inter listado (sin +31 adic.); sin desc. madrugada. */
  itcRampaViejaLines: RampaMonthLine[]
  itcRampaViejaTotalUsd: number
  fbItcMicrosLines: FbItcMicrosMonthLine[]
  fbItcMicrosFbTotalUsd: number
  fbItcMicrosItcTotalUsd: number
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

/**
 * Tarifa ARS por pasada (CRD / NFS) según vuelos por semana (valor entero, típicamente el promedio mensual redondeado).
 * Tramo ≥15: tarifa mínima (equivalente a «más de 14 por semana» en la grilla comercial).
 */
export function nfsCrdPasadaArsForWeeklyRounded(weeklyRounded: number): { unit: number; label: string } {
  if (weeklyRounded <= 0) return { unit: 0, label: '—' }
  if (weeklyRounded === 1) return { unit: 673_320, label: '1 / semana' }
  if (weeklyRounded === 2) return { unit: 488_700, label: '2 / semana' }
  if (weeklyRounded === 3) return { unit: 434_400, label: '3 / semana' }
  if (weeklyRounded === 4) return { unit: 407_250, label: '4 / semana' }
  if (weeklyRounded <= 7) return { unit: 380_100, label: '5–7 / semana' }
  if (weeklyRounded <= 14) return { unit: 325_800, label: '8–14 / semana' }
  return { unit: 271_500, label: '≥15 / semana' }
}

function rollupNfsCrdToMonthLines(
  periodMap: Map<PeriodAggKey, PeriodCell>,
  withPricing: boolean,
): NfsMonthLine[] {
  const monthBuckets = new Map<
    string,
    { mesIso: string; mesEtiqueta: string; counts: [number, number, number, number] }
  >()

  for (const v of periodMap.values()) {
    if (v.escala !== 'CRD') continue
    const mk = v.mesIso
    let b = monthBuckets.get(mk)
    if (!b) {
      b = { mesIso: v.mesIso, mesEtiqueta: v.mesEtiqueta, counts: [0, 0, 0, 0] }
      monthBuckets.set(mk, b)
    }
    b.counts[v.periodo - 1] = v.n
  }

  const lines: NfsMonthLine[] = []
  for (const b of monthBuckets.values()) {
    const [c1, c2, c3, c4] = b.counts
    const vuelosTotalMes = c1 + c2 + c3 + c4
    const dim = getDaysInMonth(parseISO(`${b.mesIso}-01`))
    const promedioVuelosPorSemanaRef = dim > 0 ? (vuelosTotalMes * 7) / dim : 0
    const weeklyRef =
      vuelosTotalMes === 0 ? 0 : Math.max(1, Math.round(promedioVuelosPorSemanaRef))
    const { unit, label } = nfsCrdPasadaArsForWeeklyRounded(weeklyRef)

    const precioUnitarioPasadaArs =
      withPricing && vuelosTotalMes > 0 ? unit : null
    const costoPasadasArs =
      withPricing && vuelosTotalMes > 0 ? Math.round(vuelosTotalMes * unit * 100) / 100 : null
    const costoMaterialesArs =
      withPricing && vuelosTotalMes > 0
        ? Math.round(vuelosTotalMes * NFS_CRD_MATERIALES_POR_VUELO_ARS * 100) / 100
        : 0
    const costoSillasRuedasArs =
      withPricing && vuelosTotalMes > 0
        ? Math.round(vuelosTotalMes * FLYSEG_SILLAS_RUEDAS_POR_VUELO * FLYSEG_SILLA_RUEDAS_UNITARIO_ARS * 100) / 100
        : 0
    const costoTotalMesArs =
      costoPasadasArs != null
        ? Math.round((costoPasadasArs + costoMaterialesArs + costoSillasRuedasArs) * 100) / 100
        : null

    lines.push({
      escala: 'CRD',
      mesIso: b.mesIso,
      mesEtiqueta: b.mesEtiqueta,
      vuelosTotalMes,
      promedioVuelosPorSemanaRef: Math.round(promedioVuelosPorSemanaRef * 100) / 100,
      vuelosSemanalesTarifaRef: weeklyRef,
      tramoTarifaEtiqueta: label,
      precioUnitarioPasadaArs,
      costoPasadasArs,
      costoMaterialesArs,
      costoSillasRuedasArs,
      costoTotalMesArs,
    })
  }

  lines.sort((a, b) => a.mesIso.localeCompare(b.mesIso))
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
  /** Suma USD por vuelo (dom: tarifa + adic.; inter: tarifa lista; desc. madrugada solo DOM). */
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

function itcMicrosTarifaUsdPorVuelo(escala: string, inter: boolean): number {
  if (escala === 'EZE') return inter ? ITC_MICROS_EZE_INTER_USD : ITC_MICROS_EZE_DOM_USD
  if (escala === 'AEP') return inter ? ITC_MICROS_AEP_INTER_USD : ITC_MICROS_AEP_DOM_USD
  return 0
}

/** Micros ITC esperados: EZE dom. 100 % · EZE inter. 0 % · AEP 60 % de los vuelos con micros. */
function itcMicrosUsdEsperadoPorVuelo(escala: string, inter: boolean): number {
  const tarifa = itcMicrosTarifaUsdPorVuelo(escala, inter)
  if (escala === 'EZE') return inter ? 0 : tarifa
  if (escala === 'AEP') return Math.round(tarifa * ITC_MICROS_AEP_USO_FRACCION * 100) / 100
  return tarifa
}

/** Pasada FB del vuelo n (1-based) dentro del mes, por secuencia 320 u 321 (otro → 320). */
export function fbPasadaUsdMarginalPorSecuencia(secuenciaVuelo: number, is321: boolean): number {
  if (secuenciaVuelo <= FB_ESCALON_TIER1_MAX) {
    return is321 ? FB_TARIFA_321_USD : FB_TARIFA_320_USD
  }
  if (secuenciaVuelo <= FB_ESCALON_TIER2_MAX) {
    return is321 ? FB_BRACKET_200_399_TARIFA_321_USD : FB_BRACKET_200_399_TARIFA_320_USD
  }
  return is321 ? FB_BRACKET_400_PLUS_TARIFA_321_USD : FB_BRACKET_400_PLUS_TARIFA_320_USD
}

/** Promedio de pasada escalonada para mostrar en tarifarios (suma de tramos / cantidad). */
export function fbPasadaPromedioEscalonado(cantidadVuelos: number, is321: boolean): number {
  if (cantidadVuelos <= 0) return 0
  let sum = 0
  for (let i = 1; i <= cantidadVuelos; i++) sum += fbPasadaUsdMarginalPorSecuencia(i, is321)
  return Math.round((sum / cantidadVuelos) * 100) / 100
}

type FbItcBucketKey = string

type FbItcBucketAgg = {
  escala: string
  mesIso: string
  mesEtiqueta: string
  vuelosDom: number
  vuelosInter: number
  costoFbUsd: number
  costoItcUsd: number
  fbPasadaUsd: number
  fbAdicionalUsd: number
  fbMicrosUsd: number
  vuelosEquip320: number
  vuelosEquip321: number
  vuelosEquipOtro: number
  itcPasadaUsd: number
  itcAdicionalUsd: number
  itcMicrosUsd: number
  itcVuelosDescMadrugada: number
}

function buildFbItcMicrosLinesFromBuckets(map: Map<FbItcBucketKey, FbItcBucketAgg>): FbItcMicrosMonthLine[] {
  const lines: FbItcMicrosMonthLine[] = []
  for (const b of map.values()) {
    const vuelosTotalMes = b.vuelosDom + b.vuelosInter
    if (vuelosTotalMes === 0) continue
    lines.push({
      escala: b.escala,
      mesIso: b.mesIso,
      mesEtiqueta: b.mesEtiqueta,
      vuelosDom: b.vuelosDom,
      vuelosInter: b.vuelosInter,
      vuelosTotalMes,
      costoFbUsd: Math.round(b.costoFbUsd * 100) / 100,
      costoItcUsd: Math.round(b.costoItcUsd * 100) / 100,
      fbPasadaUsd: Math.round(b.fbPasadaUsd * 100) / 100,
      fbAdicionalUsd: Math.round(b.fbAdicionalUsd * 100) / 100,
      fbMicrosUsd: Math.round(b.fbMicrosUsd * 100) / 100,
      vuelosEquip320: b.vuelosEquip320,
      vuelosEquip321: b.vuelosEquip321,
      vuelosEquipOtro: b.vuelosEquipOtro,
      fbBracketEtiqueta: FB_ESCALONADO_ETIQUETA,
      fbTarifaPasada320Usd: fbPasadaPromedioEscalonado(b.vuelosEquip320 + b.vuelosEquipOtro, false),
      fbTarifaPasada321Usd: fbPasadaPromedioEscalonado(b.vuelosEquip321, true),
      itcPasadaUsd: Math.round(b.itcPasadaUsd * 100) / 100,
      itcAdicionalUsd: Math.round(b.itcAdicionalUsd * 100) / 100,
      itcMicrosUsd: Math.round(b.itcMicrosUsd * 100) / 100,
      itcVuelosDescMadrugada: b.itcVuelosDescMadrugada,
    })
  }
  lines.sort((a, b) => {
    if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
    return a.mesIso.localeCompare(b.mesIso)
  })
  return lines
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
  adicionalesDomUsd: number
  /** 0 = tarifa inter ya es total (no se suman los 31 USD). */
  adicionalesInterUsd: number
  applyMadrugadaDomDiscount: boolean
}

const RAMPA_CONFIG_FULL: RampaTariffConfig = {
  omitRelResRows: false,
  relResUsd: RAMPA_REL_RES_USD,
  dom320Base: RAMPA_DOM_320_USD,
  dom321Base: RAMPA_DOM_321_USD,
  inter320Base: RAMPA_INTER_320_USD,
  inter321Base: RAMPA_INTER_321_USD,
  adicionalesDomUsd: RAMPA_ADICIONALES_USD,
  adicionalesInterUsd: 0,
  applyMadrugadaDomDiscount: true,
}

const RAMPA_CONFIG_ITC_ACTUAL: RampaTariffConfig = {
  omitRelResRows: true,
  relResUsd: RAMPA_REL_RES_USD,
  dom320Base: RAMPA_DOM_320_USD,
  dom321Base: RAMPA_DOM_321_USD,
  inter320Base: ITC_INTER_320_USD,
  inter321Base: ITC_INTER_321_USD,
  adicionalesDomUsd: ITC_ADICIONALES_DOM_USD,
  adicionalesInterUsd: ITC_ADICIONALES_INTER_USD,
  applyMadrugadaDomDiscount: true,
}

const RAMPA_CONFIG_ITC_VIEJA: RampaTariffConfig = {
  omitRelResRows: true,
  relResUsd: RAMPA_REL_RES_USD,
  dom320Base: ITC_VIEJA_DOM_320_USD,
  dom321Base: ITC_VIEJA_DOM_321_USD,
  inter320Base: ITC_INTER_320_USD,
  inter321Base: ITC_INTER_321_USD,
  adicionalesDomUsd: ITC_ADICIONALES_DOM_USD,
  adicionalesInterUsd: ITC_ADICIONALES_INTER_USD,
  applyMadrugadaDomDiscount: false,
}

function rampaPasadaYAdicionalUsdPorVuelo(
  row: unknown[],
  cfg: RampaTariffConfig,
): { pasadaUsd: number; adicionalUsd: number } {
  const inter = rampaInternacionalDesdeColumnaI(row[COL_DESTINO])
  const eq = detectProgrammingEquipamiento(row[COL_MATERIAL])

  let pasadaBase = 0
  if (eq === '321') pasadaBase = inter ? cfg.inter321Base : cfg.dom321Base
  else if (eq === '320') pasadaBase = inter ? cfg.inter320Base : cfg.dom320Base
  else pasadaBase = inter ? cfg.inter320Base : cfg.dom320Base

  const adicionalBase = inter ? cfg.adicionalesInterUsd : cfg.adicionalesDomUsd

  const madrugada = rampaEtdEnVentanaMadrugada(row[COL_ETD])
  const descMadrugadaDom = cfg.applyMadrugadaDomDiscount && madrugada && !inter
  const factor = descMadrugadaDom ? 1 - RAMPA_DESCUENTO_MADRUGADA : 1

  return {
    pasadaUsd: Math.round(pasadaBase * factor * 100) / 100,
    adicionalUsd: Math.round(adicionalBase * factor * 100) / 100,
  }
}

function rampaUsdPorVueloConConfig(row: unknown[], cfg: RampaTariffConfig): number {
  const { pasadaUsd, adicionalUsd } = rampaPasadaYAdicionalUsdPorVuelo(row, cfg)
  return Math.round((pasadaUsd + adicionalUsd) * 100) / 100
}

function fbItcComparativaCountBump(
  map: Map<FbItcBucketKey, FbItcBucketAgg>,
  escala: string,
  mesIso: string,
  mesEtiqueta: string,
  row: unknown[],
): void {
  if (!SWISSPORT_AIRPORTS.has(escala) || operadorExcluyeItc(row)) return

  const key: FbItcBucketKey = `${escala}|${mesIso}`
  let b = map.get(key)
  if (!b) {
    b = {
      escala,
      mesIso,
      mesEtiqueta,
      vuelosDom: 0,
      vuelosInter: 0,
      costoFbUsd: 0,
      costoItcUsd: 0,
      fbPasadaUsd: 0,
      fbAdicionalUsd: 0,
      fbMicrosUsd: 0,
      vuelosEquip320: 0,
      vuelosEquip321: 0,
      vuelosEquipOtro: 0,
      itcPasadaUsd: 0,
      itcAdicionalUsd: 0,
      itcMicrosUsd: 0,
      itcVuelosDescMadrugada: 0,
    }
    map.set(key, b)
  }

  const inter = rampaInternacionalDesdeColumnaI(row[COL_DESTINO])
  if (inter) b.vuelosInter += 1
  else b.vuelosDom += 1
}

function fbItcComparativaPriceBump(b: FbItcBucketAgg, escala: string, row: unknown[]): void {
  const eq = detectProgrammingEquipamiento(row[COL_MATERIAL])
  let pasadaFb = 0
  if (eq === '321') {
    b.vuelosEquip321 += 1
    pasadaFb = fbPasadaUsdMarginalPorSecuencia(b.vuelosEquip321, true)
  } else {
    if (eq === '320') b.vuelosEquip320 += 1
    else b.vuelosEquipOtro += 1
    const seq320 = b.vuelosEquip320 + b.vuelosEquipOtro
    pasadaFb = fbPasadaUsdMarginalPorSecuencia(seq320, false)
  }
  b.fbPasadaUsd += pasadaFb
  b.fbAdicionalUsd += FB_ADICIONALES_USD
  b.fbMicrosUsd += FB_MICROS_USD
  b.costoFbUsd += pasadaFb + FB_ADICIONALES_USD + FB_MICROS_USD

  const inter = rampaInternacionalDesdeColumnaI(row[COL_DESTINO])
  const { pasadaUsd, adicionalUsd } = rampaPasadaYAdicionalUsdPorVuelo(row, RAMPA_CONFIG_ITC_ACTUAL)
  const microsUsd = itcMicrosUsdEsperadoPorVuelo(escala, inter)
  b.itcPasadaUsd += pasadaUsd
  b.itcAdicionalUsd += adicionalUsd
  b.itcMicrosUsd += microsUsd
  b.costoItcUsd += pasadaUsd + adicionalUsd + microsUsd

  const madrugada = rampaEtdEnVentanaMadrugada(row[COL_ETD])
  if (RAMPA_CONFIG_ITC_ACTUAL.applyMadrugadaDomDiscount && madrugada && !inter) {
    b.itcVuelosDescMadrugada += 1
  }
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

  if (eq === '321') {
    if (inter) b.inter321 += 1
    else b.dom321 += 1
  } else if (eq === '320') {
    if (inter) b.inter320 += 1
    else b.dom320 += 1
  } else {
    if (inter) b.otroInter += 1
    else b.otroDom += 1
  }

  const madrugada = rampaEtdEnVentanaMadrugada(row[COL_ETD])
  const descMadrugadaDom = cfg.applyMadrugadaDomDiscount && madrugada && !inter
  if (descMadrugadaDom) {
    b.vuelosConDescuentoMadrugada += 1
  }
  b.totalUsdAccum += rampaUsdPorVueloConConfig(row, cfg)
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
 * Swissport (AEP/EZE): mismos brackets y reglas, pero solo filas con operador col. J distinto de JA y JZ (WJ, etc.).
 * Brackets por vuelos del mes, +20% pasada si 321 (col. L), simultaneidad STD (|ETD−ETD|≤59 min
 * mismo día: +10% pasada si 2–3 vuelos en el grupo, +30% si ≥4), materiales por vuelo, sillas de ruedas (2 por vuelo).
 * FlySeg: además de franjas, sillas de ruedas (1 por vuelo) con arancel distinto al de AEP/EZE. CRD no entra en FlySeg:
 * va a NFS (tarifa por vuelos semanales + materiales + mismas sillas WCH que FlySeg).
 * Rampa (tabla principal): USD por vuelo según equipamiento (col. L), destino (col. I) y escala (REL/RES tarifa plana). ETD col. D
 * 00:00–05:59 en vuelos domésticos (excepto REL/RES): −37,5 % sobre tarifa + adicionales; internacional sin ese desc.
 * Caso ITC (líneas ITC): además no se cuentan vuelos con operador JA en col. J (JZ sí).
 * Comparativa FB/ITC (AEP/EZE): FB pasada escalonada por orden de vuelo 320/321 (1–200 / 201–399 / 400+);
 * ITC micros con uso esperado (AEP 60 %, EZE dom. 100 %, EZE inter. 0 %).
 */
export function buildProviderCostReport(rawMatrix: unknown[][]): ProviderCostReport {
  const flySegPeriodMap = new Map<PeriodAggKey, PeriodCell>()
  const nfsCrdPeriodMap = new Map<PeriodAggKey, PeriodCell>()
  const swissBuckets = new Map<SwissBucketKey, SwissBucket>()
  const swissFlightLists = new Map<SwissBucketKey, SwissFlightDetail[]>()
  const rampaBuckets = new Map<RampaBucketKey, RampaBucketAgg>()
  const itcRampaActualBuckets = new Map<RampaBucketKey, RampaBucketAgg>()
  const itcRampaViejaBuckets = new Map<RampaBucketKey, RampaBucketAgg>()
  const fbItcMicrosBuckets = new Map<FbItcBucketKey, FbItcBucketAgg>()

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
    if (!operadorExcluyeItc(row)) {
      rampaBumpBucketWithConfig(itcRampaActualBuckets, escala, mesIso, mesEtiqueta, row, RAMPA_CONFIG_ITC_ACTUAL)
      rampaBumpBucketWithConfig(itcRampaViejaBuckets, escala, mesIso, mesEtiqueta, row, RAMPA_CONFIG_ITC_VIEJA)
      fbItcComparativaCountBump(fbItcMicrosBuckets, escala, mesIso, mesEtiqueta, row)
    }

    if (SWISSPORT_AIRPORTS.has(escala)) {
      if (!operadorExcluyeSwissport(row)) {
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
      }
      continue
    }

    const periodo = monthDayPeriod(opDate)
    if (escala === 'CRD') {
      const keyNfs: PeriodAggKey = `${escala}|${mesIso}|${periodo}`
      const prevNfs = nfsCrdPeriodMap.get(keyNfs)
      if (prevNfs) prevNfs.n += 1
      else nfsCrdPeriodMap.set(keyNfs, { escala, mesIso, mesEtiqueta, periodo, n: 1 })
      continue
    }

    const key: PeriodAggKey = `${escala}|${mesIso}|${periodo}`
    const prev = flySegPeriodMap.get(key)
    if (prev) prev.n += 1
    else flySegPeriodMap.set(key, { escala, mesIso, mesEtiqueta, periodo, n: 1 })
  }

  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row?.length) continue
    const opDate = parseProgrammingOperationDate(row[COL_FECHA])
    if (!opDate) continue
    const escala = normalizeProgrammingEscala(row[COL_ESCALA])
    if (escala === '—' || !ALLOWED.has(escala) || operadorExcluyeItc(row)) continue
    if (!SWISSPORT_AIRPORTS.has(escala)) continue
    const { mesIso } = monthKeyAndLabel(opDate)
    const b = fbItcMicrosBuckets.get(`${escala}|${mesIso}`)
    if (b) fbItcComparativaPriceBump(b, escala, row)
  }

  const flySeg = rollupToMonthLines(flySegPeriodMap, true)
  const nfsLines = rollupNfsCrdToMonthLines(nfsCrdPeriodMap, true)
  const swissportBlocks = buildSwissportBlocksFromBuckets(swissBuckets, swissFlightLists)

  const flySegTotalPasadasArs = Math.round(
    flySeg.reduce((s, l) => s + (l.costoFranjasArs ?? 0), 0) * 100,
  ) / 100
  const flySegTotalSillasRuedasArs = Math.round(
    flySeg.reduce((s, l) => s + l.costoSillasRuedasArs, 0) * 100,
  ) / 100
  const flySegTotalArs =
    Math.round((flySegTotalPasadasArs + flySegTotalSillasRuedasArs) * 100) / 100

  const nfsTotalPasadasArs = Math.round(nfsLines.reduce((s, l) => s + (l.costoPasadasArs ?? 0), 0) * 100) / 100
  const nfsTotalMaterialesArs = Math.round(nfsLines.reduce((s, l) => s + l.costoMaterialesArs, 0) * 100) / 100
  const nfsTotalSillasRuedasArs = Math.round(nfsLines.reduce((s, l) => s + l.costoSillasRuedasArs, 0) * 100) / 100
  const nfsTotalArs =
    Math.round((nfsTotalPasadasArs + nfsTotalMaterialesArs + nfsTotalSillasRuedasArs) * 100) / 100

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

  const fbItcMicrosLines = buildFbItcMicrosLinesFromBuckets(fbItcMicrosBuckets)
  const fbItcMicrosFbTotalUsd = Math.round(fbItcMicrosLines.reduce((s, l) => s + l.costoFbUsd, 0) * 100) / 100
  const fbItcMicrosItcTotalUsd = Math.round(fbItcMicrosLines.reduce((s, l) => s + l.costoItcUsd, 0) * 100) / 100

  return {
    flySeg,
    flySegTotalPasadasArs,
    flySegTotalSillasRuedasArs,
    flySegTotalArs,
    nfsLines,
    nfsTotalPasadasArs,
    nfsTotalMaterialesArs,
    nfsTotalSillasRuedasArs,
    nfsTotalArs,
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
    fbItcMicrosLines,
    fbItcMicrosFbTotalUsd,
    fbItcMicrosItcTotalUsd,
  }
}
