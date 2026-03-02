import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProfileState, ParentSupport, RetirementWithdrawal, CpfOaWithdrawal, FinancialGoal, LockedAsset, ExpenseAdjustment, HealthcareConfig, OopCurveVariant, ValidationErrors } from '@/lib/types'
import { validateProfileField } from '@/lib/validation/schemas'
import { validateProfileConsistency } from '@/lib/validation/rules'
import { interpolateOopMultiplier } from '@/lib/data/healthcareOop'

interface ProfileActions {
  setField: <K extends keyof Omit<ProfileState, 'validationErrors'>>(
    field: K,
    value: ProfileState[K]
  ) => void
  addParentSupport: (entry: ParentSupport) => void
  removeParentSupport: (id: string) => void
  updateParentSupport: (id: string, updates: Partial<Omit<ParentSupport, 'id'>>) => void
  addRetirementWithdrawal: (entry: RetirementWithdrawal) => void
  removeRetirementWithdrawal: (id: string) => void
  updateRetirementWithdrawal: (id: string, updates: Partial<Omit<RetirementWithdrawal, 'id'>>) => void
  addCpfOaWithdrawal: (entry: CpfOaWithdrawal) => void
  removeCpfOaWithdrawal: (id: string) => void
  updateCpfOaWithdrawal: (id: string, updates: Partial<Omit<CpfOaWithdrawal, 'id'>>) => void
  addFinancialGoal: (goal: FinancialGoal) => void
  removeFinancialGoal: (id: string) => void
  updateFinancialGoal: (id: string, updates: Partial<Omit<FinancialGoal, 'id'>>) => void
  clearFinancialGoals: () => void
  addExpenseAdjustment: (adj: ExpenseAdjustment) => void
  removeExpenseAdjustment: (id: string) => void
  updateExpenseAdjustment: (id: string, updates: Partial<Omit<ExpenseAdjustment, 'id'>>) => void
  addLockedAsset: (asset: LockedAsset) => void
  removeLockedAsset: (id: string) => void
  updateLockedAsset: (id: string, updates: Partial<Omit<LockedAsset, 'id'>>) => void
  reset: () => void
}

const PROFILE_DATA_KEYS = [
  'currentAge', 'retirementAge', 'lifeExpectancy', 'lifeStage', 'maritalStatus',
  'residencyStatus', 'annualIncome', 'annualExpenses', 'liquidNetWorth',
  'cpfOA', 'cpfSA', 'cpfMA', 'cpfRA', 'srsBalance', 'srsAnnualContribution', 'srsInvestmentReturn', 'srsDrawdownStartAge', 'srsPostFireEnabled',
  'cpfTopUpOA', 'cpfTopUpSA', 'cpfTopUpMA',
  'fireType', 'swr', 'fireNumberBasis', 'retirementSpendingAdjustment',
  'expectedReturn', 'usePortfolioReturn', 'inflation', 'expenseRatio', 'rebalanceFrequency',
  'retirementPhase', 'cpfLifeActualMonthlyPayout',
  'cpfLifeStartAge', 'cpfLifePlan', 'cpfRetirementSum',
  // cpfHousingMode, cpfHousingMonthly, cpfMortgageYearsLeft — DEPRECATED: now derived from property store
  'cpfOaWithdrawals', 'cpfisEnabled', 'cpfisOaReturn', 'cpfisSaReturn',
  'cpfAutoFallback', 'cpfAutoFallbackIncludeSA',
  'cpfVirtualRebalancing', 'cpfVirtualRebalancingMode',
  'parentSupportEnabled', 'parentSupport',
  'healthcareConfig',
  'retirementWithdrawals',
  'expenseAdjustments',
  'financialGoals',
  'lockedAssets',
  'cashReserveEnabled', 'cashReserveMode', 'cashReserveFixedAmount',
  'cashReserveMonths', 'cashReserveReturn', 'retirementMitigation',
] as const

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

const DEFAULT_PROFILE: Omit<ProfileState, 'validationErrors'> = {
  currentAge: 30,
  retirementAge: 65,
  lifeExpectancy: 90,
  lifeStage: 'pre-fire',
  maritalStatus: 'single',
  residencyStatus: 'citizen',
  annualIncome: 72000,
  annualExpenses: 48000,
  liquidNetWorth: 0,
  cpfOA: 0,
  cpfSA: 0,
  cpfMA: 0,
  cpfRA: 0,
  cpfTopUpOA: 0,
  cpfTopUpSA: 0,
  cpfTopUpMA: 0,
  srsBalance: 0,
  srsAnnualContribution: 0,
  srsInvestmentReturn: 0.04,
  srsDrawdownStartAge: 63,
  srsPostFireEnabled: false,
  fireType: 'regular',
  swr: 0.036,
  fireNumberBasis: 'fireAge',
  retirementSpendingAdjustment: 1.0,
  expectedReturn: 0.07,
  usePortfolioReturn: true,
  inflation: 0.025,
  expenseRatio: 0.003,
  rebalanceFrequency: 'annual',
  retirementPhase: null,
  cpfLifeActualMonthlyPayout: 0,
  cpfLifeStartAge: 65,
  cpfLifePlan: 'standard',
  cpfRetirementSum: 'frs',
  // DEPRECATED: CPF housing now sourced from property store. Kept for backward compat on load.
  cpfHousingMode: 'none',
  cpfHousingMonthly: 0,
  cpfMortgageYearsLeft: 25,
  cpfOaWithdrawals: [],
  cpfisEnabled: false,
  cpfisOaReturn: 0.04,
  cpfisSaReturn: 0.05,
  cpfAutoFallback: true,
  cpfAutoFallbackIncludeSA: true,
  cpfVirtualRebalancing: true,
  cpfVirtualRebalancingMode: 'from55' as const,
  parentSupportEnabled: false,
  parentSupport: [],
  healthcareConfig: DEFAULT_HEALTHCARE_CONFIG,
  retirementWithdrawals: [],
  expenseAdjustments: [],
  financialGoals: [],
  lockedAssets: [],
  cashReserveEnabled: false,
  cashReserveMode: 'months' as const,
  cashReserveFixedAmount: 30000,
  cashReserveMonths: 6,
  cashReserveReturn: 0.02,
  retirementMitigation: { type: 'none' as const },
}

// ============================================================
// Per-section default field subsets (used by section reset in InputsPage)
// ============================================================

/** Pick a subset of DEFAULT_PROFILE by keys */
function pickDefaults<K extends keyof typeof DEFAULT_PROFILE>(keys: K[]): Pick<typeof DEFAULT_PROFILE, K> {
  const result = {} as Pick<typeof DEFAULT_PROFILE, K>
  for (const k of keys) result[k] = DEFAULT_PROFILE[k]
  return result
}

export const DEFAULT_PERSONAL_FIELDS = pickDefaults([
  'currentAge', 'retirementAge', 'lifeExpectancy', 'lifeStage', 'maritalStatus', 'residencyStatus',
])

export const DEFAULT_FIRE_SETTINGS_FIELDS = pickDefaults([
  'fireType', 'swr', 'fireNumberBasis',
  'usePortfolioReturn', 'expectedReturn', 'inflation', 'expenseRatio', 'rebalanceFrequency',
])

export const DEFAULT_EXPENSE_FIELDS = pickDefaults([
  'annualExpenses', 'expenseAdjustments', 'retirementSpendingAdjustment',
  'parentSupportEnabled', 'parentSupport', 'retirementWithdrawals',
])

export const DEFAULT_NET_WORTH_FIELDS = pickDefaults([
  'liquidNetWorth', 'cpfOA', 'cpfSA', 'cpfMA',
  'srsBalance', 'srsAnnualContribution', 'srsInvestmentReturn', 'srsDrawdownStartAge',
  'lockedAssets',
  'cashReserveEnabled', 'cashReserveMode', 'cashReserveFixedAmount',
  'cashReserveMonths', 'cashReserveReturn', 'retirementMitigation',
])

export const DEFAULT_CPF_FIELDS = pickDefaults([
  'cpfLifeStartAge', 'cpfLifePlan', 'cpfRetirementSum',
  'cpfLifeActualMonthlyPayout', 'cpfRA',
  'cpfTopUpSA', 'cpfTopUpMA', 'cpfTopUpOA',
  'cpfisEnabled', 'cpfisOaReturn', 'cpfisSaReturn', 'cpfOaWithdrawals',
])

export const DEFAULT_HEALTHCARE_FIELDS = pickDefaults(['healthcareConfig'])

function extractProfileData(state: ProfileState & ProfileActions): Omit<ProfileState, 'validationErrors'> {
  const data: Record<string, unknown> = {}
  for (const key of PROFILE_DATA_KEYS) {
    data[key] = state[key]
  }
  return data as Omit<ProfileState, 'validationErrors'>
}

function computeValidationErrors(
  state: Omit<ProfileState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  for (const [field, value] of Object.entries(state)) {
    const err = validateProfileField(field, value)
    if (err) errors[field] = err
  }

  const crossErrors = validateProfileConsistency(state)
  Object.assign(errors, crossErrors)

  return errors
}

export const useProfileStore = create<ProfileState & ProfileActions>()(
  persist(
    (set) => ({
      ...DEFAULT_PROFILE,
      validationErrors: computeValidationErrors(DEFAULT_PROFILE),

      setField: (field, value) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, [field]: value }

          // Sync oopReferenceAge when currentAge changes (if user hasn't customized it away from old currentAge)
          if (field === 'currentAge' && typeof value === 'number') {
            const hc = updated.healthcareConfig
            if (hc.oopReferenceAge === stateData.currentAge) {
              updated.healthcareConfig = { ...hc, oopReferenceAge: value }
            }
          }

          return {
            ...updated,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addParentSupport: (entry: ParentSupport) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, parentSupport: [...stateData.parentSupport, entry] }
          return {
            parentSupport: updated.parentSupport,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeParentSupport: (id: string) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, parentSupport: stateData.parentSupport.filter((e) => e.id !== id) }
          return {
            parentSupport: updated.parentSupport,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateParentSupport: (id: string, updates: Partial<Omit<ParentSupport, 'id'>>) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = {
            ...stateData,
            parentSupport: stateData.parentSupport.map((e) =>
              e.id === id ? { ...e, ...updates } : e
            ),
          }
          return {
            parentSupport: updated.parentSupport,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addRetirementWithdrawal: (entry: RetirementWithdrawal) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, retirementWithdrawals: [...stateData.retirementWithdrawals, entry] }
          return {
            retirementWithdrawals: updated.retirementWithdrawals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeRetirementWithdrawal: (id: string) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, retirementWithdrawals: stateData.retirementWithdrawals.filter((e) => e.id !== id) }
          return {
            retirementWithdrawals: updated.retirementWithdrawals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateRetirementWithdrawal: (id: string, updates: Partial<Omit<RetirementWithdrawal, 'id'>>) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = {
            ...stateData,
            retirementWithdrawals: stateData.retirementWithdrawals.map((e) =>
              e.id === id ? { ...e, ...updates } : e
            ),
          }
          return {
            retirementWithdrawals: updated.retirementWithdrawals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addCpfOaWithdrawal: (entry: CpfOaWithdrawal) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, cpfOaWithdrawals: [...stateData.cpfOaWithdrawals, entry] }
          return {
            cpfOaWithdrawals: updated.cpfOaWithdrawals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeCpfOaWithdrawal: (id: string) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, cpfOaWithdrawals: stateData.cpfOaWithdrawals.filter((e) => e.id !== id) }
          return {
            cpfOaWithdrawals: updated.cpfOaWithdrawals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateCpfOaWithdrawal: (id: string, updates: Partial<Omit<CpfOaWithdrawal, 'id'>>) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = {
            ...stateData,
            cpfOaWithdrawals: stateData.cpfOaWithdrawals.map((e) =>
              e.id === id ? { ...e, ...updates } : e
            ),
          }
          return {
            cpfOaWithdrawals: updated.cpfOaWithdrawals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addFinancialGoal: (goal: FinancialGoal) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, financialGoals: [...stateData.financialGoals, goal] }
          return {
            financialGoals: updated.financialGoals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeFinancialGoal: (id: string) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, financialGoals: stateData.financialGoals.filter((g) => g.id !== id) }
          return {
            financialGoals: updated.financialGoals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateFinancialGoal: (id: string, updates: Partial<Omit<FinancialGoal, 'id'>>) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = {
            ...stateData,
            financialGoals: stateData.financialGoals.map((g) =>
              g.id === id ? { ...g, ...updates } : g
            ),
          }
          return {
            financialGoals: updated.financialGoals,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      clearFinancialGoals: () =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, financialGoals: [] }
          return {
            financialGoals: [],
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addExpenseAdjustment: (adj: ExpenseAdjustment) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, expenseAdjustments: [...stateData.expenseAdjustments, adj] }
          return {
            expenseAdjustments: updated.expenseAdjustments,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeExpenseAdjustment: (id: string) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, expenseAdjustments: stateData.expenseAdjustments.filter((a) => a.id !== id) }
          return {
            expenseAdjustments: updated.expenseAdjustments,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateExpenseAdjustment: (id: string, updates: Partial<Omit<ExpenseAdjustment, 'id'>>) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = {
            ...stateData,
            expenseAdjustments: stateData.expenseAdjustments.map((a) =>
              a.id === id ? { ...a, ...updates } : a
            ),
          }
          return {
            expenseAdjustments: updated.expenseAdjustments,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addLockedAsset: (asset: LockedAsset) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, lockedAssets: [...stateData.lockedAssets, asset] }
          return {
            lockedAssets: updated.lockedAssets,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeLockedAsset: (id: string) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = { ...stateData, lockedAssets: stateData.lockedAssets.filter((a) => a.id !== id) }
          return {
            lockedAssets: updated.lockedAssets,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateLockedAsset: (id: string, updates: Partial<Omit<LockedAsset, 'id'>>) =>
        set((state) => {
          const stateData = extractProfileData(state)
          const updated = {
            ...stateData,
            lockedAssets: stateData.lockedAssets.map((a) =>
              a.id === id ? { ...a, ...updates } : a
            ),
          }
          return {
            lockedAssets: updated.lockedAssets,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      reset: () =>
        set({
          ...DEFAULT_PROFILE,
          validationErrors: computeValidationErrors(DEFAULT_PROFILE),
        }),
    }),
    {
      name: 'fireplanner-profile',
      version: 21,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          state.cpfLifeStartAge = state.cpfLifeStartAge ?? 65
          state.cpfLifePlan = state.cpfLifePlan ?? 'standard'
          state.cpfRetirementSum = state.cpfRetirementSum ?? 'frs'
          state.cpfHousingMode = state.cpfHousingMode ?? 'none'
          state.cpfHousingMonthly = state.cpfHousingMonthly ?? 0
          // Migrate cpfHousingEndAge → cpfMortgageYearsLeft
          if (state.cpfHousingEndAge != null) {
            const age = (state.currentAge as number) ?? 30
            state.cpfMortgageYearsLeft = Math.max(0, (state.cpfHousingEndAge as number) - age)
            delete state.cpfHousingEndAge
          } else {
            state.cpfMortgageYearsLeft = state.cpfMortgageYearsLeft ?? 25
          }
        }
        if (version < 3) {
          state.retirementSpendingAdjustment = state.retirementSpendingAdjustment ?? 1.0
        }
        if (version < 4) {
          state.retirementPhase = state.retirementPhase ?? null
          state.cpfLifeActualMonthlyPayout = state.cpfLifeActualMonthlyPayout ?? 0
        }
        if (version < 5) {
          state.parentSupportEnabled = state.parentSupportEnabled ?? false
          state.parentSupport = state.parentSupport ?? []
        }
        if (version < 6) {
          state.healthcareConfig = state.healthcareConfig ?? DEFAULT_HEALTHCARE_CONFIG
        }
        if (version < 7) {
          const hc = state.healthcareConfig as Record<string, unknown> | undefined
          if (hc) {
            hc.oopInflationRate = hc.oopInflationRate ?? 0.03
            hc.oopReferenceAge = hc.oopReferenceAge ?? (state.currentAge as number ?? 30)
          }
        }
        if (version < 8) {
          state.retirementWithdrawals = state.retirementWithdrawals ?? []
        }
        if (version < 9) {
          state.cpfRA = state.cpfRA ?? 0
        }
        if (version < 10) {
          const rws = state.retirementWithdrawals as Array<Record<string, unknown>> | undefined
          state.retirementWithdrawals = (rws ?? []).map(rw => ({
            ...rw,
            durationYears: rw.durationYears ?? 1,
          }))
        }
        if (version < 11) {
          state.srsInvestmentReturn ??= 0.04
          state.srsDrawdownStartAge ??= 63
        }
        if (version < 12) {
          const hc = state.healthcareConfig as Record<string, unknown> | undefined
          if (hc) {
            hc.oopCurveVariant = hc.oopCurveVariant ?? 'study-backed'
          }
        }
        // v13: ISP downgrade fields are optional (undefined = no downgrade), no migration needed
        if (version < 14) {
          // v14: OOP base amount now means "spending at your age" (normalized by age multiplier)
          // Previously it meant "spending at age 30" regardless of oopReferenceAge.
          // Adjust stored amount so projections remain identical.
          const hc = state.healthcareConfig as Record<string, unknown> | undefined
          if (hc && hc.oopReferenceAge != null && (hc.oopReferenceAge as number) !== 30 && hc.oopModel === 'age-curve') {
            const refAge = hc.oopReferenceAge as number
            const refMultiplier = interpolateOopMultiplier(refAge, (hc.oopCurveVariant as OopCurveVariant) ?? 'study-backed')
            hc.oopBaseAmount = Math.round(((hc.oopBaseAmount as number) ?? 1200) * refMultiplier)
          }
        }
        if (version < 15) {
          state.financialGoals = state.financialGoals ?? []
        }
        if (version < 16) {
          state.cashReserveEnabled = state.cashReserveEnabled ?? false
          state.cashReserveMode = state.cashReserveMode ?? 'months'
          state.cashReserveFixedAmount = state.cashReserveFixedAmount ?? 30000
          state.cashReserveMonths = state.cashReserveMonths ?? 6
          state.cashReserveReturn = state.cashReserveReturn ?? 0.02
          state.retirementMitigation = state.retirementMitigation ?? { type: 'none' }
        }
        if (version < 17) {
          state.cpfOaWithdrawals = state.cpfOaWithdrawals ?? []
          state.cpfisEnabled = state.cpfisEnabled ?? false
          state.cpfisOaReturn = state.cpfisOaReturn ?? 0.04
          state.cpfisSaReturn = state.cpfisSaReturn ?? 0.05
        }
        if (version < 18) {
          state.cpfTopUpOA = state.cpfTopUpOA ?? 0
          state.cpfTopUpSA = state.cpfTopUpSA ?? 0
          state.cpfTopUpMA = state.cpfTopUpMA ?? 0
        }
        if (version < 19) {
          if (state.lockedAssets === undefined) state.lockedAssets = []
        }
        if (version < 20) {
          if (state.expenseAdjustments === undefined) state.expenseAdjustments = []
        }
        if (version < 21) {
          state.cpfAutoFallback = state.cpfAutoFallback ?? true
          state.cpfAutoFallbackIncludeSA = state.cpfAutoFallbackIncludeSA ?? true
          state.cpfVirtualRebalancing = state.cpfVirtualRebalancing ?? true
          state.cpfVirtualRebalancingMode = state.cpfVirtualRebalancingMode ?? 'from55'
        }
        return state
      },
      partialize: (state) => {
        const data: Record<string, unknown> = {}
        for (const key of PROFILE_DATA_KEYS) {
          data[key] = state[key]
        }
        return data
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const stateData = extractProfileData(state)
          state.validationErrors = computeValidationErrors(stateData)
        }
      },
    }
  )
)
