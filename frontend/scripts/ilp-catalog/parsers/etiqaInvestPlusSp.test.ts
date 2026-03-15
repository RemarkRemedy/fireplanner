import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestPlusSp } from './etiqaInvestPlusSp'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/EIP_Invest plus SP_Summary.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/EIP_Invest plus SP_Summary.pdf',
    pageCount: 10,
    totalCharacters: 1_700,
    pages: [
      {
        pageNumber: 1,
        characterCount: 260,
        text: 'Invest plus SP overview',
        lines: [
          { y: 700, text: 'This is a single Premium Investment-linked insurance plan that offers the opportunity to optimize returns.' },
          { y: 680, text: 'Initial account value is the value of all the units under the Single premium, less any policy charge and representative management charge.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 240,
        text: 'Power-up bonus and maturity benefit',
        lines: [
          { y: 700, text: 'Power-up Bonus will be credited to Your policy for every three (3) years period.' },
          { y: 680, text: 'At the Maturity date you will receive a lump sum maturity benefit equivalent to the Account value.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 260,
        text: 'Surrender and partial withdrawal policy options',
        lines: [
          { y: 700, text: 'Partial Withdrawal is subject to partial withdrawal charge as set out at Fees and Charges section below.' },
          { y: 680, text: 'The withdrawal amount will be deducted from the initial account value of the single Premium after top-ups are exhausted.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 320,
        text: 'Distribution of Dividend',
        lines: [
          { y: 700, text: 'Distribution of Dividend' },
          { y: 680, text: 'If the ILP sub-fund that You have chosen pays dividends, You have the option to either reinvest or receive payments of these dividends.' },
          { y: 660, text: 'If You choose to receive dividends, We will distribute these dividends to You within thirty (30) days from the dividend declaration date, subject to the minimum amount of S$40.' },
          { y: 640, text: 'If the amount of dividend is less than S$40, We will reinvest that particular dividend(s) as additional units to Your ILP sub-fund on Your behalf.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 260,
        text: 'Initial single-premium subscription illustration',
        lines: [
          { y: 700, text: 'There is no fees and charges incurred for the purchase of the Portfolio fund / ILP sub-fund.' },
        ],
      },
      {
        pageNumber: 9,
        characterCount: 220,
        text: 'Top-up premium charge',
        lines: [
          { y: 700, text: 'Premium Charge on Top-up(s)' },
          { y: 680, text: 'A premium charge of 4.00% will be imposed for each single Premium top-up.' },
        ],
      },
      {
        pageNumber: 10,
        characterCount: 320,
        text: 'Policy charge and surrender charge tables',
        lines: [
          { y: 700, text: 'Policy Charge' },
          { y: 680, text: '1 2.30%' },
          { y: 660, text: '6 and above 1.00%' },
          { y: 640, text: 'Partial Withdrawal Charge (% Of The Amount Withdrawn)' },
          { y: 620, text: '1 7.00% 2 5.00% 3 4.00% 4 and above 0.00%' },
          { y: 600, text: 'Surrender Charge (% Of The Amount Withdrawn)' },
          { y: 580, text: '1 7.00% 2 5.00% 3 4.00% 4 2.60% 5 1.20% 6 and above 0.00%' },
          { y: 560, text: 'Representative Management Charge may vary up to a maximum of 0.75% per annum.' },
        ],
      },
    ],
  }
}

describe('parseEtiqaInvestPlusSp', () => {
  it('builds a valid initial-account partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseEtiqaInvestPlusSp({
      document,
      sourceChecksumSha256: '5555555555555555555555555555555555555555555555555555555555555555',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-plus-sp')
    expect(product.productName).toBe('Invest plus SP')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:etiqa-invest-plus-sp-zero-single-premium-charge',
      'branch:etiqa-invest-plus-sp-policy-charge',
      'branch:etiqa-invest-plus-sp-initial-partial-withdrawal-charge',
      'branch:etiqa-invest-plus-sp-initial-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('etiqa-invest-plus-sp-power-up-bonus')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-invest-plus-sp-representative-management-charge')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-invest-plus-sp-dividend-threshold-and-withdrawal-consequences')

    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-open-ended-single-premium-initial-only',
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
        id: 'policy-charge',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 5, rate: 0.023 },
          { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
        ],
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
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
        expect.stringContaining('cash payout requires a manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant.eecTable).toEqual([0.07, 0.05, 0.04, 0.026, 0.012, 0])
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseEtiqaInvestPlusSp({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
