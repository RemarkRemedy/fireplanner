import { toFiniteNumber, MIN_COMPANION_RETIREMENT_AGE } from './utils'

export interface CompanionScenarioOverrides {
  monthlyExpenseDelta?: number
  retirementAge?: number
}

export interface CompanionScenario {
  id: string
  name: string
  overrides: CompanionScenarioOverrides
}

export function createCompanionScenarios(baseRetirementAge: number): CompanionScenario[] {
  return [
    { id: 'base', name: 'Base', overrides: {} },
    { id: 'cut-300', name: 'Cut $300/mo', overrides: { monthlyExpenseDelta: -300 } },
    { id: 'boost-500', name: 'Boost Savings $500/mo', overrides: { monthlyExpenseDelta: -500 } },
    { id: 'retire-5-earlier', name: 'Retire 5 years earlier', overrides: { retirementAge: Math.max(MIN_COMPANION_RETIREMENT_AGE, Math.round(baseRetirementAge - 5)) } },
    { id: 'conservative-spending', name: 'Conservative spending', overrides: { monthlyExpenseDelta: -1000 } },
  ]
}

export function resolveScenarioInputs(input: {
  baseAnnualExpenses: number
  baseRetirementAge: number
  overrides: CompanionScenarioOverrides
  minRetirementAge?: number
  maxRetirementAge?: number
}): { annualExpenses: number; retirementAge: number } {
  const { baseAnnualExpenses, baseRetirementAge, overrides } = input
  const monthlyDelta = toFiniteNumber(overrides.monthlyExpenseDelta) ?? 0
  const annualExpenses = Math.max(0, baseAnnualExpenses + monthlyDelta * 12)
  const minRetirementAge = Math.max(MIN_COMPANION_RETIREMENT_AGE, Math.round(toFiniteNumber(input.minRetirementAge) ?? MIN_COMPANION_RETIREMENT_AGE))
  const maxRetirementAgeRaw = toFiniteNumber(input.maxRetirementAge)
  const maxRetirementAge = maxRetirementAgeRaw == null
    ? Number.POSITIVE_INFINITY
    : Math.max(minRetirementAge, Math.round(maxRetirementAgeRaw))
  const rawRetirementAge = Math.round(toFiniteNumber(overrides.retirementAge) ?? baseRetirementAge)
  const retirementAge = Math.min(maxRetirementAge, Math.max(minRetirementAge, rawRetirementAge))
  return { annualExpenses, retirementAge }
}
