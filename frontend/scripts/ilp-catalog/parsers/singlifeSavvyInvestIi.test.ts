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
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-cost-of-insurance')
    expect(product.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift')
    expect(product.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-cost-of-insurance')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-terminal-illness-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-protection-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-dividend-cashout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-life-stage-benefit')
    expect(product.metadataOnlyBehaviors).toContain('singlife-savvy-invest-ii-life-stage-benefit-eligibility-and-limit-overrides')
    expect(product.warnings.some((warning) => warning.includes('current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('guaranteed cost-of-insurance formula after you enter insured-life details and current premium bases'))).toBe(true)
    expect(product.warnings).toContain(
      'Qualifying Life Stage Benefit withdrawals can be represented in V1 with event-level charge and loyalty-bonus-suspension waivers, while benefit timing, proof, use-count, and allowable partial-withdrawal limits from Appendix B remain informational only beyond the modeled current ordinary death and terminal-illness benefit amount. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
    )
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-flexible-and-other-mip-corridors')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-3-fixed',
      'sgd-mip-5-fixed',
      'sgd-mip-5-flexible',
      'sgd-mip-10-fixed',
      'sgd-mip-10-flexible',
      'sgd-mip-20-flexible',
    ])

    const fixedTenVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-fixed')
    expect(fixedTenVariant).toBeDefined()
    expect(fixedTenVariant?.bonuses).toEqual(
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
          notes: expect.arrayContaining([
            expect.stringContaining('bonusSuspensionWaived'),
          ]),
        }),
      ]),
    )
    expect(fixedTenVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cost-of-insurance',
          basis: 'assurance-sum-at-risk',
          assuranceConfig: expect.objectContaining({
            formula: 'singlife-savvy-invest-ii-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 120,
          }),
        }),
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
    expect(fixedTenVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-top-up-charge', rate: 0 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        yearBasis: 'policy-year',
        notes: expect.arrayContaining([
          expect.stringContaining('chargeWaived'),
        ]),
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
    expect(fixedTenVariant?.distributionSupport).toEqual({
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
    expect(fixedTenVariant?.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1])
    expect(fixedTenVariant?.unsupportedItems).toContain('The current-state terminal-illness benefit amount is modeled as an early payout of the current death-benefit estimate after manual current amount owing, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but pre-settlement claim admission, exclusions, and other post-claim policy effects remain informational only.')
    expect(fixedTenVariant?.unsupportedItems).toContain(
      'Life Stage Benefit timing windows, use-count limits, and Appendix B allowable partial-withdrawal-limit overrides remain informational only.',
    )

    const flexibleTwentyVariant = product.variants.find((variant) => variant.id === 'sgd-mip-20-flexible')
    expect(flexibleTwentyVariant).toBeDefined()
    expect(flexibleTwentyVariant?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 9_999.99, rate: 0.3 },
            { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.6 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-payments-1-10',
          startPolicyYear: 21,
          endPolicyYear: 30,
        }),
      ]),
    )
    expect(flexibleTwentyVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-top-up-charge', rate: 0 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.1 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.1 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.1 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.1 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.1 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.1 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.05 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.05 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.05 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.05 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.05 },
          { startPolicyYear: 16, endPolicyYear: 16, rate: 0.05 },
          { startPolicyYear: 17, endPolicyYear: 17, rate: 0.05 },
          { startPolicyYear: 18, endPolicyYear: 18, rate: 0.05 },
          { startPolicyYear: 19, endPolicyYear: 19, rate: 0.05 },
          { startPolicyYear: 20, endPolicyYear: 20, rate: 0.05 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.75 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.65 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.6 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.55 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.5 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.45 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.4 },
        ],
      }),
    ])
  }, 30_000)
})
