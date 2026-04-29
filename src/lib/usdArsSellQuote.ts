/**
 * Cotización ARS por USD para equivalentes en pantalla.
 * Prioridad: dólar oficial **venta** vía DolarApi.com (valores alineados con tabla “Dolar U.S.A” del Banco Nación).
 * Respaldo: tipo de cambio de valuación BCRA en datos.gob.ar.
 */

/** Serie BCRA (datos.gob.ar) solo como fallback. */
const BCRA_VALUACION_SERIES_ID = '92.2_TIPO_CAMBIION_0_0_21_24'
const DATOS_GOB_AR_SERIES = 'https://apis.datos.gob.ar/series/api/series'
const DOLARAPI_OFICIAL = 'https://dolarapi.com/v1/dolares/oficial'

export type UsdArsQuoteProvider = 'dolarapi_oficial_venta' | 'bcra_valuacion_datos_gob_ar'

export type UsdArsQuote = {
  /** Fecha de referencia (YYYY-MM-DD). */
  date: string
  /** Pesos por un dólar (venta oficial o valuación BCRA en fallback). */
  arsPerUsd: number
  provider: UsdArsQuoteProvider
}

/** @deprecated Usar `UsdArsQuote`. */
export type BcraValuacionQuote = UsdArsQuote

function formatDateBuenosAires(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function parseIsoDate(s: string): number {
  const [y, m, day] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

function addDaysIso(iso: string, delta: number): string {
  const t = parseIsoDate(iso) + delta * 86400000
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(t))
}

type SeriesResponse = {
  data?: [string, number][]
}

type DolarApiOficialResponse = {
  venta?: number
  fechaActualizacion?: string
}

async function fetchDolarApiOficialVenta(signal?: AbortSignal): Promise<UsdArsQuote> {
  const res = await fetch(DOLARAPI_OFICIAL, { signal })
  if (!res.ok) {
    throw new Error(`DolarApi (${res.status})`)
  }
  const j = (await res.json()) as DolarApiOficialResponse
  const venta = j.venta
  if (typeof venta !== 'number' || venta <= 0 || !Number.isFinite(venta)) {
    throw new Error('DolarApi: venta inválida')
  }
  let date = formatDateBuenosAires(new Date())
  if (j.fechaActualizacion) {
    const d = new Date(j.fechaActualizacion)
    if (!Number.isNaN(d.getTime())) {
      date = formatDateBuenosAires(d)
    }
  }
  return { date, arsPerUsd: venta, provider: 'dolarapi_oficial_venta' }
}

async function fetchBcraValuacionFallback(signal?: AbortSignal): Promise<UsdArsQuote> {
  const end = formatDateBuenosAires(new Date())
  let start = addDaysIso(end, -500)

  for (let attempt = 0; attempt < 4; attempt++) {
    const url = new URL(DATOS_GOB_AR_SERIES)
    url.searchParams.set('ids', BCRA_VALUACION_SERIES_ID)
    url.searchParams.set('start_date', start)
    url.searchParams.set('end_date', end)
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString(), { signal })
    if (!res.ok) {
      throw new Error(`API series (${res.status})`)
    }
    const json = (await res.json()) as SeriesResponse
    const rows = json.data ?? []
    if (rows.length > 0) {
      const [date, arsPerUsd] = rows[rows.length - 1]
      if (typeof arsPerUsd !== 'number' || arsPerUsd <= 0 || !date) {
        throw new Error('Respuesta de cotización inválida')
      }
      return { date, arsPerUsd, provider: 'bcra_valuacion_datos_gob_ar' }
    }
    start = addDaysIso(start, -400)
  }

  throw new Error('Sin datos de cotización en el rango consultado')
}

/**
 * Dólar **venta** oficial (prioridad DolarApi → billete BNA / mercado oficial) y respaldo valuación BCRA.
 */
export async function fetchUsdArsSellQuote(signal?: AbortSignal): Promise<UsdArsQuote> {
  try {
    return await fetchDolarApiOficialVenta(signal)
  } catch {
    return await fetchBcraValuacionFallback(signal)
  }
}

/** @deprecated Usar `fetchUsdArsSellQuote`. */
export async function fetchBcraValuacionArsPerUsd(signal?: AbortSignal): Promise<UsdArsQuote> {
  return fetchUsdArsSellQuote(signal)
}
