/**
 * Persistent floating "DEMO" badge shown when demo data is loaded.
 * Small pill in bottom-left corner. Tapping expands to show escape options.
 * Uses sessionStorage so it persists across page navigations but not across sessions.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

const DEMO_FLAG_KEY = 'fireplanner-demo-active'

/** Call this when demo data is loaded */
export function setDemoActive() {
  try { sessionStorage.setItem(DEMO_FLAG_KEY, '1') } catch { /* private browsing */ }
}

/** Call this when user exits demo (starts own plan, navigates away) */
export function clearDemoActive() {
  try { sessionStorage.removeItem(DEMO_FLAG_KEY) } catch { /* private browsing */ }
}

/** Check if demo mode is active */
export function isDemoActive(): boolean {
  try { return sessionStorage.getItem(DEMO_FLAG_KEY) === '1' } catch { return false }
}

/** Clear demo data from localStorage, preserving scenarios */
function clearDemoData() {
  clearDemoActive()
  const scenarios = localStorage.getItem('fireplanner-scenarios')
  localStorage.clear()
  if (scenarios) localStorage.setItem('fireplanner-scenarios', scenarios)
}

export function DemoBadge() {
  const [active, setActive] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setActive(isDemoActive())
  }, [])

  const handleStartPlan = useCallback(() => {
    clearDemoData()
    setActive(false)
    // Full reload to reset all Zustand stores
    window.location.href = '/setup'
  }, [])

  const handleBackToStart = useCallback(() => {
    clearDemoData()
    setActive(false)
    window.location.href = '/'
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
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleStartPlan}
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start your own plan
            </button>
            <button
              onClick={handleBackToStart}
              className="inline-flex items-center rounded-md border border-amber-300 dark:border-amber-600 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              Back to start
            </button>
          </div>
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
