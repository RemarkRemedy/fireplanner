import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeInvestFlex } from './incomeInvestFlex'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/VS1_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeInvestFlex', () => {
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeInvestFlex({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-invest-flex')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.metadataOnlyBehaviors).toContain('income-vs1-death-ti-insurance-cover-charge')
    expect(product.metadataOnlyBehaviors).toContain('income-vs1-distribution-payout-election')

    expect(product.variants).toHaveLength(4)
    const variant = product.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()
    expect(variant).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
      icpMonths: 1,
    })
    expect(variant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee',
          basis: 'account-value',
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.005 },
          ],
        }),
      ]),
    )
    expect(variant?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'investment-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6000, maxAnnualPremium: 9599.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 9600, maxAnnualPremium: null, rate: 0.25 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.005,
        }),
      ]),
    )
    expect(variant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          ],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
      ]),
    )
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])
  }, 30_000)
})
