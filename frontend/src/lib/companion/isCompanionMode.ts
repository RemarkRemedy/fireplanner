const COMPANION_SESSION_KEY = 'fireplanner-companion-mode'
const COMPANION_TOKEN_SESSION_KEY = 'fireplanner-companion-token'

/**
 * Detect companion mode from URL query param or sessionStorage flag.
 * Companion mode is entered via `?companion=1` in the URL. Once detected,
 * the flag is persisted to sessionStorage for cross-navigation persistence.
 */
export function isCompanionMode(): boolean {
  if (typeof window === 'undefined') return false

  const url = new URL(window.location.href)
  if (url.searchParams.get('companion') === '1') {
    try { sessionStorage.setItem(COMPANION_SESSION_KEY, '1') } catch { /* unavailable */ }
    return true
  }

  try {
    return sessionStorage.getItem(COMPANION_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Retrieve the companion token from the URL query param or sessionStorage.
 * On first access, the token from `?token=` is persisted to sessionStorage
 * and scrubbed from the URL via replaceState.
 */
export function getCompanionToken(): string | null {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const tokenFromQuery = url.searchParams.get('token')?.trim() ?? ''

  if (tokenFromQuery) {
    try { sessionStorage.setItem(COMPANION_TOKEN_SESSION_KEY, tokenFromQuery) } catch { /* unavailable */ }
    return tokenFromQuery
  }

  try {
    const stored = sessionStorage.getItem(COMPANION_TOKEN_SESSION_KEY)?.trim() ?? ''
    return stored.length > 0 ? stored : null
  } catch {
    return null
  }
}

/**
 * Derive the companion base URL from the current origin.
 * Since fireplanner is served as a static bundle under the companion server's
 * /planner/* namespace, the API base is the same origin.
 */
export function getCompanionBaseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

/**
 * Scrub companion-related query params from the URL.
 * Call once after bootstrap to prevent token leakage via browser history,
 * referrer headers, or URL sharing.
 */
export function scrubCompanionParams(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  let changed = false

  if (url.searchParams.has('token')) {
    url.searchParams.delete('token')
    changed = true
  }
  if (url.searchParams.has('companion')) {
    url.searchParams.delete('companion')
    changed = true
  }

  if (changed) {
    window.history.replaceState(
      window.history.state ?? {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  }
}
