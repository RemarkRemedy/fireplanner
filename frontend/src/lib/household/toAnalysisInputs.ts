import { computeCashReserveOffset, computeCashReservePlan } from '@/lib/calculations/cashReserve'
import {
  compileHouseholdPlan,
  type CompiledHouseholdPlan,
} from '@/lib/household/compileHouseholdPlan'
import {
  fromLegacyIndividual,
  type LegacyIndividualSnapshot,
} from '@/lib/household/fromLegacyIndividual'
import type {
  IncomeState,
  ProfileState,
  PropertyState,
} from '@/lib/types'
import {
  buildLegacyHouseholdRevision,
  buildNormalizedAnalysisCacheKey,
  MONTE_CARLO_NORMALIZED_OWNER,
  stableScenarioOverrideHash,
  type NormalizedAnalysisCacheOps,
  type NormalizedAnalysisEntry,
} from '@/stores/useNormalizedAnalysisStore'

export type { NormalizedAnalysisCacheOps }

type RevisionedProfileState = ProfileState & { profileRevision?: number }
type RevisionedIncomeState = IncomeState & { incomeRevision?: number }
type RevisionedPropertyState = PropertyState & { propertyRevision?: number }

interface LegacyNormalizedEntryInput {
  profile: RevisionedProfileState
  income: RevisionedIncomeState
  property: RevisionedPropertyState
  profileOverrides?: Partial<Pick<ProfileState, 'annualExpenses' | 'retirementAge'>>
  scenarioOverrides?: Record<string, unknown> | null
}

export interface NormalizedMonteCarloAnalysisInputs {
  cacheKey: string
  householdRevision: string
  scenarioOverrideHash: string
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualSavings: number[]
  postRetirementIncome: number[]
  annualExpensesAtRetirement: number
  portfolioAdjustments: { year: number; amount: number }[]
}

function createLegacySnapshot(
  input: LegacyNormalizedEntryInput
): LegacyIndividualSnapshot {
  return {
    profile: {
      ...input.profile,
      ...input.profileOverrides,
    },
    income: { ...input.income },
    property: { ...input.property },
  }
}

function createNormalizedAnalysisEntry(
  compiledPlan: CompiledHouseholdPlan,
  householdRevision: string,
  scenarioOverrideHash: string
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

function getReferenceAdult(compiledPlan: CompiledHouseholdPlan) {
  const referenceAdultId = compiledPlan.adultOrder.find(
    (adultId) => compiledPlan.adultsById[adultId].owner === 'self'
  ) ?? compiledPlan.adultOrder[0]

  return compiledPlan.adultsById[referenceAdultId]
}

function applyCashReservePlanIfNeeded(
  profile: RevisionedProfileState,
  annualSavings: number[]
): number[] {
  if (!profile.cashReserveEnabled || annualSavings.length === 0) {
    return annualSavings
  }

  const reserveOffset = computeCashReserveOffset(
    profile.liquidNetWorth,
    profile.cashReserveEnabled,
    profile.cashReserveMode,
    profile.cashReserveFixedAmount,
    profile.cashReserveMonths,
    profile.annualExpenses,
  )
  const reservePlan = computeCashReservePlan({
    mode: profile.cashReserveMode,
    target: profile.cashReserveFixedAmount,
    months: profile.cashReserveMonths,
    initialBalance: reserveOffset,
    annualSavingsArray: annualSavings,
    cashReturn: profile.cashReserveReturn,
    inflationRate: profile.inflation,
    annualExpenses: profile.annualExpenses,
  })

  return reservePlan.investedSavings
}

function resolveLegacyPortfolioAdjustmentAmount(
  adjustment: CompiledHouseholdPlan['portfolioAdjustments'][number],
  profile: RevisionedProfileState
): number {
  if (adjustment.kind === 'retirement-withdrawal') {
    const legacyWithdrawalId = adjustment.sourceId.replace(
      /^expense-retirement-withdrawal-/,
      ''
    )
    const matchingWithdrawal = profile.retirementWithdrawals.find(
      (withdrawal) => withdrawal.id === legacyWithdrawalId
    )

    if (matchingWithdrawal) {
      return -matchingWithdrawal.amount
    }

    console.warn(
      `[toAnalysisInputs] retirement-withdrawal lookup failed for sourceId="${adjustment.sourceId}". ` +
      `Falling back to compiled amount (${adjustment.amount}).`
    )
  }

  return adjustment.amount
}

export function getOrCreateLegacyNormalizedAnalysisEntry(
  input: LegacyNormalizedEntryInput,
  cacheOps: NormalizedAnalysisCacheOps
): NormalizedAnalysisEntry {
  const householdRevision = buildLegacyHouseholdRevision({
    profileRevision: input.profile.profileRevision ?? 0,
    incomeRevision: input.income.incomeRevision ?? 0,
    propertyRevision: input.property.propertyRevision ?? 0,
  })
  const scenarioOverrideHash = stableScenarioOverrideHash({
    profileOverrides: input.profileOverrides ?? null,
    scenarioOverrides: input.scenarioOverrides ?? null,
  })
  const cacheKey = buildNormalizedAnalysisCacheKey({
    householdRevision,
    scenarioOverrideHash,
  })

  const existingEntry = cacheOps.getEntry(cacheKey)
  if (existingEntry?.compiledPlan) {
    cacheOps.setActiveCacheKey(cacheKey)
    return existingEntry
  }

  const compiledPlan = compileHouseholdPlan(
    fromLegacyIndividual(createLegacySnapshot(input))
  )
  const entry = createNormalizedAnalysisEntry(
    compiledPlan,
    householdRevision,
    scenarioOverrideHash
  )

  cacheOps.upsertEntry(entry)
  cacheOps.setActiveCacheKey(cacheKey)

  return entry
}

export function toMonteCarloAnalysisInputs(
  input: LegacyNormalizedEntryInput,
  cacheOps: NormalizedAnalysisCacheOps
): NormalizedMonteCarloAnalysisInputs {
  const entry = getOrCreateLegacyNormalizedAnalysisEntry(input, cacheOps)
  const compiledPlan = entry.compiledPlan

  if (!compiledPlan) {
    throw new Error('Normalized analysis entry is missing a compiled household plan.')
  }

  const referenceAdult = getReferenceAdult(compiledPlan)
  const currentAge = referenceAdult.currentAge
  const retirementAge = currentAge + compiledPlan.householdRetirementYearOffset
  const lifeExpectancy = currentAge + compiledPlan.yearCount - 1
  const annualSavings = applyCashReservePlanIfNeeded(
    input.profile,
    compiledPlan.annualSavingsByYear.slice(
      0,
      compiledPlan.householdRetirementYearOffset
    )
  )

  return {
    cacheKey: entry.cacheKey,
    householdRevision: entry.householdRevision,
    scenarioOverrideHash: entry.scenarioOverrideHash,
    currentAge,
    retirementAge,
    lifeExpectancy,
    annualSavings,
    postRetirementIncome: compiledPlan.postRetirementIncomeByYear.slice(
      compiledPlan.householdRetirementYearOffset + 1
    ),
    annualExpensesAtRetirement:
      compiledPlan.retirementExpenseBaseByYear[compiledPlan.householdRetirementYearOffset] ?? 0,
    portfolioAdjustments: compiledPlan.portfolioAdjustments
      .map((adjustment) => ({
        year: adjustment.yearOffset,
        amount: resolveLegacyPortfolioAdjustmentAmount(adjustment, input.profile),
      })),
  }
}
