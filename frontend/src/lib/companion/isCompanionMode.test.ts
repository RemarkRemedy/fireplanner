import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// We need to re-import the module fresh for each test since it reads from window
let isCompanionMode: () => boolean
let getCompanionToken: () => string | null
let getCompanionBaseUrl: () => string
let scrubCompanionParams: () => void

describe('isCompanionMode', () => {
  const originalLocation = window.location

  beforeEach(async () => {
    sessionStorage.clear()
    // Re-import module fresh each time
    vi.resetModules()
    const mod = await import('./isCompanionMode')
    isCompanionMode = mod.isCompanionMode
    getCompanionToken = mod.getCompanionToken
    getCompanionBaseUrl = mod.getCompanionBaseUrl
    scrubCompanionParams = mod.scrubCompanionParams
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

  it('scrubCompanionParams is a function', () => {
    // Just verify it doesn't throw when called without companion params
    expect(() => scrubCompanionParams()).not.toThrow()
  })
})
