import { useEffect, useMemo } from 'react'
import type { IncomeProjectionRow, IncomeSummaryStats } from '@/lib/types'
import { generateIncomeProjection, calculateIncomeSummary } from '@/lib/calculations/income'
export { buildProjectionParams, deriveCpfHousingFromProperty } from '@/lib/calculations/projectionParams'
import { buildProjectionParams, deriveCpfHousingFromProperty } from '@/lib/calculations/projectionParams'
import {
  compileHouseholdPlan,
  type CompiledHouseholdPlan,
} from '@/lib/household/compileHouseholdPlan'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import {
  buildHouseholdPlanRevision,
  buildNormalizedAnalysisCacheKey,
  MONTE_CARLO_NORMALIZED_OWNER,
  stableScenarioOverrideHash,
  useNormalizedAnalysisStore,
  type NormalizedAnalysisEntry,
} from '@/stores/useNormalizedAnalysisStore'
import {
  applyHouseholdScenarioOverrides,
  type HouseholdScenarioOverrides,
} from '@/lib/household/scenarios'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { validateCrossStoreRules } from '@/lib/validation/rules'

function createNormalizedAnalysisEntry(
  compiledPlan: CompiledHouseholdPlan,
  householdRevision: string,
  scenarioOverrideHash: string,
): NormalizedAnalysisEntry {
  const cacheKey = buildNormalizedAnalysisCacheKey({
    householdRevision,
    scenarioOverrideHash,
  })

  return {
    cacheKey,
    householdRevision,
    scenarioOverrideHash,
    compiledPlan,
    selectors: {
      deterministic: {
        rows: compiledPlan.rows,
        milestones: compiledPlan.milestones,
      },
      projection: {
        annualSavingsByYear: compiledPlan.annualSavingsByYear,
        postRetirementIncomeByYear: compiledPlan.postRetirementIncomeByYear,
        retirementExpenseBaseByYear: compiledPlan.retirementExpenseBaseByYear,
        householdWithdrawalNeedByYear: compiledPlan.householdWithdrawalNeedByYear,
        portfolioAdjustments: compiledPlan.portfolioAdjustments,
      },
      monteCarlo: {
        annualSavingsByYear: compiledPlan.annualSavingsByYear,
        postRetirementIncomeByYear: compiledPlan.postRetirementIncomeByYear,
        householdWithdrawalNeedByYear: compiledPlan.householdWithdrawalNeedByYear,
        portfolioAdjustments: compiledPlan.portfolioAdjustments,
      },
      backtest: {
        postRetirementIncomeByYear: compiledPlan.postRetirementIncomeByYear,
        retirementExpenseBaseByYear: compiledPlan.retirementExpenseBaseByYear,
        householdWithdrawalNeedByYear: compiledPlan.householdWithdrawalNeedByYear,
        portfolioAdjustments: compiledPlan.portfolioAdjustments,
      },
      cpf: {
        cpfByAdultId: compiledPlan.cpfByAdultId,
      },
      healthcare: {
        healthcareByAdultId: compiledPlan.healthcareByAdultId,
      },
      companion: {
        milestones: compiledPlan.milestones,
        annualSavingsByYear: compiledPlan.annualSavingsByYear,
        postRetirementIncomeByYear: compiledPlan.postRetirementIncomeByYear,
        householdWithdrawalNeedByYear: compiledPlan.householdWithdrawalNeedByYear,
      },
    },
    monteCarloOwner: MONTE_CARLO_NORMALIZED_OWNER,
  }
}

function getReferenceAdultId(compiledPlan: CompiledHouseholdPlan): string {
  return compiledPlan.adultOrder.find(
    (adultId) => compiledPlan.adultsById[adultId].owner === 'self'
  ) ?? compiledPlan.adultOrder[0]
}

export interface NormalizedLegacyAnalysisContext {
  cacheKey: string
  householdRevision: string
  scenarioOverrideHash: string
  referenceAdultId: string
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  firstRetirementYearOffset: number
  householdRetirementYearOffset: number
  compiledPlan: CompiledHouseholdPlan
  entry: NormalizedAnalysisEntry
}

export function useNormalizedLegacyAnalysisContext(
  scenarioOverrides?: unknown
): NormalizedLegacyAnalysisContext {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const householdPlanRevision = useHouseholdPlanStore((state) => state.householdPlanRevision)
  const scenarioOverrideHash = useMemo(
    () => stableScenarioOverrideHash(scenarioOverrides ?? null),
    [scenarioOverrides]
  )
  const householdRevision = useMemo(
    () => buildHouseholdPlanRevision(householdPlanRevision),
    [householdPlanRevision]
  )
  const cacheKey = useMemo(() => buildNormalizedAnalysisCacheKey({
    householdRevision,
    scenarioOverrideHash,
  }), [householdRevision, scenarioOverrideHash])
  const cachedEntry = useNormalizedAnalysisStore((state) => state.entries[
    cacheKey
  ])
  const upsertEntry = useNormalizedAnalysisStore((state) => state.upsertEntry)
  const setActiveCacheKey = useNormalizedAnalysisStore((state) => state.setActiveCacheKey)

  const normalizedEntry = useMemo(() => {
    if (cachedEntry?.compiledPlan) {
      return cachedEntry
    }

    const scenarioPlan = scenarioOverrides
      ? applyHouseholdScenarioOverrides(
          plan,
          scenarioOverrides as HouseholdScenarioOverrides,
        )
      : plan

    return createNormalizedAnalysisEntry(
      compileHouseholdPlan(scenarioPlan),
      householdRevision,
      scenarioOverrideHash,
    )
  }, [
    cachedEntry,
    householdRevision,
    plan,
    scenarioOverrideHash,
    scenarioOverrides,
  ])

  useEffect(() => {
    if (
      !cachedEntry?.compiledPlan
      || cachedEntry.householdRevision !== householdRevision
      || cachedEntry.scenarioOverrideHash !== scenarioOverrideHash
    ) {
      upsertEntry(normalizedEntry)
    }
    setActiveCacheKey(cacheKey)
  }, [
    cacheKey,
    cachedEntry,
    householdRevision,
    normalizedEntry,
    scenarioOverrideHash,
    setActiveCacheKey,
    upsertEntry,
  ])

  const compiledPlan = normalizedEntry.compiledPlan
  if (!compiledPlan) {
    // This should never happen: createNormalizedAnalysisEntry always produces a
    // compiled plan, and the cache lookup above falls back to a fresh compile.
    // If it somehow does, log and re-throw so the nearest React Error Boundary
    // can present a recovery UI rather than leaving the user with a blank screen.
    const error = new Error('Normalized analysis entry missing compiled plan — this is a bug. Please refresh the page.')
    console.error(error)
    throw error
  }

  const referenceAdultId = getReferenceAdultId(compiledPlan)
  const referenceAdult = compiledPlan.adultsById[referenceAdultId]

  return useMemo(() => ({
    cacheKey,
    householdRevision,
    scenarioOverrideHash,
    referenceAdultId,
    currentAge: referenceAdult.currentAge,
    retirementAge: referenceAdult.currentAge + compiledPlan.householdRetirementYearOffset,
    lifeExpectancy: referenceAdult.currentAge + compiledPlan.yearCount - 1,
    firstRetirementYearOffset: compiledPlan.firstRetirementYearOffset,
    householdRetirementYearOffset: compiledPlan.householdRetirementYearOffset,
    compiledPlan,
    entry: normalizedEntry,
  }), [
    cacheKey,
    compiledPlan,
    householdRevision,
    normalizedEntry,
    referenceAdult.currentAge,
    referenceAdultId,
    scenarioOverrideHash,
  ])
}

interface IncomeProjectionResult {
  projection: IncomeProjectionRow[] | null
  summary: IncomeSummaryStats | null
  hasErrors: boolean
  errors: Record<string, string>
}

/**
 * Derived hook: reads profile + income stores, checks validation,
 * computes full year-by-year income projection and summary stats.
 * Returns null projection/summary when upstream validation fails.
 */
export function useIncomeProjection(): IncomeProjectionResult {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const hasValidationErrors = useHouseholdPlanStore((state) => state.hasValidationErrors)
  const normalized = useNormalizedLegacyAnalysisContext()
  const runtime = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )
  const { profile, income, property } = runtime
  const cpfHousing = useMemo(
    () => deriveCpfHousingFromProperty(property),
    [property]
  )

  return useMemo(() => {
    const crossStoreErrors = validateCrossStoreRules(
      {
        currentAge: normalized.currentAge,
        retirementAge: normalized.retirementAge,
        lifeExpectancy: normalized.lifeExpectancy,
      },
      {
        incomeStreams: income.incomeStreams,
        lifeEvents: income.lifeEvents,
        lifeEventsEnabled: income.lifeEventsEnabled,
        promotionJumps: income.promotionJumps,
      }
    )
    const allErrors = { ...crossStoreErrors }

    if (hasValidationErrors || Object.keys(allErrors).length > 0) {
      return { projection: null, summary: null, hasErrors: true, errors: allErrors }
    }

    const projectionParams = buildProjectionParams(
      {
        ...profile,
        currentAge: normalized.currentAge,
        retirementAge: normalized.retirementAge,
        lifeExpectancy: normalized.lifeExpectancy,
      },
      income,
      property,
    )
    if (!projectionParams) {
      return { projection: null, summary: null, hasErrors: true, errors: allErrors }
    }

    const projection = generateIncomeProjection(projectionParams)

    const summary = calculateIncomeSummary(projection, profile.annualExpenses)

    return { projection, summary, hasErrors: false, errors: {} }
  }, [
    income,
    normalized.currentAge,
    normalized.retirementAge,
    normalized.lifeExpectancy,
    profile.annualExpenses,
    profile.inflation,
    profile.srsAnnualContribution,
    profile.srsPostFireEnabled,
    profile.cpfOA,
    profile.cpfSA,
    profile.cpfMA,
    profile.cpfRA,
    profile.cpfLifeStartAge,
    profile.cpfLifePlan,
    profile.cpfRetirementSum,
    cpfHousing.cpfHousingMode,
    cpfHousing.cpfHousingMonthly,
    cpfHousing.cpfMortgageYearsLeft,
    profile.cpfLifeActualMonthlyPayout,
    profile.residencyStatus,
    profile.srsBalance,
    profile.srsInvestmentReturn,
    profile.srsDrawdownStartAge,
    profile.cpfOaWithdrawals,
    profile.cpfisEnabled,
    profile.cpfisOaReturn,
    profile.cpfisSaReturn,
    profile.cpfTopUpOA,
    profile.cpfTopUpSA,
    profile.cpfTopUpMA,
    profile.lockedAssets,
    profile.expenseAdjustments,
    profile.cpfAutoFallback,
    profile.cpfAutoFallbackIncludeSA,
    profile.cpfVirtualRebalancing,
    profile.cpfVirtualRebalancingMode,
    income.salaryModel,
    income.annualSalary,
    income.salaryGrowthRate,
    income.bonusMonths,
    income.realisticPhases,
    income.promotionJumps,
    income.momEducation,
    income.momAdjustment,
    income.employerCpfEnabled,
    income.incomeStreams,
    income.lifeEvents,
    income.lifeEventsEnabled,
    income.personalReliefs,
    hasValidationErrors,
  ])
}
