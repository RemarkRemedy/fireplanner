import type {
  AllocationState,
  FireMetrics,
  IncomeProjectionRow,
  ProfileState,
  IncomeState,
  PropertyState,
  CpfHousingMode,
  SimulationState,
} from '@/lib/types'
import type { AdultOwner } from '@/lib/household/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import type { ProjectionParams } from '@/lib/calculations/projection'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { getPropertyRentalIncome, computeLbsProceeds } from '@/lib/calculations/hdb'
import { getRetirementSumAmount } from '@/lib/calculations/cpf'
import {
  buildBaseInputsFromEffectiveIncome,
  computeMetricSnapshot,
  resolveEffectiveIncome,
} from '@/hooks/useWhatIfMetrics'

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

/**
 * Compute per-adult CPF housing params from the primary property.
 * 1. Delegates to deriveCpfHousingFromProperty with the real ownershipPercent
 *    to get the household-level scaled deduction.
 * 2. For non-shared properties, the owning adult gets the full scaled amount.
 * 3. For shared properties, the scaled amount is split equally among adults.
 */
export function getPerAdultHousingParams(
  adultOwner: AdultOwner,
  primaryProperty: {
    owner: string
    mortgageCpfMonthly: number
    existingMortgageRemainingYears: number
    ownershipPercent: number
  } | null,
  adultCount: number,
): { cpfHousingMode: CpfHousingMode; cpfHousingMonthly: number; cpfMortgageYearsLeft: number } {
  if (!primaryProperty || primaryProperty.mortgageCpfMonthly <= 0) {
    return { cpfHousingMode: 'none', cpfHousingMonthly: 0, cpfMortgageYearsLeft: 0 }
  }

  // Step 1: Get household-level housing params (applies ownershipPercent scaling)
  const householdHousing = deriveCpfHousingFromProperty({
    mortgageCpfMonthly: primaryProperty.mortgageCpfMonthly,
    existingMortgageRemainingYears: primaryProperty.existingMortgageRemainingYears,
    ownershipPercent: primaryProperty.ownershipPercent,
  })

  // Step 2: Split per-adult based on property ownership
  if (primaryProperty.owner === adultOwner) {
    // This adult owns it outright — full household-level deduction
    return householdHousing
  } else if (primaryProperty.owner === 'shared') {
    // Split equally among adults
    return { ...householdHousing, cpfHousingMonthly: householdHousing.cpfHousingMonthly / adultCount }
  }
  // Other adult owns it — no deduction for this adult
  return { cpfHousingMode: 'none', cpfHousingMonthly: 0, cpfMortgageYearsLeft: 0 }
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
  property: { mortgageCpfMonthly: number; existingMortgageRemainingYears: number; ownershipPercent?: number }
): IncomeProjectionParams | null {
  const profileErrors = profile.validationErrors
  const incomeErrors = income.validationErrors
  if (Object.keys(profileErrors).length > 0 || Object.keys(incomeErrors).length > 0) {
    return null
  }
  const cpfHousing = deriveCpfHousingFromProperty(property)
  return {
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
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

// ---------------------------------------------------------------------------
// Full projection params builder (single canonical location for all callers)
// ---------------------------------------------------------------------------

export interface FullProjectionContext {
  profile: ProfileState
  income: IncomeState
  property: PropertyState
  allocation: Pick<AllocationState, 'currentWeights' | 'targetWeights' | 'returnOverrides' | 'glidePathConfig' | 'validationErrors'>
  simulation: Pick<SimulationState, 'selectedStrategy' | 'strategyParams' | 'withdrawalBasis'>
  ages: { currentAge: number; retirementAge: number; lifeExpectancy: number }
  incomeProjection: IncomeProjectionRow[]
  /** Pre-computed healthcare cash outlay per year (summed across all adults).
   *  Passed through to ProjectionParams.healthcareCashOutlayByYear. */
  healthcareCashOutlayByYear?: number[]
}

/**
 * Build the full ProjectionParams + FIRE metrics from legacy runtime inputs.
 * This is the single canonical builder — both the joint `useProjection` hook
 * and per-adult projection views call this same function.
 *
 * Pure function: no React hooks, no store reads.
 */
export function buildFullProjectionParams(
  ctx: FullProjectionContext,
): { params: ProjectionParams; fireMetrics: FireMetrics } {
  const { profile, income, property, allocation, simulation, ages, incomeProjection, healthcareCashOutlayByYear } = ctx

  const assetReturns = getEffectiveReturns(allocation.returnOverrides)
  const allocationHasErrors = Object.keys(allocation.validationErrors).length > 0
  let effectiveReturn = profile.expectedReturn
  if (profile.usePortfolioReturn && !allocationHasErrors) {
    effectiveReturn = calculatePortfolioReturn(allocation.currentWeights, assetReturns)
  }

  // LBS: add cash proceeds to portfolio, RA top-up enhances CPF LIFE
  const isLbs = property.ownsProperty
    && property.propertyType === 'hdb'
    && property.hdbMonetizationStrategy === 'lbs'
  const lbsResult = isLbs
    ? computeLbsProceeds({
        flatValue: property.existingPropertyValue,
        remainingLease: property.existingLeaseYears,
        retainedLease: property.hdbLbsRetainedLease,
        cpfRaBalance: profile.cpfRA,
        retirementSum: getRetirementSumAmount(profile.cpfRetirementSum, ages.currentAge),
      })
    : null

  const ownershipPct = property.ownershipPercent ?? 1
  const effectiveIncome = resolveEffectiveIncome(profile, incomeProjection)

  // Extract passive post-retirement income from first retired row, deflated to today's dollars.
  let postRetirementIncome: number | undefined
  if (incomeProjection) {
    const firstRetiredRow = incomeProjection.find((r) => r.isRetired)
    if (firstRetiredRow) {
      const passiveNominal = firstRetiredRow.governmentIncome
        + firstRetiredRow.rentalIncome
        + firstRetiredRow.investmentIncome
        + firstRetiredRow.businessIncome
        + firstRetiredRow.srsWithdrawal
      const yearsToRetired = firstRetiredRow.age - ages.currentAge
      postRetirementIncome = yearsToRetired > 0 && profile.inflation > 0
        ? passiveNominal / Math.pow(1 + profile.inflation, yearsToRetired)
        : passiveNominal
    }
  }

  const { fireMetrics } = computeMetricSnapshot(
    buildBaseInputsFromEffectiveIncome(
      profile,
      allocation,
      property,
      effectiveIncome,
      ages,
      postRetirementIncome,
    ),
  )

  const params: ProjectionParams = {
    incomeProjection,
    currentAge: ages.currentAge,
    retirementAge: ages.retirementAge,
    lifeExpectancy: ages.lifeExpectancy,
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
    existingPropertyValue: property.ownsProperty
      ? property.existingPropertyValue * ownershipPct
      : 0,
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
    propertyCount: property.propertyCount,
    hdbCpfUsedForHousing: property.hdbCpfUsedForHousing,
    propertyOwnershipPct: ownershipPct,
    parentSupport: profile.parentSupport,
    parentSupportEnabled: profile.parentSupportEnabled,
    healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
    healthcareCashOutlayByYear,
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

  return { params, fireMetrics }
}
