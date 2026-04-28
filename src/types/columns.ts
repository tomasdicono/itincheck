/** Semantic columns the rules engine understands (map Excel headers to these). */
export type ColumnKey =
  | 'fecha'
  | 'aeropuerto'
  | 'handler'
  | 'hora_inicio'
  | 'hora_fin'
  | 'vuelo'

export type ColumnMapping = Partial<Record<ColumnKey, string>>

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  fecha: 'Fecha de operación',
  aeropuerto: 'Aeropuerto (IATA)',
  handler: 'Handler / ITC',
  hora_inicio: 'Inicio de servicio (ETD / inicio)',
  hora_fin: 'Fin de servicio (ETA / fin)',
  vuelo: 'Nº de vuelo (referencia)',
}
