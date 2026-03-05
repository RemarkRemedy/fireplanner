/**
 * Worker client: typed interface for calling the simulation Web Worker.
 *
 * Lazily creates a single Worker instance and multiplexes calls via message IDs.
 */

import type { MonteCarloResult, BacktestResult, SequenceRiskResult, HeatmapConfig } from '@/lib/types'
import type {
  WithdrawalStrategyType,
  StrategyParamsMap,
  FloorCeilingParams,
} from '@/lib/types'
import type { MonteCarloEngineParams } from './monteCarlo'
import type { BacktestEngineParams, DetailedWindowResult } from './backtest'
import type { SequenceRiskEngineParams } from './sequenceRisk'

export type MonteCarloWorkerStage =
  | 'queued'
  | 'running'
  | 'finalizing'
  | 'optimizing'
  | 'completed'

export interface MonteCarloWorkerProgress {
  stage: MonteCarloWorkerStage
  progress: number
  message: string
}

export interface RunMonteCarloWorkerOptions {
  signal?: AbortSignal
  onProgress?: (progress: MonteCarloWorkerProgress) => void
}

// ============================================================
// Strategy Params Flattening
// ============================================================

/**
 * Flatten a StrategyParamsMap entry to the flat Record<string, number>
 * expected by the TS simulation engines.
 *
 * Special handling for floor_ceiling: the store uses `floor` and `ceiling`
 * but the engine expects `floorAmount` and `ceilingAmount`.
 */
export function flattenStrategyParams(
  strategy: WithdrawalStrategyType,
  paramsMap: StrategyParamsMap,
): Record<string, number> {
  const sp = paramsMap[strategy]
  if (strategy === 'floor_ceiling') {
    const fc = sp as FloorCeilingParams
    return { floorAmount: fc.floor, ceilingAmount: fc.ceiling, targetRate: fc.targetRate }
  }
  return sp as unknown as Record<string, number>
}

// ============================================================
// Worker Singleton
// ============================================================

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./simulation.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return worker
}

// ============================================================
// Generic call helper
// ============================================================

let nextId = 0

function callWorker<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = String(nextId++)
    const w = getWorker()

    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', handler)
      w.removeEventListener('error', errorHandler)
      if (e.data.type === 'error') {
        reject(new Error(e.data.error))
      } else {
        resolve(e.data.result as T)
      }
    }

    const errorHandler = (err: ErrorEvent) => {
      w.removeEventListener('message', handler)
      w.removeEventListener('error', errorHandler)
      reject(new Error(err.message || 'Worker error'))
    }

    w.addEventListener('message', handler)
    w.addEventListener('error', errorHandler)
    w.postMessage({ ...message, id })
  })
}

// ============================================================
// Typed public API
// ============================================================

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function createAbortError(): Error {
  const err = new Error('Simulation aborted')
  err.name = 'AbortError'
  return err
}

export function runMonteCarloWorker(
  params: MonteCarloEngineParams,
  options: RunMonteCarloWorkerOptions = {},
): Promise<MonteCarloResult> {
  const id = String(nextId++)
  const monteCarloWorker = new Worker(
    new URL('../../workers/monteCarloWorker.ts', import.meta.url),
    { type: 'module' },
  )
  const { signal, onProgress } = options

  const emitProgress = (update: MonteCarloWorkerProgress) => {
    onProgress?.({
      ...update,
      progress: clampProgress(update.progress),
    })
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      monteCarloWorker.terminate()
      reject(createAbortError())
      return
    }

    let settled = false

    const cleanup = () => {
      monteCarloWorker.removeEventListener('message', handleMessage)
      monteCarloWorker.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
      monteCarloWorker.terminate()
    }

    const finishSuccess = (result: MonteCarloResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const finishError = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return

      if (e.data.type === 'progress') {
        emitProgress({
          stage: e.data.stage as MonteCarloWorkerStage,
          progress: Number(e.data.progress),
          message: String(e.data.message ?? ''),
        })
        return
      }

      if (e.data.type === 'success') {
        emitProgress({
          stage: 'completed',
          progress: 1,
          message: 'Simulation complete',
        })
        finishSuccess(e.data.result as MonteCarloResult)
        return
      }

      if (e.data.type === 'error') {
        finishError(new Error(String(e.data.error ?? 'Worker error')))
      }
    }

    const handleError = (err: ErrorEvent) => {
      finishError(new Error(err.message || 'Worker error'))
    }

    const handleAbort = () => {
      finishError(createAbortError())
    }

    monteCarloWorker.addEventListener('message', handleMessage)
    monteCarloWorker.addEventListener('error', handleError)
    signal?.addEventListener('abort', handleAbort, { once: true })

    emitProgress({
      stage: 'queued',
      progress: 0.02,
      message: 'Queued simulation in worker',
    })
    monteCarloWorker.postMessage({ type: 'run', id, params })
  })
}

export function runBacktestWorker(
  params: BacktestEngineParams,
  includeHeatmap: boolean,
  heatmapConfig?: HeatmapConfig,
): Promise<BacktestResult> {
  return callWorker<BacktestResult>({ type: 'backtest', params, includeHeatmap, heatmapConfig })
}

export function runDetailedWindowWorker(
  params: BacktestEngineParams,
  startYear: number,
): Promise<DetailedWindowResult> {
  return callWorker<DetailedWindowResult>({ type: 'backtest-window-detail', params, startYear })
}

export function runSequenceRiskWorker(
  params: SequenceRiskEngineParams,
): Promise<SequenceRiskResult> {
  return callWorker<SequenceRiskResult>({ type: 'sequenceRisk', params })
}
