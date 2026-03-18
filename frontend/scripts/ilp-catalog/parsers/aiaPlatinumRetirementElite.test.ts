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
          { y: 680, text: 'Power-up Bonus is paid from the end of the tenth policy year.' },
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
        characterCount: 260,
        text: 'Supplementary Charge and Full Surrender Charge',
        lines: [
          { y: 700, text: 'Supplementary Charge is equivalent to 2.50% p.a. of Regular Premium Policy Value.' },
          { y: 680, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' },
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
      'branch:aia-platinum-retirement-elite-top-up-premium-charge',
      'branch:aia-platinum-retirement-elite-premium-holiday-charge',
      'branch:aia-platinum-retirement-elite-partial-withdrawal-charge',
      'branch:aia-platinum-retirement-elite-full-surrender-charge',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:lapse-reinstatement-payout-state',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-retirement-elite-single-premium-corridor')
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-retirement-elite-power-up-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-premium-holiday-and-reinstatement-payout-continuity')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-platinum-retirement-elite-reinstatement-and-payout-continuity')

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
          defaultState: 'target-income',
          suppressWhileLapsed: true,
          stateAfterReinstatement: 'target-income',
        },
      },
    })
    expect(variant.feeRules).toEqual([
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
    expect(variant.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0])
    expect(variant.unsupportedItems).not.toContain('Reinstatement and premium-holiday effects on payout continuity remain informational only.')
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
  }, 30_000)
})
