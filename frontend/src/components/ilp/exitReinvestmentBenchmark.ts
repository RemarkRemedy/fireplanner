import type { IlpPolicyInput, IlpProjectedPolicyAnalysis, IlpYearRow } from '@/lib/calculations/ilp'

export interface ExitReinvestmentOption {
  exitYear: number
  policyYear: number
  netExitValue: number
  eecCharge: number
  isPenaltyFree: boolean
  horizonValueAt4: number
  horizonValueAt7: number
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
      horizonValueAt4: compoundFromExit(0, analysis.npvAnalysis.surrenderNow.netSurrenderValue, contributionRows, horizonRow.year, 0.04),
      horizonValueAt7: compoundFromExit(0, analysis.npvAnalysis.surrenderNow.netSurrenderValue, contributionRows, horizonRow.year, 0.07),
    },
    ...analysis.npvAnalysis.futureExitOptions.map((option) => ({
      exitYear: option.exitYear,
      policyYear: option.policyYear,
      netExitValue: option.netSurrenderValue,
      eecCharge: option.eecCharge,
      isPenaltyFree: Math.abs(option.eecCharge) <= 0.005,
      horizonValueAt4: compoundFromExit(option.exitYear, option.netSurrenderValue, contributionRows, horizonRow.year, 0.04),
      horizonValueAt7: compoundFromExit(option.exitYear, option.netSurrenderValue, contributionRows, horizonRow.year, 0.07),
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
