import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeManuinvestDuo } from './manulifeManuinvestDuo'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MID01_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeManuinvestDuo', () => {
  it('builds a valid supported product for the modeled ManuInvest Duo corridors', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeManuinvestDuo({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-manuinvest-duo')
    expect(product.productName).toBe('ManuInvest Duo')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:current-tpd-benefit-estimate',
      'kernel:current-residual-death-benefit-after-tpd-estimate',
      'branch:manuinvest-duo-welcome-bonus',
      'branch:manuinvest-duo-loyalty-bonus',
      'branch:manuinvest-duo-administrative-charge',
      'branch:manuinvest-duo-zero-top-up-charge',
      'branch:manuinvest-duo-premium-shortfall-charge',
      'branch:manuinvest-duo-partial-withdrawal-charge',
      'branch:manuinvest-duo-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-death-ti-tpd-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manuinvest-duo-welcome-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manuinvest-duo-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('manuinvest-duo-premium-flexibility-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('manuinvest-duo-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manuinvest-duo-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manuinvest-duo-dividend-payout-threshold')
    expect(product.warnings.some((warning) => warning.includes('current-state death-benefit estimate from that same current sum insured'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current terminal-illness benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TI cap subject to the published S$1 million TI limit'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current residual death-benefit estimate after a TI claim today for the supported acceleration corridor'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current TPD benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TPD cap subject to the published S$5 million disability limit'))).toBe(true)
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-mip-10', 'sgd-mip-15', 'sgd-mip-20'])

    const variant = product.variants[0]
    expect(variant?.mipLength).toBe(10)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.05,
        postMipFeeRate: 0.01,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('product summary minimum payout amount'),
        expect.stringContaining('published $40 minimum annual threshold remain reinvested'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-manuinvest-duo-death-ti-tpd',
          monthlyModalFactor: 1 / 12,
        }),
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        freeLifetimeMonths: 24,
        freeLifetimeMonthsStartPolicyYear: 6,
        freeLifetimeMonthsResetOnRepayment: false,
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.55 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.47 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.2 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.55 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.47 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.2 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
        ],
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.63, 0.55, 0.47, 0.4, 0.3, 0.2, 0.08])
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        type: 'sign-up',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'initial-basic-sum-assured-multiple-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        appliesTo: ['policy'],
        tieredRates: expect.arrayContaining([
          expect.objectContaining({
            currency: 'SGD',
            minAnnualPremium: 3_600,
            maxAnnualPremium: 11_999.99,
            minSumAssuredMultiple: 10,
            maxSumAssuredMultiple: 14.99,
            rate: 0.05,
          }),
          expect.objectContaining({
            currency: 'SGD',
            minAnnualPremium: 12_000,
            maxAnnualPremium: null,
            minSumAssuredMultiple: 50,
            maxSumAssuredMultiple: 100,
            rate: 0.46,
          }),
        ]),
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        startPolicyYear: 7,
        endPolicyYear: 10,
        rate: 0.001,
        suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-2',
        mode: 'annual-rate',
        startPolicyYear: 11,
        endPolicyYear: null,
        rate: 0.002,
        suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
      }),
    ])
    expect(variant?.bonuses[0]?.tieredRates).toHaveLength(12)
    expect(variant?.warnings).toContain('Premium shortfall charging is modeled during the 10-year MIP with Premium Flexibility Benefit automatically suppressing the first 24 missed months only from policy year 6 onward; supplementary-benefit continuation during the benefit remains informational only.')
    expect(variant?.unsupportedItems).toContain(
      'The current terminal-illness benefit estimate and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap input because the product summary publishes a S$1 million TI limit and a cross-policy TI/CI limit that are not reconstructed from claims history in V1.',
    )
    expect(variant?.unsupportedItems).toContain(
      'The current TPD benefit estimate and current residual death-benefit estimate after a TPD claim today both need a manual remaining aggregate TPD cap input because the product summary publishes a S$5 million cross-policy disability limit that is not reconstructed from claims history in V1.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Death, terminal-illness, and TPD claim admission / exclusions / settlement remain informational only beyond the current death, terminal-illness, residual-after-TI, TPD, and residual-after-TPD estimates.',
    )
    expect(product.warnings.some((warning) => warning.includes('the MIP premium-shortfall-charge schedule on annualised basic premium with Premium Flexibility Benefit suppression starting only from policy year 6'))).toBe(true)

    const twentyYearVariant = product.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(twentyYearVariant?.eecTable).toEqual([1, 1, 0.9, 0.81, 0.71, 0.65, 0.59, 0.53, 0.48, 0.43, 0.38, 0.34, 0.3, 0.26, 0.22, 0.18, 0.14, 0.1, 0.09, 0.08])
  }, 30_000)
})
