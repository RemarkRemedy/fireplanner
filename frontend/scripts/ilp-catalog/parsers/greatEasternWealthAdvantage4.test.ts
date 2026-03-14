import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternWealthAdvantage4 } from './greatEasternWealthAdvantage4'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Wealth Advantage 4_(SG)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternWealthAdvantage4', () => {
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternWealthAdvantage4({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-wealth-advantage-4')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('branch:great-eastern-wa4-premium-holiday-charge')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-wa4-insurance-charge')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-wa4-premium-holiday-charge-refund')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-choice-5',
      'sgd-mip-10-choice-10-under-6000',
      'sgd-mip-10-choice-10-6000-and-above',
      'sgd-mip-15-choice-15-under-6000',
      'sgd-mip-15-choice-15-6000-and-above',
    ])

    const choice15High = product.variants.find((variant) => variant.id === 'sgd-mip-15-choice-15-6000-and-above')
    expect(choice15High).toBeDefined()
    expect(choice15High?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 1_200, maxAnnualPremium: 2_399.99, rate: 0.075 },
            { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 3_599.99, rate: 0.15 },
            { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 5_999.99, rate: 0.25 },
            { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.3 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.55 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-bonus',
          startPolicyYear: 16,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          startPolicyYear: 15,
        }),
      ]),
    )
    expect(choice15High?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-fee-rate',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, rate: 0.015 },
          { startPolicyYear: 16, endPolicyYear: null, rate: 0.007 },
        ],
      }),
    ])
    expect(choice15High?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.8 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.6 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.6 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.5 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.5 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.4 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.4 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.4 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.2 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.2 },
          ],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.45 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.15 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.1 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.08 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.08 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.07 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.07 },
          ],
        }),
      ]),
    )

    const choice10Low = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-10-under-6000')
    expect(choice10Low).toBeDefined()
    expect(choice10Low?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee-fixed-low-annualised-premium',
          basis: 'fixed-annual',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
      ]),
    )
  }, 30_000)
})
