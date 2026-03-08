import { createJSONStorage } from 'zustand/middleware'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { fromExpenseImport } from '@/lib/household/fromExpenseImport'
import type { ImportedPlanReview, PlannerSnapshotResponse } from './types'

// No-op storage that silently drops all reads/writes.
// Used to prevent companion-mode store mutations from touching localStorage.
const noopPersistStorage = createJSONStorage(() => ({
  getItem: (): null => null,
  setItem: () => {},
  removeItem: () => {},
}))

/**
 * Swap every persisted Zustand store's storage to a no-op adapter.
 * Must be called BEFORE any store hydration in companion mode.
 * This prevents companion data from leaking into localStorage while
 * keeping normal setField() code paths unchanged.
 */
export function disableLocalStoragePersistence(): () => void {
  const stores = [
    useAllocationStore,
    useSimulationStore,
    useWithdrawalStore,
    useHouseholdPlanStore,
    useUIStore,
  ] as const

  const previousStorage = stores.map((store) => ({
    store,
    storage: store.persist.getOptions().storage,
  }))

  for (const store of stores) {
    // Storage swap requires a cast because each store's PersistStorage is
    // parameterized over a different state type. The no-op storage is
    // structurally compatible at runtime but the type union is inexpressible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.persist.setOptions({ storage: noopPersistStorage as any })
  }

  return () => {
    for (const { store, storage } of previousStorage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.persist.setOptions({ storage: storage as any })
    }
  }
}

/**
 * Map a phone FinancialSnapshot into fireplanner Zustand stores.
 * Nil/null fields keep fireplanner defaults (no overwrite).
 * Percentages are converted to decimals (e.g. 2.5 → 0.025).
 */
export function applySnapshotToStores(snapshot: PlannerSnapshotResponse): ImportedPlanReview {
  // Step 1: Prevent companion writes from touching localStorage
  const restoreLocalStoragePersistence = disableLocalStoragePersistence()

  try {
    // --- UI mode ---
    if (snapshot.structuralMode === 'advanced' || snapshot.structuralMode === 'simple') {
      useUIStore.getState().setField('mode', snapshot.structuralMode)
    }

    const imported = fromExpenseImport(snapshot)
    useHouseholdPlanStore.getState().setPlan(imported.plan, {
      source: 'json-import',
      initializedAt: imported.review.provenance.importedAt,
    })

    return imported.review
  } finally {
    restoreLocalStoragePersistence()
  }
}
