import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineAtlasWealth } from './tokioMarineAtlasWealth'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNWO_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineAtlasWealth', () => {
  it('builds a valid partial TM Atlas Wealth product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineAtlasWealth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-atlas-wealth')
    expect(product.productName).toBe('TM Atlas Wealth')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-25')
    expect(variant?.icpMonths).toBe(12)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        feeRate: 0.055,
        postMipFeeRate: 0.015,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.015,
        postMipFeeRate: 0.015,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.12 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.195 },
    ])
    expect(variant?.feeRules).toEqual([])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
    ])
    expect(variant?.eecTable).toEqual([
      1, 1, 0.88, 0.86, 0.84, 0.82, 0.8, 0.78, 0.76, 0.73,
      0.7, 0.67, 0.64, 0.61, 0.58, 0.54, 0.5, 0.45, 0.4, 0.35,
      0.3, 0.25, 0.2, 0.15, 0.1,
    ])
  }, 30_000)
})
