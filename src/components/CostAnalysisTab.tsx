import { Fragment } from 'react'
import { DualMoneyTotal } from './DualMoneyTotal'
import { formatArsWithUsd } from '../lib/formatDualCurrency'
import type { ProviderCostReport } from '../lib/providerCostReport'
import {
  COST_REPORT_AIRPORTS,
  FLYSEG_SILLA_RUEDAS_UNITARIO_ARS,
  FLYSEG_SILLAS_RUEDAS_POR_VUELO,
  SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS,
  SWISSPORT_SILLAS_RUEDAS_POR_VUELO,
} from '../lib/providerCostReport'

const dec2 = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatIsoToAr(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function CostAnalysisTab({
  report,
  arsPerUsd,
  tcLoading,
  tcError,
  tcQuoteDateIso,
}: {
  report: ProviderCostReport
  arsPerUsd: number | null
  tcLoading: boolean
  tcError: string | null
  tcQuoteDateIso: string | null
}) {
  const money = (n: number | null) => formatArsWithUsd(n, arsPerUsd)

  return (
    <div className="flex flex-col gap-10">
      <h2 className="text-xl font-black tracking-tight text-[color:var(--color-ink)]">Análisis de costos</h2>

      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-brand-glow)]/40 p-4 text-sm text-[color:var(--color-ink)]">
        {tcLoading ? (
          <p className="font-semibold">Consultando tipo de cambio de valuación BCRA (datos.gob.ar)…</p>
        ) : tcError ? (
          <p>
            <span className="font-semibold">Cotización USD:</span> no disponible ({tcError}). Se muestran solo
            importes en pesos.
          </p>
        ) : arsPerUsd != null && tcQuoteDateIso ? (
          <p>
            <span className="font-semibold">Equivalente en USD:</span> tipo de cambio de valuación del BCRA (serie
            pública datos.gob.ar). Último dato publicado: {formatIsoToAr(tcQuoteDateIso)} —{' '}
            {arsPerUsd.toLocaleString('es-AR', { maximumFractionDigits: 4 })} ARS por USD. Los totales muestran pesos y
            dólares en líneas separadas.
          </p>
        ) : (
          <p className="text-[color:var(--color-muted)]">Sin cotización para mostrar equivalentes en USD.</p>
        )}
      </div>

      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/60 p-4 text-sm text-[color:var(--color-muted)]">
        <p className="font-semibold text-[color:var(--color-ink)]">Criterio de facturación</p>
        <p className="mt-2">
          Se consideran solo las escalas: <span className="font-mono font-bold text-[color:var(--color-ink)]">{COST_REPORT_AIRPORTS.join(', ')}</span>.
        </p>
        <p className="mt-2">
          <strong>FlySeg</strong> (resto de escalas): el total del mes es la suma por franjas de días{' '}
          <strong>1–7</strong>, <strong>8–14</strong>, <strong>15–21</strong> y <strong>22–31</strong>, con la tarifa
          unitaria según los vuelos de cada franja, más <strong>sillas de ruedas</strong> (
          {FLYSEG_SILLAS_RUEDAS_POR_VUELO} por vuelo × ${FLYSEG_SILLA_RUEDAS_UNITARIO_ARS.toLocaleString('es-AR')}). Las columnas
          de promedio semanal y precio unitario (ref.) son solo orientativas para el tramo de tarifas.
        </p>
        <p className="mt-2">
          <strong>Swissport</strong> (AEP y EZE): se factura por <strong>cantidad de vuelos del mes</strong> según
          brackets de pasada; cada vuelo en <strong>321</strong> (columna L) suma <strong>+20%</strong> sobre el valor de
          la pasada. <strong>Simultaneidades</strong> (mismo día, STD/ETD columna D a ≤59 min de distancia):{' '}
          <strong>+10%</strong> sobre la pasada de cada vuelo afectado si en el grupo hay 2 o 3 vuelos;{' '}
          <strong>+30%</strong> si hay 4 o más. Se suman <strong>$39.336</strong> por vuelo en materiales y{' '}
          <strong>sillas de ruedas</strong> ({SWISSPORT_SILLAS_RUEDAS_POR_VUELO} por vuelo × $
          {SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS.toLocaleString('es-AR')}).
        </p>
      </div>

      <section>
        <h3 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Costos FlySeg</h3>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Escalas permitidas excepto AEP y EZE. Por cada mes: tarifas por franja, sillas de ruedas y total.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-bold">Escala</th>
                <th className="px-3 py-2.5 font-bold">Mes</th>
                <th className="px-3 py-2.5 text-right font-bold">Vuelos (mes)</th>
                <th className="px-3 py-2.5 text-right font-bold">Prom. vuelos/sem. (ref.)</th>
                <th className="px-3 py-2.5 text-right font-bold">Tramo ref. (≤60)</th>
                <th className="px-3 py-2.5 text-right font-bold">Precio unit. (ref.) ARS·USD</th>
                <th className="px-3 py-2.5 text-right font-bold">Importe ARS·USD</th>
              </tr>
            </thead>
            <tbody>
              {report.flySeg.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                    No hay vuelos en las escalas FlySeg con los datos y filtros actuales.
                  </td>
                </tr>
              ) : (
                report.flySeg.map((row) => (
                  <Fragment key={`${row.escala}-${row.mesIso}`}>
                    <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                      <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                      <td className="px-3 py-2 capitalize">{row.mesEtiqueta}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {row.vuelosTotalMes.toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                        {dec2.format(row.promedioVuelosPorSemanaRef)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                        {row.tramoTarifaReferencia.toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                        {money(row.precioUnitarioReferenciaArs)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {money(row.costoFranjasArs)}
                      </td>
                    </tr>
                    <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                      <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                      <td className="px-3 py-2 capitalize">{row.mesEtiqueta}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {row.vuelosTotalMes.toLocaleString('es-AR')}
                      </td>
                      <td
                        colSpan={3}
                        className="px-3 py-2 text-xs text-[color:var(--color-muted)]"
                      >
                        Sillas de ruedas · {FLYSEG_SILLAS_RUEDAS_POR_VUELO} × $
                        {FLYSEG_SILLA_RUEDAS_UNITARIO_ARS.toLocaleString('es-AR')} ×{' '}
                        {row.vuelosTotalMes.toLocaleString('es-AR')} vuelos
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(row.costoSillasRuedasArs)}
                      </td>
                    </tr>
                    <tr className="border-t border-[color:var(--color-line)] bg-[color:var(--color-table-head)]/50 font-bold">
                      <td className="px-3 py-2 font-mono">{row.escala}</td>
                      <td className="px-3 py-2 capitalize">{row.mesEtiqueta}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.vuelosTotalMes.toLocaleString('es-AR')}
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-right text-[color:var(--color-muted)]">
                        Total mes
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <DualMoneyTotal value={row.costoTotalMesRealArs} arsPerUsd={arsPerUsd} />
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
            {report.flySeg.length > 0 ? (
              <tfoot className="bg-[color:var(--color-table-head)] font-bold">
                <tr>
                  <td colSpan={6} className="border-t-2 border-[color:var(--color-line)] px-3 py-3">
                    Total pasadas
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right align-top">
                    <DualMoneyTotal value={report.flySegTotalPasadasArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="border-t border-[color:var(--color-line)] px-3 py-3">
                    Total sillas de rueda
                  </td>
                  <td className="border-t border-[color:var(--color-line)] px-3 py-3 text-right align-top">
                    <DualMoneyTotal value={report.flySegTotalSillasRuedasArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="border-t border-[color:var(--color-line)] px-3 py-3 font-black">
                    Total FlySeg
                  </td>
                  <td className="border-t border-[color:var(--color-line)] px-3 py-3 text-right align-top font-black">
                    <DualMoneyTotal value={report.flySegTotalArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Costos Swissport</h3>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          AEP y EZE: por cada mes se muestran pasadas (base +321), recargo simultaneidades, materiales, sillas de ruedas y
          total.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-bold">Escala</th>
                <th className="px-3 py-2.5 font-bold">Mes</th>
                <th className="px-3 py-2.5 font-bold">Concepto</th>
                <th className="px-3 py-2.5 text-right font-bold">Vuelos (mes)</th>
                <th className="px-3 py-2.5 font-bold">Detalle</th>
                <th className="px-3 py-2.5 text-right font-bold">Importe (ARS · USD)</th>
              </tr>
            </thead>
            <tbody>
              {report.swissportBlocks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                    No hay vuelos en AEP/EZE con los datos y filtros actuales.
                  </td>
                </tr>
              ) : (
                report.swissportBlocks.map((b) => (
                  <Fragment key={`${b.escala}-${b.mesIso}`}>
                    <tr className="border-t border-[color:var(--color-line)] bg-[color:var(--color-page)]/30">
                      <td className="px-3 py-2 font-mono font-bold">{b.escala}</td>
                      <td className="px-3 py-2 capitalize">{b.mesEtiqueta}</td>
                      <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">
                        Costo pasadas
                        <span className="mt-0.5 block text-xs font-normal text-[color:var(--color-muted)]">
                          Incluye +20% sobre pasada si el avión es 321 (columna L).
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.vuelosTotalMes.toLocaleString('es-AR')}</td>
                      <td className="px-3 py-2 text-xs text-[color:var(--color-muted)]">
                        Bracket {b.bracketRango} · Tarifa base {money(b.unitPasadaBracketArs)} ·{' '}
                        {b.vuelos321Mes.toLocaleString('es-AR')} vuelos 321
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(b.costoPasadasArs)}</td>
                    </tr>
                    <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                      <td className="px-3 py-2 font-mono font-bold">{b.escala}</td>
                      <td className="px-3 py-2 capitalize">{b.mesEtiqueta}</td>
                      <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">
                        Recargo simultaneidades
                        <span className="mt-0.5 block text-xs font-normal text-[color:var(--color-muted)]">
                          Mismo día, |ETD−ETD| ≤ 59 min. +10% pasada (2–3 vuelos en grupo); +30% (4 o más).
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.vuelosTotalMes.toLocaleString('es-AR')}</td>
                      <td className="px-3 py-2 text-xs text-[color:var(--color-muted)]">
                        Sobre pasada base +321 por vuelo
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(b.costoSimultaneidadArs)}
                      </td>
                    </tr>
                    <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                      <td className="px-3 py-2 font-mono font-bold">{b.escala}</td>
                      <td className="px-3 py-2 capitalize">{b.mesEtiqueta}</td>
                      <td className="px-3 py-2 font-semibold">Costo materiales</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.vuelosTotalMes.toLocaleString('es-AR')}</td>
                      <td className="px-3 py-2 text-xs text-[color:var(--color-muted)]">
                        $39.336 × {b.vuelosTotalMes.toLocaleString('es-AR')} vuelos
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(b.costoMaterialesArs)}</td>
                    </tr>
                    <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                      <td className="px-3 py-2 font-mono font-bold">{b.escala}</td>
                      <td className="px-3 py-2 capitalize">{b.mesEtiqueta}</td>
                      <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">Sillas de ruedas</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.vuelosTotalMes.toLocaleString('es-AR')}</td>
                      <td className="px-3 py-2 text-xs text-[color:var(--color-muted)]">
                        {SWISSPORT_SILLAS_RUEDAS_POR_VUELO} × ${SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS.toLocaleString('es-AR')} ×{' '}
                        {b.vuelosTotalMes.toLocaleString('es-AR')} vuelos
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(b.costoSillasRuedasArs)}
                      </td>
                    </tr>
                    <tr className="border-t border-[color:var(--color-line)] bg-[color:var(--color-table-head)]/80 font-black">
                      <td className="px-3 py-2.5 font-mono">{b.escala}</td>
                      <td className="px-3 py-2.5 capitalize">{b.mesEtiqueta}</td>
                      <td className="px-3 py-2.5" colSpan={3}>
                        Total
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        <DualMoneyTotal value={b.totalMesArs} arsPerUsd={arsPerUsd} />
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
            {report.swissportBlocks.length > 0 ? (
              <tfoot className="bg-[color:var(--color-table-head)] font-bold">
                <tr>
                  <td colSpan={5} className="border-t-2 border-[color:var(--color-line)] px-3 py-3">
                    Total pasadas
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right align-top">
                    <DualMoneyTotal value={report.swissportTotalPasadasArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="border-t border-[color:var(--color-line)] px-3 py-3">
                    Total simultaneidades
                  </td>
                  <td className="border-t border-[color:var(--color-line)] px-3 py-3 text-right align-top">
                    <DualMoneyTotal value={report.swissportTotalSimultaneidadArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="border-t border-[color:var(--color-line)] px-3 py-3">
                    Total materiales
                  </td>
                  <td className="border-t border-[color:var(--color-line)] px-3 py-3 text-right align-top">
                    <DualMoneyTotal value={report.swissportTotalMaterialesArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="border-t border-[color:var(--color-line)] px-3 py-3">
                    Total sillas de ruedas
                  </td>
                  <td className="border-t border-[color:var(--color-line)] px-3 py-3 text-right align-top">
                    <DualMoneyTotal value={report.swissportTotalSillasRuedasArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="border-t border-[color:var(--color-line)] px-3 py-3 font-black">
                    Total Swissport (AEP + EZE)
                  </td>
                  <td className="border-t border-[color:var(--color-line)] px-3 py-3 text-right align-top font-black">
                    <DualMoneyTotal value={report.swissportTotalArs} arsPerUsd={arsPerUsd} />
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  )
}
