import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthFlexiLink312 } from './tokioMarineWealthFlexiLink312'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UOAB_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthFlexiLink312', () => {
  it('builds a valid partial Wealth Flexi-Link 3.12 product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthFlexiLink312({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-flexi-link-3-12')
    expect(product.productName).toBe('Wealth Flexi-Link 3.12')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toContain('tokio-premium-bonus')
    expect(product.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(product.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-3-12-involuntary-unemployment-waiver')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-3-12-dividend-payout-threshold-and-record-date-instructions')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-12')
    expect(variant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(variant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus',
      'Power-up Bonus (Policy Year 10)',
      'Power-up Bonus (Policy Year 11)',
      'Power-up Bonus (Policy Year 12)',
      'Loyalty Bonus',
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.16 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'premium-bonus')?.rate).toBe(0.0023)
    expect(variant?.bonuses.find((bonus) => bonus.id === 'power-up-bonus-policy-year-12')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.0305 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0345 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0375 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.04 },
    ])
    expect(variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.rate).toBe(0.0055)
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        basis: 'account-value',
        rate: 0.0245,
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'policy-charge-after-mip',
        basis: 'account-value',
        rate: 0.006,
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup'],
      }),
    ])
    expect(variant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.92 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.85 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.78 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.75 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.68 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.58 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.48 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.075 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.015 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.01 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
          ],
        }),
      ]),
    )
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 3, accountIds: ['topup'] },
        { startPolicyYear: 4, endPolicyYear: null, accountIds: ['accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('For the first three policy years'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant?.eecTable).toEqual([1, 1, 0.92, 0.85, 0.78, 0.75, 0.68, 0.58, 0.48, 0.075, 0.015, 0.01])
  }, 30_000)
})
