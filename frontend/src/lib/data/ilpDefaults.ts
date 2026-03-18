/**
 * EEC (Early Exit Charge) rate tables and default constants for ILP policies.
 *
 * EEC tables are insurer-specific. These presets are examples users can start
 * from and then edit to match their actual policy schedule.
 */

/** EEC rate by policy year. Index 0 = policy year 1. */
export const EEC_PRESET_MIP_25: readonly number[] = [
  1.0, 0.94, 0.93, 0.92, 0.91,
  0.9, 0.89, 0.88, 0.86, 0.82,
  0.78, 0.74, 0.7, 0.65, 0.58,
  0.48, 0.4, 0.32, 0.26, 0.23,
  0.2, 0.18, 0.15, 0.12, 0.08,
] as const

/** EEC rate by policy year. Index 0 = policy year 1. */
export const EEC_PRESET_MIP_30: readonly number[] = [
  1.0, 0.99, 0.98, 0.97, 0.96,
  0.95, 0.94, 0.93, 0.92, 0.91,
  0.9, 0.89, 0.75, 0.68, 0.58,
  0.48, 0.4, 0.32, 0.26, 0.24,
  0.22, 0.2, 0.19, 0.18, 0.17,
  0.16, 0.15, 0.13, 0.1, 0.08,
] as const

export const EEC_PRESETS = {
  'MIP-25 (common)': [...EEC_PRESET_MIP_25],
  'MIP-30 (common)': [...EEC_PRESET_MIP_30],
} as const

/**
 * Look up EEC rate from a per-policy table.
 * Index 0 = policy year 1. Past the end of the table = 0% (post-MIP).
 */
export function lookupEecRate(policyYear: number, eecTable: readonly number[]): number {
  if (policyYear < 1) return 1
  const index = policyYear - 1
  if (index >= eecTable.length) return 0
  return eecTable[index] ?? 0
}

export const DEFAULT_IUA_FEE_RATE = 0.035
export const DEFAULT_AUA_FEE_RATE = 0.01
export const DEFAULT_POWER_UP_RATE = 0.0125
export const DEFAULT_POWER_UP_START_PY = 15
export const DEFAULT_POWER_UP_END_PY = 25
export const DEFAULT_LOYALTY_RATE = 0.011
export const DEFAULT_LOYALTY_START_PY = 30
export const DEFAULT_MIP_LENGTH = 30
export const DEFAULT_DISCOUNT_RATE = 0.07
export const DEFAULT_INFLATION_RATE = 0.025
export const DEFAULT_ALTERNATIVE_RETURN = 0.07
