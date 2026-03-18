import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaEliteSecureIncome5Pay } from './aiaEliteSecureIncome5Pay'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_ESI5P_Jul2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_ESI5P_Jul2025.pdf',
    pageCount: 7,
    totalCharacters: 1_600,
    pages: [
      {
        pageNumber: 1,
        characterCount: 220,
        text: 'Secure Monthly Income overview',
        lines: [
          { y: 700, text: 'AIA Elite Secure Income - 5 Pay' },
          { y: 680, text: 'Secure Monthly Income is payable from the selected payout age.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 250,
        text: 'Secure payout conditions and Power-up Bonus',
        lines: [
          { y: 700, text: 'Power-up Bonus is paid from the end of the tenth policy year.' },
          { y: 680, text: 'The policy has not been previously reinstated.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 260,
        text: 'Regular premium and top-up subscription',
        lines: [
          { y: 700, text: '100% of Regular Premium less Premium Charge will be used to purchase regular premium units.' },
          { y: 680, text: '100% of Top-Up Premium less Premium Charge will be used to purchase top-up premium units.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 220,
        text: 'Premium Charge and Supplementary Charge',
        lines: [
          { y: 700, text: 'Premium Charge = 3% of each Top-Up Premium' },
          { y: 680, text: 'Supplementary Charge = Annual Supplementary Charge Rate/12 * Annual Premium' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 220,
        text: 'Premium Holiday Charge and Full Surrender Charge',
        lines: [
          { y: 700, text: 'Premium Holiday Charge = Premium Holiday Charge Annual Rate/12 x Annualised Regular Premium' },
          { y: 680, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 220,
        text: 'Partial Withdrawal Charge and top-up effects',
        lines: [
          { y: 700, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Regular Premium Policy Value Withdrawn' },
          { y: 680, text: 'Topping Up Premiums does not affect your Secure Monthly Income or Secure Payout Period.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 210,
        text: 'Reinstatement',
        lines: [
          { y: 700, text: 'For reinstatement, you are required to back-pay all outstanding premiums and all applicable fees and charges.' },
          { y: 680, text: 'After reinstatement, each Monthly Income payable after the reinstatement shall be paid as Target Monthly Income.' },
        ],
      },
    ],
  }
}

describe('parseAiaEliteSecureIncome5Pay', () => {
  it('builds a valid supported payout-state product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaEliteSecureIncome5Pay({
      document,
      sourceChecksumSha256: '2222222222222222222222222222222222222222222222222222222222222222',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-elite-secure-income-5-pay')
    expect(product.productName).toBe('AIA Elite Secure Income - 5 Pay')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-elite-secure-income-5p-premium-year-premium-charge',
      'branch:aia-elite-secure-income-5p-supplementary-charge-manual-input',
      'branch:aia-elite-secure-income-5p-top-up-premium-charge',
      'branch:aia-elite-secure-income-5p-premium-holiday-charge',
      'branch:aia-elite-secure-income-5p-partial-withdrawal-charge',
      'branch:aia-elite-secure-income-5p-full-surrender-charge',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:lapse-reinstatement-payout-state',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-5p-secure-monthly-income-election')
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-5p-power-up-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-elite-secure-income-5p-reinstatement-target-income')

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-mip-5',
      currency: 'SGD',
      mipLength: 5,
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
        payoutStateSupport: {
          defaultState: 'secure-income',
          suppressWhileLapsed: true,
          stateAfterPremiumHolidayActivation: 'target-income',
          stateAfterReinstatement: 'target-income',
        },
      },
    })
    expect(variant.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: null,
        subjectToEec: true,
      }),
    ])
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.2 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.1 },
          { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'fixed-annual',
        amount: 0,
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 10,
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
          { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.818 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.667 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.538 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.429 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.333 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.25 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.176 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.111 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.053 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0 },
        ],
      }),
    ])
    expect(variant.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0])
    expect(variant.warnings).toContain(
      'AIA Elite Secure Income - 5 Pay is cataloged as supported in V1 for the regular-pay corridor. The parser captures the premium-year regular premium charge schedule, a manual-input annual supplementary charge amount from the policy illustration, the 3% top-up premium charge, the premium-holiday charge schedule, the full-surrender / partial-withdrawal charge schedules, and scheduled payout capability through the payout-state kernel, including lapse suppression and permanent Target Monthly Income fallback after Premium Holiday activation or reinstatement in the annual-state model.',
    )
    expect(variant.unsupportedItems).not.toContain(
      'Supplementary charge remains informational only because the annual rate is only stated in the policy illustration.',
    )
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaEliteSecureIncome5Pay({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
    expect(product.variants[0]?.scheduledPayoutSupport?.mode).toBe('manual-assumption')
  }, 30_000)
})
