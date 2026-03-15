import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthFlexi } from './tokioMarineWealthFlexi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZY_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthFlexi', () => {
  it('builds a valid partial Wealth Flexi product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthFlexi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-flexi')
    expect(product.productName).toBe('Wealth Flexi')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-regular-premium-routing-to-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-initial-setup-policy-investment-admin-monthly-protection-and-dividend-distribution',
    )

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.icpMonths).toBe(1)
    expect(variant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(variant?.accounts[0]?.subjectToEec).toBe(true)
    expect(variant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 5, rate: 0.1 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 10, rate: 0 },
          ],
        }),
      ]),
    )
    expect(variant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Performance Investment Bonus (Policy Years 4-6)',
      'Performance Investment Bonus (Policy Years 7-10)',
      'Performance Investment Bonus (After MIP)',
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.18 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.22 },
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.07])
  }, 30_000)
})
