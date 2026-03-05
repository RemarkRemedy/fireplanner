const COMPANION_SESSION_KEY = 'fireplanner-companion-mode'
const COMPANION_TOKEN_SESSION_KEY = 'fireplanner-companion-token'

export const COMPANION_SECTION_SCROLL_KEY = 'fireplanner-companion-target-section'

let _initialized = false

/**
 * Lazy-init: On first call, captures `?companion=1` and `?token=` from the URL
 * into sessionStorage, then scrubs them from the URL via replaceState.
 *
 * Because `isCompanionMode()` is called at `router.tsx` module-eval time
 * (before React mounts), the URL is cleaned before any deferred scripts
 * can leak the token via referrer headers or browser history.
 */
function initialize(): void {
  if (_initialized) return

  if (typeof window === 'undefined') return
  _initialized = true

  const url = new URL(window.location.href)
  let changed = false

  if (url.searchParams.get('companion') === '1') {
    try { sessionStorage.setItem(COMPANION_SESSION_KEY, '1') } catch { /* unavailable */ }
    changed = true
  }

  const tokenFromQuery = url.searchParams.get('token')?.trim() ?? ''
  if (tokenFromQuery) {
    try { sessionStorage.setItem(COMPANION_TOKEN_SESSION_KEY, tokenFromQuery) } catch { /* unavailable */ }
    changed = true
  }

  // Scrub companion params from URL immediately
  if (changed) {
    url.searchParams.delete('companion')
    url.searchParams.delete('token')
    window.history.replaceState(
      window.history.state ?? {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  }
}

/**
 * Detect companion mode. First call triggers lazy init (capture + scrub).
 */
export function isCompanionMode(): boolean {
  initialize()

  if (typeof window === 'undefined') return false

  try {
    return sessionStorage.getItem(COMPANION_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Retrieve the companion token from sessionStorage.
 * First call triggers lazy init if not already done.
 */
export function getCompanionToken(): string | null {
  initialize()

  if (typeof window === 'undefined') return null

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

