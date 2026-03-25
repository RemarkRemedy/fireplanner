import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthVoyage } from './hsbcWealthVoyage'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Voyage Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthVoyage', () => {
  it('builds a valid supported Wealth Voyage product with distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthVoyage({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-voyage')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-accidental-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-residual-death-benefit-after-ti-estimate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:premium-holiday-top-up-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-start-policy-month-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-amount-gate-block')
    expect(product.modeledEconomics).toContain('kernel:monthly-rate-bonus-crediting')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-voyage-terminal-illness-aggregate-cap-and-post-claim-state')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-voyage-terminal-illness-cap-overflow-and-post-claim-state')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-voyage-premium-holiday-backpay-amf-reconciliation')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-voyage-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-voyage-dividend-cash-payout-routing-fallback-and-execution')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-voyage-life-replacement-eligibility-and-underwriting')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-voyage-life-replacement-cover-reset-and-rider-termination')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-voyage-life-replacement-policy-reissue-fallback')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-voyage-life-replacement-option')
    expect(product.warnings.some((warning) => warning.includes('premium-holiday repayment AMF deduction with Power-up Bonus reinstatement'))).toBe(true)

    const sgdMip20 = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(sgdMip20).toBeDefined()
    expect(sgdMip20?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('paid in SGD irrespective of policy currency'),
        expect.stringContaining('published S$30 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 19,
          section: 'Distribution of Dividend',
        }),
      ],
    })

    const usdMip20 = product.variants.find((variant) => variant.id === 'usd-mip-20')
    expect(usdMip20).toBeDefined()
    expect(usdMip20?.distributionSupport).toEqual(
      expect.objectContaining({
        minimumAnnualPayoutAmount: 30,
        minimumAnnualPayoutCurrency: 'SGD',
      }),
    )
    expect(sgdMip20?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      allowedFrequencies: ['annual', 'semi-annual', 'quarterly', 'monthly'],
      minimumStartPolicyYear: 21,
      minimumAnnualWithdrawalAmount: 1_200,
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('Top-up Account first'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 16,
          section: 'Regular Withdrawal',
        }),
      ],
    })
    expect(usdMip20?.scheduledPayoutSupport?.allowedFrequencies).toEqual(['annual', 'semi-annual', 'quarterly'])
    expect(sgdMip20?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 5_000,
      topUpAmountIncrement: 10,
    })
    expect(usdMip20?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 5_000,
      topUpAmountIncrement: 10,
    })
    expect(sgdMip20?.warnings).toContain(
      'Life Replacement Option eligibility / underwriting, post-replacement cover resets, and policy-reissue fallback remain informational only in V1.',
    )
    expect(product.warnings.some((warning) => warning.includes('manual current net protected premium base support once regular-withdrawal assumptions are already active'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('manual current accidental-death regular-premium-floor support once regular-withdrawal assumptions are already active'))).toBe(true)
    expect(sgdMip20?.unsupportedItems).toContain(
      'The current accidental-death estimate also needs manual current age and current amount owing inputs and, once regular-withdrawal assumptions are already active, a manual current accidental-death regular-premium floor; age-75 cut-off handling is modeled, while claim exclusions, payout settlement, and post-claim state remain informational only.',
    )
    expect(sgdMip20?.unsupportedItems).toContain(
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap; payout settlement and post-claim state remain informational only.',
    )
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-start-gate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-minimum-annual-withdrawal-amount')
    expect(sgdMip20?.unsupportedItems).toContain(
      'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
    )
    expect(sgdMip20?.unsupportedItems).toContain(
      'Life Replacement Option rider termination, new suicide / incontestability / exclusion periods, and revised expiry-date administration remain informational only.',
    )
    expect(sgdMip20?.unsupportedItems).toContain(
      'Life Replacement Option policy-reissue fallback, non-identical replacement-policy terms, and post-replacement premium / term administration remain informational only.',
    )
    expect(sgdMip20?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'power-up-bonus-1',
        mode: 'monthly-rate',
        restorationRules: [
          {
            trigger: 'premium-holiday-repayment',
            basis: 'account-value-plus-repaid-premium-with-missed-months',
          },
        ],
        suspensionRules: [
          { trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 },
          { trigger: 'premium-holiday', suspensionMonths: 12, startOffsetMonths: 1 },
          { trigger: 'regular-premium-reduction', suspensionMonths: 12, startOffsetMonths: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'monthly-rate',
        suspensionRules: [
          { trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 },
          { trigger: 'scheduled-payout', suspensionMonths: 12, startOffsetMonths: 1 },
        ],
      }),
    ]))
    expect(sgdMip20?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'amf-during-mip',
          basis: 'premium-base-mip-multiplier',
        }),
        expect.objectContaining({
          id: 'amf-after-mip',
          basis: 'premium-base-mip-multiplier',
        }),
      ]),
    )
    expect(sgdMip20?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'missed-amf-on-premium-holiday-repayment',
          trigger: 'premium-holiday-repayment',
          basis: 'repaid-premium-with-missed-months',
          appliesTo: ['regular'],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
        }),
      ]),
    )
  }, 30_000)
})
