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
  FIRE_MULTIPLIER,
} from '@/lib/calculations/goal-calculator'
import type { GoalCalcGoal } from '@/lib/calculations/goal-calculator'
import type { GoalStoryBasics } from '@/hooks/useGoalStoryData'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import { lookupCpfLifeEstimate } from '@/lib/calculations/goal-calculator-sg'
import { CPF_LIFE_START_AGE } from '@/lib/data/cpfRates'
import {
  computeCarHpTotal,
  CAR_HP_TENURE_YEARS,
  computeMortgageTotal,
  MORTGAGE_RATES,
  LOAN_TENURE_YEARS,
  LTV_RATIOS,
} from '@/lib/data/goal-defaults'

// ============================================================
// Constants (calculation assumptions, not regulatory data)
// ============================================================

const DEFAULT_LIFE_EXPECTANCY = 85
const DEFAULT_SWR = 0.035
const DEFAULT_EXPECTED_RETURN = 0.05
export const DEFAULT_INFLATION = 0.025
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
 *
 * Property and car goals produce TWO financial goals each:
 * 1. Upfront costs (lump sum at target age: down payment + fees)
 * 2. Loan repayment (spread over tenure: mortgage P+I or HP P+I)
 *
 * This ensures the wealth curve reflects the full cost of ownership,
 * not just the upfront payment.
 */
function mapGoals(goals: GoalCalcGoal[]): FinancialGoal[] {
  const result: FinancialGoal[] = []

  for (const g of goals) {
    // Always add the upfront cost as a lump-sum goal
    result.push({
      id: g.id,
      label: g.label,
      amount: g.totalCostToday,
      targetAge: g.targetAge,
      durationYears: 1,
      priority: 'important',
      inflationAdjusted: true,
      category: g.category,
    })

    // Add loan repayment goals for financed purchases
    if (g.smartInputs?.kind === 'car') {
      // Car: HP repayment (flat rate interest, spread over tenure)
      const totalPriceItem = g.breakdown.items.find((i) => i.label.includes('Estimated total price'))
      if (totalPriceItem) {
        const financedAmount = totalPriceItem.amount - g.totalCostToday
        if (financedAmount > 0) {
          const hpTotal = computeCarHpTotal(financedAmount)
          result.push({
            id: `${g.id}-hp`,
            label: `${g.label} (hire purchase)`,
            amount: hpTotal,
            targetAge: g.targetAge,
            durationYears: CAR_HP_TENURE_YEARS,
            priority: 'important',
            inflationAdjusted: false,
            category: g.category,
          })
        }
      }
    } else if (g.smartInputs?.kind === 'hdb') {
      // HDB: mortgage based on loan type
      const priceItem = g.breakdown.items.find((i) => i.label.startsWith('Down payment'))
      if (priceItem) {
        const ltvKey = g.smartInputs.loanType as keyof typeof LTV_RATIOS
        const ltv = LTV_RATIOS[ltvKey] ?? 0.75
        // Recover property price from down payment / down payment rate
        const dpRate = ltv === 0.90 ? 0.10 : 0.25
        const propertyPrice = priceItem.amount / dpRate
        const loanAmount = propertyPrice * ltv
        const isHdbLoan = g.smartInputs.loanType === 'hdb-loan'
        const rate = isHdbLoan ? MORTGAGE_RATES.hdb : MORTGAGE_RATES.bank
        const tenure = isHdbLoan ? LOAN_TENURE_YEARS.hdb : LOAN_TENURE_YEARS.bank
        const mortgageTotal = computeMortgageTotal(loanAmount, rate, tenure)
        if (mortgageTotal > 0) {
          result.push({
            id: `${g.id}-mortgage`,
            label: `${g.label} (mortgage)`,
            amount: mortgageTotal,
            targetAge: g.targetAge,
            durationYears: tenure,
            priority: 'important',
            inflationAdjusted: false,
            category: g.category,
          })
        }
      }
    } else if (g.smartInputs?.kind === 'condo' || g.smartInputs?.kind === 'landed' || g.smartInputs?.kind === 'ec') {
      // Condo/Landed/EC: bank loan mortgage
      const propertyPrice = g.smartInputs.price
      const loanAmount = propertyPrice * LTV_RATIOS['bank-loan']
      const mortgageTotal = computeMortgageTotal(loanAmount, MORTGAGE_RATES.bank, LOAN_TENURE_YEARS.bank)
      if (mortgageTotal > 0) {
        result.push({
          id: `${g.id}-mortgage`,
          label: `${g.label} (mortgage)`,
          amount: mortgageTotal,
          targetAge: g.targetAge,
          durationYears: LOAN_TENURE_YEARS.bank,
          priority: 'important',
          inflationAdjusted: false,
          category: g.category,
        })
      }
    }
  }

  return result
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

  // 2. CPF LIFE (displayed as context, NOT used to reduce FIRE number).
  // For young users, CPF LIFE is too far away to meaningfully reduce the nest egg.
  const _cpfLifeMonthly = lookupCpfLifeEstimate(grossIncome)
  void _cpfLifeMonthly // keep computation for future display use
  const cpfLifeOffset = 0

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

export interface DeflatedRow {
  age: number
  liquidNW: number
  cpfTotal: number
  propertyEquity: number
}

/**
 * Deflate nominal projection output to today's dollars.
 *
 * Returns liquidNW, cpfTotal, and propertyEquity for each year,
 * all expressed in real (today's dollar) terms.
 */
export function deflateProjection(
  rows: ProjectionRow[],
  inflationRate: number,
  startAge: number,
): DeflatedRow[] {
  return rows.map((row) => {
    const deflator = Math.pow(1 + inflationRate, row.age - startAge)
    return {
      age: row.age,
      liquidNW: row.liquidNW / deflator,
      cpfTotal: row.cpfTotal / deflator,
      propertyEquity: row.propertyEquity / deflator,
    }
  })
}
