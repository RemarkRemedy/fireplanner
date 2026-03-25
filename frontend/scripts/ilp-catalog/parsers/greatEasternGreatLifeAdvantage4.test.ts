import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternGreatLifeAdvantage4 } from './greatEasternGreatLifeAdvantage4'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternGreatLifeAdvantage4', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternGreatLifeAdvantage4({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-great-life-advantage-4')
    expect(product.productName).toBe('GREAT Life Advantage 4')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-tpd-benefit-estimate',
      'kernel:current-ti-benefit-after-tpd-estimate',
      'kernel:current-residual-death-benefit-after-tpd-estimate',
      'branch:great-life-advantage-4-premium-charge',
      'branch:great-life-advantage-4-premium-reward',
      'branch:great-life-advantage-4-policy-fee',
      'branch:great-life-advantage-4-insurance-charge',
      'branch:great-life-advantage-4-premium-holiday-charge',
      'branch:great-life-advantage-4-premium-holiday-charge-refund',
      'branch:great-life-advantage-4-top-up-charge',
      'branch:great-life-advantage-4-withdrawal-charge',
      'branch:great-life-advantage-4-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-paid-up-to-date-block',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('great-life-advantage-4-insurance-charge')
    expect(product.warnings).toContain(
      'GREAT Life Advantage 4 is cataloged as a supported V1 corridor. The parser captures the premium-year regular premium charge schedule, premium reward, fixed policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or current basic sum assured plus top-ups less withdrawals including withdrawal charges after current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current residual death-benefit estimate after a TPD claim today as account value when a manual Continuation Event status is set to triggered, the current TI benefit estimate after a TPD claim today as account value on the same supported continuation surface, first-two-policy-years premium-holiday charge and refund privilege, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and first-two-policy-years withdrawal / surrender charges, while non-lapse guarantee debt carry, rider-side continuation and deduction behavior, basic-sum-assured and premium-stream state changes, and broader protection-benefit claim handling remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate, current residual death-after-TPD estimate, current TI-after-TPD estimate, and fee drag.',
    )
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-regular-pay'])

    const variant = product.variants[0]
    expect(variant.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant.bonuses).toEqual([
      expect.objectContaining({
        id: 'premium-reward',
        type: 'allocation',
        rate: 0.02,
        startPolicyYear: 10,
      }),
    ])
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        amountSchedule: [{ startPolicyYear: 1, endPolicyYear: null, amount: 60 }],
      }),
      expect.objectContaining({
        id: 'insurance-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: {
          formula: 'great-eastern-gla4-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge-refund',
        trigger: 'premium-holiday-repayment',
        basis: 'premium-holiday-charge-refund',
        rate: 1,
        sourceChargeRuleId: 'premium-holiday-charge',
      }),
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
        ],
      }),
    ])
    expect(variant.eecTable).toEqual([1, 1])
    expect(variant.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    })
    expect(variant.warnings).toContain(
      'GREAT Life Advantage 4 is cataloged as a supported V1 corridor. The parser captures the premium-year regular premium charge schedule, the 2% premium reward path, the fixed S$5 monthly policy fee, the monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or current basic sum assured plus top-ups less withdrawals including withdrawal charges after current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current residual death-benefit estimate after a TPD claim today as account value when a manual Continuation Event status is set to triggered, the current TI benefit estimate after a TPD claim today as account value on the same supported continuation surface, the first-two-policy-years premium-holiday charge and refund privilege, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and the first-two-policy-years withdrawal / surrender charge schedule.',
    )
    expect(variant.unsupportedItems).toContain(
      'The current-state death / terminal-illness / TPD benefit estimate needs manual current basic sum assured and current amount owing inputs because current debt and protected-base history are not reconstructed in V1.',
    )
    expect(variant.unsupportedItems).toContain(
      'The current-state TPD estimate needs a manual remaining aggregate TPD cap input because Great Eastern’s S$5,000,000 aggregate TPD limit is not reconstructed across policies and riders in V1.',
    )
    expect(variant.unsupportedItems).toContain(
      'The current residual death-benefit estimate after a TPD claim today and the current TI benefit estimate after a TPD claim today both need a manual Continuation Event status because qualifying Additional CI UDR attachment and in-force state at TPD admission are not reconstructed in V1.',
    )
  }, 30_000)
})
