import {
  useMonteCarloWorkerQuery,
  type UseMonteCarloWorkerQueryResult,
} from './useMonteCarloWorkerQuery'

export type {
  MonteCarloProgressState,
  MonteCarloRunOverrides,
  UseMonteCarloWorkerQueryResult as UseMonteCarloQueryResult,
} from './useMonteCarloWorkerQuery'

export function useMonteCarloQuery(): UseMonteCarloWorkerQueryResult {
  return useMonteCarloWorkerQuery()
}
