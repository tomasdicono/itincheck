import { useCallback, useMemo, useState } from 'react'
import { downloadInformeExcel } from './lib/exportInformeExcel'
import { parseExcelFile } from './lib/parseExcel'
import {
  buildProgrammingReport,
  collectAirportsFromProgrammingMatrix,
  filterProgrammingRawMatrix,
  getProgrammingMatrixDataStartRow,
  hasActiveProgrammingFilters,
  matchesProgrammingFilters,
  type ProgrammingViewFilters,
} from './lib/programmingReport'

export default function App() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [rawMatrix, setRawMatrix] = useState<unknown[][]>([])
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedAirports, setSelectedAirports] = useState<string[]>([])

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      const { headers: h, rows: r, rawMatrix: m } = await parseExcelFile(file)
      setFileName(file.name)
      setHeaders(h)
      setRows(r)
      setRawMatrix(m)
      setDateFrom('')
      setDateTo('')
      setSelectedAirports([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel.')
    }
  }, [])

  const viewFilters = useMemo<ProgrammingViewFilters>(
    () => ({
      dateFrom: dateFrom.trim() || null,
      dateTo: dateTo.trim() || null,
      airportsIata: selectedAirports,
    }),
    [dateFrom, dateTo, selectedAirports],
  )

  const filteredMatrix = useMemo(
    () => filterProgrammingRawMatrix(rawMatrix, viewFilters),
    [rawMatrix, viewFilters],
  )

  const programmingReport = useMemo(() => buildProgrammingReport(filteredMatrix), [filteredMatrix])

  const airportsInFile = useMemo(() => collectAirportsFromProgrammingMatrix(rawMatrix), [rawMatrix])

  const dataStartRow = useMemo(() => getProgrammingMatrixDataStartRow(rawMatrix), [rawMatrix])

  const filteredPreviewRows = useMemo(() => {
    if (!rows.length || !rawMatrix.length) return rows
    if (!hasActiveProgrammingFilters(viewFilters)) return rows
    return rows.filter((_, j) => {
      const row = rawMatrix[j + dataStartRow]
      return row && matchesProgrammingFilters(row, viewFilters)
    })
  }, [rows, rawMatrix, dataStartRow, viewFilters])

  const preview = filteredPreviewRows.slice(0, 8)

  const filtersActive = hasActiveProgrammingFilters(viewFilters)

  const clearFilters = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    setSelectedAirports([])
  }, [])

  const toggleAirport = useCallback((iata: string) => {
    setSelectedAirports((prev) =>
      prev.includes(iata) ? prev.filter((x) => x !== iata) : [...prev, iata],
    )
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-[color:var(--color-page)] text-[color:var(--color-ink)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-[color:var(--color-brand-purple)] via-[color:var(--color-brand-mid)] to-[color:var(--color-brand-magenta)] text-white shadow-[0_8px_32px_rgba(90,0,80,0.25)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg font-black tracking-tight text-white ring-2 ring-white/30 backdrop-blur-sm"
              aria-hidden
            >
              IT
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/80">Operaciones</p>
              <h1 className="text-xl font-black leading-tight tracking-tight md:text-2xl">Análisis de itinerarios</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-6">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                document.getElementById('file-input')?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              const f = e.dataTransfer.files[0]
              if (f) void onFile(f)
            }}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`js-card flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${
              drag
                ? 'border-[color:var(--color-brand-magenta)] bg-[color:var(--color-brand-glow)]'
                : 'border-[color:var(--color-line)] bg-white hover:border-[color:var(--color-brand-magenta)]/40'
            }`}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
            <p className="text-lg font-black text-[color:var(--color-ink)]">Subí tu itinerario</p>
            <p className="mt-2 max-w-md text-sm text-[color:var(--color-muted)]">
              Excel (.xlsx / .xls) con encabezados en la primera fila. Al cargar el archivo se genera el informe de
              vuelos (meses, escalas, equipamiento y simultaneidad).
            </p>
            {fileName ? (
              <p className="mt-4 rounded-full bg-[color:var(--color-page)] px-4 py-1.5 text-sm font-bold text-[color:var(--color-ink)] ring-1 ring-[color:var(--color-line)]">
                {fileName} · {rows.length} filas
              </p>
            ) : null}
          </div>

          <div className="js-card flex flex-col justify-center rounded-3xl border border-[color:var(--color-line)] bg-white p-6">
            <h2 className="text-base font-black text-[color:var(--color-ink)]">Cómo funciona</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[color:var(--color-muted)]">
              <li>Subís el archivo de programación (formato JetSMART u hoja equivalente).</li>
              <li>Usá los filtros de fecha y escala para acotar todas las tablas del informe.</li>
              <li>Revisá la vista previa y descargá el Excel si lo necesitás.</li>
            </ol>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {error}
          </div>
        ) : null}

        {headers.length > 0 ? (
          <>
            {rawMatrix.length > 0 ? (
              <section className="js-card rounded-3xl border border-[color:var(--color-line)] bg-white p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Filtros</h2>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      Aplican a la vista previa y a todo el informe (por fecha de operación y escala IATA, columna H).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!filtersActive}
                    className="shrink-0 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-page)] px-4 py-2.5 text-sm font-bold text-[color:var(--color-ink)] transition enabled:hover:border-[color:var(--color-brand-magenta)]/50 enabled:hover:bg-[color:var(--color-brand-glow)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Limpiar filtros
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
                      Desde
                    </span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="js-input rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)] px-3 py-2.5 text-sm font-semibold text-[color:var(--color-ink)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
                      Hasta
                    </span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="js-input rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-page)] px-3 py-2.5 text-sm font-semibold text-[color:var(--color-ink)]"
                    />
                  </label>
                </div>

                <div className="mt-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
                    Escala (IATA)
                  </span>
                  <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                    Sin selección se muestran todas las escalas del archivo.
                  </p>
                  <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-page)] p-3">
                    {airportsInFile.length === 0 ? (
                      <span className="text-sm text-[color:var(--color-muted)]">No se detectaron escalas en los datos.</span>
                    ) : (
                      airportsInFile.map((code) => {
                        const on = selectedAirports.includes(code)
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleAirport(code)}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                              on
                                ? 'bg-gradient-to-r from-[color:var(--color-brand-purple)] to-[color:var(--color-brand-magenta)] text-white shadow-sm'
                                : 'bg-white text-[color:var(--color-ink)] ring-1 ring-[color:var(--color-line)] hover:ring-[color:var(--color-brand-magenta)]/40'
                            }`}
                          >
                            {code}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {filtersActive ? (
                  <p className="mt-4 text-sm font-semibold text-[color:var(--color-brand-magenta)]">
                    Mostrando {filteredPreviewRows.length.toLocaleString('es-AR')} de{' '}
                    {rows.length.toLocaleString('es-AR')} filas · informe recalculado con el mismo criterio.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="js-card rounded-3xl border border-[color:var(--color-line)] bg-white p-6">
              <h2 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Vista previa</h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
                <table className="min-w-full text-left text-xs md:text-sm">
                  <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
                    <tr>
                      {headers.slice(0, 10).map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-[color:var(--color-line)] bg-white odd:bg-[color:var(--color-page)]/50">
                        {headers.slice(0, 10).map((h) => (
                          <td key={h} className="max-w-[10rem] truncate px-3 py-2">
                            {row[h] == null ? '' : String(row[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {programmingReport ? (
              <section className="js-card rounded-3xl border border-[color:var(--color-line)] bg-white p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-black tracking-tight text-[color:var(--color-ink)]">Informe de programación</h2>
                    <p className="mt-2 text-sm font-bold text-[color:var(--color-ink)]">
                      {programmingReport.totalFilasDatos.toLocaleString('es-AR')} vuelos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadInformeExcel(programmingReport, fileName)}
                    className="shrink-0 rounded-full bg-gradient-to-r from-[color:var(--color-brand-purple)] to-[color:var(--color-brand-magenta)] px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:brightness-110"
                  >
                    Descargar Excel
                  </button>
                </div>
                <div className="mt-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-brand-magenta)]">
                    Por escala y por mes
                  </h3>
                  <div className="mt-2 max-h-80 overflow-auto rounded-2xl border border-[color:var(--color-line)]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
                        <tr>
                          <th className="sticky left-0 z-10 bg-[color:var(--color-table-head)] px-3 py-2.5 font-bold">
                            Escala
                          </th>
                          {programmingReport.meses.map((mes) => (
                            <th key={mes.mes} className="whitespace-nowrap px-3 py-2.5 text-right font-bold capitalize">
                              {mes.etiqueta}
                            </th>
                          ))}
                          <th className="px-3 py-2.5 text-right font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programmingReport.tablaEscalaPorMes.map((row) => (
                          <tr key={row.escala} className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                            <td className="sticky left-0 bg-white px-3 py-2 font-mono font-bold odd:bg-[color:var(--color-page)]/60">
                              {row.escala}
                            </td>
                            {row.cantidadesPorMes.map((cantidad, i) => (
                              <td
                                key={`${row.escala}-${programmingReport.meses[i]?.mes ?? i}`}
                                className="px-3 py-2 text-right font-semibold tabular-nums"
                              >
                                {cantidad.toLocaleString('es-AR')}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-black tabular-nums">{row.total.toLocaleString('es-AR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-brand-magenta)]">
                    Vuelos en mismo minuto
                  </h3>
                  <div className="mt-2 max-h-72 overflow-auto rounded-2xl border border-[color:var(--color-line)]">
                    {programmingReport.vuelosMismoMinuto.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[color:var(--color-muted)]">
                        No se detectaron vuelos en mismo minuto con los datos cargados.
                      </p>
                    ) : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
                          <tr>
                            <th className="px-3 py-2.5 font-bold">Día</th>
                            <th className="px-3 py-2.5 font-bold">Escala</th>
                            <th className="px-3 py-2.5 font-bold">ETD</th>
                            <th className="px-3 py-2.5 text-right font-bold">Vuelos</th>
                            <th className="px-3 py-2.5 font-bold">Nº de vuelo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programmingReport.vuelosMismoMinuto.map((row) => (
                            <tr
                              key={`${row.fecha}-${row.escala}-${row.etd}`}
                              className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                            >
                              <td className="px-3 py-2">{row.fecha}</td>
                              <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                              <td className="px-3 py-2 font-bold">{row.etd}</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                {row.cantidad.toLocaleString('es-AR')}
                              </td>
                              <td className="px-3 py-2 text-xs">{row.vuelos.join(', ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-brand-magenta)]">
                    Horas extra ITC
                  </h3>
                  <div className="mt-2 max-h-72 overflow-auto rounded-2xl border border-[color:var(--color-line)]">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-[color:var(--color-table-head)] text-[color:var(--color-muted)] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]">
                        <tr>
                          <th className="px-3 py-2.5 font-bold">Fecha</th>
                          <th className="px-3 py-2.5 font-bold">Escala</th>
                          <th className="px-3 py-2.5 font-bold">Nº de vuelo</th>
                          <th className="px-3 py-2.5 font-bold">ETD</th>
                          <th className="px-3 py-2.5 font-bold">Cantidad de extras generadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programmingReport.extrasFueraItc.length === 0 ? (
                          <tr className="border-t border-[color:var(--color-line)]">
                            <td colSpan={5} className="px-4 py-3 text-sm text-[color:var(--color-muted)]">
                              No hay vuelos con ETD fuera de ventana ITC para las escalas configuradas.
                            </td>
                          </tr>
                        ) : (
                          programmingReport.extrasFueraItc.map((row, i) => (
                            <tr
                              key={`${row.fecha}-${row.escala}-${row.vuelo}-${row.etd}-${i}`}
                              className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                            >
                              <td className="px-3 py-2">{row.fecha}</td>
                              <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                              <td className="px-3 py-2 font-mono font-bold">{row.vuelo}</td>
                              <td className="px-3 py-2 font-bold">{row.etd}</td>
                              <td className="px-3 py-2 font-semibold">{row.extrasTexto}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-20 bg-[color:var(--color-table-head)] font-bold shadow-[0_-6px_16px_-4px_rgba(0,0,0,0.08)]">
                        <tr>
                          <td colSpan={4} className="border-t-2 border-[color:var(--color-line)] px-3 py-3">
                            Horas totales generadas
                          </td>
                          <td className="border-t-2 border-[color:var(--color-line)] px-3 py-3 font-semibold tabular-nums">
                            {programmingReport.extrasItcTotalTexto}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="border-t border-[color:var(--color-line)] px-3 py-3">
                            Costo aprox
                          </td>
                          <td className="border-t border-[color:var(--color-line)] px-3 py-3 font-semibold tabular-nums">
                            {new Intl.NumberFormat('es-AR', {
                              style: 'currency',
                              currency: 'ARS',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(programmingReport.extrasItcCostoAproxArs)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-6">
                    <h4 className="text-sm font-black text-[color:var(--color-ink)]">Ranking por escala</h4>
                    <div className="mt-2 max-h-56 overflow-auto rounded-2xl border border-[color:var(--color-line)]">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
                          <tr>
                            <th className="px-3 py-2.5 font-bold">#</th>
                            <th className="px-3 py-2.5 font-bold">Escala</th>
                            {programmingReport.meses.map((m) => (
                              <th
                                key={m.mes}
                                className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold capitalize"
                                title={m.etiqueta}
                              >
                                {m.etiqueta}
                                <span className="block font-normal normal-case text-[10px] text-[color:var(--color-muted)]">
                                  (h)
                                </span>
                              </th>
                            ))}
                            <th className="px-3 py-2.5 text-right font-bold">Total extra</th>
                            <th className="px-3 py-2.5 text-right font-bold">Costo aprox</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programmingReport.rankingExtrasItcPorEscala.map((row) => (
                            <tr key={row.escala} className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40">
                              <td className="px-3 py-2 tabular-nums text-[color:var(--color-muted)]">{row.posicion}</td>
                              <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                              {row.extrasPorMesHoras.map((horas, i) => (
                                <td
                                  key={`${row.escala}-${programmingReport.meses[i]?.mes ?? i}`}
                                  className="px-3 py-2 text-right text-xs font-semibold tabular-nums"
                                >
                                  {horas.toLocaleString('es-AR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right font-bold tabular-nums">{row.texto}</td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums">
                                {new Intl.NumberFormat('es-AR', {
                                  style: 'currency',
                                  currency: 'ARS',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(row.costoAproxArs)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="rounded-2xl border border-[color:var(--color-line)] bg-gradient-to-br from-[color:var(--color-page)] to-white p-4 md:max-w-md">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-brand-magenta)]">
                      Equipamiento
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm font-semibold">
                      <li className="flex justify-between gap-4">
                        <span>320</span>
                        <span className="tabular-nums font-black">
                          {programmingReport.equipamiento.c320.toLocaleString('es-AR')}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4">
                        <span>321</span>
                        <span className="tabular-nums font-black">
                          {programmingReport.equipamiento.c321.toLocaleString('es-AR')}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[color:var(--color-muted)]">
                        <span>Otros / no clasificado</span>
                        <span className="tabular-nums font-bold">
                          {programmingReport.equipamiento.cotro.toLocaleString('es-AR')}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-brand-magenta)]">
                    Simultaneidad alta
                  </h3>
                  <div className="mt-2 max-h-80 overflow-auto rounded-2xl border border-[color:var(--color-line)]">
                    {programmingReport.simultaneidadMasCuatro.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[color:var(--color-muted)]">
                        No hay franjas con más de 4 vuelos simultáneos en la misma hora, día y escala.
                      </p>
                    ) : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[color:var(--color-table-head)] text-[color:var(--color-muted)]">
                          <tr>
                            <th className="px-3 py-2.5 font-bold">Fecha</th>
                            <th className="px-3 py-2.5 font-bold">Escala</th>
                            <th className="px-3 py-2.5 font-bold">Franja (hora local)</th>
                            <th className="px-3 py-2.5 text-right font-bold">Vuelos</th>
                            <th className="px-3 py-2.5 font-bold">Nº de vuelo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programmingReport.simultaneidadMasCuatro.map((row, i) => (
                            <tr
                              key={`${row.fecha}-${row.escala}-${row.franjaHoraria}-${i}`}
                              className="border-t border-[color:var(--color-line)] odd:bg-[color:var(--color-page)]/40"
                            >
                              <td className="px-3 py-2">{row.fecha}</td>
                              <td className="px-3 py-2 font-mono font-bold">{row.escala}</td>
                              <td className="px-3 py-2 font-bold">{row.franjaHoraria}</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                {row.cantidadVuelos.toLocaleString('es-AR')}
                              </td>
                              <td className="px-3 py-2 text-xs">{row.vuelos.join(', ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </section>
            ) : filtersActive ? (
              <section className="js-card rounded-3xl border border-amber-200/80 bg-amber-50/90 p-6 text-sm font-medium text-amber-950">
                Con los filtros actuales no quedaron filas de datos válidas para el informe (fechas u escalas fuera de
                rango). Probá ampliar fechas o elegir otras escalas.
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="border-t border-[color:var(--color-line)] bg-white py-6 text-center text-xs font-medium text-[color:var(--color-muted)]">
        Herramienta interna · datos procesados solo en el navegador
      </footer>
    </div>
  )
}
