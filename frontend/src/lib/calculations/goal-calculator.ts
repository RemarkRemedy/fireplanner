/**
 * Goal calculator calculation engine.
 *
 * Provides smart goal cost computation, monthly savings PMT,
 * feasibility checks, multi-goal stacking, retirement impact,
 * and mapping to household GoalItem.
 */

import { calculateBSD } from '@/lib/calculations/property'
import { calculateYearsToFire } from '@/lib/calculations/fire'
import {
  getHdbPriceRange,
  computeHdbDownPayment,
  computeCondoDownPayment,
  getCarPurchaseCost,
  CAR_DOWN_PAYMENT_RATE,
  CAR_HP_RATE,
  CAR_HP_TENURE_YEARS,
  computeCarHpTotal,
  computeMonthlyMortgagePayment,
  MORTGAGE_RATES,
  LOAN_TENURE_YEARS,
  LTV_RATIOS,
  getRenovationEstimate,
  getLegalFees,
} from '@/lib/data/goal-defaults'
import type { GoalCategory } from '@/lib/types'
import type { GoalItem, TimingRule } from '@/lib/household/types'

// ============================================================
// Constants
// ============================================================

export const REAL_RETURN = 0.036
export const FIRE_MULTIPLIER = 28

// ============================================================
// Types
// ============================================================

export type SalaryBasis = 'net' | 'gross'

export interface GoalCalcBasics {
  age: number
  monthlyIncome: number
  monthlyExpenses: number
  existingSavings: number
  /** V1.5: gross monthly salary (derived from net or entered directly) */
  grossIncome?: number
  /** V1.5: which basis the user entered their salary in */
  salaryBasis?: SalaryBasis
  /** V1.5: couple mode fields */
  coupleMode?: boolean
  partnerAge?: number
  partnerMonthlyIncome?: number
  partnerGrossIncome?: number
  partnerSalaryBasis?: SalaryBasis
}

export interface CostBreakdown {
  items: { label: string; amount: number }[]
  total: number
}

export type SmartGoalInputs =
  | { kind: 'hdb'; flatType: '3-room' | '4-room' | '5-room' | 'executive'; tenure: 'new' | 'resale'; loanType: 'hdb-loan' | 'bank-loan'; priceOverride?: number }
  | { kind: 'condo'; price: number }
  | { kind: 'landed'; price: number }
  | { kind: 'ec'; price: number; flatType: '3-room' | '4-room' | '5-room' }
  | { kind: 'car'; coeCategory: 'A' | 'B'; condition: 'new' | 'used'; priceRange: number }

export interface GoalCalcGoal {
  id: string
  category: GoalCategory
  label: string
  targetAge: number
  smartInputs?: SmartGoalInputs
  totalCostToday: number
  breakdown: CostBreakdown
  monthlySavingsNeeded: number
  feasible: boolean
  shortfallPerMonth: number
}

export interface FeasibilityResult {
  level: 'green' | 'amber' | 'red'
  feasible: boolean
  shortfall: number
}

export interface StackedGoalResult {
  goal: GoalCalcGoal
  label: string
  stackedFeasibility: FeasibilityResult
  remainingCapacity: number
  /** How much of existingSavings was allocated to this goal's lump-sum start */
  allocatedSavings: number
  /** Monthly savings recomputed using only allocatedSavings (not full existingSavings) */
  adjustedMonthlySavings: number
}

export interface RetirementImpactResult {
  yearsWithoutGoals: number
  yearsWithGoals: number
  deltaYears: number
  fullyCommitted: boolean
  adjustedPortfolioBase: number
}

// ============================================================
// computeSmartGoalCost
// ============================================================

export function computeSmartGoalCost(inputs: SmartGoalInputs): CostBreakdown {
  switch (inputs.kind) {
    case 'hdb':
      return computeHdbCost(inputs)
    case 'condo':
      return computeCondoCost(inputs.price, 'condo')
    case 'landed':
      return computeCondoCost(inputs.price, 'landed')
    case 'ec':
      return computeEcCost(inputs.price)
    case 'car':
      return computeCarCost(inputs)
  }
}

function computeHdbCost(inputs: Extract<SmartGoalInputs, { kind: 'hdb' }>): CostBreakdown {
  const priceRange = getHdbPriceRange(inputs.flatType, inputs.tenure)
  const price = inputs.priceOverride ?? priceRange.midpoint
  const downPayment = computeHdbDownPayment(price, inputs.loanType)
  const bsd = calculateBSD(price)
  const legal = getLegalFees('hdb')
  const reno = getRenovationEstimate('hdb')

  const items = [
    { label: 'Down payment', amount: downPayment },
    { label: 'BSD', amount: bsd },
    { label: 'Legal fees', amount: legal },
    { label: 'Renovation', amount: reno },
  ]
  return { items, total: items.reduce((sum, i) => sum + i.amount, 0) }
}

function computeCondoCost(price: number, propertyType: 'condo' | 'landed'): CostBreakdown {
  const dp = computeCondoDownPayment(price)
  const bsd = calculateBSD(price)
  const legal = getLegalFees(propertyType)
  const reno = getRenovationEstimate(propertyType)

  const items = [
    { label: 'Down payment (25%)', amount: dp.total },
    { label: 'BSD', amount: bsd },
    { label: 'ABSD (first property)', amount: 0 },
    { label: 'Legal fees', amount: legal },
    { label: 'Renovation', amount: reno },
  ]
  return { items, total: items.reduce((sum, i) => sum + i.amount, 0) }
}

function computeEcCost(price: number): CostBreakdown {
  const dp = computeCondoDownPayment(price)
  const bsd = calculateBSD(price)
  const legal = getLegalFees('ec')
  const reno = getRenovationEstimate('ec')

  const items = [
    { label: 'Down payment (25%)', amount: dp.total },
    { label: 'BSD', amount: bsd },
    { label: 'Legal fees', amount: legal },
    { label: 'Renovation', amount: reno },
  ]
  return { items, total: items.reduce((sum, i) => sum + i.amount, 0) }
}

function computeCarCost(inputs: Extract<SmartGoalInputs, { kind: 'car' }>): CostBreakdown {
  const carCost = getCarPurchaseCost(inputs.coeCategory, inputs.condition, inputs.priceRange)
  const totalPrice = carCost.total
  const downPayment = totalPrice * CAR_DOWN_PAYMENT_RATE
  const dpPercent = Math.round(CAR_DOWN_PAYMENT_RATE * 100)

  const items = [
    { label: `Down payment (${dpPercent}%)`, amount: downPayment },
    { label: 'Estimated total price (COE + OMV + ARF)', amount: totalPrice },
  ]
  // The savings goal is the down payment only; the rest is financed via hire purchase
  return { items, total: downPayment }
}

// ============================================================
// computeMonthlySavingsNeeded
// ============================================================

export function computeMonthlySavingsNeeded(
  goalAmount: number,
  existingSavings: number,
  years: number,
): number {
  if (years <= 0) return Infinity

  const r = REAL_RETURN
  const n = years

  // Future value of existing savings
  const fvSavings = existingSavings * Math.pow(1 + r, n)

  // Gap after existing savings grow
  const gap = goalAmount - fvSavings
  if (gap <= 0) return 0

  // Guard for r approximately 0
  if (Math.abs(r) < 1e-10) {
    return gap / (n * 12)
  }

  // PMT formula: annual payment for future value of annuity
  // FV = PMT * ((1+r)^n - 1) / r
  // PMT = gap * r / ((1+r)^n - 1)
  const annualPmt = gap * r / (Math.pow(1 + r, n) - 1)
  return annualPmt / 12
}

// ============================================================
// computeGoalFeasibility
// ============================================================

export function computeGoalFeasibility(
  monthlySavingsNeeded: number,
  availableMonthlySavings: number,
): FeasibilityResult {
  if (availableMonthlySavings <= 0 || monthlySavingsNeeded > availableMonthlySavings) {
    return {
      level: 'red',
      feasible: false,
      shortfall: monthlySavingsNeeded - Math.max(0, availableMonthlySavings),
    }
  }

  const ratio = monthlySavingsNeeded / availableMonthlySavings
  if (ratio > 0.8) {
    return { level: 'amber', feasible: true, shortfall: 0 }
  }

  return { level: 'green', feasible: true, shortfall: 0 }
}

// ============================================================
// computeMultiGoalStacking
// ============================================================

export function computeMultiGoalStacking(
  goals: GoalCalcGoal[],
  basics: GoalCalcBasics,
): StackedGoalResult[] {
  // Sort by targetAge ascending — earliest goals get savings first
  const sorted = [...goals].sort((a, b) => a.targetAge - b.targetAge)

  const householdIncome = basics.monthlyIncome + (basics.partnerMonthlyIncome ?? 0)
  let remainingCapacity = householdIncome - basics.monthlyExpenses
  let remainingSavings = basics.existingSavings

  return sorted.map((goal) => {
    // Allocate lump-sum savings to this goal (up to the goal's total cost)
    const allocated = Math.min(remainingSavings, goal.breakdown.total)
    remainingSavings -= allocated

    // Recompute monthly savings using only the allocated lump sum
    const years = goal.targetAge - basics.age
    const adjustedMonthly = computeMonthlySavingsNeeded(
      goal.breakdown.total,
      allocated,
      years,
    )

    const feasibility = computeGoalFeasibility(
      adjustedMonthly,
      remainingCapacity,
    )

    const capacityAfter = feasibility.feasible
      ? remainingCapacity - adjustedMonthly
      : remainingCapacity

    const result: StackedGoalResult = {
      goal,
      label: goal.label,
      stackedFeasibility: feasibility,
      remainingCapacity: Math.max(0, capacityAfter),
      allocatedSavings: allocated,
      adjustedMonthlySavings: adjustedMonthly,
    }

    if (feasibility.feasible) {
      remainingCapacity -= adjustedMonthly
    }

    return result
  })
}

// ============================================================
// computeRetirementImpact
// ============================================================

export function computeRetirementImpact(
  basics: GoalCalcBasics,
  totalGoalMonthlySavings: number,
  savingsAllocatedToGoals: number,
  cpfLifeOffset: number = 0,
): RetirementImpactResult {
  const requiredNestEgg = Math.max(0, basics.monthlyExpenses * 12 * FIRE_MULTIPLIER - cpfLifeOffset)
  const adjustedPortfolioBase = Math.max(0, basics.existingSavings - savingsAllocatedToGoals)

  const householdIncome = basics.monthlyIncome + (basics.partnerMonthlyIncome ?? 0)
  const monthlySavingsWithout = householdIncome - basics.monthlyExpenses
  const annualSavingsWithout = monthlySavingsWithout * 12

  const monthlySavingsWith = monthlySavingsWithout - totalGoalMonthlySavings
  const annualSavingsWith = monthlySavingsWith * 12

  const yearsWithoutGoals = calculateYearsToFire(
    REAL_RETURN,
    annualSavingsWithout,
    basics.existingSavings,
    requiredNestEgg,
  )

  const yearsWithGoals = calculateYearsToFire(
    REAL_RETURN,
    annualSavingsWith,
    adjustedPortfolioBase,
    requiredNestEgg,
  )

  const fullyCommitted = annualSavingsWith <= 0

  return {
    yearsWithoutGoals,
    yearsWithGoals,
    deltaYears: yearsWithGoals - yearsWithoutGoals,
    fullyCommitted,
    adjustedPortfolioBase,
  }
}

// ============================================================
// computeMonthlyLoanPayment
// ============================================================

/**
 * Compute the monthly loan payment (mortgage or car HP) for a financed goal.
 * Returns 0 for goals with no financing (wedding, education, custom, etc.).
 */
export function computeMonthlyLoanPayment(goal: GoalCalcGoal): number {
  if (!goal.smartInputs) return 0

  const inputs = goal.smartInputs
  switch (inputs.kind) {
    case 'hdb': {
      const price = inputs.priceOverride ?? getHdbPriceRange(inputs.flatType, inputs.tenure).midpoint
      const isHdbLoan = inputs.loanType === 'hdb-loan'
      const ltvKey = isHdbLoan ? 'hdb-loan' : 'bank-loan'
      const ltv = LTV_RATIOS[ltvKey as keyof typeof LTV_RATIOS]
      const loanAmount = price * ltv
      const rate = isHdbLoan ? MORTGAGE_RATES.hdb : MORTGAGE_RATES.bank
      const tenure = isHdbLoan ? LOAN_TENURE_YEARS.hdb : LOAN_TENURE_YEARS.bank
      return computeMonthlyMortgagePayment(loanAmount, rate, tenure)
    }
    case 'condo':
    case 'landed':
    case 'ec': {
      const price = inputs.price
      const ltv = LTV_RATIOS['bank-loan']
      const loanAmount = price * ltv
      const rate = MORTGAGE_RATES.bank
      const tenure = LOAN_TENURE_YEARS.bank
      return computeMonthlyMortgagePayment(loanAmount, rate, tenure)
    }
    case 'car': {
      const carCost = getCarPurchaseCost(inputs.coeCategory, inputs.condition, inputs.priceRange)
      const financedAmount = carCost.total * (1 - CAR_DOWN_PAYMENT_RATE)
      const totalHP = computeCarHpTotal(financedAmount, CAR_HP_RATE, CAR_HP_TENURE_YEARS)
      return totalHP / (CAR_HP_TENURE_YEARS * 12)
    }
    default:
      return 0
  }
}

// ============================================================
// mapGoalToHouseholdGoalItem
// ============================================================

export function mapGoalToHouseholdGoalItem(goal: GoalCalcGoal): GoalItem {
  const timing: TimingRule = {
    kind: 'single-age',
    owner: 'self',
    age: goal.targetAge,
  }

  return {
    id: goal.id,
    owner: 'self',
    label: goal.label,
    kind: 'financial-goal',
    timing,
    amount: goal.totalCostToday,
    amountSaved: 0,
    durationYears: 1,
    priority: 'important',
    inflationAdjusted: true,
    category: goal.category,
  }
}
