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
} from '@/lib/household/normalizedAnalysisCache'

type RevisionedProfileState = ProfileState & { profileRevision?: number }
type RevisionedIncomeState = IncomeState & { incomeRevision?: number }
type RevisionedPropertyState = PropertyState & { propertyRevision?: number }

export interface LegacyNormalizedEntryInput {
  profile: RevisionedProfileState
  income: RevisionedIncomeState
  property: RevisionedPropertyState
  profileOverrides?: Partial<Pick<ProfileState, 'annualExpenses' | 'retirementAge'>>
  scenarioOverrides?: unknown
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

export interface LegacyNormalizedAnalysisIdentity {
  cacheKey: string
  householdRevision: string
  scenarioOverrideHash: string
}

export interface LegacyNormalizedAnalysisEntry {
  cacheKey: string
  householdRevision: string
  scenarioOverrideHash: string
  compiledPlan: CompiledHouseholdPlan
  selectors: {
    deterministic: {
      rows: CompiledHouseholdPlan['rows']
      milestones: CompiledHouseholdPlan['milestones']
    }
    projection: {
      annualSavingsByYear: CompiledHouseholdPlan['annualSavingsByYear']
      postRetirementIncomeByYear: CompiledHouseholdPlan['postRetirementIncomeByYear']
      retirementExpenseBaseByYear: CompiledHouseholdPlan['retirementExpenseBaseByYear']
      householdWithdrawalNeedByYear: CompiledHouseholdPlan['householdWithdrawalNeedByYear']
      portfolioAdjustments: CompiledHouseholdPlan['portfolioAdjustments']
    }
    monteCarlo: {
      annualSavingsByYear: CompiledHouseholdPlan['annualSavingsByYear']
      postRetirementIncomeByYear: CompiledHouseholdPlan['postRetirementIncomeByYear']
      householdWithdrawalNeedByYear: CompiledHouseholdPlan['householdWithdrawalNeedByYear']
      portfolioAdjustments: CompiledHouseholdPlan['portfolioAdjustments']
    }
    backtest: {
      postRetirementIncomeByYear: CompiledHouseholdPlan['postRetirementIncomeByYear']
      retirementExpenseBaseByYear: CompiledHouseholdPlan['retirementExpenseBaseByYear']
      householdWithdrawalNeedByYear: CompiledHouseholdPlan['householdWithdrawalNeedByYear']
      portfolioAdjustments: CompiledHouseholdPlan['portfolioAdjustments']
    }
    cpf: {
      cpfByAdultId: CompiledHouseholdPlan['cpfByAdultId']
    }
    healthcare: {
      healthcareByAdultId: CompiledHouseholdPlan['healthcareByAdultId']
    }
    companion: {
      milestones: CompiledHouseholdPlan['milestones']
      annualSavingsByYear: CompiledHouseholdPlan['annualSavingsByYear']
      postRetirementIncomeByYear: CompiledHouseholdPlan['postRetirementIncomeByYear']
      householdWithdrawalNeedByYear: CompiledHouseholdPlan['householdWithdrawalNeedByYear']
    }
  }
  monteCarloOwner: typeof MONTE_CARLO_NORMALIZED_OWNER
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
): LegacyNormalizedAnalysisEntry {
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
  }

  return adjustment.amount
}

export function buildLegacyNormalizedAnalysisIdentity(
  input: LegacyNormalizedEntryInput
): LegacyNormalizedAnalysisIdentity {
  const householdRevision = buildLegacyHouseholdRevision({
    profileRevision: input.profile.profileRevision ?? 0,
    incomeRevision: input.income.incomeRevision ?? 0,
    propertyRevision: input.property.propertyRevision ?? 0,
  })
  const scenarioOverrideHash = stableScenarioOverrideHash(
    input.scenarioOverrides ?? input.profileOverrides ?? null
  )

  return {
    cacheKey: buildNormalizedAnalysisCacheKey({
      householdRevision,
      scenarioOverrideHash,
    }),
    householdRevision,
    scenarioOverrideHash,
  }
}

export function createLegacyNormalizedAnalysisEntry(
  input: LegacyNormalizedEntryInput
): LegacyNormalizedAnalysisEntry {
  const { householdRevision, scenarioOverrideHash } =
    buildLegacyNormalizedAnalysisIdentity(input)

  const compiledPlan = compileHouseholdPlan(
    fromLegacyIndividual(createLegacySnapshot(input))
  )
  return createNormalizedAnalysisEntry(
    compiledPlan,
    householdRevision,
    scenarioOverrideHash
  )
}

export function buildMonteCarloAnalysisInputsFromEntry(
  input: LegacyNormalizedEntryInput,
  entry: LegacyNormalizedAnalysisEntry
): NormalizedMonteCarloAnalysisInputs {
  const compiledPlan = entry.compiledPlan

  const referenceAdult = getReferenceAdult(compiledPlan)
  const currentAge = referenceAdult.currentAge
  const retirementAge = currentAge + compiledPlan.householdRetirementYearOffset
  const lifeExpectancy = currentAge + compiledPlan.yearCount - 1
  const annualSavings = applyCashReservePlanIfNeeded(
    input.profile,
    compiledPlan.annualSavingsByYear.slice(
      0,
      compiledPlan.householdRetirementYearOffset + 1
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
      .filter((adjustment) => adjustment.kind !== 'goal')
      .map((adjustment) => ({
        year: adjustment.yearOffset,
        amount: resolveLegacyPortfolioAdjustmentAmount(adjustment, input.profile),
      })),
  }
}
