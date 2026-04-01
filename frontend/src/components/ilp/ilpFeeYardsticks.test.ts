import { describe, expect, it } from 'vitest'
import {
  buildIlpFeeYardstickMatches,
  getSgdIlpFeeYardstickBands,
  selectIlpFeeYardstickBand,
} from './ilpFeeYardsticks'

describe('ilpFeeYardsticks', () => {
  it('keeps 20 examples in every SGD band', () => {
    const bands = getSgdIlpFeeYardstickBands()

    expect(bands).toHaveLength(8)
    for (const band of bands) {
      expect(band.examples).toHaveLength(20)
    }
  })

  it('keeps eight everyday anchors at the start of every SGD band', () => {
    const bands = getSgdIlpFeeYardstickBands()

    const expectedAnchorIds = [
      'kopi',
      'starbucks-coffee',
      'hawker-lunch',
      'big-mac-meal',
      'bubble-tea',
      'mrt-ride',
      'grab-ride',
      'movie-ticket',
    ]

    for (const band of bands) {
      expect(band.examples.slice(0, 8).map((example) => example.id)).toEqual(expectedAnchorIds)
    }
  })

  it('does not expose niche or sensitive examples in the SGD carousel', () => {
    const bannedIds = [
      'wedding-table',
      'wedding-banquet',
      'wedding-honeymoon',
      'wedding-photo',
      'wedding-gown-photo',
      'helper-setup',
      'caregiving-setup',
      'fertility-reserve',
      'ivf-reserve',
      'mba-module-stack',
      'private-school-year',
    ]

    const allIds = getSgdIlpFeeYardstickBands().flatMap((band) => band.examples.map((example) => example.id))

    for (const id of bannedIds) {
      expect(allIds).not.toContain(id)
    }
  })

  it('selects the S$5k–10k band for the current AIA fee-story magnitude', () => {
    const band = selectIlpFeeYardstickBand(5_341.447264005144, 'SGD')

    expect(band.label).toBe('S$5k–10k')
  })

  it('builds rotating matches from the selected band using annualized real cost', () => {
    const result = buildIlpFeeYardstickMatches(5_341.447264005144, 15, 'SGD')

    expect(result).not.toBeNull()
    expect(result?.band.label).toBe('S$5k–10k')
    expect(result?.matches).toHaveLength(20)
    expect(result?.annualizedCost).toBeCloseTo(356.09648426700954, 6)
    expect(result?.matches[0]?.sentence).toMatch(/kopi|Starbucks coffee|hawker lunch|Big Mac meal|bubble tea|MRT ride|Grab ride|movie ticket/i)
  })
})
