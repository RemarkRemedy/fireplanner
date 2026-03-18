import { useMemo } from 'react'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useDashboardCharts } from '@/hooks/useDashboardCharts'
import { useProjection } from '@/hooks/useProjection'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { buildCardSequence } from '@/lib/wrapped/gradients'
import type { WrappedCardConfig } from '@/lib/wrapped/gradients'

interface ChartPoint {
  age: number
  value: number
}

interface WrappedIntro {
  currentAge: number
  displayName: string
}

interface WrappedNetWorth {
  total: number
  liquid: number
  cpf: number
  property: number
}

interface WrappedFireNumber {
  value: number
}

interface WrappedProgress {
  percent: number
}

interface WrappedMilestone {
  fireAge: number | null
  yearsToFire: number | null
}

interface WrappedTrajectory {
  chartData: ChartPoint[]
  retirementAge: number
}

interface WrappedPeak {
  value: number
  age: number
}

interface WrappedSummary {
  terminalNW: number
  depleted: boolean
  depletedAge: number | null
  lifeExpectancy: number
  savingsRate: number
}

interface RefinementHints {
  hasCustomExpenses: boolean
  hasCustomIncome: boolean
  hasCpfData: boolean
  hasProperty: boolean
}

export interface WrappedData {
  ready: boolean
  intro: WrappedIntro
  netWorth: WrappedNetWorth
  fireNumber: WrappedFireNumber
  progress: WrappedProgress
  milestone: WrappedMilestone
  trajectory: WrappedTrajectory
  peak: WrappedPeak
  summary: WrappedSummary
  cards: WrappedCardConfig[]
  refinementHints: RefinementHints
}

/**
 * Derives all story metrics for the Wrapped experience.
 * Works with minimal/default data: degrades gracefully when projection
 * data is unavailable, falling back to raw store values.
 */
export function useWrappedData(): WrappedData {
  const dashMetrics = useDashboardMetrics()
  const { accumulationData } = useDashboardCharts()
  const { summary: projSummary } = useProjection()
  const { metrics } = useFireCalculations()
  const { profile } = useHouseholdRuntimeInputs()

  return useMemo(() => {
    const liquid = profile.liquidNetWorth
    const cpf = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
    const property = metrics?.propertyEquity ?? 0
    const totalNW = dashMetrics.totalNetWorth ?? liquid + cpf

    // Find peak from chart data
    let peakValue = totalNW
    let peakAge = profile.currentAge
    for (const pt of accumulationData) {
      if (pt.value > peakValue) {
        peakValue = pt.value
        peakAge = pt.age
      }
    }

    // Override with projection summary if available (more accurate)
    if (projSummary) {
      peakValue = projSummary.peakTotalNW
      peakAge = projSummary.peakTotalNWAge
    }

    const cards = buildCardSequence()

    // Refinement hints: detect if user has gone beyond defaults
    const hasCpfData = cpf > 0
    const hasProperty = property > 0
    const hasCustomExpenses = profile.annualExpenses !== 48000
    const hasCustomIncome = profile.annualIncome > 0

    return {
      ready: true,
      intro: {
        currentAge: profile.currentAge,
        displayName: 'there',
      },
      netWorth: { total: totalNW, liquid, cpf, property },
      fireNumber: { value: dashMetrics.fireNumber ?? 0 },
      progress: { percent: dashMetrics.progress ?? 0 },
      milestone: {
        fireAge: dashMetrics.fireAge ?? null,
        yearsToFire: dashMetrics.yearsToFire ?? null,
      },
      trajectory: {
        chartData: accumulationData,
        retirementAge: profile.retirementAge,
      },
      peak: { value: peakValue, age: peakAge },
      summary: {
        terminalNW: projSummary?.terminalTotalNW ?? 0,
        depleted: dashMetrics.portfolioDepletedAge != null &&
          dashMetrics.portfolioDepletedAge < dashMetrics.lifeExpectancy,
        depletedAge: dashMetrics.portfolioDepletedAge ?? null,
        lifeExpectancy: dashMetrics.lifeExpectancy,
        savingsRate: dashMetrics.savingsRate ?? 0,
      },
      cards,
      refinementHints: {
        hasCustomExpenses,
        hasCustomIncome,
        hasCpfData,
        hasProperty,
      },
    }
  }, [dashMetrics, accumulationData, projSummary, metrics, profile])
}
