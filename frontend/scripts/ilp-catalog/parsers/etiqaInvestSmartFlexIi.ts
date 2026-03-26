import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const TERM_OPTIONS = [10, 15, 20] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

interface VariantConfig {
  mipLength: MipTerm
  annualPremiumMin: number
  startupBonusTiers: IlpTemplateBonusTier[]
  policyChargeRate: number
  premiumShortfallRates: number[]
  policyChargeTailRates: Array<{
    minAnnualisedPremiumsPaid: number
    maxAnnualisedPremiumsPaid: number | null
    rate: number
  }>
  surrenderRates: number[]
  specialBonusStartYear: number
  specialBonusEndYear: number
  premiumFreePeriodNote: string
  premiumFreePeriodSchedule: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    months: number
  }>
}

const PREMIUM_CHARGE_RATE = 0.03

const VARIANT_CONFIGS: Record<MipTerm, VariantConfig> = {
  10: {
    mipLength: 10,
    annualPremiumMin: 4_800,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 9_599.99, rate: 0.05 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.2 },
    ],
    policyChargeRate: 0.023,
    premiumShortfallRates: [1, 1, 0.79, 0.6, 0.5],
    policyChargeTailRates: [
      { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 5, rate: 0.012 },
      { minAnnualisedPremiumsPaid: 6, maxAnnualisedPremiumsPaid: 6, rate: 0.01 },
      { minAnnualisedPremiumsPaid: 7, maxAnnualisedPremiumsPaid: 7, rate: 0.0086 },
      { minAnnualisedPremiumsPaid: 8, maxAnnualisedPremiumsPaid: 8, rate: 0.0075 },
      { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.0067 },
      { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
    ],
    surrenderRates: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    specialBonusStartYear: 6,
    specialBonusEndYear: 10,
    premiumFreePeriodNote: 'Up to 60 months of Premium-Free Period may be accumulated across the 10-year premium payment term.',
    premiumFreePeriodSchedule: [
      { startPolicyYear: 7, endPolicyYear: 10, months: 60 },
    ],
  },
  15: {
    mipLength: 15,
    annualPremiumMin: 3_600,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 7_199.99, rate: 0.13 },
      { currency: 'SGD', minAnnualPremium: 7_200, maxAnnualPremium: null, rate: 0.3 },
    ],
    policyChargeRate: 0.02,
    premiumShortfallRates: [1, 1, 0.81, 0.7, 0.6, 0.58, 0.53, 0.51, 0.4],
    policyChargeTailRates: [
      { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 8, rate: 0.0113 },
      { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.01 },
      { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: 10, rate: 0.009 },
      { minAnnualisedPremiumsPaid: 11, maxAnnualisedPremiumsPaid: 11, rate: 0.0082 },
      { minAnnualisedPremiumsPaid: 12, maxAnnualisedPremiumsPaid: 12, rate: 0.0075 },
      { minAnnualisedPremiumsPaid: 13, maxAnnualisedPremiumsPaid: 13, rate: 0.007 },
      { minAnnualisedPremiumsPaid: 14, maxAnnualisedPremiumsPaid: 14, rate: 0.0065 },
      { minAnnualisedPremiumsPaid: 15, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
    ],
    surrenderRates: [1, 1, 0.81, 0.7, 0.6, 0.58, 0.53, 0.51, 0.4, 0.38, 0.33, 0.28, 0.22, 0.18, 0.08],
    specialBonusStartYear: 11,
    specialBonusEndYear: 15,
    premiumFreePeriodNote: 'Up to 84 months of Premium-Free Period may be accumulated across the 15-year premium payment term.',
    premiumFreePeriodSchedule: [
      { startPolicyYear: 7, endPolicyYear: 10, months: 12 },
      { startPolicyYear: 11, endPolicyYear: 15, months: 84 },
    ],
  },
  20: {
    mipLength: 20,
    annualPremiumMin: 2_400,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0.3 },
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: null, rate: 0.6 },
    ],
    policyChargeRate: 0.0185,
    premiumShortfallRates: [1, 1, 0.9, 0.75, 0.63, 0.59, 0.55, 0.51, 0.45, 0.4],
    policyChargeTailRates: [
      { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 9, rate: 0.0134 },
      { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: 10, rate: 0.012 },
      { minAnnualisedPremiumsPaid: 11, maxAnnualisedPremiumsPaid: 11, rate: 0.011 },
      { minAnnualisedPremiumsPaid: 12, maxAnnualisedPremiumsPaid: 12, rate: 0.01 },
      { minAnnualisedPremiumsPaid: 13, maxAnnualisedPremiumsPaid: 13, rate: 0.0093 },
      { minAnnualisedPremiumsPaid: 14, maxAnnualisedPremiumsPaid: 14, rate: 0.0086 },
      { minAnnualisedPremiumsPaid: 15, maxAnnualisedPremiumsPaid: 15, rate: 0.008 },
      { minAnnualisedPremiumsPaid: 16, maxAnnualisedPremiumsPaid: 16, rate: 0.0075 },
      { minAnnualisedPremiumsPaid: 17, maxAnnualisedPremiumsPaid: 17, rate: 0.0071 },
      { minAnnualisedPremiumsPaid: 18, maxAnnualisedPremiumsPaid: 18, rate: 0.0067 },
      { minAnnualisedPremiumsPaid: 19, maxAnnualisedPremiumsPaid: 19, rate: 0.0064 },
      { minAnnualisedPremiumsPaid: 20, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
    ],
    surrenderRates: [1, 1, 0.9, 0.75, 0.63, 0.59, 0.55, 0.51, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.14, 0.1, 0.08, 0.08, 0.08, 0.08],
    specialBonusStartYear: 16,
    specialBonusEndYear: 20,
    premiumFreePeriodNote: 'Up to 132 months of Premium-Free Period may be accumulated across the 20-year premium payment term.',
    premiumFreePeriodSchedule: [
      { startPolicyYear: 7, endPolicyYear: 15, months: 12 },
      { startPolicyYear: 16, endPolicyYear: 20, months: 132 },
    ],
  },
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 8): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate: roundRate(rate),
  }))
}

function buildBonuses(
  config: VariantConfig,
  page2: IlpCatalogSourceRef,
  page3: IlpCatalogSourceRef,
  repaymentPage: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  return [
    {
      id: 'startup-bonus',
      type: 'sign-up',
      label: 'Start-up Bonus',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: config.startupBonusTiers.map((tier) => ({ ...tier })),
      restorationRules: [
        { trigger: 'premium-holiday-repayment', basis: 'repaid-premium' },
      ],
      notes: [
        'Credited on regular premium received during the first policy year only.',
        'Full repayment of missed regular premiums restores the published missed Start-up Bonus into the Regular Premium Account.',
        'Top-up premiums do not receive the Start-up Bonus.',
      ],
      sourceRefs: [page2, repaymentPage],
    },
    {
      id: 'special-bonus',
      type: 'allocation',
      label: 'Special Bonus',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: config.specialBonusStartYear,
      endPolicyYear: config.specialBonusEndYear,
      rate: 0.03,
      amount: null,
      tieredRates: [],
      restorationRules: [
        { trigger: 'premium-holiday-repayment', basis: 'repaid-premium' },
      ],
      notes: [
        'Applied on each regular premium received during the published Special Bonus Period.',
        'Full repayment of missed regular premiums restores the published missed Special Bonus into the Regular Premium Account.',
      ],
      sourceRefs: [page2, repaymentPage],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'monthly-rate',
      appliesTo: ['regular'],
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      rate: 0.001,
      amount: null,
      tieredRates: [],
      suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 }],
      notes: [
        'Applied monthly on the Regular Premium Account from the month after the premium payment term ends.',
        'No Loyalty Bonus is paid on the Top-up Account.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(config: VariantConfig, page17: IlpCatalogSourceRef): IlpTemplateFeeRule[] {
  return [
    {
      id: 'policy-charge-during-premium-term',
      label: 'Policy Charge',
      basis: 'cumulative-paid-regular-premium',
      rate: roundRate(config.policyChargeRate),
      amount: null,
      appliesTo: ['regular'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: config.mipLength,
      cumulativePaidPremiumConfig: {
        annualisedPremiumAtIssue: config.annualPremiumMin,
      },
      notes: [
        'Models the published monthly policy charge as a percentage of cumulative regular premiums actually paid during the premium payment term.',
      ],
      sourceRefs: [page17],
    },
    {
      id: 'policy-charge-after-premium-term',
      label: 'Policy Charge',
      basis: 'cumulative-paid-regular-premium',
      rate: roundRate(config.policyChargeTailRates[0]?.rate ?? 0),
      amount: null,
      appliesTo: ['regular'],
      activeWindow: 'policy-term',
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      cumulativePaidPremiumConfig: {
        annualisedPremiumAtIssue: config.annualPremiumMin,
        countRateSchedule: config.policyChargeTailRates.map((tier) => ({ ...tier })),
      },
      notes: [
        'Models the published post-premium-term policy charge using the Number of Annualised Regular Premiums Paid tiers.',
      ],
      sourceRefs: [page17],
    },
  ]
}

function buildEventChargeRules(
  config: VariantConfig,
  page6: IlpCatalogSourceRef,
  page7: IlpCatalogSourceRef,
  page8: IlpCatalogSourceRef,
  page17: IlpCatalogSourceRef,
  page19: IlpCatalogSourceRef,
  page22: IlpCatalogSourceRef,
): IlpTemplateEventChargeRule[] {
  return [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: PREMIUM_CHARGE_RATE,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies a 3% upfront charge on recurring and ad-hoc top-up premiums.',
      ],
      sourceRefs: [page7, page17],
    },
    {
      id: 'startup-bonus-recovery-charge',
      label: 'Start-up Bonus Recovery Charge',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-tiered-startup-recovery',
      appliesTo: ['regular'],
      rate: 0,
      amount: 0,
      sourceBonusId: 'startup-bonus',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Start-up Bonus recovery charge when regular premium is reduced.',
      ],
      sourceRefs: [page7, page22],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['regular'],
      freeEventCount: 2,
      freeEventStartPolicyYear: 4,
      freeEventMaxAmountRate: 0.05,
      freeEventMaxAmountBasis: 'cumulative-paid-regular-premium',
      rate: 0,
      rateSchedule: buildRateSchedule(config.surrenderRates),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies to withdrawals from the Regular Premium Account during the premium payment term.',
        'The first two Regular Premium Account withdrawals from policy year 4 onward are free up to 5% of cumulative regular premiums actually paid at the withdrawal month; only any excess remains chargeable.',
        'The broader Partial Withdrawal Limit, minimum holding amount, and broader withdrawal administration remain manual in V1.',
      ],
      sourceRefs: [page8, page19],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['regular'],
      rate: 0,
      rateSchedule: buildRateSchedule(config.premiumShortfallRates),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      freeLifetimeMonthsSchedule: config.premiumFreePeriodSchedule.map((tier) => ({ ...tier })),
      freeLifetimeMonthsResetOnRepayment: true,
      notes: [
        'Models the published premium-shortfall-charge corridor across the premium payment term, with the Premium-Free Period entitlement schedule suppressing charges while unused entitlement months remain.',
      ],
      sourceRefs: [page6, page19],
    },
    {
      id: 'premium-shortfall-charge-refund',
      label: 'Premium Shortfall Charge Refund',
      trigger: 'premium-holiday-repayment',
      basis: 'premium-holiday-charge-refund',
      appliesTo: ['regular'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-shortfall-charge',
      notes: [
        'Returns all previously imposed premium shortfall charges without interest after all missed regular premiums are paid back in full.',
        'Repayment also resets the applicable Premium-Free Period entitlement schedule for later missed-premium events.',
      ],
      sourceRefs: [page6, page19],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateVariant {
  const config = VARIANT_CONFIGS[term]
  const page1 = sourceRef(1, 'Plan description and death benefit', snippetNear(document, 1, 'PRODUCT SUMMARY: Invest smart flex II', 12))
  const page2 = sourceRef(2, 'Start-up Bonus and Special Bonus', snippetNear(document, 2, 'Start-up Bonus', 18))
  const page3 = sourceRef(3, 'Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 16))
  const page4 = sourceRef(4, 'Premium-Free Period', snippetNear(document, 4, 'Premium-Free Period', 18))
  const page6 = sourceRef(6, 'Premium Repayment and missed premiums', snippetNear(document, 6, 'Premium Repayment', 18))
  const page7 = sourceRef(7, 'Change in Regular Premium and Top-up', snippetNear(document, 7, 'Change in Regular Premium', 18))
  const page8 = sourceRef(8, 'Partial Withdrawal and Full Surrender', snippetNear(document, 8, 'Partial Withdrawal', 18))
  const page9 = sourceRef(9, 'Change of Life Insured', snippetNear(document, 9, 'Change of Life Insured', 18))
  const page17 = sourceRef(17, 'Premium Charge and Policy Charge', snippetNear(document, 17, 'Policy charge is payable', 18))
  const page19 = sourceRef(19, 'Premium Shortfall Charge', snippetNear(document, 19, 'Premium shortfall charge', 18))
  const page21 = sourceRef(21, 'Surrender Charge', snippetNear(document, 21, 'Surrender charge', 18))
  const page22 = sourceRef(22, 'Start-up Bonus Recovery Charge and Insurance Charge', snippetNear(document, 22, 'Start-up Bonus recovery charge', 18))
  const page26 = sourceRef(26, 'Appendix A insurance charge table', snippetNear(document, 26, 'Appendix A', 18))

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: config.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'regular',
        label: 'Regular Premium Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'regular', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'regular', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page7, page8],
      },
      {
        id: 'topup',
        label: 'Top-up Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page7, page8],
      },
    ],
    bonuses: buildBonuses(config, page2, page3, page6),
    feeRules: [
      ...buildFeeRules(config, page17),
      {
        id: 'insurance-charge',
        label: 'Insurance Charge',
        basis: 'assurance-sum-at-risk',
        rate: null,
        amount: 0,
        assuranceConfig: {
          formula: 'income-invest-flex-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
        requiresManualInput: true,
        appliesTo: ['regular'],
        assuranceValueAppliesTo: ['regular'],
        activeWindow: 'policy-term',
        notes: [
          'Models the published 101% of total regular premium paid less regular-account withdrawals, less Regular Premium Account value net-sum-at-risk formula.',
          'Enter the insured-life details and current net regular premiums paid base before trusting the monthly insurance-charge output.',
          'If the net sum at risk is zero or negative, no insurance charge is due.',
        ],
        sourceRefs: [page22, page26],
      },
    ],
    eventChargeRules: buildEventChargeRules(config, page6, page7, page8, page17, page19, page22),
    eecTable: [...config.surrenderRates],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpAmount: 2_500,
      topUpAmountIncrement: 100,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalAmountIncrement: 100,
      partialWithdrawalMaximumAmountRules: [
        {
          activeWindow: 'during-mip',
          accountId: 'regular',
          basis: 'cumulative-paid-regular-premium-less-prior-gross-withdrawals',
          maximumValueRate: 0.5,
        },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'account-value',
          accountId: 'regular',
          minimumValue: 1_000,
        },
      ],
    },
    warnings: [
      'Invest smart flex II is modeled as a supported V1 corridor. The parser captures the cumulative-paid policy charge, Start-up / Special / Loyalty Bonuses, top-up premium charge with blocking during active Premium-Free Period windows, monthly insurance charge through manual insured-life inputs, Start-up Bonus recovery charge, surrender-charge horizon, the current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input.',
      config.premiumFreePeriodNote,
      'Premium-Free-Period-gated premium shortfall charge, premium shortfall charge after entitlement exhaustion, full-repayment reset, ad-hoc top-up blocking during active Premium-Free Period windows, the published S$2,500 minimum ad-hoc top-up in S$100 increments, the published S$500 minimum one-off partial withdrawal amount with S$100 increments, the published 50%-of-cumulative-paid-regular-premiums less prior gross Regular Premium Account withdrawals limit during the premium payment term, the published S$1,000 Regular Premium Account minimum holding floor on explicit regular-account withdrawals, and the published two-count free partial withdrawal cap from policy year 4 are modeled. Broader account-routing administration and top-up product-highlights-sheet limits / approval timing remain informational only in V1.',
      'Change-of-life-insured effects remain informational only in V1.',
    ],
    unsupportedItems: [
      'The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.',
      'The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published partial-TI continuation corridor after manual claim-amount and residual-death input, but claim exclusions and insurer-side settlement mechanics remain informational only.',
      'Free partial withdrawal account-routing order and broader withdrawal administration remain informational only.',
      'Change of Life Insured remains informational only.',
      'Optional riders remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page6, page7, page8, page9, page17, page19, page21, page22, page26],
  }
}

export function parseEtiqaInvestSmartFlexIi(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-invest-smart-flex-ii',
    insurer: 'Etiqa',
    productName: 'Invest smart flex II',
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
      'branch:etiqa-smart-flex-ii-startup-bonus',
      'branch:etiqa-smart-flex-ii-special-bonus',
      'branch:etiqa-smart-flex-ii-loyalty-bonus',
      'branch:etiqa-smart-flex-ii-cumulative-paid-policy-charge',
      'branch:etiqa-smart-flex-ii-insurance-charge',
      'branch:etiqa-smart-flex-ii-top-up-premium-charge',
      'branch:etiqa-smart-flex-ii-startup-bonus-recovery',
      'branch:etiqa-smart-flex-ii-premium-shortfall-charge',
      'branch:etiqa-smart-flex-ii-premium-shortfall-refund',
      'branch:etiqa-smart-flex-ii-partial-withdrawal-charge',
      'branch:etiqa-smart-flex-ii-surrender-charge',
      'branch:etiqa-smart-flex-ii-top-up-account-routing',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-amount-gate-block',
      'kernel:free-withdrawal-event-cap',
      'kernel:partial-withdrawal-amount-increment-block',
      'kernel:partial-withdrawal-maximum-amount-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:monthly-rate-bonus-crediting',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'etiqa-smart-flex-ii-free-partial-withdrawal-benefit-administration',
      'etiqa-smart-flex-ii-change-of-life-insured',
      'etiqa-smart-flex-ii-optional-riders',
    ],
    warnings: [
      'Invest smart flex II is currently modeled as a supported product in V1. The regular-premium / top-up account structure, current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, cumulative-paid policy charge, Start-up / Special / Loyalty Bonuses, top-up premium charge with ad-hoc top-up blocking during active Premium-Free Period windows plus the published S$2,500 minimum ad-hoc top-up in S$100 increments, monthly insurance charge through manual insured-life inputs, Start-up Bonus recovery charge, the Premium-Free-Period-gated premium shortfall charge and full-repayment refund/reset corridor, the published two-count free partial withdrawal cap from policy year 4 on the Regular Premium Account, and surrender-charge schedule are modeled.',
      'Broader free partial withdrawal limits and administration, top-up product-highlights-sheet limits / approval timing, claim exclusions / insurer-side settlement mechanics, and change-of-life-insured behavior remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(context.document, term)),
  }
}
