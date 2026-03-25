import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthAbundance } from './hsbcWealthAbundance'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Abundance Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthAbundance', () => {
  it('builds valid supported variants with reinvest-default distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthAbundance({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-abundance')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-abundance-free-withdrawal',
      'branch:hsbc-abundance-tiered-brc',
      'branch:hsbc-abundance-topup-charge',
      'branch:hsbc-abundance-power-up-restoration',
      'kernel:monthly-rate-bonus-crediting',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-start-gate',
      'kernel:scheduled-payout-minimum-annual-withdrawal-amount',
      'kernel:scheduled-payout-frequency-eligibility-gate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-abundance-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-abundance-terminal-illness-aggregate-cap-and-post-claim-state')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-terminal-illness-cap-overflow-and-post-claim-state')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-dividend-cash-payout-routing-fallback-and-execution')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-abundance-dividend-bank-routing')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-abundance-regular-withdrawal-facility')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-life-replacement-eligibility-and-underwriting')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-life-replacement-cover-reset-and-rider-termination')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-life-replacement-policy-reissue-fallback')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-abundance-life-replacement-option')

    const sgdVariant = product.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(sgdVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash'),
        expect.stringContaining('Cash payout applies to both the Regular Premium Account and the Top-up Account'),
        expect.stringContaining('paid in SGD irrespective of policy currency'),
        expect.stringContaining('published S$30 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 16,
          section: 'Dividend distribution',
        }),
      ],
    })

    const usdVariant = product.variants.find((entry) => entry.id === 'usd-mip-10')
    expect(usdVariant?.distributionSupport).toMatchObject({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(sgdVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 100,
      topUpAmountIncrement: 10,
    })
    expect(usdVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 100,
      topUpAmountIncrement: 10,
    })
    expect(usdVariant?.distributionSupport?.notes).toEqual(expect.arrayContaining([
      expect.stringContaining('paid in SGD irrespective of policy currency'),
      expect.stringContaining('published S$30 minimum remain reinvested'),
    ]))
    expect(product.warnings.some((warning) => warning.includes('manual distribution-mode assumption surface with the published S$30 minimum annual payout threshold'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('manual current net protected premium base support once regular-withdrawal assumptions are already active'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('manual current accidental-death regular-premium-floor support once regular-withdrawal assumptions are already active'))).toBe(true)
    expect(usdVariant?.warnings).toContain(
      'Recurring single premium is not available for USD-denominated policies and is therefore omitted from this variant.',
    )
    expect(sgdVariant?.warnings).toContain(
      'Life Replacement Option eligibility / underwriting, post-replacement cover resets, and policy-reissue fallback remain informational only in V1.',
    )
    expect(sgdVariant?.unsupportedItems).toContain(
      'The current accidental-death estimate also needs manual current age and current amount owing inputs and, once regular-withdrawal assumptions are already active, a manual current accidental-death regular-premium floor; age-75 cut-off handling is modeled, while claim exclusions, payout settlement, and post-claim state remain informational only.',
    )
    expect(sgdVariant?.unsupportedItems).toContain(
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap; payout settlement and post-claim state remain informational only.',
    )
    expect(sgdVariant?.unsupportedItems).toContain(
      'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
    )
    expect(sgdVariant?.unsupportedItems).toContain(
      'Life Replacement Option rider termination, new suicide / incontestability / exclusion periods, and revised expiry-date administration remain informational only.',
    )
    expect(sgdVariant?.unsupportedItems).toContain(
      'Life Replacement Option policy-reissue fallback, non-identical replacement-policy terms, and post-replacement premium / term administration remain informational only.',
    )
    expect(sgdVariant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      allowedFrequencies: ['annual', 'semi-annual', 'quarterly', 'monthly'],
      minimumStartPolicyYear: 11,
      minimumAnnualWithdrawalAmount: 1_200,
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('Top-up Account first'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 14,
          section: 'Regular Withdrawal',
        }),
      ],
    })
    expect(sgdVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'power-up-bonus',
        mode: 'monthly-rate',
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
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-start-gate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-minimum-annual-withdrawal-amount')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-frequency-eligibility-gate')
    expect(usdVariant?.scheduledPayoutSupport?.allowedFrequencies).toEqual(['annual', 'semi-annual', 'quarterly'])
  }, 30_000)
})
