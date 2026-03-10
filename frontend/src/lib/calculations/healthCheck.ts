/**
 * Financial Health Check calculation module.
 * Computes 8 financial health ratios, classifies them as green/amber/red,
 * and produces an overall health check result.
 */

import {
  type TrafficLight,
  type HealthRatioMeta,
  HEALTH_RATIOS,
  HEALTH_RATIO_LOOKUP,
} from '@/lib/data/healthBenchmarks'

// ── Types ──────────────────────────────────────────────────────────────────

export interface HealthRatioInputs {
  cashSavings: number
  grossMonthlyIncome: number
  netMonthlyIncome: number
  monthlyExpenses: number
  totalMonthlyDebtPayments: number
  nonMortgageDebtMonthlyPayment: number
  totalDebt: number
  totalAssets: number
  netWorth: number
  investedAssets: number
}

export interface HealthRatioResult {
  id: string
  meta: HealthRatioMeta
  value: number | null
  status: TrafficLight | null
  displayValue: string
  message: string | null
}

export interface HealthCheckResult {
  ratios: HealthRatioResult[]
  greenCount: number
  amberCount: number
  redCount: number
  nullCount: number
  overallStatus: TrafficLight
}

// ── Ratio Computers ────────────────────────────────────────────────────────

type RatioComputer = (inputs: HealthRatioInputs) => { value: number | null; message: string | null }

const RATIO_COMPUTERS: Record<string, RatioComputer> = {
  'emergency-fund': (i) => {
    if (i.monthlyExpenses === 0) return { value: null, message: 'No expenses entered' }
    return { value: i.cashSavings / i.monthlyExpenses, message: null }
  },
  'savings-ratio': (i) => {
    if (i.netMonthlyIncome === 0) return { value: null, message: 'No income entered' }
    const ratio = (i.netMonthlyIncome - i.monthlyExpenses) / i.netMonthlyIncome
    if (ratio < 0) return { value: ratio, message: 'Expenses exceed income' }
    return { value: ratio, message: null }
  },
  'tdsr': (i) => {
    if (i.grossMonthlyIncome === 0) return { value: null, message: 'No income entered' }
    if (i.totalMonthlyDebtPayments === 0) return { value: 0, message: 'No debt' }
    return { value: i.totalMonthlyDebtPayments / i.grossMonthlyIncome, message: null }
  },
  'non-mortgage-dsr': (i) => {
    if (i.grossMonthlyIncome === 0) return { value: null, message: 'No income entered' }
    if (i.nonMortgageDebtMonthlyPayment === 0) return { value: 0, message: 'No non-mortgage debt' }
    return { value: i.nonMortgageDebtMonthlyPayment / i.grossMonthlyIncome, message: null }
  },
  'debt-to-asset': (i) => {
    if (i.totalAssets === 0) return { value: null, message: 'No assets entered' }
    if (i.totalDebt === 0) return { value: 0, message: 'No debt' }
    return { value: i.totalDebt / i.totalAssets, message: null }
  },
  // TODO(v2/W8): Consider returning red status for negative NW instead of null.
  // Currently null means "can't compute" which may understate risk in the overall score.
  'liquid-to-nw': (i) => {
    if (i.netWorth <= 0) return { value: null, message: i.netWorth < 0 ? 'Negative net worth' : 'Zero net worth' }
    return { value: i.cashSavings / i.netWorth, message: null }
  },
  'investment-to-nw': (i) => {
    if (i.netWorth <= 0) return { value: null, message: i.netWorth < 0 ? 'Negative net worth' : 'Zero net worth' }
    return { value: i.investedAssets / i.netWorth, message: null }
  },
  'solvency': (i) => {
    if (i.totalAssets === 0) return { value: null, message: 'No assets entered' }
    const ratio = i.netWorth / i.totalAssets
    if (ratio < 0) return { value: ratio, message: 'Net worth is negative' }
    return { value: ratio, message: null }
  },
}

// ── Classification ─────────────────────────────────────────────────────────

function classifyValue(meta: HealthRatioMeta, value: number): TrafficLight {
  const { greenBound, amberBound } = meta.thresholds

  if (meta.direction === 'higher-is-better') {
    // higher-is-better: green >= greenBound, amber >= amberBound, else red
    if (value >= greenBound) return 'green'
    if (value >= amberBound) return 'amber'
    return 'red'
  } else {
    // lower-is-better: green <= greenBound, amber <= amberBound, else red
    if (value <= greenBound) return 'green'
    if (value <= amberBound) return 'amber'
    return 'red'
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────

function formatValue(value: number | null, unit: HealthRatioMeta['unit']): string {
  if (value === null) return '—'

  switch (unit) {
    case 'months':
      return `${value.toFixed(1)} mo`
    case '%':
      return `${(value * 100).toFixed(1)}%`
    case 'ratio':
      return value.toFixed(2)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function computeRatioValue(ratioId: string, inputs: HealthRatioInputs): number | null {
  const computer = RATIO_COMPUTERS[ratioId]
  if (!computer) return null
  return computer(inputs).value
}

export function classifyRatio(ratioId: string, value: number | null): TrafficLight | null {
  if (value === null) return null
  const meta = HEALTH_RATIO_LOOKUP[ratioId]
  if (!meta) return null
  return classifyValue(meta, value)
}

export function computeHealthRatios(inputs: HealthRatioInputs): HealthCheckResult {
  const ratios: HealthRatioResult[] = HEALTH_RATIOS.map((meta) => {
    const computer = RATIO_COMPUTERS[meta.id]
    if (!computer) {
      return {
        id: meta.id,
        meta,
        value: null,
        status: null,
        displayValue: '—',
        message: `No computer for ratio: ${meta.id}`,
      }
    }

    const { value, message } = computer(inputs)
    const status = value !== null ? classifyValue(meta, value) : null
    const displayValue = formatValue(value, meta.unit)

    return { id: meta.id, meta, value, status, displayValue, message }
  })

  let greenCount = 0
  let amberCount = 0
  let redCount = 0
  let nullCount = 0

  for (const r of ratios) {
    switch (r.status) {
      case 'green': greenCount++; break
      case 'amber': amberCount++; break
      case 'red': redCount++; break
      default: nullCount++; break
    }
  }

  // Overall status: worst-case. Any red → red, any amber → amber,
  // all null → amber (no data to assess), otherwise green.
  let overallStatus: TrafficLight
  if (redCount > 0) {
    overallStatus = 'red'
  } else if (amberCount > 0) {
    overallStatus = 'amber'
  } else if (nullCount === ratios.length) {
    overallStatus = 'amber'
  } else {
    overallStatus = 'green'
  }

  return { ratios, greenCount, amberCount, redCount, nullCount, overallStatus }
}
