/**
 * Historical Backtesting Engine.
 * TypeScript port of backend/app/core/backtest.py.
 *
 * Bengen-style rolling window analysis over every possible start year.
 * Uses the embedded historical return data from historicalReturnsFull.ts.
 *
 * Supports 3 dataset modes: us_only, sg_only, blended.
 * All 6 withdrawal strategies are dispatched directly (no coupling to MC internals).
 */

import {
  HISTORICAL_RETURNS,
  type HistoricalReturnRow,
} from '@/lib/data/historicalReturnsFull.ts'
import {
  computeWithdrawal,
} from '@/lib/calculations/withdrawal.ts'
import type { PerYearResult, BacktestSummary, HeatmapData, RetirementMitigationConfig } from '@/lib/types.ts'

// ============================================================
// Types
// ============================================================

export interface BacktestEngineParams {
  initialPortfolio: number
  allocationWeights: number[]        // 8 weights in asset class order
  swr: number
  retirementDuration: number
  dataset: 'us_only' | 'sg_only' | 'blended'
  blendRatio: number                 // weight on US side when dataset='blended'
  expenseRatio: number
  withdrawalStrategy: string
  strategyParams: Record<string, number>
  inflation: number
  oneTimeWithdrawals?: { year: number; amount: number }[]  // year-offset → amount
  postRetirementIncome?: number[]  // per-year income that reduces net withdrawal (CPF LIFE, rental, etc.)
  retirementMitigation?: RetirementMitigationConfig
  annualExpensesAtRetirement?: number
  withdrawalBasis: 'expenses' | 'rate'
  yearlyWeights?: number[][]         // per-year allocation weights for glide path (nYears × 8)
}

export interface BacktestEngineResult {
  results: PerYearResult[]
  summary: BacktestSummary
}

// ============================================================
// Asset column order
// The 8 weights correspond to the columns in this exact order,
// mirroring COLUMNS_ORDER in the Python backtest.py:
//   [usEquities, sgEquities, intlEquities, usBonds, reits, gold, cash, cpfBlended]
// ============================================================

type ReturnColumn = keyof Pick<
  HistoricalReturnRow,
  'usEquities' | 'sgEquities' | 'intlEquities' | 'usBonds' | 'reits' | 'gold' | 'cash' | 'cpfBlended'
>

/** Dot product of two equal-length arrays. Used for per-year weight × asset return. */
function dotProduct(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

const ASSET_COLUMNS: ReturnColumn[] = [
  'usEquities',
  'sgEquities',
  'intlEquities',
  'usBonds',
  'reits',
  'gold',
  'cash',
  'cpfBlended',
]

// ============================================================
// Portfolio return computation
// ============================================================

/**
 * Compute annual portfolio returns for each historical year, applying
 * allocation weights and dataset-mode adjustments.
 *
 * Returns a tuple [portfolioReturns, inflationRates] aligned by row index.
 * portfolioReturns[i] = weighted sum of asset returns for HISTORICAL_RETURNS[i].
 * inflationRates[i]   = CPI for that year (null when unavailable).
 */
function getPortfolioReturns(
  weights: number[],
  dataset: BacktestEngineParams['dataset'],
  blendRatio: number,
): { portfolioReturns: number[]; assetReturnRows: number[][]; inflationRates: (number | null)[]; years: number[] } {
  const portfolioReturns: number[] = []
  const assetReturnRows: number[][] = []
  const inflationRates: (number | null)[] = []
  const years: number[] = []

  const needsSg = dataset === 'sg_only' || dataset === 'blended'

  for (const row of HISTORICAL_RETURNS) {
    // Skip years where SG equity data is missing when the dataset uses it
    if (needsSg && row.sgEquities === null) continue

    // Collect the 8 raw returns (default null → 0 for computation purposes)
    const raw: number[] = ASSET_COLUMNS.map((col) => {
      const v = row[col]
      return v !== null ? v : 0
    })

    // Apply dataset-mode adjustments (matching Python _get_portfolio_returns)
    const returns = [...raw]

    if (dataset === 'sg_only') {
      // Replace US Eq (idx 0) and Intl Eq (idx 2) with SG Eq (idx 1)
      returns[0] = raw[1] // US Eq → SG Eq
      returns[2] = raw[1] // Intl Eq → SG Eq
    } else if (dataset === 'blended') {
      const blended = blendRatio * raw[0] + (1 - blendRatio) * raw[1]
      returns[0] = blended // US Eq slot → blended
      returns[2] = blended // Intl Eq slot → blended
    }
    // 'us_only' uses returns as-is

    assetReturnRows.push(returns)

    // Portfolio return = dot(weights, returns)
    let portReturn = 0
    for (let i = 0; i < 8; i++) {
      portReturn += weights[i] * returns[i]
    }

    portfolioReturns.push(portReturn)

    // Pick CPI series: SG for sg_only, US otherwise
    const cpi = dataset === 'sg_only' ? row.sgCpi : row.usCpi
    inflationRates.push(cpi)
    years.push(row.year)
  }

  return { portfolioReturns, assetReturnRows, inflationRates, years }
}

// ============================================================
// Single rolling window
// ============================================================

interface WindowResult {
  survived: boolean
  endingBalance: number
  minBalance: number
  worstYearOffset: number
  bestYearOffset: number
  totalWithdrawn: number
}

function runSingleWindow(
  portfolioReturns: number[],
  inflationRates: (number | null)[],
  startIdx: number,
  duration: number,
  initialPortfolio: number,
  swr: number,
  expenseRatio: number,
  inflationFixed: number,
  strategy: string,
  strategyParams: Record<string, number>,
  oneTimeWithdrawals?: { year: number; amount: number }[],
  annualExpensesAtRetirement: number = 0,
  withdrawalBasis: 'expenses' | 'rate' = 'expenses',
  postRetirementIncome?: number[],
  assetReturnRows?: number[][],
  yearlyWeights?: number[][],
): WindowResult {
  let portfolio = initialPortfolio
  // Use user's actual retirement expenses when available and withdrawalBasis is 'expenses';
  // fall back to portfolio × SWR rate when no expenses are specified or when the user
  // has explicitly chosen rate-driven withdrawal (withdrawalBasis === 'rate').
  const initialWithdrawal = annualExpensesAtRetirement > 0 && withdrawalBasis !== 'rate'
    ? annualExpensesAtRetirement
    : initialPortfolio * swr
  let prevWithdrawal = 0
  let prevPortfolio = initialPortfolio
  let totalWithdrawn = 0
  let minBalance = initialPortfolio
  let worstYearOffset = 0
  let bestYearOffset = 0
  let bestBalance = initialPortfolio
  let survived = true
  let prevYearReturn: number | undefined = undefined

  for (let y = 0; y < duration; y++) {
    const idx = startIdx + y
    if (idx >= portfolioReturns.length) break

    if (portfolio <= 0) {
      survived = false
      break
    }

    // When glide path is active (yearlyWeights + assetReturnRows), compute per-year portfolio return
    const ret = (yearlyWeights && assetReturnRows)
      ? dotProduct(assetReturnRows[idx], yearlyWeights[y] ?? yearlyWeights[yearlyWeights.length - 1])
      : portfolioReturns[idx]
    const rawCpi = inflationRates[idx]
    const inf = rawCpi !== null ? rawCpi : inflationFixed
    const remaining = duration - y

    // Previous year gains for sensible_withdrawals
    const prevYearGains = y > 0
      ? portfolio - prevPortfolio + prevWithdrawal
      : 0

    const withdrawal = computeWithdrawal(strategy, {
      portfolio,
      year: y,
      remainingYears: remaining,
      initialWithdrawal,
      prevWithdrawal,
      inflation: inf,
      strategyParams,
      prevYearReturn,
      prevYearGains,
    })

    // Add one-time withdrawals for this year offset
    const oneTime = (oneTimeWithdrawals ?? [])
      .filter(w => w.year === y)
      .reduce((sum, w) => sum + w.amount, 0)

    // Subtract post-retirement income (CPF LIFE, rental, etc.)
    // Matches MC engine (monteCarlo.ts:457) and SR engine (sequenceRisk.ts:204) patterns
    const income = postRetirementIncome?.[y] ?? 0
    let netWithdrawal = Math.max(0, (withdrawal + oneTime) - income)
    netWithdrawal = Math.min(netWithdrawal, portfolio)

    totalWithdrawn += netWithdrawal
    prevWithdrawal = withdrawal  // gross, for strategy feedback (inflation-adjusted constant dollar, etc.)
    prevPortfolio = portfolio
    prevYearReturn = ret

    portfolio = (portfolio - netWithdrawal) * (1 + ret - expenseRatio)

    if (portfolio < minBalance) {
      minBalance = portfolio
      worstYearOffset = y
    }
    if (portfolio > bestBalance) {
      bestBalance = portfolio
      bestYearOffset = y
    }

    if (portfolio <= 0) {
      survived = false
      portfolio = 0
      break
    }
  }

  return {
    survived,
    endingBalance: Math.max(0, portfolio),
    minBalance: Math.max(0, minBalance),
    worstYearOffset,
    bestYearOffset,
    totalWithdrawn,
  }
}

// ============================================================
// Detailed single window (year-by-year data for drill-down)
// ============================================================

export interface DetailedWindowResult {
  survived: boolean
  endingBalance: number
  years: number[]            // [startYear, startYear+1, ...]
  yearlyBalances: number[]   // portfolio value at end of each year
  yearlyWithdrawals: number[] // withdrawal amount each year
  yearlyReturns: number[]    // historical portfolio return each year
  yearlyInflation: number[]  // CPI rate each year
}

/**
 * Run a single backtest window and return year-by-year detail.
 * Same logic as runSingleWindow but collects per-year arrays.
 */
export function runDetailedWindow(
  params: BacktestEngineParams,
  startYear: number,
): DetailedWindowResult {
  const {
    initialPortfolio,
    allocationWeights,
    swr,
    retirementDuration,
    dataset,
    blendRatio,
    expenseRatio,
    inflation: inflationFixed,
    withdrawalStrategy,
    strategyParams,
    oneTimeWithdrawals,
    postRetirementIncome,
    annualExpensesAtRetirement,
    withdrawalBasis,
    yearlyWeights,
  } = params
  const expenses = annualExpensesAtRetirement ?? 0

  const { portfolioReturns, assetReturnRows, inflationRates, years } = getPortfolioReturns(
    allocationWeights,
    dataset,
    blendRatio,
  )

  // Find start index
  const startIdx = years.indexOf(startYear)
  if (startIdx === -1) {
    return {
      survived: false,
      endingBalance: 0,
      years: [],
      yearlyBalances: [],
      yearlyWithdrawals: [],
      yearlyReturns: [],
      yearlyInflation: [],
    }
  }

  let portfolio = initialPortfolio
  // Use user's actual retirement expenses when available and withdrawalBasis is 'expenses';
  // fall back to portfolio × SWR rate when no expenses are specified or when the user
  // has explicitly chosen rate-driven withdrawal (withdrawalBasis === 'rate').
  const initialWithdrawal = expenses > 0 && withdrawalBasis !== 'rate'
    ? expenses
    : initialPortfolio * swr
  let prevWithdrawal = 0
  let prevPortfolio = initialPortfolio
  let survived = true
  let prevYearReturn: number | undefined = undefined

  const outYears: number[] = []
  const outBalances: number[] = []
  const outWithdrawals: number[] = []
  const outReturns: number[] = []
  const outInflation: number[] = []

  for (let y = 0; y < retirementDuration; y++) {
    const idx = startIdx + y
    if (idx >= portfolioReturns.length) break

    if (portfolio <= 0) {
      survived = false
      break
    }

    // When glide path is active, compute per-year portfolio return from asset returns
    const ret = (yearlyWeights && assetReturnRows)
      ? dotProduct(assetReturnRows[idx], yearlyWeights[y] ?? yearlyWeights[yearlyWeights.length - 1])
      : portfolioReturns[idx]
    const rawCpi = inflationRates[idx]
    const inf = rawCpi !== null ? rawCpi : inflationFixed
    const remaining = retirementDuration - y

    // Previous year gains for sensible_withdrawals
    const prevYearGains = y > 0
      ? portfolio - prevPortfolio + prevWithdrawal
      : 0

    const withdrawal = computeWithdrawal(withdrawalStrategy, {
      portfolio,
      year: y,
      remainingYears: remaining,
      initialWithdrawal,
      prevWithdrawal,
      inflation: inf,
      strategyParams,
      prevYearReturn,
      prevYearGains,
    })

    // Add one-time withdrawals for this year offset
    const oneTime = (oneTimeWithdrawals ?? [])
      .filter(w => w.year === y)
      .reduce((sum, w) => sum + w.amount, 0)

    // Subtract post-retirement income (CPF LIFE, rental, etc.)
    const income = postRetirementIncome?.[y] ?? 0
    let netWithdrawal = Math.max(0, (withdrawal + oneTime) - income)
    netWithdrawal = Math.min(netWithdrawal, portfolio)

    prevWithdrawal = withdrawal  // gross, for strategy feedback
    prevPortfolio = portfolio
    prevYearReturn = ret

    portfolio = (portfolio - netWithdrawal) * (1 + ret - expenseRatio)

    if (portfolio <= 0) {
      survived = false
      portfolio = 0
    }

    outYears.push(years[idx])
    outBalances.push(Math.max(0, portfolio))
    outWithdrawals.push(netWithdrawal)
    outReturns.push(ret)
    outInflation.push(inf)
  }

  return {
    survived,
    endingBalance: Math.max(0, portfolio),
    years: outYears,
    yearlyBalances: outBalances,
    yearlyWithdrawals: outWithdrawals,
    yearlyReturns: outReturns,
    yearlyInflation: outInflation,
  }
}

// ============================================================
// Median helper (avoids dependency on stats module)
// ============================================================

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// ============================================================
// Main backtest function
// ============================================================

/**
 * Run Bengen-style rolling window backtest over all available historical start years.
 *
 * For each start year, simulates a `retirementDuration`-year window using
 * actual historical returns and inflation. Returns per-period results and
 * aggregate summary statistics.
 */
export function runBacktest(params: BacktestEngineParams): BacktestEngineResult {
  const {
    initialPortfolio,
    allocationWeights,
    swr,
    retirementDuration,
    dataset,
    blendRatio,
    expenseRatio,
    inflation: inflationFixed,
    withdrawalStrategy,
    strategyParams,
    oneTimeWithdrawals,
    postRetirementIncome,
    annualExpensesAtRetirement,
    withdrawalBasis,
    yearlyWeights,
  } = params

  const { portfolioReturns, assetReturnRows, inflationRates, years } = getPortfolioReturns(
    allocationWeights,
    dataset,
    blendRatio,
  )

  const results: PerYearResult[] = []
  const nTotal = portfolioReturns.length - retirementDuration + 1

  for (let i = 0; i < Math.max(1, nTotal); i++) {
    if (i >= years.length) break

    const startYear = years[i]
    const endYear = startYear + retirementDuration - 1

    const w = runSingleWindow(
      portfolioReturns,
      inflationRates,
      i,
      retirementDuration,
      initialPortfolio,
      swr,
      expenseRatio,
      inflationFixed,
      withdrawalStrategy,
      strategyParams,
      oneTimeWithdrawals,
      annualExpensesAtRetirement,
      withdrawalBasis,
      postRetirementIncome,
      yearlyWeights ? assetReturnRows : undefined,
      yearlyWeights,
    )

    results.push({
      start_year: startYear,
      end_year: endYear,
      survived: w.survived,
      ending_balance: w.endingBalance,
      min_balance: w.minBalance,
      worst_year: startYear + w.worstYearOffset,
      best_year: startYear + w.bestYearOffset,
      total_withdrawn: w.totalWithdrawn,
    })
  }

  // Summary statistics
  const successful = results.filter((r) => r.survived).length
  const failed = results.length - successful
  const successRate = results.length > 0 ? successful / results.length : 0

  const endingBalances = results.map((r) => r.ending_balance)
  const totalWithdrawals = results.map((r) => r.total_withdrawn)

  const worstStart = results.length > 0
    ? results.reduce((acc, r) => (r.ending_balance < acc.ending_balance ? r : acc)).start_year
    : 0
  const bestStart = results.length > 0
    ? results.reduce((acc, r) => (r.ending_balance > acc.ending_balance ? r : acc)).start_year
    : 0

  const avgWithdrawn = totalWithdrawals.length > 0
    ? totalWithdrawals.reduce((a, b) => a + b, 0) / totalWithdrawals.length
    : 0

  const summary: BacktestSummary = {
    total_periods: results.length,
    successful_periods: successful,
    failed_periods: failed,
    success_rate: successRate,
    worst_start_year: worstStart,
    best_start_year: bestStart,
    median_ending_balance: median(endingBalances),
    average_total_withdrawn: avgWithdrawn,
  }

  return { results, summary }
}

// ============================================================
// Heatmap generation
// ============================================================

/**
 * Generate a success-rate heatmap over a grid of SWR values × retirement durations.
 *
 * Runs `runBacktest` for each (swr, duration) combination.
 * Rows = SWR values; columns = duration values.
 */
export function generateHeatmap(
  params: BacktestEngineParams,
  swrRange: [number, number] = [0.03, 0.06],
  swrStep: number = 0.005,
  durationRange: [number, number] = [15, 45],
  durationStep: number = 5,
): HeatmapData {
  // Build SWR values array
  const swrValues: number[] = []
  let s = swrRange[0]
  while (s <= swrRange[1] + 1e-9) {
    swrValues.push(Math.round(s * 10000) / 10000)
    s += swrStep
  }

  // Build duration values array
  const durationValues: number[] = []
  for (let d = durationRange[0]; d <= durationRange[1]; d += durationStep) {
    durationValues.push(d)
  }

  // Compute success rates grid
  const successRates: number[][] = swrValues.map((swr) =>
    durationValues.map((duration) => {
      const result = runBacktest({
        ...params,
        // Heatmap is always rate-driven: each cell tests a specific SWR × duration
        // regardless of withdrawalBasis toggle, since annualExpensesAtRetirement is undefined.
        annualExpensesAtRetirement: undefined,
        swr,
        retirementDuration: duration,
      })
      return result.summary.success_rate
    }),
  )

  return {
    swr_values: swrValues,
    duration_values: durationValues,
    success_rates: successRates,
  }
}
