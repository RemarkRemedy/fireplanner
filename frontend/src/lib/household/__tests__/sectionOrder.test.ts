import { describe, it, expect } from 'vitest'
import { SECTION_ORDERINGS, type SectionId, type SectionOrderKey } from '../sectionOrder'

/** Sections that participate in ordering (excludes Goals/Healthcare sub-items). */
const ALL_ORDERABLE: SectionId[] = [
  'section-personal',
  'section-income',
  'section-expenses',
  'section-net-worth',
  'section-cpf',
  'section-property',
  'section-fire-settings',
  'section-allocation',
]

describe('sectionOrder', () => {
  const keys: SectionOrderKey[] = ['goal-first', 'story-first', 'already-fire']

  it.each(keys)('%s contains all orderable sections', (key) => {
    const ordering = SECTION_ORDERINGS[key]
    expect([...ordering].sort()).toEqual([...ALL_ORDERABLE].sort())
  })

  it.each(keys)('%s has no duplicates', (key) => {
    const ordering = SECTION_ORDERINGS[key]
    expect(new Set(ordering).size).toBe(ordering.length)
  })

  it('goal-first starts with Personal then FIRE Settings', () => {
    expect(SECTION_ORDERINGS['goal-first'][0]).toBe('section-personal')
    expect(SECTION_ORDERINGS['goal-first'][1]).toBe('section-fire-settings')
  })

  it('story-first starts with Personal then Income', () => {
    expect(SECTION_ORDERINGS['story-first'][0]).toBe('section-personal')
    expect(SECTION_ORDERINGS['story-first'][1]).toBe('section-income')
  })

  it('already-fire starts with Personal then Net Worth', () => {
    expect(SECTION_ORDERINGS['already-fire'][0]).toBe('section-personal')
    expect(SECTION_ORDERINGS['already-fire'][1]).toBe('section-net-worth')
  })
})
