import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAnalysisPortfolio } from './useAnalysisPortfolio'
import { useFireCalculations } from './useFireCalculations'
import { useProjection } from './useProjection'
import { buildSequenceRiskWorkerParams } from './useSequenceRiskQuery'
import { useNormalizedLegacyAnalysisContext } from './useIncomeProjection'
import { flattenStrategyParams } from '@/lib/simulation/workerClient'
import type { CrisisScenario } from '@/lib/types'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { calculateAllFireMetrics, projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn, getEffectiveReturns, getEffectiveStdDevs, buildYearlyWeights } from '@/lib/calculations/portfolio'
import { generateProjection } from '@/lib/calculations/projection'
import { getEffectiveExpenses, getExpensesAtRetirement } from '@/lib/calculations/expenses'
import { resolveDeterministicExpectedReturn } from '@/lib/analysis/deterministicAssumptions'
import { getPropertyRentalIncome, computeLbsProceeds } from '@/lib/calculations/hdb'
import { sumPostRetirementIncome, getLifeEventExpenseImpact } from '@/lib/calculations/income'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'
import { buildProjectionParams } from './useIncomeProjection'
import { DEFAULT_PROFILE, useProfileStore } from '@/stores/useProfileStore'
import { DEFAULT_INCOME, useIncomeStore } from '@/stores/useIncomeStore'
import { DEFAULT_PROPERTY, usePropertyStore } from '@/stores/usePropertyStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'

type FixtureProfileState = typeof DEFAULT_PROFILE & {
  validationErrors: Record<string, string>
  profileRevision: number
}

type FixtureIncomeState = typeof DEFAULT_INCOME & {
  validationErrors: Record<string, string>
  incomeRevision: number
}

type FixturePropertyState = typeof DEFAULT_PROPERTY & {
  validationErrors: Record<string, string>
  propertyRevision: number
}

interface FixtureState {
  profile: FixtureProfileState
  income: FixtureIncomeState
  property: FixturePropertyState
  allocation: ReturnType<typeof useAllocationStore.getState>
  simulation: ReturnType<typeof useSimulationStore.getState>
  withdrawal: ReturnType<typeof useWithdrawalStore.getState>
}

const CRISIS: CrisisScenario = {
  id: 'fixture-crisis',
  name: 'Fixture Crisis',
  region: 'US',
  startYear: 2000,
  peakDrawdown: -0.4,
  durationYears: 3,
  recoveryYears: 5,
  equityReturnSequence: [-0.3, -0.15, 0.05],
  description: 'Representative crisis scenario for normalized parity fixtures',
}

function buildFixtureState(
  snapshot: (typeof LEGACY_PARITY_FIXTURES)[keyof typeof LEGACY_PARITY_FIXTURES]
): FixtureState {
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  useWithdrawalStore.getState().reset()

  return {
    profile: {
      ...DEFAULT_PROFILE,
      ...snapshot.profile,
      validationErrors: {},
      profileRevision: 1,
    },
    income: {
      ...DEFAULT_INCOME,
      ...snapshot.income,
      validationErrors: {},
      incomeRevision: 1,
    },
    property: {
      ...DEFAULT_PROPERTY,
      ...snapshot.property,
      validationErrors: {},
      propertyRevision: 1,
    },
    allocation: useAllocationStore.getState(),
    simulation: useSimulationStore.getState(),
    withdrawal: useWithdrawalStore.getState(),
  }
}

function seedStores(snapshot: (typeof LEGACY_PARITY_FIXTURES)[keyof typeof LEGACY_PARITY_FIXTURES]) {
  const state = buildFixtureState(snapshot)
  act(() => {
    useNormalizedAnalysisStore.getState().clearEntries()
    useProfileStore.setState(state.profile)
    useIncomeStore.setState(state.income)
    usePropertyStore.setState(state.property)
  })
  return state
}

function buildLegacyAnalysisPortfolioSurface(input: FixtureState) {
  const { profile, allocation } = input
  const totalNW = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
  const portfolioReturn = resolveDeterministicExpectedReturn(profile, allocation)
  const netRealReturn = portfolioReturn - profile.inflation - profile.expenseRatio
  const currentExpenses = getEffectiveExpenses(
    profile.currentAge,
    profile.annualExpenses,
    profile.expenseAdjustments,
    profile.lifeExpectancy,
  )
  const annualSavings = profile.annualIncome - currentExpenses

  return {
    initialPortfolio: totalNW,
    retirementPortfolio: projectPortfolioAtRetirement({
      currentNW: totalNW,
      annualSavings,
      netRealReturn,
      yearsToRetirement: profile.retirementAge - profile.currentAge,
    }),
    allocationWeights: allocation.currentWeights,
  }
}

function buildLegacyFireSurface(input: FixtureState) {
  const { profile, income, allocation, property } = input

  let effectiveIncome = profile.annualIncome
  const projectionParams = buildProjectionParams(profile, income, property)
  if (projectionParams) {
    const projection = generateIncomeProjection(projectionParams)
    if (projection.length > 0) {
      effectiveIncome = projection[0].totalGross
    }
  }

  let expectedReturn = profile.expectedReturn
  const allocationHasErrors = Object.keys(allocation.validationErrors).length > 0
  if (profile.usePortfolioReturn && !allocationHasErrors) {
    expectedReturn = calculatePortfolioReturn(allocation.currentWeights, getEffectiveReturns(allocation.returnOverrides))
  }

  const ownershipPct = property.ownershipPercent ?? 1
  const propertyEquity = property.ownsProperty
    ? Math.max(0, property.existingPropertyValue - property.existingMortgageBalance) * ownershipPct
    : 0

  const cashReserveOffset = computeCashReserveOffset(
    profile.liquidNetWorth,
    profile.cashReserveEnabled,
    profile.cashReserveMode,
    profile.cashReserveFixedAmount,
    profile.cashReserveMonths,
    profile.annualExpenses,
  )

  const metrics = calculateAllFireMetrics({
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    annualIncome: effectiveIncome,
    annualExpenses: profile.annualExpenses,
    liquidNetWorth: profile.liquidNetWorth,
    cpfTotal: profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA,
    swr: profile.swr,
    expectedReturn,
    inflation: profile.inflation,
    expenseRatio: profile.expenseRatio,
    fireType: profile.fireType,
    fireNumberBasis: profile.fireNumberBasis,
    cpfLifeStartAge: profile.cpfLifeStartAge,
    lifeExpectancy: profile.lifeExpectancy,
    retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
    propertyEquity,
    parentSupport: profile.parentSupport,
    parentSupportEnabled: profile.parentSupportEnabled,
    healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
    cashReserveOffset,
    lockedAssets: profile.lockedAssets,
    expenseAdjustments: profile.expenseAdjustments,
  })

  return {
    fireNumber: metrics.fireNumber,
    progress: metrics.progress,
    yearsToFire: metrics.yearsToFire,
    fireAge: metrics.fireAge,
    totalNWIncProperty: metrics.totalNWIncProperty,
  }
}

function buildLegacyProjectionSurface(input: FixtureState) {
  const { profile, income, allocation, simulation, property } = input
  const incomeProjection = generateIncomeProjection(buildProjectionParams(profile, income, property)!)
  const fire = buildLegacyFireSurface(input)
  const assetReturns = getEffectiveReturns(allocation.returnOverrides)
  const allocationErrors = allocation.validationErrors
  const allocationHasErrors = Object.keys(allocationErrors).length > 0
  let effectiveReturn = profile.expectedReturn
  if (profile.usePortfolioReturn && !allocationHasErrors) {
    effectiveReturn = calculatePortfolioReturn(allocation.currentWeights, assetReturns)
  }

  const isLbs = property.ownsProperty
    && property.propertyType === 'hdb'
    && property.hdbMonetizationStrategy === 'lbs'
  const lbsResult = isLbs
    ? computeLbsProceeds({
        flatValue: property.existingPropertyValue,
        remainingLease: property.existingLeaseYears,
        retainedLease: property.hdbLbsRetainedLease,
        cpfRaBalance: profile.cpfRA,
        retirementSum: 213000,
      })
    : null

  const ownershipPct = property.ownershipPercent ?? 1
  const { rows, summary } = generateProjection({
    incomeProjection,
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    initialLiquidNW: profile.liquidNetWorth + (lbsResult?.cashProceeds ?? 0),
    swr: profile.swr,
    expectedReturn: effectiveReturn,
    usePortfolioReturn: profile.usePortfolioReturn && !allocationHasErrors,
    inflation: profile.inflation,
    expenseRatio: profile.expenseRatio,
    annualExpenses: profile.annualExpenses,
    retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
    fireNumber: fire.fireNumber,
    currentWeights: allocation.currentWeights,
    targetWeights: allocation.targetWeights,
    assetReturns,
    glidePathConfig: allocation.glidePathConfig,
    withdrawalStrategy: simulation.selectedStrategy,
    strategyParams: simulation.strategyParams,
    withdrawalBasis: simulation.withdrawalBasis,
    propertyEquity: property.ownsProperty
      ? Math.max(0, property.existingPropertyValue - property.existingMortgageBalance) * ownershipPct
      : 0,
    annualMortgagePayment: property.ownsProperty
      ? (property.existingMonthlyPayment - property.mortgageCpfMonthly) * 12 * ownershipPct
      : 0,
    annualRentalIncome: getPropertyRentalIncome(property),
    existingPropertyValue: property.ownsProperty ? property.existingPropertyValue * ownershipPct : 0,
    propertyAppreciationRate: property.existingAppreciationRate,
    propertyLeaseYears: property.existingLeaseYears,
    applyBalaDecay: property.existingApplyBalaDecay,
    downsizing: property.ownsProperty && property.downsizing.scenario !== 'none' ? property.downsizing : null,
    existingMortgageBalance: property.existingMortgageBalance * ownershipPct,
    existingMortgageRate: property.existingMortgageRate,
    existingMonthlyPayment: property.existingMonthlyPayment * ownershipPct,
    existingMortgageRemainingYears: property.existingMortgageRemainingYears,
    residencyForAbsd: property.residencyForAbsd,
    parentSupport: profile.parentSupport,
    parentSupportEnabled: profile.parentSupportEnabled,
    healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
    retirementWithdrawals: profile.retirementWithdrawals,
    financialGoals: profile.financialGoals,
    cpfLifeStartAge: profile.cpfLifeStartAge,
    cpfLifePlan: profile.cpfLifePlan,
    expenseAdjustments: profile.expenseAdjustments,
    lifeEvents: income.lifeEvents,
    lifeEventsEnabled: income.lifeEventsEnabled,
    cpfAutoFallback: profile.cpfAutoFallback,
    cpfAutoFallbackIncludeSA: profile.cpfAutoFallbackIncludeSA,
    cpfVirtualRebalancing: profile.cpfVirtualRebalancing,
    cpfVirtualRebalancingMode: profile.cpfVirtualRebalancingMode,
  })

  const retirementRow = rows.find((row) => row.age === profile.retirementAge) ?? null

  return {
    summary: {
      terminalLiquidNW: summary.terminalLiquidNW,
      portfolioDepletedAge: summary.portfolioDepletedAge,
      totalGoalShortfall: summary.totalGoalShortfall,
      totalRetirementWithdrawalShortfall: summary.totalRetirementWithdrawalShortfall,
      mediSaveDepletionAge: summary.mediSaveDepletionAge,
    },
    retirementRowAge: retirementRow?.age ?? null,
  }
}

function buildLegacySequenceRiskSurface(input: FixtureState) {
  const { profile, income, allocation, withdrawal, property, simulation } = input
  const analysisPortfolio = buildLegacyAnalysisPortfolioSurface(input)
  const strategy = withdrawal.selectedStrategies[0] ?? 'constant_dollar'
  const projectionParams = buildProjectionParams(profile, income, property)
  const postRetirementIncome: number[] = []
  const ownershipPct = property.ownershipPercent ?? 1
  const annualMortgagePayment = property.ownsProperty
    ? (property.existingMonthlyPayment - property.mortgageCpfMonthly) * 12 * ownershipPct
    : 0
  const mortgageEndAge = property.ownsProperty
    ? profile.currentAge + Math.ceil(property.existingMortgageRemainingYears)
    : 0
  const ds = property.downsizing
  const dsSellAge = ds?.scenario !== 'none' && property.ownsProperty
    ? ds.sellAge
    : null
  let dsNewMonthlyPayment = 0
  let dsAnnualRent = 0
  const portfolioInjections: { year: number; amount: number }[] = []
  const retirementDuration = profile.lifeExpectancy - profile.retirementAge

  if (ds && ds.scenario !== 'none' && property.ownsProperty) {
    const yearOffset = ds.sellAge - profile.retirementAge
    if (yearOffset >= 0 && yearOffset < retirementDuration) {
      const yearsToSell = ds.sellAge - profile.currentAge
      const outstandingAtSell = outstandingMortgageAtAge(
        property.existingMortgageBalance,
        property.existingMonthlyPayment,
        property.existingMortgageRate,
        Math.max(0, yearsToSell),
      )

      let netEquity = 0
      let shortfall = 0
      if (ds.scenario === 'sell-and-downsize') {
        const result = calculateSellAndDownsize({
          salePrice: ds.expectedSalePrice,
          outstandingMortgage: outstandingAtSell,
          newPropertyCost: ds.newPropertyCost,
          newLtv: ds.newLtv,
          newMortgageRate: ds.newMortgageRate,
          newMortgageTerm: ds.newMortgageTerm,
          residency: property.residencyForAbsd,
          propertyCount: 0,
        })
        netEquity = result.netEquityToPortfolio
        shortfall = result.shortfall
        dsNewMonthlyPayment = result.newMonthlyPayment
      } else if (ds.scenario === 'sell-and-rent') {
        const result = calculateSellAndRent({
          salePrice: ds.expectedSalePrice,
          outstandingMortgage: outstandingAtSell,
          monthlyRent: ds.monthlyRent,
        })
        netEquity = result.netProceedsToPortfolio
        shortfall = result.shortfall
        dsAnnualRent = result.annualRent
      }

      const netAdjustment = netEquity - shortfall
      if (netAdjustment !== 0) {
        portfolioInjections.push({ year: yearOffset, amount: netAdjustment })
      }
    }
  }

  if (projectionParams) {
    const projection = generateIncomeProjection(projectionParams)
    const annualRentalIncome = getPropertyRentalIncome(property)
    for (const row of projection) {
      if (!row.isRetired) continue

      const isSold = dsSellAge !== null && row.age >= dsSellAge
      let rentalForYear: number
      let mortgageForYear: number
      let cpfOaShortfallForYear: number
      let downsizingRentForYear = 0

      if (isSold) {
        rentalForYear = 0
        cpfOaShortfallForYear = 0
        if (ds?.scenario === 'sell-and-downsize') {
          mortgageForYear = dsNewMonthlyPayment * 12
        } else if (ds?.scenario === 'sell-and-rent') {
          mortgageForYear = 0
          const yearsSinceSell = row.age - dsSellAge!
          downsizingRentForYear = dsAnnualRent * Math.pow(1 + (ds.rentGrowthRate ?? 0.03), yearsSinceSell)
        } else {
          mortgageForYear = 0
        }
      } else {
        rentalForYear = annualRentalIncome
        mortgageForYear = row.age >= mortgageEndAge ? 0 : annualMortgagePayment
        cpfOaShortfallForYear = row.cpfOaShortfall
      }

      const retEffectiveBase = getEffectiveExpenses(
        row.age,
        profile.annualExpenses,
        profile.expenseAdjustments ?? [],
        profile.lifeExpectancy,
      )
      const { adjustedExpense: retLifeEventExpense, lumpSum: retLumpSum } = getLifeEventExpenseImpact(
        row.age,
        retEffectiveBase,
        income.lifeEvents,
        income.lifeEventsEnabled,
      )
      const retYear = row.age - profile.currentAge
      const lifeEventExpenseDelta = (retLifeEventExpense - retEffectiveBase) * Math.pow(1 + profile.inflation, retYear)

      postRetirementIncome.push(
        sumPostRetirementIncome(row, rentalForYear)
          - mortgageForYear
          - cpfOaShortfallForYear
          - downsizingRentForYear
          - lifeEventExpenseDelta
      )

      if (retLumpSum > 0) {
        const yearOffset = row.age - profile.retirementAge
        const inflatedLumpSum = retLumpSum * Math.pow(1 + profile.inflation, retYear)
        portfolioInjections.push({ year: yearOffset, amount: -inflatedLumpSum })
      }
    }
  }

  const oneTimeWithdrawals: { year: number; amount: number }[] = []
  for (const withdrawalEntry of profile.retirementWithdrawals) {
    for (let durationOffset = 0; durationOffset < (withdrawalEntry.durationYears ?? 1); durationOffset += 1) {
      const yearOffset = (withdrawalEntry.age + durationOffset) - profile.retirementAge
      if (yearOffset >= 0 && yearOffset < retirementDuration) {
        oneTimeWithdrawals.push({ year: yearOffset, amount: withdrawalEntry.amount })
      }
    }
  }

  return {
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    annualExpensesAtRetirement: getExpensesAtRetirement(
      profile.retirementAge,
      profile.currentAge,
      profile.annualExpenses,
      profile.expenseAdjustments,
      profile.lifeExpectancy,
      profile.inflation,
    ),
    expectedReturns: getEffectiveReturns(allocation.returnOverrides),
    stdDevs: getEffectiveStdDevs(allocation.stdDevOverrides),
    postRetirementIncome,
    oneTimeWithdrawals,
    portfolioInjections,
    yearlyWeights: allocation.glidePathConfig.enabled
      ? buildYearlyWeights(
          retirementDuration,
          profile.retirementAge,
          allocation.currentWeights,
          allocation.targetWeights,
          allocation.glidePathConfig,
        )
      : undefined,
    withdrawalStrategy: strategy,
    strategyParams: flattenStrategyParams(strategy, withdrawal.strategyParams),
    withdrawalBasis: simulation.withdrawalBasis,
    initialPortfolio: analysisPortfolio.retirementPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
  }
}

function buildNormalizedSurface(snapshot: (typeof LEGACY_PARITY_FIXTURES)[keyof typeof LEGACY_PARITY_FIXTURES]) {
  const state = seedStores(snapshot)
  const { result } = renderHook(() => ({
    analysis: useAnalysisPortfolio(),
    fire: useFireCalculations(),
    projection: useProjection(),
  }))
  const normalized = renderHook(() => useNormalizedLegacyAnalysisContext()).result.current
  const retirementRow = result.current.projection.rows?.find((row) => row.age === state.profile.retirementAge) ?? null

  return {
    analysisResult: result.current.analysis,
    normalized,
    state,
    surface: {
      analysis: {
        initialPortfolio: result.current.analysis.initialPortfolio,
        retirementPortfolio: result.current.analysis.retirementPortfolio,
        allocationWeights: result.current.analysis.allocationWeights,
      },
      fire: {
        fireNumber: result.current.fire.metrics?.fireNumber ?? null,
        progress: result.current.fire.metrics?.progress ?? null,
        yearsToFire: result.current.fire.metrics?.yearsToFire ?? null,
        fireAge: result.current.fire.metrics?.fireAge ?? null,
        totalNWIncProperty: result.current.fire.metrics?.totalNWIncProperty ?? null,
      },
      projection: {
        summary: result.current.projection.summary
          ? {
              terminalLiquidNW: result.current.projection.summary.terminalLiquidNW,
              portfolioDepletedAge: result.current.projection.summary.portfolioDepletedAge,
              totalGoalShortfall: result.current.projection.summary.totalGoalShortfall,
              totalRetirementWithdrawalShortfall: result.current.projection.summary.totalRetirementWithdrawalShortfall,
              mediSaveDepletionAge: result.current.projection.summary.mediSaveDepletionAge,
            }
          : null,
        retirementRowAge: retirementRow?.age ?? null,
      },
    },
  }
}

function buildSequenceRiskSurface(input: ReturnType<typeof buildSequenceRiskWorkerParams>) {
  return {
    retirementAge: input.retirementAge,
    lifeExpectancy: input.lifeExpectancy,
    annualExpensesAtRetirement: input.annualExpensesAtRetirement ?? null,
    expectedReturns: input.expectedReturns,
    stdDevs: input.stdDevs,
    postRetirementIncome: input.postRetirementIncome,
    oneTimeWithdrawals: input.oneTimeWithdrawals ?? [],
    portfolioInjections: input.portfolioInjections ?? [],
    yearlyWeights: input.yearlyWeights ?? undefined,
    withdrawalStrategy: input.withdrawalStrategy,
    strategyParams: input.strategyParams,
    withdrawalBasis: input.withdrawalBasis,
    initialPortfolio: input.initialPortfolio,
    allocationWeights: input.allocationWeights,
  }
}

function expectParityClose(actual: unknown, expected: unknown, path = 'root') {
  if (
    (actual === null && expected === undefined)
    || (actual === undefined && expected === null)
  ) {
    return
  }

  if (typeof actual === 'number' && typeof expected === 'number') {
    const tolerance = /progress|withdrawalRate|expectedReturns|stdDevs/i.test(path) ? 0.001 : 1
    expect(Math.abs(actual - expected), path).toBeLessThanOrEqual(tolerance)
    return
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    expect(actual.length, `${path}.length`).toBe(expected.length)
    actual.forEach((entry, index) => {
      expectParityClose(entry, expected[index], `${path}[${index}]`)
    })
    return
  }

  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const actualRecord = actual as Record<string, unknown>
    const expectedRecord = expected as Record<string, unknown>
    expect(Object.keys(actualRecord).sort(), `${path}.keys`).toEqual(Object.keys(expectedRecord).sort())
    for (const key of Object.keys(actualRecord)) {
      expectParityClose(actualRecord[key], expectedRecord[key], `${path}.${key}`)
    }
    return
  }

  expect(actual, path).toEqual(expected)
}

beforeEach(() => {
  act(() => {
    localStorage.clear()
    useNormalizedAnalysisStore.getState().clearEntries()
    useProfileStore.getState().reset()
    useIncomeStore.getState().reset()
    usePropertyStore.getState().reset()
    useAllocationStore.getState().reset()
    useSimulationStore.getState().reset()
    useWithdrawalStore.getState().reset()
  })
})

describe('normalized analysis parity snapshots', () => {
  it.each([
    ['salary-only', LEGACY_PARITY_FIXTURES.salaryOnly],
    ['property-and-CPF', LEGACY_PARITY_FIXTURES.propertyAndCpf],
    ['goals-and-life-events', LEGACY_PARITY_FIXTURES.goalsAndLifeEvents],
    ['pr-residency-transition', LEGACY_PARITY_FIXTURES.prResidencyTransition],
  ])('keeps deterministic and projection surfaces within parity thresholds for %s', (_, snapshot) => {
    const { analysisResult, normalized, state, surface } = buildNormalizedSurface(snapshot)
    const legacyInput = buildFixtureState(snapshot)
    const legacySurface = {
      analysis: buildLegacyAnalysisPortfolioSurface(legacyInput),
      fire: buildLegacyFireSurface(legacyInput),
      projection: buildLegacyProjectionSurface(legacyInput),
    }

    expectParityClose(surface, legacySurface)
    expect(surface).toMatchSnapshot()

    const sequenceRiskSurface = buildSequenceRiskSurface(buildSequenceRiskWorkerParams({
      allocation: state.allocation,
      analysisPortfolio: analysisResult,
      crisis: CRISIS,
      normalized,
      profile: useProfileStore.getState(),
      simulation: state.simulation,
      withdrawal: state.withdrawal,
    }))
    expect(buildLegacySequenceRiskSurface(legacyInput).withdrawalBasis).toBe(sequenceRiskSurface.withdrawalBasis)
    expect(sequenceRiskSurface).toMatchSnapshot()
  })
})
