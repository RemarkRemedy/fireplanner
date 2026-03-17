import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoAffluence } from './tokioMarineGoAffluence'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYD_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoAffluence', () => {
  it('builds valid split #goAffluence death-benefit variants from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoAffluence({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goaffluence')
    expect(product.productName).toBe('#goAffluence')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-goaffluence-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goaffluence-dividend-payout-threshold-record-date-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goaffluence-regular-withdrawal-and-partial-withdrawal-constraints')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15-advanced-death')

    expect(product.variants).toHaveLength(2)
    expect(basicVariant?.icpMonths).toBe(24)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.5 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.57 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.64 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.71 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.75 },
    ])
    expect(basicVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0085 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.017 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.0255 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.034 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.0425 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.051 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.0595 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.068 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.0765 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.085 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.0935 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.102 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.1105 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.119 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.1275 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.012,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 15, mode: 'policy-year' },
            ],
          },
        }),
      ]),
    )
    expect(basicVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
    ])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('During the 15-year premium payment term'),
        expect.stringContaining('published SGD 50 minimum dividend amount'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.distributionSupport?.notes).not.toContain(
      'The published $50 minimum dividend amount and 30-day instruction window remain informational only in V1.',
    )
    expect(basicVariant?.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.91, 0.84, 0.76, 0.68, 0.6, 0.5, 0.43, 0.34, 0.26, 0.15])
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['initial', 'topup'],
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
          }),
        }),
      ]),
    )
  }, 30_000)
})
