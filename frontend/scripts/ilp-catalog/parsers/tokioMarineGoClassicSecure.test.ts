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
  it('builds a valid supported #goClassic Secure product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoClassicSecure({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goclassic-secure')
    expect(product.productName).toBe('#goClassic Secure')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:tokio-locked-in-protection-state')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goclassic-secure-dividend-payout-threshold-and-record-date-instructions')

    expect(product.variants).toHaveLength(2)

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25')
    expect(basicVariant).toBeDefined()
    expect(basicVariant?.icpMonths).toBe(24)
    expect(basicVariant?.accounts).toEqual([
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
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
    ])
    expect(basicVariant?.feeRules).toEqual([])
    expect(basicVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
    ])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 25, accountIds: ['accumulation'] },
        { startPolicyYear: 26, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('During the 25-year premium payment term'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.eecTable).toEqual([
      1, 1, 0.95, 0.93, 0.91, 0.89, 0.87, 0.85, 0.83, 0.8,
      0.77, 0.74, 0.71, 0.68, 0.64, 0.6, 0.56, 0.51, 0.46, 0.41,
      0.36, 0.31, 0.26, 0.21, 0.15,
    ])
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )

    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25-advanced-death')
    expect(advancedVariant).toBeDefined()
    expect(advancedVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-locked-in-policy-value',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 2,
            settlementPolicyYear: 3,
          },
          disableFutureChargesOnInsufficientDeduction: true,
          tokioProtectionState: {
            mode: 'locked-in-policy-value',
            trackedValueAccountIds: ['initial', 'accumulation'],
            withdrawalReductionAccountIds: ['initial', 'accumulation'],
          },
        }),
        requiresManualInput: true,
      }),
    ])
    expect(advancedVariant?.sourceRefs.map((ref) => ref.section)).toEqual(
      expect.arrayContaining([
        'Appendix A Surrender Charge',
        'Appendix A Monthly Protection Charge Rates',
      ]),
    )
  }, 30_000)
})
