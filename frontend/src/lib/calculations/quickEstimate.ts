/**
 * Quick Estimate calculator — thin wrapper around fire.ts for the
 * 3-stage onboarding funnel (/quick-estimate page).
 *
 * Stage 1: FIRE estimate from 4 monthly inputs + 2 pre-filled rates.
 * Stage 2: Health score from 2 additional inputs mapped to HealthRatioInputs.
 */

import { calculateFireNumber, calculateYearsToFire, projectNetWorthPath } from './fire'
import type { HealthRatioInputs } from './healthCheck'
import { QUICK_ESTIMATE_DEFAULTS } from '@/lib/data/quickEstimateDefaults'

// ── Types ──────────────────────────────────────────────────────────────────

export interface QuickEstimateInputs {
  monthlyIncome: number
  monthlyExpenses: number
  currentSavings: number
  currentAge: number
  /** Nominal expected return as decimal (e.g. 0.05 for 5%) */
  expectedReturn: number
  /** Safe withdrawal rate as decimal (e.g. 0.035 for 3.5%) */
  swr: number
}

export type QuickEstimateStatus =
  | 'ok'
  | 'no-income'
  | 'negative-savings'
  | 'already-fire'
  | 'unreachable'

export interface QuickEstimateResult {
  status: QuickEstimateStatus
  fireNumber: number
  yearsToFire: number
  fireAge: number
  savingsRate: number
  annualSavings: number
  netRealReturn: number
  trajectory: { age: number; balance: number; phase: 'accumulation' | 'decumulation' }[]
}

export interface QuickHealthInputs {
  cashSavings: number
  outstandingDebt: number
}

// ── URL Param Parsing ──────────────────────────────────────────────────────

export interface QuickEstimateUrlParams {
  income?: number
  expenses?: number
  savings?: number
  age?: number
  return?: number
  swr?: number
}

const PARAM_RANGES = {
  income: { min: 0, max: 1_000_000 },
  expenses: { min: 0, max: 1_000_000 },
  savings: { min: 0, max: 100_000_000 },
  age: { min: 18, max: 80 },
  return: { min: 0, max: 30 },
  swr: { min: 1, max: 10 },
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseUrlParams(searchParams: URLSearchParams): QuickEstimateUrlParams {
  const result: QuickEstimateUrlParams = {}

  for (const [key, range] of Object.entries(PARAM_RANGES)) {
    const raw = searchParams.get(key)
    if (raw == null) continue
    const parsed = parseFloat(raw)
    if (isNaN(parsed)) continue
    ;(result as Record<string, number>)[key] = clamp(parsed, range.min, range.max)
  }

  return result
}

export function buildSearchParams(inputs: QuickEstimateInputs): URLSearchParams {
  const params = new URLSearchParams()
  if (inputs.monthlyIncome > 0) params.set('income', String(inputs.monthlyIncome))
  if (inputs.monthlyExpenses > 0) params.set('expenses', String(inputs.monthlyExpenses))
  if (inputs.currentSavings > 0) params.set('savings', String(inputs.currentSavings))
  if (inputs.currentAge !== QUICK_ESTIMATE_DEFAULTS.defaultAge) params.set('age', String(inputs.currentAge))
  if (inputs.expectedReturn !== QUICK_ESTIMATE_DEFAULTS.nominalReturn) params.set('return', String(Math.round(inputs.expectedReturn * 100 * 10) / 10))
  if (inputs.swr !== QUICK_ESTIMATE_DEFAULTS.swr) params.set('swr', String(Math.round(inputs.swr * 100 * 10) / 10))
  return params
}

// ── Stage 1: FIRE Estimate ─────────────────────────────────────────────────

export function computeQuickEstimate(inputs: QuickEstimateInputs): QuickEstimateResult {
  const { monthlyIncome, monthlyExpenses, currentSavings, currentAge, expectedReturn, swr } = inputs
  const { inflation, lifeExpectancy, maxYearsToFire } = QUICK_ESTIMATE_DEFAULTS

  const annualExpenses = monthlyExpenses * 12
  const annualSavings = (monthlyIncome - monthlyExpenses) * 12
  const savingsRate = monthlyIncome > 0 ? annualSavings / (monthlyIncome * 12) : 0
  const netRealReturn = expectedReturn - inflation

  const fireNumber = calculateFireNumber(annualExpenses, swr)

  // Determine status
  let status: QuickEstimateStatus = 'ok'
  if (monthlyIncome <= 0) {
    status = 'no-income'
  } else if (currentSavings >= fireNumber && fireNumber > 0) {
    status = 'already-fire'
  } else if (annualSavings <= 0) {
    status = 'negative-savings'
  }

  let yearsToFire = Infinity
  let fireAge = Infinity

  if (status === 'ok' || status === 'already-fire') {
    yearsToFire = calculateYearsToFire(netRealReturn, annualSavings, currentSavings, fireNumber)
    fireAge = currentAge + yearsToFire

    if (yearsToFire > maxYearsToFire || !isFinite(yearsToFire)) {
      status = status === 'already-fire' ? 'already-fire' : 'unreachable'
      yearsToFire = Infinity
      fireAge = Infinity
    }
  }

  // Always compute trajectory for the chart (even in edge cases)
  const trajectory = projectNetWorthPath({
    currentAge,
    annualSavings: Math.max(0, annualSavings),
    currentNW: currentSavings,
    realReturn: netRealReturn,
    annualExpenses,
    fireNumber,
    lifeExpectancy,
  })

  return {
    status,
    fireNumber,
    yearsToFire,
    fireAge,
    savingsRate,
    annualSavings,
    netRealReturn,
    trajectory,
  }
}

// ── Stage 2: Health Score Mapping ──────────────────────────────────────────

export function buildHealthInputs(
  stage1: QuickEstimateInputs,
  stage2: QuickHealthInputs,
): HealthRatioInputs {
  const { monthlyIncome, monthlyExpenses, currentSavings } = stage1
  const { cashSavings, outstandingDebt } = stage2

  // Heuristic: assume 10yr (120 month) repayment for total debt
  const monthlyDebtPayment = outstandingDebt > 0 ? outstandingDebt / 120 : 0

  return {
    cashSavings,
    grossMonthlyIncome: monthlyIncome,
    netMonthlyIncome: monthlyIncome,
    monthlyExpenses,
    totalMonthlyDebtPayments: monthlyDebtPayment,
    nonMortgageDebtMonthlyPayment: monthlyDebtPayment,
    totalDebt: outstandingDebt,
    totalAssets: currentSavings,
    netWorth: currentSavings - outstandingDebt,
    investedAssets: Math.max(0, currentSavings - cashSavings),
  }
}
