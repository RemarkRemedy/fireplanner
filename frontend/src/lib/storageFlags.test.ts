import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFlag, setFlag, removeFlag, readSessionFlag, setSessionFlag, readStorageValue, setStorageValue } from './storageFlags'

describe('storageFlags', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('readFlag returns false for unset key', () => {
    expect(readFlag('missing')).toBe(false)
  })

  it('setFlag + readFlag round-trips', () => {
    setFlag('test-key')
    expect(readFlag('test-key')).toBe(true)
  })

  it('removeFlag clears a flag', () => {
    setFlag('test-key')
    removeFlag('test-key')
    expect(readFlag('test-key')).toBe(false)
  })

  it('readSessionFlag returns false for unset key', () => {
    expect(readSessionFlag('missing')).toBe(false)
  })

  it('setSessionFlag + readSessionFlag round-trips', () => {
    setSessionFlag('test-session')
    expect(readSessionFlag('test-session')).toBe(true)
  })

  it('readStorageValue returns null for unset key', () => {
    expect(readStorageValue('missing')).toBeNull()
  })

  it('setStorageValue + readStorageValue round-trips', () => {
    setStorageValue('key', '2026-03-06')
    expect(readStorageValue('key')).toBe('2026-03-06')
  })

  it('handles localStorage unavailable gracefully', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readFlag('key')).toBe(false)
    spy.mockRestore()
  })
})
