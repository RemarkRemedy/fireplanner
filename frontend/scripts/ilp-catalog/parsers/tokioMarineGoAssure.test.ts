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

describe('parseTokioMarineGoAssure', () => {
  it('builds a valid supported #goAssure product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoAssure({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goassure')
    expect(product.productName).toBe('#goAssure')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-initial-bonus')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-policy-charge')
    expect(product.modeledEconomics).toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(product.modeledEconomics).toContain('kernel:free-withdrawal-event-cap')
    expect(product.modeledEconomics).toContain('kernel:manual-charge-waiver-grant-limits')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-start-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-minimum-floor')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-wellness-bonus')
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

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.icpMonths).toBe(48)
    expect(variant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 49,
      minimumRegularPremiumAmountByFrequency: {
        annual: 3_600,
        'semi-annual': 1_800,
        quarterly: 900,
        monthly: 300,
      },
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
    })
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'initial-bonus-policy-year-1',
        label: 'Initial Bonus (Policy Year 1)',
        annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        rate: 0,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0.01 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.02 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.03 },
        ],
      }),
      expect.objectContaining({
        id: 'initial-bonus-policy-year-2',
        label: 'Initial Bonus (Policy Year 2)',
        annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
        startPolicyYear: 2,
        endPolicyYear: 2,
        rate: 0,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0.02 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.03 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.04 },
        ],
      }),
      expect.objectContaining({
        id: 'initial-bonus-policy-year-3',
        label: 'Initial Bonus (Policy Year 3)',
        annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
        startPolicyYear: 3,
        endPolicyYear: 3,
        rate: 0,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0.03 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.04 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.05 },
        ],
      }),
      expect.objectContaining({
        id: 'initial-bonus-policy-year-4',
        label: 'Initial Bonus (Policy Year 4)',
        annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
        startPolicyYear: 4,
        endPolicyYear: 4,
        rate: 0,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 100_000, maxSumAssured: 199_000, rate: 0.05 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 200_000, maxSumAssured: 299_000, rate: 0.06 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minSumAssured: 300_000, maxSumAssured: null, rate: 0.07 },
        ],
      }),
      expect.objectContaining({
        id: 'wellness-bonus',
        label: 'Wellness Bonus',
        type: 'custom',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 15,
        endPolicyYear: 15,
        rate: 0.035,
        tieredRates: [],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-charge',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0065 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.013 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.0195 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.026 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.0325 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.039 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.0455 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.052 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.0585 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.065 },
        ],
      }),
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        basis: 'premium-base-mip-multiplier',
        rate: 0.01,
        startPolicyYear: 5,
        endPolicyYear: 10,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        manualWaiverMode: 'capped-free-event',
        manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
        manualWaiverMaxGrantCount: 3,
        freeEventCount: 3,
        freeEventMaxAmountRate: 0.15,
        freeEventMaxAmountBasis: 'open-balance',
        rateSchedule: [
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-non-payment',
        trigger: 'premium-holiday',
        manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
        manualWaiverMaxGrantCount: 3,
        manualWaiverMaxOverlapMonths: 12,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-reduction',
        trigger: 'regular-premium-reduction',
        manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
        manualWaiverMaxGrantCount: 3,
        manualWaiverMaxOverlapMonths: 12,
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 10, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 11, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Initial Units Account are automatically reinvested'),
        expect.stringContaining('Accumulation Units Account and Top-up Units Account'),
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant?.distributionSupport).not.toHaveProperty('minimumAnnualPayoutAmount')
    expect(variant?.warnings).toContain(
      'Dividend cash payouts are partially modeled through the manual distribution-mode assumption surface: during the minimum contribution period, Initial Units Account dividends stay reinvested while Accumulation Units Account and Top-up Units Account dividends may be paid in cash; after the minimum contribution period, Initial Units Account dividends join the cash-payout corridor; distribution-option changes should be submitted at least 30 days before the Record Date; and the published $50 per-dividend minimum payout threshold remains informational only.',
    )
    expect(variant?.warnings).toContain(
      'Explicit regular-premium variation now honors the published after-first-four-policy-years start gate and the SGD minimum regular premium table for annual / semi-annual / quarterly / monthly payment modes. Tokio-defined minimum increase / reduction amounts remain informational only.',
    )
    expect(variant?.warnings).toContain(
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; the published maximum recurring single premium table and insurer-defined increase / reduction minimums remain informational only.',
    )
    expect(variant?.warnings).toContain(
      'Use the charge waiver toggle on qualifying Accumulation Units Account partial withdrawals, premium holidays, or regular-premium reductions only after Tokio has approved the hospitalisation or involuntary-unemployment waiver. The engine now honors the published up-to-15%-of-Accumulation-Units-Account withdrawal cap, the up-to-12-month premium-shortfall-charge waiver cap, and the shared three-grants-per-lifetime limit when related approved events share the same chargeWaiverGrantId; the published 90-day application timing, proof requirements, exclusions, and first-assured coverage remain informational only.',
    )
    expect(variant?.warnings).toContain(
      'The core 3.50% Wellness Bonus amount for the SGD 10-year minimum-contribution corridor is modeled as a simplified policy-year-15 Accumulation Units Account credit. The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions and the source-stated delayed payout basis remain informational only. On this corridor, Loyalty Bonus is N.A. and Achievement Bonus is 0.00%, so they are not carried as active residual mechanics in V1.',
    )
    expect(variant?.warnings.some((warning) => warning.includes('Initial Bonus corridor for policy years 1 to 4 via manual initial basic sum assured at issue bands'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('current-state death-benefit estimate before and after Protection Age'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('current TPD benefit estimate before Protection Age via the same current death corridor plus a manual current TPD acceleration ratio'))).toBe(true)
    expect(variant?.warnings).toContain(
      'The modeled Initial Bonus corridor still needs the initial basic sum assured at issue because the commencement-date sum-assured bands are not reconstructed from current state in V1.',
    )
    expect(variant?.unsupportedItems).not.toContain(
      'The modeled Initial Bonus corridor still needs the initial basic sum assured at issue because the commencement-date sum-assured bands are not reconstructed from current state in V1.',
    )
    expect(variant?.unsupportedItems).not.toContain('Wellness Bonus remains informational only.')
    expect(variant?.unsupportedItems).toContain(
      'Waiver approval timing, hospitalisation / retrenchment proof, medical and unemployment exclusions, first-assured coverage, and Tokio’s discretionary variation of benefit grant counts remain informational only beyond the modeled explicit chargeWaived plus optional shared chargeWaiverGrantId event path.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Monthly Protection Charge, sum-at-risk formulas, Guaranteed Extra Protection, terminal-illness exclusions / settlement, post-TPD continuation state, and broader protection-side claim behavior remain informational only beyond the modeled current TI snapshot and current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today.',
    )
    expect(variant?.warnings).toContain(
      'The current-state death-benefit estimate needs manual current Protection Age, current amount owing, and, after Protection Age, current basic sum assured inputs because protection-age elections and withdrawal-adjusted basic-sum-assured history are not reconstructed in V1.',
    )
    expect(variant?.warnings).toContain(
      'The current terminal-illness snapshot also needs a manual remaining aggregate TI cap because cross-policy TI-limit usage is not reconstructed from history in V1.',
    )
    expect(variant?.warnings).toContain(
      'The current TPD benefit estimate before Protection Age also needs a manual current TPD acceleration ratio plus a manual remaining aggregate TPD cap because the TPD rider sum assured and cross-policy TPD-limit usage are not reconstructed from history in V1.',
    )
    expect(variant?.eecTable).toEqual([1, 1, 0.95, 0.95, 0.7, 0.65, 0.6, 0.45, 0.25, 0.08])
  }, 30_000)
})
