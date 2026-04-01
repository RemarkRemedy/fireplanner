import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { createSupportNoteDisplayItem, mergeSupportNotes } from './supportNoteUtils'

describe('mergeSupportNotes', () => {
  it('collapses overlapping modeled notes across catalog seeds', () => {
    const { manifest, products } = getIlpCatalog()
    let overlapSeedCount = 0

    for (const product of products) {
      for (const variant of product.variants) {
        const seed = templateVariantToPolicySeed(product, variant, manifest)
        const notes = (seed.catalogWarnings ?? []).slice(0, 4)
        const items = notes.map(createSupportNoteDisplayItem)
        const introCounts = new Map<string, number>()

        for (const item of items) {
          if (item.intro == null || item.bullets.length === 0) continue
          introCounts.set(item.intro, (introCounts.get(item.intro) ?? 0) + 1)
        }

        const hasOverlap = [...introCounts.values()].some((count) => count > 1)
        if (!hasOverlap) continue

        overlapSeedCount += 1
        const merged = mergeSupportNotes(notes)
        expect(merged.length).toBeLessThan(notes.length)

        const mergedIntros = merged
          .map((note) => note.intro)
          .filter((intro): intro is string => intro != null)

        expect(new Set(mergedIntros).size).toBe(mergedIntros.length)
      }
    }

    expect(overlapSeedCount).toBeGreaterThan(0)
  })
})
