/**
 * Cash Reserve / Emergency Fund calculation.
 *
 * Computes how annual savings are split between a cash reserve and
 * investable savings during the accumulation phase. The reserve fills
 * first; once at target, all savings flow to the portfolio.
 *
 * This is a post-processing step — it runs AFTER the income engine
 * and BEFORE the MC engine, keeping both pure.
 */

export interface CashReservePlanParams {
  mode: 'fixed' | 'months'
  /** Fixed-mode target amount. Ignored in months mode. */
  target: number
  /** Number of months of expenses for months mode (e.g., 6). Ignored in fixed mode. */
  months: number
  /** Initial reserve balance (carved from liquidNetWorth). */
  initialBalance: number
  /** Annual savings from income projection (pre-retirement years). */
  annualSavingsArray: number[]
  /** Return on cash reserve, e.g., 0.02 for savings account. */
  cashReturn: number
  /** Inflation rate, used in months mode to grow the target. */
  inflationRate: number
  /** Base annual expenses (year 0), used in months mode. */
  annualExpenses: number
}

export interface CashReservePlan {
  /** Savings flowing to portfolio each year (annualSavings - diversion). */
  investedSavings: number[]
  /** Reserve balance at each year-end. */
  reserveBalance: number[]
  /** Target at each year (constant in fixed mode, inflation-adjusted in months mode). */
  reserveTarget: number[]
}

export function computeCashReservePlan(params: CashReservePlanParams): CashReservePlan {
  const {
    mode,
    target: fixedTarget,
    months,
    initialBalance,
    annualSavingsArray,
    cashReturn,
    inflationRate,
    annualExpenses,
  } = params

  const n = annualSavingsArray.length
  const investedSavings: number[] = new Array(n)
  const reserveBalance: number[] = new Array(n)
  const reserveTarget: number[] = new Array(n)

  let balance = initialBalance

  for (let t = 0; t < n; t++) {
    // 1. Compute target for this year
    const target = mode === 'fixed'
      ? fixedTarget
      : (annualExpenses * Math.pow(1 + inflationRate, t)) / 12 * months
    reserveTarget[t] = target

    // 2. Grow reserve by cash return
    balance = balance * (1 + cashReturn)

    // 3. Compute shortfall and diversion
    const shortfall = Math.max(0, target - balance)
    const diversion = Math.min(shortfall, annualSavingsArray[t])
    balance += diversion

    // 4. Remainder flows to portfolio
    investedSavings[t] = annualSavingsArray[t] - diversion
    reserveBalance[t] = balance
  }

  return { investedSavings, reserveBalance, reserveTarget }
}

/**
 * Compute the initial cash reserve offset from liquid net worth.
 * Returns the amount carved out of liquidNetWorth to pre-fund the reserve.
 * Reserve dollars are carved out first; only the remainder stays investable.
 */
export function computeCashReserveOffset(
  liquidNetWorth: number,
  cashReserveEnabled: boolean,
  mode: 'fixed' | 'months',
  fixedAmount: number,
  months: number,
  annualExpenses: number,
): number {
  if (!cashReserveEnabled) return 0
  const target = mode === 'fixed' ? fixedAmount : (annualExpenses / 12) * months
  return Math.min(Math.max(0, liquidNetWorth), target)
}
