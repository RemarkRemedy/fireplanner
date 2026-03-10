import {
  useMonteCarloWorkerQuery,
  type UseMonteCarloWorkerQueryResult,
  type PerAdultMonteCarloInputs,
} from './useMonteCarloWorkerQuery'

export type {
  MonteCarloProgressState,
  MonteCarloRunOverrides,
  PerAdultMonteCarloInputs,
  UseMonteCarloWorkerQueryResult as UseMonteCarloQueryResult,
} from './useMonteCarloWorkerQuery'

export function useMonteCarloQuery(
  perAdultInputs?: PerAdultMonteCarloInputs | null,
): UseMonteCarloWorkerQueryResult {
  return useMonteCarloWorkerQuery(perAdultInputs)
}
