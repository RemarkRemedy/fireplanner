import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoLuxe } from './tokioMarineGoLuxe'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYF_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoLuxe', () => {
  it('builds a valid partial #goLuxe product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoLuxe({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goluxe')
    expect(product.productName).toBe('#goLuxe')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goluxe-loyalty-and-achievement-bonuses')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-15')
    expect(variant?.icpMonths).toBe(36)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({ id: 'initial', feeRate: 0.03, postMipFeeRate: 0, subjectToEec: true }),
      expect.objectContaining({ id: 'accumulation', feeRate: 0.0135, postMipFeeRate: 0.0135, subjectToEec: false }),
      expect.objectContaining({ id: 'topup', feeRate: 0, postMipFeeRate: 0, subjectToEec: false }),
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.045 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.06 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.085 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.11 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.125 },
    ])
    expect(variant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.95 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.76 },
            { startPolicyYear: 6, endPolicyYear: 15, rate: 0.08 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-premium-holiday',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.45 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.4 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.35 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.15 },
            { startPolicyYear: 11, endPolicyYear: 15, rate: 0 },
          ],
        }),
      ]),
    )
    expect(variant?.eecTable).toEqual([1, 1, 1, 0.95, 0.76, 0.76, 0.76, 0.73, 0.73, 0.73, 0.7, 0.6, 0.45, 0.25, 0.07])
  }, 30_000)
})
