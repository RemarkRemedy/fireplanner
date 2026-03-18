import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcLifeFlexiProtector } from './hsbcLifeFlexiProtector'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Flexi Protector Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcLifeFlexiProtector', () => {
  it('builds a valid supported HSBC Life Flexi Protector product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcLifeFlexiProtector({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-flexi-protector')
    expect(product.productName).toBe('HSBC Life Flexi Protector')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-regular-premium-charge')
    expect(product.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-additional-bonus-units')
    expect(product.modeledEconomics).toContain('branch:hsbc-flexi-choice-max-assurance')
    expect(product.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-administration-fee')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-tpd-payout-structure')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-premium-holiday-lapse-and-no-claim-state')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-reinstatement-and-backpay')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-gio-milestone-eligibility-and-health-conditions')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-gio-cross-policy-and-sum-assured-limits')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-life-replacement-eligibility-and-underwriting')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-life-replacement-cover-reset-and-beneficiary-reset')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-flexi-protector-premium-holiday-lapse-sequencing')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-flexi-protector-gio')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-flexi-protector-life-replacement-option')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-flexi-protector-dividend-payout-threshold')

    expect(product.variants).toHaveLength(2)

    const choiceVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-choice-cover')
    const maxVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-max-cover')

    expect(choiceVariant?.currency).toBe('SGD')
    expect(maxVariant?.currency).toBe('SGD')
    expect(choiceVariant?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'regular-premium-allocation-uplift',
          rate: 0.02,
          startPolicyYear: 5,
          endPolicyYear: null,
        }),
        expect.objectContaining({
          id: 'additional-bonus-units',
          startPolicyYear: 1,
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 0, maxAccountValue: 29_999, rate: 0 },
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 30_000, maxAccountValue: 99_999, rate: 0.001 },
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 100_000, maxAccountValue: 499_999, rate: 0.002 },
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 500_000, maxAccountValue: null, rate: 0.003 },
          ],
        }),
      ]),
    )
    expect(choiceVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'regular-premium-charge',
          basis: 'annual-contribution',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.6 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
            { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
          ],
        }),
        expect.objectContaining({
          id: 'administration-fee',
          basis: 'fixed-annual',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          basis: 'assurance-sum-at-risk',
          assuranceConfig: expect.objectContaining({
            formula: 'hsbc-flexi-choice-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(maxVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          basis: 'assurance-sum-at-risk',
          assuranceConfig: expect.objectContaining({
            formula: 'hsbc-flexi-max-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(choiceVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', rate: 0 }),
    ])
    expect(choiceVariant?.distributionSupport).toEqual(
      expect.objectContaining({
        minimumAnnualPayoutAmount: 30,
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
      }),
    )
    expect(maxVariant?.distributionSupport).toEqual(
      expect.objectContaining({
        minimumAnnualPayoutAmount: 30,
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
      }),
    )
    expect(choiceVariant?.eecTable).toEqual([])
  }, 30_000)
})
