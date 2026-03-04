import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getScenarioSnapshot, listScenarios, loadScenario } from '@/lib/scenarios'
import { buildProofCyclesFromScenarioSnapshot, summarizeProofCycles } from '@/lib/simulation/proofScenario'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { ProofCycle, ProofSource } from '@/lib/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

const STORAGE_KEY = 'fireplanner-proof-compare-v1'
const SCHEMA_VERSION = 1

export interface ProofCompareSnapshot {
  id: string
  scenarioId?: string
  name: string
  source: ProofSource
  successRate: number
  medianEndingPortfolio: number
  medianSpending: number
  medianTax: number
  blendRatio?: number
  createdAt: string
  _schemaVersion?: number
}

interface ProofComparePanelProps {
  currentSnapshot: Omit<ProofCompareSnapshot, 'id' | 'createdAt' | 'name'> | null
  source: ProofSource
  blendRatio: number
  onOpenMcSnapshot?: (cycles: ProofCycle[] | null) => void
}

function isProofCompareSnapshot(value: unknown): value is ProofCompareSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ProofCompareSnapshot>
  return (
    typeof item.id === 'string'
    && typeof item.name === 'string'
    && (item.source === 'mc' || item.source === 'historical_blended')
    && typeof item.successRate === 'number'
    && typeof item.medianEndingPortfolio === 'number'
    && typeof item.medianSpending === 'number'
    && typeof item.medianTax === 'number'
    && typeof item.createdAt === 'string'
  )
}

function readSnapshots(): ProofCompareSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isProofCompareSnapshot).filter(
      (item: ProofCompareSnapshot) => (item._schemaVersion ?? 1) === SCHEMA_VERSION,
    )
  } catch {
    return []
  }
}

function writeSnapshots(rows: ProofCompareSnapshot[]): void {
  try {
    const tagged = rows.map((r) => ({ ...r, _schemaVersion: SCHEMA_VERSION }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tagged))
  } catch {
    // ignore storage write failures
  }
}

function rehydrateAllStores() {
  const stores = [
    useProfileStore,
    useIncomeStore,
    useAllocationStore,
    useSimulationStore,
    useWithdrawalStore,
    usePropertyStore,
  ] as Array<{ persist: { rehydrate: () => void } }>

  for (const store of stores) {
    store.persist.rehydrate()
  }
}

export function ProofComparePanel({ currentSnapshot, source, blendRatio, onOpenMcSnapshot }: ProofComparePanelProps) {
  const [rows, setRows] = useState<ProofCompareSnapshot[]>(() => readSnapshots())
  const [rowCycles, setRowCycles] = useState<Record<string, ProofCycle[]>>({})
  const [selectedScenarioId, setSelectedScenarioId] = useState('current')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedScenarios, setSavedScenarios] = useState(() => listScenarios())
  const setSimulationField = useSimulationStore((s) => s.setField)

  const scenarioOptions = useMemo(
    () => [{ id: 'current', name: 'Current Simulation' }, ...savedScenarios.map((s) => ({ id: s.id, name: s.name }))],
    [savedScenarios],
  )

  const selectedOption = scenarioOptions.find((option) => option.id === selectedScenarioId)

  const addComputedRow = async (scenarioId: string) => {
    if (scenarioId === 'current') {
      if (!currentSnapshot) return
      const next: ProofCompareSnapshot = {
        ...currentSnapshot,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: 'Current Simulation',
        blendRatio: source === 'historical_blended' ? blendRatio : undefined,
        createdAt: new Date().toISOString(),
      }
      setRows((prev) => {
        const updated = [...prev, next]
        writeSnapshots(updated)
        return updated
      })
      return
    }

    const scenario = getScenarioSnapshot(scenarioId)
    if (!scenario) {
      setError('Selected scenario was not found.')
      return
    }

    const cycles = await buildProofCyclesFromScenarioSnapshot(scenario.stores, source, blendRatio)
    const computed = summarizeProofCycles(cycles, source)
    if (!computed) {
      setError(`No Proof cycles generated for "${scenario.metadata.name}".`)
      return
    }

    const next: ProofCompareSnapshot = {
      ...computed,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      scenarioId: scenario.metadata.id,
      name: scenario.metadata.name,
      blendRatio: source === 'historical_blended' ? blendRatio : undefined,
      createdAt: new Date().toISOString(),
    }
    if (source === 'mc') {
      setRowCycles((prev) => ({ ...prev, [next.id]: cycles }))
    }
    setRows((prev) => {
      const updated = [...prev, next]
      writeSnapshots(updated)
      return updated
    })
  }

  const addSelected = async () => {
    setError(null)
    setIsLoading(true)
    try {
      await addComputedRow(selectedScenarioId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load selected scenario into Proof compare.')
    } finally {
      setIsLoading(false)
    }
  }

  const removeRow = (id: string) => {
    const updated = rows.filter((r) => r.id !== id)
    setRows(updated)
    setRowCycles((prev) => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
    writeSnapshots(updated)
  }

  const clear = () => {
    if (isLoading) return
    setRows([])
    setRowCycles({})
    writeSnapshots([])
  }

  const reload = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const all = listScenarios()
      const computedRows: ProofCompareSnapshot[] = []
      const computedCycles: Record<string, ProofCycle[]> = {}
      const failed: string[] = []

      for (const scenario of all) {
        try {
          const snapshot = getScenarioSnapshot(scenario.id)
          if (!snapshot) continue
          const cycles = await buildProofCyclesFromScenarioSnapshot(snapshot.stores, source, blendRatio)
          const computed = summarizeProofCycles(cycles, source)
          if (!computed) continue

          const row: ProofCompareSnapshot = {
            ...computed,
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            scenarioId: scenario.id,
            name: scenario.name,
            blendRatio: source === 'historical_blended' ? blendRatio : undefined,
            createdAt: new Date().toISOString(),
          }
          computedRows.push(row)
          if (source === 'mc') {
            computedCycles[row.id] = cycles
          }
        } catch {
          failed.push(scenario.name)
        }
      }

      setRows(computedRows)
      setRowCycles(computedCycles)
      writeSnapshots(computedRows)
      setSavedScenarios(listScenarios())
      if (failed.length > 0) {
        setError(`Skipped ${failed.length} scenario(s) with invalid or incompatible data.`)
      }
    } catch {
      setError('Failed to load one or more saved simulations.')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshSavedList = () => {
    if (isLoading) return
    setRows(readSnapshots())
    setRowCycles({})
    setSavedScenarios(listScenarios())
  }

  const openInProof = async (row: ProofCompareSnapshot) => {
    if (!row.scenarioId) return

    setError(null)
    setIsLoading(true)
    try {
      if (row.source === 'mc') {
        let cycles = rowCycles[row.id]
        if (!cycles || cycles.length === 0) {
          const snapshot = getScenarioSnapshot(row.scenarioId)
          if (!snapshot) throw new Error('Failed to load scenario snapshot.')
          cycles = await buildProofCyclesFromScenarioSnapshot(
            snapshot.stores,
            'mc',
            typeof row.blendRatio === 'number' ? row.blendRatio : blendRatio,
          )
          if (cycles.length === 0) {
            throw new Error('No MC cycles available for this scenario.')
          }
          setRowCycles((prev) => ({ ...prev, [row.id]: cycles }))
        }

        onOpenMcSnapshot?.(cycles)
      } else {
        onOpenMcSnapshot?.(null)
      }

      const loaded = loadScenario(row.scenarioId, rehydrateAllStores)
      if (!loaded) throw new Error('Failed to open scenario in Proof.')

      setSimulationField('proofSource', row.source)
      if (row.source === 'historical_blended' && typeof row.blendRatio === 'number') {
        setSimulationField('proofBlendRatio', row.blendRatio)
      }
      setSimulationField('proofSelectedCycle', 0)
      setSimulationField('proofSelectedYear', 0)
    } catch (e) {
      onOpenMcSnapshot?.(null)
      setError(e instanceof Error ? e.message : 'Failed to open scenario in Proof.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Compare Saved Simulations</CardTitle>
          <div className="text-sm text-muted-foreground">Loaded: {rows.length}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Load one or many simulations and compare them row-by-row.</p>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_auto_auto_auto] gap-2">
          <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Saved Simulation" />
            </SelectTrigger>
            <SelectContent>
              {scenarioOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addSelected} disabled={isLoading || (selectedScenarioId === 'current' && !currentSnapshot)}>
            {isLoading ? 'Loading...' : `Add to Compare${selectedOption ? `: ${selectedOption.name}` : ''}`}
          </Button>
          <Button variant="secondary" onClick={reload} disabled={isLoading}>Load All Saved Simulations</Button>
          <Button variant="outline" onClick={clear} disabled={isLoading}>Clear</Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row) => {
              return (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.source === 'mc' ? 'Monte Carlo' : 'Historical Blended'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.scenarioId && (
                        <Button size="sm" variant="outline" onClick={() => openInProof(row)} disabled={isLoading}>
                          Open in Proof
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => removeRow(row.id)} disabled={isLoading}>Remove</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Success Rate</div>
                      <div className="font-medium">{formatPercent(row.successRate, 2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Median Ending</div>
                      <div className="font-medium">{formatCurrency(row.medianEndingPortfolio)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Median Spending</div>
                      <div className="font-medium">{formatCurrency(row.medianSpending)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Median Taxes</div>
                      <div className="font-medium">{formatCurrency(row.medianTax)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={refreshSavedList} disabled={isLoading}>
            Refresh saved list
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
