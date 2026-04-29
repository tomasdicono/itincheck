import { DualMoneyTotal } from './DualMoneyTotal'
import { formatArsWithUsd } from '../lib/formatDualCurrency'
import { formatRampaLineDetalle } from '../lib/rampaDetalleText'
import type { ProviderCostReport } from '../lib/providerCostReport'
import type { UsdArsQuoteProvider } from '../lib/usdArsSellQuote'
import {
  ITC_VIEJA_DOM_320_USD,
  ITC_VIEJA_DOM_321_USD,
  RAMPA_ADICIONALES_USD,
  RAMPA_DESCUENTO_MADRUGADA,
  RAMPA_DOM_320_USD,
  RAMPA_DOM_321_USD,
  RAMPA_INTER_320_USD,
  RAMPA_INTER_321_USD,
  RAMPA_INTER_DESTINOS,
} from '../lib/providerCostReport'

const usdFmtPlain = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function rampaUsdToArs(usd: number, arsPerUsd: number | null): number | null {
  if (arsPerUsd == null || arsPerUsd <= 0 || !Number.isFinite(arsPerUsd)) return null
  return Math.round(usd * arsPerUsd * 100) / 100
}

function RampaItcTable({
  title,
  description,
  lines,
  totalUsd,
  arsPerUsd,
}: {
  title: string
  description: string
  lines: ProviderCostReport['itcRampaActualizadaLines']
  totalUsd: number
  arsPerUsd: number | null
}) {
  const footerArs = rampaUsdToArs(totalUsd, arsPerUsd)

  return (
    <section className="mt-10 first:mt-0">
      <h3 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">{title}</h3>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">{description}</p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
            <tr>
              <th className="px-3 py-2.5 font-bold">Escala</th>
              <th className="px-3 py-2.5 font-bold">Mes</th>
              <th className="px-3 py-2.5 text-right font-bold">Vuelos (mes)</th>
              <th className="px-3 py-2.5 font-bold">Detalle</th>
              <th className="px-3 py-2.5 text-right font-bold">Importe (ARS · USD)</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                  No hay vuelos (sin REL/RES) con los datos y filtros actuales.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const arsEquiv = rampaUsdToArs(line.totalUsd, arsPerUsd)
                return (
                  <tr
                    key={`${line.escala}-${line.mesIso}`}
                    className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold">{line.escala}</td>
                    <td className="px-3 py-2 capitalize">{line.mesEtiqueta}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {line.vuelosTotalMes.toLocaleString('es-AR')}
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--color-muted)]">
                      {formatRampaLineDetalle(line)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {arsEquiv != null ? (
                        formatArsWithUsd(arsEquiv, arsPerUsd)
                      ) : (
                        <span className="text-[color:var(--color-muted)]">{usdFmtPlain.format(line.totalUsd)}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {lines.length > 0 ? (
            <tfoot className="bg-[color:var(--color-table-head)] font-bold">
              <tr>
                <td colSpan={4} className="border-t-2 border-[color:var(--color-line)] px-3 py-3 font-black">
                  Total {title}
                </td>
                <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right align-top font-black">
                  {footerArs != null ? (
                    <DualMoneyTotal value={footerArs} arsPerUsd={arsPerUsd} />
                  ) : (
                    <span className="tabular-nums">{usdFmtPlain.format(totalUsd)}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  )
}

export function CasoItcTab({
  report,
  arsPerUsd,
  tcLoading,
  tcError,
  tcQuoteDateIso,
  tcQuoteProvider,
}: {
  report: ProviderCostReport
  arsPerUsd: number | null
  tcLoading: boolean
  tcError: string | null
  tcQuoteDateIso: string | null
  tcQuoteProvider: UsdArsQuoteProvider | null
}) {
  const actual = report.itcRampaActualizadaTotalUsd
  const vieja = report.itcRampaViejaTotalUsd
  const diffUsd = Math.round((actual - vieja) * 100) / 100
  const diffArs = rampaUsdToArs(diffUsd, arsPerUsd)
  const diffPct = vieja !== 0 ? Math.round((diffUsd / vieja) * 10_000) / 100 : null

  const descActual =
    `Sin escalas REL ni RES. Mismas tarifas que Costos Rampa: dom. 320 ${RAMPA_DOM_320_USD} + ${RAMPA_ADICIONALES_USD} · dom. 321 ` +
    `${RAMPA_DOM_321_USD} + ${RAMPA_ADICIONALES_USD} · inter. 320 ${RAMPA_INTER_320_USD} + ${RAMPA_ADICIONALES_USD} · inter. 321 ` +
    `${RAMPA_INTER_321_USD} + ${RAMPA_ADICIONALES_USD} USD por vuelo. Clasificación inter: columna I ∈ {${RAMPA_INTER_DESTINOS.join(', ')}}. ` +
    `ETD 00:00–05:59 solo DOM: −${(RAMPA_DESCUENTO_MADRUGADA * 100).toLocaleString('es-AR')}% sobre tarifa + adicionales.`

  const descVieja =
    `Sin REL/RES. Dom. 320 ${ITC_VIEJA_DOM_320_USD} + ${RAMPA_ADICIONALES_USD} · dom. 321 ${ITC_VIEJA_DOM_321_USD} + ${RAMPA_ADICIONALES_USD} · ` +
    `inter. 320 ${RAMPA_INTER_320_USD} + ${RAMPA_ADICIONALES_USD} · inter. 321 ${RAMPA_INTER_321_USD} + ${RAMPA_ADICIONALES_USD} USD por vuelo. ` +
    `Otros equipamientos: misma regla que Rampa (tarifa 320 dom./inter.). Sin descuento madrugada.`

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-black tracking-tight text-[color:var(--color-ink)]">CASO ITC</h2>

      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-brand-glow)]/40 p-4 text-sm text-[color:var(--color-ink)]">
        {tcLoading ? (
          <p className="font-semibold">Consultando dólar oficial venta (DolarApi.com)…</p>
        ) : tcError ? (
          <p>
            <span className="font-semibold">Cotización USD:</span> no disponible ({tcError}). Totales en USD y
            diferencia en pesos solo si hay TC.
          </p>
        ) : arsPerUsd != null && tcQuoteDateIso ? (
          <p>
            <span className="font-semibold">Equivalente en ARS ($):</span>{' '}
            {tcQuoteProvider === 'dolarapi_oficial_venta' ? (
              <>
                dólar oficial <strong>venta</strong> al {tcQuoteDateIso.split('-').reverse().join('/')}.
              </>
            ) : (
              <>
                respaldo BCRA valuación al {tcQuoteDateIso.split('-').reverse().join('/')}.
              </>
            )}
          </p>
        ) : null}
      </div>

      <RampaItcTable
        title="ITC tarifa actualizada"
        description={descActual}
        lines={report.itcRampaActualizadaLines}
        totalUsd={report.itcRampaActualizadaTotalUsd}
        arsPerUsd={arsPerUsd}
      />

      <RampaItcTable
        title="ITC tarifa vieja"
        description={descVieja}
        lines={report.itcRampaViejaLines}
        totalUsd={report.itcRampaViejaTotalUsd}
        arsPerUsd={arsPerUsd}
      />

      <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-5">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--color-brand-celeste-muted)]">
          Comparación de totales
        </h3>
        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
          Diferencia = tarifa actualizada − tarifa vieja (mismo universo de vuelos, sin REL/RES).
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/50 p-3">
            <dt className="text-xs font-bold uppercase text-[color:var(--color-muted)]">Total tarifa actualizada</dt>
            <dd className="mt-1 font-black tabular-nums">{usdFmtPlain.format(actual)}</dd>
            <dd className="mt-1 text-xs font-semibold text-[color:var(--color-muted)]">
              {rampaUsdToArs(actual, arsPerUsd) != null ? (
                formatArsWithUsd(rampaUsdToArs(actual, arsPerUsd)!, arsPerUsd)
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/50 p-3">
            <dt className="text-xs font-bold uppercase text-[color:var(--color-muted)]">Total tarifa vieja</dt>
            <dd className="mt-1 font-black tabular-nums">{usdFmtPlain.format(vieja)}</dd>
            <dd className="mt-1 text-xs font-semibold text-[color:var(--color-muted)]">
              {rampaUsdToArs(vieja, arsPerUsd) != null ? (
                formatArsWithUsd(rampaUsdToArs(vieja, arsPerUsd)!, arsPerUsd)
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 sm:col-span-2">
            <dt className="text-xs font-bold uppercase text-[color:var(--color-muted)]">Diferencia</dt>
            <dd className="mt-2 flex flex-wrap gap-x-6 gap-y-2 font-semibold">
              <span>
                <span className="text-[color:var(--color-muted)]">USD: </span>
                <span className="font-black tabular-nums text-[color:var(--color-ink)]">{usdFmtPlain.format(diffUsd)}</span>
              </span>
              <span>
                <span className="text-[color:var(--color-muted)]">$ (ARS): </span>
                {diffArs != null ? (
                  <span className="font-black tabular-nums text-[color:var(--color-ink)]">
                    {formatArsWithUsd(diffArs, arsPerUsd)}
                  </span>
                ) : (
                  <span className="text-[color:var(--color-muted)]">—</span>
                )}
              </span>
              <span>
                <span className="text-[color:var(--color-muted)]">% sobre tarifa vieja: </span>
                <span className="font-black tabular-nums text-[color:var(--color-ink)]">
                  {diffPct != null ? `${diffPct >= 0 ? '+' : ''}${diffPct.toLocaleString('es-AR')}%` : '—'}
                </span>
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
