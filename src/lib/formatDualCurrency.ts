const arsFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Muestra ARS y, si hay cotización, equivalente en USD en la misma cadena. */
export function formatArsWithUsd(n: number | null, arsPerUsd: number | null | undefined): string {
  if (n == null) return '—'
  const ars = arsFmt.format(n)
  const rate = arsPerUsd
  if (rate == null || rate <= 0 || !Number.isFinite(rate)) return ars
  const usd = n / rate
  return `${ars} · ${usdFmt.format(usd)}`
}

export function formatArsOnly(n: number): string {
  return arsFmt.format(n)
}

export function formatUsdFromArs(n: number, arsPerUsd: number): string {
  return usdFmt.format(n / arsPerUsd)
}
