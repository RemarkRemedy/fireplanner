/**
 * Computation hook that enriches goal calculator results with V1.5 SG intelligence.
 *
 * Computes CPF OA accumulation, housing grants, loan qualification,
 * freedom age impact, peer benchmarks, and other SG-specific insights
 * for each goal and across all goals.
 *
 * This IS a hook because it uses useMemo. The heavy lifting is in the
 * pure function `computeGoalStoryData` (exported for direct testing).
 */

import { useMemo } from 'react'
import type {
  GoalCalcBasics,
  GoalCalcGoal,
  SmartGoalInputs,
  StackedGoalResult,
} from '@/lib/calculations/goal-calculator'
import {
  computeMultiGoalStacking,
  computeRetirementImpact,
  computeMonthlySavingsNeeded,
  computeMonthlyLoanPayment,
  FIRE_MULTIPLIER,
} from '@/lib/calculations/goal-calculator'
import {
  accumulateCpfOa,
  deriveCpfOaMonthly,
  estimateHousingGrant,
  checkLoanQualification,
  lookupCpfLifeEstimate,
  getEmergencyFundFloor,
  getPeerBenchmark,
  estimateIncomeTax,
  getParkingRecommendation,
} from '@/lib/calculations/goal-calculator-sg'
import type { LoanQualification } from '@/lib/calculations/goal-calculator-sg'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import {
  HDB_INCOME_CEILING,
  EC_INCOME_CEILING,
  MORTGAGE_RATES,
  computeCondoDownPayment,
} from '@/lib/data/goal-defaults'
import type { GoalCardConfig } from '@/lib/wrapped/goalGradients'
import { buildGoalCardSequence } from '@/lib/wrapped/goalGradients'

// ============================================================
// Types
// ============================================================

/** Extended basics with optional V1.5 fields for couple mode and gross income. */
export interface GoalStoryBasics extends GoalCalcBasics {
  grossIncome?: number
  partnerAge?: number
  partnerMonthlyIncome?: number
  partnerGrossIncome?: number
}

export interface EnrichedGoal {
  goal: GoalCalcGoal
  cpfOaAccumulated: number
  grantAmount: number
  loanQualification: LoanQualification | null
  cashNeeded: number
  adjustedMonthlySavings: number
  /** Monthly mortgage or HP payment (0 for non-financed goals). */
  monthlyLoanPayment: number
}

export interface SharedInsights {
  monthlySavings: number
  freedomAge: number
  freedomAgeWithout: number
  cpfLifeMonthly: number
  emergencyFund: number
  emergencyFundGap: number
  peerBenchmark: string
  incomeTaxMonthly: number
  incomeCeilingWarning: string | null
  parkingRecommendation: string
  isCoupleMode: boolean
}

export interface GoalStoryData {
  perGoal: EnrichedGoal[]
  shared: SharedInsights
  storyCards: GoalCardConfig[]
}

// ============================================================
// Helpers
// ============================================================

function isPropertyGoal(goal: GoalCalcGoal): boolean {
  return goal.category === 'housing'
}

function isHdbGoal(goal: GoalCalcGoal): boolean {
  return goal.smartInputs?.kind === 'hdb'
}

function isCondoGoal(goal: GoalCalcGoal): boolean {
  return goal.smartInputs?.kind === 'condo'
}

function isLandedGoal(goal: GoalCalcGoal): boolean {
  return goal.smartInputs?.kind === 'landed'
}

function isEcGoal(goal: GoalCalcGoal): boolean {
  return goal.smartInputs?.kind === 'ec'
}

function getPropertyType(inputs: SmartGoalInputs): 'hdb' | 'condo' | 'landed' | 'ec' {
  switch (inputs.kind) {
    case 'hdb': return 'hdb'
    case 'condo': return 'condo'
    case 'landed': return 'landed'
    case 'ec': return 'ec'
    default: return 'condo'
  }
}

function getMortgageRate(inputs: SmartGoalInputs): number {
  if (inputs.kind === 'hdb') {
    return inputs.loanType === 'hdb-loan' ? MORTGAGE_RATES.hdb : MORTGAGE_RATES.bank
  }
  return MORTGAGE_RATES.bank
}

function getLtvRatio(inputs: SmartGoalInputs): number {
  if (inputs.kind === 'hdb') {
    return inputs.loanType === 'hdb-loan' ? 0.90 : 0.75
  }
  // Condo/landed/EC: bank loan only, 75% LTV
  return 0.75
}

function getPropertyPrice(goal: GoalCalcGoal): number {
  if (!goal.smartInputs) return goal.totalCostToday
  switch (goal.smartInputs.kind) {
    case 'hdb': return goal.smartInputs.priceOverride ?? goal.totalCostToday
    case 'condo': return goal.smartInputs.price
    case 'landed': return goal.smartInputs.price
    case 'ec': return goal.smartInputs.price
    default: return goal.totalCostToday
  }
}

/** Find the shortest time horizon across all goals (for parking recommendation). */
function getMinYearsToGoal(goals: GoalCalcGoal[], age: number): number {
  if (goals.length === 0) return 5
  return Math.max(0, Math.min(...goals.map((g) => g.targetAge - age)))
}

// ============================================================
// Pure computation (exported for testing)
// ============================================================

export function computeGoalStoryData(
  basics: GoalStoryBasics,
  goals: GoalCalcGoal[],
): GoalStoryData {
  // 0. Sort goals by target age (earliest first) for correct stacking priority
  const sortedGoals = [...goals].sort((a, b) => a.targetAge - b.targetAge)

  // 1. Derive gross income
  const grossIncome = basics.grossIncome ?? grossUpFromTakeHome(basics.monthlyIncome, basics.age)

  // 2. Couple mode
  const isCoupleMode = basics.partnerAge != null
  const partnerGross = isCoupleMode
    ? (basics.partnerGrossIncome ?? grossUpFromTakeHome(basics.partnerMonthlyIncome ?? 0, basics.partnerAge!))
    : 0

  // 3. Household values
  const householdGross = grossIncome + partnerGross

  // 4. Emergency fund — reserve before goal allocation
  const emergencyFund = getEmergencyFundFloor(basics.monthlyExpenses)
  const emergencyFundGap = Math.max(0, emergencyFund - basics.existingSavings)
  const savingsAfterEmergency = Math.max(0, basics.existingSavings - emergencyFund)

  // 5. Run stacked computation with emergency fund reserved
  const stackingBasics = { ...basics, existingSavings: savingsAfterEmergency }
  const stacked = computeMultiGoalStacking(sortedGoals, stackingBasics)

  // Build a lookup from goal id -> stacked result
  const stackedById = new Map<string, StackedGoalResult>()
  for (const sr of stacked) {
    stackedById.set(sr.goal.id, sr)
  }

  // 6. Enrich each goal
  const hasAnyPropertyGoal = sortedGoals.some(isPropertyGoal)
  const hasAnyHdbGoal = sortedGoals.some(isHdbGoal)
  const hasAnyEcGoal = sortedGoals.some(isEcGoal)

  const perGoal: EnrichedGoal[] = sortedGoals.map((goal) => {
    const monthsToGoal = Math.max(0, (goal.targetAge - basics.age) * 12)
    const stackedResult = stackedById.get(goal.id)

    // CPF OA accumulation
    let cpfOaAccumulated = accumulateCpfOa(grossIncome, basics.age, monthsToGoal)
    if (isCoupleMode) {
      cpfOaAccumulated += accumulateCpfOa(partnerGross, basics.partnerAge!, monthsToGoal)
    }

    // Grant (HDB and EC goals)
    let grantAmount = 0
    if (isHdbGoal(goal) && goal.smartInputs?.kind === 'hdb') {
      grantAmount = estimateHousingGrant(
        householdGross,
        goal.smartInputs.flatType,
        goal.smartInputs.tenure,
        !isCoupleMode,
      )
    }
    // EC goals: Family Grant only (no EHG)
    if (isEcGoal(goal) && goal.smartInputs?.kind === 'ec') {
      grantAmount = estimateHousingGrant(
        householdGross,
        goal.smartInputs.flatType,
        'new',  // tenure is ignored for EC path
        !isCoupleMode,
        'ec',   // triggers EC path: Family Grant only, no EHG
      )
    }

    // Loan qualification (only for property goals)
    let loanQualification: LoanQualification | null = null
    if (goal.smartInputs && isPropertyGoal(goal)) {
      const price = getPropertyPrice(goal)
      const ltv = getLtvRatio(goal.smartInputs)
      const loanNeeded = price * ltv
      const rate = getMortgageRate(goal.smartInputs)
      const propertyType = getPropertyType(goal.smartInputs)

      loanQualification = checkLoanQualification(
        householdGross,
        loanNeeded,
        rate,
        25,
        propertyType,
      )
    }

    // Cash needed (for upfront costs only — CPF OA and grants reduce what you save in cash)
    let cashNeeded = goal.breakdown.total - cpfOaAccumulated - grantAmount
    // For condos, landed, and EC enforce 5% cash floor (bank loan only, no CPF for 5%)
    if (isCondoGoal(goal) || isLandedGoal(goal) || isEcGoal(goal)) {
      const price = getPropertyPrice(goal)
      const cashMinimum = computeCondoDownPayment(price).cashMinimum
      cashNeeded = Math.max(cashMinimum, cashNeeded)
    }
    cashNeeded = Math.max(0, cashNeeded)

    // Monthly loan payment (mortgage or car HP)
    const monthlyLoanPayment = computeMonthlyLoanPayment(goal)

    // For property goals, recompute monthly savings based on cash needed (not full upfront cost).
    // CPF OA covers part of the down payment, so cash savings target is lower.
    let adjustedMonthlySavings = stackedResult?.adjustedMonthlySavings ?? goal.monthlySavingsNeeded
    if (isPropertyGoal(goal) && stackedResult) {
      const years = goal.targetAge - basics.age
      const effectiveAllocated = Math.min(stackedResult.allocatedSavings, cashNeeded)
      adjustedMonthlySavings = computeMonthlySavingsNeeded(cashNeeded, effectiveAllocated, years)
    }

    return {
      goal,
      cpfOaAccumulated,
      grantAmount,
      loanQualification,
      cashNeeded,
      adjustedMonthlySavings,
      monthlyLoanPayment,
    }
  })

  // 7. Shared insights
  // Use cash-based monthly savings from enriched data (accounts for CPF OA offset on housing)
  const totalMonthlySavings = perGoal.reduce((sum, eg) => sum + eg.adjustedMonthlySavings, 0)
  const totalAllocatedSavings = stacked.reduce((sum, sr) => sum + sr.allocatedSavings, 0)

  // Monthly loan payments reduce savings capacity for Freedom Age.
  // For housing: CPF OA monthly contribution covers part of the mortgage,
  // so only the net cash portion affects cash savings.
  const cpfOaMonthly = deriveCpfOaMonthly(grossIncome, basics.age)
    + (isCoupleMode ? deriveCpfOaMonthly(partnerGross, basics.partnerAge!) : 0)
  const totalMonthlyLoanPayments = perGoal.reduce((sum, eg) => {
    if (eg.monthlyLoanPayment <= 0) return sum
    if (isPropertyGoal(eg.goal)) {
      // CPF OA monthly contribution offsets part of the mortgage
      return sum + Math.max(0, eg.monthlyLoanPayment - cpfOaMonthly)
    }
    // Car HP: fully cash
    return sum + eg.monthlyLoanPayment
  }, 0)

  // CPF LIFE
  const cpfLifeMonthly = lookupCpfLifeEstimate(grossIncome)
  const cpfLifeAnnual = cpfLifeMonthly * 12
  const cpfLifeOffset = cpfLifeAnnual * FIRE_MULTIPLIER

  // Freedom age — include both savings for upfront costs AND ongoing loan payments
  const totalDeductionFromSavings = totalMonthlySavings + totalMonthlyLoanPayments
  const impact = computeRetirementImpact(basics, totalDeductionFromSavings, totalAllocatedSavings, cpfLifeOffset)
  const freedomAge = basics.age + impact.yearsWithGoals
  const freedomAgeWithout = basics.age + impact.yearsWithoutGoals

  // Peer benchmark — use household income in couple mode
  const householdIncome = basics.monthlyIncome + (basics.partnerMonthlyIncome ?? 0)
  const savingsRate = householdIncome > 0
    ? (householdIncome - basics.monthlyExpenses) / householdIncome
    : 0
  const peerBenchmark = getPeerBenchmark(savingsRate, basics.age)

  // Income tax
  const taxEstimate = estimateIncomeTax(grossIncome * 12, basics.age)

  // Income ceiling warning (HDB ceiling is more restrictive, check it first)
  let incomeCeilingWarning: string | null = null
  if (hasAnyHdbGoal) {
    const ceiling = isCoupleMode ? HDB_INCOME_CEILING.couple : HDB_INCOME_CEILING.single
    if (householdGross >= ceiling) {
      incomeCeilingWarning = `Your household income of $${Math.round(householdGross).toLocaleString()}/mo already exceeds the HDB income ceiling of $${ceiling.toLocaleString()}/mo`
    }
  }
  // EC ceiling is higher than HDB ($16K vs $14K for couples). Only warn if no HDB warning already.
  if (hasAnyEcGoal && !incomeCeilingWarning) {
    const ecCeiling = isCoupleMode ? EC_INCOME_CEILING.couple : EC_INCOME_CEILING.single
    if (householdGross >= ecCeiling) {
      incomeCeilingWarning = `Your household income of $${Math.round(householdGross).toLocaleString()}/mo exceeds the EC income ceiling of $${ecCeiling.toLocaleString()}/mo`
    }
  }

  // Parking recommendation (based on shortest time horizon)
  const minYears = getMinYearsToGoal(sortedGoals, basics.age)
  const parkingRecommendation = getParkingRecommendation(minYears)

  // 8. Build story cards — map 'goal-N' placeholders to real goal IDs,
  //    then filter out cards that have no content for this scenario.
  const rawCards = buildGoalCardSequence(sortedGoals.length, hasAnyPropertyGoal, isCoupleMode)
  const mappedCards = rawCards.map((card) => {
    if (card.goalId && card.goalId.startsWith('goal-')) {
      const idx = parseInt(card.goalId.replace('goal-', ''), 10)
      const realGoal = sortedGoals[idx]
      return realGoal ? { ...card, goalId: realGoal.id } : card
    }
    return card
  })

  const hasGrant = perGoal.some((g) => g.grantAmount > 0)
  const hasLoan = perGoal.some((g) => g.loanQualification != null)
  const hasCpfOffset = perGoal.some((g) => g.cpfOaAccumulated > 0)

  const storyCards = mappedCards.filter((card) => {
    switch (card.key) {
      case 'grant': return hasGrant
      case 'loanCheck': return hasLoan
      case 'cpfOffset': return hasCpfOffset
      case 'taxHeadsUp': return taxEstimate.monthlySetAside > 0
      case 'parkingTip': return false
      default: return true
    }
  })

  return {
    perGoal,
    shared: {
      monthlySavings: totalMonthlySavings,
      freedomAge,
      freedomAgeWithout,
      cpfLifeMonthly,
      emergencyFund,
      emergencyFundGap,
      peerBenchmark,
      incomeTaxMonthly: taxEstimate.monthlySetAside,
      incomeCeilingWarning,
      parkingRecommendation,
      isCoupleMode,
    },
    storyCards,
  }
}

// ============================================================
// React hook
// ============================================================

export function useGoalStoryData(
  basics: GoalStoryBasics,
  goals: GoalCalcGoal[],
): GoalStoryData {
  return useMemo(
    () => computeGoalStoryData(basics, goals),
    [basics, goals],
  )
}
