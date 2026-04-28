import { ALL_RULES } from './registry'
import type { EvaluationInput, Violation } from './types'

export type RuleToggleState = Record<string, { enabled: boolean; configJson: string }>

export function evaluateRules(
  input: EvaluationInput,
  toggles: RuleToggleState,
): Violation[] {
  const violations: Violation[] = []

  for (const rule of ALL_RULES) {
    const t = toggles[rule.id]
    if (t && !t.enabled) continue
    let config = rule.defaultConfig
    const raw = t?.configJson?.trim()
    if (raw) {
      try {
        config = JSON.parse(raw) as typeof config
      } catch {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: 'error',
          message: `Configuración JSON inválida para la regla "${rule.name}".`,
        })
        continue
      }
    }
    violations.push(...rule.evaluate(input, config))
  }

  return violations
}
