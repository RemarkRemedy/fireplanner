import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoAssure } from './tokioMarineGoAssure'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYA_TPDY_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

async function loadProduct() {
  const document = await extractPdfText(SOURCE_PATH)
  return parseTokioMarineGoAssure({
    document,
    sourceChecksumSha256: await sha256(SOURCE_PATH),
  })
}

describe('parseTokioMarineGoAssure', () => {
  it('builds a valid supported #goAssure family from the source PDF', async () => {
    const product = await loadProduct()

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goassure')
    expect(product.productName).toBe('#goAssure')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-5',
      'sgd-mip-10',
      'sgd-mip-15',
      'sgd-mip-20',
      'sgd-mip-25',
    ])
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-initial-bonus')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-policy-charge')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-loyalty-bonus')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-achievement-bonus')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-wellness-bonus')
    expect(product.modeledEconomics).toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(product.modeledEconomics).toContain('kernel:free-withdrawal-event-cap')
    expect(product.modeledEconomics).toContain('kernel:manual-charge-waiver-grant-limits')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-start-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-minimum-floor')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-tpd-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-marine-goassure-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('tokio-marine-goassure-waiver-approval-gating-and-limits')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goassure-initial-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goassure-wellness-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goassure-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goassure-achievement-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goassure-protection-benefits')
    expect(product.warnings[0]).toContain('SGD 5-year, 10-year, 15-year, 20-year, and 25-year cash corridors')
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap')
    expect(product.warnings[0]).toContain('distribution-mode assumption support')
  }, 30_000)

  it('models the 5-year corridor with the published minimums and in-mip charge tables', async () => {
    const product = await loadProduct()
    const variant = product.variants.find((entry) => entry.id === 'sgd-mip-5')

    expect(variant).toBeDefined()
    expect(variant?.icpMonths).toBe(48)
    expect(variant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 49,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
    })
    expect(variant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'initial-bonus-policy-year-1',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.01 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.02 },
        ],
      }),
      expect.objectContaining({
        id: 'initial-bonus-policy-year-4',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.02 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.03 },
        ],
      }),
    ]))
    expect(variant?.bonuses.some((bonus) => bonus.id === 'loyalty-bonus')).toBe(false)
    expect(variant?.bonuses.some((bonus) => bonus.id === 'achievement-bonus')).toBe(false)
    expect(variant?.bonuses.some((bonus) => bonus.id === 'wellness-bonus')).toBe(false)
    expect(variant?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'initial-charge',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0112 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.0224 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.0336 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.0448 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.056 },
        ],
      }),
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        startPolicyYear: 5,
        endPolicyYear: 5,
      }),
    ]))
    expect(variant?.eventChargeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        rateSchedule: [
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-non-payment',
        rateSchedule: [
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
        ],
      }),
    ]))
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 5, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 6, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.any(Array),
      sourceRefs: expect.any(Array),
    })
    expect(variant?.warnings).toContain(
      'The SGD 5-year minimum-contribution corridor publishes no Loyalty Bonus, a 0.00% Achievement Bonus, and a 0.00% Wellness Bonus rate, so those mechanics are not carried as active residual mechanics in V1.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Waiver approval timing, hospitalisation / retrenchment proof, medical and unemployment exclusions, first-assured coverage, and Tokio’s discretionary variation of benefit grant counts remain informational only beyond the modeled explicit chargeWaived plus optional shared chargeWaiverGrantId event path.',
    )
    expect(variant?.eecTable).toEqual([1, 1, 0.85, 0.25, 0.1])
  }, 30_000)

  it('models the long-tenor corridor bonuses, charges, and distribution windows from the published family tables', async () => {
    const product = await loadProduct()
    const term15 = product.variants.find((entry) => entry.id === 'sgd-mip-15')
    const term25 = product.variants.find((entry) => entry.id === 'sgd-mip-25')

    expect(term15?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'loyalty-bonus',
        label: 'Loyalty Bonus (Policy Years 11-15)',
        startPolicyYear: 11,
        endPolicyYear: 15,
        rate: 0.012,
      }),
      expect.objectContaining({
        id: 'achievement-bonus',
        label: 'Achievement Bonus',
        startPolicyYear: 15,
        endPolicyYear: 15,
        rate: 0.035,
      }),
      expect.objectContaining({
        id: 'wellness-bonus',
        label: 'Wellness Bonus',
        startPolicyYear: 20,
        endPolicyYear: 20,
        rate: 0.04,
      }),
    ]))
    expect(term15?.eventChargeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        rateSchedule: [
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.76 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.76 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.76 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.73 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.73 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.73 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.7 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.6 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.45 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.25 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.07 },
        ],
      }),
    ]))
    expect(term15?.warnings.some((warning) => warning.includes('current TPD benefit estimate before Protection Age'))).toBe(true)

    expect(term25?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 49,
      minimumRegularPremiumAmountByFrequency: {
        annual: 1_500,
        'semi-annual': 750,
        quarterly: 375,
        monthly: 125,
      },
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
    })
    expect(term25?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'initial-bonus-policy-year-4',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0.08 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.09 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.1 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        startPolicyYear: 11,
        endPolicyYear: 25,
        rate: 0.012,
      }),
      expect.objectContaining({
        id: 'achievement-bonus',
        startPolicyYear: 25,
        endPolicyYear: 25,
        rate: 0.035,
      }),
      expect.objectContaining({
        id: 'wellness-bonus',
        startPolicyYear: 30,
        endPolicyYear: 30,
        rate: 0.065,
      }),
    ]))
    expect(term25?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'initial-charge',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.003 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.006 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.009 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.012 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.015 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.018 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.021 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.024 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.027 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.03 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.033 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.036 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.039 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.042 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.045 },
          { startPolicyYear: 16, endPolicyYear: 16, rate: 0.048 },
          { startPolicyYear: 17, endPolicyYear: 17, rate: 0.051 },
          { startPolicyYear: 18, endPolicyYear: 18, rate: 0.054 },
          { startPolicyYear: 19, endPolicyYear: 19, rate: 0.057 },
          { startPolicyYear: 20, endPolicyYear: 20, rate: 0.06 },
          { startPolicyYear: 21, endPolicyYear: 21, rate: 0.063 },
          { startPolicyYear: 22, endPolicyYear: 22, rate: 0.066 },
          { startPolicyYear: 23, endPolicyYear: 23, rate: 0.069 },
          { startPolicyYear: 24, endPolicyYear: 24, rate: 0.072 },
          { startPolicyYear: 25, endPolicyYear: 25, rate: 0.075 },
        ],
      }),
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        startPolicyYear: 5,
        endPolicyYear: 25,
      }),
    ]))
    expect(term25?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 25, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 26, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.any(Array),
      sourceRefs: expect.any(Array),
    })
    expect(term25?.warnings).toContain(
      'The core 1.20% Loyalty Bonus, 3.50% Achievement Bonus, and 6.50% Wellness Bonus amounts for the SGD 25-year minimum-contribution corridor are modeled as simplified Accumulation Units Account credits at the published policy-year windows. The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions and the source-stated delayed payout basis remain informational only.',
    )
    expect(term25?.eecTable).toEqual([1, 1, 0.95, 0.95, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.82, 0.82, 0.75, 0.75, 0.65, 0.65, 0.6, 0.6, 0.55, 0.5, 0.45, 0.35, 0.25, 0.15, 0.08])
  }, 30_000)
})
