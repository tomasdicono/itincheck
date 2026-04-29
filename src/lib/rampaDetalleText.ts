import type { RampaMonthLine } from './providerCostReport'
import { RAMPA_DESCUENTO_MADRUGADA, RAMPA_REL_RES_USD } from './providerCostReport'

export function formatRampaLineDetalle(line: RampaMonthLine): string {
  const parts: string[] = []
  if (line.relRes > 0) parts.push(`REL/RES (${line.relRes} vuelos × ${RAMPA_REL_RES_USD} USD)`)
  if (line.dom320 > 0) parts.push(`Dom 320: ${line.dom320}`)
  if (line.dom321 > 0) parts.push(`Dom 321: ${line.dom321}`)
  if (line.inter320 > 0) parts.push(`Inter 320: ${line.inter320}`)
  if (line.inter321 > 0) parts.push(`Inter 321: ${line.inter321}`)
  if (line.otroDom > 0) parts.push(`Otro eq. dom.: ${line.otroDom} (tarifa 320 dom.)`)
  if (line.otroInter > 0) parts.push(`Otro eq. inter.: ${line.otroInter} (tarifa 320 inter.)`)
  if (line.vuelosConDescuentoMadrugada > 0) {
    parts.push(
      `Desc. madrugada solo DOM, ETD 00:00–05:59 (−${(RAMPA_DESCUENTO_MADRUGADA * 100).toLocaleString('es-AR')}%): ${line.vuelosConDescuentoMadrugada.toLocaleString('es-AR')} vuelos`,
    )
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}
