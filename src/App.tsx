import { useCallback, useMemo, useState } from 'react'
import { downloadInformeExcel } from './lib/exportInformeExcel'
import { parseExcelFile } from './lib/parseExcel'
import { buildProgrammingReport } from './lib/programmingReport'

export default function App() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [rawMatrix, setRawMatrix] = useState<unknown[][]>([])
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      const { headers: h, rows: r, rawMatrix: m } = await parseExcelFile(file)
      setFileName(file.name)
      setHeaders(h)
      setRows(r)
      setRawMatrix(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel.')
    }
  }, [])

  const preview = rows.slice(0, 8)

  const programmingReport = useMemo(() => buildProgrammingReport(rawMatrix), [rawMatrix])

  return (
    <div className="min-h-dvh flex flex-col bg-white text-[color:var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg font-extrabold text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg,#ff6900 0%,#ff4500 100%)' }}
              aria-hidden
            >
              IT
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                Operaciones
              </p>
              <h1 className="text-lg font-extrabold leading-tight md:text-xl">Análisis de itinerarios</h1>
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
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
              drag
                ? 'border-[color:var(--color-brand)] bg-orange-50/80'
                : 'border-[color:var(--color-line)] bg-[color:var(--color-surface)] hover:border-orange-300'
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
            <p className="text-lg font-bold">Subí tu itinerario</p>
            <p className="mt-2 max-w-md text-sm text-[color:var(--color-muted)]">
              Excel (.xlsx / .xls) con encabezados en la primera fila. Al cargar el archivo se genera el
              informe de vuelos (meses, escalas, equipamiento y simultaneidad).
            </p>
            {fileName ? (
              <p className="mt-4 rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow-sm">
                {fileName} · {rows.length} filas
              </p>
            ) : null}
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-[color:var(--color-line)] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold">Cómo funciona</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[color:var(--color-muted)]">
              <li>Subís el archivo de programación (formato JetSMART u hoja equivalente).</li>
              <li>Revisás la vista previa de las primeras filas.</li>
              <li>Debajo aparece el informe: matriz escala por mes, 320/321 y solapes horarios.</li>
            </ol>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {headers.length > 0 ? (
          <>
            <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Vista previa</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
                <table className="min-w-full text-left text-xs md:text-sm">
                  <thead className="bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
                    <tr>
                      {headers.slice(0, 10).map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-[color:var(--color-line)]">
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
              <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">Informe de programación</h2>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--color-ink)]">
                      {programmingReport.totalFilasDatos.toLocaleString('es-AR')} vuelos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadInformeExcel(programmingReport, fileName)}
                    className="shrink-0 rounded-full border border-[color:var(--color-line)] bg-white px-4 py-2.5 text-sm font-bold text-[color:var(--color-ink)] shadow-sm transition hover:border-orange-300 hover:bg-orange-50/80"
                  >
                    Descargar Excel
                  </button>
                </div>
                <div className="mt-6">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                    Por escala y por mes
                  </h3>
                  <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-[color:var(--color-line)]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
                        <tr>
                          <th className="sticky left-0 z-10 bg-[color:var(--color-surface)] px-3 py-2 font-semibold">
                            Escala
                          </th>
                          {programmingReport.meses.map((mes) => (
                            <th key={mes.mes} className="whitespace-nowrap px-3 py-2 text-right font-semibold capitalize">
                              {mes.etiqueta}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programmingReport.tablaEscalaPorMes.map((row) => (
                          <tr key={row.escala} className="border-t border-[color:var(--color-line)]">
                            <td className="sticky left-0 bg-white px-3 py-2 font-mono font-semibold">{row.escala}</td>
                            {row.cantidadesPorMes.map((cantidad, i) => (
                              <td key={`${row.escala}-${programmingReport.meses[i]?.mes ?? i}`} className="px-3 py-2 text-right font-semibold tabular-nums">
                                {cantidad.toLocaleString('es-AR')}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-bold tabular-nums">
                              {row.total.toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                    Vuelos en mismo minuto
                  </h3>
                  <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-[color:var(--color-line)]">
                    {programmingReport.vuelosMismoMinuto.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[color:var(--color-muted)]">
                        No se detectaron vuelos en mismo minuto con los datos cargados.
                      </p>
                    ) : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Día</th>
                            <th className="px-3 py-2 font-semibold">Escala</th>
                            <th className="px-3 py-2 font-semibold">ETD</th>
                            <th className="px-3 py-2 text-right font-semibold">Vuelos</th>
                            <th className="px-3 py-2 font-semibold">Nº de vuelo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programmingReport.vuelosMismoMinuto.map((row) => (
                            <tr
                              key={`${row.fecha}-${row.escala}-${row.etd}`}
                              className="border-t border-[color:var(--color-line)]"
                            >
                              <td className="px-3 py-2">{row.fecha}</td>
                              <td className="px-3 py-2 font-mono font-semibold">{row.escala}</td>
                              <td className="px-3 py-2 font-semibold">{row.etd}</td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums">
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
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                    Horas extra ITC
                  </h3>
                  <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-[color:var(--color-line)]">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-[color:var(--color-surface)] text-[color:var(--color-muted)] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Escala</th>
                          <th className="px-3 py-2 font-semibold">Nº de vuelo</th>
                          <th className="px-3 py-2 font-semibold">ETD</th>
                          <th className="px-3 py-2 font-semibold">Cantidad de extras generadas</th>
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
                              className="border-t border-[color:var(--color-line)]"
                            >
                              <td className="px-3 py-2">{row.fecha}</td>
                              <td className="px-3 py-2 font-mono font-semibold">{row.escala}</td>
                              <td className="px-3 py-2 font-mono font-semibold">{row.vuelo}</td>
                              <td className="px-3 py-2 font-semibold">{row.etd}</td>
                              <td className="px-3 py-2 font-semibold">{row.extrasTexto}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-20 bg-[color:var(--color-surface)] font-bold shadow-[0_-6px_16px_-4px_rgba(0,0,0,0.08)]">
                        <tr>
                          <td colSpan={4} className="border-t-2 border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-3">
                            Horas totales generadas
                          </td>
                          <td className="border-t-2 border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-3 font-semibold tabular-nums">
                            {programmingReport.extrasItcTotalTexto}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-3">
                            Costo aprox
                          </td>
                          <td className="border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-3 font-semibold tabular-nums">
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
                    <h4 className="text-sm font-bold text-[color:var(--color-ink)]">Ranking por escala</h4>
                    <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-[color:var(--color-line)]">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
                          <tr>
                            <th className="px-3 py-2 font-semibold">#</th>
                            <th className="px-3 py-2 font-semibold">Escala</th>
                            {programmingReport.meses.map((m) => (
                              <th
                                key={m.mes}
                                className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold capitalize"
                                title={m.etiqueta}
                              >
                                {m.etiqueta}
                                <span className="block font-normal normal-case text-[10px] text-[color:var(--color-muted)]">
                                  (h)
                                </span>
                              </th>
                            ))}
                            <th className="px-3 py-2 text-right font-semibold">Total extra</th>
                            <th className="px-3 py-2 text-right font-semibold">Costo aprox</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programmingReport.rankingExtrasItcPorEscala.map((row) => (
                            <tr key={row.escala} className="border-t border-[color:var(--color-line)]">
                              <td className="px-3 py-2 tabular-nums text-[color:var(--color-muted)]">
                                {row.posicion}
                              </td>
                              <td className="px-3 py-2 font-mono font-semibold">{row.escala}</td>
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
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.texto}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
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
                  <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)]/40 p-4 md:max-w-md">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                      Equipamiento
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm font-medium">
                      <li className="flex justify-between gap-4">
                        <span>320</span>
                        <span className="tabular-nums font-bold">
                          {programmingReport.equipamiento.c320.toLocaleString('es-AR')}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4">
                        <span>321</span>
                        <span className="tabular-nums font-bold">
                          {programmingReport.equipamiento.c321.toLocaleString('es-AR')}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[color:var(--color-muted)]">
                        <span>Otros / no clasificado</span>
                        <span className="tabular-nums font-semibold">
                          {programmingReport.equipamiento.cotro.toLocaleString('es-AR')}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                    Simultaneidad alta
                  </h3>
                  <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-[color:var(--color-line)]">
                    {programmingReport.simultaneidadMasCuatro.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[color:var(--color-muted)]">
                        No hay franjas con más de 4 vuelos simultáneos en la misma hora, día y escala.
                      </p>
                    ) : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Fecha</th>
                            <th className="px-3 py-2 font-semibold">Escala</th>
                            <th className="px-3 py-2 font-semibold">Franja (hora local)</th>
                            <th className="px-3 py-2 text-right font-semibold">Vuelos</th>
                            <th className="px-3 py-2 font-semibold">Nº de vuelo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programmingReport.simultaneidadMasCuatro.map((row, i) => (
                            <tr
                              key={`${row.fecha}-${row.escala}-${row.franjaHoraria}-${i}`}
                              className="border-t border-[color:var(--color-line)]"
                            >
                              <td className="px-3 py-2">{row.fecha}</td>
                              <td className="px-3 py-2 font-mono font-semibold">{row.escala}</td>
                              <td className="px-3 py-2 font-semibold">{row.franjaHoraria}</td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums">
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
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] py-6 text-center text-xs text-[color:var(--color-muted)]">
        Herramienta interna · datos procesados solo en el navegador
      </footer>
    </div>
  )
}
