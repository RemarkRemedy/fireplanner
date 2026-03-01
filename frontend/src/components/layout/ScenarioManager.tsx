import { useState } from 'react'
import { toast } from 'sonner'
import { Layers, Save, Trash2, Upload as LoadIcon, X } from 'lucide-react'
import { listScenarios, saveScenario, loadScenario, deleteScenario } from '@/lib/scenarios'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import type { ScenarioMetadata } from '@/lib/scenarios'
import { trackEvent } from '@/lib/analytics'

function rehydrateAllStores() {
  // Zustand persist stores expose .persist.rehydrate() on the store object
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

export function ScenarioManager() {
  const [open, setOpen] = useState(false)
  const [scenarios, setScenarios] = useState<ScenarioMetadata[]>([])
  const [saveName, setSaveName] = useState('')

  const refresh = () => setScenarios(listScenarios())

  const handleOpen = () => {
    refresh()
    setOpen(true)
    setSaveName('')
  }

  const handleSave = () => {
    const name = saveName.trim()
    if (!name) return
    try {
      saveScenario(name)
      toast.success(`Scenario "${name}" saved`)
      trackEvent('scenario_saved')
      setSaveName('')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save scenario')
    }
  }

  const handleLoad = (id: string, name: string) => {
    loadScenario(id, rehydrateAllStores)
    toast.success(`Loaded "${name}"`)
    trackEvent('scenario_loaded')
    setOpen(false)
  }

  const handleDelete = (id: string, name: string) => {
    deleteScenario(id)
    toast.success(`Deleted "${name}"`)
    trackEvent('scenario_deleted')
    refresh()
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Manage scenarios"
      >
        <Layers className="h-3.5 w-3.5" />
        Scenarios
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">SCENARIOS</span>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-accent"
          aria-label="Close scenarios"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Save new */}
      <div className="flex gap-1">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Scenario name..."
          className="flex-1 min-w-0 px-2 py-1 text-xs border rounded bg-background"
          maxLength={40}
        />
        <button
          onClick={handleSave}
          disabled={!saveName.trim()}
          className="p-1 rounded hover:bg-accent disabled:opacity-40"
          title="Save current state"
        >
          <Save className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Saved scenarios */}
      {scenarios.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved scenarios</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 group"
            >
              <button
                onClick={() => handleLoad(s.id, s.name)}
                className="flex-1 flex items-center gap-1.5 px-2 py-1 text-xs text-left rounded hover:bg-accent truncate"
                title={`Load "${s.name}"`}
              >
                <LoadIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.name}</span>
              </button>
              <button
                onClick={() => handleDelete(s.id, s.name)}
                className="p-1 rounded md:opacity-0 md:group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                title={`Delete "${s.name}"`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">Up to 5 scenarios</p>
    </div>
  )
}
