import { formatArsOnly, formatUsdFromArs } from '../lib/formatDualCurrency'

/** Totales: ARS en una línea y USD en otra, para que no se pierda el equivalente. */
export function DualMoneyTotal({
  value,
  arsPerUsd,
}: {
  value: number | null
  arsPerUsd: number | null
}) {
  if (value == null) {
    return <span>—</span>
  }

  const arsLine = formatArsOnly(value)
  const rateOk = arsPerUsd != null && arsPerUsd > 0 && Number.isFinite(arsPerUsd)

  if (!rateOk) {
    return <span className="tabular-nums">{arsLine}</span>
  }

  const usdLine = formatUsdFromArs(value, arsPerUsd)

  return (
    <span className="inline-flex min-w-[10rem] flex-col items-end gap-0.5 whitespace-normal text-right leading-tight">
      <span className="font-bold tabular-nums text-[color:var(--color-ink)]">{arsLine}</span>
      <span className="text-xs font-semibold tabular-nums text-[color:var(--color-muted)]">{usdLine}</span>
    </span>
  )
}
