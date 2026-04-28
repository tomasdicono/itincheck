import type { ColumnMapping } from '../types/columns'

export type ViolationSeverity = 'error' | 'warning'

export type Violation = {
  ruleId: string
  ruleName: string
  severity: ViolationSeverity
  message: string
  rowIndex?: number
  flight?: string
}

export type DayWindow = { open: string; close: string }

export type RuleMeta = {
  id: string
  name: string
  description: string
}

export type EvaluationInput = {
  headers: string[]
  rows: Record<string, unknown>[]
  mapping: ColumnMapping
}

export type OperationalRule = RuleMeta & {
  defaultConfig: unknown
  evaluate: (input: EvaluationInput, config: unknown) => Violation[]
}

export function getCell(
  row: Record<string, unknown>,
  mapping: ColumnMapping,
  key: keyof ColumnMapping,
): unknown {
  const col = mapping[key]
  if (!col) return undefined
  return row[col]
}
