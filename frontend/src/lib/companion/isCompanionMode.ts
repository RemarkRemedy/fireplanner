const COMPANION_SESSION_KEY = 'fireplanner-companion-mode'
const COMPANION_TOKEN_SESSION_KEY = 'fireplanner-companion-token'
let companionTokenInMemory: string | null = null

function getCurrentUrl(): URL | null {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href)
}

function readHashToken(url: URL): string | null {
  const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  if (!rawHash) return null
  const params = new URLSearchParams(rawHash)
  const token = params.get('ct')?.trim()
  return token && token.length > 0 ? token : null
}

function persistToken(token: string): void {
  const normalized = token.trim()
  if (!normalized) return
  companionTokenInMemory = normalized
  try {
    window.sessionStorage.setItem(COMPANION_TOKEN_SESSION_KEY, normalized)
  } catch {
    // ignore unavailable session storage
  }
}

function readSessionToken(): string | null {
  try {
    const token = window.sessionStorage.getItem(COMPANION_TOKEN_SESSION_KEY)?.trim() ?? ''
    return token.length > 0 ? token : null
  } catch {
    return null
  }
}

export function isCompanionMode(): boolean {
  const url = getCurrentUrl()
  if (!url) return false

  const fromQuery = url.searchParams.get('companion') === '1'
  const tokenFromQuery = url.searchParams.get('token')?.trim() ?? ''
  const tokenFromHash = readHashToken(url)
  const tokenFromSession = readSessionToken()

  if (tokenFromQuery) {
    // Query token is source-of-truth when present.
    persistToken(tokenFromQuery)
  } else if (tokenFromHash) {
    // URL-provided hash token should override stale session state.
    persistToken(tokenFromHash)
  } else if (tokenFromSession) {
    persistToken(tokenFromSession)
  }

  // Preserve companion mode across in-app navigation for the current tab.
  if (fromQuery) {
    try { window.sessionStorage.setItem(COMPANION_SESSION_KEY, '1') } catch { /* unavailable */ }
    return true
  }

  try {
    return window.sessionStorage.getItem(COMPANION_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function getCompanionToken(): string | null {
  const url = getCurrentUrl()
  if (!url) return null

  const tokenFromQuery = url.searchParams.get('token')?.trim() ?? ''
  if (tokenFromQuery) {
    persistToken(tokenFromQuery)
    return tokenFromQuery
  }

  const tokenFromHash = readHashToken(url)
  if (tokenFromHash) {
    persistToken(tokenFromHash)
    return tokenFromHash
  }

  const tokenFromSession = readSessionToken()
  if (tokenFromSession) {
    persistToken(tokenFromSession)
    return tokenFromSession
  }

  const cached = companionTokenInMemory?.trim() ?? ''
  return cached.length > 0 ? cached : null
}
