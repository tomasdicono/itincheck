import { airportHoursRule } from './airportHours'
import { handlerHoursRule } from './handlerHours'
import { simultaneityRule } from './simultaneity'
import type { OperationalRule } from './types'

/**
 * Registro central de reglas. Para agregar una nueva regla operacional:
 * 1. Creá un archivo en `src/rules/` que exporte un `OperationalRule`.
 * 2. Importala aquí y sumala a `ALL_RULES`.
 */
export const ALL_RULES: OperationalRule[] = [
  airportHoursRule,
  handlerHoursRule,
  simultaneityRule,
]

export type RuleId = (typeof ALL_RULES)[number]['id']

export function getRuleById(id: string): OperationalRule | undefined {
  return ALL_RULES.find((r) => r.id === id)
}
