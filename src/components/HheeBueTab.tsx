import { useCallback, useMemo, useState } from 'react'
import { parseExcelFileAbsoluteRaw } from '../lib/parseExcel'
import { buildHheeBueReport, formatHheeMinutes, type HheeBueReport } from '../lib/hheeBueReport'

const horasFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function colLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function HheeBueTab() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [report, setReport] = useState<HheeBueReport | null>(null)
  const [rowCount, setRowCount] = useState(0)

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      const { rawMatrix, rowCount: n } = await parseExcelFileAbsoluteRaw(file)
      const built = buildHheeBueReport(rawMatrix)
      if (!built) {
        setError('El archivo no tiene filas para analizar.')
        setReport(null)
        setFileName(null)
        setRowCount(0)
        return
      }
      setFileName(file.name)
      setRowCount(n)
      setReport(built)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel.')
      setReport(null)
      setFileName(null)
      setRowCount(0)
    }
  }, [])

  const inputId = useMemo(() => 'hhee-bue-file-input', [])
  const d = report?.diagnostics

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-black tracking-tight text-[color:var(--color-ink)]">HH:EE BUE</h2>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--color-muted)]">
          Subí el Excel de vuelos operados del mes. Se computan como horas extras las demoras de{' '}
          <strong className="font-semibold text-[color:var(--color-ink)]">45 minutos o más</strong> (demora
          completa) en salidas (STD→ATD) y arribos (STA→ATA) en AEP y EZE, según contrato Swissport.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            document.getElementById(inputId)?.click()
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
        onClick={() => document.getElementById(inputId)?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
          drag
            ? 'border-[color:var(--color-brand-celeste)] bg-[color:var(--color-brand-glow)]'
            : 'border-[color:var(--color-line)] bg-[color:var(--color-page)]/60 hover:border-[color:var(--color-brand-celeste)]/45'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
        <p className="text-base font-black text-[color:var(--color-ink)]">Subí vuelos operados</p>
        <p className="mt-2 max-w-md text-sm text-[color:var(--color-muted)]">
          Origen G · Arribo H · STD Z · STA AA · ATD AE · ATA AG (o por nombre de encabezado)
        </p>
        {fileName ? (
          <p className="mt-4 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[color:var(--color-ink)] ring-1 ring-[color:var(--color-line)]">
            {fileName} · {rowCount} filas
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {error}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--color-table-head)] text-[color:var(--color-ink)]">
                <tr>
                  <th className="px-4 py-3 font-black">Concepto</th>
                  <th className="px-4 py-3 text-right font-black">Vuelos ≥45 min</th>
                  <th className="px-4 py-3 text-right font-black">Horas</th>
                  <th className="px-4 py-3 text-right font-black">HH:EE</th>
                </tr>
              </thead>
              <tbody>
                {report.lineas.map((line) => (
                  <tr key={line.key} className="border-t border-[color:var(--color-line)]">
                    <td className="px-4 py-3 font-semibold text-[color:var(--color-ink)]">{line.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[color:var(--color-muted)]">
                      {line.vuelos}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[color:var(--color-ink)]">
                      {horasFmt.format(line.horas)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-[color:var(--color-ink)]">
                      {formatHheeMinutes(line.minutos)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[color:var(--color-brand-teal)]/40 bg-[color:var(--color-brand-glow)]/50">
                  <td className="px-4 py-3 font-black text-[color:var(--color-ink)]">TOTAL HHEE</td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-[color:var(--color-ink)]">
                    {report.totalVuelos}
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-[color:var(--color-ink)]">
                    {horasFmt.format(report.totalHoras)}
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-[color:var(--color-ink)]">
                    {formatHheeMinutes(report.totalMinutos)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {d ? (
            <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-page)]/70 px-4 py-3 text-xs text-[color:var(--color-muted)]">
              <p className="font-bold text-[color:var(--color-ink)]">Diagnóstico de lectura</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  Columnas ({d.columnas.fuente}): origen {colLetter(d.columnas.origen)}, arribo{' '}
                  {colLetter(d.columnas.arribo)}, STD {colLetter(d.columnas.std)}, STA{' '}
                  {colLetter(d.columnas.sta)}, ATD {colLetter(d.columnas.atd)}, ATA{' '}
                  {colLetter(d.columnas.ata)}
                </li>
                <li>
                  Filas con origen/arribo: {d.filasConOrigenOArribo} · DEP BUE: {d.filasBueDep} · ARR BUE:{' '}
                  {d.filasBueArr}
                </li>
                <li>
                  Demoras parseadas DEP/ARR: {d.demorasDepParseadas}/{d.demorasArrParseadas} · ≥45 min:{' '}
                  {d.demorasDepSobreUmbral}/{d.demorasArrSobreUmbral}
                </li>
                {d.muestra ? (
                  <li>
                    Muestra BUE → {d.muestra.origen}→{d.muestra.arribo} · STD {d.muestra.std} / ATD{' '}
                    {d.muestra.atd}
                    {d.muestra.demoraDepMin != null ? ` (${d.muestra.demoraDepMin} min)` : ' (sin demora DEP)'} ·
                    STA {d.muestra.sta} / ATA {d.muestra.ata}
                    {d.muestra.demoraArrMin != null ? ` (${d.muestra.demoraArrMin} min)` : ' (sin demora ARR)'}
                  </li>
                ) : (
                  <li>No se encontró ninguna fila con origen/arribo AEP o EZE en las columnas usadas.</li>
                )}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
