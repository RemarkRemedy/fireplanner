/**
 * Tests for Historical Backtest Engine (TypeScript port of backend/app/core/backtest.py).
 * TDD: tests written first, implementation follows.
 */

import { describe, it, expect } from 'vitest'
import { runBacktest, generateHeatmap, runDetailedWindow } from './backtest'

// ---------------------------------------------------------------------------
// Shared test params (60/40 US equities/bonds)
// ---------------------------------------------------------------------------

const PARAMS = {
  initialPortfolio: 1_000_000,
  allocationWeights: [0.60, 0, 0, 0.40, 0, 0, 0, 0], // 60/40 US
  swr: 0.04,
  retirementDuration: 30,
  dataset: 'us_only' as const,
  blendRatio: 0.70,
  expenseRatio: 0.003,
  withdrawalStrategy: 'constant_dollar' as const,
  strategyParams: { swr: 0.04 },
  inflation: 0.025,
  withdrawalBasis: 'expenses' as const,
}

// ---------------------------------------------------------------------------
// runBacktest — structure
// ---------------------------------------------------------------------------

describe('runBacktest', () => {
  it('returns results and summary', () => {
    const result = runBacktest(PARAMS)
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('summary')
    expect(result.results.length).toBeGreaterThan(0)
  })

  it('success rate is between 0 and 1', () => {
    const result = runBacktest(PARAMS)
    expect(result.summary.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.summary.success_rate).toBeLessThanOrEqual(1)
  })

  it('each result has required snake_case fields', () => {
    const result = runBacktest(PARAMS)
    const r = result.results[0]
    expect(r).toHaveProperty('start_year')
    expect(r).toHaveProperty('end_year')
    expect(r).toHaveProperty('survived')
    expect(r).toHaveProperty('ending_balance')
    expect(r).toHaveProperty('min_balance')
    expect(r).toHaveProperty('worst_year')
    expect(r).toHaveProperty('best_year')
    expect(r).toHaveProperty('total_withdrawn')
  })

  it('total_periods matches results length', () => {
    const result = runBacktest(PARAMS)
    expect(result.summary.total_periods).toBe(result.results.length)
  })

  it('successful + failed periods sum to total', () => {
    const result = runBacktest(PARAMS)
    const { successful_periods, failed_periods, total_periods } = result.summary
    expect(successful_periods + failed_periods).toBe(total_periods)
  })

  it('start_year and end_year are sequential with correct duration', () => {
    const result = runBacktest(PARAMS)
    for (const r of result.results) {
      expect(r.end_year - r.start_year).toBe(PARAMS.retirementDuration - 1)
    }
  })

  it('ending_balance >= 0 for all results', () => {
    const result = runBacktest(PARAMS)
    for (const r of result.results) {
      expect(r.ending_balance).toBeGreaterThanOrEqual(0)
    }
  })

  it('min_balance <= initial portfolio for all results', () => {
    const result = runBacktest(PARAMS)
    for (const r of result.results) {
      expect(r.min_balance).toBeLessThanOrEqual(PARAMS.initialPortfolio + 1)
    }
  })

  it('total_withdrawn > 0 for all results', () => {
    const result = runBacktest(PARAMS)
    for (const r of result.results) {
      expect(r.total_withdrawn).toBeGreaterThan(0)
    }
  })

  it('worst_start_year and best_start_year are real start years', () => {
    const result = runBacktest(PARAMS)
    const startYears = new Set(result.results.map((r) => r.start_year))
    if (result.results.length > 0) {
      expect(startYears.has(result.summary.worst_start_year)).toBe(true)
      expect(startYears.has(result.summary.best_start_year)).toBe(true)
    }
  })

  it('median_ending_balance >= 0', () => {
    const result = runBacktest(PARAMS)
    expect(result.summary.median_ending_balance).toBeGreaterThanOrEqual(0)
  })

  it('average_total_withdrawn > 0', () => {
    const result = runBacktest(PARAMS)
    expect(result.summary.average_total_withdrawn).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // All 6 withdrawal strategies
  // ---------------------------------------------------------------------------

  it('works with all 12 withdrawal strategies', () => {
    const strategies = [
      'constant_dollar',
      'vpw',
      'guardrails',
      'vanguard_dynamic',
      'cape_based',
      'floor_ceiling',
      'percent_of_portfolio',
      'one_over_n',
      'sensible_withdrawals',
      'ninety_five_percent',
      'endowment',
      'hebeler_autopilot',
    ] as const

    for (const s of strategies) {
      let strategyParams: Record<string, number>

      switch (s) {
        case 'guardrails':
          strategyParams = { initialRate: 0.05, ceilingTrigger: 1.2, floorTrigger: 0.8, adjustmentSize: 0.1 }
          break
        case 'vpw':
          strategyParams = { expectedRealReturn: 0.03, targetEndValue: 0 }
          break
        case 'vanguard_dynamic':
          strategyParams = { swr: 0.04, ceiling: 0.05, floor: 0.025 }
          break
        case 'cape_based':
          strategyParams = { baseRate: 0.04, capeWeight: 0.5, currentCape: 30 }
          break
        case 'floor_ceiling':
          strategyParams = { floorAmount: 40000, ceilingAmount: 100000, targetRate: 0.045 }
          break
        case 'percent_of_portfolio':
          strategyParams = { rate: 0.04 }
          break
        case 'one_over_n':
          strategyParams = {}
          break
        case 'sensible_withdrawals':
          strategyParams = { baseRate: 0.03, extrasRate: 0.10 }
          break
        case 'ninety_five_percent':
          strategyParams = { swr: 0.04 }
          break
        case 'endowment':
          strategyParams = { swr: 0.04, smoothingWeight: 0.70 }
          break
        case 'hebeler_autopilot':
          strategyParams = { expectedRealReturn: 0.03 }
          break
        default:
          strategyParams = { swr: 0.04 }
      }

      const result = runBacktest({
        ...PARAMS,
        withdrawalStrategy: s,
        strategyParams,
      })
      expect(result.summary.success_rate).toBeGreaterThanOrEqual(0)
      expect(result.summary.success_rate).toBeLessThanOrEqual(1)
      expect(result.results.length).toBeGreaterThan(0)
    }
  })

  it('sensible_withdrawals produces finite results with prevYearGains', () => {
    const result = runBacktest({
      ...PARAMS,
      withdrawalStrategy: 'sensible_withdrawals',
      strategyParams: { baseRate: 0.03, extrasRate: 0.10 },
    })
    // Verify no NaN/Infinity in results (would indicate broken prevYearGains tracking)
    for (const r of result.results) {
      expect(Number.isFinite(r.ending_balance)).toBe(true)
      expect(Number.isFinite(r.total_withdrawn)).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // Datasets
  // ---------------------------------------------------------------------------

  it('works with sg_only dataset and starts from 1988', () => {
    const result = runBacktest({ ...PARAMS, dataset: 'sg_only' })
    expect(result.results.length).toBeGreaterThan(0)
    // SG equity data starts in 1988, so far fewer periods than us_only
    const usResult = runBacktest(PARAMS)
    expect(result.results.length).toBeLessThan(usResult.results.length)
    // First period must start from 1988 (first year with STI data)
    expect(result.results[0].start_year).toBe(1988)
  })

  it('works with blended dataset and starts from 1988', () => {
    const result = runBacktest({ ...PARAMS, dataset: 'blended' })
    expect(result.results.length).toBeGreaterThan(0)
    // Blended also uses SG data, so periods start from 1988
    expect(result.results[0].start_year).toBe(1988)
  })

  it('blended dataset with blendRatio=1.0 matches us_only for overlapping periods', () => {
    const blended = runBacktest({ ...PARAMS, dataset: 'blended', blendRatio: 1.0 })
    const usOnly = runBacktest(PARAMS)
    // Blended has fewer periods (restricted to SG data availability)
    expect(blended.results.length).toBeLessThan(usOnly.results.length)
    // For overlapping start years, results should match (blendRatio=1.0 means 100% US returns)
    const usOverlap = usOnly.results.filter(r => r.start_year >= 1988)
    expect(blended.results.length).toBe(usOverlap.length)
    for (let i = 0; i < blended.results.length; i++) {
      expect(blended.results[i].start_year).toBe(usOverlap[i].start_year)
      expect(blended.results[i].ending_balance).toBeCloseTo(usOverlap[i].ending_balance, 0)
    }
  })

  // ---------------------------------------------------------------------------
  // Economic sense checks
  // ---------------------------------------------------------------------------

  it('higher SWR produces lower success rate', () => {
    const low = runBacktest({ ...PARAMS, swr: 0.03 })
    const high = runBacktest({ ...PARAMS, swr: 0.06 })
    expect(low.summary.success_rate).toBeGreaterThanOrEqual(high.summary.success_rate)
  })

  it('shorter duration produces higher success rate', () => {
    const short = runBacktest({ ...PARAMS, retirementDuration: 15 })
    const long = runBacktest({ ...PARAMS, retirementDuration: 40 })
    expect(short.summary.success_rate).toBeGreaterThanOrEqual(long.summary.success_rate)
  })

  it('higher expense ratio lowers success rate', () => {
    const low = runBacktest({ ...PARAMS, expenseRatio: 0.001 })
    const high = runBacktest({ ...PARAMS, expenseRatio: 0.020 })
    expect(low.summary.success_rate).toBeGreaterThanOrEqual(high.summary.success_rate)
  })

  it('100% bonds allocation has lower success rate than 60/40', () => {
    const bondsOnly = runBacktest({
      ...PARAMS,
      allocationWeights: [0, 0, 0, 1.0, 0, 0, 0, 0],
    })
    expect(bondsOnly.summary.success_rate).toBeLessThanOrEqual(
      runBacktest(PARAMS).summary.success_rate,
    )
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('survived=false periods have ending_balance=0', () => {
    // Use aggressive SWR to force some failures
    const result = runBacktest({ ...PARAMS, swr: 0.10, retirementDuration: 40 })
    for (const r of result.results) {
      if (!r.survived) {
        expect(r.ending_balance).toBe(0)
      }
    }
  })

  it('worst_year and best_year are within the window start..end range', () => {
    const result = runBacktest(PARAMS)
    for (const r of result.results) {
      expect(r.worst_year).toBeGreaterThanOrEqual(r.start_year)
      expect(r.worst_year).toBeLessThanOrEqual(r.end_year)
      expect(r.best_year).toBeGreaterThanOrEqual(r.start_year)
      expect(r.best_year).toBeLessThanOrEqual(r.end_year)
    }
  })

  it('falls back to fixed inflation when CPI data is null', () => {
    // This exercises the null-CPI fallback branch. No error thrown = pass.
    const result = runBacktest({ ...PARAMS, inflation: 0.03 })
    expect(result.results.length).toBeGreaterThan(0)
  })

  it('produces 0% survival rate with 100% withdrawal rate', () => {
    // SWR of 1.0 means withdrawing the entire portfolio each year.
    // Over a 10+ year duration, every historical window should fail.
    const result = runBacktest({
      ...PARAMS,
      swr: 1.0,
      retirementDuration: 15,
      withdrawalStrategy: 'constant_dollar',
      strategyParams: { swr: 1.0 },
    })

    // Every window should have failed
    expect(result.summary.success_rate).toBe(0)
    expect(result.summary.failed_periods).toBe(result.summary.total_periods)
    expect(result.summary.successful_periods).toBe(0)

    // Every individual result should show survived === false
    for (const r of result.results) {
      expect(r.survived).toBe(false)
      expect(r.ending_balance).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// generateHeatmap
// ---------------------------------------------------------------------------

describe('generateHeatmap', () => {
  it('returns grid of success rates with correct dimensions', () => {
    const heatmap = generateHeatmap(PARAMS)
    expect(heatmap.swr_values.length).toBeGreaterThan(0)
    expect(heatmap.duration_values.length).toBeGreaterThan(0)
    expect(heatmap.success_rates.length).toBe(heatmap.swr_values.length)
    expect(heatmap.success_rates[0].length).toBe(heatmap.duration_values.length)
  })

  it('all success_rates values are between 0 and 1', () => {
    const heatmap = generateHeatmap(PARAMS)
    for (const row of heatmap.success_rates) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it('generates correct SWR range with default bounds', () => {
    const heatmap = generateHeatmap(PARAMS)
    // Default range 0.03..0.06 step 0.005 => [0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06]
    expect(heatmap.swr_values[0]).toBeCloseTo(0.03, 4)
    expect(heatmap.swr_values[heatmap.swr_values.length - 1]).toBeCloseTo(0.06, 4)
  })

  it('generates correct duration range with default bounds', () => {
    const heatmap = generateHeatmap(PARAMS)
    // Default range 15..45 step 5 => [15, 20, 25, 30, 35, 40, 45]
    expect(heatmap.duration_values[0]).toBe(15)
    expect(heatmap.duration_values[heatmap.duration_values.length - 1]).toBe(45)
  })

  it('accepts custom swr and duration ranges', () => {
    const heatmap = generateHeatmap(
      PARAMS,
      [0.04, 0.05],
      0.01,
      [20, 30],
      10,
    )
    expect(heatmap.swr_values).toEqual([0.04, 0.05])
    expect(heatmap.duration_values).toEqual([20, 30])
    expect(heatmap.success_rates.length).toBe(2)
    expect(heatmap.success_rates[0].length).toBe(2)
  })

  it('higher SWR rows have lower or equal success rates than lower SWR rows (monotone tendency)', () => {
    const heatmap = generateHeatmap(PARAMS, [0.03, 0.06], 0.01, [30, 30], 1)
    // Single duration column — check swr order
    const col = heatmap.success_rates.map((row) => row[0])
    for (let i = 0; i < col.length - 1; i++) {
      // Soft check: average direction should be downward
      expect(col[i]).toBeGreaterThanOrEqual(col[col.length - 1] - 0.15)
    }
  })
})

// ---------------------------------------------------------------------------
// runDetailedWindow
// ---------------------------------------------------------------------------

describe('runDetailedWindow', () => {
  it('returns arrays with correct length for surviving window', () => {
    // Find a start year that survives with these params
    const btResult = runBacktest(PARAMS)
    const survivingWindow = btResult.results.find(r => r.survived)!
    const result = runDetailedWindow(PARAMS, survivingWindow.start_year)

    expect(result.survived).toBe(true)
    expect(result.years.length).toBe(PARAMS.retirementDuration)
    expect(result.yearlyBalances.length).toBe(PARAMS.retirementDuration)
    expect(result.yearlyWithdrawals.length).toBe(PARAMS.retirementDuration)
    expect(result.yearlyReturns.length).toBe(PARAMS.retirementDuration)
    expect(result.yearlyInflation.length).toBe(PARAMS.retirementDuration)
  })

  it('returns shorter arrays when portfolio depletes early', () => {
    // Use aggressive SWR to force depletion
    const aggressiveParams = { ...PARAMS, swr: 0.12, retirementDuration: 40 }
    const btResult = runBacktest(aggressiveParams)
    const failedWindow = btResult.results.find(r => !r.survived)
    if (failedWindow) {
      const result = runDetailedWindow(aggressiveParams, failedWindow.start_year)
      expect(result.survived).toBe(false)
      expect(result.years.length).toBeLessThan(aggressiveParams.retirementDuration)
    }
  })

  it('first year starts at startYear', () => {
    const result = runDetailedWindow(PARAMS, 1950)
    expect(result.years[0]).toBe(1950)
  })

  it('years are sequential', () => {
    const result = runDetailedWindow(PARAMS, 1950)
    for (let i = 1; i < result.years.length; i++) {
      expect(result.years[i]).toBe(result.years[i - 1] + 1)
    }
  })

  it('endingBalance matches last yearlyBalance', () => {
    const result = runDetailedWindow(PARAMS, 1950)
    if (result.yearlyBalances.length > 0) {
      expect(result.endingBalance).toBeCloseTo(
        result.yearlyBalances[result.yearlyBalances.length - 1],
        2,
      )
    }
  })

  it('results match runBacktest summary for same window', () => {
    // Find a start year from runBacktest results
    const btResult = runBacktest(PARAMS)
    const window = btResult.results[0]
    const detail = runDetailedWindow(PARAMS, window.start_year)

    expect(detail.survived).toBe(window.survived)
    expect(detail.endingBalance).toBeCloseTo(window.ending_balance, 2)
  })

  it('returns empty arrays for invalid start year', () => {
    const result = runDetailedWindow(PARAMS, 9999)
    expect(result.survived).toBe(false)
    expect(result.years.length).toBe(0)
  })

  it('all yearlyWithdrawals are non-negative', () => {
    const result = runDetailedWindow(PARAMS, 1950)
    for (const w of result.yearlyWithdrawals) {
      expect(w).toBeGreaterThanOrEqual(0)
    }
  })

  it('all yearlyBalances are non-negative', () => {
    const result = runDetailedWindow(PARAMS, 1950)
    for (const b of result.yearlyBalances) {
      expect(b).toBeGreaterThanOrEqual(0)
    }
  })

  // ---------------------------------------------------------------------------
  // oneTimeWithdrawals
  // ---------------------------------------------------------------------------

  it('oneTimeWithdrawals reduces portfolio at specified year', () => {
    const baseline = runDetailedWindow(PARAMS, 1950)
    const withOneTime = runDetailedWindow(
      { ...PARAMS, oneTimeWithdrawals: [{ year: 5, amount: 100_000 }] },
      1950,
    )

    // Before year 5, balances should be the same
    for (let i = 0; i < 5; i++) {
      expect(withOneTime.yearlyBalances[i]).toBeCloseTo(baseline.yearlyBalances[i], 2)
    }

    // At year 5 and beyond, the one-time withdrawal version should have lower balances
    expect(withOneTime.yearlyBalances[5]).toBeLessThan(baseline.yearlyBalances[5])
  })

  it('oneTimeWithdrawals also affect runBacktest via runSingleWindow', () => {
    const baseline = runBacktest(PARAMS)
    const withOneTime = runBacktest({
      ...PARAMS,
      oneTimeWithdrawals: [{ year: 0, amount: 500_000 }],
    })

    // Large year-0 withdrawal should lower success rate
    expect(withOneTime.summary.success_rate).toBeLessThanOrEqual(baseline.summary.success_rate)
  })
})

// ---------------------------------------------------------------------------
// annualExpensesAtRetirement
// ---------------------------------------------------------------------------

describe('annualExpensesAtRetirement', () => {
  it('runBacktest uses expenses as initial withdrawal instead of portfolio × SWR', () => {
    // With SWR=4%, default withdrawal = 1M × 0.04 = $40K
    // With expenses = $20K, withdrawal should be lower → higher success rate
    const withExpenses = runBacktest({
      ...PARAMS,
      annualExpensesAtRetirement: 20_000,
    })
    const withoutExpenses = runBacktest(PARAMS)

    // Lower withdrawal → more portfolio preserved → higher success rate
    expect(withExpenses.summary.success_rate).toBeGreaterThanOrEqual(
      withoutExpenses.summary.success_rate,
    )
    // Results should actually differ (not silently ignored)
    expect(withExpenses.summary.median_ending_balance).not.toBe(
      withoutExpenses.summary.median_ending_balance,
    )
  })

  it('uses portfolio × SWR when withdrawalBasis is rate', () => {
    const expenseResult = runBacktest({
      ...PARAMS,
      annualExpensesAtRetirement: 48000,
      withdrawalBasis: 'expenses',
    })
    const rateResult = runBacktest({
      ...PARAMS,
      annualExpensesAtRetirement: 48000,
      withdrawalBasis: 'rate',
    })
    // Rate-driven ($1M × 4% = $40K) withdraws less than expense-driven ($48K)
    expect(rateResult.summary.success_rate).toBeGreaterThan(expenseResult.summary.success_rate)
  })

  it('runDetailedWindow respects withdrawalBasis - expense vs rate produces different withdrawals', () => {
    const expenseParams = { ...PARAMS, annualExpensesAtRetirement: 48_000, withdrawalBasis: 'expenses' as const }
    const rateParams = { ...PARAMS, annualExpensesAtRetirement: 48_000, withdrawalBasis: 'rate' as const }

    const expDetail = runDetailedWindow(expenseParams, 1950)
    const rateDetail = runDetailedWindow(rateParams, 1950)

    // Rate-based: $1M × 4% = $40K, expense-based: $48K — first withdrawal must differ
    expect(expDetail.yearlyWithdrawals[0]).not.toBeCloseTo(rateDetail.yearlyWithdrawals[0], 0)
  })

  it('generateHeatmap ignores annualExpensesAtRetirement so SWR axis varies', () => {
    // If expenses leaked through, every cell in the SWR axis would produce
    // identical success rates because the withdrawal is fixed at the expense amount.
    const heatmap = generateHeatmap(
      { ...PARAMS, annualExpensesAtRetirement: 20_000 },
      [0.03, 0.06],
      0.03,  // just 2 SWR values for speed
      [30, 30],
      1,     // single duration
    )

    // The two SWR values (3% and 6%) should produce different success rates
    expect(heatmap.success_rates[0][0]).not.toBe(heatmap.success_rates[1][0])
  })
})

// ---------------------------------------------------------------------------
// postRetirementIncome
// ---------------------------------------------------------------------------

describe('postRetirementIncome', () => {
  it('improves survival rate when income offsets withdrawals', () => {
    // Without income: 4% SWR on $1M = $40K/year withdrawal
    const baseResult = runBacktest(PARAMS)

    // With $20K/year income: net withdrawal drops to ~$20K/year
    const incomeArray = Array.from({ length: 30 }, () => 20_000)
    const withIncome = runBacktest({
      ...PARAMS,
      postRetirementIncome: incomeArray,
    })

    // Income should improve or maintain survival rate
    expect(withIncome.summary.success_rate).toBeGreaterThanOrEqual(baseResult.summary.success_rate)
  })

  it('produces identical results when undefined (backward compat)', () => {
    const withoutIncome = runBacktest(PARAMS)
    const withUndefined = runBacktest({ ...PARAMS, postRetirementIncome: undefined })
    const withEmpty = runBacktest({ ...PARAMS, postRetirementIncome: [] })

    expect(withUndefined.summary.success_rate).toBe(withoutIncome.summary.success_rate)
    expect(withEmpty.summary.success_rate).toBe(withoutIncome.summary.success_rate)
  })

  it('negative income increases effective withdrawal', () => {
    // Negative income (e.g., mortgage exceeds rental) means portfolio must fund MORE
    const negativeIncome = Array.from({ length: 30 }, () => -10_000)
    const baseResult = runBacktest(PARAMS)
    const withNegative = runBacktest({
      ...PARAMS,
      postRetirementIncome: negativeIncome,
    })

    // Negative income should worsen or maintain survival rate
    expect(withNegative.summary.success_rate).toBeLessThanOrEqual(baseResult.summary.success_rate)
  })

  it('works with detailed window', () => {
    const incomeArray = Array.from({ length: 30 }, () => 15_000)
    const detailed = runDetailedWindow(
      { ...PARAMS, postRetirementIncome: incomeArray },
      1970,
    )

    // Detailed window should return valid data
    expect(detailed.yearlyWithdrawals.length).toBeGreaterThan(0)
    // With income, net withdrawals should be less than without income
    const detailedNoIncome = runDetailedWindow(PARAMS, 1970)
    const avgWithIncome = detailed.yearlyWithdrawals.reduce((a, b) => a + b, 0) / detailed.yearlyWithdrawals.length
    const avgWithout = detailedNoIncome.yearlyWithdrawals.reduce((a, b) => a + b, 0) / detailedNoIncome.yearlyWithdrawals.length
    expect(avgWithIncome).toBeLessThanOrEqual(avgWithout)
  })
})

// ---------------------------------------------------------------------------
// Glide path (yearlyWeights) — per-year allocation
// ---------------------------------------------------------------------------

describe('backtest with yearlyWeights (glide path)', () => {
  it('yearlyWeights produces different results from fixed weights', () => {
    // Fixed: 80/20 for all years
    const fixedResult = runBacktest({
      ...PARAMS,
      allocationWeights: [0.80, 0, 0, 0.20, 0, 0, 0, 0],
    })

    // Glide: start at 80/20, transition to 30/70 over the 30-year window
    const nYears = PARAMS.retirementDuration
    const yearlyWeights = Array.from({ length: nYears }, (_, y) => {
      const t = y / (nYears - 1)
      const eq = 0.80 - 0.50 * t
      const bond = 0.20 + 0.50 * t
      return [eq, 0, 0, bond, 0, 0, 0, 0]
    })
    const glideResult = runBacktest({
      ...PARAMS,
      allocationWeights: [0.80, 0, 0, 0.20, 0, 0, 0, 0],
      yearlyWeights,
    })

    // Results should differ because weight allocation changes per year
    expect(glideResult.summary.success_rate).not.toBe(fixedResult.summary.success_rate)
  })

  it('undefined yearlyWeights preserves original behavior', () => {
    const baseResult = runBacktest(PARAMS)
    const explicitUndefined = runBacktest({ ...PARAMS, yearlyWeights: undefined })
    expect(explicitUndefined.summary.success_rate).toBe(baseResult.summary.success_rate)
    expect(explicitUndefined.summary.median_ending_balance).toBe(baseResult.summary.median_ending_balance)
  })

  it('constant yearlyWeights (all same) matches fixed weights', () => {
    const nYears = PARAMS.retirementDuration
    const constantWeights = Array.from({ length: nYears }, () => [...PARAMS.allocationWeights])
    const constResult = runBacktest({ ...PARAMS, yearlyWeights: constantWeights })
    const fixedResult = runBacktest(PARAMS)
    // Should produce identical results since per-year weights === fixed weights
    expect(constResult.summary.success_rate).toBe(fixedResult.summary.success_rate)
    expect(constResult.summary.median_ending_balance).toBeCloseTo(fixedResult.summary.median_ending_balance, 0)
  })

  it('runDetailedWindow respects yearlyWeights', () => {
    const nYears = PARAMS.retirementDuration
    const yearlyWeights = Array.from({ length: nYears }, (_, y) => {
      const t = y / (nYears - 1)
      return [0.60 - 0.30 * t, 0, 0, 0.40 + 0.30 * t, 0, 0, 0, 0]
    })
    const glideDetailed = runDetailedWindow({ ...PARAMS, yearlyWeights }, 1970)
    const fixedDetailed = runDetailedWindow(PARAMS, 1970)
    // Different weights should yield different yearly returns
    const glideReturns = glideDetailed.yearlyReturns
    const fixedReturns = fixedDetailed.yearlyReturns
    const anyDifferent = glideReturns.some((r, i) => Math.abs(r - fixedReturns[i]) > 1e-10)
    expect(anyDifferent).toBe(true)
  })
})
