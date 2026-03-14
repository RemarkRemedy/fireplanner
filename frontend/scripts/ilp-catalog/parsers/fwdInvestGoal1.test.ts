import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestGoal1 } from './fwdInvestGoal1'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_200501737H_ILP01_SP_May2023.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_200501737H_ILP01_SP_May2023.pdf',
    pageCount: 10,
    totalCharacters: 2_100,
    pages: [
      {
        pageNumber: 1,
        characterCount: 350,
        text: 'FWD Invest Goal 1 overview',
        lines: [
          { y: 700, text: 'Product name FWD Invest Goal 1' },
          { y: 680, text: 'FWD Invest Goal 1 is a non-participating single premium investment-linked insurance policy.' },
          { y: 660, text: 'Death benefit We pay 105% of policy value upon death of the person insured.' },
          { y: 640, text: 'Single premium paid will be used to purchase units which will be allocated to the initial units account.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 420,
        text: 'Initial account charge and plan charge',
        lines: [
          { y: 700, text: 'Initial account charge is payable throughout the policy term and will be deducted on each policy monthiversary.' },
          { y: 680, text: 'The initial account charge = (1% p.a. / 12 months) x number of units in the initial units account as of each policy monthiversary.' },
          { y: 660, text: 'Plan charge = (1.4% p.a. x single premium committed at effective date) / 12 months.' },
          { y: 640, text: 'The policy will be terminated if there is insufficient policy value to deduct the charges due.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 280,
        text: 'Surrender charge and switching fee',
        lines: [
          { y: 700, text: 'Surrender charge will be levied prior to the 6th policy year based on the single premium paid on the effective date.' },
          { y: 680, text: 'Switching fee We kept this charge at zero but may review this in future.' },
          { y: 660, text: 'Fund management fee is taken into consideration when the unit price is calculated.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 360,
        text: 'Withdrawal options',
        lines: [
          { y: 700, text: 'Withdrawal options' },
          { y: 680, text: 'You can withdraw part of your policy value at any time while the policy is still in force.' },
          { y: 660, text: 'Initial units account Allowed subject to minimum account value rules as below.' },
          { y: 640, text: 'Initial units account value 10% of single premium committed at effective date.' },
          { y: 620, text: 'The minimum amount to be withdrawn is SGD 500/ USD 375 per transaction.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 340,
        text: 'Subscription and redemption of units',
        lines: [
          { y: 700, text: 'Illustration of units allocation' },
          { y: 680, text: 'Premium charge 0%' },
          { y: 660, text: 'Premium allocated $1,000' },
          { y: 640, text: 'Redemption of units You will need to tell us which ILP sub-funds you want to withdraw from.' },
        ],
      },
    ],
  }
}

describe('parseFwdInvestGoal1', () => {
  it('builds a valid partial modeled-subset product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseFwdInvestGoal1({
      document,
      sourceChecksumSha256: '9999999999999999999999999999999999999999999999999999999999999999',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-goal-1')
    expect(product.productName).toBe('FWD Invest Goal 1')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:fwd-invest-goal-1-zero-single-premium-charge',
      'branch:fwd-invest-goal-1-initial-account-charge',
      'branch:fwd-invest-goal-1-zero-partial-withdrawal-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-goal-1-plan-charge-single-premium-base')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-goal-1-surrender-charge-single-premium-base')

    expect(product.variants).toHaveLength(2)
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended', 'usd-open-ended'])
    expect(product.variants[0]).toMatchObject({
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
    })
    expect(product.variants[1]).toMatchObject({
      currency: 'USD',
      mipBasis: 'open-ended',
      mipLength: null,
    })
    expect(product.variants[0].feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        rate: 0.01,
      }),
    ])
    expect(product.variants[0].eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseFwdInvestGoal1({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
