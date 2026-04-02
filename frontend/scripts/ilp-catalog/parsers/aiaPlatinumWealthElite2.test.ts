import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaPlatinumWealthElite2 } from './aiaPlatinumWealthElite2'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_PWE2.0_Jul2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_PWE2.0_Jul2025.pdf',
    pageCount: 10,
    totalCharacters: 3_200,
    pages: [
      {
        pageNumber: 1,
        characterCount: 280,
        text: 'Platinum Wealth Elite 2.0 overview',
        lines: [
          { y: 700, text: 'Product Summary for Platinum Wealth Elite 2.0 Version 2.0' },
          { y: 680, text: 'You may choose to pay your premium in single pay or regular pay for 5 years, with the flexibility to extend regular pay to 10 years.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 400,
        text: 'Regular premium and premium charge schedule',
        lines: [
          { y: 700, text: '100% of Regular Premium less Premium Charge will be used to purchase regular premium units.' },
          { y: 680, text: 'Premium Charge = 5% of Single Premium' },
          { y: 660, text: '1 30% 2 25% 3 15% 4 8% 5 6%' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 420,
        text: 'Premium holiday and full surrender charge',
        lines: [
          { y: 700, text: 'Premium Holiday Charge = Premium Holiday Charge Annual Rate/12 x Annualised Regular Premium' },
          { y: 680, text: '1 - 4 35% 5 & onwards 0%' },
          { y: 660, text: 'Full Surrender Charge Rate 1 50% 2 40% 3 30% 4 20% 5 10% 6 & onwards 0%' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 420,
        text: 'Partial withdrawal charge and administration charge',
        lines: [
          { y: 700, text: 'Partial Withdrawal Charge Factor 1 1.000 2 0.667 3 0.429 4 0.250 5 0.111 6 & onwards 0' },
          { y: 680, text: 'Administration Charge = Insured Amount at the Issue Date or issue of new Layer x Annual Administration Charge Rate /12' },
        ],
      },
      {
        pageNumber: 8,
        characterCount: 320,
        text: 'Top-up premium section',
        lines: [
          { y: 700, text: 'You may request to pay additional top-up premium on an ad-hoc basis, provided all regular premiums are paid when they fall due.' },
          { y: 680, text: 'Premium charge is 3% of the top-up premium.' },
        ],
      },
      {
        pageNumber: 9,
        characterCount: 320,
        text: 'Non-payment and no lapse privilege',
        lines: [
          { y: 700, text: 'your policy shall be on Premium Holiday' },
          { y: 680, text: 'No Lapse Privilege will not be applicable.' },
        ],
      },
    ],
  }
}

describe('parseAiaPlatinumWealthElite2', () => {
  it('builds a valid regular-pay supported product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumWealthElite2({
      document,
      sourceChecksumSha256: '4444444444444444444444444444444444444444444444444444444444444444',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-wealth-elite-2')
    expect(product.productName).toBe('AIA Platinum Wealth Elite 2.0')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-wealth-elite-2-regular-premium-charge',
      'branch:aia-platinum-wealth-elite-2-single-premium-charge',
      'branch:aia-platinum-wealth-elite-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-elite-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-elite-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-elite-2-full-surrender-charge',
      'branch:aia-platinum-wealth-elite-2-vitality-bonus',
      'branch:aia-platinum-wealth-elite-2-no-lapse-administration-charge-carry',
      'branch:aia-platinum-wealth-elite-2-insurance-risk-charge-manual-input',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:no-lapse-fixed-charge-debt-carry',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
    ])
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-5',
      'sgd-mip-6',
      'sgd-mip-7',
      'sgd-mip-8',
      'sgd-mip-9',
      'sgd-mip-10',
      'sgd-single-pay',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-wealth-elite-2-no-lapse-history-and-non-manual-charge-indebtedness')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-elite-2-no-lapse-privilege')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-elite-2-premium-term-extension')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-elite-2-single-premium-corridor')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-elite-2-protection-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-elite-2-vitality-bonus')
    expect(product.warnings.some((warning) => warning.includes('regular-pay 5 to 10-year corridors plus the single-pay corridor'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('administration charge'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('5% single-premium charge'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('manual-input insurance-risk-charge placeholder'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('Vitality Fund Boost schedule'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs'))).toBe(true)

    const regularVariant = product.variants.find((variant) => variant.id === 'sgd-mip-5')
    expect(regularVariant).toMatchObject({
      id: 'sgd-mip-5',
      mipLength: 5,
      paymentStructure: 'ppt',
      premiumPaymentTermYears: 5,
      contributionMode: 'regular-pay',
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: true,
        blockTopUpsWhenPremiumsNotPaidUpToDate: true,
        accountValueDepletionNonLapseWindows: [
          { startPolicyYear: 1, endPolicyYear: 15 },
        ],
      },
    })
    expect(regularVariant?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'regular-premium-charge',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'administration-charge',
        basis: 'insured-amount-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 4,
        carryForwardOnInsufficientDeductionWithinPolicyYears: {
          startPolicyYear: 1,
          endPolicyYear: 15,
        },
      }),
      expect.objectContaining({
        id: 'insurance-risk-charge',
        basis: 'fixed-annual',
        requiresManualInput: true,
        activeWindow: 'policy-term',
        carryForwardOnInsufficientDeductionWithinPolicyYears: {
          startPolicyYear: 1,
          endPolicyYear: 15,
        },
      }),
    ]))
    expect(regularVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'vitality-fund-boost',
        label: 'Vitality Fund Boost',
        mode: 'premium-allocation',
        startPolicyYear: 1,
        endPolicyYear: 5,
        vitalityStatusRateSchedule: expect.arrayContaining([
          expect.objectContaining({
            status: 'silver',
            startPolicyYear: 1,
            endPolicyYear: 1,
            rate: 0.01,
          }),
          expect.objectContaining({
            status: 'silver',
            startPolicyYear: 2,
            endPolicyYear: 5,
            rate: 0,
          }),
          expect.objectContaining({
            status: 'platinum',
            startPolicyYear: 2,
            endPolicyYear: 5,
            rate: 0.02,
          }),
        ]),
      }),
    ]))
    expect(regularVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
      }),
    ])
    expect(regularVariant?.eecTable).toEqual([0.5, 0.4, 0.3, 0.2, 0.1, 0])
    expect(regularVariant?.unsupportedItems).toContain('Administration charge is modeled for the first issue-date insured-amount layer only. Change-of-insured layering and new-layer charge resets remain informational only.')
    expect(regularVariant?.unsupportedItems).toContain('Insurance Risk Charge is modeled only as a manual-input annualized placeholder because the applicable insurer illustration rate depends on underwriting and Free Legacy Cover state. Free Legacy Cover, no-lapse activation history, and non-manual charge indebtedness remain informational only.')
    expect(regularVariant?.unsupportedItems).toContain('Income Withdrawal Privilege and change-of-insured effects remain informational only, while Vitality Fund Boost is modeled under a static assumed status for the regular-pay and single-pay corridors only.')
    expect(regularVariant?.unsupportedItems).toContain('The current death benefit keeps manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs because withdrawals, debt, no-lapse status, Income Withdrawal Privilege usage, and claim-side reductions change the live corridor in ways this app cannot observe; those inputs are manual by design in V1.')
    expect(regularVariant?.unsupportedItems).toContain('Death Benefit Bequest Option and other protection-side payout handling remain informational only.')
    expect(regularVariant?.unsupportedItems).toContain('The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both keep manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs because the live insured amount, debt, no-lapse status, and cross-policy TI usage are current policy facts this app cannot observe; those inputs are manual by design in V1.')
    expect(regularVariant?.unsupportedItems).toContain('Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.')

    const longRegularVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    expect(longRegularVariant).toMatchObject({
      id: 'sgd-mip-10',
      mipLength: 10,
      paymentStructure: 'ppt',
      premiumPaymentTermYears: 10,
      contributionMode: 'regular-pay',
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: true,
        blockTopUpsWhenPremiumsNotPaidUpToDate: true,
        accountValueDepletionNonLapseWindows: [
          { startPolicyYear: 1, endPolicyYear: 15 },
        ],
      },
    })
    expect(longRegularVariant?.eecTable).toEqual([0.5, 0.4, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0])
    expect(longRegularVariant?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'regular-premium-charge',
        rateSchedule: expect.arrayContaining([
          expect.objectContaining({ startPolicyYear: 6, endPolicyYear: null, rate: 0.03 }),
        ]),
      }),
    ]))
    expect(longRegularVariant?.eventChargeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'premium-holiday-charge',
        rateSchedule: expect.arrayContaining([
          expect.objectContaining({ startPolicyYear: 5, endPolicyYear: null, rate: 0 }),
        ]),
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        rateSchedule: expect.arrayContaining([
          expect.objectContaining({ startPolicyYear: 6, endPolicyYear: null, rate: 0 }),
        ]),
      }),
    ]))

    const singlePayVariant = product.variants.find((variant) => variant.id === 'sgd-single-pay')
    expect(singlePayVariant).toMatchObject({
      id: 'sgd-single-pay',
      paymentStructure: 'single-pay',
      contributionMode: 'single-pay',
      mipLength: 5,
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: true,
        accountValueDepletionNonLapseWindows: [
          { startPolicyYear: 1, endPolicyYear: 15 },
        ],
      },
    })
    expect(singlePayVariant?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'administration-charge',
        basis: 'insured-amount-at-issue',
        carryForwardOnInsufficientDeductionWithinPolicyYears: {
          startPolicyYear: 1,
          endPolicyYear: 15,
        },
      }),
      expect.objectContaining({
        id: 'insurance-risk-charge',
        basis: 'fixed-annual',
        requiresManualInput: true,
        carryForwardOnInsufficientDeductionWithinPolicyYears: {
          startPolicyYear: 1,
          endPolicyYear: 15,
        },
      }),
    ]))
    expect(singlePayVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'vitality-fund-boost',
        mode: 'one-time',
        oneTimePayoutBasis: 'initial-single-premium-at-issue',
        vitalityStatusRateSchedule: expect.arrayContaining([
          expect.objectContaining({ status: 'silver', startPolicyYear: 1, endPolicyYear: 1, rate: 0.001 }),
          expect.objectContaining({ status: 'gold', startPolicyYear: 2, endPolicyYear: 5, rate: 0.001 }),
          expect.objectContaining({ status: 'platinum', startPolicyYear: 2, endPolicyYear: 5, rate: 0.002 }),
        ]),
      }),
    ]))
    expect(singlePayVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
      }),
    ])
    expect(singlePayVariant?.eecTable).toEqual([0.18, 0.15, 0.12, 0.08, 0.04, 0])
    expect(singlePayVariant?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('single-pay corridor'),
      expect.stringContaining('5% single-premium charge'),
    ]))
    expect(singlePayVariant?.unsupportedItems).not.toContain('Premium-term extension remains informational only in V1 because it applies to the regular-pay corridor only.')
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaPlatinumWealthElite2({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
    expect(product.variants[0]?.eventChargeRules.some((rule) => rule.id === 'partial-withdrawal-charge')).toBe(true)
  }, 30_000)
})
