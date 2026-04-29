import type { ProviderCostReport } from '../lib/providerCostReport'
import { COST_REPORT_AIRPORTS } from '../lib/providerCostReport'

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
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
          Los vuelos se agrupan por <strong>mes calendario</strong> y por franja de días{' '}
          <strong>1–7</strong>, <strong>8–14</strong>, <strong>15–21</strong> y <strong>22–31</strong>. La tarifa unitaria
          (por vuelo, llegada y salida) depende de la <strong>cantidad de vuelos en esa franja</strong> en esa escala; más
          de 60 vuelos usan la tarifa de 60.
        </p>
      </div>

      <section>
        <h3 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Costos FlySeg</h3>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Escalas permitidas excepto AEP y EZE. Precio por vuelo según volumen en la franja mensual.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-bold">Escala</th>
                <th className="px-3 py-2.5 font-bold">Mes</th>
                <th className="px-3 py-2.5 font-bold">Franja (mes)</th>
                <th className="px-3 py-2.5 text-right font-bold">Vuelos</th>
                <th className="px-3 py-2.5 text-right font-bold">Tramo tarifa (≤60)</th>
                <th className="px-3 py-2.5 text-right font-bold">Precio unitario</th>
                <th className="px-3 py-2.5 text-right font-bold">Subtotal</th>
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
                    key={`${row.escala}-${row.mesIso}-${row.periodo}`}
                    className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                    <td className="px-3 py-2 capitalize">{row.mesEtiqueta}</td>
                    <td className="px-3 py-2">{row.periodoLabel}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {row.vuelos.toLocaleString('es-AR')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.tramoTarifa.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(row.precioUnitarioArs)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{money(row.subtotalArs)}</td>
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
          AEP y EZE. Misma lógica de franjas y conteo de vuelos; las tarifas por tramo se cargarán en una próxima versión.
        </p>
        {report.swissportPendingPrices ? (
          <p className="mt-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            Precios Swissport pendientes: se muestran solo volúmenes por mes y franja.
          </p>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-bold">Escala</th>
                <th className="px-3 py-2.5 font-bold">Mes</th>
                <th className="px-3 py-2.5 font-bold">Franja (mes)</th>
                <th className="px-3 py-2.5 text-right font-bold">Vuelos</th>
                <th className="px-3 py-2.5 text-right font-bold">Precio unitario</th>
                <th className="px-3 py-2.5 text-right font-bold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {report.swissport.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                    No hay vuelos en AEP/EZE con los datos y filtros actuales.
                  </td>
                </tr>
              ) : (
                report.swissport.map((row) => (
                  <tr
                    key={`${row.escala}-${row.mesIso}-${row.periodo}`}
                    className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                    <td className="px-3 py-2 capitalize">{row.mesEtiqueta}</td>
                    <td className="px-3 py-2">{row.periodoLabel}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {row.vuelos.toLocaleString('es-AR')}
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
