import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPruVantageAssureSp } from './prudentialPruVantageAssureSp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure (SP) Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPruVantageAssureSp', () => {
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPruVantageAssureSp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-pruvantage-assure-sp')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('branch:assure-sp-combined-assurance')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('pruvantage-assure-sp-loyalty-bonus-every-8-years')
    expect(product.metadataOnlyBehaviors).toContain('pruvantage-assure-sp-first-withdrawal-free-up-to-10pct-single-premium')

    expect(product.variants).toHaveLength(1)
    expect(product.variants[0]).toMatchObject({
      id: 'sgd-mip-8',
      currency: 'SGD',
      mipLength: 8,
      icpMonths: 1,
    })
    expect(product.variants[0].feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administration-charge',
          basis: 'account-value',
          appliesTo: ['iia'],
          rate: 0.008,
          amount: null,
        }),
        expect.objectContaining({
          id: 'assurance-charge-combined',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          appliesTo: ['iia'],
          fallbackAppliesTo: ['aia'],
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
        }),
      ]),
    )
    expect(product.variants[0].eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['aia'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['iia'],
          rateSchedule: expect.arrayContaining([
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.12 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.105 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.09 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.075 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.06 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.045 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.03 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.015 },
          ]),
        }),
      ]),
    )
    expect(product.variants[0].eventChargeRules.find((rule) => rule.id === 'partial-withdrawal-charge')?.rateSchedule).toEqual([
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0.12 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.105 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.09 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.075 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.06 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.045 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.03 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.015 },
    ])
    expect(product.variants[0].distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['iia', 'aia'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Choosing dividend payout lowers the published Wealth Assure Value'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(product.variants[0].eecTable).toEqual([0.12, 0.105, 0.09, 0.075, 0.06, 0.045, 0.03, 0.015])
  }, 30_000)
})
