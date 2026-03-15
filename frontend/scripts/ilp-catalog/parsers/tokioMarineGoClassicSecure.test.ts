import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoClassicSecure } from './tokioMarineGoClassicSecure'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNXN_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoClassicSecure', () => {
  it('builds a valid partial #goClassic Secure product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoClassicSecure({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goclassic-secure')
    expect(product.productName).toBe('#goClassic Secure')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goclassic-secure-locked-in-policy-value')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-25')
    expect(variant?.icpMonths).toBe(24)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        feeRate: 0.0675,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.0135,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
    ])
    expect(variant?.feeRules).toEqual([])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
    ])
    expect(variant?.eecTable).toEqual([
      1, 1, 0.95, 0.93, 0.91, 0.89, 0.87, 0.85, 0.83, 0.8,
      0.77, 0.74, 0.71, 0.68, 0.64, 0.6, 0.56, 0.51, 0.46, 0.41,
      0.36, 0.31, 0.26, 0.21, 0.15,
    ])
  }, 30_000)
})
