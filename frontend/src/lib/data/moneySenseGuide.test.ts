import { describe, it, expect } from 'vitest'
import { getLifeStageGuide, MONEYSENSE_AREAS } from './moneySenseGuide'
import { HEALTH_RATIOS } from './healthBenchmarks'

describe('getLifeStageGuide', () => {
  it('returns starting-out guide for age 25', () => {
    expect(getLifeStageGuide(25)?.label).toContain('Starting Out')
  })

  it('returns retiree guide for age 60', () => {
    expect(getLifeStageGuide(60)?.label).toContain('Retiree')
  })

  it('returns null for age 0', () => {
    expect(getLifeStageGuide(0)).toBeNull()
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
