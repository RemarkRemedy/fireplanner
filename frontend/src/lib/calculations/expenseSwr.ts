import type { RetirementExpenseItem } from '@/lib/types'

/**
 * Calculate the FIRE number for a single retirement expense item.
 *
 * - Lifetime items (no endAge, or endAge >= lifeExpectancy): perpetuity = amount / swr
 * - Fixed-term items (endAge < lifeExpectancy): PV of annuity = amount * (1 - (1+r)^-n) / r
 *   where r = netRealReturn and n = min(endAge, lifeExpectancy) - retirementAge
 *
 * All values in REAL TERMS (today's dollars). netRealReturn = expectedReturn - inflation - fees.
 */
export function calculateItemFireNumber(
  item: RetirementExpenseItem,
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number,
): number {
  if (item.annualAmount <= 0 || item.swr <= 0) return 0

  const isLifetime = item.endAge == null || item.endAge >= lifeExpectancy
  const years = isLifetime ? 0 : Math.max(0, item.endAge! - retirementAge)

  if (isLifetime) {
    // Perpetuity: FIRE number = annual amount / item-specific SWR
    return item.annualAmount / item.swr
  }

  // Fixed-term: PV of annuity
  if (years <= 0) return 0

  if (Math.abs(netRealReturn) < 1e-10) {
    // r ~= 0: PV annuity = amount * n
    return item.annualAmount * years
  }

  const r = netRealReturn
  return item.annualAmount * (1 - Math.pow(1 + r, -years)) / r
}

/**
 * Calculate the blended FIRE number: sum of per-item FIRE numbers.
 * Each item may use a different SWR and duration.
 */
export function calculateBlendedFireNumber(
  items: RetirementExpenseItem[],
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number,
): number {
  let total = 0
  for (const item of items) {
    total += calculateItemFireNumber(item, retirementAge, lifeExpectancy, netRealReturn)
  }
  return total
}

/**
 * Calculate the blended SWR: totalAnnualExpenses / blendedFireNumber.
 * Returns 0 if the blended FIRE number is 0 (no items or all zero).
 */
export function calculateBlendedSwr(
  items: RetirementExpenseItem[],
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number,
): number {
  const blendedFire = calculateBlendedFireNumber(items, retirementAge, lifeExpectancy, netRealReturn)
  if (blendedFire <= 0) return 0
  const totalExpenses = items.reduce((sum, item) => sum + Math.max(0, item.annualAmount), 0)
  return totalExpenses / blendedFire
}
