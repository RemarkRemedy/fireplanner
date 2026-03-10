import type { FireMetrics, FireType, FireNumberBasis, ParentSupport, HealthcareConfig, LockedAsset, ExpenseAdjustment } from '@/lib/types'
import { calculateHealthcareLAE } from './healthcare'
import { getEffectiveExpenses } from './expenses'

/** Expense multiplier for each FIRE type */
const FIRE_TYPE_MULTIPLIERS: Record<FireType, number> = {
  regular: 1.0,
  lean: 0.6,
  fat: 1.5,
  coast: 1.0,
  barista: 1.0,
}

/**
 * FIRE Number = annual expenses / SWR
 * This is the portfolio size needed to fund retirement indefinitely.
 */
export function calculateFireNumber(annualExpenses: number, swr: number): number {
  if (swr <= 0 || annualExpenses <= 0) return 0
  return annualExpenses / swr
}

/**
 * Projection-derived FIRE Number: uses the first retired year's actual cash flows
 * from the year-by-year projection instead of the simplified expense formula.
 *
 * Accounts for:
 * - Cash mortgage payments (increases target)
 * - CPF LIFE payouts (decreases target)
 * - Rental income (decreases target)
 *
 * annualExpenses from ProjectionRow already includes: base living expenses,
 * parent support, healthcare, and downsizing rent.
 */
export function calculateProjectionFireNumber(
  firstRetiredRow: {
    annualExpenses: number
    mortgageCashPayment: number
    cpfLifePayout: number
    rentalIncome: number
  },
  swr: number
): number {
  if (swr <= 0) return 0
  const netAnnualNeed = firstRetiredRow.annualExpenses
    + firstRetiredRow.mortgageCashPayment
    - firstRetiredRow.cpfLifePayout
    - firstRetiredRow.rentalIncome
  return Math.max(0, netAnnualNeed) / swr
}

/**
 * Normalizes a projection-derived FIRE number from first-retired-year
 * nominal dollars to the same dollar basis as the simple FIRE number.
 *
 * basisInflationFactor = effectiveExpenses / preInflationSubtotal
 *   where preInflationSubtotal = baseExpenses + parentSupportAnnual + healthcareCashOutlay
 *   This captures whatever inflation adjustment the simple formula applied
 *   (none for "today", (1+i)^retYears for "retirement", converged factor for "fireAge").
 */
export function normalizeProjectionFireNumber(
  rawProjFireNumber: number,
  firstRetiredAge: number,
  currentAge: number,
  inflation: number,
  basisInflationFactor: number,
): number {
  const yearsToFirstRetired = Math.max(0, firstRetiredAge - currentAge)
  const projInflationFactor = yearsToFirstRetired > 0 && inflation > 0
    ? Math.pow(1 + inflation, yearsToFirstRetired)
    : 1
  return rawProjFireNumber * basisInflationFactor / projInflationFactor
}

/**
 * Years to FIRE using the NPER formula (future value of growing annuity).
 *
 * Formula: ln((savings/r + fireNumber) / (savings/r + currentNW)) / ln(1+r)
 * where r = net real return (after inflation and expense ratio).
 *
 * Edge cases:
 * - r = 0: simple linear savings: (fireNumber - currentNW) / annualSavings
 * - currentNW >= fireNumber: 0 (already at FIRE)
 * - impossible (negative savings, zero growth, etc.): Infinity
 */
export function calculateYearsToFire(
  netRealReturn: number,
  annualSavings: number,
  currentNW: number,
  fireNumber: number
): number {
  if (currentNW >= fireNumber) return 0
  if (annualSavings <= 0 && netRealReturn <= 0) return Infinity

  if (Math.abs(netRealReturn) < 1e-10) {
    // r ≈ 0: simple linear
    if (annualSavings <= 0) return Infinity
    return (fireNumber - currentNW) / annualSavings
  }

  const r = netRealReturn
  const s = annualSavings
  const numerator = s / r + fireNumber
  const denominator = s / r + currentNW

  if (denominator <= 0 || numerator <= 0) return Infinity
  if (numerator / denominator <= 0) return Infinity

  const years = Math.log(numerator / denominator) / Math.log(1 + r)
  if (!isFinite(years) || years < 0) return Infinity
  return years
}

/**
 * Coast FIRE Number: the amount you need NOW such that compound growth
 * alone will reach your FIRE number by retirement.
 *
 * coastFire = fireNumber / (1 + netReturn)^yearsToRetirement
 */
export function calculateCoastFire(
  fireNumber: number,
  netReturn: number,
  yearsToRetirement: number
): number {
  if (yearsToRetirement <= 0) return fireNumber
  if (netReturn <= -1) return Infinity
  return fireNumber / Math.pow(1 + netReturn, yearsToRetirement)
}

/**
 * Barista FIRE Income: the minimum employment income needed if you
 * stop full-time work but let your portfolio cover part of expenses.
 *
 * baristaIncome = max(0, retirementExpenses - portfolio * swr)
 */
export function calculateBaristaFireIncome(
  retirementExpenses: number,
  liquidPortfolio: number,
  swr: number
): number {
  return Math.max(0, retirementExpenses - liquidPortfolio * swr)
}

/** Lean FIRE = 60% of expenses / SWR */
export function calculateLeanFire(annualExpenses: number, swr: number): number {
  return calculateFireNumber(annualExpenses * 0.6, swr)
}

/** Fat FIRE = 150% of expenses / SWR */
export function calculateFatFire(annualExpenses: number, swr: number): number {
  return calculateFireNumber(annualExpenses * 1.5, swr)
}

/**
 * Calculate total annual parent support at a given age.
 * Each entry is active when startAge <= age < endAge.
 * Growth is compounded from startAge: amount * (1 + growthRate)^(age - startAge).
 * Parent support is additive to expenses and NOT subject to retirementSpendingAdjustment.
 */
export function calculateParentSupportAtAge(entries: ParentSupport[], age: number): number {
  let total = 0
  for (const entry of entries) {
    if (age >= entry.startAge && age < entry.endAge) {
      const yearsActive = age - entry.startAge
      const annualAmount = entry.monthlyAmount * 12 * Math.pow(1 + entry.growthRate, yearsActive)
      total += annualAmount
    }
  }
  return total
}

/**
 * Project year-by-year net worth from current age to life expectancy.
 * Accumulation phase: balance grows via savings + returns.
 * Decumulation phase: balance shrinks via expense withdrawals.
 *
 * Phase switches when:
 * 1. balance >= fireNumber (financially independent), OR
 * 2. age >= retirementAge (forced retirement — stops working even if not FI)
 *
 * When retirementAge is provided and reached before FIRE number,
 * this models the realistic scenario of early retirement with insufficient savings.
 */
export function projectNetWorthPath(params: {
  currentAge: number
  annualSavings: number
  currentNW: number
  realReturn: number
  annualExpenses: number
  fireNumber: number
  lifeExpectancy?: number
  retirementAge?: number
}): { age: number; balance: number; phase: 'accumulation' | 'decumulation' }[] {
  const { currentAge, annualSavings, currentNW, realReturn, annualExpenses, fireNumber, lifeExpectancy = 90, retirementAge } = params
  const path: { age: number; balance: number; phase: 'accumulation' | 'decumulation' }[] = []
  let balance = currentNW
  let phase: 'accumulation' | 'decumulation' = currentNW >= fireNumber ? 'decumulation' : 'accumulation'

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    // Force decumulation at retirement age even if FIRE number not reached
    if (phase === 'accumulation' && retirementAge != null && age >= retirementAge) {
      phase = 'decumulation'
    }
    path.push({ age, balance: Math.max(0, balance), phase })
    if (phase === 'accumulation') {
      balance = balance * (1 + realReturn) + annualSavings
      if (balance >= fireNumber) phase = 'decumulation'
    } else {
      balance = balance * (1 + realReturn) - annualExpenses
      if (balance <= 0) balance = 0
    }
  }

  return path
}

/** Progress toward FIRE target: NW / fireNumber (0 to 1+) */
export function calculateProgress(currentNW: number, fireNumber: number): number {
  if (fireNumber <= 0) return 0
  return currentNW / fireNumber
}

/**
 * Project portfolio value at retirement using FV of lump sum + FV of annuity in real terms.
 *
 * projectedNW = currentNW × (1+r)^n + annualSavings × ((1+r)^n - 1) / r
 * where r = expectedReturn - inflation - expenseRatio, n = retirementAge - currentAge
 *
 * Edge cases:
 * - n <= 0 (already at/past retirement): returns currentNW
 * - r ≈ 0: linear approximation (currentNW + annualSavings × n)
 * - Result clamped to max(0, ...)
 */
export function projectPortfolioAtRetirement(params: {
  currentNW: number
  annualSavings: number
  netRealReturn: number
  yearsToRetirement: number
}): number {
  const { currentNW, annualSavings, netRealReturn: r, yearsToRetirement: n } = params

  if (n <= 0) return currentNW

  if (Math.abs(r) < 1e-10) {
    // r ≈ 0: linear
    return Math.max(0, currentNW + annualSavings * n)
  }

  const growthFactor = Math.pow(1 + r, n)
  const fvLumpSum = currentNW * growthFactor
  const fvAnnuity = annualSavings * (growthFactor - 1) / r

  return Math.max(0, fvLumpSum + fvAnnuity)
}

/**
 * Calculate the age at which liquid-only portfolio depletes,
 * assuming annual withdrawals of `annualExpenses` starting at `retirementAge`.
 * Returns null if liquid portfolio never depletes before `lifeExpectancy`.
 */
export function calculateLiquidBridgeGap(
  liquidNW: number,
  annualExpenses: number,
  retirementAge: number,
  cpfLifeStartAge: number,
  realReturn: number,
  lifeExpectancy: number
): { liquidDepletionAge: number | null; liquidBridgeGapYears: number | null } {
  if (liquidNW <= 0) {
    return { liquidDepletionAge: retirementAge, liquidBridgeGapYears: Math.max(0, cpfLifeStartAge - retirementAge) }
  }

  let balance = liquidNW
  for (let age = retirementAge; age <= lifeExpectancy; age++) {
    balance = balance * (1 + realReturn) - annualExpenses
    if (balance <= 0) {
      const gapYears = age < cpfLifeStartAge ? cpfLifeStartAge - age : null
      return { liquidDepletionAge: age, liquidBridgeGapYears: gapYears }
    }
  }
  return { liquidDepletionAge: null, liquidBridgeGapYears: null }
}

/**
 * Calculate all FIRE metrics from profile inputs.
 */
export function calculateAllFireMetrics(params: {
  currentAge: number
  retirementAge: number
  annualIncome: number
  annualExpenses: number
  liquidNetWorth: number
  cpfTotal: number
  swr: number
  expectedReturn: number
  inflation: number
  expenseRatio: number
  fireType?: FireType
  fireNumberBasis?: FireNumberBasis
  cpfLifeStartAge?: number
  lifeExpectancy?: number
  retirementSpendingAdjustment?: number
  propertyEquity?: number
  parentSupport?: ParentSupport[]
  parentSupportEnabled?: boolean
  healthcareConfig?: HealthcareConfig | null
  cashReserveOffset?: number
  lockedAssets?: LockedAsset[]
  expenseAdjustments?: ExpenseAdjustment[]
}): FireMetrics {
  const {
    currentAge,
    retirementAge,
    annualIncome,
    annualExpenses,
    liquidNetWorth,
    cpfTotal,
    swr,
    expectedReturn,
    inflation,
    expenseRatio,
    fireType = 'regular',
    fireNumberBasis = 'today',
    cpfLifeStartAge = 65,
    lifeExpectancy = 90,
    retirementSpendingAdjustment = 1.0,
    propertyEquity = 0,
    parentSupport = [],
    parentSupportEnabled = false,
    healthcareConfig = null,
  } = params

  const cashReserveOffset = params.cashReserveOffset ?? 0
  const investableLiquid = liquidNetWorth - cashReserveOffset
  const totalNetWorth = investableLiquid + cpfTotal
  const totalNWIncProperty = totalNetWorth + propertyEquity

  // Locked assets: sum current amounts, compute accessible vs total-with-locked
  const lockedAssetsArr = params.lockedAssets ?? []
  const lockedAssetsTotal = lockedAssetsArr.reduce((sum, a) => sum + a.amount, 0)
  const accessibleNetWorth = investableLiquid
  const totalNetWorthWithLocked = totalNetWorth + lockedAssetsTotal
  const expenseAdjustments = params.expenseAdjustments ?? []
  const currentExpenses = getEffectiveExpenses(currentAge, annualExpenses, expenseAdjustments, lifeExpectancy)
  const annualSavings = annualIncome - currentExpenses
  const savingsRate = annualIncome > 0 ? annualSavings / annualIncome : 0

  // Net real return = nominal - inflation - expense ratio (computed first — needed by LAE)
  const netRealReturn = expectedReturn - inflation - expenseRatio

  // Apply retirement spending adjustment and FIRE type multiplier to expenses for the FIRE number
  const multiplier = FIRE_TYPE_MULTIPLIERS[fireType]
  const retirementEffectiveExpenses = getEffectiveExpenses(retirementAge, annualExpenses, expenseAdjustments, lifeExpectancy)
  const baseExpenses = retirementEffectiveExpenses * retirementSpendingAdjustment * multiplier
  let effectiveExpenses = baseExpenses

  // Add parent support at retirement age (additive, NOT subject to adjustment/multiplier)
  const parentSupportAnnual = parentSupportEnabled
    ? calculateParentSupportAtAge(parentSupport, retirementAge)
    : 0
  effectiveExpenses += parentSupportAnnual

  // Add healthcare LAE (Level Annual Equivalent) — the constant annual withdrawal that covers
  // all escalating healthcare costs from retirement to life expectancy, given portfolio growth.
  // This replaces the point-in-time snapshot which underestimates the FIRE target.
  const healthcareCashOutlay = healthcareConfig?.enabled
    ? calculateHealthcareLAE(healthcareConfig, retirementAge, lifeExpectancy, netRealReturn, inflation, currentAge)
    : 0
  effectiveExpenses += healthcareCashOutlay

  // Inflate expenses to retirement age if using retirement-dollar basis
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)
  if (fireNumberBasis === 'retirement' && yearsToRetirement > 0 && inflation > 0) {
    effectiveExpenses *= Math.pow(1 + inflation, yearsToRetirement)
  }

  // fireAge basis: iterative fixed-point convergence
  // FIRE number depends on FIRE age (inflation target), FIRE age depends on FIRE number (NPER).
  // Start with today's expenses, compute FIRE age, inflate to that age, recompute, repeat.
  // Use effectiveExpenses (which already includes retirementSpendingAdjustment, parent support,
  // and healthcare) as the base for inflation adjustment.
  // Cap inflation years at remaining lifetime to prevent spiral when FIRE is unreachable.
  const baseExpensesForFireAge = effectiveExpenses
  let inflationFactor = 1
  const maxInflationYears = lifeExpectancy - currentAge
  if (fireNumberBasis === 'fireAge' && inflation > 0) {
    let prevYearsToFire = 0
    const MAX_ITERATIONS = 10
    const TOLERANCE = 0.01

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const currentFireNumber = calculateFireNumber(baseExpensesForFireAge * inflationFactor, swr)
      const currentYearsToFire = calculateYearsToFire(netRealReturn, annualSavings, totalNetWorth, currentFireNumber)

      const yearsForInflation = isFinite(currentYearsToFire)
        ? Math.min(Math.max(0, currentYearsToFire), maxInflationYears)
        : 0
      inflationFactor = Math.pow(1 + inflation, yearsForInflation)

      if (Math.abs(currentYearsToFire - prevYearsToFire) < TOLERANCE) break
      prevYearsToFire = currentYearsToFire
    }

    effectiveExpenses = baseExpensesForFireAge * inflationFactor
  }

  const fireNumber = calculateFireNumber(effectiveExpenses, swr)
  // Lean/Fat reference values also include retirement adjustment and inflate when using retirement or fireAge basis
  let leanExpenses = retirementEffectiveExpenses * retirementSpendingAdjustment
  let fatExpenses = retirementEffectiveExpenses * retirementSpendingAdjustment
  if (fireNumberBasis === 'retirement' && yearsToRetirement > 0 && inflation > 0) {
    const retirementInflationFactor = Math.pow(1 + inflation, yearsToRetirement)
    leanExpenses *= retirementInflationFactor
    fatExpenses *= retirementInflationFactor
  } else if (fireNumberBasis === 'fireAge' && inflation > 0) {
    leanExpenses *= inflationFactor
    fatExpenses *= inflationFactor
  }
  const leanFireNumber = calculateLeanFire(leanExpenses, swr)
  const fatFireNumber = calculateFatFire(fatExpenses, swr)

  const yearsToFire = calculateYearsToFire(
    netRealReturn,
    annualSavings,
    totalNetWorth,
    fireNumber
  )
  const fireAge = currentAge + yearsToFire

  const coastFireNumber = calculateCoastFire(fireNumber, netRealReturn, yearsToRetirement)
  const baristaFireIncome = calculateBaristaFireIncome(effectiveExpenses, liquidNetWorth, swr)
  const progress = calculateProgress(totalNetWorth, fireNumber)

  // CPF dependency detection
  const liquidProgress = fireNumber > 0 ? liquidNetWorth / fireNumber : 0
  const cpfDependency = liquidProgress < 1 && progress >= 1

  // Bridge gap analysis (only relevant when CPF-dependent)
  let liquidBridgeGapYears: number | null = null
  let liquidDepletionAge: number | null = null
  if (cpfDependency) {
    const bridgeResult = calculateLiquidBridgeGap(
      liquidNetWorth,
      effectiveExpenses,
      retirementAge,
      cpfLifeStartAge,
      netRealReturn,
      lifeExpectancy
    )
    liquidBridgeGapYears = bridgeResult.liquidBridgeGapYears
    liquidDepletionAge = bridgeResult.liquidDepletionAge
  }

  return {
    fireNumber,
    leanFireNumber,
    fatFireNumber,
    coastFireNumber,
    baristaFireIncome,
    yearsToFire,
    fireAge,
    progress,
    savingsRate,
    annualSavings,
    totalNetWorth,
    propertyEquity,
    totalNWIncProperty,
    cpfDependency,
    liquidBridgeGapYears,
    liquidDepletionAge,
    lockedAssetsTotal,
    accessibleNetWorth,
    totalNetWorthWithLocked,
    expensesBreakdown: {
      baseExpenses,
      parentSupportAnnual,
      healthcareCashOutlay,
      effectiveExpenses,
    },
  }
}
