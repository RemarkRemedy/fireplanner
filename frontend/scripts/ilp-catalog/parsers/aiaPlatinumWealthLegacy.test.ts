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
        ],
      },
      {
        pageNumber: 6,
        characterCount: 320,
        text: 'Top-up premium and withdrawal',
        lines: [
          { y: 700, text: 'You may request to pay additional top-up premium on an ad hoc basis.' },
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
  it('builds a valid regular-pay partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumWealthLegacy({
      document,
      sourceChecksumSha256: '5555555555555555555555555555555555555555555555555555555555555555',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-wealth-legacy')
    expect(product.productName).toBe('AIA Platinum Wealth Legacy')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-wealth-legacy-regular-premium-charge',
      'branch:aia-platinum-wealth-legacy-top-up-premium-charge',
      'branch:aia-platinum-wealth-legacy-premium-holiday-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-wealth-legacy-partial-withdrawal-surrender-charge')

    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-mip-5',
      mipLength: 5,
      eecTable: [],
    })
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        yearBasis: 'premium-year',
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
      }),
    ])
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
    expect(product.variants[0]?.eecTable).toEqual([])
  }, 30_000)
})
