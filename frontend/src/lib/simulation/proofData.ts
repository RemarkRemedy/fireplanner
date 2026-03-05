import { generateProjection, type ProjectionParams } from '@/lib/calculations/projection'
import { HISTORICAL_RETURNS, type HistoricalReturnRow } from '@/lib/data/historicalReturnsFull.ts'
import { percentile } from '@/lib/math/stats'
import type { MonteCarloResult, ProofCycle, ProofProvenance, RepresentativePath } from '@/lib/types'

interface CalibrationModel {
  alpha: number
  beta: number
  residuals: number[]
}

export interface SgProxyDiagnostics {
  overlapYears: number
  missingYears: number
  alpha: number
  beta: number
  residualMean: number
  residualStdDev: number
  residualP10: number
  residualP90: number
}

const ASSET_COLUMNS: Array<keyof Pick<
  HistoricalReturnRow,
  'usEquities' | 'sgEquities' | 'intlEquities' | 'usBonds' | 'reits' | 'gold' | 'cash' | 'cpfBlended'
>> = [
  'usEquities',
  'sgEquities',
  'intlEquities',
  'usBonds',
  'reits',
  'gold',
  'cash',
  'cpfBlended',
]

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = average(values)
  const variance = values.reduce((sum, v) => {
    const d = v - mean
    return sum + d * d
  }, 0) / values.length
  return Math.sqrt(variance)
}

function toPathLabel(path: RepresentativePath, fallbackIndex: number): string {
  if (path.label) return path.label
  if (path.kind === 'best') return 'Best'
  if (path.kind === 'worst') return 'Worst'
  if (typeof path.percentile === 'number') return `P${path.percentile}`
  return `Path ${fallbackIndex + 1}`
}

function normalizeWeights(weights: number[]): number[] {
  if (weights.length === 0) return []
  const sum = weights.reduce((acc, w) => acc + w, 0)
  if (sum <= 0) return weights.map(() => 0)
  return weights.map((w) => w / sum)
}

function dot(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) sum += a[i] * b[i]
  return sum
}

export function calibrateSgProxy(rows: typeof HISTORICAL_RETURNS): CalibrationModel {
  const overlap = rows.filter((r) => r.usEquities !== null && r.sgEquities !== null)
  if (overlap.length < 2) {
    return { alpha: 0, beta: 1, residuals: [0] }
  }

  const us = overlap.map((r) => r.usEquities ?? 0)
  const sg = overlap.map((r) => r.sgEquities ?? 0)
  const meanUs = average(us)
  const meanSg = average(sg)

  let cov = 0
  let varUs = 0
  for (let i = 0; i < overlap.length; i++) {
    cov += (us[i] - meanUs) * (sg[i] - meanSg)
    varUs += (us[i] - meanUs) * (us[i] - meanUs)
  }

  const beta = varUs === 0 ? 1 : cov / varUs
  const alpha = meanSg - beta * meanUs
  const residuals = overlap.map((r) => (r.sgEquities ?? 0) - (alpha + beta * (r.usEquities ?? 0)))

  return {
    alpha,
    beta,
    residuals: residuals.length > 0 ? residuals : [0],
  }
}

export function getSgProxyDiagnostics(
  rows: typeof HISTORICAL_RETURNS = HISTORICAL_RETURNS,
): SgProxyDiagnostics {
  const overlapYears = rows.filter((r) => r.usEquities !== null && r.sgEquities !== null).length
  const missingYears = rows.filter((r) => r.sgEquities === null).length
  const model = calibrateSgProxy(rows)

  return {
    overlapYears,
    missingYears,
    alpha: model.alpha,
    beta: model.beta,
    residualMean: average(model.residuals),
    residualStdDev: stdDev(model.residuals),
    residualP10: percentile(model.residuals, 10),
    residualP90: percentile(model.residuals, 90),
  }
}

function classifyProvenance(sgWasMissing: boolean, blendRatio: number): ProofProvenance {
  if (!sgWasMissing) return 'actual'
  if (blendRatio <= 0.001) return 'proxy'
  if (blendRatio >= 0.999) return 'actual'
  return 'mixed'
}

function buildHistoricalBlendedReturns(weights: number[], blendRatio: number) {
  const normalizedWeights = normalizeWeights(weights)
  const model = calibrateSgProxy(HISTORICAL_RETURNS)

  const yearlyReturns: number[] = []
  const provenance: ProofProvenance[] = []
  const years: number[] = []

  const residualCount = model.residuals.length

  for (let i = 0; i < HISTORICAL_RETURNS.length; i++) {
    const row = HISTORICAL_RETURNS[i]
    const us = row.usEquities ?? 0
    const sgMissing = row.sgEquities === null

    const residual = model.residuals[i % residualCount]
    const proxySg = model.alpha + model.beta * us + residual
    const sg = row.sgEquities ?? proxySg

    const assetReturns = ASSET_COLUMNS.map((col) => {
      const raw = row[col]
      return raw !== null ? raw : 0
    })

    // Replace US Equities (idx 0) and Intl Equities (idx 2) with the same blended
    // US/SG equity return. This mirrors the backtest engine's 'blended' dataset mode
    // (backtest.ts:121-123) where distinct international data is unavailable.
    const blendedEquity = blendRatio * us + (1 - blendRatio) * sg
    assetReturns[0] = blendedEquity
    assetReturns[2] = blendedEquity

    yearlyReturns.push(dot(normalizedWeights, assetReturns))
    provenance.push(classifyProvenance(sgMissing, blendRatio))
    years.push(row.year)
  }

  return { yearlyReturns, provenance, years }
}

function cycleStats(rows: ProofCycle['rows']) {
  if (rows.length === 0) {
    return {
      endingPortfolio: 0,
      meanSpending: 0,
      meanReturnPct: 0,
    }
  }

  return {
    endingPortfolio: rows[rows.length - 1].liquidNW,
    meanSpending: average(rows.map((r) => r.annualExpenses)),
    meanReturnPct: average(rows.map((r) => r.portfolioReturnPct)),
  }
}

export function buildProofCyclesFromMonteCarlo(
  result: MonteCarloResult,
  projectionParams: ProjectionParams,
): ProofCycle[] {
  if (!result.representative_paths || result.representative_paths.length === 0) return []

  const offset = (result.representative_paths_start_age ?? projectionParams.currentAge) - projectionParams.currentAge

  return result.representative_paths.map((path, index) => {
    const rows = generateProjection({
      ...projectionParams,
      yearlyReturns: path.yearlyReturns,
      yearlyReturnsOffset: offset,
    }).rows

    const stats = cycleStats(rows)

    return {
      id: `mc-${index}-${toPathLabel(path, index).toLowerCase()}`,
      label: toPathLabel(path, index),
      startYear: null,
      yearlyReturns: path.yearlyReturns,
      provenance: rows.map(() => 'actual'),
      rows,
      endingPortfolio: stats.endingPortfolio,
      meanSpending: stats.meanSpending,
      meanReturnPct: stats.meanReturnPct,
    }
  })
}

export function buildProofCyclesFromHistoricalBlended(
  projectionParams: ProjectionParams,
  allocationWeights: number[],
  blendRatio: number,
): ProofCycle[] {
  const horizonYears = Math.max(1, projectionParams.lifeExpectancy - projectionParams.currentAge)
  const blended = buildHistoricalBlendedReturns(allocationWeights, blendRatio)

  if (blended.yearlyReturns.length < horizonYears) return []

  const cycles: ProofCycle[] = []
  for (let start = 0; start + horizonYears <= blended.yearlyReturns.length; start++) {
    const startYear = blended.years[start]
    const cycleReturns = blended.yearlyReturns.slice(start, start + horizonYears)
    const cycleProvenance = blended.provenance.slice(start, start + horizonYears)

    const rows = generateProjection({
      ...projectionParams,
      yearlyReturns: cycleReturns,
      yearlyReturnsOffset: 0,
    }).rows

    const stats = cycleStats(rows)

    cycles.push({
      id: `hist-${startYear}-${start}`,
      label: `Cycle ${start + 1}`,
      startYear,
      yearlyReturns: cycleReturns,
      provenance: cycleProvenance,
      rows,
      endingPortfolio: stats.endingPortfolio,
      meanSpending: stats.meanSpending,
      meanReturnPct: stats.meanReturnPct,
    })
  }

  return cycles
}

function escapeCsvValue(value: string | number): string {
  const raw = String(value)
  if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n')) return raw
  return `"${raw.replaceAll('"', '""')}"`
}

export function buildProofCsv(cycles: ProofCycle[], source: 'mc' | 'historical_blended'): string {
  const header = [
    'source',
    'cycle_id',
    'cycle_label',
    'cycle_start_year',
    'simulation_year',
    'age',
    'calendar_year',
    'portfolio',
    'spending',
    'return_pct',
    'income_tax',
    'total_taxes_paid',
    'provenance',
  ]

  const rows: string[] = [header.join(',')]

  for (const cycle of cycles) {
    let cumulativeTax = 0
    for (let i = 0; i < cycle.rows.length; i++) {
      const row = cycle.rows[i]
      cumulativeTax += row.sgTax
      const line = [
        source,
        cycle.id,
        cycle.label,
        cycle.startYear ?? '',
        i + 1,
        row.age,
        row.year,
        row.liquidNW,
        row.annualExpenses,
        row.portfolioReturnPct,
        row.sgTax,
        cumulativeTax,
        cycle.provenance[i] ?? 'actual',
      ]
      rows.push(line.map(escapeCsvValue).join(','))
    }
  }

  return rows.join('\n')
}
