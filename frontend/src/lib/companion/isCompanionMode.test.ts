import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// We need to re-import the module fresh for each test since it has internal _initialized state
let isCompanionMode: () => boolean
let getCompanionToken: () => string | null
let getCompanionBaseUrl: () => string
let COMPANION_SECTION_SCROLL_KEY: string

describe('isCompanionMode', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    // Re-import module fresh each time to reset _initialized flag
    vi.resetModules()
    const mod = await import('./isCompanionMode')
    isCompanionMode = mod.isCompanionMode
    getCompanionToken = mod.getCompanionToken
    getCompanionBaseUrl = mod.getCompanionBaseUrl
    COMPANION_SECTION_SCROLL_KEY = mod.COMPANION_SECTION_SCROLL_KEY
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('returns false in normal mode', () => {
    expect(isCompanionMode()).toBe(false)
  })

  it('returns true when sessionStorage flag is set', () => {
    sessionStorage.setItem('fireplanner-companion-mode', '1')
    expect(isCompanionMode()).toBe(true)
  })

  it('detects companion mode from URL query param', () => {
    // Simulate ?companion=1 in URL
    const original = window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost:5173/planner?companion=1'),
    })

    expect(isCompanionMode()).toBe(true)
    // Should also persist to sessionStorage
    expect(sessionStorage.getItem('fireplanner-companion-mode')).toBe('1')

    // Restore
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL(original),
    })
  })

  it('extracts token from URL query param', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost:5173/planner?companion=1&token=abc123'),
    })

    // Re-import to reset _initialized
    vi.resetModules()
    const mod = await import('./isCompanionMode')
    mod.isCompanionMode() // triggers initialize

    expect(mod.getCompanionToken()).toBe('abc123')
    expect(sessionStorage.getItem('fireplanner-companion-token')).toBe('abc123')

    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost:5173/'),
    })
  })

  it('getCompanionToken returns null when no token set', () => {
    expect(getCompanionToken()).toBeNull()
  })

  it('getCompanionToken returns token from sessionStorage', () => {
    sessionStorage.setItem('fireplanner-companion-token', 'test-token')
    expect(getCompanionToken()).toBe('test-token')
  })

  it('getCompanionBaseUrl returns window.location.origin', () => {
    expect(getCompanionBaseUrl()).toBe(window.location.origin)
  })

  it('lazy-init is idempotent — multiple calls return same result', () => {
    sessionStorage.setItem('fireplanner-companion-mode', '1')
    const first = isCompanionMode()
    const second = isCompanionMode()
    const third = isCompanionMode()
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(third).toBe(true)
  })

  it('exports COMPANION_SECTION_SCROLL_KEY constant', () => {
    expect(COMPANION_SECTION_SCROLL_KEY).toBe('fireplanner-companion-target-section')
  })
})
