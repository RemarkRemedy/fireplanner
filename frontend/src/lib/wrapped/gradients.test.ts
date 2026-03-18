import { describe, it, expect } from 'vitest'
import { WRAPPED_GRADIENTS, buildCardSequence } from './gradients'
import type { WrappedCardKey } from './gradients'

const EXPECTED_KEYS: WrappedCardKey[] = [
  'intro',
  'netWorth',
  'fireNumber',
  'progress',
  'milestone',
  'trajectory',
  'peak',
  'summary',
]

describe('WRAPPED_GRADIENTS', () => {
  it('has all 8 expected keys', () => {
    const keys = Object.keys(WRAPPED_GRADIENTS)
    expect(keys).toHaveLength(8)
    for (const k of EXPECTED_KEYS) {
      expect(keys).toContain(k)
    }
  })

  it('each gradient value is a valid CSS linear-gradient string', () => {
    for (const value of Object.values(WRAPPED_GRADIENTS)) {
      expect(value).toMatch(/^linear-gradient\(/)
      expect(value).toMatch(/,\s*#[0-9A-Fa-f]{6}/)
    }
  })
})

describe('buildCardSequence', () => {
  it('returns exactly 8 items', () => {
    expect(buildCardSequence()).toHaveLength(8)
  })

  it('returns keys in the correct order', () => {
    const sequence = buildCardSequence()
    const keys = sequence.map((c) => c.key)
    expect(keys).toEqual(EXPECTED_KEYS)
  })

  it('each card config has a key and gradient that matches WRAPPED_GRADIENTS', () => {
    const sequence = buildCardSequence()
    for (const card of sequence) {
      expect(card.gradient).toBe(WRAPPED_GRADIENTS[card.key])
    }
  })

  it('WrappedCardKey type covers all keys (runtime check)', () => {
    const allKeys = Object.keys(WRAPPED_GRADIENTS) as WrappedCardKey[]
    const sequenceKeys = buildCardSequence().map((c) => c.key)
    expect(new Set(sequenceKeys)).toEqual(new Set(allKeys))
  })
})
