import type { ProfileState, IncomeState, CpfHousingMode } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'

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
