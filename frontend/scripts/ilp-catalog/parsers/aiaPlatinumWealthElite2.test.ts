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
          { y: 680, text: 'You may choose to pay your premium in single pay or regular pay for 5 years.' },
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
          { y: 700, text: 'You may request to pay additional top-up premium on an ad-hoc basis.' },
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
  it('builds a valid regular-pay partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaPlatinumWealthElite2({
      document,
      sourceChecksumSha256: '4444444444444444444444444444444444444444444444444444444444444444',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-platinum-wealth-elite-2')
    expect(product.productName).toBe('AIA Platinum Wealth Elite 2.0')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-platinum-wealth-elite-2-regular-premium-charge',
      'branch:aia-platinum-wealth-elite-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-elite-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-elite-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-elite-2-full-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-platinum-wealth-elite-2-no-lapse-privilege')

    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-mip-5',
      mipLength: 5,
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
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
      }),
    ])
    expect(variant.eecTable).toEqual([0.5, 0.4, 0.3, 0.2, 0.1, 0])
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
