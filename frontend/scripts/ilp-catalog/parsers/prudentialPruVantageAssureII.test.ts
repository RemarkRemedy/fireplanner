import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPruVantageAssureII } from './prudentialPruVantageAssureII'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure II Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPruVantageAssureII', () => {
  it('builds a valid supported product with growth-account distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPruVantageAssureII({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-pruvantage-assure-ii')
    expect(product.productName).toBe('PRUVantage Assure II')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toEqual([
      'premium-pass-wealth-share-change-of-life-assured-options',
    ])

    const term5Variant = product.variants.find((variant) => variant.id === 'sgd-mip-5')
    expect(term5Variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('after 5 years'),
        expect.stringContaining('Wealth Assure Value'),
      ]),
      sourceRefs: expect.any(Array),
    })

    const term15Variant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    expect(term15Variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('after 10 years'),
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
  }, 30_000)
})
