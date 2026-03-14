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
    pageCount: 8,
    totalCharacters: 1_900,
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
        characterCount: 300,
        text: 'Supplementary Charge and Premium Holiday Charge',
        lines: [
          { y: 700, text: 'Supplementary Charge which is equivalent to 3.60% p.a. of the Regular Premium Policy Value will be deducted for the first 7 policy years.' },
          { y: 680, text: 'Premium Holiday Charge = Premium Holiday Charge Annual Rate/12 x Annualised Regular Premium.' },
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
    ],
  }
}

describe('parseAiaPlatinumWealthVenture2', () => {
  it('builds a valid regular-pay partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumWealthVenture2({
      document,
      sourceChecksumSha256: '4444444444444444444444444444444444444444444444444444444444444444',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-wealth-venture-2')
    expect(product.productName).toBe('AIA Platinum Wealth Venture 2.0')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-wealth-venture-2-zero-regular-premium-charge',
      'branch:aia-platinum-wealth-venture-2-regular-supplementary-charge',
      'branch:aia-platinum-wealth-venture-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-venture-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-venture-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-venture-2-full-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-wealth-venture-2-welcome-bonus')
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-wealth-venture-2-performance-bonus')

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-mip-5',
      currency: 'SGD',
      mipLength: 5,
    })
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
    expect(variant.eecTable).toEqual([0.6, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0])
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
