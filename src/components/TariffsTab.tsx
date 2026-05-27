import { Fragment } from 'react'
import {
  AEP_SWISS_BRACKETS,
  EZE_SWISS_BRACKETS,
  FLYSEG_UNIT,
  FLYSEG_SILLA_RUEDAS_UNITARIO_ARS,
  SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS,
  NFS_CRD_MATERIALES_POR_VUELO_ARS,
  RAMPA_DOM_320_USD,
  RAMPA_DOM_321_USD,
  RAMPA_INTER_320_USD,
  RAMPA_INTER_321_USD,
  RAMPA_ADICIONALES_USD,
  RAMPA_REL_RES_USD,
  ITC_VIEJA_DOM_320_USD,
  ITC_VIEJA_DOM_321_USD,
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
  nfsCrdPasadaArsForWeeklyRounded,
} from '../lib/providerCostReport'

export function TariffsTab() {
  const moneyArs = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
  const moneyUsd = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })

  // Build a distinct list of ranges for FlySeg to compress the display
  const flySegRanges: { min: number; max: number; unit: number }[] = []
  let currentStart = 1
  for (let i = 2; i <= 60; i++) {
    if (FLYSEG_UNIT[i] !== FLYSEG_UNIT[currentStart]) {
      flySegRanges.push({ min: currentStart, max: i - 1, unit: FLYSEG_UNIT[currentStart]! })
      currentStart = i
    }
  }
  flySegRanges.push({ min: currentStart, max: 60, unit: FLYSEG_UNIT[currentStart]! })

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="text-xl font-black tracking-tight text-[color:var(--color-ink)]">Tarifarios actuales</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Listado de tarifas cargadas en el sistema por cada proveedor.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 text-lg font-black text-[color:var(--color-ink)]">FlySeg</h3>
          <p className="mb-2 text-sm text-[color:var(--color-muted)]">
            Por franjas de días (1-7, 8-14, 15-21, 22-31). Se paga por los vuelos realizados en cada franja.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--color-table-head)]">
                <tr>
                  <th className="px-3 py-2 font-bold text-[color:var(--color-muted)]">Vuelos</th>
                  <th className="px-3 py-2 text-right font-bold text-[color:var(--color-muted)]">ARS Unitario</th>
                </tr>
              </thead>
              <tbody>
                {flySegRanges.map((r, i) => (
                  <tr key={i} className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                    <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">
                      {r.min === r.max ? r.min : `${r.min} a ${r.max}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                      {moneyArs(r.unit)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[color:var(--color-line)] bg-[color:var(--color-page)]/60">
                  <td className="px-3 py-2 font-bold text-[color:var(--color-ink)]">Asistencias (WCH)</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[color:var(--color-ink)]">
                    {moneyArs(FLYSEG_SILLA_RUEDAS_UNITARIO_ARS)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 text-lg font-black text-[color:var(--color-ink)]">NFS (CRD)</h3>
          <p className="mb-2 text-sm text-[color:var(--color-muted)]">
            Depende del promedio redondeado de vuelos por semana en el mes.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--color-table-head)]">
                <tr>
                  <th className="px-3 py-2 font-bold text-[color:var(--color-muted)]">Promedio semanal</th>
                  <th className="px-3 py-2 text-right font-bold text-[color:var(--color-muted)]">ARS Unitario</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 7, 14, 15].map((w, i) => {
                  const { unit, label } = nfsCrdPasadaArsForWeeklyRounded(w)
                  return (
                    <tr key={i} className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                      <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">{label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                        {moneyArs(unit)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t border-[color:var(--color-line)] bg-[color:var(--color-page)]/60">
                  <td className="px-3 py-2 font-bold text-[color:var(--color-ink)]">Materiales (por vuelo)</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[color:var(--color-ink)]">
                    {moneyArs(NFS_CRD_MATERIALES_POR_VUELO_ARS)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 text-lg font-black text-[color:var(--color-ink)]">Swissport AEP</h3>
          <p className="mb-2 text-sm text-[color:var(--color-muted)]">
            Brackets según cantidad de vuelos en el mes (base sin adicionales por 321 ni simultaneidad).
          </p>
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--color-table-head)]">
                <tr>
                  <th className="px-3 py-2 font-bold text-[color:var(--color-muted)]">Bracket</th>
                  <th className="px-3 py-2 text-right font-bold text-[color:var(--color-muted)]">ARS Unitario</th>
                </tr>
              </thead>
              <tbody>
                {AEP_SWISS_BRACKETS.map((b, i) => (
                  <tr key={i} className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                    <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">{b.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                      {moneyArs(b.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 text-lg font-black text-[color:var(--color-ink)]">Swissport EZE</h3>
          <p className="mb-2 text-sm text-[color:var(--color-muted)]">
            Brackets según cantidad de vuelos en el mes (base sin adicionales por 321 ni simultaneidad).
          </p>
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--color-table-head)]">
                <tr>
                  <th className="px-3 py-2 font-bold text-[color:var(--color-muted)]">Bracket</th>
                  <th className="px-3 py-2 text-right font-bold text-[color:var(--color-muted)]">ARS Unitario</th>
                </tr>
              </thead>
              <tbody>
                {EZE_SWISS_BRACKETS.map((b, i) => (
                  <tr key={i} className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                    <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">{b.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                      {moneyArs(b.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/60 p-3 text-sm">
            <p className="font-bold text-[color:var(--color-ink)]">Adicionales Swissport</p>
            <ul className="mt-1 list-inside list-disc text-[color:var(--color-muted)]">
              <li>Sillas de ruedas: {moneyArs(SWISSPORT_SILLA_RUEDAS_UNITARIO_ARS)}</li>
              <li>Avión 321: +20% sobre pasada</li>
              <li>Simultaneidad (2-3 vuelos): +10% sobre pasada</li>
              <li>Simultaneidad (4+ vuelos): +30% sobre pasada</li>
            </ul>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4">
        <h3 className="mb-3 text-lg font-black text-[color:var(--color-ink)]">Comparativa FB / ITC</h3>
        <p className="mb-2 text-sm text-[color:var(--color-muted)]">
          Por vuelo en AEP/EZE: pasada + adicional + micros (USD).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
            <p className="border-b border-[color:var(--color-line)] bg-[color:var(--color-table-head)] px-3 py-2 text-sm font-bold">
              FB — costo por vuelo
            </p>
            <table className="min-w-full text-left text-sm">
              <tbody>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td colSpan={2} className="px-3 py-2 text-xs font-bold uppercase text-[color:var(--color-muted)]">
                    Pasada escalonada (por orden de vuelo 320 / 321 en el mes)
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">Vuelos 1–{FB_ESCALON_TIER1_MAX}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    320 {moneyUsd(FB_TARIFA_320_USD)} · 321 {moneyUsd(FB_TARIFA_321_USD)}
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td className="px-3 py-2 font-semibold">
                    Vuelos {FB_ESCALON_TIER1_MAX + 1}–{FB_ESCALON_TIER2_MAX}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    320 {moneyUsd(FB_BRACKET_200_399_TARIFA_320_USD)} · 321{' '}
                    {moneyUsd(FB_BRACKET_200_399_TARIFA_321_USD)}
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">Vuelos {FB_ESCALON_TIER2_MAX + 1} en adelante</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    320 {moneyUsd(FB_BRACKET_400_PLUS_TARIFA_320_USD)} · 321{' '}
                    {moneyUsd(FB_BRACKET_400_PLUS_TARIFA_321_USD)}
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td className="px-3 py-2 font-semibold">Adicional</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneyUsd(FB_ADICIONALES_USD)}</td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">Micros</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneyUsd(FB_MICROS_USD)}</td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-[color:var(--color-line)] px-3 py-2 text-xs text-[color:var(--color-muted)]">
              Ej.: 201 vuelos 320 en el mes → 200×{moneyUsd(FB_TARIFA_320_USD)} + 1×
              {moneyUsd(FB_BRACKET_200_399_TARIFA_320_USD)} de pasada.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
            <p className="border-b border-[color:var(--color-line)] bg-[color:var(--color-table-head)] px-3 py-2 text-sm font-bold">
              ITC — componentes por vuelo
            </p>
            <table className="min-w-full text-left text-sm">
              <tbody>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td colSpan={2} className="px-3 py-2 text-xs font-bold uppercase text-[color:var(--color-muted)]">
                    Pasada (Rampa, según equip. col. L)
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">Dom. 320 / 321</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyUsd(RAMPA_DOM_320_USD)} / {moneyUsd(RAMPA_DOM_321_USD)}
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td className="px-3 py-2 font-semibold">Inter. 320 / 321</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyUsd(RAMPA_INTER_320_USD)} / {moneyUsd(RAMPA_INTER_321_USD)}
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">Adicional (solo dom.)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneyUsd(RAMPA_ADICIONALES_USD)}</td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td colSpan={2} className="px-3 py-2 text-xs font-bold uppercase text-[color:var(--color-muted)]">
                    Micros
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">EZE dom. (100% uso)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneyUsd(ITC_MICROS_EZE_DOM_USD)}</td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td className="px-3 py-2 font-semibold">EZE inter. (0% uso)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moneyUsd(0)}</td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                  <td className="px-3 py-2 font-semibold">
                    AEP dom. / inter. ({(ITC_MICROS_AEP_USO_FRACCION * 100).toLocaleString('es-AR')}% con micros)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyUsd(ITC_MICROS_AEP_DOM_USD * ITC_MICROS_AEP_USO_FRACCION)} /{' '}
                    {moneyUsd(ITC_MICROS_AEP_INTER_USD * ITC_MICROS_AEP_USO_FRACCION)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-[color:var(--color-line)] px-3 py-2 text-xs text-[color:var(--color-muted)]">
              Costo ITC = pasada + adicional + micros esperados. Desc. madrugada dom. según ETD.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4">
        <h3 className="mb-3 text-lg font-black text-[color:var(--color-ink)]">Rampa</h3>
        <p className="mb-2 text-sm text-[color:var(--color-muted)]">Tarifas en dólares (USD).</p>
        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--color-table-head)]">
              <tr>
                <th className="px-3 py-2 font-bold text-[color:var(--color-muted)]">Concepto</th>
                <th className="px-3 py-2 text-right font-bold text-[color:var(--color-muted)]">Tarifa Base</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">Doméstico 320</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(RAMPA_DOM_320_USD)} <span className="text-xs">(+{RAMPA_ADICIONALES_USD} adic.)</span>
                </td>
              </tr>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">Doméstico 321</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(RAMPA_DOM_321_USD)} <span className="text-xs">(+{RAMPA_ADICIONALES_USD} adic.)</span>
                </td>
              </tr>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">Internacional 320</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(RAMPA_INTER_320_USD)} <span className="text-xs">(final)</span>
                </td>
              </tr>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">Internacional 321</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(RAMPA_INTER_321_USD)} <span className="text-xs">(final)</span>
                </td>
              </tr>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">REL / RES</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(RAMPA_REL_RES_USD)}
                </td>
              </tr>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">ITC "Tarifa vieja" Dom. 320</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(ITC_VIEJA_DOM_320_USD)} <span className="text-xs">(+{RAMPA_ADICIONALES_USD} adic.)</span>
                </td>
              </tr>
              <tr className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                <td className="px-3 py-2 font-semibold text-[color:var(--color-ink)]">ITC "Tarifa vieja" Dom. 321</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-muted)]">
                  {moneyUsd(ITC_VIEJA_DOM_321_USD)} <span className="text-xs">(+{RAMPA_ADICIONALES_USD} adic.)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
