import type { ProviderCostReport } from '../lib/providerCostReport'
import { COST_REPORT_AIRPORTS } from '../lib/providerCostReport'

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dec2 = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(n: number | null): string {
  if (n == null) return '—'
  return ars.format(n)
}

export function CostAnalysisTab({ report }: { report: ProviderCostReport }) {
  return (
    <div className="flex flex-col gap-10">
      <h2 className="text-xl font-black tracking-tight text-[color:var(--color-ink)]">Análisis de costos</h2>

      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/60 p-4 text-sm text-[color:var(--color-muted)]">
        <p className="font-semibold text-[color:var(--color-ink)]">Criterio de facturación</p>
        <p className="mt-2">
          Se consideran solo las escalas: <span className="font-mono font-bold text-[color:var(--color-ink)]">{COST_REPORT_AIRPORTS.join(', ')}</span>.
          La tabla está agrupada por <strong>mes calendario</strong> y <strong>escala</strong>. El{' '}
          <strong>costo total del mes</strong> es la suma de lo que corresponde a cada franja del mes (días{' '}
          <strong>1–7</strong>, <strong>8–14</strong>, <strong>15–21</strong> y <strong>22–31</strong>): en cada franja se
          aplica la tarifa unitaria según la cantidad de vuelos <em>en esa franja</em> (más de 60 vuelos en la franja →
          tarifa de 60).
        </p>
        <p className="mt-2">
          Las columnas <strong>promedio de vuelos por semana</strong> y <strong>precio unitario (ref.)</strong> son solo
          referencia (promedio = vuelos del mes × 7 / días del mes; precio = grilla según ese promedio redondeado). No
          sustituyen al total del mes.
        </p>
      </div>

      <section>
        <h3 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Costos FlySeg</h3>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Escalas permitidas excepto AEP y EZE.
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
                <th className="px-3 py-2.5 text-right font-bold">Precio unit. (ref.)</th>
                <th className="px-3 py-2.5 text-right font-bold">Costo total mes (real)</th>
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
                  <tr
                    key={`${row.escala}-${row.mesIso}`}
                    className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                  >
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
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{money(row.costoTotalMesRealArs)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {report.flySeg.length > 0 ? (
              <tfoot className="bg-[color:var(--color-table-head)] font-bold">
                <tr>
                  <td colSpan={6} className="border-t-2 border-[color:var(--color-line)] px-3 py-3">
                    Total FlySeg
                  </td>
                  <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 text-right tabular-nums">
                    {money(report.flySegTotalArs)}
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
          AEP y EZE. Misma agrupación mensual y referencias de promedio; tarifas por franja pendientes.
        </p>
        {report.swissportPendingPrices ? (
          <p className="mt-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            Precios Swissport pendientes: se muestran volúmenes y referencias; el costo mensual real se agregará con la
            grilla AEP/EZE.
          </p>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-bold">Escala</th>
                <th className="px-3 py-2.5 font-bold">Mes</th>
                <th className="px-3 py-2.5 text-right font-bold">Vuelos (mes)</th>
                <th className="px-3 py-2.5 text-right font-bold">Prom. vuelos/sem. (ref.)</th>
                <th className="px-3 py-2.5 text-right font-bold">Tramo ref. (≤60)</th>
                <th className="px-3 py-2.5 text-right font-bold">Precio unit. (ref.)</th>
                <th className="px-3 py-2.5 text-right font-bold">Costo total mes (real)</th>
              </tr>
            </thead>
            <tbody>
              {report.swissport.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                    No hay vuelos en AEP/EZE con los datos y filtros actuales.
                  </td>
                </tr>
              ) : (
                report.swissport.map((row) => (
                  <tr
                    key={`${row.escala}-${row.mesIso}`}
                    className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                  >
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
                    <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">Pendiente</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
