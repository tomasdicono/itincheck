import { endOfDay, format, isValid, parse, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { coerceToDate } from './dates'

/** Columnas según plantilla JetSMART (Excel A=0, D=3, H=7, L=11). */
const COL_FECHA = 0
const COL_ETD = 3
const COL_VUELO = 5
const COL_ESCALA = 7
const COL_MATERIAL = 11

/** Costo aprox.: horas extra totales × 3 × tarifa (ARS). */
const ITC_COSTO_TARIFA_ARS = 48042.07
const ITC_COSTO_FACTOR = 3

/** ITC: aeropuertos no 24h. Horario inclusive por minuto (ETD HH:mm). */
const ITC_VENTANAS: Record<string, { startMin: number; endMin: number }> = {
  /** 06:00 a 00:00 = hasta fin del día (23:59). */
  IGR: { startMin: 6 * 60, endMin: 24 * 60 - 1 },
  TUC: { startMin: 5 * 60, endMin: 22 * 60 },
  USH: { startMin: 7 * 60, endMin: 20 * 60 },
  FTE: { startMin: 7 * 60, endMin: 17 * 60 },
  CRD: { startMin: 6 * 60, endMin: 18 * 60 },
  JUJ: { startMin: 6 * 60, endMin: 21 * 60 + 30 },
  NQN: { startMin: 6 * 60, endMin: 22 * 60 },
}

export type ProgrammingReport = {
  totalFilasDatos: number
  meses: { mes: string; etiqueta: string }[]
  tablaEscalaPorMes: { escala: string; cantidadesPorMes: number[]; total: number }[]
  vuelosMismoMinuto: {
    fecha: string
    escala: string
    etd: string
    cantidad: number
    vuelos: string[]
  }[]
  /** Vuelos con ETD fuera de ventana ITC en escalas restringidas (columna H). */
  extrasFueraItc: {
    fecha: string
    escala: string
    vuelo: string
    etd: string
    extrasMinutos: number
    /** Diferencia ETD ↔ límite ITC (misma duración que `extrasMinutos`). */
    extrasTexto: string
  }[]
  /** Suma de todos los minutos extra ITC (misma suma que la fila de totales). */
  extrasItcTotalMinutos: number
  extrasItcTotalTexto: string
  /** (extrasItcTotalMinutos / 60) × 3 × 48042,07 ARS */
  extrasItcCostoAproxArs: number
  /** Ranking de escalas ITC por minutos extra generados (mayor primero). */
  rankingExtrasItcPorEscala: {
    posicion: number
    escala: string
    minutos: number
    texto: string
    /** Misma longitud que `meses`: minutos extra ITC en ese mes (columna A). */
    extrasPorMesMinutos: number[]
    /** Horas decimales por mes (`extrasPorMesMinutos / 60`). */
    extrasPorMesHoras: number[]
    /** (minutos / 60) × 3 × tarifa ARS, por escala. */
    costoAproxArs: number
  }[]
  equipamiento: { c320: number; c321: number; cotro: number }
  /**
   * Franjas (mismo día, misma escala H, misma hora entera de ETD) con **más de 4** vuelos
   * programados (es decir, 5 o más).
   */
  simultaneidadMasCuatro: {
    fecha: string
    escala: string
    /** Franja por hora entera, p. ej. 14:00–14:59 */
    franjaHoraria: string
    cantidadVuelos: number
    vuelos: string[]
  }[]
}

function isHeaderRow(firstCell: unknown): boolean {
  const s = String(firstCell ?? '').trim().toUpperCase()
  return s.includes('EFFECTIVE') || s === 'FECHA' || s.includes('FROM')
}

/** Filtro global (fecha + IATA escala columna H) para vista previa e informe. */
export type ProgrammingViewFilters = {
  /** `yyyy-MM-dd` desde input type="date", o vacío */
  dateFrom: string | null
  dateTo: string | null
  /** IATA en mayúsculas; vacío = todas las escalas */
  airportsIata: string[]
}

export function hasActiveProgrammingFilters(f: ProgrammingViewFilters): boolean {
  return Boolean(f.dateFrom || f.dateTo || f.airportsIata.length > 0)
}

export function getProgrammingMatrixDataStartRow(rawMatrix: unknown[][]): number {
  if (!rawMatrix.length) return 0
  return isHeaderRow(rawMatrix[0]?.[COL_FECHA]) ? 1 : 0
}

export function matchesProgrammingFilters(row: unknown[], f: ProgrammingViewFilters): boolean {
  const opDate = parseOperationDate(row[COL_FECHA])
  if (!opDate) return false
  if (f.dateFrom) {
    const from = startOfDay(parseISO(f.dateFrom))
    if (opDate < from) return false
  }
  if (f.dateTo) {
    const to = endOfDay(parseISO(f.dateTo))
    if (opDate > to) return false
  }
  if (f.airportsIata.length > 0) {
    const escala = normalizeEscala(row[COL_ESCALA])
    if (escala === '—' || !f.airportsIata.includes(escala)) return false
  }
  return true
}

/**
 * Conserva filas de encabezado iniciales y solo incluye filas de datos que cumplan el filtro.
 */
export function filterProgrammingRawMatrix(
  raw: unknown[][],
  f: ProgrammingViewFilters | undefined,
): unknown[][] {
  if (!raw.length) return raw
  if (!f || !hasActiveProgrammingFilters(f)) return raw
  const startRow = getProgrammingMatrixDataStartRow(raw)
  const head = raw.slice(0, startRow)
  const out: unknown[][] = [...head]
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r]
    if (!row?.length) continue
    if (matchesProgrammingFilters(row, f)) out.push(row)
  }
  return out
}

export function collectAirportsFromProgrammingMatrix(raw: unknown[][]): string[] {
  if (!raw.length) return []
  const startRow = getProgrammingMatrixDataStartRow(raw)
  const set = new Set<string>()
  for (let r = startRow; r < raw.length; r++) {
    const e = normalizeEscala(raw[r]?.[COL_ESCALA])
    if (e && e !== '—') set.add(e)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function parseOperationDate(value: unknown): Date | null {
  if (value instanceof Date && isValid(value)) return startOfDay(value)
  const d = coerceToDate(value)
  if (d && isValid(d)) return startOfDay(d)
  if (typeof value === 'string') {
    const t = value.trim()
    const d2 = parse(t, 'yyyy/MM/dd', new Date())
    if (isValid(d2)) return startOfDay(d2)
  }
  return null
}

/** Hora local 0–23 desde ETD (texto H:mm:ss, fracción de día, etc.). */
function etdHour(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const totalSeconds = Math.round(value * 86400)
    return Math.floor(totalSeconds / 3600) % 24
  }
  if (value instanceof Date && isValid(value)) return value.getHours()
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const h = Number(m[1])
    if (Number.isFinite(h) && h >= 0 && h <= 23) return h
  }
  const d = coerceToDate(value)
  if (d && isValid(d)) return d.getHours()
  return null
}

function normalizeEscala(v: unknown): string {
  const s = String(v ?? '').trim().toUpperCase()
  return s || '—'
}

function normalizeVuelo(v: unknown): string {
  const s = String(v ?? '').trim().toUpperCase()
  return s || '—'
}

function detectEquipamiento(material: unknown): '320' | '321' | 'otro' {
  const s = String(material ?? '').toUpperCase()
  if (/(?:^|[^0-9])321(?:[^0-9]|$)/.test(s) || s.includes('A321')) return '321'
  if (/(?:^|[^0-9])320(?:[^0-9]|$)/.test(s) || s.includes('A320')) return '320'
  return 'otro'
}

/** Devuelve hora:minuto (HH:mm) a partir de ETD. */
function etdMinute(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const totalMinutes = Math.floor(value * 1440)
    const h = Math.floor(totalMinutes / 60) % 24
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (value instanceof Date && isValid(value)) return format(value, 'HH:mm')
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
  const d = coerceToDate(value)
  if (d && isValid(d)) return format(d, 'HH:mm')
  return null
}

function etdMinutesFromMidnight(value: unknown): number | null {
  const mm = etdMinute(value)
  if (!mm) return null
  const [h, m] = mm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function formatDuracionMinutos(totalMin: number): string {
  const n = Math.max(0, Math.round(totalMin))
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function monthKeyAndLabel(d: Date): { mes: string; etiqueta: string } {
  const mes = format(d, 'yyyy-MM')
  const etiqueta = format(d, 'MMMM yyyy', { locale: es })
  return { mes, etiqueta }
}

/**
 * Informe sobre programación tipo JetSMART usando columnas fijas A, D, H, L.
 * Ignora la primera fila si parece encabezado.
 */
export function buildProgrammingReport(rawMatrix: unknown[][]): ProgrammingReport | null {
  if (!rawMatrix.length) return null

  let startRow = 0
  if (isHeaderRow(rawMatrix[0]?.[COL_FECHA])) startRow = 1

  const porMesMap = new Map<string, { etiqueta: string; cantidad: number }>()
  const porEscalaMap = new Map<string, number>()
  const escalaMesMap = new Map<string, Map<string, number>>()
  let n320 = 0
  let n321 = 0
  let notro = 0

  type SlotKey = string
  type HoraSlotAgg = { fechaIso: string; escala: string; hora: number; cantidad: number; vuelos: Set<string> }
  const hourSlots = new Map<SlotKey, HoraSlotAgg>()
  type MinuteKey = string
  const minuteGroups = new Map<
    MinuteKey,
    { fecha: string; escala: string; etd: string; cantidad: number; vuelos: Set<string> }
  >()

  const extrasFueraItc: {
    fechaIso: string
    mesIso: string
    fecha: string
    escala: string
    vuelo: string
    etd: string
    extrasMinutos: number
  }[] = []

  let totalFilasDatos = 0

  for (let r = startRow; r < rawMatrix.length; r++) {
    const row = rawMatrix[r]
    if (!row || !row.length) continue

    const fechaVal = row[COL_FECHA]
    const etdVal = row[COL_ETD]
    const vueloVal = row[COL_VUELO]
    const escalaVal = row[COL_ESCALA]
    const materialVal = row[COL_MATERIAL]

    const opDate = parseOperationDate(fechaVal)
    if (!opDate) continue

    totalFilasDatos++

    const { mes, etiqueta } = monthKeyAndLabel(opDate)
    const prevMes = porMesMap.get(mes)
    if (prevMes) prevMes.cantidad += 1
    else porMesMap.set(mes, { etiqueta, cantidad: 1 })

    const escala = normalizeEscala(escalaVal)
    porEscalaMap.set(escala, (porEscalaMap.get(escala) ?? 0) + 1)
    const escalaMes = escalaMesMap.get(escala) ?? new Map<string, number>()
    escalaMes.set(mes, (escalaMes.get(mes) ?? 0) + 1)
    escalaMesMap.set(escala, escalaMes)

    const eq = detectEquipamiento(materialVal)
    if (eq === '320') n320++
    else if (eq === '321') n321++
    else notro++

    const h = etdHour(etdVal)
    if (h != null && escala !== '—') {
      const dayStr = format(opDate, 'yyyy-MM-dd')
      const key: SlotKey = `${dayStr}|${escala}|${h}`
      const vueloH = normalizeVuelo(vueloVal)
      let agg = hourSlots.get(key)
      if (!agg) {
        agg = { fechaIso: dayStr, escala, hora: h, cantidad: 0, vuelos: new Set<string>() }
        hourSlots.set(key, agg)
      }
      agg.cantidad += 1
      if (vueloH !== '—') agg.vuelos.add(vueloH)
    }

    const minute = etdMinute(etdVal)
    const mEtd = minute != null ? etdMinutesFromMidnight(etdVal) : null
    const ventana = ITC_VENTANAS[escala]
    if (ventana && minute != null && mEtd != null && escala !== '—') {
      let extrasMin = 0
      if (mEtd < ventana.startMin) extrasMin = ventana.startMin - mEtd
      else if (mEtd > ventana.endMin) extrasMin = mEtd - ventana.endMin
      if (extrasMin > 0) {
        const dayStr = format(opDate, 'yyyy-MM-dd')
        const vuelo = normalizeVuelo(vueloVal)
        extrasFueraItc.push({
          fechaIso: dayStr,
          mesIso: format(opDate, 'yyyy-MM'),
          fecha: format(opDate, 'dd/MM/yyyy'),
          escala,
          vuelo: vuelo === '—' ? '—' : vuelo,
          etd: minute,
          extrasMinutos: extrasMin,
        })
      }
    }

    if (minute && escala !== '—') {
      const dayStr = format(opDate, 'yyyy-MM-dd')
      const key: MinuteKey = `${dayStr}|${escala}|${minute}`
      const prev = minuteGroups.get(key)
      const vuelo = normalizeVuelo(vueloVal)
      if (prev) {
        prev.cantidad += 1
        if (vuelo !== '—') prev.vuelos.add(vuelo)
      } else {
        minuteGroups.set(key, {
          fecha: dayStr,
          escala,
          etd: minute,
          cantidad: 1,
          vuelos: vuelo === '—' ? new Set<string>() : new Set<string>([vuelo]),
        })
      }
    }
  }

  if (totalFilasDatos === 0) return null

  const porMes = [...porMesMap.entries()]
    .map(([mes, v]) => ({ mes, etiqueta: v.etiqueta, cantidad: v.cantidad }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  const porEscala = [...porEscalaMap.entries()]
    .map(([escala, cantidad]) => ({ escala, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.escala.localeCompare(b.escala))

  const meses = porMes.map(({ mes, etiqueta }) => ({ mes, etiqueta }))

  const tablaEscalaPorMes = porEscala.map(({ escala, cantidad: total }) => {
    const byMes = escalaMesMap.get(escala) ?? new Map<string, number>()
    const cantidadesPorMes = meses.map(({ mes }) => byMes.get(mes) ?? 0)
    return { escala, cantidadesPorMes, total }
  })

  const vuelosMismoMinuto = [...minuteGroups.values()]
    .filter((g) => g.cantidad >= 2)
    .map((g) => ({
      fecha: format(parse(g.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy'),
      escala: g.escala,
      etd: g.etd,
      cantidad: g.cantidad,
      vuelos: [...g.vuelos].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      const da = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime()
      const db = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime()
      if (da !== db) return da - db
      if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
      return a.etd.localeCompare(b.etd)
    })

  extrasFueraItc.sort((a, b) => {
    if (a.fechaIso !== b.fechaIso) return a.fechaIso.localeCompare(b.fechaIso)
    if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
    if (a.vuelo !== b.vuelo) return a.vuelo.localeCompare(b.vuelo)
    return a.etd.localeCompare(b.etd)
  })

  let extrasItcTotalMinutos = 0
  const extrasPorEscalaYMes = new Map<string, Map<string, number>>()
  for (const row of extrasFueraItc) {
    extrasItcTotalMinutos += row.extrasMinutos
    const inner = extrasPorEscalaYMes.get(row.escala) ?? new Map<string, number>()
    inner.set(row.mesIso, (inner.get(row.mesIso) ?? 0) + row.extrasMinutos)
    extrasPorEscalaYMes.set(row.escala, inner)
  }

  const horasExtrasTotales = extrasItcTotalMinutos / 60
  const extrasItcCostoAproxArs = horasExtrasTotales * ITC_COSTO_FACTOR * ITC_COSTO_TARIFA_ARS

  const escalasItc = Object.keys(ITC_VENTANAS).sort()
  const rankingExtrasItcPorEscala = escalasItc
    .map((escala) => {
      const byMes = extrasPorEscalaYMes.get(escala) ?? new Map<string, number>()
      const extrasPorMesMinutos = meses.map(({ mes }) => byMes.get(mes) ?? 0)
      const minutos = extrasPorMesMinutos.reduce((a, b) => a + b, 0)
      const extrasPorMesHoras = extrasPorMesMinutos.map((m) =>
        Math.round((m / 60) * 100) / 100,
      )
      return { escala, minutos, extrasPorMesMinutos, extrasPorMesHoras }
    })
    .sort((a, b) => b.minutos - a.minutos || a.escala.localeCompare(b.escala))
    .map((row, i) => {
      const horasEscala = row.minutos / 60
      return {
        posicion: i + 1,
        escala: row.escala,
        minutos: row.minutos,
        texto: formatDuracionMinutos(row.minutos),
        extrasPorMesMinutos: row.extrasPorMesMinutos,
        extrasPorMesHoras: row.extrasPorMesHoras,
        costoAproxArs: horasEscala * ITC_COSTO_FACTOR * ITC_COSTO_TARIFA_ARS,
      }
    })

  const simultaneidadMasCuatro = [...hourSlots.values()]
    .filter((s) => s.cantidad > 4)
    .sort((a, b) => {
      if (a.fechaIso !== b.fechaIso) return a.fechaIso.localeCompare(b.fechaIso)
      if (a.escala !== b.escala) return a.escala.localeCompare(b.escala)
      return a.hora - b.hora
    })
    .map((s) => {
      const hh = String(s.hora).padStart(2, '0')
      return {
        fecha: format(parse(s.fechaIso, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy'),
        escala: s.escala,
        franjaHoraria: `${hh}:00–${hh}:59`,
        cantidadVuelos: s.cantidad,
        vuelos: [...s.vuelos].sort((a, b) => a.localeCompare(b)),
      }
    })

  return {
    totalFilasDatos,
    meses,
    tablaEscalaPorMes,
    vuelosMismoMinuto,
    extrasFueraItc: extrasFueraItc.map((row) => ({
      fecha: row.fecha,
      escala: row.escala,
      vuelo: row.vuelo,
      etd: row.etd,
      extrasMinutos: row.extrasMinutos,
      extrasTexto: formatDuracionMinutos(row.extrasMinutos),
    })),
    extrasItcTotalMinutos,
    extrasItcTotalTexto: formatDuracionMinutos(extrasItcTotalMinutos),
    extrasItcCostoAproxArs,
    rankingExtrasItcPorEscala,
    equipamiento: { c320: n320, c321: n321, cotro: notro },
    simultaneidadMasCuatro,
  }
}
