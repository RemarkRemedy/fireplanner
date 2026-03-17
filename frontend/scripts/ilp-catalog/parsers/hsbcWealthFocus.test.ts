import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthFocus } from './hsbcWealthFocus'

const CASES = [
  {
    sourcePath: '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi1.pdf',
    productId: 'hsbc-life-wealth-focus-flexi-1',
    productName: 'Wealth Focus (Flexi 1)',
    startupTiers: [
      { currency: 'SGD', minAnnualPremium: 25_000, maxAnnualPremium: 49_999.99, rate: 0.05 },
      { currency: 'SGD', minAnnualPremium: 50_000, maxAnnualPremium: null, rate: 0.1 },
    ],
    loyaltyRate: 0.007,
    freeWithdrawalRate: 0.3,
    hasHolidayCharge: false,
    eecTable: [0.3, 0.23, 0.19, 0.16, 0.13, 0.1, 0.08, 0.06, 0.04, 0.03],
  },
  {
    sourcePath: '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi3.pdf',
    productId: 'hsbc-life-wealth-focus-flexi-3',
    productName: 'Wealth Focus (Flexi 3)',
    startupTiers: [
      { currency: 'SGD', minAnnualPremium: 9_000, maxAnnualPremium: 17_999.99, rate: 0.06 },
      { currency: 'SGD', minAnnualPremium: 18_000, maxAnnualPremium: null, rate: 0.12 },
    ],
    loyaltyRate: 0.001,
    freeWithdrawalRate: 0.2,
    hasHolidayCharge: true,
    holidaySchedule: [
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
    ],
    eecTable: [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
  },
  {
    sourcePath: '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi5.pdf',
    productId: 'hsbc-life-wealth-focus-flexi-5',
    productName: 'Wealth Focus (Flexi 5)',
    startupTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.15 },
    ],
    loyaltyRate: 0.0035,
    freeWithdrawalRate: 0.2,
    hasHolidayCharge: true,
    holidaySchedule: [
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.65 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
    ],
    eecTable: [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
  },
] as const

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthFocus', () => {
  for (const testCase of CASES) {
    it(`builds a valid supported product for ${testCase.productName}`, async () => {
      const document = await extractPdfText(testCase.sourcePath)
      const product = parseHsbcWealthFocus({
        document,
        sourceChecksumSha256: await sha256(testCase.sourcePath),
      })

      expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
      expect(product.id).toBe(testCase.productId)
      expect(product.productName).toBe(testCase.productName)
      expect(product.supportStatus).toBe('supported')
      expect(product.economicsStatus).toBe('supported')
      expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
      expect(product.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
      expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
      expect(product.modeledEconomics).toContain('kernel:cumulative-free-partial-withdrawal-pool')
      expect(product.metadataOnlyBehaviors).not.toContain('wealth-focus-free-partial-withdrawal-benefit')
      expect(product.metadataOnlyBehaviors).not.toContain('wealth-focus-regular-withdrawal-facility')
      expect(product.metadataOnlyBehaviors).not.toContain('wealth-focus-death-and-ti-benefits')
      expect(product.metadataOnlyBehaviors).toContain('wealth-focus-accidental-death-and-ti-claim-adjustments')
      expect(product.metadataOnlyBehaviors).toContain('wealth-focus-claim-side-benefit-settlement')
      expect(product.metadataOnlyBehaviors).not.toContain('wealth-focus-benefit-payout-handling')
      expect(product.variants).toHaveLength(2)
      expect(product.warnings.some((warning) => warning.includes('current-state death-benefit estimate'))).toBe(true)

      const sgdVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
      expect(sgdVariant).toBeDefined()
      expect(sgdVariant?.accounts).toEqual([
        expect.objectContaining({
          id: 'regular',
          contributionRules: [
            { phase: 'during-icp', targetAccountId: 'regular', contributionShare: 1 },
            { phase: 'after-icp', targetAccountId: 'regular', contributionShare: 1 },
          ],
        }),
        expect.objectContaining({
          id: 'topup',
          contributionRules: [
            { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
          ],
        }),
      ])
      expect(sgdVariant?.feeRules).toEqual([
        expect.objectContaining({
          id: 'amf',
          basis: 'premium-base-mip-multiplier',
          yearBasis: 'policy-year',
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: Number(testCase.productId.slice(-1)), mode: 'policy-year' },
              { startPolicyYear: Number(testCase.productId.slice(-1)) + 1, endPolicyYear: null, mode: 'fixed', multiplier: Number(testCase.productId.slice(-1)) },
            ],
          },
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.01 },
          ],
        }),
      ])
      expect(sgdVariant?.bonuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'startup-bonus',
            mode: 'premium-allocation',
            tieredRates: testCase.startupTiers,
          }),
          expect.objectContaining({
            id: 'premium-contribution-bonus',
            rate: 0.01,
            startPolicyYear: 2,
            endPolicyYear: 10,
          }),
          expect.objectContaining({
            id: 'loyalty-bonus',
            rate: testCase.loyaltyRate,
            startPolicyYear: 11,
          }),
        ]),
      )
      expect(sgdVariant?.eecTable).toEqual(testCase.eecTable)
      expect(sgdVariant?.distributionSupport).toEqual({
        mode: 'manual-assumption',
        accountIds: ['regular', 'topup'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
        notes: expect.arrayContaining([
          expect.stringContaining('reinvestment as the default'),
        ]),
        sourceRefs: [
          expect.objectContaining({
            page: 18,
            section: 'Distribution of Dividend',
          }),
        ],
      })
      expect(sgdVariant?.scheduledPayoutSupport).toEqual({
        mode: 'manual-assumption',
        accountId: 'topup',
        fallbackAccountIds: ['regular'],
        source: 'policy-redemption',
        notes: expect.arrayContaining([
          expect.stringContaining('Top-up Account first'),
        ]),
        sourceRefs: [
          expect.objectContaining({
            page: 15,
            section: 'Regular Withdrawal',
          }),
        ],
      })

      expect(sgdVariant?.eventChargeRules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'top-up-premium-charge',
            trigger: 'top-up',
            basis: 'event-amount',
            rate: 0.03,
            appliesTo: ['topup'],
          }),
          expect.objectContaining({
            id: 'partial-withdrawal-charge',
            trigger: 'partial-withdrawal',
            basis: 'event-amount',
            appliesTo: ['regular'],
            freeEventStartPolicyYear: 6,
            freeAmountPoolRate: testCase.freeWithdrawalRate,
            freeAmountPoolBasis: 'open-balance-at-start-policy-year',
            freeAmountPoolReferencePolicyYear: 6,
            rateSchedule: testCase.eecTable.map((rate, index) => ({
              startPolicyYear: index + 1,
              endPolicyYear: index + 1,
              rate,
            })),
          }),
        ]),
      )
      expect(sgdVariant?.warnings).toContain(
        'Wealth Focus is modeled as a supported V1 product. The parser captures Start-up Bonus, Premium Contribution Bonus, Loyalty Bonus, AMF, top-up premium charge, premium-holiday charge where applicable, partial-withdrawal charge, the current-state death-benefit estimate from regular-premium-paid history and current account balances, manual top-up-first scheduled payout support for Regular Withdrawal, MIP-end surrender charges, and the reinvest-default distribution-mode assumption surface.',
      )
      expect(sgdVariant?.unsupportedItems).toContain(
        'Accidental Death uplift, Terminal Illness aggregate-cap and post-claim reduction mechanics, and claim-side payout settlement remain informational only beyond the current death-benefit estimate.',
      )

      const holidayCharge = sgdVariant?.eventChargeRules.find((rule) => rule.id === 'premium-holiday-charge')
      if (testCase.hasHolidayCharge) {
        expect(holidayCharge).toEqual(
          expect.objectContaining({
            trigger: 'premium-holiday',
            basis: 'annual-premium-with-overlap-months',
            rateSchedule: testCase.holidaySchedule,
          }),
        )
      } else {
        expect(holidayCharge).toBeUndefined()
      }
    }, 30_000)
  }
})
