import { useMemo } from 'react'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useDashboardCharts } from '@/hooks/useDashboardCharts'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { buildCardSequence } from '@/lib/wrapped/gradients'
import { detectCoupleMode, computePerAdultNetWorth, computePerAdultSavings } from '@/lib/wrapped/coupleData'
import { computePerAdultFireAge } from '@/lib/household/computePerAdultFireAge'
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

export interface CoupleData {
  names: [string, string]
  ages: [number, number]
  perPersonNW: [number, number]
  perPersonSavings: [number, number]
  perPersonFireAge: [number | null, number | null]
  combinedSavings: number
  ageDelta: number
  partnerLifeExpectancy: number
}

export interface WrappedData {
  ready: boolean
  mode: 'individual' | 'couple'
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
  couple?: CoupleData
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
  const { profile, normalized } = useHouseholdRuntimeInputs()
  const plan = useHouseholdPlanStore((s) => s.plan)
  const currentWeights = useAllocationStore((s) => s.currentWeights)
  const targetWeights = useAllocationStore((s) => s.targetWeights)
  const returnOverrides = useAllocationStore((s) => s.returnOverrides)
  const glidePathConfig = useAllocationStore((s) => s.glidePathConfig)
  const allocationValidationErrors = useAllocationStore((s) => s.validationErrors)
  const selectedStrategy = useSimulationStore((s) => s.selectedStrategy)
  const strategyParams = useSimulationStore((s) => s.strategyParams)
  const withdrawalBasis = useSimulationStore((s) => s.withdrawalBasis)

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

    // Detect couple mode inside useMemo to avoid unstable object refs in deps
    const { isCoupleMode, selfAdult, partnerAdult } = detectCoupleMode(plan.adults)

    const mode = isCoupleMode ? 'couple' : 'individual'
    const cards = buildCardSequence(mode)

    // Refinement hints: detect if user has gone beyond defaults
    const hasCpfData = cpf > 0
    const hasProperty = property > 0
    const hasCustomExpenses = profile.annualExpenses !== DEFAULT_ANNUAL_EXPENSES
    const hasCustomIncome = profile.annualIncome > 0

    const rawFireAge = dashMetrics.fireAge ?? null
    // Round and cap: ages beyond life expectancy are unreachable
    const fireAge = rawFireAge != null && rawFireAge <= profile.lifeExpectancy
      ? Math.round(rawFireAge)
      : null

    // Couple data computation using canonical helpers
    const compiledPlan = normalized.compiledPlan
    const allocation = {
      currentWeights,
      targetWeights,
      returnOverrides,
      glidePathConfig,
      validationErrors: allocationValidationErrors,
    }
    const simulation = { selectedStrategy, strategyParams, withdrawalBasis }

    let couple: CoupleData | undefined = undefined
    if (isCoupleMode && selfAdult && partnerAdult) {
      // Use canonical helpers for NW (includes CPF RA + property equity)
      const selfNW = computePerAdultNetWorth(selfAdult, compiledPlan)
      const partnerNW = computePerAdultNetWorth(partnerAdult, compiledPlan)

      // Use canonical helpers for savings (respects shared splits + timing)
      const selfSavings = computePerAdultSavings(compiledPlan, selfAdult.owner)
      const partnerSavings = computePerAdultSavings(compiledPlan, partnerAdult.owner)
      const combinedSavings = selfSavings + partnerSavings

      // Per-adult FIRE age with Infinity guard + life expectancy cap
      const rawSelfFireAge = computePerAdultFireAge(plan, selfAdult.id, allocation, simulation)
      const rawPartnerFireAge = computePerAdultFireAge(plan, partnerAdult.id, allocation, simulation)
      const selfFireAge = rawSelfFireAge != null && Number.isFinite(rawSelfFireAge) && rawSelfFireAge <= selfAdult.lifeExpectancy
        ? Math.round(rawSelfFireAge)
        : null
      const partnerFireAge = rawPartnerFireAge != null && Number.isFinite(rawPartnerFireAge) && rawPartnerFireAge <= partnerAdult.lifeExpectancy
        ? Math.round(rawPartnerFireAge)
        : null

      couple = {
        names: [selfAdult.displayName, partnerAdult.displayName],
        ages: [selfAdult.currentAge, partnerAdult.currentAge],
        perPersonNW: [selfNW, partnerNW],
        perPersonSavings: [selfSavings, partnerSavings],
        perPersonFireAge: [selfFireAge, partnerFireAge],
        combinedSavings,
        ageDelta: selfAdult.currentAge - partnerAdult.currentAge,
        partnerLifeExpectancy: partnerAdult.lifeExpectancy,
      }
    }

    // Override display name for couple mode
    const displayName = isCoupleMode && selfAdult && partnerAdult
      ? `${selfAdult.displayName} & ${partnerAdult.displayName}`
      : 'there'

    // Override retirement age for couple mode: when both are free
    const coupleRetirementAge = couple?.perPersonFireAge[0] != null && couple?.perPersonFireAge[1] != null
      ? Math.max(couple.perPersonFireAge[0], couple.perPersonFireAge[1])
      : undefined

    return {
      ready: true,
      mode,
      intro: {
        currentAge: profile.currentAge,
        displayName,
      },
      netWorth: {
        // In couple mode, use sum of per-person NW (includes property equity)
        // to keep bars and header on the same basis
        total: couple ? couple.perPersonNW[0] + couple.perPersonNW[1] : totalNW,
        liquid, cpf, property,
      },
      fireNumber: { value: dashMetrics.fireNumber ?? 0 },
      progress: { percent: dashMetrics.progress ?? 0 },
      milestone: {
        fireAge,
        yearsToFire: fireAge != null && dashMetrics.yearsToFire != null
          ? Math.round(dashMetrics.yearsToFire)
          : null,
      },
      trajectory: {
        chartData: accumulationData,
        retirementAge: coupleRetirementAge ?? fireAge ?? profile.retirementAge,
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
      couple,
    }
  }, [dashMetrics, accumulationData, metrics, profile, normalized, plan,
    currentWeights, targetWeights, returnOverrides, glidePathConfig, allocationValidationErrors,
    selectedStrategy, strategyParams, withdrawalBasis])
}
