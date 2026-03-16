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
  it('builds a valid payout-state supported product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseAiaEliteSecureIncomeSp({
      document,
      sourceChecksumSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-elite-secure-income-single-premium')
    expect(product.productName).toBe('AIA Elite Secure Income - Single Premium')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-elite-secure-income-sp-single-premium-charge',
      'branch:aia-elite-secure-income-sp-supplementary-charge-manual-input',
      'branch:aia-elite-secure-income-sp-top-up-premium-charge',
      'branch:aia-elite-secure-income-sp-full-surrender-charge',
      'branch:aia-elite-secure-income-sp-partial-withdrawal-charge',
      'kernel:scheduled-payout-manual-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-secure-monthly-income-election')
    expect(product.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-elite-secure-income-sp-single-premium-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('aia-elite-secure-income-sp-supplementary-charge')

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
        feeRate: null,
        subjectToEec: false,
      }),
    ])
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'fixed-annual',
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
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.124 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.111 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.099 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.087 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.075 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.064 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.053 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.042 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.031 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0 },
        ],
      }),
    ])
    expect(variant.warnings).toContain(
      'AIA Elite Secure Income - Single Premium is cataloged as a supported V1 product. The parser captures the published 5% single-premium charge, manual annual supplementary charge input, 3% top-up premium charge, full-surrender / partial-withdrawal charge schedules, and scheduled payout capability through the payout-state kernel.',
    )
    expect(variant.unsupportedItems).toContain(
      'Secure Monthly Income amount, payout age, and payout period selection remain manual-assumption inputs in V1.',
    )
    expect(variant.unsupportedItems).toContain('Single-premium principal tracking remains informational only in V1.')
    expect(variant.sourceRefs.find((ref) => ref.page === 7)?.excerpt).toContain(
      'Approximate excerpt; keyword "Reinstatement" not found on page.',
    )
    expect(variant.eecTable).toEqual([0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0])
    expect(variant.exitChargeBasis).toBe('account-value')
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
