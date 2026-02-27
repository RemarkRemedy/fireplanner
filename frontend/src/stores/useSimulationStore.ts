import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AnalysisMode,
  WithdrawalStrategyType,
  StrategyParamsMap,
  SimulationState,
  ValidationErrors,
} from '@/lib/types'
import { validateSimulationField } from '@/lib/validation/schemas'

interface SimulationActions {
  setField: <K extends keyof Omit<SimulationState, 'validationErrors'>>(
    field: K,
    value: SimulationState[K]
  ) => void
  setStrategyParam: <S extends WithdrawalStrategyType>(
    strategy: S,
    field: keyof StrategyParamsMap[S],
    value: number
  ) => void
  reset: () => void
}

const SIMULATION_DATA_KEYS = [
  'mcMethod', 'selectedStrategy', 'strategyParams', 'nSimulations', 'analysisMode',
  'lastMCSuccessRate', 'lastBacktestSuccessRate', 'withdrawalBasis', 'deterministicAccumulation',
] as const

const DEFAULT_STRATEGY_PARAMS: StrategyParamsMap = {
  constant_dollar: { swr: 0.04 },
  vpw: { expectedRealReturn: 0.03, targetEndValue: 0.10 },
  guardrails: { initialRate: 0.05, ceilingTrigger: 1.20, floorTrigger: 0.80, adjustmentSize: 0.10 },
  vanguard_dynamic: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
  cape_based: { baseRate: 0.04, capeWeight: 0.50, currentCape: 30 },
  floor_ceiling: { floor: 60000, ceiling: 150000, targetRate: 0.045 },
  percent_of_portfolio: { rate: 0.04 },
  one_over_n: {},
  sensible_withdrawals: { baseRate: 0.03, extrasRate: 0.10 },
  ninety_five_percent: { swr: 0.04 },
  endowment: { swr: 0.04, smoothingWeight: 0.70 },
  hebeler_autopilot: { expectedRealReturn: 0.03 },
}

const DEFAULT_SIMULATION: Omit<SimulationState, 'validationErrors'> = {
  mcMethod: 'parametric',
  selectedStrategy: 'constant_dollar',
  strategyParams: DEFAULT_STRATEGY_PARAMS,
  nSimulations: 10000,
  analysisMode: 'myPlan',
  withdrawalBasis: 'expenses',
  deterministicAccumulation: false,
  lastMCSuccessRate: null,
  lastBacktestSuccessRate: null,
}

function extractSimulationData(
  state: SimulationState & SimulationActions
): Omit<SimulationState, 'validationErrors'> {
  const data: Record<string, unknown> = {}
  for (const key of SIMULATION_DATA_KEYS) {
    data[key] = state[key]
  }
  return data as Omit<SimulationState, 'validationErrors'>
}

function computeValidationErrors(
  state: Omit<SimulationState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  const nErr = validateSimulationField('nSimulations', state.nSimulations)
  if (nErr) errors.nSimulations = nErr

  return errors
}

export const useSimulationStore = create<SimulationState & SimulationActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SIMULATION,
      validationErrors: computeValidationErrors(DEFAULT_SIMULATION),

      setField: (field, value) =>
        set((state) => {
          const stateData = extractSimulationData(state)
          const updated = { ...stateData, [field]: value }
          return {
            [field]: value,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setStrategyParam: (strategy, field, value) =>
        set((state) => {
          const stateData = extractSimulationData(state)
          const updatedParams = {
            ...stateData.strategyParams,
            [strategy]: {
              ...stateData.strategyParams[strategy],
              [field]: value,
            },
          }
          const updated = { ...stateData, strategyParams: updatedParams }
          return {
            strategyParams: updatedParams,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      reset: () =>
        set({
          ...DEFAULT_SIMULATION,
          validationErrors: computeValidationErrors(DEFAULT_SIMULATION),
        }),
    }),
    {
      name: 'fireplanner-simulation',
      version: 6,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // v1 → v2: 3 modes → 2 modes
          const old = state.analysisMode as string
          const migrated: AnalysisMode =
            old === 'fireNumber' ? 'fireTarget' : 'myPlan'
          state.analysisMode = migrated
        }
        if (version < 3) {
          // v2 → v3: add last success rates
          state.lastMCSuccessRate = null
          state.lastBacktestSuccessRate = null
        }
        if (version < 4) {
          // v3 → v4: ensure all 12 strategy param keys exist
          const params = (state.strategyParams ?? {}) as Record<string, unknown>
          params.percent_of_portfolio ??= { rate: 0.04 }
          params.one_over_n ??= {}
          params.sensible_withdrawals ??= { baseRate: 0.03, extrasRate: 0.10 }
          params.ninety_five_percent ??= { swr: 0.04 }
          params.endowment ??= { swr: 0.04, smoothingWeight: 0.70 }
          params.hebeler_autopilot ??= { expectedRealReturn: 0.03 }
          state.strategyParams = params
        }
        if (version < 5) {
          // v4 → v5: add withdrawalBasis field, default to 'expenses' for existing users
          state.withdrawalBasis ??= 'expenses'
        }
        if (version < 6) {
          // v5 → v6: add deterministicAccumulation field
          state.deterministicAccumulation ??= false
        }
        return state as unknown as SimulationState
      },
      partialize: (state) => {
        const data: Record<string, unknown> = {}
        for (const key of SIMULATION_DATA_KEYS) {
          data[key] = state[key]
        }
        return data as unknown as SimulationState
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const stateData = extractSimulationData(state)
          state.validationErrors = computeValidationErrors(stateData)
        }
      },
    }
  )
)
