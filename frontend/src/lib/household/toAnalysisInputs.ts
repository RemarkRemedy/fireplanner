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
  stableRevisionHash,
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

function createLegacyHouseholdPlan(input: LegacyNormalizedEntryInput) {
  return fromLegacyIndividual(createLegacySnapshot(input))
}

function buildLegacyCompiledPlanRevision(
  householdPlan: ReturnType<typeof createLegacyHouseholdPlan>
): string {
  return buildLegacyHouseholdRevision({
    profileRevision: stableRevisionHash({
      schemaVersion: householdPlan.schemaVersion,
      householdId: householdPlan.id,
      planType: householdPlan.planType,
      adults: householdPlan.adults,
      dependents: householdPlan.dependents,
      expenses: householdPlan.expenses,
      assets: householdPlan.assets,
      goals: householdPlan.goals,
      inflation: householdPlan.assumptions.returns.inflation,
    }),
    incomeRevision: stableRevisionHash({
      income: householdPlan.income,
    }),
    propertyRevision: stableRevisionHash({
      properties: householdPlan.properties,
    }),
  })
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

    console.warn(
      `[toAnalysisInputs] retirement-withdrawal lookup failed for sourceId="${adjustment.sourceId}". ` +
      `Falling back to compiled amount (${adjustment.amount}).`
    )
  }

  return adjustment.amount
}

export function buildLegacyNormalizedAnalysisIdentity(
  input: LegacyNormalizedEntryInput
): LegacyNormalizedAnalysisIdentity {
  const householdPlan = createLegacyHouseholdPlan(input)
  const householdRevision = buildLegacyCompiledPlanRevision(householdPlan)
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
  const householdPlan = createLegacyHouseholdPlan(input)
  const householdRevision = buildLegacyCompiledPlanRevision(householdPlan)
  const scenarioOverrideHash = stableScenarioOverrideHash(
    input.scenarioOverrides ?? input.profileOverrides ?? null
  )
  const compiledPlan = compileHouseholdPlan(householdPlan)
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
