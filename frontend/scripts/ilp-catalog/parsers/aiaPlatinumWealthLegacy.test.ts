import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaPlatinumWealthLegacy } from './aiaPlatinumWealthLegacy'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_PWL_Jul2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_PWL_Jul2025.pdf',
    pageCount: 7,
    totalCharacters: 2_400,
    pages: [
      {
        pageNumber: 1,
        characterCount: 280,
        text: 'AIA Platinum Wealth Legacy overview',
        lines: [
          { y: 700, text: 'Product Summary for AIA Platinum Wealth Legacy Version 4.0' },
          { y: 680, text: 'You may choose to pay your premium in single pay or regular pay for 5 years.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 420,
        text: 'Premium charge and administration charge',
        lines: [
          { y: 700, text: '100% of Regular Premium less Premium Charge will be used to purchase regular premium units.' },
          { y: 680, text: 'Premium Charge = 5% of Single Premium' },
          { y: 660, text: '1 36% 2 18% 3 6% 4 6% 5 4%' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 420,
        text: 'Partial withdrawal and premium holiday charge',
        lines: [
          { y: 700, text: 'Partial Withdrawal/Surrender Charge Rate 1 50% 2 45% 3 40% 4 35% 5 30% 6 25% 7 20% 8 15% 9 10% 10 5%' },
          { y: 680, text: 'Premium Holiday Charge Annual Rate 1-4 35% 5+ 0%' },
          { y: 660, text: 'Single Premium Partial Withdrawal/Surrender Charge Rate 1 18% 2 16% 3 14% 4 12% 5 10% 6 8% 7 6% 8 4% 9 2% 10 1%' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 320,
        text: 'Top-up premium and withdrawal',
        lines: [
          { y: 700, text: 'You may request to pay additional top-up premium on an ad hoc basis, provided all regular premiums are paid when they fall due.' },
          { y: 680, text: 'Premium charge is 3% of the top-up premium.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 320,
        text: 'Non-payment of regular premium',
        lines: [
          { y: 700, text: 'your policy shall be on Premium Holiday.' },
          { y: 680, text: 'Your policy will remain on Premium Holiday until you resume payment of the full outstanding amount of regular premiums.' },
        ],
      },
    ],
  }
}

describe('parseAiaPlatinumWealthLegacy', () => {
  it('builds valid supported regular-pay and single-pay product corridors from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumWealthLegacy({
      document,
      sourceChecksumSha256: '5555555555555555555555555555555555555555555555555555555555555555',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-wealth-legacy')
    expect(product.productName).toBe('AIA Platinum Wealth Legacy')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-wealth-legacy-regular-premium-charge',
      'branch:aia-platinum-wealth-legacy-single-premium-charge',
      'branch:aia-platinum-wealth-legacy-top-up-premium-charge',
      'branch:aia-platinum-wealth-legacy-premium-holiday-charge',
      'branch:aia-platinum-wealth-legacy-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-legacy-full-surrender-charge',
      'branch:aia-platinum-wealth-legacy-administration-charge-manual-input',
      'branch:aia-platinum-wealth-legacy-insurance-risk-charge-manual-input',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-legacy-single-premium-corridor')
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-wealth-legacy-no-lapse-privilege')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-legacy-protection-benefits')
    expect(product.warnings.some((warning) => warning.includes('regular-pay 5-year corridor plus the single-pay corridor'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('manual-input administration-charge and insurance-risk-charge placeholders sourced from the policy illustration'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current No Lapse Privilege mode inputs that remain user-supplied by design in this app'))).toBe(true)

    const regularVariant = product.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(regularVariant).toMatchObject({
      id: 'sgd-mip-5',
      mipLength: 5,
      eecTable: [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05],
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: false,
        blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      },
    })
    expect(regularVariant?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'regular-premium-charge',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'administration-charge',
        basis: 'fixed-annual',
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 10,
      }),
      expect.objectContaining({
        id: 'insurance-risk-charge',
        basis: 'fixed-annual',
        requiresManualInput: true,
        activeWindow: 'policy-term',
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
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.5 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.45 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.4 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.35 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.3 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.25 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.2 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.15 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.1 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
        ],
      }),
    ])
    expect(regularVariant?.unsupportedItems).toContain('The current death benefit keeps manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs because adjusted partial-withdrawal history, debt, and no-lapse state are live policy facts this app cannot observe; those inputs are manual by design in V1.')
    expect(regularVariant?.unsupportedItems).toContain('The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both keep manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs because debt, no-lapse status, and cross-policy TI usage are current policy facts this app cannot observe; those inputs are manual by design in V1.')
    expect(regularVariant?.unsupportedItems).toContain('Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.')
    expect(regularVariant?.unsupportedItems).toContain('Other protection-side payout handling remains informational only.')

    const singlePayVariant = product.variants.find((entry) => entry.id === 'sgd-single-pay')
    expect(singlePayVariant).toMatchObject({
      id: 'sgd-single-pay',
      paymentStructure: 'single-pay',
      contributionMode: 'single-pay',
      eecTable: [0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.04, 0.02, 0.01],
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: false,
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
        basis: 'fixed-annual',
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'insurance-risk-charge',
        basis: 'fixed-annual',
        requiresManualInput: true,
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
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.18 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.16 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.14 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.12 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.08 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.06 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.04 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.02 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.01 },
        ],
      }),
    ])
    expect(singlePayVariant?.eventChargeRules.map((rule) => rule.id)).not.toContain('premium-holiday-charge')
    expect(singlePayVariant?.warnings).toContain(
      'AIA Platinum Wealth Legacy is cataloged as a supported V1 product for the single-pay corridor. The parser captures the 5% single-premium charge, the 3% top-up premium charge, the published single-pay partial-withdrawal / surrender charge schedules, manual-input administration-charge and insurance-risk-charge placeholders sourced from the policy illustration, and the current-state death benefit corridor plus terminal-illness and residual-after-TI snapshots via the same manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs, while no-lapse activation or expiry election mechanics and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current snapshot surface.',
    )
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaPlatinumWealthLegacy({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
    expect(product.variants.find((entry) => entry.id === 'sgd-mip-5')?.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05])
    expect(product.variants.find((entry) => entry.id === 'sgd-single-pay')?.eecTable).toEqual([0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.04, 0.02, 0.01])
  }, 30_000)
})
