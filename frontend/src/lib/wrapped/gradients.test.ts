import { describe, it, expect } from 'vitest'
import { WRAPPED_GRADIENTS, buildCardSequence } from './gradients'
import type { WrappedCardKey } from './gradients'

const INDIVIDUAL_KEYS: WrappedCardKey[] = [
  'intro',
  'netWorth',
  'fireNumber',
  'progress',
  'milestone',
  'trajectory',
  'peak',
  'summary',
]

const COUPLE_KEYS: WrappedCardKey[] = [
  'intro',
  'netWorth',
  'fireNumber',
  'savingsPower',
  'progress',
  'milestone',
  'trajectory',
  'summary',
]

describe('WRAPPED_GRADIENTS', () => {
  it('has all 9 keys (8 individual + savingsPower)', () => {
    const keys = Object.keys(WRAPPED_GRADIENTS)
    expect(keys).toHaveLength(9)
    for (const k of COUPLE_KEYS) {
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
  it('defaults to individual mode with 8 cards', () => {
    expect(buildCardSequence()).toHaveLength(8)
  })

  it('individual mode returns 8 cards without savingsPower', () => {
    const sequence = buildCardSequence('individual')
    const keys = sequence.map((c) => c.key)
    expect(keys).toEqual(INDIVIDUAL_KEYS)
    expect(keys).not.toContain('savingsPower')
  })

  it('couple mode returns 8 cards with savingsPower, without peak', () => {
    const sequence = buildCardSequence('couple')
    const keys = sequence.map((c) => c.key)
    expect(keys).toEqual(COUPLE_KEYS)
    expect(keys).toHaveLength(8)
    expect(keys).not.toContain('peak')
  })

  it('each card config has a gradient that matches WRAPPED_GRADIENTS', () => {
    for (const mode of ['individual', 'couple'] as const) {
      const sequence = buildCardSequence(mode)
      for (const card of sequence) {
        expect(card.gradient).toBe(WRAPPED_GRADIENTS[card.key])
      }
    }
  })
})
