import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useUIStore } from '@/stores/useUIStore'
import type { Person } from '@/lib/types'

/**
 * Hook to get the currently selected person's data or fallback to single-person stores.
 * Reduces the repetitive `selectedPerson ? person.X : store.X` pattern across components.
 */
export function usePersonContext() {
  const household = useHouseholdStore()
  const profile = useProfileStore()
  const income = useIncomeStore()
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)

  const selectedPerson = household.householdMode
    ? household.persons.find((p) => p.profile.id === (selectedPersonId || household.persons[0]?.profile.id))
    : null

  const isHouseholdMode = household.householdMode && household.persons.length > 0

  return {
    // Modes
    isHouseholdMode,
    selectedPerson,

    // Profile fields
    currentAge: selectedPerson ? selectedPerson.profile.currentAge : profile.currentAge,
    retirementAge: selectedPerson ? selectedPerson.profile.retirementAge : profile.retirementAge,
    lifeExpectancy: selectedPerson ? selectedPerson.profile.lifeExpectancy : profile.lifeExpectancy,
    residencyStatus: selectedPerson ? selectedPerson.profile.residencyStatus : profile.residencyStatus,
    retirementPhase: selectedPerson ? selectedPerson.profile.retirementPhase : profile.retirementPhase,

    // Income fields
    annualSalary: selectedPerson ? selectedPerson.income.annualSalary : income.annualSalary,
    salaryModel: selectedPerson ? selectedPerson.income.salaryModel : income.salaryModel,
    salaryGrowthRate: selectedPerson ? selectedPerson.income.salaryGrowthRate : income.salaryGrowthRate,
    employerCpfEnabled: selectedPerson ? selectedPerson.income.employerCpfEnabled : income.employerCpfEnabled,
    incomeStreams: selectedPerson ? selectedPerson.income.incomeStreams : income.incomeStreams,
    lifeEvents: selectedPerson ? selectedPerson.income.lifeEvents : income.lifeEvents,
    realisticPhases: selectedPerson ? selectedPerson.income.realisticPhases : income.realisticPhases,
    promotionJumps: selectedPerson ? selectedPerson.income.promotionJumps : income.promotionJumps,
    momEducation: selectedPerson ? selectedPerson.income.momEducation : income.momEducation,
    momAdjustment: selectedPerson ? selectedPerson.income.momAdjustment : income.momAdjustment,
    lifeEventsEnabled: selectedPerson ? selectedPerson.income.lifeEventsEnabled : income.lifeEventsEnabled,
    personalReliefs: selectedPerson ? selectedPerson.income.personalReliefs : income.personalReliefs,
    reliefBreakdown: selectedPerson ? selectedPerson.income.reliefBreakdown : income.reliefBreakdown,
    srsAnnualContribution: selectedPerson ? selectedPerson.income.srsAnnualContribution : profile.srsAnnualContribution,
    srsBalance: selectedPerson ? selectedPerson.income.srsBalance : profile.srsBalance,
    srsInvestmentReturn: selectedPerson ? selectedPerson.income.srsInvestmentReturn : profile.srsInvestmentReturn,
    srsDrawdownStartAge: selectedPerson ? selectedPerson.income.srsDrawdownStartAge : profile.srsDrawdownStartAge,

    // CPF fields
    cpfOA: selectedPerson ? selectedPerson.cpf.cpfOA : profile.cpfOA,
    cpfSA: selectedPerson ? selectedPerson.cpf.cpfSA : profile.cpfSA,
    cpfMA: selectedPerson ? selectedPerson.cpf.cpfMA : profile.cpfMA,
    cpfRA: selectedPerson ? selectedPerson.cpf.cpfRA : profile.cpfRA,
    cpfLifeStartAge: selectedPerson ? selectedPerson.cpf.cpfLifeStartAge : profile.cpfLifeStartAge,
    cpfLifePlan: selectedPerson ? selectedPerson.cpf.cpfLifePlan : profile.cpfLifePlan,
    cpfRetirementSum: selectedPerson ? selectedPerson.cpf.cpfRetirementSum : profile.cpfRetirementSum,
    cpfLifeActualMonthlyPayout: selectedPerson ? selectedPerson.cpf.cpfLifeActualMonthlyPayout : profile.cpfLifeActualMonthlyPayout,

    // Healthcare fields
    healthcareConfig: selectedPerson ? selectedPerson.healthcare : profile.healthcareConfig,

    // Store references for updates
    stores: {
      household,
      profile,
      income,
    },
  }
}
