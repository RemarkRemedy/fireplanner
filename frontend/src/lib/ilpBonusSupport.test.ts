import { describe, expect, it } from 'vitest'
import { formatIlpBonusSupport } from './ilpBonusSupport'

describe('formatIlpBonusSupport', () => {
  it('formats sub-100% bonus support as a percentage of gross fees', () => {
    expect(formatIlpBonusSupport(625, 1_000)).toEqual({
      value: '62.5%',
      detail: 'of gross fees represented by modeled bonuses',
    })
  })

  it('formats bonus support above gross fees as a multiple', () => {
    expect(formatIlpBonusSupport(1_250, 500)).toEqual({
      value: '2.5x',
      detail: 'gross-fee equivalent in modeled bonuses',
    })
  })

  it('returns N/A when there are no gross fees to compare against', () => {
    expect(formatIlpBonusSupport(100, 0)).toEqual({
      value: 'N/A',
      detail: 'no modeled gross fees to compare against',
    })
  })
})
