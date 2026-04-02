import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeLegacyFlexSolitaire } from './incomeLegacyFlexSolitaire'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/VA3R_VA3S_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeLegacyFlexSolitaire', () => {
  it('builds valid supported regular-premium and single-premium corridors from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeLegacyFlexSolitaire({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-legacy-flex-solitaire')
    expect(product.productName).toBe('Legacy Flex Solitaire (VA3S / VA3R)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:income-legacy-flex-solitaire-regular-premium-charge',
      'branch:income-legacy-flex-solitaire-single-premium-charge',
      'branch:income-legacy-flex-solitaire-policy-fee',
      'branch:income-legacy-flex-solitaire-insurance-cover-charge',
      'branch:income-legacy-flex-solitaire-loyalty-bonus',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'branch:income-legacy-flex-solitaire-top-up-premium-charge',
      'branch:income-legacy-flex-solitaire-premium-holiday-charge',
      'branch:income-legacy-flex-solitaire-appendix-2-withdrawal-and-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('income-legacy-flex-solitaire-single-premium-corridor')
    expect(product.metadataOnlyBehaviors).toContain('income-legacy-flex-solitaire-terminal-illness-and-claim-settlement')
    expect(product.metadataOnlyBehaviors).not.toContain('income-legacy-flex-solitaire-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('income-legacy-flex-solitaire-policy-fee')
    expect(product.metadataOnlyBehaviors).not.toContain('income-legacy-flex-solitaire-insurance-cover-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('income-legacy-flex-solitaire-protection-benefits')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-regular-mip-5',
      'sgd-regular-mip-10',
      'sgd-mip-5-single-premium',
    ])

    const term10 = product.variants.find((variant) => variant.id === 'sgd-regular-mip-10')
    expect(term10?.accounts).toEqual([
      expect.objectContaining({
        id: 'premium',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'premium', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'premium', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
      }),
    ])
    expect(term10?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.35 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.26 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.15 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.1 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.045 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.03 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.03 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.03 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.03 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.03 },
        ],
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 4,
        appliesTo: ['premium'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'insurance-cover-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        appliesTo: ['premium'],
        assuranceValueAppliesTo: ['premium', 'topup'],
        fallbackAppliesTo: ['topup'],
        assuranceConfig: expect.objectContaining({
          formula: 'income-legacy-flex-solitaire-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 120,
        }),
      }),
    ]))
    expect(term10?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['topup'],
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        appliesTo: ['premium'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['premium'],
      }),
    ])
    expect(term10?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['premium', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('retirement option'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(term10?.bonuses).toEqual([
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        appliesTo: ['premium'],
        startPolicyYear: 11,
        endPolicyYear: null,
        rate: 0.005,
        suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
      }),
    ])
    expect(term10?.warnings).toContain(
      'Legacy Flex Solitaire is cataloged as supported in V1 for the 10-year regular-premium corridor. The parser captures the premium-year regular premium charge schedule, a manual-input policy-fee amount for policy years 1-4, the manual-input Appendix 1 insurance-cover-charge corridor, the current-state death and terminal-illness benefit estimate as the higher of adjusted sum assured or policy value via a manual current adjusted sum assured input, the published Loyalty Bonus rate with the supported partial-withdrawal suspension subset, the top-up premium charge, the premium-holiday charge schedule, the premium-account Appendix 2 partial-withdrawal / surrender charge schedule, and the published reinvest-only distribution baseline.',
    )
    expect(term10?.warnings).toContain(
      'Qualifying Withdrawal Access Option withdrawals can be represented in V1 with event-level charge and loyalty-bonus-suspension waivers, and qualifying top-up-account withdrawals can be represented with event-level loyalty-bonus-suspension waivers, while timing, caps, once-per-policy-year administration, adjusted-sum-assured exceptions, and No Lapse Guarantee exceptions remain informational only.',
    )
    expect(term10?.unsupportedItems).toContain(
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state, but terminal-illness definitions, exclusions, insurer-side settlement, secondary-insured continuation, bequest option behavior, and other protection-side claim mechanics remain informational only beyond the supported current death / terminal-illness benefit estimate and insurance-cover-charge corridor.',
    )
    expect(term10?.unsupportedItems).toContain(
      'Automatic adjusted-sum-assured updates after top-ups, charged withdrawals, withdrawal-access exceptions, and sum-assured reductions remain informational only, so the current adjusted sum assured must be maintained manually for the insurance-cover-charge corridor and current death / terminal-illness benefit estimate.',
    )
    expect(term10?.unsupportedItems).toContain(
      'Withdrawal Access Option timing, 5%-of-prevailing-premium-account-value limits, once-per-policy-year administration, and top-up-account first-12-month charge timing remain informational only in V1.',
    )
    expect(term10?.bonuses[0]?.notes).toContain(
      'Qualifying Withdrawal Access Option withdrawals and top-up-account withdrawals can be represented in V1 by setting bonusSuspensionWaived on the recorded partial-withdrawal event.',
    )
    expect(term10?.eventChargeRules[2]?.notes).toContain(
      'Qualifying Withdrawal Access Option withdrawals can be represented in V1 by setting chargeWaived on the premium-account partial-withdrawal event.',
    )
    expect(term10?.eecTable).toEqual([0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2])

    const singlePremium = product.variants.find((variant) => variant.id === 'sgd-mip-5-single-premium')
    expect(singlePremium?.paymentStructure).toBe('single-pay')
    expect(singlePremium?.contributionMode).toBe('single-pay')
    expect(singlePremium?.accounts).toEqual([
      expect.objectContaining({
        id: 'premium',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'premium', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
      }),
    ])
    expect(singlePremium?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0.04,
        appliesTo: ['premium'],
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 4,
        appliesTo: ['premium'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'insurance-cover-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        appliesTo: ['premium'],
        assuranceValueAppliesTo: ['premium', 'topup'],
        fallbackAppliesTo: ['topup'],
      }),
    ]))
    expect(singlePremium?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['topup'],
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['premium'],
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.19 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.15 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.12 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.08 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.04 },
        ],
      }),
    ])
    expect(singlePremium?.eventChargeRules.map((rule) => rule.id)).not.toContain('premium-holiday-charge')
    expect(singlePremium?.bonuses).toEqual([
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        appliesTo: ['premium'],
        startPolicyYear: 6,
        endPolicyYear: null,
        rate: 0.0025,
      }),
    ])
    expect(singlePremium?.warnings).toContain(
      'Legacy Flex Solitaire is cataloged as supported in V1 for the 5-year single-premium corridor. The parser captures the 4% single-premium charge, a manual-input policy-fee amount for policy years 1-4, the manual-input Appendix 1 insurance-cover-charge corridor, the current-state death and terminal-illness benefit estimate as the higher of adjusted sum assured or policy value via a manual current adjusted sum assured input, the published Loyalty Bonus rate with the supported partial-withdrawal suspension subset, the top-up premium charge, the premium-account Appendix 2 partial-withdrawal / surrender charge schedule, and the published reinvest-only distribution baseline.',
    )
    expect(singlePremium?.unsupportedItems).not.toContain(
      'Single-premium corridor remains informational only in V1, including the 4% single-premium charge and the single-premium Appendix 2 charge schedule.',
    )
    expect(singlePremium?.eecTable).toEqual([0.19, 0.15, 0.12, 0.08, 0.04])
  }, 30_000)
})
