import { percentile } from '@/lib/math/stats'
import { migrateStoreData } from '@/lib/storeRegistry'
import { toStorePayload } from '@/lib/scenarios'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { FRS_BASE } from '@/lib/data/cpfRates'
import { generateIncomeProjection } from '@/lib/calculations/income'
import type { ProjectionParams } from '@/lib/calculations/projection'
import { calculateAllFireMetrics } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { computeLbsProceeds, getPropertyRentalIncome } from '@/lib/calculations/hdb'
import {
  validateAllocationField,
  validateIncomeField,
  validateProfileField,
  validateSimulationField,
} from '@/lib/validation/schemas'
import { validateAllocationCrossStoreRules, validateCrossStoreRules } from '@/lib/validation/rules'
import { runMonteCarloWorker } from '@/lib/simulation/workerClient'
import type {
  AllocationState,
  IncomeState,
  MonteCarloResult,
  ProfileState,
  ProofCycle,
  ProofSource,
  PropertyState,
  SimulationState,
  ValidationErrors,
} from '@/lib/types'
import { buildProofCyclesFromHistoricalBlended, buildProofCyclesFromMonteCarlo } from './proofData'
import { buildMonteCarloEngineParams } from './monteCarloParams'

interface ScenarioCoreStores {
  profile: ProfileState
  income: IncomeState
  allocation: AllocationState
  simulation: SimulationState
  property: PropertyState
}

export interface ProofCompareComputedSnapshot {
  source: ProofSource
  successRate: number
  medianEndingPortfolio: number
  medianSpending: number
  medianTax: number
}
const MAX_SIMULATIONS = 100000
const MAX_REASONABLE_HORIZON_YEARS = 100

function readMigratedStore(stores: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const payload = toStorePayload(stores[key])
  if (!payload) return null
  const migrated = migrateStoreData(key, payload)
  if (!migrated) return payload.state
  return migrated.state
}

function extractScenarioCoreStores(stores: Record<string, unknown>): ScenarioCoreStores | null {
  const profileRaw = readMigratedStore(stores, 'fireplanner-profile')
  const incomeRaw = readMigratedStore(stores, 'fireplanner-income')
  const allocationRaw = readMigratedStore(stores, 'fireplanner-allocation')
  const simulationRaw = readMigratedStore(stores, 'fireplanner-simulation')
  const propertyRaw = readMigratedStore(stores, 'fireplanner-property')

  if (!profileRaw || !incomeRaw || !allocationRaw || !simulationRaw || !propertyRaw) return null

  // Deserialization boundary: localStorage data has been migrated by readMigratedStore()
  // and field validity is checked by compute*ValidationErrors(). hasValidationErrors()
  // gates all downstream computation, so missing/wrong fields are caught before use.
  const profile = {
    ...profileRaw,
    validationErrors: computeProfileValidationErrors(profileRaw as Partial<ProfileState>),
  } as Partial<ProfileState> as ProfileState
  const income = {
    ...incomeRaw,
    validationErrors: computeIncomeValidationErrors(incomeRaw as Partial<IncomeState>),
  } as Partial<IncomeState> as IncomeState
  const allocation = {
    ...allocationRaw,
    validationErrors: computeAllocationValidationErrors(allocationRaw as Partial<AllocationState>),
  } as Partial<AllocationState> as AllocationState
  const simulation = {
    ...simulationRaw,
    validationErrors: computeSimulationValidationErrors(simulationRaw as Partial<SimulationState>),
  } as Partial<SimulationState> as SimulationState
  const property = { ...propertyRaw, validationErrors: {} } as Partial<PropertyState> as PropertyState

  const crossErrors = validateCrossStoreRules(
    {
      currentAge: profile.currentAge,
      retirementAge: profile.retirementAge,
      lifeExpectancy: profile.lifeExpectancy,
    },
    {
      incomeStreams: income.incomeStreams,
      lifeEvents: income.lifeEvents,
      lifeEventsEnabled: income.lifeEventsEnabled,
      promotionJumps: income.promotionJumps,
    },
  )
  income.validationErrors = { ...income.validationErrors, ...crossErrors }

  const allocationCrossErrors = validateAllocationCrossStoreRules(
    { currentAge: profile.currentAge, lifeExpectancy: profile.lifeExpectancy },
    { glidePathConfig: allocation.glidePathConfig, targetWeights: allocation.targetWeights },
  )
  allocation.validationErrors = { ...allocation.validationErrors, ...allocationCrossErrors }

  return { profile, income, allocation, simulation, property }
}

function computeProfileValidationErrors(profile: Partial<ProfileState>): ValidationErrors {
  const errors: ValidationErrors = {}
  const fields = [
    'currentAge',
    'retirementAge',
    'lifeExpectancy',
    'annualIncome',
    'annualExpenses',
    'liquidNetWorth',
    'cpfOA',
    'cpfSA',
    'cpfMA',
    'srsBalance',
    'srsAnnualContribution',
    'swr',
    'retirementSpendingAdjustment',
    'expectedReturn',
    'inflation',
    'expenseRatio',
    'cpfLifeStartAge',
    'cpfisOaReturn',
    'cpfisSaReturn',
    'cashReserveFixedAmount',
    'cashReserveMonths',
    'cashReserveReturn',
  ] as const

  for (const field of fields) {
    const err = validateProfileField(field, profile[field])
    if (err) errors[field] = err
  }

  if ((profile.lifeStage ?? 'pre-fire') !== 'post-fire'
    && typeof profile.currentAge === 'number'
    && typeof profile.retirementAge === 'number'
    && profile.retirementAge <= profile.currentAge) {
    errors.retirementAge = 'Retirement age must be greater than current age'
  }
  if (typeof profile.lifeExpectancy === 'number'
    && typeof profile.retirementAge === 'number'
    && profile.lifeExpectancy <= profile.retirementAge) {
    errors.lifeExpectancy = 'Life expectancy must be greater than retirement age'
  }

  return errors
}

function computeIncomeValidationErrors(income: Partial<IncomeState>): ValidationErrors {
  const errors: ValidationErrors = {}
  const fields = ['annualSalary', 'salaryGrowthRate', 'bonusMonths', 'momAdjustment', 'personalReliefs'] as const
  for (const field of fields) {
    const err = validateIncomeField(field, income[field])
    if (err) errors[field] = err
  }
  return errors
}

function computeAllocationValidationErrors(allocation: Partial<AllocationState>): ValidationErrors {
  const errors: ValidationErrors = {}
  const currentErr = validateAllocationField('currentWeights', allocation.currentWeights)
  const targetErr = validateAllocationField('targetWeights', allocation.targetWeights)
  if (currentErr) errors.currentWeights = currentErr
  if (targetErr) errors.targetWeights = targetErr
  return errors
}

function computeSimulationValidationErrors(simulation: Partial<SimulationState>): ValidationErrors {
  const errors: ValidationErrors = {}
  const nErr = validateSimulationField('nSimulations', simulation.nSimulations)
  if (nErr) errors.nSimulations = nErr
  const methodErr = validateSimulationField('mcMethod', simulation.mcMethod)
  if (methodErr) errors.mcMethod = methodErr
  const strategyErr = validateSimulationField('selectedStrategy', simulation.selectedStrategy)
  if (strategyErr) errors.selectedStrategy = strategyErr
  return errors
}

function hasValidationErrors(core: ScenarioCoreStores): boolean {
  return (
    Object.keys(core.profile.validationErrors).length > 0
    || Object.keys(core.income.validationErrors).length > 0
    || Object.keys(core.allocation.validationErrors).length > 0
    || Object.keys(core.simulation.validationErrors).length > 0
  )
}

function hasReasonableTimeline(profile: Pick<ProfileState, 'currentAge' | 'lifeExpectancy'>): boolean {
  if (!Number.isFinite(profile.currentAge) || !Number.isFinite(profile.lifeExpectancy)) return false
  const horizon = profile.lifeExpectancy - profile.currentAge
  return horizon > 0 && horizon <= MAX_REASONABLE_HORIZON_YEARS
}

function buildScenarioProjectionParams(core: ScenarioCoreStores): ProjectionParams | null {
  const { profile, income, allocation, simulation, property } = core
  const incomeParams = buildProjectionParams(profile, income, property)
  if (!incomeParams) return null

  const incomeProjection = generateIncomeProjection(incomeParams)
  if (incomeProjection.length === 0) return null

  const ownershipPct = property.ownershipPercent ?? 1

  const assetReturns = getEffectiveReturns(allocation.returnOverrides)
  const allocationHasErrors = Boolean(
    validateAllocationField('currentWeights', allocation.currentWeights)
    || validateAllocationField('targetWeights', allocation.targetWeights),
  )
  let effectiveReturn = profile.expectedReturn
  if (profile.usePortfolioReturn && !allocationHasErrors) {
    effectiveReturn = calculatePortfolioReturn(allocation.currentWeights, assetReturns)
  }

  const effectiveIncome = incomeProjection[0]?.totalGross ?? profile.annualIncome
  const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
  const propertyEquityForFire = property.ownsProperty
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

  const fireMetrics = calculateAllFireMetrics({
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    annualIncome: effectiveIncome,
    annualExpenses: profile.annualExpenses,
    liquidNetWorth: profile.liquidNetWorth,
    cpfTotal,
    swr: profile.swr,
    expectedReturn: effectiveReturn,
    inflation: profile.inflation,
    expenseRatio: profile.expenseRatio,
    fireType: profile.fireType,
    fireNumberBasis: profile.fireNumberBasis,
    cpfLifeStartAge: profile.cpfLifeStartAge,
    lifeExpectancy: profile.lifeExpectancy,
    retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
    propertyEquity: propertyEquityForFire,
    parentSupport: profile.parentSupport,
    parentSupportEnabled: profile.parentSupportEnabled,
    healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
    cashReserveOffset,
    lockedAssets: profile.lockedAssets,
    expenseAdjustments: profile.expenseAdjustments,
  })

  const isLbs = property.ownsProperty
    && property.propertyType === 'hdb'
    && property.hdbMonetizationStrategy === 'lbs'
  const lbsResult = isLbs
    ? computeLbsProceeds({
        flatValue: property.existingPropertyValue,
        remainingLease: property.existingLeaseYears,
        retainedLease: property.hdbLbsRetainedLease,
        cpfRaBalance: profile.cpfRA,
        retirementSum: FRS_BASE,
      })
    : null

  const projectionParams: ProjectionParams = {
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
    fireNumber: fireMetrics.fireNumber,
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
    downsizing: property.ownsProperty && property.downsizing.scenario !== 'none'
      ? property.downsizing
      : null,
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
  }

  return projectionParams
}

export async function buildProofCyclesFromScenarioSnapshot(
  scenarioStores: Record<string, unknown>,
  source: ProofSource,
  blendRatio: number,
): Promise<ProofCycle[]> {
  const core = extractScenarioCoreStores(scenarioStores)
  if (!core) {
    throw new Error('Scenario is missing required store snapshots.')
  }
  if (hasValidationErrors(core)) {
    throw new Error('Scenario has validation errors and cannot be compared.')
  }
  if (!hasReasonableTimeline(core.profile)) {
    throw new Error('Scenario has an invalid timeline.')
  }

  const projectionParams = buildScenarioProjectionParams(core)
  if (!projectionParams) {
    throw new Error('Scenario could not build projection params.')
  }

  if (source === 'historical_blended') {
    return buildProofCyclesFromHistoricalBlended(
      projectionParams,
      core.allocation.currentWeights,
      blendRatio,
    )
  }

  const rawSimulations = Number(core.simulation.nSimulations)
  if (!Number.isFinite(rawSimulations) || rawSimulations < 100 || rawSimulations > MAX_SIMULATIONS) {
    throw new Error(`Scenario has invalid simulation count (expected 100-${MAX_SIMULATIONS}).`)
  }
  const nSimulations = Math.round(rawSimulations)
  const mcSimulation: SimulationState = {
    ...core.simulation,
    nSimulations,
  }
  const mcParams = buildMonteCarloEngineParams({
    profile: core.profile,
    income: core.income,
    allocation: core.allocation,
    simulation: mcSimulation,
    property: core.property,
    initialPortfolio: core.profile.liquidNetWorth + core.profile.cpfOA + core.profile.cpfSA + core.profile.cpfMA + core.profile.cpfRA,
    allocationWeights: core.allocation.currentWeights,
  })
  const engineResult = await runMonteCarloWorker(mcParams)

  const mcResult: MonteCarloResult = {
    ...engineResult,
    safe_swr: null,
    n_simulations: mcParams.nSimulations,
    computation_time_ms: 0,
    cached: false,
  }

  return buildProofCyclesFromMonteCarlo(mcResult, projectionParams)
}

export function summarizeProofCycles(
  cycles: ProofCycle[],
  source: ProofSource,
): ProofCompareComputedSnapshot | null {
  if (cycles.length === 0) return null
  const ending = cycles.map((c) => c.endingPortfolio)
  const spending = cycles.map((c) => c.meanSpending)
  const taxes = cycles.map((c) => c.rows.reduce((sum, row) => sum + row.sgTax, 0))
  return {
    source,
    successRate: cycles.filter((c) => c.endingPortfolio > 0).length / cycles.length,
    medianEndingPortfolio: percentile(ending, 50),
    medianSpending: percentile(spending, 50),
    medianTax: percentile(taxes, 50),
  }
}
