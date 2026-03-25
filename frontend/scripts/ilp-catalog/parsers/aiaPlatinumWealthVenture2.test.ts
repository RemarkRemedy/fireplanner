import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaPlatinumWealthVenture2 } from './aiaPlatinumWealthVenture2'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_PWV2.0_Apr2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_PWV2.0_Apr2025.pdf',
    pageCount: 14,
    totalCharacters: 2_500,
    pages: [
      {
        pageNumber: 1,
        characterCount: 260,
        text: 'AIA Platinum Wealth Venture 2.0 overview',
        lines: [
          { y: 700, text: 'AIA Platinum Wealth Venture 2.0' },
          { y: 680, text: 'AIA Platinum Wealth Venture 2.0 is a limited premium investment-linked insurance policy (ILP) with a 5 years premium term.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 260,
        text: 'Bonuses and maturity benefit',
        lines: [
          { y: 700, text: 'Investment Bonus will be paid at the beginning of the eighth (8th), ninth (9th), tenth (10th) and eleventh (11th) policy years.' },
          { y: 680, text: 'Performance Bonus rate is 0.40% p.a. of Regular Premium Policy Value.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 260,
        text: 'Regular premium and top-up subscription',
        lines: [
          { y: 700, text: '100% of regular premium will be used to purchase regular premium units.' },
          { y: 680, text: '100% of Top-Up Premium less Premium Charge will be used to purchase top-up premium units.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 380,
        text: 'Supplementary Charge and Premium Holiday Charge',
        lines: [
          { y: 700, text: 'Supplementary Charge which is equivalent to 3.60% p.a. of the Regular Premium Policy Value will be deducted for the first 7 policy years.' },
          { y: 690, text: 'Benefit Charge = Annual Benefit Charge Rate/12 x Sum-at-Risk.' },
          { y: 680, text: 'Sum-at-Risk = 100% of total regular premiums paid + total top-ups - total withdrawals - policy value.' },
          { y: 670, text: 'Premium Holiday Charge = Premium Holiday Charge Annual Rate/12 x Annualised Regular Premium.' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 260,
        text: 'Full Surrender Charge and Partial Withdrawal Charge',
        lines: [
          { y: 700, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' },
          { y: 680, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Regular Premium Policy Value Withdrawn' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 260,
        text: 'Top-up and withdrawal effects',
        lines: [
          { y: 700, text: 'You may request to pay additional top-up premium on an ad-hoc or regular basis.' },
          { y: 680, text: 'Premium charge is 3% of the top-up premium.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 240,
        text: 'Premium holiday continuation',
        lines: [
          { y: 700, text: 'When your policy is on Premium Holiday, the premiums payable for any premium-paying supplementary agreements will be deducted by cancellation of units.' },
          { y: 680, text: 'Your policy will remain on Premium Holiday until you resume payment of the full outstanding amount of regular premiums.' },
        ],
      },
      {
        pageNumber: 8,
        characterCount: 220,
        text: 'Reinstatement and termination',
        lines: [
          { y: 700, text: 'For reinstatement, you are required to back-pay all outstanding past regular premiums that were due.' },
          { y: 680, text: 'Your policy shall automatically terminate on the occurrence of the earliest of the following.' },
        ],
      },
      {
        pageNumber: 10,
        characterCount: 260,
        text: 'Distribution of Dividends',
        lines: [
          { y: 700, text: 'Distribution of Dividends' },
          { y: 680, text: 'By default, the dividends will be reinvested and distributed as additional units in the fund.' },
          { y: 660, text: 'We will not pay your entitled dividend in cash if the cash value of the dividend is less than S$50.' },
        ],
      },
      {
        pageNumber: 14,
        characterCount: 220,
        text: 'Appendix A annual benefit charge schedule',
        lines: [
          { y: 700, text: 'Current annual Benefit Charge per S$1,000 Sum-at-Risk' },
          { y: 680, text: 'Age Male Female' },
        ],
      },
    ],
  }
}

describe('parseAiaPlatinumWealthVenture2', () => {
  it('builds a valid regular-pay supported product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumWealthVenture2({
      document,
      sourceChecksumSha256: '4444444444444444444444444444444444444444444444444444444444444444',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-wealth-venture-2')
    expect(product.productName).toBe('AIA Platinum Wealth Venture 2.0')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-wealth-venture-2-welcome-bonus',
      'branch:aia-platinum-wealth-venture-2-investment-bonus',
      'branch:aia-platinum-wealth-venture-2-performance-bonus',
      'branch:aia-platinum-wealth-venture-2-zero-regular-premium-charge',
      'branch:aia-platinum-wealth-venture-2-regular-supplementary-charge',
      'branch:aia-platinum-wealth-venture-2-benefit-charge',
      'branch:aia-platinum-wealth-venture-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-venture-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-venture-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-venture-2-full-surrender-charge',
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-welcome-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-investment-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-performance-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-benefit-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-accidental-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-protection-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-reinstatement')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-dividend-cashout-threshold')
    expect(product.variants[0]?.unsupportedItems).toContain(
      'Accidental-death claim admission / exclusions / settlement, secondary-insured handling, and other protection-side claim handling remain informational only beyond the modeled current ordinary death-benefit estimate plus the first-2-policy-year 100%-of-paid-regular-premiums accidental-death uplift.',
    )
    expect(product.variants[0]?.unsupportedItems).not.toContain(
      'Benefit Charge, accidental death benefit, secondary insured, and other protection-side formulas remain informational only.',
    )

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-mip-5',
      currency: 'SGD',
      mipLength: 5,
    })
    expect(variant.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    })
    expect(variant.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'welcome-bonus-y1',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 41_999.99, rate: 0.03 },
          { currency: 'SGD', minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.03 },
        ],
      }),
      expect.objectContaining({
        id: 'welcome-bonus-y3',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.05 },
        ],
      }),
      expect.objectContaining({
        id: 'investment-bonus',
        mode: 'one-time',
        oneTimePayoutBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 8,
        endPolicyYear: 11,
        rate: 0.025,
        requiresPremiumsPaidUpToDate: true,
      }),
      expect.objectContaining({
        id: 'performance-bonus',
        mode: 'annual-rate',
        startPolicyYear: 8,
        rate: 0.004,
        requiresPremiumsPaidUpToDate: true,
      }),
    ]))
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'account-value',
        rate: 0.036,
        startPolicyYear: 1,
        endPolicyYear: 7,
      }),
      expect.objectContaining({
        id: 'benefit-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'aia-venture-benefit-charge',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        }),
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
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
    expect(variant.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('published S$50 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 10,
          section: 'Distribution of dividends',
        }),
      ],
    })
    expect(variant.eecTable).toEqual([0.6, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0])
    expect(product.warnings).toContain(
      'AIA Platinum Wealth Venture 2.0 is cataloged as a supported V1 product for the regular-pay 5-year corridor. The parser captures the published Welcome Bonus tiers for premium years 1 to 3, the Investment Bonus milestones at policy years 8 to 11, the annual Performance Bonus from policy year 8 onward, the current-state death benefit as the higher of policy value or total regular premiums paid plus top-up premiums less withdrawals, the current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years, zero regular-premium charge, the 3.60% p.a. regular-premium supplementary charge for the first 7 policy years, the published Appendix A Benefit Charge corridor, the premium-holiday charge schedule with full-outstanding-premium repayment resumption, annual-state lapse / termination after projected account-value depletion, the 3% top-up premium charge with blocking in months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the regular-premium withdrawal / surrender charge schedules with the published S$10,000 residual policy-value floor on explicit one-off withdrawals, and reinvest-default distribution support, while secondary-insured claim handling, fund-level charges, and underwriting or approval handling around premium resumption remain informational only beyond the modeled current ordinary death, accidental-death, and Benefit Charge estimates.',
    )
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaPlatinumWealthVenture2({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
