import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

type PremiumPaymentTerm = 20 | 25

const BOOSTER_BONUS_TIERS: Record<PremiumPaymentTerm, Array<{ currency: 'SGD', minAnnualPremium: number | null, maxAnnualPremium: number | null, rate: number }>> = {
  20: [
    { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.2 },
  ],
  25: [
    { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.25 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
  ],
}

const INITIAL_ACCOUNT_CHARGE_RATE_SCHEDULE: Record<PremiumPaymentTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  20: [
    { startPolicyYear: 1, endPolicyYear: 9, rate: 0.038 },
    { startPolicyYear: 10, endPolicyYear: null, rate: 0.012 },
  ],
  25: [
    { startPolicyYear: 1, endPolicyYear: 10, rate: 0.035 },
    { startPolicyYear: 11, endPolicyYear: null, rate: 0.01 },
  ],
}

const PREMIUM_REDUCTION_CHARGE_SCHEDULE: Record<PremiumPaymentTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  20: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.85 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.56 },
    { startPolicyYear: 6, endPolicyYear: 6, rate: 0.48 },
    { startPolicyYear: 7, endPolicyYear: 7, rate: 0.42 },
    { startPolicyYear: 8, endPolicyYear: 8, rate: 0.37 },
    { startPolicyYear: 9, endPolicyYear: 9, rate: 0.32 },
  ],
  25: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.98 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.67 },
    { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
    { startPolicyYear: 7, endPolicyYear: 7, rate: 0.52 },
    { startPolicyYear: 8, endPolicyYear: 8, rate: 0.47 },
    { startPolicyYear: 9, endPolicyYear: 9, rate: 0.43 },
    { startPolicyYear: 10, endPolicyYear: 10, rate: 0.34 },
  ],
}

const REDEMPTION_FEE_SCHEDULE: Record<PremiumPaymentTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  20: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.3 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
    { startPolicyYear: 6, endPolicyYear: 9, rate: 0.1 },
  ],
  25: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.3 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
    { startPolicyYear: 6, endPolicyYear: 10, rate: 0.1 },
  ],
}

const SURRENDER_CHARGE_SCHEDULE: Record<PremiumPaymentTerm, number[]> = {
  20: [
    1,
    1,
    0.85,
    0.68,
    0.56,
    0.48,
    0.42,
    0.37,
    0.32,
    0.22,
    0.21,
    0.2,
    0.19,
    0.18,
    0.17,
    0.15,
    0.11,
    0.1,
    0.08,
    0.06,
  ],
  25: [
    1,
    1,
    0.98,
    0.8,
    0.67,
    0.58,
    0.52,
    0.47,
    0.43,
    0.34,
    0.33,
    0.32,
    0.29,
    0.27,
    0.26,
    0.25,
    0.23,
    0.17,
    0.11,
    0.11,
    0.1,
    0.1,
    0.09,
    0.07,
    0.05,
  ],
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildInitialAccountChargeRule(term: PremiumPaymentTerm, page9: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'initial-account-charge',
    label: 'Initial Account Charge',
    basis: 'premium-base-mip-multiplier',
    yearBasis: 'policy-year',
    rate: 0,
    amount: 0,
    appliesTo: ['initial'],
    fallbackAppliesTo: ['accumulation'],
    premiumBaseConfig: {
      useHigherOfCommencementAndPrevailing: true,
      multiplierYearBasis: 'policy-year',
      multiplierSchedule: term === 20
        ? [
            { startPolicyYear: 1, endPolicyYear: 19, mode: 'policy-year' },
            { startPolicyYear: 20, endPolicyYear: null, mode: 'fixed', multiplier: 20 },
          ]
        : [
            { startPolicyYear: 1, endPolicyYear: 24, mode: 'policy-year' },
            { startPolicyYear: 25, endPolicyYear: null, mode: 'fixed', multiplier: 25 },
          ],
    },
    rateSchedule: INITIAL_ACCOUNT_CHARGE_RATE_SCHEDULE[term].map((tier) => ({ ...tier })),
    activeWindow: 'policy-term',
    notes: [
      `Models the published monthly initial-account charge for the ${term}-year premium-payment-term corridor.`,
      'The charge remains anchored to the commencement-date annualised regular premium and therefore does not reduce after premium reductions or missed premiums.',
      'If the initial units account is insufficient, the remaining deduction falls back to the accumulation units account.',
    ],
    sourceRefs: [page9],
  }
}

function buildPremiumReductionChargeRule(term: PremiumPaymentTerm, page12: IlpCatalogSourceRef): IlpTemplateEventChargeRule {
  return {
    id: 'premium-reduction-charge',
    label: 'Premium Reduction Charge',
    trigger: 'regular-premium-reduction',
    basis: 'annual-reduction-with-active-months',
    appliesTo: ['initial'],
    fallbackAppliesTo: ['accumulation'],
    rate: 0,
    amount: 0,
    rateSchedule: PREMIUM_REDUCTION_CHARGE_SCHEDULE[term].map((tier) => ({ ...tier })),
    activeWindow: 'during-mip',
    allocation: 'equal-split',
    notes: [
      `Models the published monthly premium-reduction charge for the ${term}-year premium-payment-term corridor.`,
      'The charge applies to the reduction from the commencement-date annualised regular premium until you restore the original premium or the charge period ends.',
      'Mark the reduction event with an insurer-approved charge waiver when an admitted Support Benefit approval waives the reduction charge for that period.',
      'Mark the same reduction event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
      'Support Benefit approval history and claim-side timing remain informational only in V1.',
    ],
    sourceRefs: [page12],
  }
}

function buildPremiumShortfallChargeRule(
  term: PremiumPaymentTerm,
  page7: IlpCatalogSourceRef,
  page11: IlpCatalogSourceRef,
): IlpTemplateEventChargeRule {
  return {
    id: 'premium-shortfall-charge',
    label: 'Premium Shortfall Charge',
    trigger: 'premium-holiday',
    basis: 'annual-premium-with-overlap-months',
    appliesTo: ['initial'],
    fallbackAppliesTo: ['accumulation'],
    rate: 0,
    amount: 0,
    rateSchedule: PREMIUM_REDUCTION_CHARGE_SCHEDULE[term].map((tier) => ({ ...tier })),
    activeWindow: 'during-mip',
    allocation: 'equal-split',
    notes: [
      `Models the published monthly premium shortfall charge for the ${term}-year premium-payment-term corridor from policy year 3 until the end of the applicable shortfall-charge period.`,
      'Mark the premium-holiday event with an insurer-approved charge waiver when an admitted Support Benefit approval or already-active Premium Pause Waiver applies for that missed-premium period.',
      'Mark the same premium-holiday event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
      'Automatic 24-month Premium Pause Waiver activation and month accounting, year-3-vs-year-4 non-payment gating remain informational only in V1.',
    ],
    sourceRefs: [page7, page11],
  }
}

function buildInsuranceChargeRule(page9: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'insurance-charge',
    label: 'Insurance Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['initial'],
    fallbackAppliesTo: ['accumulation'],
    assuranceValueAppliesTo: ['initial', 'accumulation'],
    activeWindow: 'policy-term',
    requiresManualInput: true,
    assuranceConfig: {
      formula: 'fwd-invest-repayment-inclusive-death',
      monthlyModalFactor: 1 / 12,
      maxAgeNextBirthday: 99,
    },
    notes: [
      'Requires insured-life details and the current net regular-premium, supplementary / top-up, and repayment bases before the calculator can model the monthly insurance charge.',
      'Models the published Appendix B attained-age / sex / smoker insurance charge on the 101% paid-premium-and-repayment protected base, net of policy value.',
      'The charge is deducted from the initial units account first, with accumulation units account fallback if the initial account is insufficient.',
    ],
    sourceRefs: [page9],
  }
}

function buildVariant(document: ExtractedPdfDocument, term: PremiumPaymentTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Horizon', 18))
  const page3 = sourceRef(3, 'Bonus overview and support benefits', snippetNear(document, 3, 'Annual Premium Bonus', 24))
  const page4 = sourceRef(4, 'Loyalty Bonus', snippetNear(document, 4, 'Loyalty Bonus', 34))
  const page7 = sourceRef(7, 'Missed regular premium and Premium Pause Waiver', snippetNear(document, 7, 'During Policy Year 3', 26))
  const page8 = sourceRef(8, 'Top-up premium', snippetNear(document, 8, 'Top-up premium', 20))
  const page9 = sourceRef(9, 'Initial account charge and insurance charge', snippetNear(document, 9, 'Initial account charge', 30))
  const page10 = sourceRef(10, 'Top-up premium charge', snippetNear(document, 10, 'Premium charge', 16))
  const page11 = sourceRef(11, 'Premium shortfall charge', snippetNear(document, 11, 'Premium shortfall charge', 26))
  const page12 = sourceRef(12, 'Premium reduction charge', snippetNear(document, 12, 'Premium reduction charge', 26))
  const page13 = sourceRef(13, 'Policy closure charge and redemption fee', snippetNear(document, 13, 'Policy closure charge', 24))
  const page14 = sourceRef(14, 'Surrender charge', snippetNear(document, 14, 'Surrender charge', 28))
  const page16 = sourceRef(16, 'Withdrawal rules and partial withdrawal limits', snippetNear(document, 16, 'Withdrawals are allowed', 28))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'booster-bonus-y1',
      type: 'sign-up',
      label: 'Booster Bonus (Policy Year 1)',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      annualPremiumTierBasis: 'committed-annual-premium-at-issue',
      rate: null,
      amount: null,
      tieredRates: BOOSTER_BONUS_TIERS[term].map((tier) => ({ ...tier })),
      notes: [
        `Applied on each regular premium received during policy year 1 for the ${term}-year premium-payment-term corridor, using the published reward band based on annualised regular premium at issue.`,
        'Missed regular premiums simply do not earn Booster Bonus; repayment-driven restoration and later premium-frequency changes remain informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'booster-bonus-y2',
      type: 'sign-up',
      label: 'Booster Bonus (Policy Year 2)',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 2,
      endPolicyYear: 2,
      annualPremiumTierBasis: 'committed-annual-premium-at-issue',
      rate: null,
      amount: null,
      tieredRates: [
        { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: term === 20 ? 0.1 : 0.2 },
        { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: term === 20 ? 0.2 : 0.3 },
      ],
      notes: [
        `Applied on each regular premium received during policy year 2 for the ${term}-year premium-payment-term corridor, using the published reward band based on annualised regular premium at issue.`,
        'Missed regular premiums simply do not earn Booster Bonus; repayment-driven restoration and later premium-frequency changes remain informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'annual-premium-bonus',
      type: 'allocation',
      label: 'Annual Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 5,
      rate: 0.01,
      amount: null,
      requiresPremiumsPaidUpToDate: true,
      requiredRegularPremiumPaymentFrequency: 'annual',
      tieredRates: [],
      notes: [
        'Applied on each annual regular premium paid via the annual premium payment frequency option during the first 5 policy years.',
        'Reduction, repayment, and restoration interactions beyond the paid-up annual premium amount remain informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    ...((
      term === 20
        ? [
            {
              id: 'loyalty-bonus-y3-to-y5',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 3-5)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 3,
              endPolicyYear: 5,
              rate: 0.004,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y6-to-y10',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 6-10)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 6,
              endPolicyYear: 10,
              rate: 0.008,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y11-to-y15',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 11-15)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 11,
              endPolicyYear: 15,
              rate: 0.012,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y16-to-y20',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 16-20)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 16,
              endPolicyYear: 20,
              rate: 0.016,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y21-plus',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Year 21+)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 21,
              endPolicyYear: null,
              rate: 0.011,
              amount: null,
              tieredRates: [],
              qualificationRules: [
                {
                  trigger: 'partial-withdrawal',
                  accountIds: ['initial'],
                  disqualifyThroughReferenceYear: true,
                },
              ],
              notes: [
                'Models the published post-premium-payment-term loyalty-bonus corridor using the 1.10% p.a. rate on the initial units account value.',
                'The bonus is disqualified for the current policy year if a withdrawal is made from the initial units account during that policy year.',
              ],
              sourceRefs: [page4],
            },
          ]
        : [
            {
              id: 'loyalty-bonus-y3-to-y5',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 3-5)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 3,
              endPolicyYear: 5,
              rate: 0.005,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y6-to-y10',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 6-10)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 6,
              endPolicyYear: 10,
              rate: 0.01,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y11-to-y15',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 11-15)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 11,
              endPolicyYear: 15,
              rate: 0.015,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y16-to-y20',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 16-20)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 16,
              endPolicyYear: 20,
              rate: 0.015,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y21-to-y25',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Years 21-25)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 21,
              endPolicyYear: 25,
              rate: 0.02,
              amount: null,
              tieredRates: [],
              adjustmentFactorConfig: {
                formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
                withdrawalAccountIds: ['initial'],
                includePolicyRepaymentsInPaidRegularPremium: true,
                policyRepaymentPriorOffsetRules: [
                  { trigger: 'partial-withdrawal', accountIds: ['initial'] },
                  { trigger: 'regular-premium-reduction' },
                ],
              },
              notes: [
                'Models the published during-premium-payment-term loyalty-bonus formula using the annual adjustment factor on the initial units account value.',
                'Manual policy-repayment events can count as current-year paid regular premium after first offsetting prior-policy-year initial-account withdrawals and regular-premium reductions.',
                'Same-year repayment sequencing, missed-premium repayment ordering, and broader repayment-allocation waterfalls remain informational only in V1.',
                'The post-premium-payment-term no-initial-account-withdrawal corridor is modeled separately in the later loyalty-bonus ranges.',
              ],
              sourceRefs: [page4],
            },
            {
              id: 'loyalty-bonus-y26-plus',
              type: 'loyalty',
              label: 'Loyalty Bonus (Policy Year 26+)',
              mode: 'annual-rate',
              appliesTo: ['initial'],
              startPolicyYear: 26,
              endPolicyYear: null,
              rate: 0.012,
              amount: null,
              tieredRates: [],
              qualificationRules: [
                {
                  trigger: 'partial-withdrawal',
                  accountIds: ['initial'],
                  disqualifyThroughReferenceYear: true,
                },
              ],
              notes: [
                'Models the published post-premium-payment-term loyalty-bonus corridor using the 1.20% p.a. rate on the initial units account value.',
                'The bonus is disqualified for the current policy year if a withdrawal is made from the initial units account during that policy year.',
              ],
              sourceRefs: [page4],
            },
          ]
    ) as IlpTemplateBonus[]),
  ]

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: term,
    icpMonths: 1,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page7, page9, page16],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page7, page8, page16],
      },
    ],
    bonuses,
    feeRules: [
      buildInitialAccountChargeRule(term, page9),
      buildInsuranceChargeRule(page9),
    ],
    eventChargeRules: [
      {
        id: 'top-up-premium-charge',
        label: 'Top-up Premium Charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['accumulation'],
        rate: 0.05,
        amount: 0,
        activeWindow: 'policy-term',
        allocation: 'equal-split',
        notes: [
          'Models the published 5% premium charge on each accepted top-up premium.',
          'V1 blocks top-ups below the published S$3,000 minimum, before policy month 13, and until missed-premium, prior initial-account withdrawal, and regular-premium-reduction obligations are fully cleared through repayment events.',
          'The exact repayment-allocation waterfall and total top-up cap remain informational only in V1.',
        ],
        sourceRefs: [page8, page10],
      },
      buildPremiumShortfallChargeRule(term, page7, page11),
      {
        id: 'premium-shortfall-charge-refund',
        label: 'Premium Shortfall Charge Refund',
        trigger: 'premium-holiday',
        basis: 'source-event-charge-refund',
        appliesTo: ['initial'],
        rate: 1,
        amount: 0,
        activeWindow: 'during-mip',
        allocation: 'equal-split',
        sourceChargeRuleId: 'premium-shortfall-charge',
        notes: [
          `Models the published retrospective refund of deducted premium shortfall charge for the ${term}-year premium-payment-term corridor after admitted Support Benefit approval.`,
          'Use the same premium-holiday event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
          'Automatic Premium Pause Waiver activation, approval history before the current projection start, and broader repayment waterfalls remain informational only in V1.',
        ],
        sourceRefs: [page7, page11],
      },
      buildPremiumReductionChargeRule(term, page12),
      {
        id: 'premium-reduction-charge-refund',
        label: 'Premium Reduction Charge Refund',
        trigger: 'regular-premium-reduction',
        basis: 'source-event-charge-refund',
        appliesTo: ['initial'],
        rate: 1,
        amount: 0,
        activeWindow: 'during-mip',
        allocation: 'equal-split',
        sourceChargeRuleId: 'premium-reduction-charge',
        notes: [
          `Models the published retrospective refund of deducted premium reduction charge for the ${term}-year premium-payment-term corridor after admitted Support Benefit approval.`,
          'Use the same reduction event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
          'Approval history before the current projection start and broader premium-restoration sequencing remain informational only in V1.',
        ],
        sourceRefs: [page12],
      },
      {
        id: 'initial-account-redemption-fee',
        label: 'Initial Account Redemption Fee',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['initial'],
        rate: 0,
        amount: 0,
        rateSchedule: REDEMPTION_FEE_SCHEDULE[term].map((tier) => ({ ...tier })),
        activeWindow: 'during-mip',
        allocation: 'equal-split',
        notes: [
          `Models the published initial-units-account redemption fee schedule for the ${term}-year premium-payment-term corridor.`,
          'Withdrawals from the accumulation units account are charge-free under the published summary.',
          'V1 blocks authored initial-units-account withdrawals before policy month 25 and enforces the published S$3,000 minimum remaining-value floor on explicit one-off partial-withdrawal events.',
          'The 50%-minus-prior-withdrawals partial-withdrawal limit and minimum withdrawal requirements remain informational only.',
        ],
        sourceRefs: [page13, page16],
      },
    ],
    eecTable: [...SURRENDER_CHARGE_SCHEDULE[term]],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 3_000,
      minimumTopUpStartPolicyMonth: 13,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'initial', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'initial', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      topUpRepaymentClearance: {
        includeMissedPremiums: true,
        priorOffsetRules: [
          { trigger: 'partial-withdrawal', accountIds: ['initial'] },
          { trigger: 'regular-premium-reduction' },
        ],
      },
    },
    warnings: [
      `FWD Invest First Horizon (${term}-year premium payment term) is cataloged as a supported V1 product. The parser captures the published Booster Bonus, Loyalty Bonus including the post-premium-payment-term no-initial-account-withdrawal corridor, fixed-premium-base initial-account charge, annual-premium bonus under the annual premium-frequency assumption, Appendix B insurance charge with manual repayment-base input, the premium shortfall charge corridor with admitted-state charge-waiver and retrospective charge-refund support on premium-holiday events, the premium-reduction charge schedule with admitted-state charge-waiver and retrospective charge-refund support on reduction events, 5% top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and until aggregate repayment-clearance for missed premiums, prior initial-account withdrawals, and regular-premium-reduction differences, the initial-units-account policy-month-25 one-off partial-withdrawal gate with the published S$3,000 minimum remaining-value floor, initial-units-account redemption-fee schedule, and initial-units-account surrender-charge schedule.`,
      'Automatic 24-month Premium Pause Waiver activation and month accounting, Support Benefit approval history, and broader repayment waterfalls remain metadata-only.',
      'The exact repayment-allocation waterfall, payment-frequency changes after issue, and broader withdrawal-eligibility gates remain metadata-only beyond the modeled initial-units-account policy-month-25 gate and S$3,000 minimum remaining-value floor for explicit one-off partial withdrawals.',
    ],
    unsupportedItems: [
      'Automatic 24-month Premium Pause Waiver activation and month accounting, policy-year-3-vs-year-4 non-payment gating beyond explicit charge-waived / charge-refunded events, Support Benefit approval history, and broader repayment waterfalls remain informational only.',
      'Repayment-driven bonus restoration remains informational only.',
      'Changing the regular premium payment frequency after issue remains informational only.',
      'The exact repayment-allocation waterfall, total top-up cap, and minimum withdrawal requirements remain informational only beyond the modeled aggregate top-up-clearance gate and the published S$3,000 minimum top-up amount.',
      'The 50%-minus-prior-withdrawals partial-withdrawal limit and broader withdrawal administration remain informational only beyond the modeled initial-units-account policy-month-25 gate and S$3,000 minimum remaining-value floor.',
      'Policy closure charge, switching fee review rights, fund management charges, change-of-person-insured handling, and fund-level transaction deferrals remain informational only.',
    ],
    sourceRefs: [page1, page7, page8, page9, page10, page11, page12, page13, page14, page16],
  }
}

export function parseFwdInvestFirstHorizon(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-first-horizon',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Horizon',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-first-horizon-booster-bonus',
      'branch:fwd-invest-first-horizon-loyalty-bonus',
      'branch:fwd-invest-first-horizon-annual-premium-bonus',
      'branch:fwd-invest-first-horizon-initial-account-charge',
      'branch:fwd-invest-first-horizon-insurance-charge',
      'branch:fwd-invest-first-horizon-premium-shortfall-charge',
      'branch:fwd-invest-first-horizon-premium-reduction-charge',
      'branch:fwd-invest-first-horizon-top-up-premium-charge',
      'branch:fwd-invest-first-horizon-initial-account-redemption-fee',
      'branch:fwd-invest-first-horizon-initial-account-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-repayment-clearance-block',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-first-horizon-policy-closure-charge',
      'fwd-invest-first-horizon-fund-level-charges',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-horizon-premium-pause-waiver',
      'fwd-invest-first-horizon-support-benefit-waiver',
      'fwd-invest-first-horizon-repayment-bonus-restoration',
      'fwd-invest-first-horizon-top-up-repayment-waterfall',
      'fwd-invest-first-horizon-withdrawal-eligibility-gates',
      'fwd-invest-first-horizon-change-of-person-insured',
      'fwd-invest-first-horizon-fund-switching',
    ],
    warnings: [
      'FWD Invest First Horizon is cataloged as a supported V1 product. The parser currently covers the published current-state ordinary death benefit as the higher of 105% of policy value or the 101% protected premium-and-repayment base, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published S$2 million per-life limit, Booster Bonus, Loyalty Bonus including the post-premium-payment-term no-initial-account-withdrawal corridor, and the 20-year and 25-year regular-premium corridors through the fixed-premium-base initial-account charge, Appendix B insurance charge with manual repayment-base input, premium shortfall charge with admitted-state charge-waiver and retrospective charge-refund support on premium-holiday events, premium-reduction charge with admitted-state charge-waiver and retrospective charge-refund support on reduction events, top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and until aggregate repayment-clearance for missed premiums, prior initial-account withdrawals, and regular-premium-reduction differences, the initial-units-account policy-month-25 one-off partial-withdrawal gate with the published S$3,000 minimum remaining-value floor, initial-account redemption-fee, and surrender-charge surfaces that fit the existing charge and surrender kernels.',
      'Automatic Premium Pause Waiver activation, Support Benefit approval history, the exact repayment-allocation waterfall, and broader withdrawal eligibility gates remain metadata-only beyond the modeled initial-units-account policy-month-25 gate and S$3,000 minimum remaining-value floor for explicit one-off partial withdrawals.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 20),
      buildVariant(context.document, 25),
    ],
  }
}
