import { useState } from 'react'

const STORAGE_KEY = 'fireplanner-page-visits'

/**
 * Tracks per-page visit counts in localStorage.
 * Increments the count once per mount (in useState initializer to avoid flash).
 * Returns the current visit count for the given pageId.
 */
export function usePageVisitCount(pageId: string): number {
  const [count] = useState(() => {
    let visits: Record<string, number> = {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) visits = JSON.parse(raw) as Record<string, number>
    } catch { /* localStorage unavailable */ }

    const next = (visits[pageId] ?? 0) + 1
    visits[pageId] = next

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visits))
    } catch { /* localStorage unavailable */ }

    return next
  })

  return count
}
