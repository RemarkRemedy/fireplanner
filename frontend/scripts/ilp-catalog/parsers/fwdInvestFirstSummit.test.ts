import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstSummit } from './fwdInvestFirstSummit'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD_Invest First Summit_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstSummit', () => {
  it('builds the 10-year to 30-year premium-payment-term family from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstSummit({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-summit')
    expect(product.productName).toBe('FWD Invest First Summit')
    expect(product.supportStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:fwd-invest-first-summit-initial-account-charge',
      'branch:fwd-invest-first-summit-accumulation-account-charge',
      'branch:fwd-invest-first-summit-top-up-premium-charge',
      'branch:fwd-invest-first-summit-premium-shortfall-charge',
      'branch:fwd-invest-first-summit-premium-reduction-charge',
      'branch:fwd-invest-first-summit-zero-redemption-fee',
      'branch:fwd-invest-first-summit-booster-bonus',
      'branch:fwd-invest-first-summit-loyalty-bonus',
      'branch:fwd-invest-first-summit-perpetual-bonus',
      'branch:fwd-invest-first-summit-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-perpetual-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-loyalty-bonus')

    const variantIds = product.variants.map((variant) => variant.id)
    expect(variantIds).toEqual([
      'sgd-mip-10',
      'sgd-mip-11',
      'sgd-mip-12',
      'sgd-mip-13',
      'sgd-mip-14',
      'sgd-mip-15',
      'sgd-mip-16',
      'sgd-mip-17',
      'sgd-mip-18',
      'sgd-mip-19',
      'sgd-mip-20',
      'sgd-mip-21',
      'sgd-mip-22',
      'sgd-mip-23',
      'sgd-mip-24',
      'sgd-mip-25',
      'sgd-mip-26',
      'sgd-mip-27',
      'sgd-mip-28',
      'sgd-mip-29',
      'sgd-mip-30',
    ])

    const variantById = (variantId: string) => {
      const variant = product.variants.find((entry) => entry.id === variantId)
      expect(variant, `Missing variant ${variantId}`).toBeDefined()
      return variant!
    }

    const term10 = variantById('sgd-mip-10')
    expect(term10.mipLength).toBe(10)
    expect(term10.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      minimumTopUpStartPolicyMonth: 13,
    })
    expect(term10.bonuses).toEqual([
      expect.objectContaining({
        id: 'booster-bonus',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.02 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.07 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.09 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.12 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.15 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        startPolicyYear: 4,
        endPolicyYear: 10,
        rate: 0.006,
        policyYearRateSchedule: undefined,
      }),
      expect.objectContaining({
        id: 'perpetual-bonus',
        startPolicyYear: 11,
        rate: 0.01,
      }),
    ])
    expect(term10.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        rate: 0.0395,
      }),
      expect.objectContaining({
        id: 'accumulation-account-charge',
        basis: 'premium-base-mip-multiplier-capped-account-value',
        rate: 0.015,
        premiumBaseConfig: expect.objectContaining({
          capRate: 0.007,
          multiplierYearBasis: 'policy-year',
          useHigherOfCommencementAndPrevailing: true,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
          ],
        }),
      }),
    ])
    expect(term10.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        rate: 0.09,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-refund',
        trigger: 'premium-holiday',
        basis: 'source-event-charge-refund',
        appliesTo: ['accumulation'],
        sourceChargeRuleId: 'premium-shortfall-charge',
        rate: 1,
      }),
      expect.objectContaining({
        id: 'premium-reduction-charge',
        trigger: 'regular-premium-reduction',
        basis: 'annual-reduction-with-active-months',
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 4, rate: 0.09 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-reduction-charge-refund',
        trigger: 'regular-premium-reduction',
        basis: 'source-event-charge-refund',
        appliesTo: ['accumulation'],
        sourceChargeRuleId: 'premium-reduction-charge',
        rate: 1,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(term10.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09])

    const term11 = variantById('sgd-mip-11')
    expect(term11.bonuses[0]).toEqual(expect.objectContaining({
      id: 'booster-bonus',
      tieredRates: [
        { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.02 },
        { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.07 },
        { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.09 },
        { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.12 },
        { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.15 },
      ],
    }))
    expect(term11.bonuses[1]).toEqual(expect.objectContaining({
      id: 'loyalty-bonus',
      startPolicyYear: 4,
      endPolicyYear: 11,
      rate: 0,
      policyYearRateSchedule: [
        { startPolicyYear: 4, endPolicyYear: 10, rate: 0.006 },
        { startPolicyYear: 11, endPolicyYear: 11, rate: 0.015 },
      ],
    }))
    expect(term11.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.83, 0.69, 0.55, 0.38, 0.24, 0.09])

    const term15 = variantById('sgd-mip-15')
    expect(term15.bonuses[0]).toEqual(expect.objectContaining({
      id: 'booster-bonus',
      tieredRates: [
        { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.05 },
        { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.10 },
        { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.15 },
        { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.20 },
        { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.23 },
      ],
    }))
    expect(term15.bonuses[1]).toEqual(expect.objectContaining({
      id: 'loyalty-bonus',
      endPolicyYear: 15,
      policyYearRateSchedule: [
        { startPolicyYear: 4, endPolicyYear: 10, rate: 0.006 },
        { startPolicyYear: 11, endPolicyYear: 15, rate: 0.015 },
      ],
    }))
    expect(term15.feeRules[1]).toEqual(expect.objectContaining({
      id: 'accumulation-account-charge',
      premiumBaseConfig: expect.objectContaining({
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 15 },
        ],
      }),
    }))
    expect(term15.eventChargeRules[3]).toEqual(expect.objectContaining({
      id: 'premium-reduction-charge',
      rateSchedule: [
        { startPolicyYear: 3, endPolicyYear: 4, rate: 0.09 },
      ],
    }))
    expect(term15.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.91, 0.84, 0.76, 0.68, 0.6, 0.47, 0.4, 0.31, 0.24, 0.15])

    const term16 = variantById('sgd-mip-16')
    expect(term16.eventChargeRules[3]).toEqual(expect.objectContaining({
      id: 'premium-reduction-charge',
      rateSchedule: [
        { startPolicyYear: 3, endPolicyYear: 6, rate: 0.09 },
      ],
    }))
    expect(term16.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.92, 0.86, 0.79, 0.72, 0.65, 0.52, 0.44, 0.36, 0.29, 0.2, 0.15])

    const term25 = variantById('sgd-mip-25')
    expect(term25.bonuses[0]).toEqual(expect.objectContaining({
      id: 'booster-bonus',
      tieredRates: [
        { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.25 },
        { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.30 },
        { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.40 },
        { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.42 },
        { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.45 },
      ],
    }))
    expect(term25.eventChargeRules[3]).toEqual(expect.objectContaining({
      id: 'premium-reduction-charge',
      rateSchedule: [
        { startPolicyYear: 3, endPolicyYear: 8, rate: 0.09 },
      ],
    }))
    expect(term25.eecTable).toEqual([
      1, 1, 0.99, 0.99, 0.99, 0.98, 0.96, 0.94, 0.92, 0.9,
      0.85, 0.82, 0.8, 0.78, 0.65, 0.57, 0.52, 0.48, 0.44, 0.32,
      0.24, 0.19, 0.18, 0.16, 0.15,
    ])

    const term30 = variantById('sgd-mip-30')
    expect(term30.bonuses[0]).toEqual(expect.objectContaining({
      id: 'booster-bonus',
      tieredRates: [
        { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.30 },
        { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.40 },
        { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.50 },
        { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.52 },
        { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.55 },
      ],
    }))
    expect(term30.bonuses[1]).toEqual(expect.objectContaining({
      id: 'loyalty-bonus',
      endPolicyYear: 30,
      policyYearRateSchedule: [
        { startPolicyYear: 4, endPolicyYear: 10, rate: 0.006 },
        { startPolicyYear: 11, endPolicyYear: 30, rate: 0.015 },
      ],
    }))
    expect(term30.bonuses[2]).toEqual(expect.objectContaining({
      id: 'perpetual-bonus',
      startPolicyYear: 31,
      rate: 0.01,
    }))
    expect(term30.feeRules[1]).toEqual(expect.objectContaining({
      id: 'accumulation-account-charge',
      premiumBaseConfig: expect.objectContaining({
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 30 },
        ],
      }),
    }))
    expect(term30.eecTable).toEqual([
      1, 1, 0.99, 0.99, 0.99, 0.99, 0.98, 0.97, 0.96, 0.95,
      0.91, 0.9, 0.88, 0.87, 0.78, 0.73, 0.69, 0.67, 0.63, 0.54,
      0.48, 0.46, 0.45, 0.44, 0.43, 0.42, 0.39, 0.31, 0.24, 0.15,
    ])
  }, 30_000)
})
