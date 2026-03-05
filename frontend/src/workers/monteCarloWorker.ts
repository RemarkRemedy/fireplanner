import { runMonteCarlo } from '@/lib/simulation/monteCarlo'
import { optimizeSwr } from '@/lib/simulation/swrOptimizer'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'

type ProgressStage = 'running' | 'finalizing' | 'optimizing' | 'completed'

interface RunMessage {
  type: 'run'
  id: string
  params: MonteCarloEngineParams
}

function emitProgress(id: string, stage: ProgressStage, progress: number, message: string) {
  self.postMessage({ id, type: 'progress', stage, progress, message })
}

self.onmessage = (event: MessageEvent<RunMessage>) => {
  const { data } = event
  if (!data || data.type !== 'run') return

  const { id, params } = data
  const start = performance.now()

  try {
    emitProgress(id, 'running', 0.1, 'Running Monte Carlo paths')
    const mcResult = runMonteCarlo(params)

    emitProgress(id, 'finalizing', 0.82, 'Finalizing percentiles and distributions')

    let safe_swr = null
    try {
      emitProgress(id, 'optimizing', 0.92, 'Computing safe withdrawal bands')
      safe_swr = {
        confidence_95: optimizeSwr(0.95, params),
        confidence_90: optimizeSwr(0.90, params),
        confidence_85: optimizeSwr(0.85, params),
        confidence_50: optimizeSwr(0.50, params),
      }
    } catch {
      // SWR optimization is optional; simulation result remains valid.
    }

    const result = {
      ...mcResult,
      safe_swr,
      n_simulations: params.nSimulations,
      computation_time_ms: Math.round(performance.now() - start),
      cached: false,
    }

    emitProgress(id, 'completed', 1, 'Simulation complete')
    self.postMessage({ id, type: 'success', result })
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: (error as Error)?.message ?? 'Monte Carlo worker failed',
    })
  }
}
