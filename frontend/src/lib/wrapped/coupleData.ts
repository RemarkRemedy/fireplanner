import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { AdultOwner, PlanningAdult } from '@/lib/household/types'
import { sumActiveExpensesByOwner, sumActiveIncomeByOwner } from '@/lib/household/breakdownUtils'

/**
 * Compute total household income across both adults: self + partner + shared.
 */
export function computeHouseholdIncome(
  compiledPlan: CompiledHouseholdPlan,
): number {
  return sumActiveIncomeByOwner(compiledPlan, 'self')
    + sumActiveIncomeByOwner(compiledPlan, 'partner')
    + sumActiveIncomeByOwner(compiledPlan, 'shared')
}

export interface CoupleDetection {
  isCoupleMode: boolean
  selfAdult: PlanningAdult | undefined
  partnerAdult: PlanningAdult | undefined
}

/**
 * Detect whether the plan is in couple mode based on the adults array.
 * A stub partner (currentAge === 0) does not count as a real partner.
 */
export function detectCoupleMode(adults: PlanningAdult[]): CoupleDetection {
  const selfAdult = adults.find((a) => a.owner === 'self')
  const partnerAdult = adults.find((a) => a.owner === 'partner')
  const isCoupleMode = partnerAdult !== undefined && partnerAdult.currentAge > 0
  return { isCoupleMode, selfAdult, partnerAdult }
}

/**
 * Compute total net worth for one adult: liquid + CPF + property equity.
 *
 * CPF: Sum of OA + SA + MA + RA from the first row of the adult's CPF projection.
 * Property: For each property owned by this adult, add (value - mortgage) * ownershipPercent.
 */
export function computePerAdultNetWorth(
  adult: PlanningAdult,
  compiledPlan: CompiledHouseholdPlan,
): number {
  // Liquid net worth
  let total = adult.liquidNetWorth

  // CPF balances from first projection row
  const cpfSlot = compiledPlan.cpfByAdultId[adult.id]
  if (cpfSlot && cpfSlot.rows.length > 0) {
    const row = cpfSlot.rows[0]
    total += row.oaBalance + row.saBalance + row.maBalance + row.raBalance
  }

  // Property equity: ownershipPercent already represents the per-person share
  // (defaults to 0.5 for shared properties, 1.0 for owned — see assetPropertyDefaults.ts)
  for (const propertyId of compiledPlan.propertyOrder) {
    const prop = compiledPlan.propertiesById[propertyId]
    if (!prop || !prop.ownsProperty) continue
    const isOwned = prop.owner === adult.owner
    const isShared = prop.owner === 'shared'
    if (!isOwned && !isShared) continue
    const equity = Math.max(0, prop.existingPropertyValue - prop.existingMortgageBalance)
    const ownershipShare = prop.ownershipPercent ?? 1
    total += equity * ownershipShare
  }

  return total
}

/**
 * Compute annual savings allocated to one adult:
 *   (owned income + 50% shared income) - (owned expenses + 50% shared expenses)
 *
 * The 50% split of shared items is an allocation for display purposes. Calling
 * this for both 'self' and 'partner' then summing gives the correct household
 * total (100% of shared items are captured across both calls).
 *
 * Uses the real breakdownUtils functions which account for timing windows,
 * dependents, healthcare, and property costs.
 */
export function computePerAdultSavings(
  compiledPlan: CompiledHouseholdPlan,
  owner: AdultOwner,
): number {
  const ownedIncome = sumActiveIncomeByOwner(compiledPlan, owner)
  const sharedIncome = sumActiveIncomeByOwner(compiledPlan, 'shared')
  const ownedExpenses = sumActiveExpensesByOwner(compiledPlan, owner)
  const sharedExpenses = sumActiveExpensesByOwner(compiledPlan, 'shared')

  return (ownedIncome + sharedIncome * 0.5) - (ownedExpenses + sharedExpenses * 0.5)
}
