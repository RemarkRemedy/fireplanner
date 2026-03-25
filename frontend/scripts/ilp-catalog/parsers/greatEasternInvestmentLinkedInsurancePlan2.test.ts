import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternInvestmentLinkedInsurancePlan2 } from './greatEasternInvestmentLinkedInsurancePlan2'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS_GEL_Investment Linked Insurance Plan 2_v3.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternInvestmentLinkedInsurancePlan2', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternInvestmentLinkedInsurancePlan2({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-investment-linked-insurance-plan-2')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-tpd-benefit-estimate')
    expect(product.modeledEconomics).toContain('branch:great-eastern-ilp2-insurance-charge')
    expect(product.modeledEconomics).toContain('branch:great-eastern-ilp2-premium-holiday-charge')
    expect(product.modeledEconomics).toContain('branch:great-eastern-ilp2-premium-holiday-charge-refund')
    expect(product.modeledEconomics).toContain('kernel:top-up-amount-gate-block')
    expect(product.modeledEconomics).toContain('kernel:premium-holiday-top-up-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-paid-up-to-date-block')
    expect(product.modeledEconomics).toContain('branch:great-eastern-ilp2-choice10-fixed-policy-fee')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-ilp2-insurance-charge')
    expect(product.warnings).toContain(
      'Investment-linked Insurance Plan 2 is cataloged as a supported V1 corridor. The parser captures the published bonus path, policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals including withdrawal charges and current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, premium-holiday charge, the Choice 10 premium-holiday-charge refund path, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and partial-withdrawal / surrender schedules, while TPD continuation-event state, rider premium-deduction treatment, Choice 10 fixed-fee-threshold transitions, change-of-life-assured handling, automatic fund rebalancing administration, and terminal-illness exclusions / settlement / broader post-claim continuation remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate.',
    )
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-choice-5',
      'sgd-mip-10-choice-10-under-6000',
      'sgd-mip-10-choice-10-6000-and-above',
    ])

    const choice5 = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-5')
    expect(choice5).toBeDefined()
    expect(choice5?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(choice5?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.15 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-bonus',
          startPolicyYear: 6,
          requiresPremiumsPaidUpToDate: true,
          rate: 0.02,
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.003,
        }),
      ]),
    )
    expect(choice5?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee-rate',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.007 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'great-eastern-wa4-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(choice5?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.45 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
          ],
        }),
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
      ]),
    )
    expect(choice5?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    })
    expect(choice5?.eventChargeRules?.find((rule) => rule.id === 'premium-holiday-charge-refund')).toBeUndefined()
    expect(choice5?.eecTable).toEqual([1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])

    const choice10Low = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-10-under-6000')
    expect(choice10Low).toBeDefined()
    expect(choice10Low?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee-fixed-low-annualised-premium',
          basis: 'fixed-annual',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          assuranceConfig: expect.objectContaining({
            formula: 'great-eastern-wa4-death-ti',
          }),
        }),
      ]),
    )
    expect(choice10Low?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 3_599.99, rate: 0.05 },
            { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 5_999.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.2 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.4 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-bonus',
          startPolicyYear: 11,
        }),
      ]),
    )
    expect(choice10Low?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
          sourceChargeRuleId: 'premium-holiday-charge',
          rate: 1,
        }),
      ]),
    )
    expect(choice10Low?.unsupportedItems).toContain(
      'Choice 10 prevailing-annualised-premium transitions across the S$6,000 fixed-fee threshold are not modeled dynamically; switch variants manually if the threshold changes after a premium reduction.',
    )
    expect(choice10Low?.unsupportedItems).toContain(
      'The current-state death / terminal-illness / TPD benefit estimate needs a manual current amount owing input because current debt is not reconstructed from history in V1.',
    )
    expect(choice10Low?.unsupportedItems).toContain(
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state, but TPD continuation-event state plus terminal-illness exclusions / settlement / broader post-claim continuation remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate.',
    )
    expect(choice10Low?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    })

    const choice10High = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-10-6000-and-above')
    expect(choice10High).toBeDefined()
    expect(choice10High?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'policy-fee-rate', basis: 'account-value' }),
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          assuranceConfig: expect.objectContaining({
            formula: 'great-eastern-wa4-death-ti',
          }),
        }),
      ]),
    )
    expect(choice10High?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
          sourceChargeRuleId: 'premium-holiday-charge',
          rate: 1,
        }),
      ]),
    )
    expect(choice10High?.warnings).toContain(
      'This Choice 10 high-annualised-premium variant assumes the additional S$5 monthly policy fee does not apply throughout the modeled path unless you manually switch variants after a premium change.',
    )
    expect(choice10High?.warnings).toContain(
      'Investment-linked Insurance Plan 2 is modeled as a supported V1 corridor. The parser captures Welcome Bonus, Premium Bonus, Loyalty Bonus, policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101% paid-premium floor after partial withdrawals including withdrawal charges and current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, premium-holiday charge, the Choice 10 premium-holiday-charge refund path, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and the published partial-withdrawal / surrender charge schedules.',
    )
    expect(choice10High?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    })
  }, 30_000)
})
