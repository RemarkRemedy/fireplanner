/** Safe localStorage/sessionStorage read/write helpers. */

export function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

export function setFlag(key: string): void {
  try { localStorage.setItem(key, '1') } catch { /* storage unavailable */ }
}

export function removeFlag(key: string): void {
  try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
}

export function readSessionFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1' } catch { return false }
}

export function setSessionFlag(key: string): void {
  try { sessionStorage.setItem(key, '1') } catch { /* storage unavailable */ }
}

export function readStorageValue(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function setStorageValue(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}
