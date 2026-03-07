import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  WithdrawalStrategyType,
  StrategyParamsMap,
  WithdrawalState,
  ValidationErrors,
} from '@/lib/types'

interface WithdrawalActions {
  setField: <K extends keyof Omit<WithdrawalState, 'validationErrors'>>(
    field: K,
    value: WithdrawalState[K]
  ) => void
  setStrategyParam: <S extends WithdrawalStrategyType>(
    strategy: S,
    field: keyof StrategyParamsMap[S],
    value: number
  ) => void
  toggleStrategy: (strategy: WithdrawalStrategyType) => void
  reset: () => void
}

interface WithdrawalRevisionState {
  withdrawalRevision: number
}

type WithdrawalStoreState = WithdrawalState & WithdrawalRevisionState & WithdrawalActions

const ALL_STRATEGIES: WithdrawalStrategyType[] = [
  'constant_dollar', 'vpw', 'guardrails', 'vanguard_dynamic', 'cape_based', 'floor_ceiling',
]

const WITHDRAWAL_DATA_KEYS = [
  'selectedStrategies', 'strategyParams',
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

const DEFAULT_WITHDRAWAL: Omit<WithdrawalState, 'validationErrors'> = {
  selectedStrategies: [...ALL_STRATEGIES],
  strategyParams: DEFAULT_STRATEGY_PARAMS,
}

function extractWithdrawalData(
  state: WithdrawalStoreState
): Omit<WithdrawalState, 'validationErrors'> {
  const data: Record<string, unknown> = {}
  for (const key of WITHDRAWAL_DATA_KEYS) {
    data[key] = state[key]
  }
  return data as Omit<WithdrawalState, 'validationErrors'>
}

function bumpWithdrawalRevision(revision: number): number {
  return revision + 1
}

function computeValidationErrors(
  state: Omit<WithdrawalState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (state.selectedStrategies.length === 0) {
    errors.selectedStrategies = 'Select at least one strategy'
  }

  // Validate floor < ceiling for floor_ceiling strategy
  const fc = state.strategyParams.floor_ceiling
  if (fc.floor >= fc.ceiling) {
    errors['floor_ceiling.floor'] = 'Floor must be less than ceiling'
  }

  return errors
}

export const useWithdrawalStore = create<WithdrawalStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_WITHDRAWAL,
      withdrawalRevision: 0,
      validationErrors: computeValidationErrors(DEFAULT_WITHDRAWAL),

      setField: (field, value) =>
        set((state) => {
          const stateData = extractWithdrawalData(state)
          const updated = { ...stateData, [field]: value }
          return {
            [field]: value,
            withdrawalRevision: bumpWithdrawalRevision(state.withdrawalRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setStrategyParam: (strategy, field, value) =>
        set((state) => {
          const stateData = extractWithdrawalData(state)
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
            withdrawalRevision: bumpWithdrawalRevision(state.withdrawalRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      toggleStrategy: (strategy) =>
        set((state) => {
          const stateData = extractWithdrawalData(state)
          const current = stateData.selectedStrategies
          const updated = current.includes(strategy)
            ? current.filter((s) => s !== strategy)
            : [...current, strategy]
          const newState = { ...stateData, selectedStrategies: updated }
          return {
            selectedStrategies: updated,
            withdrawalRevision: bumpWithdrawalRevision(state.withdrawalRevision),
            validationErrors: computeValidationErrors(newState),
          }
        }),

      reset: () =>
        set((state) => ({
          ...DEFAULT_WITHDRAWAL,
          withdrawalRevision: bumpWithdrawalRevision(state.withdrawalRevision),
          validationErrors: computeValidationErrors(DEFAULT_WITHDRAWAL),
        })),
    }),
    {
      name: 'fireplanner-withdrawal',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // v1 → v2: ensure all 12 strategy param keys exist
          const params = (state.strategyParams ?? {}) as Record<string, unknown>
          params.percent_of_portfolio ??= { rate: 0.04 }
          params.one_over_n ??= {}
          params.sensible_withdrawals ??= { baseRate: 0.03, extrasRate: 0.10 }
          params.ninety_five_percent ??= { swr: 0.04 }
          params.endowment ??= { swr: 0.04, smoothingWeight: 0.70 }
          params.hebeler_autopilot ??= { expectedRealReturn: 0.03 }
          state.strategyParams = params
        }
        return state as unknown as WithdrawalState
      },
      partialize: (state) => {
        const data: Record<string, unknown> = {}
        for (const key of WITHDRAWAL_DATA_KEYS) {
          data[key] = state[key]
        }
        return data as unknown as WithdrawalState
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const stateData = extractWithdrawalData(state)
          state.validationErrors = computeValidationErrors(stateData)
          state.withdrawalRevision = bumpWithdrawalRevision(state.withdrawalRevision)
        }
      },
    }
  )
)
