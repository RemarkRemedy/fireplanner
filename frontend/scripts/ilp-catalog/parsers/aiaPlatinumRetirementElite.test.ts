import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaPlatinumRetirementElite } from './aiaPlatinumRetirementElite'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_PRE_Jul2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_PRE_Jul2025.pdf',
    pageCount: 7,
    totalCharacters: 1_800,
    pages: [
      {
        pageNumber: 1,
        characterCount: 260,
        text: 'Target Monthly Retirement Income overview',
        lines: [
          { y: 700, text: 'AIA Platinum Retirement Elite' },
          { y: 680, text: 'Target Monthly Retirement Income will be paid by redeeming units from your policy value.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 260,
        text: 'Monthly Retirement Income and Power-up Bonus',
        lines: [
          { y: 700, text: 'Monthly Retirement Income starts on or after the Target Retirement Age.' },
          { y: 680, text: 'Single Premium : 2.5% of Single Premium x Adjustment Factor' },
          { y: 660, text: 'Regular Premium : 12.5% of Annual Premium x Adjustment Factor' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 260,
        text: 'Regular premium and top-up subscription',
        lines: [
          { y: 720, text: '100% of Single Premium less Premium Charge will be used to purchase single premium units.' },
          { y: 700, text: '100% of Regular Premium less Premium Charge will be used to purchase regular premium units.' },
          { y: 680, text: '100% of Top-Up Premium less Premium Charge will be used to purchase top-up premium units.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 260,
        text: 'Supplementary Charge and Full Surrender Charge',
        lines: [
          { y: 720, text: 'Supplementary Charge is equivalent to 0.50% p.a. of Single Premium Policy Value.' },
          { y: 700, text: 'Supplementary Charge is equivalent to 2.50% p.a. of Regular Premium Policy Value.' },
          { y: 690, text: 'Full Surrender Charge = Full Surrender Charge Rate x Single Premium Policy Value' },
          { y: 680, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' },
          { y: 670, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Single Premium Policy Value Withdrawn' },
          { y: 660, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Regular Premium Policy Value Withdrawn' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 260,
        text: 'Top-up and withdrawal effects',
        lines: [
          { y: 700, text: 'You may request to pay additional top-up premium on an ad-hoc basis.' },
          { y: 680, text: 'Premium charge is 3% of the top-up premium.' },
          { y: 660, text: 'Request for a Partial Withdrawal will reduce the Power-up Bonus.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 200,
        text: 'Unused page',
        lines: [
          { y: 700, text: 'Free-look period.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 220,
        text: 'Premium holiday and reinstatement',
        lines: [
          { y: 700, text: 'For reinstatement, you are required to back-pay all outstanding past regular premiums that were due.' },
          { y: 680, text: 'Your policy will remain on Premium Holiday until you resume payment of the full outstanding amount of regular premiums.' },
        ],
      },
    ],
  }
}

describe('parseAiaPlatinumRetirementElite', () => {
  it('builds a valid supported regular-pay product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumRetirementElite({
      document,
      sourceChecksumSha256: '3333333333333333333333333333333333333333333333333333333333333333',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-retirement-elite')
    expect(product.productName).toBe('AIA Platinum Retirement Elite')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-retirement-elite-regular-premium-charge',
      'branch:aia-platinum-retirement-elite-regular-supplementary-charge',
      'branch:aia-platinum-retirement-elite-single-premium-charge',
      'branch:aia-platinum-retirement-elite-single-supplementary-charge',
      'branch:aia-platinum-retirement-elite-top-up-premium-charge',
      'branch:aia-platinum-retirement-elite-premium-holiday-charge',
      'branch:aia-platinum-retirement-elite-partial-withdrawal-charge',
      'branch:aia-platinum-retirement-elite-full-surrender-charge',
      'branch:aia-platinum-retirement-elite-power-up-bonus-no-withdrawal-corridor',
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-target-retirement-age-gate',
      'kernel:lapse-reinstatement-payout-state',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-withdrawal-adjusted-power-up-bonus')
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-retirement-elite-usd-and-srs-single-pay-selection')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-accidental-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-protection-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-premium-holiday-and-reinstatement-payout-continuity')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-reinstatement-and-payout-continuity')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-terminal-illness-benefit')
    expect(product.variants[0]?.unsupportedItems).toContain(
      'The current-state terminal-illness benefit amount is modeled as the same amount as the current death-benefit estimate, and the current accidental-death amount is modeled as the current death-benefit estimate plus 50% of cumulative paid regular premiums during the first 5 policy years, but accidental-death and terminal-illness claim admission, exclusions, settlement, and policy-termination handling remain informational only.',
    )
    expect(product.variants[0]?.unsupportedItems).not.toContain(
      'Accidental death and terminal illness benefit formulas remain informational only.',
    )

    expect(product.variants).toHaveLength(2)
    const regularPayVariant = product.variants.find((entry) => entry.id === 'sgd-mip-5')
    const singlePayVariant = product.variants.find((entry) => entry.id === 'sgd-open-ended-sp')
    expect(regularPayVariant).toMatchObject({
      id: 'sgd-mip-5',
      currency: 'SGD',
      mipLength: 5,
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: true,
        blockTopUpsWhenPremiumsNotPaidUpToDate: true,
        minimumTopUpAmount: 1_000,
        minimumPartialWithdrawalAmount: 1_000,
        partialWithdrawalMinimumRemainingValueRules: [
          { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
        ],
      },
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        requiresTargetRetirementAgeStart: true,
        source: 'policy-redemption',
        payoutStateSupport: {
          defaultState: 'target-income',
          suppressWhileLapsed: true,
          stateAfterReinstatement: 'target-income',
        },
      },
    })
    expect(regularPayVariant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'power-up-bonus',
        mode: 'one-time',
        oneTimePayoutBasis: 'committed-annual-premium-at-issue',
        rate: 0.125,
        cadenceYears: 5,
        adjustmentFactorConfig: {
          formula: 'cumulative-withdrawal-factor-product-over-account-value',
          withdrawalAccountIds: ['policy'],
          countFromPolicyYear: 6,
        },
      }),
    ])
    expect(regularPayVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'account-value',
        rate: 0.025,
        startPolicyYear: 1,
        endPolicyYear: 5,
      }),
    ])
    expect(regularPayVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(regularPayVariant?.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0])
    expect(regularPayVariant?.warnings).toContain(
      'AIA Platinum Retirement Elite is cataloged as a supported V1 product. The current parser captures the regular-pay 5-year corridor: premium-year regular premium charges, the 2.50% p.a. regular-premium supplementary charge, the premium-holiday charge schedule, annual-state lapse after projected account-value depletion, the 3% top-up premium charge with blocking in months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the regular-premium withdrawal / surrender charge schedules, the regular-pay Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability once a manual payout assumption is supplied with the published target-retirement-age start gate, the current-state death and terminal-illness benefit amount as 105% of policy value, and the current accidental-death uplift as 50% of cumulative paid regular premiums during the first 5 policy years, including lapse suppression in the annual-state model.',
    )
    expect(regularPayVariant?.unsupportedItems).not.toContain(
      'Withdrawal-adjusted Power-up Bonus scaling after any partial withdrawal from policy year 6 onward remains informational only.',
    )
    expect(regularPayVariant?.unsupportedItems).toContain(
      'The current-state terminal-illness benefit amount is modeled as the same amount as the current death-benefit estimate, and the current accidental-death amount is modeled as the current death-benefit estimate plus 50% of cumulative paid regular premiums during the first 5 policy years, but accidental-death and terminal-illness claim admission, exclusions, settlement, and policy-termination handling remain informational only.',
    )
    expect(regularPayVariant?.unsupportedItems).not.toContain(
      'Accidental death and terminal illness benefit formulas remain informational only.',
    )
    expect(regularPayVariant?.unsupportedItems).not.toContain('Reinstatement and premium-holiday effects on payout continuity remain informational only.')

    expect(singlePayVariant).toMatchObject({
      id: 'sgd-open-ended-sp',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        requiresTargetRetirementAgeStart: true,
        source: 'policy-redemption',
      },
    })
    expect(singlePayVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    })
    expect(singlePayVariant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'power-up-bonus',
        mode: 'one-time',
        oneTimePayoutBasis: 'initial-single-premium-at-issue',
        rate: 0.025,
        cadenceYears: 5,
      }),
    ])
    expect(singlePayVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'account-value',
        rate: 0.005,
        startPolicyYear: 1,
        endPolicyYear: 5,
      }),
    ])
    expect(singlePayVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(singlePayVariant?.eecTable).toEqual([0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0])
    expect(singlePayVariant?.warnings).toContain(
      'AIA Platinum Retirement Elite is cataloged as a supported V1 product. The current parser captures the SGD single-pay corridor: the 5% single-premium charge, the 0.50% p.a. single-premium supplementary charge for the first 5 policy years, the 3% top-up premium charge, the single-premium withdrawal / surrender charge schedules, the single-premium Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability once a manual payout assumption is supplied with the published target-retirement-age start gate, the current-state death and terminal-illness benefit amount as 105% of policy value, and the current accidental-death uplift as 10% of a manual initial single premium input during the first 5 policy years, including lapse suppression in the annual-state model.',
    )
    expect(singlePayVariant?.unsupportedItems).not.toContain(
      'Withdrawal-adjusted Power-up Bonus scaling after any partial withdrawal from policy year 6 onward remains informational only.',
    )
    expect(singlePayVariant?.unsupportedItems).toContain(
      'USD and SRS single-pay corridor selection remain informational only in V1.',
    )
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaPlatinumRetirementElite({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
    expect(product.supportStatus).toBe('supported')
    expect(product.variants[0]?.scheduledPayoutSupport?.mode).toBe('manual-assumption')
    expect(product.variants[0]?.scheduledPayoutSupport?.requiresTargetRetirementAgeStart).toBe(true)
  }, 30_000)
})
