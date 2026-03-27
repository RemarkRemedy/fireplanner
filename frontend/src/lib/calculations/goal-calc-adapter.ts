/**
 * Goal Calculator V2 Adapter.
 *
 * Maps GoalStoryBasics + GoalCalcGoal[] into ProjectionParams so the wealth
 * curve chart can call generateProjection() with one function call.
 *
 * Also provides deflateProjection() to convert nominal projection output
 * back into today's dollars for display.
 */

import type { ProjectionParams } from '@/lib/calculations/projection'
import type { ProjectionRow } from '@/lib/types'
import type {
  FinancialGoal,
  GlidePathConfig,
  StrategyParamsMap,
  IncomeProjectionRow,
} from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { getEffectiveReturns } from '@/lib/calculations/portfolio'
import {
  computeRetirementImpact,
  computeMultiGoalStacking,
  FIRE_MULTIPLIER,
} from '@/lib/calculations/goal-calculator'
import type { GoalCalcGoal } from '@/lib/calculations/goal-calculator'
import type { GoalStoryBasics } from '@/hooks/useGoalStoryData'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import { lookupCpfLifeEstimate } from '@/lib/calculations/goal-calculator-sg'
import { CPF_LIFE_START_AGE } from '@/lib/data/cpfRates'

// ============================================================
// Constants (calculation assumptions, not regulatory data)
// ============================================================

const DEFAULT_LIFE_EXPECTANCY = 85
const DEFAULT_SWR = 0.035
const DEFAULT_EXPECTED_RETURN = 0.05
const DEFAULT_INFLATION = 0.025
const DEFAULT_EXPENSE_RATIO = 0.005
const DEFAULT_SALARY_GROWTH_RATE = 0.03
const DEFAULT_PROPERTY_APPRECIATION_RATE = 0.03

/** 8-element weights: 30% US eq, 0% SG eq, 30% intl, 20% bonds, 0% REITs, 0% gold, 0% cash, 20% CPF */
const DEFAULT_WEIGHTS = [0.30, 0, 0.30, 0.20, 0, 0, 0, 0.20]

const DEFAULT_GLIDE_PATH: GlidePathConfig = {
  enabled: false,
  method: 'linear',
  startAge: 50,
  endAge: 65,
}

const DEFAULT_STRATEGY_PARAMS: StrategyParamsMap = {
  constant_dollar: { swr: 0.04 },
  vpw: { expectedRealReturn: 0.03, targetEndValue: 0.10 },
  guardrails: { initialRate: 0.05, ceilingTrigger: 1.20, floorTrigger: 0.80, adjustmentSize: 0.10 },
  vanguard_dynamic: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
  cape_based: { baseRate: 0.04, capeWeight: 0.50, currentCape: 30 },
  floor_ceiling: { floor: 60000, ceiling: 150000, targetRate: 0.045 },
  percent_of_portfolio: { rate: 0.04 },
  one_over_n: {},
  sensible_withdrawals: { baseRate: 0.03, extrasRate: 0.10 },
  ninety_five_percent: { swr: 0.04 },
  endowment: { swr: 0.04, smoothingWeight: 0.70 },
  hebeler_autopilot: { expectedRealReturn: 0.03 },
}

// ============================================================
// Helpers
// ============================================================

/**
 * Build simplified IncomeProjectionParams for a single adult.
 */
function buildIncomeParams(
  grossMonthly: number,
  age: number,
  retirementAge: number,
  annualExpenses: number,
): IncomeProjectionParams {
  return {
    currentAge: age,
    retirementAge,
    lifeExpectancy: DEFAULT_LIFE_EXPECTANCY,
    salaryModel: 'simple',
    annualSalary: grossMonthly * 12,
    salaryGrowthRate: DEFAULT_SALARY_GROWTH_RATE,
    bonusMonths: 0,
    realisticPhases: [],
    promotionJumps: [],
    momEducation: 'degree',
    momAdjustment: 0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses,
    inflation: DEFAULT_INFLATION,
    personalReliefs: 0,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
    cpfLifeStartAge: CPF_LIFE_START_AGE,
    cpfLifePlan: 'standard',
  }
}

/**
 * Merge two income projection arrays by summing income/CPF fields at each year offset.
 * The primary array defines the output length; shorter partner arrays pad with zeros.
 *
 * Each per-adult projection must be computed with annualExpenses=0 so that
 * annualSavings = max(0, totalNet) - voluntaryTopUps - srsContribution.
 * Household expenses are deducted ONCE here (inflated per year), matching
 * the pattern in mergePerAdultProjections in income.ts.
 */
function mergeIncomeProjections(
  primary: IncomeProjectionRow[],
  partner: IncomeProjectionRow[],
  annualExpenses: number,
  inflation: number,
): IncomeProjectionRow[] {
  const maxLen = Math.max(primary.length, partner.length)
  const merged: IncomeProjectionRow[] = []
  let cumulativeSavings = 0

  for (let i = 0; i < maxLen; i++) {
    const a = primary[i]
    const b = partner[i]

    if (!a && !b) continue
    if (!a) {
      // Only partner row exists; deduct household expenses once
      const inflatedExpenses = annualExpenses * Math.pow(1 + inflation, i)
      const annualSavings = b!.annualSavings - inflatedExpenses
      cumulativeSavings += annualSavings
      merged.push({ ...b!, annualSavings, cumulativeSavings })
      continue
    }
    if (!b) {
      // Only primary row exists; deduct household expenses once
      const inflatedExpenses = annualExpenses * Math.pow(1 + inflation, i)
      const annualSavings = a.annualSavings - inflatedExpenses
      cumulativeSavings += annualSavings
      merged.push({ ...a, annualSavings, cumulativeSavings })
      continue
    }

    // Both rows exist: sum per-adult savings then deduct expenses once
    const perAdultSavingsSum = a.annualSavings + b.annualSavings
    const inflatedExpenses = annualExpenses * Math.pow(1 + inflation, i)
    const annualSavings = perAdultSavingsSum - inflatedExpenses
    cumulativeSavings += annualSavings

    merged.push({
      year: a.year,
      age: a.age,
      salary: a.salary + b.salary,
      rentalIncome: a.rentalIncome + b.rentalIncome,
      investmentIncome: a.investmentIncome + b.investmentIncome,
      businessIncome: a.businessIncome + b.businessIncome,
      governmentIncome: a.governmentIncome + b.governmentIncome,
      totalGross: a.totalGross + b.totalGross,
      sgTax: a.sgTax + b.sgTax,
      cpfEmployee: a.cpfEmployee + b.cpfEmployee,
      cpfEmployer: a.cpfEmployer + b.cpfEmployer,
      totalNet: a.totalNet + b.totalNet,
      annualSavings,
      cumulativeSavings,
      cpfOA: a.cpfOA + b.cpfOA,
      cpfSA: a.cpfSA + b.cpfSA,
      cpfMA: a.cpfMA + b.cpfMA,
      cpfRA: a.cpfRA + b.cpfRA,
      cpfAnnualInterest: (a.cpfAnnualInterest ?? 0) + (b.cpfAnnualInterest ?? 0),
      isRetired: a.isRetired && b.isRetired,
      activeLifeEvents: [...a.activeLifeEvents, ...b.activeLifeEvents],
      cpfLifePayout: a.cpfLifePayout + b.cpfLifePayout,
      cpfOaHousingDeduction: a.cpfOaHousingDeduction + b.cpfOaHousingDeduction,
      cpfOaShortfall: a.cpfOaShortfall + b.cpfOaShortfall,
      cpfLifeAnnuityPremium: a.cpfLifeAnnuityPremium + b.cpfLifeAnnuityPremium,
      cpfOaWithdrawal: a.cpfOaWithdrawal + b.cpfOaWithdrawal,
      cpfisOA: a.cpfisOA + b.cpfisOA,
      cpfisSA: a.cpfisSA + b.cpfisSA,
      cpfisReturn: a.cpfisReturn + b.cpfisReturn,
      srsBalance: a.srsBalance + b.srsBalance,
      srsContribution: a.srsContribution + b.srsContribution,
      srsWithdrawal: a.srsWithdrawal + b.srsWithdrawal,
      srsTaxableWithdrawal: a.srsTaxableWithdrawal + b.srsTaxableWithdrawal,
      lockedAssetUnlock: a.lockedAssetUnlock + b.lockedAssetUnlock,
      cashReserveTarget: a.cashReserveTarget + b.cashReserveTarget,
      cashReserveBalance: a.cashReserveBalance + b.cashReserveBalance,
      investedSavings: a.investedSavings + b.investedSavings,
    })
  }

  return merged
}

/**
 * Map GoalCalcGoal[] to FinancialGoal[] for ProjectionParams.
 */
function mapGoals(goals: GoalCalcGoal[]): FinancialGoal[] {
  return goals.map((g) => ({
    id: g.id,
    label: g.label,
    amount: g.totalCostToday,
    targetAge: g.targetAge,
    durationYears: 1,
    priority: 'important' as const,
    inflationAdjusted: true,
    category: g.category,
  }))
}

// ============================================================
// Main exports
// ============================================================

/**
 * Build ProjectionParams from goal calculator inputs.
 *
 * Computes income projection, retirement impact seed, FIRE number,
 * and maps goals to FinancialGoal format. All other fields use
 * sensible defaults for the goal calculator context.
 */
export function buildGoalCalcProjectionParams(
  basics: GoalStoryBasics,
  goals: GoalCalcGoal[],
): ProjectionParams {
  // 1. Derive gross income
  const grossIncome = basics.grossIncome ?? grossUpFromTakeHome(basics.monthlyIncome, basics.age)
  const isCoupleMode = basics.coupleMode === true || basics.partnerAge != null
  const partnerGross = isCoupleMode
    ? (basics.partnerGrossIncome ?? grossUpFromTakeHome(basics.partnerMonthlyIncome ?? 0, basics.partnerAge ?? basics.age))
    : 0

  // 2. Compute retirement impact to get seed freedom age
  const stacked = computeMultiGoalStacking(goals, basics)
  const totalMonthlySavings = stacked.reduce((sum, sr) => sum + sr.adjustedMonthlySavings, 0)
  const totalAllocatedSavings = stacked.reduce((sum, sr) => sum + sr.allocatedSavings, 0)

  const cpfLifeMonthly = lookupCpfLifeEstimate(grossIncome)
  const cpfLifeOffset = cpfLifeMonthly * 12 * FIRE_MULTIPLIER

  // Use a fixed income-stop age (65) for the projection, NOT the Freedom Age.
  // Freedom Age is a computed milestone ("you could retire here"), but using it
  // as retirementAge creates a circular dependency: higher income → lower Freedom
  // Age → income stops earlier → worse outcome. The chart should show the realistic
  // trajectory of continuing to work until a conventional retirement age.
  const DEFAULT_INCOME_STOP_AGE = 65
  const retirementAge = Math.max(DEFAULT_INCOME_STOP_AGE, basics.age + 1)

  // 3. Annual expenses
  const annualExpenses = basics.monthlyExpenses * 12

  // 4. FIRE number
  const fireNumber = Math.max(0, annualExpenses * FIRE_MULTIPLIER - cpfLifeOffset)

  // 5. Income projection
  // In couple mode, pass annualExpenses=0 per adult so each adult's projection
  // contains full net income without expense deduction. Expenses are deducted
  // once in mergeIncomeProjections. In solo mode, pass the real annualExpenses.
  const primaryIncomeParams = buildIncomeParams(
    grossIncome,
    basics.age,
    retirementAge,
    isCoupleMode ? 0 : annualExpenses,
  )
  let incomeProjection = generateIncomeProjection(primaryIncomeParams)

  if (isCoupleMode && partnerGross > 0) {
    const partnerAge = basics.partnerAge ?? basics.age
    const partnerIncomeParams = buildIncomeParams(
      partnerGross,
      partnerAge,
      retirementAge,
      0, // expenses deducted once in merge
    )
    const partnerProjection = generateIncomeProjection(partnerIncomeParams)
    incomeProjection = mergeIncomeProjections(
      incomeProjection,
      partnerProjection,
      annualExpenses,
      DEFAULT_INFLATION,
    )
  }

  // 6. Asset returns and weights
  const assetReturns = getEffectiveReturns(Array(8).fill(null) as (number | null)[])

  // 7. Map goals
  const financialGoals = mapGoals(goals)

  // 8. Assemble ProjectionParams
  return {
    incomeProjection,
    currentAge: basics.age,
    retirementAge,
    lifeExpectancy: DEFAULT_LIFE_EXPECTANCY,
    initialLiquidNW: basics.existingSavings,
    swr: DEFAULT_SWR,
    expectedReturn: DEFAULT_EXPECTED_RETURN,
    usePortfolioReturn: true,
    inflation: DEFAULT_INFLATION,
    expenseRatio: DEFAULT_EXPENSE_RATIO,
    annualExpenses,
    retirementSpendingAdjustment: 1.0,
    fireNumber,
    currentWeights: [...DEFAULT_WEIGHTS],
    targetWeights: [...DEFAULT_WEIGHTS],
    assetReturns,
    glidePathConfig: { ...DEFAULT_GLIDE_PATH },
    withdrawalStrategy: 'constant_dollar',
    withdrawalBasis: 'expenses',
    strategyParams: { ...DEFAULT_STRATEGY_PARAMS },

    // Property fields (zeroed — not modeled in goal calc)
    propertyEquity: 0,
    annualMortgagePayment: 0,
    annualRentalIncome: 0,
    existingPropertyValue: 0,
    propertyAppreciationRate: DEFAULT_PROPERTY_APPRECIATION_RATE,
    propertyLeaseYears: 99,
    applyBalaDecay: false,
    downsizing: null,
    existingMortgageBalance: 0,
    existingMortgageRate: 0,
    existingMonthlyPayment: 0,
    existingMortgageRemainingYears: 0,
    residencyForAbsd: 'citizen',
    propertyCount: 0,
    hdbCpfUsedForHousing: 0,

    // Parent support & healthcare (not modeled)
    parentSupport: [],
    parentSupportEnabled: false,
    healthcareConfig: null,

    // CPF LIFE
    cpfLifeStartAge: CPF_LIFE_START_AGE,
    cpfLifePlan: 'standard',

    // Financial goals
    financialGoals,
  }
}

/**
 * Deflate nominal projection output to today's dollars.
 *
 * Takes the nominal liquidNW from each ProjectionRow and divides by
 * (1 + inflationRate)^(age - startAge) to express in real terms.
 */
export function deflateProjection(
  rows: ProjectionRow[],
  inflationRate: number,
  startAge: number,
): { age: number; netWorth: number }[] {
  return rows.map((row) => ({
    age: row.age,
    netWorth: row.liquidNW / Math.pow(1 + inflationRate, row.age - startAge),
  }))
}
