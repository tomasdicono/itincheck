import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import type { ProgrammingReport } from './programmingReport'

function safeFileBase(name: string | null | undefined): string {
  const raw = (name ?? 'informe').replace(/\.[^/.]+$/, '')
  return raw.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'informe'
}

/**
 * Genera un .xlsx: mismo minuto, horas extra ITC, ranking por escala y simultaneidad &gt;4/hora.
 */
export function downloadInformeExcel(report: ProgrammingReport, sourceFileName: string | null): void {
  const wb = XLSX.utils.book_new()
  const stamp = format(new Date(), 'yyyy-MM-dd_HHmm')
  const base = safeFileBase(sourceFileName)

  const mismoMinutoHeader = ['Día', 'Escala', 'ETD', 'Cantidad vuelos', 'Nº de vuelo']
  const mismoMinutoRows = report.vuelosMismoMinuto.map((r) => [
    r.fecha,
    r.escala,
    r.etd,
    r.cantidad,
    r.vuelos.join(', '),
  ])
  const wsMismo = XLSX.utils.aoa_to_sheet(
    mismoMinutoRows.length ? [mismoMinutoHeader, ...mismoMinutoRows] : [mismoMinutoHeader, ['—', '—', '—', 0, 'Sin coincidencias']],
  )
  XLSX.utils.book_append_sheet(wb, wsMismo, 'Mismo minuto')

  const itcHeader = ['Fecha', 'Escala', 'Nº de vuelo', 'ETD', 'Extras', 'Extras (min)']
  const itcBody = report.extrasFueraItc.map((r) => [
    r.fecha,
    r.escala,
    r.vuelo,
    r.etd,
    r.extrasTexto,
    r.extrasMinutos,
  ])
  const itcFooterHoras = [
    'Horas totales generadas',
    '',
    '',
    '',
    report.extrasItcTotalTexto,
    report.extrasItcTotalMinutos,
  ]
  const itcFooterCosto = [
    'Costo aprox',
    '',
    '',
    '',
    Number(report.extrasItcCostoAproxArs.toFixed(2)),
    '',
  ]
  const wsItc = XLSX.utils.aoa_to_sheet(
    itcBody.length
      ? [itcHeader, ...itcBody, itcFooterHoras, itcFooterCosto]
      : [itcHeader, ['—', '—', '—', '—', 'Sin registros', 0], itcFooterHoras, itcFooterCosto],
  )
  XLSX.utils.book_append_sheet(wb, wsItc, 'Horas extra ITC')

  const mesHeaders = report.meses.map((m) => `${m.etiqueta} (h)`)
  const rankingHeader = ['#', 'Escala', ...mesHeaders, 'Total extra', 'Total extra (min)']
  const rankingRows = report.rankingExtrasItcPorEscala.map((r) => [
    r.posicion,
    r.escala,
    ...r.extrasPorMesHoras,
    r.texto,
    r.minutos,
  ])
  const wsRank = XLSX.utils.aoa_to_sheet([rankingHeader, ...rankingRows])
  XLSX.utils.book_append_sheet(wb, wsRank, 'Ranking ITC')

  const simHeader = ['Fecha', 'Escala', 'Franja horaria', 'Cantidad vuelos', 'Nº de vuelo']
  const simRows = report.simultaneidadMasCuatro.map((r) => [
    r.fecha,
    r.escala,
    r.franjaHoraria,
    r.cantidadVuelos,
    r.vuelos.join(', '),
  ])
  const wsSim = XLSX.utils.aoa_to_sheet(
    simRows.length ? [simHeader, ...simRows] : [simHeader, ['—', '—', '—', 0, 'Sin franjas con >4 vuelos']],
  )
  XLSX.utils.book_append_sheet(wb, wsSim, 'Simultaneidad')

  const outName = `${base}_informe_${stamp}.xlsx`
  XLSX.writeFile(wb, outName)
}
