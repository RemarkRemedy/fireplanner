import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaEliteSecureIncomeSp } from './aiaEliteSecureIncomeSp'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_ESISP_Jul2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_ESISP_Jul2025.pdf',
    pageCount: 7,
    totalCharacters: 1_200,
    pages: [
      {
        pageNumber: 1,
        characterCount: 200,
        text: 'Secure Monthly Income overview',
        lines: [
          { y: 700, text: 'AIA Elite Secure Income - Single Premium' },
          { y: 680, text: 'Secure Monthly Income can start from the selected payout age.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 200,
        text: 'Secure Monthly Income mechanics',
        lines: [
          { y: 700, text: 'Secure Monthly Income is paid by redeeming units from the policy account.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 200,
        text: 'Premium allocation',
        lines: [
          { y: 700, text: '100% of Single Premium less Premium Charge is used to buy units.' },
          { y: 680, text: 'Top-Up Premium less Premium Charge is also used to buy units.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 150,
        text: 'Charges',
        lines: [
          { y: 700, text: 'Premium Charge of 5% applies to the Single Premium.' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 150,
        text: 'Top-up charges',
        lines: [
          { y: 700, text: 'Top-Up Premium Charge is 3% of each ad hoc top-up.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 150,
        text: 'Withdrawals',
        lines: [
          { y: 700, text: 'Partial Withdrawals are allowed subject to policy terms.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 150,
        text: 'Reinstatement',
        lines: [
          { y: 700, text: 'Policy restoration may affect Secure Monthly Income continuity.' },
        ],
      },
    ],
  }
}

describe('parseAiaEliteSecureIncomeSp', () => {
  it('builds a valid payout-state partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaEliteSecureIncomeSp({
      document,
      sourceChecksumSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-elite-secure-income-single-premium')
    expect(product.productName).toBe('AIA Elite Secure Income - Single Premium')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-elite-secure-income-sp-top-up-premium-charge',
      'kernel:scheduled-payout-manual-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-secure-monthly-income-election')
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-single-premium-charge')
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-supplementary-charge')

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-open-ended-sp',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
      icpMonths: 1,
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
    })
    expect(variant.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0,
        subjectToEec: false,
      }),
    ])
    expect(variant.feeRules).toEqual([])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
    ])
    expect(variant.warnings).toContain(
      'AIA Elite Secure Income - Single Premium is cataloged as a partial modeled subset in V1. The parser captures the published 3% top-up premium charge and scheduled payout capability through the payout-state kernel, while the initial single-premium charge and payout amount remain manual or informational inputs.',
    )
    expect(variant.unsupportedItems).toContain(
      'Secure Monthly Income amount, payout age, and payout period selection remain manual-assumption inputs in V1.',
    )
    expect(variant.unsupportedItems).toContain(
      'The published 5% charge on the initial single premium remains informational only until V1 supports explicit single-premium seeding.',
    )
    expect(variant.unsupportedItems).toContain('Single-premium principal tracking remains informational only in V1.')
    expect(variant.sourceRefs.find((ref) => ref.page === 7)?.excerpt).toContain(
      'Approximate excerpt; keyword "Reinstatement" not found on page.',
    )
    expect(variant.eecTable).toEqual([])
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaEliteSecureIncomeSp({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
    expect(product.variants[0]?.scheduledPayoutSupport?.mode).toBe('manual-assumption')
  }, 30_000)
})
