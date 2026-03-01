import { useMemo, useState, useCallback } from 'react'
import type { LifeEvent } from '@/lib/types'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { getBaseInputs, computeMetrics } from '@/hooks/useWhatIfMetrics'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

// ============================================================
// Disruption Template Types
// ============================================================

export interface CostTier {
  additionalAnnualExpense?: number
  lumpSumCost?: number
  /** Decimal fraction: 0.15 = 15% reduction. Matches schema z.number().min(0).max(1). */
  expenseReductionPercent?: number
}

export type CostTierKey = 'subsidised' | 'private'

export const MAX_LIFE_EVENTS = 4

const EMPTY_COST_TIER: CostTier = {}

/** Duration threshold (years) above which a life event is treated as permanent.
 *  Used by both the calculation engine and UI display (EventChip). */
export const PERMANENT_DURATION_THRESHOLD = 90

export interface DisruptionTemplate {
  label: string
  category: 'career' | 'health' | 'family'
  event: Omit<LifeEvent, 'id' | 'startAge' | 'endAge' | 'affectedStreamIds'>
  defaultAgeOffset: number
  durationYears: number
  // Probability context (displayed, not used in simulation)
  probability?: number          // cumulative probability (0.25 = 25%)
  probabilityByAge?: number     // "by age X" qualifier
  probabilitySource?: string    // citation
  // Tiered expense impacts (subsidised = B2/C ward, private = A/B1 ward)
  costs?: Record<CostTierKey, CostTier>
}

export const DISRUPTION_TEMPLATES: DisruptionTemplate[] = [
  {
    label: 'Job Loss (6 months)',
    category: 'career',
    defaultAgeOffset: 2,
    durationYears: 1,
    event: { name: 'Job Loss (6 months)', incomeImpact: 0, savingsPause: true, cpfPause: true, expenseReductionPercent: 0.20 },
    probability: 0.15,
    probabilitySource: 'MOM Retrenchment Statistics 2024',
  },
  {
    label: 'Job Loss (12 months)',
    category: 'career',
    defaultAgeOffset: 2,
    durationYears: 2,
    event: { name: 'Job Loss (12 months)', incomeImpact: 0, savingsPause: true, cpfPause: true, expenseReductionPercent: 0.20 },
    probability: 0.15,
    probabilitySource: 'MOM Retrenchment Statistics 2024',
  },
  {
    label: 'Partial Disability',
    category: 'health',
    defaultAgeOffset: 5,
    durationYears: 3,
    event: { name: 'Partial Disability', incomeImpact: 0.5, savingsPause: false, cpfPause: false },
    // No probability: "partial disability" is a spectrum with no standard Singapore incidence data.
    // Permanent Disability has MOH data (5% by 65); partial is not separately tracked.
    costs: {
      subsidised: { additionalAnnualExpense: 12000, lumpSumCost: 3000 },
      private: { additionalAnnualExpense: 20000, lumpSumCost: 5000 },
    },
  },
  {
    label: 'Parent Care',
    category: 'family',
    defaultAgeOffset: 10,
    durationYears: 5,
    event: { name: 'Parent Care', incomeImpact: 0.8, savingsPause: false, cpfPause: false },
    // No probability: depends on parents' ages/health, not the user's own actuarial risk.
    // A user-facing probability would be misleading.
    costs: {
      subsidised: { additionalAnnualExpense: 16000, lumpSumCost: 3000 },
      private: { additionalAnnualExpense: 36000, lumpSumCost: 5000 },
    },
  },
  {
    label: 'Recession Pay Cut',
    category: 'career',
    defaultAgeOffset: 3,
    durationYears: 2,
    event: { name: 'Recession Pay Cut', incomeImpact: 0.8, savingsPause: false, cpfPause: false, expenseReductionPercent: 0.10 },
    probability: 0.15,
    probabilitySource: 'MOM Labour Market Report 2024',
  },
  {
    label: 'Death of Spouse',
    category: 'family',
    defaultAgeOffset: 15,
    durationYears: 99, // permanent — endAge MUST be clamped to lifeExpectancy (Codex fix #1)
    event: { name: 'Death of Spouse', incomeImpact: 0.5, savingsPause: false, cpfPause: false },
    probability: 0.03,
    probabilityByAge: 55,
    probabilitySource: 'SingStat Complete Life Tables 2023',
    costs: {
      subsidised: { lumpSumCost: 10000, expenseReductionPercent: 0.15 },
      private: { lumpSumCost: 15000, expenseReductionPercent: 0.15 },
    },
  },
  {
    label: 'Critical Illness',
    category: 'health',
    defaultAgeOffset: 15,
    durationYears: 2,
    event: { name: 'Critical Illness', incomeImpact: 0, savingsPause: true, cpfPause: true },
    probability: 0.25,
    probabilityByAge: 65,
    probabilitySource: 'LIA Singapore Protection Gap Study 2022',
    costs: {
      subsidised: { additionalAnnualExpense: 15000, lumpSumCost: 8000 },
      private: { additionalAnnualExpense: 50000, lumpSumCost: 20000 },
    },
  },
  {
    label: 'Permanent Disability',
    category: 'health',
    defaultAgeOffset: 15,
    durationYears: 99, // permanent — endAge MUST be clamped to lifeExpectancy
    event: { name: 'Permanent Disability', incomeImpact: 0, savingsPause: true, cpfPause: true },
    probability: 0.05,
    probabilityByAge: 65,
    probabilitySource: 'MOH Principal Causes of Death & Disability Reports',
    costs: {
      subsidised: { additionalAnnualExpense: 20000, lumpSumCost: 10000 },
      private: { additionalAnnualExpense: 50000, lumpSumCost: 15000 },
    },
  },
]

// ============================================================
// Disruption Impact Types
// ============================================================

export interface DisruptionMetrics {
  fireNumber: number
  yearsToFire: number
  fireAge: number
  portfolioAtRetirement: number
}

export interface DisruptionDeltas {
  fireNumber: number
  yearsToFire: number
  fireAge: number
  portfolioAtRetirement: number
}

export interface DisruptionOverrides {
  incomeImpact?: number       // 0-1, overrides template.event.incomeImpact
  expenseReduction?: number   // 0-1, overrides resolved expenseReductionPercent
}

export interface DisruptionImpactResult {
  selectedIndex: number | null
  startAge: number
  baseMetrics: DisruptionMetrics | null
  disruptedMetrics: DisruptionMetrics | null
  deltas: DisruptionDeltas | null
  resolvedCosts: CostTier | null
  hasData: boolean
  /** Template's default income impact (0-1), for pre-filling UI sliders */
  templateIncomeImpact: number | null
  /** Template's default expense reduction (0-1), merged from costs tier + event field */
  templateExpenseReduction: number | null
  selectTemplate: (index: number | null) => void
  setStartAge: (age: number) => void
}

// ============================================================
// Hook: useDisruptionImpact
// ============================================================

export function useDisruptionImpact(costTier: CostTierKey = 'subsidised', overrides?: DisruptionOverrides): DisruptionImpactResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  // Allocation and property are read inside useMemo via .getState() rather than
  // subscribing at the hook level. This avoids re-running the expensive useMemo
  // when unrelated allocation/property fields change. Safe because this hook is
  // only mounted inside the life events Sheet, and allocation/property are edited
  // on a different page — any navigation triggers a fresh mount.

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [customStartAge, setCustomStartAge] = useState<number | null>(null)

  const template = selectedIndex !== null ? DISRUPTION_TEMPLATES[selectedIndex] : null

  // Calculate the effective start age
  const effectiveStartAge = useMemo(() => {
    if (!template) return profile.currentAge + 2
    if (customStartAge !== null) return customStartAge
    return Math.max(profile.currentAge + 1, profile.currentAge + template.defaultAgeOffset)
  }, [template, customStartAge, profile.currentAge])

  const selectTemplate = useCallback((index: number | null) => {
    setSelectedIndex(index)
    setCustomStartAge(null) // Reset custom age when changing template
  }, [])

  const setStartAge = useCallback((age: number) => {
    setCustomStartAge(age)
  }, [])

  const result = useMemo(() => {
    const profileErrors = profile.validationErrors
    if (Object.keys(profileErrors).length > 0) {
      return {
        baseMetrics: null,
        disruptedMetrics: null,
        deltas: null,
        resolvedCosts: null,
        hasData: false,
      }
    }

    // Compute base metrics (read allocation/property at compute time, not via subscription)
    const allocation = useAllocationStore.getState()
    const property = usePropertyStore.getState()
    const baseInputs = getBaseInputs(profile, income, allocation, property)
    const baseMetrics = computeMetrics(baseInputs)

    if (!template) {
      return {
        baseMetrics,
        disruptedMetrics: null,
        deltas: null,
        resolvedCosts: null,
        hasData: true,
      }
    }

    // Create the disruption event (clamp endAge to lifeExpectancy for permanent events)
    const clampedStartAge = Math.max(profile.currentAge + 1, effectiveStartAge)
    const endAge = Math.min(profile.lifeExpectancy, clampedStartAge + template.durationYears)
    const effectiveIncomeImpact = overrides?.incomeImpact ?? template.event.incomeImpact
    const disruptionEvent: LifeEvent = {
      id: 'disruption-preview',
      name: template.event.name,
      startAge: clampedStartAge,
      endAge,
      incomeImpact: effectiveIncomeImpact,
      affectedStreamIds: [],
      savingsPause: template.event.savingsPause,
      cpfPause: template.event.cpfPause,
    }

    // Recompute income projections to compare base vs disrupted across all working years.
    // Using projection[0] alone would miss disruptions at future ages since it only
    // reflects current-age income. Instead, compare total working-year income and
    // derive the average annual income loss for the steady-state FIRE model.
    let disruptedIncome = baseInputs.annualIncome
    const baseParams = buildProjectionParams(profile, income, property)
    if (baseParams) {
      // Base projection (with store's existing life events)
      const baseProjection = generateIncomeProjection(baseParams)

      // Disrupted projection (with disruption event appended, forced enabled)
      const allEvents = [...income.lifeEvents, disruptionEvent]
      const disruptedProjection = generateIncomeProjection({
        ...baseParams,
        lifeEvents: allEvents,
        lifeEventsEnabled: true,
      })

      // Compare total working-year income to derive average annual loss
      const baseWorking = baseProjection.filter(r => !r.isRetired)
      const disruptedWorking = disruptedProjection.filter(r => !r.isRetired)
      if (baseWorking.length > 0 && disruptedWorking.length > 0) {
        const baseTotalIncome = baseWorking.reduce((s, r) => s + r.totalGross, 0)
        const disruptedTotalIncome = disruptedWorking.reduce((s, r) => s + r.totalGross, 0)
        const avgAnnualLoss = (baseTotalIncome - disruptedTotalIncome) / baseWorking.length
        disruptedIncome = baseInputs.annualIncome - avgAnnualLoss
      }
    }

    // Resolve tiered costs for the selected template
    const resolvedCosts: CostTier = template.costs?.[costTier] ?? EMPTY_COST_TIER
    const { additionalAnnualExpense, lumpSumCost } = resolvedCosts
    // Expense reduction: override > tiered cost > event-level default
    const expenseReductionPercent = overrides?.expenseReduction
      ?? resolvedCosts.expenseReductionPercent
      ?? template.event.expenseReductionPercent

    // Compute expense impact from resolved tier costs
    // Distinguish permanent vs temporary events using durationYears (not event timing):
    // - Permanent (durationYears >= 90, e.g. Death of Spouse, Permanent Disability):
    //   modify annualExpenses → changes FIRE Number + savings rate
    // - Temporary (durationYears < 90, e.g. Critical Illness 2yr):
    //   model total cost as wealth shock → FIRE Number unchanged
    // Using durationYears ensures a 2-year illness at age 64 isn't wrongly treated
    // as permanent just because it overlaps retirement at 65.
    const clampedEndAge = Math.min(profile.lifeExpectancy, clampedStartAge + template.durationYears)
    const isPermanentExpenseChange = template.durationYears >= PERMANENT_DURATION_THRESHOLD

    let disruptedExpenses = baseInputs.annualExpenses
    let liquidNWAdjustment = 0

    if (isPermanentExpenseChange) {
      // Permanent: modify annualExpenses directly (correctly changes savings rate AND FIRE number)
      // IMPORTANT (Codex fix #3): Apply lifestyle reduction FIRST (to base expenses only),
      // THEN add event-specific costs. Otherwise the reduction incorrectly discounts medical costs.
      if (expenseReductionPercent) {
        disruptedExpenses *= (1 - expenseReductionPercent)
      }
      if (additionalAnnualExpense) {
        disruptedExpenses += additionalAnnualExpense
      }
    } else {
      // Temporary: model total event cost as a wealth shock to liquidNetWorth
      const eventDuration = clampedEndAge - clampedStartAge
      if (additionalAnnualExpense) {
        liquidNWAdjustment -= additionalAnnualExpense * eventDuration
      }
      if (expenseReductionPercent) {
        // Temporary expense reduction = net savings during event period
        liquidNWAdjustment += baseInputs.annualExpenses * expenseReductionPercent * eventDuration
      }
    }
    // Lump sum is always a wealth shock regardless of duration.
    // No inflation adjustment: this model works in real terms (computeMetrics uses
    // netRealReturn = expectedReturn - inflation - expenseRatio), so all inputs
    // must be in today's dollars. The MC/SR engines inflate lump sums because they
    // run year-by-year in nominal terms — that logic does not apply here.
    if (lumpSumCost) {
      liquidNWAdjustment -= lumpSumCost
    }

    // Compute disrupted metrics with modified income AND expenses
    const disruptedInputs = {
      ...baseInputs,
      annualIncome: disruptedIncome,
      annualExpenses: disruptedExpenses,
      liquidNetWorth: baseInputs.liquidNetWorth + liquidNWAdjustment,
    }
    const disruptedMetrics = computeMetrics(disruptedInputs)

    // Calculate deltas
    const deltas: DisruptionDeltas = {
      fireNumber: disruptedMetrics.fireNumber - baseMetrics.fireNumber,
      yearsToFire: isFinite(disruptedMetrics.yearsToFire) && isFinite(baseMetrics.yearsToFire)
        ? disruptedMetrics.yearsToFire - baseMetrics.yearsToFire
        : NaN,
      fireAge: isFinite(disruptedMetrics.fireAge) && isFinite(baseMetrics.fireAge)
        ? disruptedMetrics.fireAge - baseMetrics.fireAge
        : NaN,
      portfolioAtRetirement: disruptedMetrics.portfolioAtRetirement - baseMetrics.portfolioAtRetirement,
    }

    return {
      baseMetrics,
      disruptedMetrics,
      deltas,
      resolvedCosts,
      hasData: true,
    }
  }, [
    profile, income,
    template, effectiveStartAge, costTier,
    overrides?.incomeImpact, overrides?.expenseReduction,
  ])

  // Compute template defaults for UI pre-fill (outside useMemo to avoid recomputing everything)
  const templateIncomeImpact = template ? template.event.incomeImpact : null
  const templateExpenseReduction = template
    ? (template.costs?.[costTier]?.expenseReductionPercent ?? template.event.expenseReductionPercent ?? null)
    : null

  return {
    selectedIndex,
    startAge: effectiveStartAge,
    baseMetrics: result.baseMetrics,
    disruptedMetrics: result.disruptedMetrics,
    deltas: result.deltas,
    resolvedCosts: result.resolvedCosts ?? null,
    hasData: result.hasData,
    templateIncomeImpact,
    templateExpenseReduction,
    selectTemplate,
    setStartAge,
  }
}
