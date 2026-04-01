import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaProAchiever3 } from './aiaProAchiever3'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_APA3.0_Oct2024.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_APA3.0_Oct2024.pdf',
    pageCount: 22,
    totalCharacters: 4_800,
    pages: [
      { pageNumber: 1, characterCount: 260, text: 'AIA Pro Achiever 3.0 overview', lines: [{ y: 700, text: 'AIA Pro Achiever 3.0' }, { y: 680, text: 'AIA Pro Achiever 3.0 is a regular premium investment-linked insurance policy.' }] },
      { pageNumber: 2, characterCount: 620, text: 'Welcome Bonus', lines: [
        { y: 700, text: 'Welcome Bonus rates will be based on the applicable table as follows:' },
        { y: 680, text: 'IIP 10:' },
        { y: 660, text: '1st policy year 5% 5% 10% 15%' },
        { y: 640, text: '2nd policy year - 8% 13% 18%' },
        { y: 620, text: '3rd policy year - 10% 15% 20%' },
        { y: 600, text: 'IIP 15:' },
        { y: 580, text: '1st policy year 8% 8% 13% 18%' },
        { y: 560, text: '2nd policy year - 11% 16% 21%' },
        { y: 540, text: '3rd policy year - 14% 19% 24%' },
        { y: 520, text: 'IIP 20:' },
        { y: 500, text: '1st policy year 10% 10% 15% 20%' },
        { y: 480, text: '2nd policy year - 15% 20% 25%' },
        { y: 460, text: '3rd policy year - 20% 25% 30%' },
      ] },
      { pageNumber: 3, characterCount: 240, text: 'Special Bonus', lines: [{ y: 700, text: 'Special Bonus will be paid from the 10th annual premium onwards.' }, { y: 680, text: '10th to 20th annual regular premium paid onwards 5%' }] },
      { pageNumber: 5, characterCount: 520, text: 'Premium and top-up charges', lines: [{ y: 700, text: '5.2. Supplementary Charge' }, { y: 680, text: 'Every month, a Supplementary Charge equivalent to (3.90% / 12) of the Regular Premium Policy Value will be deducted from your policy.' }, { y: 660, text: 'Such charge will only cease upon the payment of 11th annual / 21st semi-annual / 41st quarterly / 121st monthly regular premium.' }, { y: 640, text: 'Benefit Charge will be deducted on a monthly basis to provide for insurance cover.' }, { y: 620, text: 'Benefit Charge = Annual Benefit Charge Rate/12 x Sum-at-Risk' }, { y: 600, text: 'Sum-at-Risk = 100% of total regular premiums paid + total top-ups + total premium reduction top-up amount – total withdrawals – policy value' }, { y: 580, text: 'Premium Charge = 5% of each Top-Up Premium.' }] },
      { pageNumber: 6, characterCount: 700, text: 'Premium Holiday Charge', lines: [{ y: 700, text: 'Premium Holiday Charge = Premium Holiday Charge Annual Rate/12 x Annualised Regular Premium' }, { y: 680, text: 'IIP 10 1 100% 2 30% 3 20% 4 20% 5 10% 6 10% 7 5% 8 5% 9 2.5% 10 2.5% 11 onwards 0%' }, { y: 660, text: 'IIP 15 1 100% 2 30% 3 20% 4 20% 5 10% 6 10% 7 5% 8 5% 9 2.5% 10 2.5% 11 2.5% 12 2.5%' }, { y: 640, text: 'Such charge will only cease to apply once the relevant regular premium has been paid.' }] },
      { pageNumber: 7, characterCount: 520, text: 'Premium Holiday Charge continuation', lines: [{ y: 700, text: '13th 2.5% 14th 2.5% 15th 2.5% 16th 2.5% 17th 2.5% 18th 2.5% 19th 2.5% 20th 2.5% 21st onwards* 0%' }] },
      { pageNumber: 9, characterCount: 600, text: 'Full surrender charge', lines: [{ y: 700, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' }, { y: 680, text: 'IIP 10 100% 100% 80% 70% 60% 50% 45% 35% 20% 5% 0%' }, { y: 660, text: 'IIP 15 100% 100% 80% 70% 60% 50% 45% 35% 20% 5% 5% 5% 5% 5% 5% 0%' }, { y: 640, text: 'IIP 20 100% 100% 80% 70% 60% 50% 45% 35% 20% 5% 5% 5% 5% 5% 5%' }] },
      { pageNumber: 10, characterCount: 640, text: 'Partial withdrawal charge', lines: [{ y: 700, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Regular Premium Policy Value Withdrawn' }, { y: 680, text: 'IIP 10 year 3 4.000 year 4 2.333 year 5 1.500 year 6 1.000 year 7 0.818 year 8 0.539 year 9 0.250 year 10 0.053 year 11 onwards 0' }, { y: 660, text: 'IIP 15 year 3 4.000 year 4 2.333 year 5 1.500 year 6 1.000 year 7 0.818 year 8 0.539 year 9 0.250' }] },
      { pageNumber: 11, characterCount: 420, text: 'Top-up option', lines: [{ y: 700, text: 'IIP 20:' }, { y: 680, text: '10th 0.053 11th 0.053 12th 0.053 13th 0.053 14th 0.053 15th 0.053 16th 0.053 17th 0.053 18th 0.053 19th 0.053 20th 0.053 21st onwards 0' }, { y: 660, text: '6.2. Top-Up' }, { y: 640, text: 'Premium charge is 5% of the top-up premium.' }] },
      { pageNumber: 14, characterCount: 200, text: 'Premium Pass', lines: [{ y: 700, text: 'During the Premium Pass Period, Premium Holiday Charge and Supplementary Charge will not be applicable.' }] },
      { pageNumber: 17, characterCount: 200, text: 'Distribution of dividends', lines: [{ y: 700, text: 'Distribution of Dividends' }, { y: 680, text: 'Cash dividend payout is only allowed after the end of the relevant IIP and amounts below S$50 remain reinvested.' }] },
      { pageNumber: 22, characterCount: 260, text: 'Appendix A', lines: [{ y: 700, text: 'Current annual Benefit Charge per S$1,000 Sum-at-Risk' }, { y: 680, text: 'Attained Age Male Female' }, { y: 660, text: '40 1.33 0.98' }] },
    ],
  }
}

describe('parseAiaProAchiever3', () => {
  it('builds a valid supported regular-pay product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaProAchiever3({
      document,
      sourceChecksumSha256: '4444444444444444444444444444444444444444444444444444444444444444',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-pro-achiever-3')
    expect(product.productName).toBe('AIA Pro Achiever 3.0')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-pro-achiever-3-welcome-bonus',
      'branch:aia-pro-achiever-3-special-bonus',
      'branch:aia-pro-achiever-3-regular-premium-charge',
      'branch:aia-pro-achiever-3-benefit-charge',
      'branch:aia-pro-achiever-3-regular-supplementary-charge',
      'branch:aia-pro-achiever-3-premium-holiday-charge',
      'branch:aia-pro-achiever-3-top-up-premium-charge',
      'branch:aia-pro-achiever-3-partial-withdrawal-charge',
      'branch:aia-pro-achiever-3-full-surrender-charge',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-pro-achiever-3-premium-pass')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-pro-achiever-3-premium-holiday-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-pro-achiever-3-supplementary-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-pro-achiever-3-welcome-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-pro-achiever-3-special-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-pro-achiever-3-dividend-cashout-threshold')
    expect(product.warnings[0]).toContain('published SGD IIP 10, IIP 15, and IIP 20 corridors')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-iip-10', 'sgd-iip-15', 'sgd-iip-20'])

    const variant10 = product.variants.find((variant) => variant.id === 'sgd-iip-10')
    const variant15 = product.variants.find((variant) => variant.id === 'sgd-iip-15')
    const variant20 = product.variants.find((variant) => variant.id === 'sgd-iip-20')

    expect(variant10?.warnings[0]).toContain('10-year IIP corridor')
    expect(variant10?.unsupportedItems[0]).toContain('Appendix A Benefit Charge corridor')

    expect(variant10).toMatchObject({
      id: 'sgd-iip-10',
      currency: 'SGD',
      mipLength: 10,
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: false,
        blockTopUpsWhenPremiumsNotPaidUpToDate: true,
        minimumTopUpAmount: 1_000,
        minimumPartialWithdrawalStartPolicyMonthByAccount: [
          { accountId: 'policy', startPolicyMonth: 25 },
        ],
      },
    })
    expect(variant10?.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'benefit-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'aia-pro-achiever-3-benefit-charge',
          monthlyModalFactor: 1 / 12,
        }),
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'account-value',
        rate: 0.039,
        startPolicyYear: 1,
        endPolicyYear: 10,
        suspensionRules: [
          {
            trigger: 'premium-holiday',
            basis: 'prorate-by-overlap-months',
          },
        ],
      }),
    ])
    expect(variant10?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus-premium-year-1',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0.05 },
          { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 7_199.99, rate: 0.05 },
          { currency: 'SGD', minAnnualPremium: 7_200, maxAnnualPremium: 11_999.99, rate: 0.1 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.15 },
        ],
      }),
      expect.objectContaining({
        id: 'welcome-bonus-premium-year-2',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'welcome-bonus-premium-year-3',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'special-bonus-premium-years-10-20',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'special-bonus-premium-year-21-onward',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
        rate: 0.08,
      }),
    ])
    expect(variant10?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.3 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.2 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.2 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.1 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.05 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.05 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.025 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.025 },
          { startPolicyYear: 11, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 3, rate: 4 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 2.333 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 1.5 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 1 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.818 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.539 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.053 },
          { startPolicyYear: 11, endPolicyYear: null, rate: 0 },
        ],
      }),
    ])
    expect(variant10?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('only allowed after the end of the relevant IIP'),
        expect.stringContaining('published S$50 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 17,
          section: 'Distribution of dividends',
        }),
      ],
    })
    expect(variant10?.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.2, 0.05, 0])
    expect(variant15?.bonuses[0]?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 7_199.99, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: 7_200, maxAnnualPremium: 11_999.99, rate: 0.13 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.18 },
    ])
    expect(variant15?.eventChargeRules.find((rule) => rule.id === 'premium-holiday-charge')?.rateSchedule).toEqual([
      { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.3 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.2 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.2 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.1 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.05 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.05 },
      { startPolicyYear: 9, endPolicyYear: 9, rate: 0.025 },
      { startPolicyYear: 10, endPolicyYear: 10, rate: 0.025 },
      { startPolicyYear: 11, endPolicyYear: 11, rate: 0.025 },
      { startPolicyYear: 12, endPolicyYear: 12, rate: 0.025 },
      { startPolicyYear: 13, endPolicyYear: 13, rate: 0.025 },
      { startPolicyYear: 14, endPolicyYear: 14, rate: 0.025 },
      { startPolicyYear: 15, endPolicyYear: 15, rate: 0.025 },
      { startPolicyYear: 16, endPolicyYear: null, rate: 0 },
    ])
    expect(variant15?.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.2, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0])
    expect(variant20?.bonuses[2]?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0 },
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 7_199.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 7_200, maxAnnualPremium: 11_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
    ])
    expect(variant20?.eventChargeRules.find((rule) => rule.id === 'partial-withdrawal-charge')?.rateSchedule).toEqual([
      { startPolicyYear: 3, endPolicyYear: 3, rate: 4 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 2.333 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 1.5 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 1 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.818 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.539 },
      { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
      { startPolicyYear: 10, endPolicyYear: 20, rate: 0.053 },
      { startPolicyYear: 21, endPolicyYear: null, rate: 0 },
    ])
    expect(variant20?.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.2, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0])
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaProAchiever3({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
