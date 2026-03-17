import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseSinglifeLegacyInvest } from './singlifeLegacyInvest'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/SinglifeLegacyInvest_PS_Dec25.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseSinglifeLegacyInvest', () => {
  it('builds a valid supported Singlife Legacy Invest product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseSinglifeLegacyInvest({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('singlife-legacy-invest')
    expect(product.productName).toBe('Singlife Legacy Invest')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:singlife-legacy-invest-welcome-bonus')
    expect(product.modeledEconomics).toContain('branch:singlife-legacy-invest-premium-shortfall-charge')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-dividend-cashout-threshold')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10-term-15')
    expect(variant?.accounts.map((account) => account.id)).toEqual(['policy'])
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: 29_999.99, rate: 0.1 },
          { currency: 'SGD', minAnnualPremium: 30_000, maxAnnualPremium: null, rate: 0.12 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        rate: 0.003,
        startPolicyYear: 11,
        endPolicyYear: 14,
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.03 },
        ],
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-top-up-charge', rate: 0.03 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        yearBasis: 'policy-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.2 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        basis: 'annual-premium-with-overlap-months',
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
    ])
    expect(variant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('annually, semi-annually, quarterly, or monthly'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 11,
          section: 'Regular Withdrawal',
        }),
      ],
    })
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('published $40 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 12,
          section: 'Dividend Distribution Option',
        }),
      ],
    })
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2])
  }, 30_000)
})
