import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaDashPetPlus } from './etiqaDashPetPlus'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/EIP_Dash PET Plus_Summary.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/EIP_Dash PET Plus_Summary.pdf',
    pageCount: 9,
    totalCharacters: 1_700,
    pages: [
      {
        pageNumber: 1,
        characterCount: 260,
        text: 'Dash PET Plus overview',
        lines: [
          { y: 700, text: 'This is a yearly renewable, optional single Premium investment-linked insurance rider.' },
          { y: 680, text: 'Upon death of the Life insured while the rider is in force, the death Benefit payable is the higher of the Rider account value or 105% of premiums less withdrawals.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 260,
        text: 'Partial withdrawal and surrender options',
        lines: [
          { y: 700, text: 'Partial Withdrawal' },
          { y: 680, text: 'Partial withdrawal(s) will reduce the Rider account value by the withdrawn amount.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 220,
        text: 'Yearly renewability and maturity',
        lines: [
          { y: 700, text: 'Yearly Renewability' },
          { y: 680, text: 'Maturity Benefit is equivalent to the Rider account value.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 240,
        text: 'Premium allocation and rider account value',
        lines: [
          { y: 700, text: '100% of the single Premium paid and 100% of the Top-up(s) for this rider will be invested into Your selected Portfolio fund.' },
          { y: 680, text: 'The minimum Rider account value is S$100.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 240,
        text: 'Zero-charge subscription and redemption illustration',
        lines: [
          { y: 700, text: 'There is no fees and charges incurred for the purchase of the Portfolio fund.' },
          { y: 680, text: 'There is no fees & charges incurred upon the withdrawal of the Portfolio fund.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 380,
        text: 'Management charge, fund management fee, and distribution of dividend',
        lines: [
          { y: 700, text: 'Management Charge' },
          { y: 680, text: 'We will deduct a management charge of 0.75% per annum of the Rider account value.' },
          { y: 660, text: 'Insurance Charge There is no insurance charge imposed on Your rider.' },
          { y: 640, text: 'Distribution of Dividend' },
          { y: 620, text: 'If the Portfolio fund pays dividends, You have the option to either reinvest these dividends or to receive payments of these dividends.' },
          { y: 600, text: 'If You choose to receive dividends, We will distribute these dividends to You within thirty (30) days from the dividend declaration date to Your Basic policy.' },
        ],
      },
      {
        pageNumber: 8,
        characterCount: 260,
        text: 'Top-up and fund switching',
        lines: [
          { y: 700, text: 'Top-up (Ad-hoc / Recurring)' },
          { y: 680, text: 'Top-up of Portfolio fund will be processed according to the respective ILP sub-funds allocation.' },
          { y: 660, text: 'Currently, We do not impose any charge for fund switching.' },
        ],
      },
      {
        pageNumber: 9,
        characterCount: 220,
        text: 'Free look and grace period',
        lines: [
          { y: 700, text: 'Grace Period' },
          { y: 680, text: 'Your rider will be surrendered if the required Top-up(s) to keep the rider in force is not paid by the expiry date of the grace period.' },
        ],
      },
    ],
  }
}

describe('parseEtiqaDashPetPlus', () => {
  it('builds a valid rider partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseEtiqaDashPetPlus({
      document,
      sourceChecksumSha256: '6666666666666666666666666666666666666666666666666666666666666666',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-dash-pet-plus')
    expect(product.productName).toBe('Dash PET Plus')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:etiqa-dash-pet-plus-zero-single-premium-charge',
      'branch:etiqa-dash-pet-plus-management-charge',
      'branch:etiqa-dash-pet-plus-zero-top-up-charge',
      'branch:etiqa-dash-pet-plus-zero-partial-withdrawal-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('etiqa-dash-pet-plus-yearly-renewability')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-dash-pet-plus-paynow-transfer-charge')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-dash-pet-plus-dividend-crediting-to-basic-policy')

    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-open-ended-rider',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
    })
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'management-charge',
        basis: 'account-value',
        rate: 0.0075,
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(variant.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('credited into the linked Basic policy'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant.eecTable).toEqual([])
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseEtiqaDashPetPlus({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
