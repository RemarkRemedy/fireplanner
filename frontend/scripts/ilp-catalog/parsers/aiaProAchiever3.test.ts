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
    pageCount: 7,
    totalCharacters: 2_200,
    pages: [
      { pageNumber: 1, characterCount: 260, text: 'AIA Pro Achiever 3.0 overview', lines: [{ y: 700, text: 'AIA Pro Achiever 3.0' }, { y: 680, text: 'AIA Pro Achiever 3.0 is a regular premium investment-linked insurance policy.' }] },
      { pageNumber: 2, characterCount: 220, text: 'Welcome and Special Bonus', lines: [{ y: 700, text: 'Special Bonus will be paid from the 10th annual premium onwards.' }] },
      { pageNumber: 5, characterCount: 320, text: 'Premium and top-up charges', lines: [{ y: 700, text: 'Premium charge for basic regular premium' }, { y: 680, text: '1st policy year 76.00% 2nd policy year 51.00% 3rd policy year 26.00% 4th to 6th policy years 4.00% 7th and subsequent policy years 0.00%' }, { y: 660, text: 'Premium Charge = 5% of each Top-Up Premium.' }] },
      { pageNumber: 8, characterCount: 260, text: 'Full surrender charge', lines: [{ y: 700, text: 'Full Surrender Charge = Full Surrender Charge Rate x Regular Premium Policy Value' }, { y: 680, text: 'IIP 10 100% 100% 80% 70% 60% 50% 45% 35% 20% 5% 0%' }] },
      { pageNumber: 10, characterCount: 260, text: 'Partial withdrawal charge', lines: [{ y: 700, text: 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Regular Premium Policy Value Withdrawn' }, { y: 680, text: 'IIP 10 4.000 2.333 1.500 1.000 0.818 0.539 0.250 0.053 0' }] },
      { pageNumber: 11, characterCount: 220, text: 'Top-up option', lines: [{ y: 700, text: 'Top-Up' }, { y: 680, text: 'Premium charge is 5% of the top-up premium.' }] },
      { pageNumber: 14, characterCount: 200, text: 'Premium Pass', lines: [{ y: 700, text: 'During the Premium Pass Period, Premium Holiday Charge and Supplementary Charge will not be applicable.' }] },
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
      'branch:aia-pro-achiever-3-regular-premium-charge',
      'branch:aia-pro-achiever-3-top-up-premium-charge',
      'branch:aia-pro-achiever-3-partial-withdrawal-charge',
      'branch:aia-pro-achiever-3-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-pro-achiever-3-benefit-charge')
    expect(product.metadataOnlyBehaviors).toContain('aia-pro-achiever-3-premium-pass')

    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-iip-10',
      currency: 'SGD',
      mipLength: 10,
    })
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        yearBasis: 'premium-year',
      }),
    ])
    expect(variant.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('only allowed after the end of the relevant IIP'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 17,
          section: 'Distribution of dividends',
        }),
      ],
    })
    expect(variant.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.2, 0.05, 0])
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
