import { useEffect, useMemo } from 'react'
import type { IncomeProjectionRow, IncomeSummaryStats, ProfileState, IncomeState, CpfHousingMode } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import { generateIncomeProjection, calculateIncomeSummary } from '@/lib/calculations/income'
import {
  compileHouseholdPlan,
  type CompiledHouseholdPlan,
} from '@/lib/household/compileHouseholdPlan'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import {
  buildLegacyHouseholdRevision,
  buildNormalizedAnalysisCacheKey,
  MONTE_CARLO_NORMALIZED_OWNER,
  stableScenarioOverrideHash,
  useNormalizedAnalysisStore,
  type NormalizedAnalysisEntry,
} from '@/stores/useNormalizedAnalysisStore'
import { validateCrossStoreRules } from '@/lib/validation/rules'

/** Derive CPF housing params from property store (single source of truth) */
export function deriveCpfHousingFromProperty(property: { mortgageCpfMonthly: number; existingMortgageRemainingYears: number; ownershipPercent?: number }) {
  const pct = property.ownershipPercent ?? 1
  const scaledCpf = property.mortgageCpfMonthly * pct
  return {
    cpfHousingMode: (scaledCpf > 0 ? 'simple' : 'none') as CpfHousingMode,
    cpfHousingMonthly: scaledCpf,
    cpfMortgageYearsLeft: property.existingMortgageRemainingYears,
  }
}

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
  const profile = useProfileStore()
  const income = useIncomeStore()
  const property = usePropertyStore()
  const cachedEntry = useNormalizedAnalysisStore((state) => state.entries[
    buildNormalizedAnalysisCacheKey({
      householdRevision: buildLegacyHouseholdRevision({
        profileRevision: profile.profileRevision ?? 0,
        incomeRevision: income.incomeRevision ?? 0,
        propertyRevision: property.propertyRevision ?? 0,
      }),
      scenarioOverrideHash: stableScenarioOverrideHash(scenarioOverrides ?? null),
    })
  ])
  const upsertEntry = useNormalizedAnalysisStore((state) => state.upsertEntry)
  const setActiveCacheKey = useNormalizedAnalysisStore((state) => state.setActiveCacheKey)

  const householdRevision = useMemo(() => buildLegacyHouseholdRevision({
    profileRevision: profile.profileRevision ?? 0,
    incomeRevision: income.incomeRevision ?? 0,
    propertyRevision: property.propertyRevision ?? 0,
  }), [profile.profileRevision, income.incomeRevision, property.propertyRevision])

  const scenarioOverrideHash = useMemo(
    () => stableScenarioOverrideHash(scenarioOverrides ?? null),
    [scenarioOverrides]
  )
  const cacheKey = useMemo(() => buildNormalizedAnalysisCacheKey({
    householdRevision,
    scenarioOverrideHash,
  }), [householdRevision, scenarioOverrideHash])

  const normalizedEntry = useMemo(() => {
    if (cachedEntry?.compiledPlan) {
      return cachedEntry
    }

    return createNormalizedAnalysisEntry(
      compileHouseholdPlan(fromLegacyIndividual({
        profile,
        income,
        property,
      })),
      householdRevision,
      scenarioOverrideHash,
    )
  }, [
    cachedEntry,
    householdRevision,
    income,
    profile,
    property,
    scenarioOverrideHash,
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
    throw new Error('Normalized analysis entry is missing a compiled household plan.')
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

/**
 * Build projection params from store state (non-hook helper).
 * Returns null if either store has validation errors.
 *
 * Property state is passed explicitly (not via getState()) so callers
 * that use this inside React hooks get reactive updates when property changes.
 */
export function buildProjectionParams(
  profile: ProfileState,
  income: IncomeState,
  property: { mortgageCpfMonthly: number; existingMortgageRemainingYears: number; ownershipPercent?: number },
  ageOverrides?: Pick<IncomeProjectionParams, 'currentAge' | 'retirementAge' | 'lifeExpectancy'>
): IncomeProjectionParams | null {
  const profileErrors = profile.validationErrors
  const incomeErrors = income.validationErrors
  if (Object.keys(profileErrors).length > 0 || Object.keys(incomeErrors).length > 0) {
    return null
  }
  const cpfHousing = deriveCpfHousingFromProperty(property)
  return {
    currentAge: ageOverrides?.currentAge ?? profile.currentAge,
    retirementAge: ageOverrides?.retirementAge ?? profile.retirementAge,
    lifeExpectancy: ageOverrides?.lifeExpectancy ?? profile.lifeExpectancy,
    salaryModel: income.salaryModel,
    annualSalary: income.annualSalary,
    salaryGrowthRate: income.salaryGrowthRate,
    bonusMonths: income.bonusMonths,
    realisticPhases: income.realisticPhases,
    promotionJumps: income.promotionJumps,
    momEducation: income.momEducation,
    momAdjustment: income.momAdjustment,
    employerCpfEnabled: income.employerCpfEnabled,
    incomeStreams: income.incomeStreams,
    lifeEvents: income.lifeEvents,
    lifeEventsEnabled: income.lifeEventsEnabled,
    annualExpenses: profile.annualExpenses,
    inflation: profile.inflation,
    personalReliefs: income.personalReliefs,
    srsAnnualContribution: profile.srsAnnualContribution,
    srsPostFireEnabled: profile.srsPostFireEnabled,
    initialCpfOA: profile.cpfOA,
    initialCpfSA: profile.cpfSA,
    initialCpfMA: profile.cpfMA,
    initialCpfRA: profile.cpfRA,
    cpfLifeStartAge: profile.cpfLifeStartAge,
    cpfLifePlan: profile.cpfLifePlan,
    cpfRetirementSum: profile.cpfRetirementSum,
    cpfHousingMode: cpfHousing.cpfHousingMode,
    cpfHousingMonthly: cpfHousing.cpfHousingMonthly,
    cpfMortgageYearsLeft: cpfHousing.cpfMortgageYearsLeft,
    cpfLifeActualMonthlyPayout: profile.cpfLifeActualMonthlyPayout,
    residencyStatus: profile.residencyStatus,
    prMonths: profile.prMonths,
    srsBalance: profile.srsBalance,
    srsInvestmentReturn: profile.srsInvestmentReturn,
    srsDrawdownStartAge: profile.srsDrawdownStartAge,
    cpfOaWithdrawals: profile.cpfOaWithdrawals,
    cpfisEnabled: profile.cpfisEnabled,
    cpfisOaReturn: profile.cpfisOaReturn,
    cpfisSaReturn: profile.cpfisSaReturn,
    cpfTopUpOA: profile.cpfTopUpOA,
    cpfTopUpSA: profile.cpfTopUpSA,
    cpfTopUpMA: profile.cpfTopUpMA,
    lockedAssets: profile.lockedAssets,
    expenseAdjustments: profile.expenseAdjustments,
    cpfAutoFallback: profile.cpfAutoFallback,
    cpfAutoFallbackIncludeSA: profile.cpfAutoFallbackIncludeSA,
    cpfVirtualRebalancing: profile.cpfVirtualRebalancing,
    cpfVirtualRebalancingMode: profile.cpfVirtualRebalancingMode,
  }
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
  const profile = useProfileStore()
  const income = useIncomeStore()
  const property = usePropertyStore()
  const normalized = useNormalizedLegacyAnalysisContext()

  return useMemo(() => {
    const profileErrors = profile.validationErrors
    const incomeErrors = income.validationErrors
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
    const allErrors = { ...profileErrors, ...incomeErrors, ...crossStoreErrors }

    if (Object.keys(allErrors).length > 0) {
      return { projection: null, summary: null, hasErrors: true, errors: allErrors }
    }

    const projectionParams = buildProjectionParams(
      profile,
      income,
      property,
      {
        currentAge: normalized.currentAge,
        retirementAge: normalized.retirementAge,
        lifeExpectancy: normalized.lifeExpectancy,
      }
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
    profile,
    property,
  ])
}
