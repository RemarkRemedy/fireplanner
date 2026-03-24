import { calculateAllFireMetrics, projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import type { AllocationState, FireMetrics, ProfileState, PropertyState } from '@/lib/types'

type TimingOverride = Pick<ProfileState, 'currentAge' | 'retirementAge' | 'lifeExpectancy'>

export function buildBaseInputsFromEffectiveIncome(
  profile: ProfileState,
  allocation: Pick<AllocationState, 'currentWeights' | 'returnOverrides' | 'validationErrors'>,
  property: PropertyState,
  effectiveIncome: number,
  timingOverride?: TimingOverride,
  postRetirementIncome?: number,
) {
  const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
  const currentAge = timingOverride?.currentAge ?? profile.currentAge
  const retirementAge = timingOverride?.retirementAge ?? profile.retirementAge
  const lifeExpectancy = timingOverride?.lifeExpectancy ?? profile.lifeExpectancy

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

  return {
    currentAge,
    retirementAge,
    annualIncome: effectiveIncome,
    annualExpenses: profile.annualExpenses,
    expenseAdjustments: profile.expenseAdjustments,
    liquidNetWorth: profile.liquidNetWorth,
    cpfTotal,
    swr: profile.swr,
    expectedReturn,
    inflation: profile.inflation,
    expenseRatio: profile.expenseRatio,
    fireType: profile.fireType,
    fireNumberBasis: profile.fireNumberBasis,
    cpfLifeStartAge: profile.cpfLifeStartAge,
    lifeExpectancy,
    retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
    propertyEquity,
    parentSupport: profile.parentSupport,
    parentSupportEnabled: profile.parentSupportEnabled,
    healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
    cashReserveOffset,
    lockedAssets: profile.lockedAssets,
    postRetirementIncome,
  }
}

export type WhatIfBaseInputs = ReturnType<typeof buildBaseInputsFromEffectiveIncome>

export function computeMetricSnapshot(inputs: WhatIfBaseInputs): {
  fireMetrics: FireMetrics
  portfolioAtRetirement: number
} {
  const fireMetrics = calculateAllFireMetrics(inputs)
  const netRealReturn = inputs.expectedReturn - inputs.inflation - inputs.expenseRatio
  const currentExpenses = getEffectiveExpenses(inputs.currentAge, inputs.annualExpenses, inputs.expenseAdjustments ?? [], inputs.lifeExpectancy)
  const annualSavings = inputs.annualIncome - currentExpenses
  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge)

  const portfolioAtRetirement = projectPortfolioAtRetirement({
    currentNW: inputs.liquidNetWorth + inputs.cpfTotal,
    annualSavings,
    netRealReturn,
    yearsToRetirement,
  })

  return { fireMetrics, portfolioAtRetirement }
}
