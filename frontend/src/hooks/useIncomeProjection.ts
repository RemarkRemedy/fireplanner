import { useMemo } from 'react'
import type { IncomeProjectionRow, IncomeSummaryStats, ProfileState, IncomeState, CpfHousingMode, HouseholdIncomeProjectionRow } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import { generateIncomeProjection, calculateIncomeSummary, generateHouseholdIncomeProjection } from '@/lib/calculations/income'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { validateCrossStoreRules } from '@/lib/validation/rules'

/** Derive CPF housing params from property store (single source of truth) */
function deriveCpfHousingFromProperty(property: { mortgageCpfMonthly: number; existingMortgageRemainingYears: number; ownershipPercent?: number }) {
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
 */
export function buildProjectionParams(
  profile: ProfileState,
  income: IncomeState
): IncomeProjectionParams | null {
  const profileErrors = profile.validationErrors
  const incomeErrors = income.validationErrors
  if (Object.keys(profileErrors).length > 0 || Object.keys(incomeErrors).length > 0) {
    return null
  }
  // Read CPF housing from property store (single source of truth)
  const property = usePropertyStore.getState()
  const cpfHousing = deriveCpfHousingFromProperty(property)
  return {
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    salaryModel: income.salaryModel,
    annualSalary: income.annualSalary,
    salaryGrowthRate: income.salaryGrowthRate,
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
  }
}

interface IncomeProjectionResult {
  projection: IncomeProjectionRow[] | HouseholdIncomeProjectionRow[] | null
  summary: IncomeSummaryStats | null
  hasErrors: boolean
  errors: Record<string, string>
  isHousehold: boolean
  personProjections?: Array<{ personId: string; projection: IncomeProjectionRow[] }> // Per-person projections when in household mode
}

/**
 * Derived hook: reads profile + income stores OR household store (when in household mode),
 * checks validation, computes full year-by-year income projection and summary stats.
 * Returns null projection/summary when upstream validation fails.
 */
export function useIncomeProjection(): IncomeProjectionResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const property = usePropertyStore()
  const household = useHouseholdStore()
  const cpfHousing = deriveCpfHousingFromProperty(property)

  return useMemo(() => {
    // Check if we're in household mode
    if (household.householdMode && household.persons.length > 0) {
      // HOUSEHOLD MODE: Generate projection for each person, then aggregate
      const householdErrors = household.validationErrors
      if (Object.keys(householdErrors).length > 0) {
        return { projection: null, summary: null, hasErrors: true, errors: householdErrors, isHousehold: true }
      }

      // Generate projection for each person
      const personProjections: Array<{ personId: string; projection: IncomeProjectionRow[] }> = []

      for (const person of household.persons) {
        // Each person has their own CPF housing deduction
        const personCpfHousingMonthly = person.cpf.mortgageCpfMonthly
        const personProjection = generateIncomeProjection({
          currentAge: person.profile.currentAge,
          retirementAge: person.profile.retirementAge,
          lifeExpectancy: person.profile.lifeExpectancy,
          salaryModel: person.income.salaryModel,
          annualSalary: person.income.annualSalary,
          salaryGrowthRate: person.income.salaryGrowthRate,
          realisticPhases: person.income.realisticPhases,
          promotionJumps: person.income.promotionJumps,
          momEducation: person.income.momEducation,
          momAdjustment: person.income.momAdjustment,
          employerCpfEnabled: person.income.employerCpfEnabled,
          incomeStreams: person.income.incomeStreams,
          lifeEvents: person.income.lifeEvents,
          lifeEventsEnabled: person.income.lifeEventsEnabled,
          annualExpenses: profile.annualExpenses, // Shared at household level
          inflation: profile.inflation, // Shared assumption
          personalReliefs: person.income.personalReliefs,
          srsAnnualContribution: person.income.srsAnnualContribution,
          initialCpfOA: person.cpf.cpfOA,
          initialCpfSA: person.cpf.cpfSA,
          initialCpfMA: person.cpf.cpfMA,
          initialCpfRA: person.cpf.cpfRA,
          cpfLifeStartAge: person.cpf.cpfLifeStartAge,
          cpfLifePlan: person.cpf.cpfLifePlan,
          cpfRetirementSum: person.cpf.cpfRetirementSum,
          cpfHousingMode: personCpfHousingMonthly > 0 ? 'simple' : 'none',
          cpfHousingMonthly: personCpfHousingMonthly,
          cpfMortgageYearsLeft: property.existingMortgageRemainingYears,
          cpfLifeActualMonthlyPayout: person.cpf.cpfLifeActualMonthlyPayout,
          residencyStatus: person.profile.residencyStatus,
          srsBalance: person.income.srsBalance,
          srsInvestmentReturn: person.income.srsInvestmentReturn,
          srsDrawdownStartAge: person.income.srsDrawdownStartAge,
        })

        personProjections.push({
          personId: person.profile.id,
          projection: personProjection,
        })
      }

      // Aggregate into household projection
      const householdProjection = generateHouseholdIncomeProjection({
        persons: personProjections,
        annualExpenses: profile.annualExpenses,
        inflation: profile.inflation,
      })

      // Calculate summary based on household totals
      const summary: IncomeSummaryStats = {
        peakEarningAge: 0,
        peakEarningAmount: 0,
        lifetimeEarnings: 0,
        averageSavingsRate: 0,
        totalCpfContributions: 0,
        incomeReplacementRatio: 0,
      }

      // Compute summary stats from household projection
      if (householdProjection.length > 0) {
        let peak = 0
        let peakAge = 0
        let totalEarnings = 0
        let totalCpf = 0

        for (const row of householdProjection) {
          totalEarnings += row.totalGross
          totalCpf += row.totalCpfEmployee + row.totalCpfEmployer
          if (row.totalGross > peak) {
            peak = row.totalGross
            peakAge = row.age
          }
        }

        summary.peakEarningAge = peakAge
        summary.peakEarningAmount = peak
        summary.lifetimeEarnings = totalEarnings
        summary.totalCpfContributions = totalCpf
        summary.averageSavingsRate = totalEarnings > 0
          ? householdProjection[householdProjection.length - 1]?.totalCumulativeSavings / totalEarnings
          : 0
      }

      return {
        projection: householdProjection,
        summary,
        hasErrors: false,
        errors: {},
        isHousehold: true,
        personProjections // Include per-person projections for CPF section
      }
    }

    // SINGLE-PERSON MODE: Use existing logic
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
      return { projection: null, summary: null, hasErrors: true, errors: allErrors, isHousehold: false }
    }

    const projection = generateIncomeProjection({
      currentAge: profile.currentAge,
      retirementAge: profile.retirementAge,
      lifeExpectancy: profile.lifeExpectancy,
      salaryModel: income.salaryModel,
      annualSalary: income.annualSalary,
      salaryGrowthRate: income.salaryGrowthRate,
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
    })

    const summary = calculateIncomeSummary(projection, profile.annualExpenses)

    return { projection, summary, hasErrors: false, errors: {}, isHousehold: false }
  }, [
    household.householdMode,
    household.persons,
    household.validationErrors,
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
    profile.validationErrors,
    income.salaryModel,
    income.annualSalary,
    income.salaryGrowthRate,
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
