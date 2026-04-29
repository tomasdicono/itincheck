/** Serie BCRA vía API pública datos.gob.ar: tipo de cambio de valuación (ARS por USD). */
export const BCRA_VALUACION_SERIES_ID = '92.2_TIPO_CAMBIION_0_0_21_24'

const API_BASE = 'https://apis.datos.gob.ar/series/api/series'

export type BcraValuacionQuote = {
  /** Fecha de la observación (YYYY-MM-DD). */
  date: string
  /** Pesos argentinos por un dólar estadounidense. */
  arsPerUsd: number
}

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

export async function fetchBcraValuacionArsPerUsd(signal?: AbortSignal): Promise<BcraValuacionQuote> {
  const end = formatDateBuenosAires(new Date())
  /** Ventana amplia: si el BCRA publica con demora, un rango corto solo con “hoy” puede quedar sin observaciones. */
  let start = addDaysIso(end, -500)

  for (let attempt = 0; attempt < 4; attempt++) {
    const url = new URL(API_BASE)
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
      return { date, arsPerUsd }
    }
    start = addDaysIso(start, -400)
  }

  throw new Error('Sin datos de cotización en el rango consultado')
}
