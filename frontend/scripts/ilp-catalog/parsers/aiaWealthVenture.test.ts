import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaWealthVenture } from './aiaWealthVenture'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_AWV_Jan2026.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_AWV_Jan2026.pdf',
    pageCount: 7,
    totalCharacters: 1_800,
    pages: [
      {
        pageNumber: 1,
        characterCount: 260,
        text: 'AIA Wealth Venture overview',
        lines: [
          { y: 700, text: 'AIA Wealth Venture' },
          { y: 680, text: 'AIA Wealth Venture is a limited premium investment-linked insurance policy with an 8 years premium term.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 260,
        text: 'Bonuses and maturity benefit',
        lines: [
          { y: 700, text: 'Investment Bonus is paid at the beginning of policy years 9 to 12.' },
          { y: 680, text: 'Performance Bonus is 0.30% p.a. of Regular Premium Policy Value.' },
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
        characterCount: 260,
        text: 'Supplementary Charge and Full Surrender Charge',
        lines: [
          { y: 700, text: 'Supplementary Charge is equivalent to 3.60% p.a. of Regular Premium Policy Value.' },
          { y: 680, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' },
          { y: 660, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Regular Premium Policy Value Withdrawn' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 260,
        text: 'Top-up and withdrawal effects',
        lines: [
          { y: 700, text: 'You may request to pay additional top-up premium on an ad-hoc or regular basis.' },
          { y: 680, text: 'Premium charge is 3% of the top-up premium.' },
          { y: 660, text: 'Premium charge is 3% of the top-up premium.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 200,
        text: 'Unused page',
        lines: [
          { y: 700, text: 'Fund switching and withdrawal effects.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 220,
        text: 'Premium holiday and reinstatement',
        lines: [
          { y: 700, text: 'your policy will remain on Premium Holiday until you resume payment of the full outstanding amount of regular premiums.' },
          { y: 680, text: 'For reinstatement, you are required to back-pay all outstanding past regular premiums that were due.' },
        ],
      },
    ],
  }
}

describe('parseAiaWealthVenture', () => {
  it('builds a valid regular-pay partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaWealthVenture({
      document,
      sourceChecksumSha256: '3333333333333333333333333333333333333333333333333333333333333333',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-wealth-venture')
    expect(product.productName).toBe('AIA Wealth Venture')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-wealth-venture-zero-regular-premium-charge',
      'branch:aia-wealth-venture-regular-supplementary-charge',
      'branch:aia-wealth-venture-top-up-premium-charge',
      'branch:aia-wealth-venture-premium-holiday-charge',
      'branch:aia-wealth-venture-partial-withdrawal-charge',
      'branch:aia-wealth-venture-full-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-wealth-venture-welcome-bonus')
    expect(product.metadataOnlyBehaviors).toContain('aia-wealth-venture-performance-bonus')

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-mip-8',
      currency: 'SGD',
      mipLength: 8,
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
        endPolicyYear: 10,
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
    expect(variant.eecTable).toEqual([0.7, 0.65, 0.6, 0.55, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0])
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaWealthVenture({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
