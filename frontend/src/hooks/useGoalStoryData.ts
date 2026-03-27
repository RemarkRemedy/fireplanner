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
  FIRE_MULTIPLIER,
} from '@/lib/calculations/goal-calculator'
import {
  accumulateCpfOa,
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

function getPropertyType(inputs: SmartGoalInputs): 'hdb' | 'condo' | 'landed' {
  switch (inputs.kind) {
    case 'hdb': return 'hdb'
    case 'condo': return 'condo'
    case 'landed': return 'landed'
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
  // Condo/landed: bank loan only
  return 0.75
}

function getPropertyPrice(goal: GoalCalcGoal): number {
  if (!goal.smartInputs) return goal.totalCostToday
  switch (goal.smartInputs.kind) {
    case 'hdb': return goal.smartInputs.priceOverride ?? goal.totalCostToday
    case 'condo': return goal.smartInputs.price
    case 'landed': return goal.smartInputs.price
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
  // 1. Derive gross income
  const grossIncome = basics.grossIncome ?? grossUpFromTakeHome(basics.monthlyIncome, basics.age)

  // 2. Couple mode
  const isCoupleMode = basics.partnerAge != null
  const partnerGross = isCoupleMode
    ? (basics.partnerGrossIncome ?? grossUpFromTakeHome(basics.partnerMonthlyIncome ?? 0, basics.partnerAge!))
    : 0

  // 3. Household values
  const householdGross = grossIncome + partnerGross

  // 4. Emergency fund
  const emergencyFund = getEmergencyFundFloor(basics.monthlyExpenses)
  const emergencyFundGap = Math.max(0, emergencyFund - basics.existingSavings)

  // 5. Run stacked computation
  const stacked = computeMultiGoalStacking(goals, basics)

  // Build a lookup from goal id -> stacked result
  const stackedById = new Map<string, StackedGoalResult>()
  for (const sr of stacked) {
    stackedById.set(sr.goal.id, sr)
  }

  // 6. Enrich each goal
  const hasAnyPropertyGoal = goals.some(isPropertyGoal)
  const hasAnyHdbGoal = goals.some(isHdbGoal)

  const perGoal: EnrichedGoal[] = goals.map((goal) => {
    const monthsToGoal = Math.max(0, (goal.targetAge - basics.age) * 12)
    const stackedResult = stackedById.get(goal.id)

    // CPF OA accumulation
    let cpfOaAccumulated = accumulateCpfOa(grossIncome, basics.age, monthsToGoal)
    if (isCoupleMode) {
      cpfOaAccumulated += accumulateCpfOa(partnerGross, basics.partnerAge!, monthsToGoal)
    }

    // Grant (only for HDB goals)
    let grantAmount = 0
    if (isHdbGoal(goal) && goal.smartInputs?.kind === 'hdb') {
      grantAmount = estimateHousingGrant(
        householdGross,
        goal.smartInputs.flatType,
        goal.smartInputs.tenure,
        !isCoupleMode,
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

    // Cash needed
    let cashNeeded = goal.breakdown.total - cpfOaAccumulated - grantAmount
    // For condos, enforce 5% cash floor
    if (isCondoGoal(goal) || isLandedGoal(goal)) {
      const price = getPropertyPrice(goal)
      const cashMinimum = computeCondoDownPayment(price).cashMinimum
      cashNeeded = Math.max(cashMinimum, cashNeeded)
    }
    cashNeeded = Math.max(0, cashNeeded)

    return {
      goal,
      cpfOaAccumulated,
      grantAmount,
      loanQualification,
      cashNeeded,
      adjustedMonthlySavings: stackedResult?.adjustedMonthlySavings ?? goal.monthlySavingsNeeded,
    }
  })

  // 7. Shared insights
  const totalMonthlySavings = stacked.reduce((sum, sr) => sum + sr.adjustedMonthlySavings, 0)
  const totalAllocatedSavings = stacked.reduce((sum, sr) => sum + sr.allocatedSavings, 0)

  // CPF LIFE
  const cpfLifeMonthly = lookupCpfLifeEstimate(grossIncome)
  const cpfLifeAnnual = cpfLifeMonthly * 12
  const cpfLifeOffset = cpfLifeAnnual * FIRE_MULTIPLIER

  // Freedom age
  const impact = computeRetirementImpact(basics, totalMonthlySavings, totalAllocatedSavings, cpfLifeOffset)
  const freedomAge = basics.age + impact.yearsWithGoals
  const freedomAgeWithout = basics.age + impact.yearsWithoutGoals

  // Peer benchmark
  const savingsRate = basics.monthlyIncome > 0
    ? (basics.monthlyIncome - basics.monthlyExpenses) / basics.monthlyIncome
    : 0
  const peerBenchmark = getPeerBenchmark(savingsRate, basics.age)

  // Income tax
  const taxEstimate = estimateIncomeTax(grossIncome * 12, basics.age)

  // Income ceiling warning (only if any HDB BTO goal)
  let incomeCeilingWarning: string | null = null
  if (hasAnyHdbGoal) {
    const ceiling = isCoupleMode ? HDB_INCOME_CEILING.couple : HDB_INCOME_CEILING.single
    if (householdGross >= ceiling) {
      incomeCeilingWarning = `Your household income of $${Math.round(householdGross).toLocaleString()}/mo already exceeds the HDB income ceiling of $${ceiling.toLocaleString()}/mo`
    }
  }

  // Parking recommendation (based on shortest time horizon)
  const minYears = getMinYearsToGoal(goals, basics.age)
  const parkingRecommendation = getParkingRecommendation(minYears)

  // 8. Build story cards
  const storyCards = buildGoalCardSequence(goals.length, hasAnyPropertyGoal, isCoupleMode)

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
