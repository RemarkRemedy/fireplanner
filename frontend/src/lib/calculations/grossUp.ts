import { getCpfRatesForAge, OW_CEILING_MONTHLY } from '@/lib/data/cpfRates'

/**
 * Estimate gross monthly salary from take-home pay by reversing
 * the CPF employee contribution. Uses getCpfRatesForAge() to look
 * up the correct employee rate by age bracket (assumes citizen;
 * PR Year 3+ uses identical rates).
 *
 * For high earners above the OW ceiling ($8,000/mo), CPF is capped
 * at ceiling × rate, so the gross-up formula changes.
 */
export function grossUpFromTakeHome(takeHome: number, age: number): number {
  if (takeHome <= 0) return 0

  const { employeeRate } = getCpfRatesForAge(age)
  const ceilingCpf = OW_CEILING_MONTHLY * employeeRate
  const ceilingTakeHome = OW_CEILING_MONTHLY - ceilingCpf

  if (takeHome > ceilingTakeHome) {
    return takeHome + ceilingCpf
  }
  return takeHome / (1 - employeeRate)
}

/**
 * Convert gross monthly salary to take-home by applying the CPF
 * employee deduction. Inverse of grossUpFromTakeHome.
 */
export function netDownFromGross(gross: number, age: number): number {
  if (gross <= 0) return 0

  const { employeeRate } = getCpfRatesForAge(age)

  if (gross > OW_CEILING_MONTHLY) {
    return gross - OW_CEILING_MONTHLY * employeeRate
  }
  return gross * (1 - employeeRate)
}

/**
 * Get the CPF employee rate as a display label (e.g., "20%").
 */
export function getCpfEmployeeRateLabel(age: number): string {
  const { employeeRate } = getCpfRatesForAge(age)
  const pct = employeeRate * 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct}%`
}

/**
 * Check if the take-home implies a gross above the OW ceiling.
 */
export function isAboveOwCeiling(takeHome: number, age: number): boolean {
  const { employeeRate } = getCpfRatesForAge(age)
  return takeHome > OW_CEILING_MONTHLY * (1 - employeeRate)
}
