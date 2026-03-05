import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MonteCarloResult } from '@/lib/types'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import {
  createCompanionScenarios,
  resolveScenarioInputs,
  type CompanionScenario,
} from '@/lib/companion/scenarios'
import { buildPlannerResultsPayload } from '@/lib/companion/resultsPayload'
import { fetchPlannerSnapshot, postPlannerResults } from '@/lib/companion/companionClient'
import { applySnapshotToStores } from '@/lib/companion/companionBridge'
import type { PlannerResultsPayload } from '@/lib/companion/types'
import {
  getCompanionToken,
  getCompanionBaseUrl,
  isCompanionMode,
} from '@/lib/companion/isCompanionMode'

type CompanionBootstrapStatus = 'idle' | 'loading' | 'loaded' | 'error'
type CompanionSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface CompanionScenarioInputs {
  annualExpenses: number
  retirementAge: number
}

interface ScenarioResultRecord {
  payload: PlannerResultsPayload
  inputSignature: string
}

interface ScenarioRunContext {
  scenarioId: string
  annualExpenses: number
  retirementAge: number
  inputSignature: string
}

export interface CompanionScenarioComparison {
  id: string
  name: string
  p_success: number | null
  wr_safe_50: number | null
  projected_fire_age_p50: number | null
  portfolio_at_fire_p50: number | null
  wr_safe_95: number | null
  wr_safe_90: number | null // populated for payload completeness; UI displays 95/50/85 only
  wr_safe_85: number | null
  needsRerun: boolean
}

export interface CompanionPlannerBridgeState {
  isCompanionMode: boolean
  bootstrapStatus: CompanionBootstrapStatus
  bootstrapError: string | null
  saveStatus: CompanionSaveStatus
  saveError: string | null
  canSaveResults: boolean
  retrySave: () => void
  scenarios: CompanionScenario[]
  activeScenarioId: string | null
  activeScenario: CompanionScenario | null
  activeScenarioMonthlyExpenseDelta: number
  activeScenarioRetirementAge: number | null
  activeScenarioAnnualExpenses: number | null
  retirementAgeMin: number
  retirementAgeMax: number
  activeRunOverrides: { annualExpenses: number; retirementAge: number } | undefined
  scenarioComparisons: CompanionScenarioComparison[]
  activeScenarioNeedsRerun: boolean
  lastRunScenarioId: string | null
  deterministicFireAge: number | null
  selectScenario: (scenarioId: string) => void
  duplicateActiveScenario: () => void
  setActiveScenarioMonthlyExpenseDelta: (value: number) => void
  setActiveScenarioRetirementAge: (value: number) => void
  prepareSimulationRun: () => { annualExpenses: number; retirementAge: number } | undefined
}

interface CompanionPlannerBridgeInput {
  result: MonteCarloResult | undefined
  isResultStale: boolean
}

function buildInputSignature(inputs: CompanionScenarioInputs): string {
  return JSON.stringify({
    annualExpenses: Math.round(inputs.annualExpenses),
    retirementAge: Math.round(inputs.retirementAge),
  })
}

function toRunOverrides(inputs: CompanionScenarioInputs): { annualExpenses: number; retirementAge: number } {
  return {
    annualExpenses: inputs.annualExpenses,
    retirementAge: inputs.retirementAge,
  }
}

export function useCompanionPlannerBridge({
  result,
  isResultStale,
}: CompanionPlannerBridgeInput): CompanionPlannerBridgeState {
  const companionMode = useMemo(() => isCompanionMode(), [])
  const token = useMemo(() => companionMode ? getCompanionToken() : null, [companionMode])
  const baseUrl = useMemo(() => companionMode ? getCompanionBaseUrl() : '', [companionMode])

  const allocationWeights = useAllocationStore((s) => s.currentWeights)
  const selectedStrategy = useSimulationStore((s) => s.selectedStrategy)
  const strategyParams = useSimulationStore((s) => s.strategyParams)
  const mcMethod = useSimulationStore((s) => s.mcMethod)
  const currentAge = useProfileStore((s) => s.currentAge)
  const annualExpenses = useProfileStore((s) => s.annualExpenses)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const initialPortfolio = useProfileStore(
    (s) => s.liquidNetWorth + s.cpfOA + s.cpfSA + s.cpfMA + s.cpfRA,
  )

  const [bootstrapStatus, setBootstrapStatus] = useState<CompanionBootstrapStatus>(() =>
    companionMode && !!token ? 'loading' : 'idle',
  )
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<CompanionSaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [scenarios, setScenarios] = useState<CompanionScenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [scenarioResults, setScenarioResults] = useState<Record<string, ScenarioResultRecord>>({})
  const [lastRunScenarioId, setLastRunScenarioId] = useState<string | null>(null)
  const [deterministicFireAge, setDeterministicFireAge] = useState<number | null>(null)

  const minRetirementAge = useMemo(
    () => Math.max(35, Math.round(currentAge + 1)),
    [currentAge],
  )
  const maxRetirementAge = useMemo(
    () => Math.max(minRetirementAge, Math.round(lifeExpectancy - 1)),
    [lifeExpectancy, minRetirementAge],
  )

  const lastSavedSignatureRef = useRef<string | null>(null)
  const lastPayloadRef = useRef<PlannerResultsPayload | null>(null)
  const pendingRunContextRef = useRef<ScenarioRunContext | null>(null)
  const lastProcessedResultRef = useRef<MonteCarloResult | undefined>(undefined)
  const scenarioInitQueuedRef = useRef(false)

  const missingTokenError = companionMode && !token ? 'Missing companion token in URL.' : null

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null,
    [scenarios, activeScenarioId],
  )

  const activeScenarioInputs = useMemo<CompanionScenarioInputs | null>(() => {
    if (!activeScenario) return null

    return resolveScenarioInputs({
      baseAnnualExpenses: annualExpenses,
      baseRetirementAge: retirementAge,
      overrides: activeScenario.overrides,
      minRetirementAge,
      maxRetirementAge,
    })
  }, [activeScenario, annualExpenses, retirementAge, minRetirementAge, maxRetirementAge])

  const activeRunOverrides = useMemo(() => {
    if (!companionMode || !activeScenarioInputs) return undefined
    return toRunOverrides(activeScenarioInputs)
  }, [companionMode, activeScenarioInputs])

  const scenarioComparisons = useMemo<CompanionScenarioComparison[]>(() => {
    return scenarios.map((scenario) => {
      const currentInputs = resolveScenarioInputs({
        baseAnnualExpenses: annualExpenses,
        baseRetirementAge: retirementAge,
        overrides: scenario.overrides,
        minRetirementAge,
        maxRetirementAge,
      })
      const expectedSignature = buildInputSignature(currentInputs)
      const record = scenarioResults[scenario.id]
      const isFresh = record?.inputSignature === expectedSignature

      return {
        id: scenario.id,
        name: scenario.name,
        p_success: isFresh ? (record.payload.p_success ?? null) : null,
        wr_safe_50: isFresh ? (record.payload.wr_safe_50 ?? null) : null,
        projected_fire_age_p50: isFresh ? (record.payload.projected_fire_age_p50 ?? null) : null,
        portfolio_at_fire_p50: isFresh ? (record.payload.portfolio_at_fire_p50 ?? null) : null,
        wr_safe_95: isFresh ? (record.payload.wr_safe_95 ?? null) : null,
        wr_safe_90: isFresh ? (record.payload.wr_safe_90 ?? null) : null,
        wr_safe_85: isFresh ? (record.payload.wr_safe_85 ?? null) : null,
        needsRerun: !isFresh,
      }
    })
  }, [scenarios, scenarioResults, annualExpenses, retirementAge, minRetirementAge, maxRetirementAge])

  const activeScenarioNeedsRerun = useMemo(() => {
    if (!activeScenarioId) return false
    const row = scenarioComparisons.find((item) => item.id === activeScenarioId)
    return row?.needsRerun ?? true
  }, [activeScenarioId, scenarioComparisons])

  const activeScenarioSignature = useMemo(
    () => (activeScenarioInputs ? buildInputSignature(activeScenarioInputs) : null),
    [activeScenarioInputs],
  )
  const activeScenarioRecord = useMemo(
    () => (activeScenarioId ? scenarioResults[activeScenarioId] : undefined),
    [activeScenarioId, scenarioResults],
  )
  const activeScenarioPayload = useMemo(
    () => (activeScenarioSignature && activeScenarioRecord?.inputSignature === activeScenarioSignature
      ? activeScenarioRecord.payload
      : null
    ),
    [activeScenarioSignature, activeScenarioRecord],
  )
  const isScenarioContextStale = !!activeScenarioId
    && !!lastRunScenarioId
    && activeScenarioId !== lastRunScenarioId
  const isSaveBlocked = !companionMode
    || !token
    || isResultStale
    || activeScenarioNeedsRerun
    || isScenarioContextStale
    || !activeScenarioPayload

  // Bootstrap: fetch snapshot → apply to stores
  useEffect(() => {
    if (!companionMode || !token) return

    let cancelled = false

    fetchPlannerSnapshot(baseUrl, token)
      .then((snapshot) => {
        if (cancelled) return
        applySnapshotToStores(snapshot)
        if (typeof snapshot.deterministicFireAge === 'number' && Number.isFinite(snapshot.deterministicFireAge)) {
          setDeterministicFireAge(Math.round(snapshot.deterministicFireAge))
        }
        setBootstrapStatus('loaded')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('companion_snapshot_load_failed', err)
        setBootstrapStatus('error')
        setBootstrapError('Could not load snapshot from phone.')
      })

    return () => {
      cancelled = true
    }
  }, [companionMode, token, baseUrl])

  // Initialize scenarios after bootstrap
  useEffect(() => {
    if (!companionMode || scenarios.length > 0) return
    if (bootstrapStatus === 'loading') return
    if (scenarioInitQueuedRef.current) return
    scenarioInitQueuedRef.current = true

    const clampedBaseRetirementAge = Math.min(
      maxRetirementAge,
      Math.max(minRetirementAge, Math.round(retirementAge)),
    )
    const defaults = createCompanionScenarios(clampedBaseRetirementAge)

    setScenarios(defaults)
    setActiveScenarioId(defaults[0]?.id ?? null)
  }, [companionMode, scenarios.length, bootstrapStatus, retirementAge, minRetirementAge, maxRetirementAge])

  const selectScenario = useCallback((scenarioId: string) => {
    setActiveScenarioId(scenarioId)
    if (scenarioId !== lastRunScenarioId) {
      lastPayloadRef.current = null
      setSaveStatus('idle')
      setSaveError(null)
    }
  }, [lastRunScenarioId])

  const duplicateActiveScenario = useCallback(() => {
    if (!activeScenario) return

    const siblingCopies = scenarios.filter((item) =>
      item.name.toLowerCase().startsWith(`${activeScenario.name.toLowerCase()} copy`),
    ).length

    const duplicate: CompanionScenario = {
      ...activeScenario,
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${activeScenario.name} copy ${siblingCopies + 1}`,
    }

    setScenarios((prev) => [...prev, duplicate])
    setActiveScenarioId(duplicate.id)
    lastPayloadRef.current = null
    setSaveStatus('idle')
    setSaveError(null)
  }, [activeScenario, scenarios])

  const setActiveScenarioMonthlyExpenseDelta = useCallback((value: number) => {
    if (!activeScenarioId || !Number.isFinite(value)) return

    setScenarios((prev) =>
      prev.map((scenario) => (
        scenario.id !== activeScenarioId
          ? scenario
          : {
              ...scenario,
              overrides: {
                ...scenario.overrides,
                monthlyExpenseDelta: Math.round(value),
              },
            }
      )),
    )

    setScenarioResults((prev) => {
      const next = { ...prev }
      delete next[activeScenarioId]
      return next
    })
    lastPayloadRef.current = null
    setSaveStatus('idle')
    setSaveError(null)
  }, [activeScenarioId])

  const setActiveScenarioRetirementAge = useCallback((value: number) => {
    if (!activeScenarioId || !Number.isFinite(value)) return

    const boundedValue = Math.min(maxRetirementAge, Math.max(minRetirementAge, Math.round(value)))

    setScenarios((prev) =>
      prev.map((scenario) => (
        scenario.id !== activeScenarioId
          ? scenario
          : {
              ...scenario,
              overrides: {
                ...scenario.overrides,
                retirementAge: boundedValue,
              },
            }
      )),
    )

    setScenarioResults((prev) => {
      const next = { ...prev }
      delete next[activeScenarioId]
      return next
    })
    lastPayloadRef.current = null
    setSaveStatus('idle')
    setSaveError(null)
  }, [activeScenarioId, minRetirementAge, maxRetirementAge])

  const prepareSimulationRun = useCallback(() => {
    if (!activeScenario || !activeScenarioInputs) return undefined

    pendingRunContextRef.current = {
      scenarioId: activeScenario.id,
      annualExpenses: activeScenarioInputs.annualExpenses,
      retirementAge: activeScenarioInputs.retirementAge,
      inputSignature: buildInputSignature(activeScenarioInputs),
    }
    lastPayloadRef.current = null
    setSaveStatus('idle')
    setSaveError(null)

    return toRunOverrides(activeScenarioInputs)
  }, [activeScenario, activeScenarioInputs])

  const savePayload = useCallback(async (payload: PlannerResultsPayload | null, force: boolean) => {
    if (!companionMode || !token || !payload) return

    const signature = JSON.stringify(payload)
    if (!force && signature === lastSavedSignatureRef.current) return

    setSaveStatus('saving')
    setSaveError(null)

    try {
      await postPlannerResults(baseUrl, token, payload)
      lastSavedSignatureRef.current = signature
      setSaveStatus('saved')
    } catch (err) {
      console.error('companion_result_save_failed', err)
      setSaveStatus('error')
      setSaveError('Could not save to phone. Please try again.')
    }
  }, [companionMode, token, baseUrl])

  const buildPayloadForContext = useCallback((
    runContext: ScenarioRunContext,
    mcResult: MonteCarloResult,
  ): PlannerResultsPayload => {
    const payload = buildPlannerResultsPayload({
      result: mcResult,
      initialPortfolio,
      currentAge,
      annualExpenses: runContext.annualExpenses,
      lifeExpectancy,
      retirementAge: runContext.retirementAge,
      allocationWeights,
      selectedStrategy,
      strategyParams,
      mcMethod,
      scenarioId: runContext.scenarioId,
      scenarioName: scenarios.find((s) => s.id === runContext.scenarioId)?.name,
    })
    return { ...payload, input_signature: runContext.inputSignature }
  }, [
    initialPortfolio,
    currentAge,
    lifeExpectancy,
    allocationWeights,
    selectedStrategy,
    strategyParams,
    mcMethod,
    scenarios,
  ])

  // Process MC results: store per-scenario, auto-POST to phone
  useEffect(() => {
    if (!companionMode || !result || isResultStale || scenarios.length === 0) return
    if (lastProcessedResultRef.current === result) return

    lastProcessedResultRef.current = result

    const fallbackScenario = activeScenario ?? scenarios[0] ?? null
    const fallbackInputs = fallbackScenario
      ? resolveScenarioInputs({
          baseAnnualExpenses: annualExpenses,
          baseRetirementAge: retirementAge,
          overrides: fallbackScenario.overrides,
          minRetirementAge,
          maxRetirementAge,
        })
      : null

    const runContext = pendingRunContextRef.current ?? (
      fallbackScenario && fallbackInputs
        ? {
            scenarioId: fallbackScenario.id,
            annualExpenses: fallbackInputs.annualExpenses,
            retirementAge: fallbackInputs.retirementAge,
            inputSignature: buildInputSignature(fallbackInputs),
          }
        : null
    )

    pendingRunContextRef.current = null
    if (!runContext) return

    const payload = buildPayloadForContext(runContext, result)
    lastPayloadRef.current = payload
    setLastRunScenarioId(runContext.scenarioId)
    setScenarioResults((prev) => ({
      ...prev,
      [runContext.scenarioId]: {
        payload,
        inputSignature: runContext.inputSignature,
      },
    }))

    if (token) {
      void savePayload(payload, false)
    }
  }, [
    companionMode,
    result,
    isResultStale,
    scenarios,
    activeScenario,
    annualExpenses,
    retirementAge,
    minRetirementAge,
    maxRetirementAge,
    token,
    buildPayloadForContext,
    savePayload,
  ])

  const retrySave = useCallback(() => {
    if (isSaveBlocked) return
    const payload = activeScenarioPayload ?? lastPayloadRef.current
    void savePayload(payload, true)
  }, [isSaveBlocked, activeScenarioPayload, savePayload])

  return {
    isCompanionMode: companionMode,
    bootstrapStatus: missingTokenError ? 'error' : bootstrapStatus,
    bootstrapError: missingTokenError ?? bootstrapError,
    saveStatus: isSaveBlocked ? 'idle' : saveStatus,
    saveError: isSaveBlocked ? null : saveError,
    canSaveResults: !isSaveBlocked && saveStatus !== 'saving',
    retrySave,
    scenarios,
    activeScenarioId,
    activeScenario,
    activeScenarioMonthlyExpenseDelta: activeScenario?.overrides.monthlyExpenseDelta ?? 0,
    activeScenarioRetirementAge: activeScenarioInputs?.retirementAge ?? null,
    activeScenarioAnnualExpenses: activeScenarioInputs?.annualExpenses ?? null,
    retirementAgeMin: minRetirementAge,
    retirementAgeMax: maxRetirementAge,
    activeRunOverrides,
    scenarioComparisons,
    activeScenarioNeedsRerun,
    lastRunScenarioId,
    deterministicFireAge,
    selectScenario,
    duplicateActiveScenario,
    setActiveScenarioMonthlyExpenseDelta,
    setActiveScenarioRetirementAge,
    prepareSimulationRun,
  }
}
