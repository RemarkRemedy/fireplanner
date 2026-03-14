import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaEliteSecureIncomeSp } from './aiaEliteSecureIncomeSp'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_ESISP_Jul2025.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseAiaEliteSecureIncomeSp', () => {
  it.skipIf(!existsSync(SOURCE_PATH))('builds a valid payout-state partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseAiaEliteSecureIncomeSp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-elite-secure-income-single-premium')
    expect(product.productName).toBe('AIA Elite Secure Income - Single Premium')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-elite-secure-income-sp-single-premium-charge',
      'branch:aia-elite-secure-income-sp-top-up-premium-charge',
      'kernel:scheduled-payout-manual-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-secure-monthly-income-election')
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
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0.05,
        appliesTo: ['policy'],
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
    ])
    expect(variant.warnings).toContain(
      'AIA Elite Secure Income - Single Premium is cataloged as a partial modeled subset in V1. The parser captures the published 5% single-premium charge, 3% top-up premium charge, and scheduled payout capability through the payout-state kernel, while the payout amount remains a manual assumption.',
    )
    expect(variant.unsupportedItems).toContain(
      'Secure Monthly Income amount, payout age, and payout period selection remain manual-assumption inputs in V1.',
    )
    expect(variant.unsupportedItems).toContain('Single-premium principal tracking remains informational only in V1.')
    expect(variant.eecTable).toEqual([])
  }, 30_000)
})
