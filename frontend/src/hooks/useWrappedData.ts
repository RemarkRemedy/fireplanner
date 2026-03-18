import { useMemo } from 'react'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useDashboardCharts } from '@/hooks/useDashboardCharts'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { buildCardSequence } from '@/lib/wrapped/gradients'
import { DEFAULT_ANNUAL_EXPENSES } from '@/lib/data/setupDefaults'
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
  hasFireAge: boolean
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
  const { metrics } = useFireCalculations()
  const { profile } = useHouseholdRuntimeInputs()

  return useMemo(() => {
    const liquid = profile.liquidNetWorth
    const cpf = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
    const property = metrics?.propertyEquity ?? 0
    const totalNW = dashMetrics.totalNetWorth ?? (liquid + cpf + property)

    // Find peak from accumulation chart data (real-terms, consistent basis)
    let peakValue = totalNW
    let peakAge = profile.currentAge
    for (const pt of accumulationData) {
      if (pt.value > peakValue) {
        peakValue = pt.value
        peakAge = pt.age
      }
    }

    const cards = buildCardSequence()

    // Refinement hints: detect if user has gone beyond defaults
    const hasCpfData = cpf > 0
    const hasProperty = property > 0
    const hasCustomExpenses = profile.annualExpenses !== DEFAULT_ANNUAL_EXPENSES
    const hasCustomIncome = profile.annualIncome > 0

    const fireAge = dashMetrics.fireAge ?? null

    return {
      ready: true,
      intro: {
        currentAge: profile.currentAge,
        displayName: 'there', // No user account system; intentional placeholder
      },
      netWorth: { total: totalNW, liquid, cpf, property },
      fireNumber: { value: dashMetrics.fireNumber ?? 0 },
      progress: { percent: dashMetrics.progress ?? 0 },
      milestone: {
        fireAge,
        yearsToFire: dashMetrics.yearsToFire ?? null,
      },
      trajectory: {
        chartData: accumulationData,
        retirementAge: fireAge ?? profile.retirementAge,
        hasFireAge: fireAge != null,
      },
      peak: { value: peakValue, age: peakAge },
      summary: {
        terminalNW: 0,
        depleted: dashMetrics.portfolioDepletedAge != null &&
          dashMetrics.lifeExpectancy != null &&
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
  }, [dashMetrics, accumulationData, metrics, profile])
}
