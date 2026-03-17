import { describe, it, expect } from 'vitest'
import { getLifeStageGuides, MONEYSENSE_AREAS } from './moneySenseGuide'
import { HEALTH_RATIOS } from './healthBenchmarks'

describe('getLifeStageGuides', () => {
  it('returns only starting-out for age 20', () => {
    const guides = getLifeStageGuides(20)
    expect(guides).toHaveLength(1)
    expect(guides[0].label).toContain('Starting Out')
  })

  it('returns two guides for age 25 (starting-out + starting-family overlap)', () => {
    const guides = getLifeStageGuides(25)
    expect(guides).toHaveLength(2)
    expect(guides[0].label).toContain('Starting Out')
    expect(guides[1].label).toContain('Starting a Family')
  })

  it('returns one guide for age 30 (starting-family only)', () => {
    const guides = getLifeStageGuides(30)
    expect(guides).toHaveLength(1)
    expect(guides[0].label).toContain('Starting a Family')
  })

  it('returns two guides for age 36 (starting-family + supporting overlap)', () => {
    const guides = getLifeStageGuides(36)
    expect(guides).toHaveLength(2)
    expect(guides[0].label).toContain('Starting a Family')
    expect(guides[1].label).toContain('Supporting Children & Parents')
  })

  it('returns one guide for age 50 (supporting only)', () => {
    const guides = getLifeStageGuides(50)
    expect(guides).toHaveLength(1)
    expect(guides[0].label).toContain('Supporting Children & Parents')
  })

  it('returns two guides for age 55 (supporting + retiree overlap)', () => {
    const guides = getLifeStageGuides(55)
    expect(guides).toHaveLength(2)
    expect(guides[0].label).toContain('Supporting Children & Parents')
    expect(guides[1].label).toContain('Retiree')
  })

  it('returns retiree only for age 60', () => {
    const guides = getLifeStageGuides(60)
    expect(guides).toHaveLength(1)
    expect(guides[0].label).toContain('Retiree')
  })

  it('returns empty array for age 18 (below minimum)', () => {
    expect(getLifeStageGuides(18)).toHaveLength(0)
  })

  it('returns retiree guide for age 120 (max)', () => {
    const guides = getLifeStageGuides(120)
    expect(guides).toHaveLength(1)
    expect(guides[0].label).toContain('Retiree')
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
