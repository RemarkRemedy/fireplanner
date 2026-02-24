import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HouseholdState, Person, PersonProfile, PersonIncomeState, PersonCpfState, HealthcareConfig, ValidationErrors } from '@/lib/types'
import { DEFAULT_CAREER_PHASES } from '@/lib/calculations/income'

interface HouseholdActions {
  addPerson: (person: Person) => void
  removePerson: (personId: string) => void
  updatePersonProfile: (personId: string, updates: Partial<PersonProfile>) => void
  updatePersonIncome: (personId: string, updates: Partial<PersonIncomeState>) => void
  updatePersonCpf: (personId: string, updates: Partial<PersonCpfState>) => void
  updatePersonHealthcare: (personId: string, updates: Partial<HealthcareConfig>) => void
  setHouseholdMode: (enabled: boolean) => void
  reset: () => void
}

const DEFAULT_HOUSEHOLD: Omit<HouseholdState, 'validationErrors'> = {
  persons: [],
  householdMode: false,
}

function computeValidationErrors(
  state: Omit<HouseholdState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  // Validate each person
  for (const person of state.persons) {
    // Age validation
    if (person.profile.currentAge < 18 || person.profile.currentAge > 100) {
      errors[`person_${person.profile.id}_age`] = 'Age must be between 18 and 100'
    }
    if (person.profile.retirementAge <= person.profile.currentAge) {
      errors[`person_${person.profile.id}_retirementAge`] = 'Retirement age must be after current age'
    }
    if (person.profile.lifeExpectancy <= person.profile.retirementAge) {
      errors[`person_${person.profile.id}_lifeExpectancy`] = 'Life expectancy must be after retirement age'
    }

    // Income validation
    if (person.income.annualSalary < 0) {
      errors[`person_${person.profile.id}_salary`] = 'Salary cannot be negative'
    }
  }

  // Note: We don't validate persons.length < 2 here to allow users to add a second person
  // after enabling household mode. The UI will handle this gracefully.

  return errors
}

const DEFAULT_HEALTHCARE_CONFIG: HealthcareConfig = {
  enabled: false,
  mediShieldLifeEnabled: true,
  ispTier: 'none',
  careShieldLifeEnabled: true,
  oopBaseAmount: 1200,
  oopModel: 'age-curve',
  oopInflationRate: 0.03,
  oopReferenceAge: 30,
  oopCurveVariant: 'study-backed',
  mediSaveTopUpAnnual: 0,
}

export function createDefaultPerson(id: string, name: string): Person {
  return {
    profile: {
      id,
      name,
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      residencyStatus: 'citizen',
      retirementPhase: null,
    },
    income: {
      id,
      name,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0.03,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      lifeEventsEnabled: false,
      personalReliefs: 20000,
      reliefBreakdown: null,
      srsAnnualContribution: 0,
      srsBalance: 0,
      srsInvestmentReturn: 0.04,
      srsDrawdownStartAge: 63,
    },
    cpf: {
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      cpfRA: 0,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfLifeActualMonthlyPayout: 0,
      mortgageCpfMonthly: 0,
    },
    healthcare: DEFAULT_HEALTHCARE_CONFIG,
  }
}

export const useHouseholdStore = create<HouseholdState & HouseholdActions>()(
  persist(
    (set) => ({
      ...DEFAULT_HOUSEHOLD,
      validationErrors: computeValidationErrors(DEFAULT_HOUSEHOLD),

      addPerson: (person) =>
        set((state) => {
          const updated = { ...state, persons: [...state.persons, person] }
          return {
            persons: updated.persons,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removePerson: (personId) =>
        set((state) => {
          const updated = { ...state, persons: state.persons.filter((p) => p.profile.id !== personId) }
          return {
            persons: updated.persons,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updatePersonProfile: (personId, updates) =>
        set((state) => {
          const persons = state.persons.map((p) =>
            p.profile.id === personId
              ? { ...p, profile: { ...p.profile, ...updates } }
              : p
          )
          const updated = { ...state, persons }
          return {
            persons,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updatePersonIncome: (personId, updates) =>
        set((state) => {
          const persons = state.persons.map((p) =>
            p.profile.id === personId
              ? { ...p, income: { ...p.income, ...updates } }
              : p
          )
          const updated = { ...state, persons }
          return {
            persons,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updatePersonCpf: (personId, updates) =>
        set((state) => {
          const persons = state.persons.map((p) =>
            p.profile.id === personId
              ? { ...p, cpf: { ...p.cpf, ...updates } }
              : p
          )
          const updated = { ...state, persons }
          return {
            persons,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updatePersonHealthcare: (personId, updates) =>
        set((state) => {
          const persons = state.persons.map((p) =>
            p.profile.id === personId
              ? { ...p, healthcare: { ...p.healthcare, ...updates } }
              : p
          )
          const updated = { ...state, persons }
          return {
            persons,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setHouseholdMode: (enabled) =>
        set((state) => {
          const updated = { ...state, householdMode: enabled }
          return {
            householdMode: enabled,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      reset: () =>
        set({
          ...DEFAULT_HOUSEHOLD,
          validationErrors: computeValidationErrors(DEFAULT_HOUSEHOLD),
        }),
    }),
    {
      name: 'fireplanner-household',
      version: 1,
      partialize: (state) => ({
        persons: state.persons,
        householdMode: state.householdMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.validationErrors = computeValidationErrors(state)
        }
      },
    }
  )
)
