import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternInvestAdvantageSp } from './greatEasternInvestAdvantageSp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternInvestAdvantageSp', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternInvestAdvantageSp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-great-invest-advantage-sp')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:great-eastern-gia-sp-single-premium-charge',
      'branch:great-eastern-gia-sp-top-up-premium-charge',
      'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-gia-sp-single-premium-principal-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash-or-srs',
      'sgd-open-ended-cpfis',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash-or-srs')
    expect(cashVariant).toBeDefined()
    expect(cashVariant?.mipBasis).toBe('open-ended')
    expect(cashVariant?.mipLength).toBeNull()
    expect(cashVariant?.eecTable).toEqual([])
    expect(cashVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])

    const cpfisVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cpfis')
    expect(cpfisVariant).toBeDefined()
    expect(cpfisVariant?.mipBasis).toBe('open-ended')
    expect(cpfisVariant?.mipLength).toBeNull()
    expect(cpfisVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        rate: 0,
      }),
    ])
    expect(cpfisVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        rate: 0,
      }),
    ])
  }, 30_000)
})
