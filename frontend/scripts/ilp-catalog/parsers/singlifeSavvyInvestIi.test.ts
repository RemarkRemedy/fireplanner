import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseSinglifeSavvyInvestIi } from './singlifeSavvyInvestIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/SinglifeSavvyInvestII_PS_Dec25.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseSinglifeSavvyInvestIi', () => {
  it('builds a valid supported Singlife Savvy Invest II product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseSinglifeSavvyInvestIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('singlife-savvy-invest-ii')
    expect(product.productName).toBe('Singlife Savvy Invest II')
    expect(product.supportStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift')
    expect(product.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-dividend-cashout-threshold')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10-fixed')
    expect(variant?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_999.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.4 },
          ],
        }),
        expect.objectContaining({
          id: 'regular-premium-allocation-uplift-policy-years-11-20',
          rate: 0.02,
          startPolicyYear: 11,
          endPolicyYear: 20,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-payments-21-plus',
          rate: 0.005,
          startPolicyYear: 31,
          endPolicyYear: null,
        }),
      ]),
    )
    expect(variant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administrative-charge',
          basis: 'account-value',
          rate: 0.006,
          activeWindow: 'policy-term',
        }),
        expect.objectContaining({
          id: 'supplementary-charge',
          basis: 'account-value',
          rate: 0.019,
          startPolicyYear: 1,
          endPolicyYear: 10,
        }),
      ]),
    )
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-top-up-charge', rate: 0 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        yearBasis: 'policy-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        basis: 'annual-premium-with-overlap-months',
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('published S$40 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 12,
          section: 'Distribution of Dividends',
        }),
        expect.objectContaining({
          page: 13,
          section: 'Dividend cash-out threshold',
        }),
      ],
    })
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1])
  }, 30_000)
})
