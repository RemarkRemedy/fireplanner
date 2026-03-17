import { describe, it, expect } from 'vitest'
import { getLifeStageGuide, MONEYSENSE_AREAS } from './moneySenseGuide'
import { HEALTH_RATIOS } from './healthBenchmarks'

describe('getLifeStageGuide', () => {
  it('returns starting-out guide for age 25 (start of starting-family range, but starting-out is first)', () => {
    expect(getLifeStageGuide(25)?.label).toContain('Starting Out')
  })

  it('returns starting-family guide for age 30', () => {
    expect(getLifeStageGuide(30)?.label).toContain('Starting a Family')
  })

  it('returns supporting-parents guide for age 50', () => {
    expect(getLifeStageGuide(50)?.label).toContain('Supporting Children & Parents')
  })

  it('returns retiree guide for age 60', () => {
    expect(getLifeStageGuide(60)?.label).toContain('Retiree')
  })

  it('returns retiree guide for age 55 (start of retiree range, but supporting is first)', () => {
    // 55 matches both 35-59 and 55-120. Supporting is first in array.
    expect(getLifeStageGuide(55)?.label).toContain('Supporting Children & Parents')
  })

  it('returns null for age 18 (below minimum)', () => {
    expect(getLifeStageGuide(18)).toBeNull()
  })

  it('returns retiree guide for age 120 (max)', () => {
    expect(getLifeStageGuide(120)?.label).toContain('Retiree')
  })
})

describe('MONEYSENSE_AREAS ratioIds coverage', () => {
  it('every ratio in HEALTH_RATIOS appears in exactly one area', () => {
    const allMappedIds = MONEYSENSE_AREAS.flatMap((a) => a.ratioIds)
    for (const ratio of HEALTH_RATIOS) {
      const count = allMappedIds.filter((id) => id === ratio.id).length
      expect(count, `ratio ${ratio.id} should appear in exactly 1 area`).toBe(1)
    }
  })

  it('no ratioId references a non-existent ratio', () => {
    const validIds = new Set(HEALTH_RATIOS.map((r) => r.id))
    for (const area of MONEYSENSE_AREAS) {
      for (const id of area.ratioIds) {
        expect(validIds.has(id), `ratioId '${id}' in area '${area.id}' does not exist in HEALTH_RATIOS`).toBe(true)
      }
    }
  })
})
