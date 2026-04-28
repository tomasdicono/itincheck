import type { ColumnKey, ColumnMapping } from '../types/columns'

const PATTERNS: Record<ColumnKey, RegExp[]> = {
  fecha: [/effective\s*from/i, /fecha/i, /date/i, /^d[ií]a$/i, /day/i],
  aeropuerto: [/departure\s*station/i, /aeropuerto/i, /airport/i, /apt/i, /^iata$/i, /arpt/i, /estación/i],
  handler: [/handler/i, /^itc$/i, /proveedor/i, /ramp/i, /ground/i],
  hora_inicio: [/^etd$/i, /inicio/i, /etd/i, /^std$/i, /salida/i, /from/i, /bloque.*ini/i],
  hora_fin: [/^eta$/i, /fin\b/i, /eta/i, /^sta$/i, /llegada/i, /to$/i, /bloque.*fin/i],
  vuelo: [/flight\s*number/i, /vuelo/i, /flight/i, /^fn$/i, /^flt$/i],
}

export function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<string>()
  const out: ColumnMapping = {}

  const keys = Object.keys(PATTERNS) as ColumnKey[]
  for (const key of keys) {
    for (const h of headers) {
      if (used.has(h)) continue
      if (PATTERNS[key].some((re) => re.test(h))) {
        out[key] = h
        used.add(h)
        break
      }
    }
  }
  return out
}
