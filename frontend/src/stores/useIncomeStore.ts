import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  IncomeState,
  IncomeStream,
  LifeEvent,
  CareerPhase,
  PromotionJump,
  ValidationErrors,
} from '@/lib/types'
import { validateIncomeField } from '@/lib/validation/schemas'
import { computeTotalReliefs, type ReliefBreakdown } from '@/lib/data/taxBrackets'
import { useProfileStore } from '@/stores/useProfileStore'

interface IncomeActions {
  setField: <K extends keyof Omit<IncomeState, 'validationErrors' | 'incomeStreams' | 'lifeEvents' | 'realisticPhases' | 'promotionJumps'>>(
    field: K,
    value: IncomeState[K]
  ) => void
  addIncomeStream: (stream: IncomeStream) => void
  removeIncomeStream: (id: string) => void
  updateIncomeStream: (id: string, updates: Partial<IncomeStream>) => void
  addLifeEvent: (event: LifeEvent) => void
  removeLifeEvent: (id: string) => void
  updateLifeEvent: (id: string, updates: Partial<LifeEvent>) => void
  setRealisticPhases: (phases: CareerPhase[]) => void
  setPromotionJumps: (jumps: PromotionJump[]) => void
  setReliefBreakdown: (breakdown: ReliefBreakdown | null) => void
  reset: () => void
}

export const DEFAULT_CAREER_PHASES: CareerPhase[] = [
  { label: 'Early Career', minAge: 22, maxAge: 30, growthRate: 0.08 },
  { label: 'Mid Career', minAge: 30, maxAge: 40, growthRate: 0.05 },
  { label: 'Peak', minAge: 40, maxAge: 50, growthRate: 0.03 },
  { label: 'Plateau', minAge: 50, maxAge: 58, growthRate: 0.01 },
  { label: 'Pre-Retire', minAge: 58, maxAge: 65, growthRate: -0.02 },
]

const INCOME_DATA_KEYS = [
  'salaryModel', 'annualSalary', 'salaryGrowthRate', 'bonusMonths', 'employerCpfEnabled',
  'incomeStreams', 'lifeEvents', 'realisticPhases', 'promotionJumps',
  'momEducation', 'momAdjustment', 'lifeEventsEnabled', 'personalReliefs',
  'reliefBreakdown',
] as const

const DEFAULT_INCOME: Omit<IncomeState, 'validationErrors'> = {
  salaryModel: 'simple',
  annualSalary: 72000,
  salaryGrowthRate: 0.03,
  bonusMonths: 0,
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
}

function extractIncomeData(state: IncomeState & IncomeActions): Omit<IncomeState, 'validationErrors'> {
  const data: Record<string, unknown> = {}
  for (const key of INCOME_DATA_KEYS) {
    data[key] = state[key]
  }
  return data as Omit<IncomeState, 'validationErrors'>
}

function computeValidationErrors(
  state: Omit<IncomeState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  // Field-level validation via schemas
  const scalarFields = [
    'annualSalary', 'salaryGrowthRate', 'bonusMonths', 'momAdjustment', 'personalReliefs',
  ] as const
  for (const field of scalarFields) {
    const err = validateIncomeField(field, state[field])
    if (err) errors[field] = err
  }

  // Stream validation
  for (const stream of state.incomeStreams) {
    if (stream.startAge >= stream.endAge) {
      errors[`incomeStream_${stream.id}_startAge`] = 'Start age must be less than end age'
    }
    if (stream.annualAmount < 0) {
      errors[`incomeStream_${stream.id}_annualAmount`] = 'Amount must be non-negative'
    }
  }

  // Life event validation
  if (state.lifeEventsEnabled) {
    for (const event of state.lifeEvents) {
      if (event.startAge >= event.endAge) {
        errors[`lifeEvent_${event.id}_startAge`] = 'Start age must be less than end age'
      }
      if (event.incomeImpact < 0 || event.incomeImpact > 2) {
        errors[`lifeEvent_${event.id}_incomeImpact`] = 'Income impact must be between 0 and 2'
      }
    }
  }

  // Career phase validation (realistic model)
  if (state.salaryModel === 'realistic') {
    for (let i = 0; i < state.realisticPhases.length; i++) {
      const phase = state.realisticPhases[i]
      if (phase.minAge >= phase.maxAge) {
        errors[`phase_${i}_minAge`] = 'Min age must be less than max age'
      }
      if (phase.growthRate < -0.5 || phase.growthRate > 0.5) {
        errors[`phase_${i}_growthRate`] = 'Growth rate must be between -50% and 50%'
      }
    }
  }

  return errors
}

// Migration from v1 to v2
interface V1IncomeStream {
  id: string
  name: string
  annualAmount: number
  startAge: number
  endAge: number
  growthRate: number
  isTaxable: boolean
  isCpfApplicable: boolean
}

interface V1LifeEvent {
  id: string
  name: string
  age: number
  amount: number
  isRecurring: boolean
  endAge?: number
}

interface V1State {
  salaryModel: string
  annualSalary: number
  salaryGrowthRate: number
  employerCpfEnabled: boolean
  incomeStreams: V1IncomeStream[]
  lifeEvents: V1LifeEvent[]
}

function migrateV1ToV2(persisted: V1State): Omit<IncomeState, 'validationErrors'> {
  const migratedStreams: IncomeStream[] = (persisted.incomeStreams || []).map((s) => ({
    id: s.id,
    name: s.name,
    annualAmount: s.annualAmount,
    startAge: s.startAge,
    endAge: s.endAge,
    growthRate: s.growthRate,
    type: 'employment' as const,
    growthModel: 'fixed' as const,
    taxTreatment: s.isTaxable ? 'taxable' as const : 'tax-exempt' as const,
    isCpfApplicable: s.isCpfApplicable,
    isActive: true,
  }))

  const migratedEvents: LifeEvent[] = (persisted.lifeEvents || []).map((e) => ({
    id: e.id,
    name: e.name,
    startAge: e.age,
    endAge: e.endAge ?? e.age + 1,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  }))

  return {
    salaryModel: (persisted.salaryModel as IncomeState['salaryModel']) || DEFAULT_INCOME.salaryModel,
    annualSalary: persisted.annualSalary ?? DEFAULT_INCOME.annualSalary,
    salaryGrowthRate: persisted.salaryGrowthRate ?? DEFAULT_INCOME.salaryGrowthRate,
    bonusMonths: 0,
    employerCpfEnabled: persisted.employerCpfEnabled ?? DEFAULT_INCOME.employerCpfEnabled,
    incomeStreams: migratedStreams,
    lifeEvents: migratedEvents,
    realisticPhases: DEFAULT_INCOME.realisticPhases,
    promotionJumps: DEFAULT_INCOME.promotionJumps,
    momEducation: DEFAULT_INCOME.momEducation,
    momAdjustment: DEFAULT_INCOME.momAdjustment,
    lifeEventsEnabled: DEFAULT_INCOME.lifeEventsEnabled,
    personalReliefs: DEFAULT_INCOME.personalReliefs,
    reliefBreakdown: null,
  }
}

export const useIncomeStore = create<IncomeState & IncomeActions>()(
  persist(
    (set) => ({
      ...DEFAULT_INCOME,
      validationErrors: computeValidationErrors(DEFAULT_INCOME),

      setField: (field, value) =>
        set((state) => {
          const stateData = extractIncomeData(state)
          const updated = { ...stateData, [field]: value }
          return {
            [field]: value,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addIncomeStream: (stream) =>
        set((state) => {
          const updated = { ...extractIncomeData(state), incomeStreams: [...state.incomeStreams, stream] }
          return {
            incomeStreams: updated.incomeStreams,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeIncomeStream: (id) =>
        set((state) => {
          const updated = { ...extractIncomeData(state), incomeStreams: state.incomeStreams.filter((s) => s.id !== id) }
          return {
            incomeStreams: updated.incomeStreams,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateIncomeStream: (id, updates) =>
        set((state) => {
          const newStreams = state.incomeStreams.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          )
          const updated = { ...extractIncomeData(state), incomeStreams: newStreams }
          return {
            incomeStreams: newStreams,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      addLifeEvent: (event) =>
        set((state) => {
          const updated = { ...extractIncomeData(state), lifeEvents: [...state.lifeEvents, event] }
          return {
            lifeEvents: updated.lifeEvents,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      removeLifeEvent: (id) =>
        set((state) => {
          const updated = { ...extractIncomeData(state), lifeEvents: state.lifeEvents.filter((e) => e.id !== id) }
          return {
            lifeEvents: updated.lifeEvents,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      updateLifeEvent: (id, updates) =>
        set((state) => {
          const newEvents = state.lifeEvents.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          )
          const updated = { ...extractIncomeData(state), lifeEvents: newEvents }
          return {
            lifeEvents: newEvents,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setRealisticPhases: (phases) =>
        set((state) => {
          const updated = { ...extractIncomeData(state), realisticPhases: phases }
          return {
            realisticPhases: phases,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setPromotionJumps: (jumps) =>
        set((state) => {
          const updated = { ...extractIncomeData(state), promotionJumps: jumps }
          return {
            promotionJumps: jumps,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setReliefBreakdown: (breakdown) =>
        set((state) => {
          const stateData = extractIncomeData(state)
          if (breakdown === null) {
            // Switch to Simple mode: keep current personalReliefs, clear breakdown
            return {
              reliefBreakdown: null,
              validationErrors: computeValidationErrors({ ...stateData, reliefBreakdown: null }),
            }
          }
          // Detailed mode: auto-compute personalReliefs from breakdown
          const currentAge = useProfileStore.getState().currentAge ?? 30
          const total = computeTotalReliefs(breakdown, currentAge)
          const updated = { ...stateData, reliefBreakdown: breakdown, personalReliefs: total }
          return {
            reliefBreakdown: breakdown,
            personalReliefs: total,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      reset: () =>
        set({
          ...DEFAULT_INCOME,
          validationErrors: computeValidationErrors(DEFAULT_INCOME),
        }),
    }),
    {
      name: 'fireplanner-income',
      version: 4,
      partialize: (state) => {
        const data: Record<string, unknown> = {}
        for (const key of INCOME_DATA_KEYS) {
          data[key] = state[key]
        }
        return data
      },
      migrate: (persisted, version) => {
        if (version === 1) {
          return migrateV1ToV2(persisted as V1State)
        }
        const state = persisted as Record<string, unknown>
        if (version < 3) {
          state.reliefBreakdown = state.reliefBreakdown ?? null
        }
        if (version < 4) {
          state.bonusMonths = state.bonusMonths ?? 0
        }
        return state as Omit<IncomeState, 'validationErrors'>
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const stateData = extractIncomeData(state)
          state.validationErrors = computeValidationErrors(stateData)
        }
      },
    }
  )
)
