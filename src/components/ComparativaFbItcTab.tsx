import { DualMoneyTotal } from './DualMoneyTotal'
import { formatArsWithUsd } from '../lib/formatDualCurrency'
import type { FbItcMicrosMonthLine, ProviderCostReport } from '../lib/providerCostReport'
import type { UsdArsQuoteProvider } from '../lib/usdArsSellQuote'
import {
  FB_ADICIONALES_USD,
  FB_BRACKET_200_399_TARIFA_320_USD,
  FB_BRACKET_200_399_TARIFA_321_USD,
  FB_BRACKET_400_PLUS_TARIFA_320_USD,
  FB_BRACKET_400_PLUS_TARIFA_321_USD,
  FB_ESCALON_TIER1_MAX,
  FB_ESCALON_TIER2_MAX,
  FB_MICROS_USD,
  FB_TARIFA_320_USD,
  FB_TARIFA_321_USD,
  ITC_MICROS_AEP_DOM_USD,
  ITC_MICROS_AEP_USO_FRACCION,
  ITC_MICROS_AEP_INTER_USD,
  ITC_MICROS_EZE_DOM_USD,
  ITC_MICROS_EZE_INTER_USD,
  RAMPA_ADICIONALES_USD,
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

function usdToArs(usd: number, arsPerUsd: number | null): number | null {
  if (arsPerUsd == null || arsPerUsd <= 0 || !Number.isFinite(arsPerUsd)) return null
  return Math.round(usd * arsPerUsd * 100) / 100
}

function MoneyCell({ usd, arsPerUsd }: { usd: number; arsPerUsd: number | null }) {
  const ars = usdToArs(usd, arsPerUsd)
  if (ars != null) return <span>{formatArsWithUsd(ars, arsPerUsd)}</span>
  return <span className="text-[color:var(--color-muted)]">{usdFmtPlain.format(usd)}</span>
}

function sumLines(lines: FbItcMicrosMonthLine[], pick: (l: FbItcMicrosMonthLine) => number): number {
  return Math.round(lines.reduce((s, l) => s + pick(l), 0) * 100) / 100
}

export function ComparativaFbItcTab({
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
  const lines = report.fbItcMicrosLines
  const fbTotal = report.fbItcMicrosFbTotalUsd
  const itcTotal = report.fbItcMicrosItcTotalUsd
  const detFbPasada = sumLines(lines, (l) => l.fbPasadaUsd)
  const detFbAdic = sumLines(lines, (l) => l.fbAdicionalUsd)
  const detFbMicros = sumLines(lines, (l) => l.fbMicrosUsd)
  const detItcPasada = sumLines(lines, (l) => l.itcPasadaUsd)
  const detItcAdic = sumLines(lines, (l) => l.itcAdicionalUsd)
  const detItcMicros = sumLines(lines, (l) => l.itcMicrosUsd)
  const diffUsd = Math.round((fbTotal - itcTotal) * 100) / 100
  const diffArs = usdToArs(diffUsd, arsPerUsd)
  const diffPct = itcTotal !== 0 ? Math.round((diffUsd / itcTotal) * 10_000) / 100 : null

  const tariffDesc =
    `Cada costo = pasada + adicional + micros. FB pasada escalonada por orden de vuelo del mes (320 y 321 por separado, col. L): vuelos 1–${FB_ESCALON_TIER1_MAX} → 320 ${FB_TARIFA_320_USD}/321 ${FB_TARIFA_321_USD}; ${FB_ESCALON_TIER1_MAX + 1}–${FB_ESCALON_TIER2_MAX} → ${FB_BRACKET_200_399_TARIFA_320_USD}/${FB_BRACKET_200_399_TARIFA_321_USD}; desde ${FB_ESCALON_TIER2_MAX + 1} → ${FB_BRACKET_400_PLUS_TARIFA_320_USD}/${FB_BRACKET_400_PLUS_TARIFA_321_USD}. + adic. ${FB_ADICIONALES_USD} + micros ${FB_MICROS_USD}. ` +
    `ITC micros esperados: AEP ${(ITC_MICROS_AEP_USO_FRACCION * 100).toLocaleString('es-AR')}% con uso; EZE dom. 100%; EZE inter. 0%. Pasada Rampa + adic. dom. ` +
    `Inter.: col. I ∈ {${RAMPA_INTER_DESTINOS.join(', ')}}. Sin operador JA (col. J); JZ sí.`

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-black tracking-tight text-[color:var(--color-ink)]">Comparativa FB / ITC</h2>
      <p className="text-sm text-[color:var(--color-muted)]">{tariffDesc}</p>

      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-brand-glow)]/40 p-4 text-sm text-[color:var(--color-ink)]">
        {tcLoading ? (
          <p className="font-semibold">Consultando dólar oficial venta (DolarApi.com)…</p>
        ) : tcError ? (
          <p>
            <span className="font-semibold">Cotización USD:</span> no disponible ({tcError}). Equivalente en pesos solo si
            hay TC.
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

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
            <tr>
              <th className="px-3 py-2.5 font-bold">Escala</th>
              <th className="px-3 py-2.5 font-bold">Mes</th>
              <th className="px-3 py-2.5 text-right font-bold">Dom.</th>
              <th className="px-3 py-2.5 text-right font-bold">Inter.</th>
              <th className="px-3 py-2.5 text-right font-bold">Vuelos</th>
              <th className="px-3 py-2.5 text-right font-bold">Costo FB</th>
              <th className="px-3 py-2.5 text-right font-bold">Costo ITC</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                  No hay vuelos en AEP/EZE con los datos y filtros actuales.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr
                  key={`${line.escala}-${line.mesIso}`}
                  className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                >
                  <td className="px-3 py-2 font-mono font-bold">{line.escala}</td>
                  <td className="px-3 py-2 capitalize">{line.mesEtiqueta}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.vuelosDom.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.vuelosInter.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {line.vuelosTotalMes.toLocaleString('es-AR')}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    <MoneyCell usd={line.costoFbUsd} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    <MoneyCell usd={line.costoItcUsd} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {lines.length > 0 ? (
            <tfoot className="bg-[color:var(--color-table-head)] font-bold">
              <tr>
                <td colSpan={5} className="border-t-2 border-[color:var(--color-line)] px-3 py-3 font-black">
                  Total
                </td>
                <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right align-top font-black">
                  {usdToArs(fbTotal, arsPerUsd) != null ? (
                    <DualMoneyTotal value={usdToArs(fbTotal, arsPerUsd)!} arsPerUsd={arsPerUsd} />
                  ) : (
                    <span className="tabular-nums">{usdFmtPlain.format(fbTotal)}</span>
                  )}
                </td>
                <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right align-top font-black">
                  {usdToArs(itcTotal, arsPerUsd) != null ? (
                    <DualMoneyTotal value={usdToArs(itcTotal, arsPerUsd)!} arsPerUsd={arsPerUsd} />
                  ) : (
                    <span className="tabular-nums">{usdFmtPlain.format(itcTotal)}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <section>
        <h3 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Detalle del cálculo</h3>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Desglose por escala y mes: cada total = pasada + adicional + micros. FB: pasada escalonada por nº de vuelo
          320/321 (ej. 201 vuelos 320 → 200×449 + 1×427). ITC: pasada Rampa + adicional dom.; micros con uso esperado.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-bold" rowSpan={2}>
                  Escala
                </th>
                <th className="px-3 py-2.5 font-bold" rowSpan={2}>
                  Mes
                </th>
                <th className="px-3 py-2.5 text-right font-bold" rowSpan={2}>
                  Vuelos
                </th>
                <th className="px-3 py-2.5 font-bold" rowSpan={2}>
                  Bracket FB
                </th>
                <th className="border-b border-[color:var(--color-line)] px-3 py-2 text-center font-bold" colSpan={3}>
                  Equip. (col. L)
                </th>
                <th
                  className="border-b border-l border-[color:var(--color-line)] px-3 py-2 text-center font-bold"
                  colSpan={4}
                >
                  FB (USD)
                </th>
                <th
                  className="border-b border-l border-[color:var(--color-line)] px-3 py-2 text-center font-bold"
                  colSpan={4}
                >
                  ITC (USD)
                </th>
              </tr>
              <tr>
                <th className="px-3 py-2 text-right text-xs font-bold">320</th>
                <th className="px-3 py-2 text-right text-xs font-bold">321</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Otro</th>
                <th className="border-l border-[color:var(--color-line)] px-3 py-2 text-right text-xs font-bold">
                  Pasada
                </th>
                <th className="px-3 py-2 text-right text-xs font-bold">Adic.</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Micros</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Total</th>
                <th className="border-l border-[color:var(--color-line)] px-3 py-2 text-right text-xs font-bold">
                  Pasada
                </th>
                <th className="px-3 py-2 text-right text-xs font-bold">Adic.</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Micros</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                    Sin datos para el detalle.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr
                    key={`det-${line.escala}-${line.mesIso}`}
                    className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold">{line.escala}</td>
                    <td className="px-3 py-2 capitalize">{line.mesEtiqueta}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.vuelosTotalMes.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="font-semibold">{line.fbBracketEtiqueta}</span>
                      <br />
                      <span className="text-[color:var(--color-muted)]">
                        320 {usdFmtPlain.format(line.fbTarifaPasada320Usd)} · 321{' '}
                        {usdFmtPlain.format(line.fbTarifaPasada321Usd)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.vuelosEquip320.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.vuelosEquip321.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.vuelosEquipOtro.toLocaleString('es-AR')}</td>
                    <td className="border-l border-[color:var(--color-line)] px-3 py-2 text-right tabular-nums">
                      <MoneyCell usd={line.fbPasadaUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <MoneyCell usd={line.fbAdicionalUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <MoneyCell usd={line.fbMicrosUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      <MoneyCell usd={line.costoFbUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="border-l border-[color:var(--color-line)] px-3 py-2 text-right tabular-nums">
                      <MoneyCell usd={line.itcPasadaUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <MoneyCell usd={line.itcAdicionalUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <MoneyCell usd={line.itcMicrosUsd} arsPerUsd={arsPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      <MoneyCell usd={line.costoItcUsd} arsPerUsd={arsPerUsd} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lines.length > 0 ? (
              <tfoot className="bg-[color:var(--color-table-head)] text-sm font-bold">
                <tr>
                  <td colSpan={4} className="border-t-2 border-[color:var(--color-line)] px-3 py-3">
                    Total
                  </td>
                  <td colSpan={3} className="border-t-2 border-[color:var(--color-line)] px-3 py-3" />
                  <td className="border-t-2 border-l border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={detFbPasada} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={detFbAdic} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={detFbMicros} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={fbTotal} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-l border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={detItcPasada} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={detItcAdic} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={detItcMicros} arsPerUsd={arsPerUsd} />
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    <MoneyCell usd={itcTotal} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        {lines.some((l) => l.itcVuelosDescMadrugada > 0) ? (
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            ITC pasada/adic. dom.: {lines.reduce((s, l) => s + l.itcVuelosDescMadrugada, 0).toLocaleString('es-AR')}{' '}
            vuelo(s) con descuento madrugada (ETD 00:00–05:59, −37,5 % sobre tarifa + adic.).
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-5">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--color-brand-celeste-muted)]">
          Comparación de totales
        </h3>
        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
          Diferencia = costo FB − costo ITC (pasada + adicional + micros; mismo universo de vuelos).
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/50 p-3">
            <dt className="text-xs font-bold uppercase text-[color:var(--color-muted)]">Costo FB</dt>
            <dd className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              Pasada (320/321) + adicional + micros por vuelo
            </dd>
            <dd className="mt-1 font-black tabular-nums">{usdFmtPlain.format(fbTotal)}</dd>
            <dd className="mt-1 text-xs font-semibold text-[color:var(--color-muted)]">
              {usdToArs(fbTotal, arsPerUsd) != null ? formatArsWithUsd(usdToArs(fbTotal, arsPerUsd)!, arsPerUsd) : '—'}
            </dd>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/50 p-3">
            <dt className="text-xs font-bold uppercase text-[color:var(--color-muted)]">Costo ITC</dt>
            <dd className="mt-0.5 text-xs text-[color:var(--color-muted)]">Pasada + adicional + micros por vuelo</dd>
            <dd className="mt-1 font-black tabular-nums">{usdFmtPlain.format(itcTotal)}</dd>
            <dd className="mt-1 text-xs font-semibold text-[color:var(--color-muted)]">
              {usdToArs(itcTotal, arsPerUsd) != null ? formatArsWithUsd(usdToArs(itcTotal, arsPerUsd)!, arsPerUsd) : '—'}
            </dd>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 sm:col-span-2">
            <dt className="text-xs font-bold uppercase text-[color:var(--color-muted)]">Diferencia (FB − ITC)</dt>
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
                <span className="text-[color:var(--color-muted)]">% sobre ITC: </span>
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
