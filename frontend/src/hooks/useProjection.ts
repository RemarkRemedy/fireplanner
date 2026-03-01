import { useMemo } from 'react'
import type { ProjectionRow, ProjectionSummary } from '@/lib/types'
import { generateProjection, type ProjectionParams } from '@/lib/calculations/projection'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { getPropertyRentalIncome, computeLbsProceeds } from '@/lib/calculations/hdb'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useFireCalculations } from '@/hooks/useFireCalculations'

interface ProjectionResult {
  rows: ProjectionRow[] | null
  summary: ProjectionSummary | null
  params: ProjectionParams | null
  hasErrors: boolean
  errors: Record<string, string>
}

/**
 * Derived hook: reads profile, income, allocation, and simulation stores,
 * computes the full year-by-year projection combining income engine,
 * portfolio growth, and withdrawal strategy.
 *
 * Returns null rows/summary when upstream validation fails.
 */
export function useProjection(): ProjectionResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const simulation = useSimulationStore()
  const property = usePropertyStore()
  const { projection: incomeProjection, hasErrors: incomeHasErrors, errors: incomeErrors } = useIncomeProjection()
  const { metrics: fireMetrics, hasErrors: fireHasErrors, errors: fireErrors } = useFireCalculations()

  return useMemo(() => {
    // Collect all upstream errors
    const allErrors = { ...incomeErrors, ...fireErrors }

    if (incomeHasErrors || fireHasErrors || !incomeProjection || !fireMetrics) {
      return { rows: null, summary: null, params: null, hasErrors: true, errors: allErrors }
    }

    // Compute effective asset returns (with overrides applied)
    const assetReturns = getEffectiveReturns(allocation.returnOverrides)

    // Determine effective expected return
    const allocationErrors = allocation.validationErrors
    const allocationHasErrors = Object.keys(allocationErrors).length > 0
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
          retirementSum: 213000,
        })
      : null

    const ownershipPct = property.ownershipPercent ?? 1

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
      // Cash portion only — CPF portion is handled by income.ts OA deduction
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
      parentSupport: profile.parentSupport,
      parentSupportEnabled: profile.parentSupportEnabled,
      healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
      retirementWithdrawals: profile.retirementWithdrawals,
      financialGoals: profile.financialGoals,
      cpfLifeStartAge: profile.cpfLifeStartAge,
      cpfLifePlan: profile.cpfLifePlan,
      expenseAdjustments: profile.expenseAdjustments,
    }

    const { rows, summary } = generateProjection(projectionParams)

    return { rows, summary, params: projectionParams, hasErrors: false, errors: {} }
  }, [
    incomeProjection,
    incomeHasErrors,
    incomeErrors,
    fireMetrics,
    fireHasErrors,
    fireErrors,
    profile.currentAge,
    profile.retirementAge,
    profile.lifeExpectancy,
    profile.liquidNetWorth,
    profile.swr,
    profile.expectedReturn,
    profile.usePortfolioReturn,
    profile.inflation,
    profile.expenseRatio,
    profile.annualExpenses,
    profile.retirementSpendingAdjustment,
    allocation.currentWeights,
    allocation.targetWeights,
    allocation.returnOverrides,
    allocation.glidePathConfig,
    allocation.validationErrors,
    simulation.selectedStrategy,
    simulation.strategyParams,
    simulation.withdrawalBasis,
    property.ownsProperty,
    property.existingPropertyValue,
    property.existingMortgageBalance,
    property.existingMonthlyPayment,
    property.ownershipPercent,
    property.mortgageCpfMonthly,
    property.existingMortgageRate,
    property.existingMortgageRemainingYears,
    property.downsizing,
    property.residencyForAbsd,
    property.propertyType,
    property.hdbMonetizationStrategy,
    property.hdbSublettingRooms,
    property.hdbSublettingRate,
    property.hdbLbsRetainedLease,
    property.existingLeaseYears,
    property.existingAppreciationRate,
    property.existingApplyBalaDecay,
    profile.cpfRA,
    profile.parentSupportEnabled,
    profile.parentSupport,
    profile.healthcareConfig,
    profile.retirementWithdrawals,
    profile.financialGoals,
    profile.cpfLifeStartAge,
    profile.cpfLifePlan,
    profile.expenseAdjustments,
  ])
}
