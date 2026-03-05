/**
 * Web Worker for simulation engines.
 *
 * Runs Monte Carlo, backtest, and sequence risk computations off the main thread.
 * Each message must include { type, id, params } where type is one of
 * 'monteCarlo' | 'backtest' | 'sequenceRisk'.
 *
 * Responses: { id, type: 'success' | 'error', result? , error? }
 */

import { runMonteCarlo } from './monteCarlo'
import { optimizeSwr } from './swrOptimizer'
import { runBacktest, generateHeatmap, runDetailedWindow } from './backtest'
import { runSequenceRisk } from './sequenceRisk'

self.onmessage = (e: MessageEvent) => {
  const { type, id } = e.data
  const start = performance.now()

  try {
    let result: unknown

    if (type === 'monteCarlo') {
      const mcResult = runMonteCarlo(e.data.params)

      // SWR optimization (non-critical, skip on error)
      let safe_swr = null
      try {
        safe_swr = {
          confidence_95: optimizeSwr(0.95, e.data.params),
          confidence_90: optimizeSwr(0.90, e.data.params),
          confidence_85: optimizeSwr(0.85, e.data.params),
          confidence_50: optimizeSwr(0.50, e.data.params),
        }
      } catch {
        /* skip SWR optimization on error */
      }

      result = {
        ...mcResult,
        safe_swr,
        n_simulations: e.data.params.nSimulations,
        computation_time_ms: Math.round(performance.now() - start),
        cached: false,
      }
    } else if (type === 'backtest') {
      const btResult = runBacktest(e.data.params)
      const hc = e.data.heatmapConfig
      const heatmap = e.data.includeHeatmap
        ? generateHeatmap(
            e.data.params,
            hc ? [hc.swrMin, hc.swrMax] : undefined,
            hc?.swrStep,
            hc ? [hc.durationMin, hc.durationMax] : undefined,
            hc?.durationStep,
          )
        : null

      result = {
        ...btResult,
        heatmap,
        computation_time_ms: Math.round(performance.now() - start),
      }
    } else if (type === 'backtest-window-detail') {
      result = runDetailedWindow(e.data.params, e.data.startYear)
    } else if (type === 'sequenceRisk') {
      result = {
        ...runSequenceRisk(e.data.params),
        computation_time_ms: Math.round(performance.now() - start),
      }
    }

    self.postMessage({ id, type: 'success', result })
  } catch (error) {
    self.postMessage({ id, type: 'error', error: (error as Error).message })
  }
}
