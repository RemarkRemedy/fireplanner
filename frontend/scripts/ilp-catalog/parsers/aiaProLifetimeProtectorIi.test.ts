import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaProLifetimeProtectorIi } from './aiaProLifetimeProtectorIi'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/WA_Sum_201106386R_PLP(II)_Oct2024.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/WA_Sum_201106386R_PLP(II)_Oct2024.pdf',
    pageCount: 7,
    totalCharacters: 1_700,
    pages: [
      {
        pageNumber: 1,
        characterCount: 250,
        text: 'Plan overview and death benefit options',
        lines: [
          { y: 720, text: 'AIA Pro Lifetime Protector (II) is a regular premium investment-linked policy.' },
          { y: 700, text: 'Depending on your level of priority for protection and wealth accumulation, you have the flexibility to choose between 2 different Death Benefit Options.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 230,
        text: 'Special Bonus and maturity',
        lines: [
          { y: 720, text: 'Special Bonus:' },
          { y: 700, text: 'additional 2% of regular premiums will be given as special bonus to your basic policy from 10th annual / 19th semi annual / 37th quarterly / 109th monthly regular premiums paid onwards.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 340,
        text: 'Regular premium, top-up, and charge schedules',
        lines: [
          { y: 740, text: 'Number of Full Regular Premiums paid to and accepted by us' },
          { y: 720, text: '1st annual premium charge 80%' },
          { y: 700, text: '2nd annual premium charge 55%' },
          { y: 680, text: '3rd annual premium charge 50%' },
          { y: 660, text: '4th annual premium charge 8%' },
          { y: 640, text: '5th & above annual premium charge 0%' },
          { y: 620, text: 'The Premium Charge deducted shall be an amount of 5% of each Top-Up Premium.' },
          { y: 600, text: 'A flat fee of S$5 is chargeable on a monthly basis.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 220,
        text: 'Policy flexibility and premium variation',
        lines: [
          { y: 720, text: 'Vary Regular Premium' },
          { y: 700, text: 'Increase in regular premium amount will be treated as new premium for the purposes of applying the appropriate Premium Charge.' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 260,
        text: 'Top-up, full surrender, and partial withdrawal',
        lines: [
          { y: 720, text: 'Premium charge is 5% of the top-up premium.' },
          { y: 700, text: 'Partial Withdrawal' },
          { y: 680, text: 'You may request to make a partial withdrawal from your policy value at any time after the end of the second policy year.' },
          { y: 660, text: 'The minimum withdrawal amount is S$1,000 and the policy value after withdrawal must be at least S$1,000.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 260,
        text: 'Premium holiday and no lapse privilege',
        lines: [
          { y: 720, text: 'No Lapse Privilege' },
          { y: 700, text: 'Within the first 10 years from the start of your policy, your policy will not lapse in a given policy month, even if the policy value is insufficient to pay for all applicable fees and charges.' },
          { y: 680, text: 'For Premium Holiday during first 2 policy years, a Premium Holiday Charge of S$50 will be charged on monthly basis.' },
        ],
      },
      {
        pageNumber: 12,
        characterCount: 140,
        text: 'Appendix A annual benefit charge schedule',
        lines: [
          { y: 720, text: 'APPENDIX A - Annual Benefit Charge Schedule for Death Benefit' },
          { y: 700, text: 'Current annual Benefit Charge per S$1,000 Sum-at-Risk for Death Benefit' },
        ],
      },
    ],
  }
}

describe('parseAiaProLifetimeProtectorIi', () => {
  it('builds a valid partial modeled-subset product from extracted summary text', () => {
    const product = parseAiaProLifetimeProtectorIi({
      document: makeSyntheticDocument(),
      sourceChecksumSha256: '3333333333333333333333333333333333333333333333333333333333333333',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-pro-lifetime-protector-ii')
    expect(product.productName).toBe('AIA Pro Lifetime Protector (II)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-pro-lifetime-protector-ii-regular-premium-charge',
      'branch:aia-pro-lifetime-protector-ii-special-bonus',
      'branch:aia-pro-lifetime-protector-ii-policy-fee',
      'branch:aia-pro-lifetime-protector-ii-top-up-premium-charge',
      'branch:aia-pro-lifetime-protector-ii-zero-partial-withdrawal-charge',
      'branch:aia-pro-lifetime-protector-ii-full-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-pro-lifetime-protector-ii-premium-holiday-charge-fixed-monthly')
    expect(product.metadataOnlyBehaviors).toContain('aia-pro-lifetime-protector-ii-benefit-charge-max-option')
    expect(product.metadataOnlyBehaviors).toContain('aia-pro-lifetime-protector-ii-no-lapse-privilege')

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-open-ended-regular-pay',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
    })
    expect(variant.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant.bonuses).toEqual([
      expect.objectContaining({
        id: 'special-bonus',
        mode: 'premium-allocation',
        yearBasis: 'premium-year',
        requiresPremiumsPaidUpToDate: true,
        rate: 0.02,
      }),
    ])
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.55 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.08 },
          { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        amountSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
        ],
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rate: 0,
      }),
    ])
    expect(variant.eecTable).toEqual([0.75, 0.5, 0])
    expect(variant.warnings).toContain(
      'AIA Pro Lifetime Protector (II) is cataloged as a partial modeled subset in V1. The parser captures the published premium-year regular premium charge schedule, the 2% Special Bonus from premium year 10 onward, the fixed S$5 monthly policy fee, the 5% top-up premium charge, the nil policy-level partial-withdrawal charge path, and the first-two-policy-years full-surrender charge schedule through the open-ended regular-premium basis.',
    )
    expect(variant.unsupportedItems).toContain(
      'The S$50 monthly premium-holiday charge in the first two policy years remains informational only because the current event kernel does not author fixed-per-month premium-holiday deductions.',
    )
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseAiaProLifetimeProtectorIi({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
    expect(product.variants[0]?.bonuses[0]?.id).toBe('special-bonus')
  }, 30_000)
})
