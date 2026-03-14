import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternInvestAdvantage2Sp } from './greatEasternInvestAdvantage2Sp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage 2 (SP)_(SG)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternInvestAdvantage2Sp', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternInvestAdvantage2Sp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-great-invest-advantage-2-sp')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:great-eastern-gia2-sp-top-up-premium-charge',
      'branch:great-eastern-gia2-sp-open-ended-zero-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-gia2-sp-initial-single-premium-charge')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-gia2-sp-single-premium-principal-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cash-or-srs'])

    const variant = product.variants[0]
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.eecTable).toEqual([])
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
  }, 30_000)
})
