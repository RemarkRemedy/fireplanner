import { useMemo } from 'react'
import type { IncomeProjectionRow, IncomeSummaryStats, ProfileState, IncomeState, CpfHousingMode } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import { generateIncomeProjection, calculateIncomeSummary } from '@/lib/calculations/income'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
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
  const cpfHousing = deriveCpfHousingFromProperty(property)

  return useMemo(() => {
    const profileErrors = profile.validationErrors
    const incomeErrors = income.validationErrors
    const crossStoreErrors = validateCrossStoreRules(
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
      }
    )
    const allErrors = { ...profileErrors, ...incomeErrors, ...crossStoreErrors }

    if (Object.keys(allErrors).length > 0) {
      return { projection: null, summary: null, hasErrors: true, errors: allErrors }
    }

    const projection = generateIncomeProjection({
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
    })

    const summary = calculateIncomeSummary(projection, profile.annualExpenses)

    return { projection, summary, hasErrors: false, errors: {} }
  }, [
    profile.currentAge,
    profile.retirementAge,
    profile.lifeExpectancy,
    profile.annualExpenses,
    profile.inflation,
    profile.srsAnnualContribution,
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
    profile.validationErrors,
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
    income.validationErrors,
  ])
}
