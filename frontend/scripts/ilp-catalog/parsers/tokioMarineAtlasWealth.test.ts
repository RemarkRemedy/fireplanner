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
  it('builds valid supported split TM Atlas Wealth death-benefit variants from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineAtlasWealth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-atlas-wealth')
    expect(product.productName).toBe('TM Atlas Wealth')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(product.modeledEconomics).toContain('branch:tokio-atlas-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-atlas-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-atlas-multiple-life-last-life-settlement')
    expect(product.metadataOnlyBehaviors).toContain('tokio-atlas-change-of-life-assured-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-atlas-advanced-death-payout-and-life-assured-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-atlas-change-of-life-assured-option')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-atlas-dividend-payout-threshold-and-record-date-instructions')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25-advanced-death')

    expect(product.variants).toHaveLength(2)
    expect(basicVariant?.icpMonths).toBe(12)
    expect(basicVariant?.accounts).toEqual([
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
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.12 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.195 },
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
    expect(basicVariant?.warnings).toContain(
      'This partial template models the SGD / premium-payment-term-25 (Basic Death) corridor only.',
    )
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
    expect(advancedVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-net-premium-floor',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 1,
            settlementPolicyYear: 2,
          },
          disableFutureChargesOnInsufficientDeduction: true,
        }),
        requiresManualInput: true,
      }),
    ])
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published first-policy-year Monthly Protection Charge accrual, policy-year-2 settlement, policy-value valuation basis, and irreversible downgrade to Basic Death after failed Accumulation Units Account deduction.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled Monthly Protection Charge, multiple-life last-life settlement, change-of-life-assured administration, premium-holiday lapse behavior, regular withdrawal, credit-card charge, and non-SGD or non-25-year corridors remain metadata-only.',
    )
    expect(basicVariant?.eecTable).toEqual([
      1, 1, 0.88, 0.86, 0.84, 0.82, 0.8, 0.78, 0.76, 0.73,
      0.7, 0.67, 0.64, 0.61, 0.58, 0.54, 0.5, 0.45, 0.4, 0.35,
      0.3, 0.25, 0.2, 0.15, 0.1,
    ])
  }, 30_000)
})
