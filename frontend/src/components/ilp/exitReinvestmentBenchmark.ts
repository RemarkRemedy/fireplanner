import { analyzeIlpPolicy, type IlpPolicyInput, type IlpProjectedPolicyAnalysis, type IlpYearRow } from '@/lib/calculations/ilp'

export const EXIT_BENCHMARK_RATES = [2, 4, 6, 7, 8, 10] as const
export type ExitBenchmarkRateKey = `${(typeof EXIT_BENCHMARK_RATES)[number]}`

type HorizonValueMap = Record<ExitBenchmarkRateKey, number>

export interface ExitReinvestmentOption {
  exitYear: number
  policyYear: number
  netExitValue: number
  eecCharge: number
  isPenaltyFree: boolean
  horizonValues: HorizonValueMap
}

export interface ExitReinvestmentPathPoint {
  year: number
  policyYear: number
  holdIlpValue: number
  selectedPathValue: number
}

export interface ExitReinvestmentBenchmarkData {
  horizonYear: number
  holdValueAtHorizon: number
  options: ExitReinvestmentOption[]
}

function compoundFromExit(
  exitYear: number,
  netExitValue: number,
  contributionRows: IlpYearRow[],
  currentYear: number,
  annualReturn: number,
): number {
  let value = netExitValue * Math.pow(1 + annualReturn, Math.max(currentYear - exitYear, 0))

  for (const row of contributionRows) {
    if (row.year > exitYear && row.year <= currentYear) {
      value += row.annualContribution * Math.pow(1 + annualReturn, currentYear - row.year)
    }
  }

  return value
}

function buildHorizonValues(
  exitYear: number,
  netExitValue: number,
  contributionRows: IlpYearRow[],
  horizonYear: number,
): HorizonValueMap {
  return Object.fromEntries(
    EXIT_BENCHMARK_RATES.map((rate) => {
      const rateKey = String(rate) as ExitBenchmarkRateKey
      return [rateKey, compoundFromExit(exitYear, netExitValue, contributionRows, horizonYear, rate / 100)]
    }),
  ) as HorizonValueMap
}

export function buildIlpScenarioAnalyses(
  policy: IlpPolicyInput,
): Record<ExitBenchmarkRateKey, IlpProjectedPolicyAnalysis> {
  return Object.fromEntries(
    EXIT_BENCHMARK_RATES.map((rate) => {
      const annualRate = rate / 100
      const rateKey = String(rate) as ExitBenchmarkRateKey
      const scenarioPolicy: IlpPolicyInput = {
        ...policy,
        funds: policy.funds.map((fund) => ({
          ...fund,
          grossReturnLow: annualRate,
          grossReturnMid: annualRate,
          grossReturnHigh: annualRate,
        })),
      }
      return [rateKey, analyzeIlpPolicy(scenarioPolicy)]
    }),
  ) as Record<ExitBenchmarkRateKey, IlpProjectedPolicyAnalysis>
}

export function buildExitReinvestmentBenchmark(
  _policy: IlpPolicyInput,
  analysis: IlpProjectedPolicyAnalysis,
): ExitReinvestmentBenchmarkData {
  const projectionRows = analysis.projections.mid.rows
  const horizonRow = projectionRows.at(-1)

  if (!horizonRow) {
    return {
      horizonYear: 0,
      holdValueAtHorizon: 0,
      options: [],
    }
  }

  const contributionRows = projectionRows.filter((row) => row.annualContribution > 0)
  const options: ExitReinvestmentOption[] = [
    {
      exitYear: 0,
      policyYear: 0,
      netExitValue: analysis.npvAnalysis.surrenderNow.netSurrenderValue,
      eecCharge: analysis.npvAnalysis.surrenderNow.eecCharge,
      isPenaltyFree: Math.abs(analysis.npvAnalysis.surrenderNow.eecCharge) <= 0.005,
      horizonValues: buildHorizonValues(0, analysis.npvAnalysis.surrenderNow.netSurrenderValue, contributionRows, horizonRow.year),
    },
    ...analysis.npvAnalysis.futureExitOptions.map((option) => ({
      exitYear: option.exitYear,
      policyYear: option.policyYear,
      netExitValue: option.netSurrenderValue,
      eecCharge: option.eecCharge,
      isPenaltyFree: Math.abs(option.eecCharge) <= 0.005,
      horizonValues: buildHorizonValues(option.exitYear, option.netSurrenderValue, contributionRows, horizonRow.year),
    })),
  ]

  return {
    horizonYear: horizonRow.policyYear,
    holdValueAtHorizon: horizonRow.combinedValue,
    options,
  }
}

export function buildExitReinvestmentPath(
  analysis: IlpProjectedPolicyAnalysis,
  selectedExitYear: number,
  selectedNetExitValue: number,
  annualReturn: number,
): ExitReinvestmentPathPoint[] {
  const projectionRows = analysis.projections.mid.rows
  const contributionRows = projectionRows.filter((row) => row.annualContribution > 0)

  return projectionRows.map((row) => {
    const selectedPathValue = row.year < selectedExitYear
      ? row.combinedValue
      : row.year === selectedExitYear
        ? selectedNetExitValue
        : compoundFromExit(selectedExitYear, selectedNetExitValue, contributionRows, row.year, annualReturn)

    return {
      year: row.year,
      policyYear: row.policyYear,
      holdIlpValue: row.combinedValue,
      selectedPathValue,
    }
  })
}
