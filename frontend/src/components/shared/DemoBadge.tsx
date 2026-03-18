/**
 * Persistent floating "DEMO" badge shown when demo data is loaded.
 * Small pill in bottom-left corner. Tapping expands to show escape options.
 * Uses localStorage so the flag is consistent across tabs (no split-brain).
 */

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

const DEMO_FLAG_KEY = 'fireplanner-demo-active'

/** Call this when demo data is loaded */
export function setDemoActive() {
  try { localStorage.setItem(DEMO_FLAG_KEY, '1') } catch { /* private browsing */ }
}

/** Call this when user exits demo (starts own plan, navigates away) */
export function clearDemoActive() {
  try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { /* private browsing */ }
}

/** Check if demo mode is active */
export function isDemoActive(): boolean {
  try { return localStorage.getItem(DEMO_FLAG_KEY) === '1' } catch { return false }
}

/** Remove all fireplanner localStorage keys except scenarios (also clears demo flag) */
export function clearFireplannerData() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('fireplanner-') && key !== 'fireplanner-scenarios') {
        keysToRemove.push(key)
      }
    }
    // Also include the demo flag (doesn't start with fireplanner-)
    keysToRemove.push(DEMO_FLAG_KEY)
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch { /* private browsing or storage-restricted environment */ }
}

/** Clear demo data from localStorage, preserving scenarios */
function clearDemoData() {
  clearDemoActive()
  clearFireplannerData()
}

export function DemoBadge() {
  const [active, setActive] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setActive(isDemoActive())
    // Sync across tabs when demo flag changes in another tab
    const handleStorage = (e: StorageEvent) => {
      if (e.key === DEMO_FLAG_KEY) setActive(e.newValue === '1')
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const handleStartPlan = useCallback(() => {
    clearDemoData()
    setActive(false)
    window.location.href = '/setup'
  }, [])

  if (!active) return null

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 left-4 z-50 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-amber-600 transition-colors animate-in fade-in slide-in-from-bottom-2"
      >
        DEMO
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-64 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-3 shadow-xl animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Viewing demo data
          </p>
          <button
            onClick={handleStartPlan}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start your own plan
          </button>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-sm p-0.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
