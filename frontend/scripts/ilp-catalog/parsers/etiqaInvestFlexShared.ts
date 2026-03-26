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

type ProductKind = 'prime-ii' | 'pro' | 'vista'
const TERM_OPTIONS = [10, 20] as const
type MipTerm = (typeof TERM_OPTIONS)[number]
type FlexMode = 'flexi-3' | 'flexi-5'

interface VariantConfig {
  label: string
  mipLength: MipTerm
  annualPremiumMin: number
  startupBonusTiers: IlpTemplateBonusTier[]
  policyChargeRate: number
  policyChargeTailRate: number
  premiumShortfallRates: number[]
  partialWithdrawalRates: number[]
  surrenderRates: number[]
  specialBonusStartYear: number | null
  specialBonusEndYear: number | null
  loyaltyBonusRate: number | null
  premiumFreePeriodNote: string
  premiumFreePeriodSchedule: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    months: number
  }>
}

const PREMIUM_CHARGE_RATE = 0.03

const FLEX_VARIANTS: Record<FlexMode, VariantConfig> = {
  'flexi-3': {
    label: 'Flexi 3',
    mipLength: 10,
    annualPremiumMin: 4_800,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 9_599.99, rate: 0.12 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.22 },
    ],
    policyChargeRate: 0.017,
    policyChargeTailRate: 0.006,
    premiumShortfallRates: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    partialWithdrawalRates: [1, 1, 0.7, 0.6, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    surrenderRates: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    specialBonusStartYear: null,
    specialBonusEndYear: null,
    loyaltyBonusRate: null,
    premiumFreePeriodNote: 'Up to 84 months of Premium-Free Period may be accumulated across the 10-year Flexi 3 premium term.',
    premiumFreePeriodSchedule: [
      { startPolicyYear: 7, endPolicyYear: 10, months: 84 },
    ],
  },
  'flexi-5': {
    label: 'Flexi 5',
    mipLength: 10,
    annualPremiumMin: 4_800,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 9_599.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.32 },
    ],
    policyChargeRate: 0.0218,
    policyChargeTailRate: 0.006,
    premiumShortfallRates: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    partialWithdrawalRates: [1, 1, 0.7, 0.6, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    surrenderRates: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    specialBonusStartYear: 6,
    specialBonusEndYear: 10,
    loyaltyBonusRate: null,
    premiumFreePeriodNote: 'Up to 84 months of Premium-Free Period may be accumulated across the 10-year premium term.',
    premiumFreePeriodSchedule: [
      { startPolicyYear: 8, endPolicyYear: 10, months: 60 },
    ],
  },
}

const TWENTY_YEAR_VARIANT: VariantConfig = {
  label: '20 Years',
  mipLength: 20,
  annualPremiumMin: 2_400,
  startupBonusTiers: [
    { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0.37 },
    { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: null, rate: 0.75 },
  ],
  policyChargeRate: 0.0161,
  policyChargeTailRate: 0.007,
  premiumShortfallRates: [
    1, 1, 0.9, 0.75, 0.63,
    0.59, 0.55, 0.51, 0.45, 0.4,
    0.35, 0.3, 0.25, 0.2, 0.14,
    0.1, 0.08, 0.08, 0.08, 0.08,
  ],
  partialWithdrawalRates: [
    1, 0.8, 0.7, 0.6, 0.5,
    0.05, 0.05, 0.05, 0.05, 0.05,
    0.05, 0.05, 0.05, 0.05, 0.05,
    0.05, 0.05, 0.05, 0.05, 0.05,
  ],
  surrenderRates: [
    1, 1, 0.9, 0.75, 0.63,
    0.59, 0.55, 0.51, 0.45, 0.4,
    0.35, 0.3, 0.25, 0.2, 0.14,
    0.1, 0.08, 0.08, 0.08, 0.08,
  ],
  specialBonusStartYear: 16,
  specialBonusEndYear: 20,
  loyaltyBonusRate: 0.001,
  premiumFreePeriodNote: 'Up to 132 months of Premium-Free Period may be accumulated across the 20-year premium term.',
  premiumFreePeriodSchedule: [
    { startPolicyYear: 8, endPolicyYear: 11, months: 12 },
    { startPolicyYear: 12, endPolicyYear: 20, months: 132 },
  ],
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
  const bonuses: IlpTemplateBonus[] = [
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
  ]

  if (config.specialBonusStartYear != null && config.specialBonusEndYear != null) {
    bonuses.push({
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
    })
  }

  if (config.loyaltyBonusRate != null) {
    bonuses.push({
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'monthly-rate',
      appliesTo: ['regular'],
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      rate: config.loyaltyBonusRate,
      amount: null,
      tieredRates: [],
      suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 }],
      notes: [
        'Applied monthly on the Regular Premium Account from the month after the premium payment term ends.',
        'No Loyalty Bonus is paid on the Top-up Account.',
      ],
      sourceRefs: [page3],
    })
  }

  return bonuses
}

function buildPolicyChargeRule(config: VariantConfig, page18: IlpCatalogSourceRef): IlpTemplateFeeRule[] {
  return [
    {
      id: 'policy-charge-during-premium-term',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: roundRate(config.policyChargeRate),
      amount: 0,
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        multiplierSchedule: [
          {
            startPolicyYear: 1,
            endPolicyYear: config.mipLength,
            mode: 'policy-year',
          },
        ],
      },
      appliesTo: ['regular'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: config.mipLength,
      notes: [
        'Modeled from the published monthly policy charge formula using the policy-issue annual premium base and the lower of policy year and selected premium payment term.',
      ],
      sourceRefs: [page18],
    },
    {
      id: 'policy-charge-after-premium-term',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: roundRate(config.policyChargeTailRate),
      amount: 0,
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        multiplierSchedule: [
          {
            startPolicyYear: config.mipLength + 1,
            endPolicyYear: null,
            mode: 'fixed',
            multiplier: config.mipLength,
          },
        ],
      },
      appliesTo: ['regular'],
      activeWindow: 'policy-term',
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      notes: [
        'Models the post-premium-term tail policy charge using the fixed premium payment term multiplier.',
      ],
      sourceRefs: [page18],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, mode: FlexMode | 'twenty'): IlpTemplateVariant {
  const config = mode === 'twenty' ? TWENTY_YEAR_VARIANT : FLEX_VARIANTS[mode]
  const page1 = sourceRef(1, 'Plan description and death benefit', snippetNear(document, 1, 'Nature and Objective of the Plan'))
  const page2 = sourceRef(2, 'Start-up Bonus and Special Bonus', snippetNear(document, 2, 'Start-up Bonus', 18))
  const page3 = sourceRef(3, 'Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 14))
  const page4 = sourceRef(4, 'Premium-Free Period', snippetNear(document, 4, 'Premium-Free Period', 18))
  const page5 = sourceRef(5, 'Free Partial Withdrawal Benefit and Premium Requirement', snippetNear(document, 5, 'Free Partial Withdrawal Benefit', 18))
  const page6 = sourceRef(6, 'Premium repayment and missed premiums', snippetNear(document, 6, 'Premium Repayment', 18))
  const page7 = sourceRef(7, 'Change in Regular Premium and Top-up', snippetNear(document, 7, 'Change in Regular Premium', 18))
  const page13 = sourceRef(13, 'Distribution Paying Fund', snippetNear(document, 13, 'Distribution Paying Fund', 16))
  const page17 = sourceRef(17, 'Premium Charge', snippetNear(document, 17, 'Premium Charge', 14))
  const page18 = sourceRef(18, 'Policy Charge', snippetNear(document, 18, 'Policy charge is payable', 18))
  const page19 = sourceRef(19, 'Premium Shortfall Charge', snippetNear(document, 19, 'Premium shortfall charge', 20))
  const page20 = sourceRef(20, 'Partial Withdrawal Charge', snippetNear(document, 20, 'Partial Withdrawal Charge', 18))
  const page21 = sourceRef(21, 'Surrender Charge', snippetNear(document, 21, 'Surrender charge', 18))
  const page22 = sourceRef(22, 'Start-up Bonus Recovery and Insurance Charge', snippetNear(document, 22, 'Start-up Bonus recovery charge', 18))
  const page27 = sourceRef(27, 'Appendix A insurance charge table', snippetNear(document, 27, 'Appendix A', 12))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
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
        'Models the published start-up bonus recovery charge when regular premium is reduced.',
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
      rateSchedule: buildRateSchedule(config.partialWithdrawalRates),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies to withdrawals from the Regular Premium Account during the premium payment term.',
        'The first two Regular Premium Account withdrawals from policy year 4 onward are free up to 5% of cumulative regular premiums actually paid at the withdrawal month; only any excess remains chargeable.',
        'The broader Partial Withdrawal Limit, minimum holding amount, and broader withdrawal administration remain manual in V1.',
      ],
      sourceRefs: [page5, page20],
    },
  ]

  eventChargeRules.splice(2, 0, {
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
        `Models the published premium shortfall charge for the ${config.label} corridor, with the Premium-Free Period entitlement schedule suppressing charges while unused entitlement months remain.`,
        'The published refund on full repayment is modeled separately via a premium-holiday repayment refund rule.',
      ],
      sourceRefs: [page6, page19],
    }, {
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
    })

  return {
    id: mode === 'twenty' ? 'sgd-mip-20' : `sgd-mip-10-${mode}`,
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
        sourceRefs: [page1, page5, page7],
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
        sourceRefs: [page1, page7, page17],
      },
    ],
    bonuses: buildBonuses(config, page2, page3, page6),
    feeRules: [
      ...buildPolicyChargeRule(config, page18),
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
        sourceRefs: [page22, page27],
      },
    ],
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Distribution-paying ILP Sub-Funds default to reinvestment unless the policyholder elects payout or accumulation.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
        'Minimum S$40 payout thresholds, change-request cutoffs, and withdrawal consequences on reinvested distributions remain informational only.',
      ],
      sourceRefs: [page13],
    },
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
      `${config.label} is modeled as a supported V1 corridor. The parser captures start-up bonus, special bonus (if applicable), loyalty bonus (if applicable), top-up premium charge with blocking during active Premium-Free Period windows, policy charge, the current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, monthly insurance charge through manual insured-life inputs, start-up bonus recovery, withdrawal charge, and surrender-charge schedules.`,
      config.premiumFreePeriodNote,
      `Premium-Free Period gating, premium-shortfall charge after entitlement exhaustion, full-repayment reset, ad-hoc top-up blocking during active Premium-Free Period windows, the published S$500 minimum one-off partial withdrawal amount in S$100 increments, the published 50%-of-cumulative-paid-regular-premiums less prior gross Regular Premium Account withdrawals limit during the premium payment term, the published S$1,000 Regular Premium Account minimum holding floor on explicit regular-account withdrawals, and the published two-count free partial withdrawal cap from policy year 4 are modeled for the ${config.label} corridor; broader account-routing administration remains informational only in V1.`,
      'Distribution-paying fund support is modeled with reinvestment as the default assumption; payout thresholds, change-request cutoffs, and withdrawal consequences on reinvested distributions remain informational only in V1.',
    ],
    unsupportedItems: [
      'The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.',
      'The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published partial-TI continuation corridor after manual claim-amount and residual-death input, but claim exclusions and insurer-side settlement mechanics remain informational only.',
      'Free Partial Withdrawal Benefit account-routing order and broader withdrawal administration remain informational only.',
      'Distribution-paying fund minimum S$40 payout threshold, bank-account administration, change-request cutoff, and withdrawal consequences on reinvested distributions remain informational only.',
      'Change of Life insured remains informational only.',
      'Optional riders and guaranteed issue wording remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page13, page17, page18, page19, page20, page21, page22, page27],
  }
}

function buildProduct(context: ParseContext, kind: ProductKind): IlpCatalogProduct {
  const productName = kind === 'prime-ii'
    ? 'Invest flex prime II'
    : kind === 'pro'
      ? 'Invest flex pro'
      : 'Invest vista'
  const productId = kind === 'prime-ii'
    ? 'etiqa-invest-flex-prime-ii'
    : kind === 'pro'
      ? 'etiqa-invest-flex-pro'
      : 'etiqa-invest-vista'
  const branchPrefix = kind === 'prime-ii'
    ? 'etiqa-flex-prime-ii'
    : kind === 'pro'
      ? 'etiqa-flex-pro'
      : 'etiqa-vista'

  return {
    id: productId,
    insurer: 'Etiqa',
    productName,
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
      `branch:${branchPrefix}-startup-bonus`,
      `branch:${branchPrefix}-special-bonus`,
      `branch:${branchPrefix}-loyalty-bonus`,
      `branch:${branchPrefix}-policy-charge`,
      `branch:${branchPrefix}-insurance-charge`,
      `branch:${branchPrefix}-top-up-premium-charge`,
      `branch:${branchPrefix}-startup-bonus-recovery`,
      `branch:${branchPrefix}-premium-shortfall-charge`,
      `branch:${branchPrefix}-premium-shortfall-refund`,
      `branch:${branchPrefix}-partial-withdrawal-charge`,
      `branch:${branchPrefix}-surrender-charge`,
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-amount-gate-block',
      'kernel:free-withdrawal-event-cap',
      'kernel:partial-withdrawal-amount-increment-block',
      'kernel:partial-withdrawal-maximum-amount-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:monthly-rate-bonus-crediting',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      `${branchPrefix}-free-partial-withdrawal-benefit-administration`,
      `${branchPrefix}-distribution-paying-fund-threshold-and-withdrawal-consequences`,
      `${branchPrefix}-change-of-life-insured`,
    ],
    warnings: [
      `${productName} is currently modeled as a supported product in V1. The parser captures the current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, the bounded accumulation mechanics, monthly insurance charge through manual insured-life inputs, the Premium-Free-Period-gated premium shortfall charge and full-repayment refund/reset corridor across the supported premium terms, ad-hoc top-up blocking during active Premium-Free Period windows, the published S$2,500 minimum ad-hoc top-up in S$100 increments, the published S$500 minimum one-off partial withdrawal amount with S$100 increments, the published two-count free partial withdrawal cap from policy year 4 on the Regular Premium Account, and reinvest-default distribution support, while broader free partial withdrawal limits, minimum holding amount, account-routing administration, top-up product-highlights-sheet limits / approval timing, claim exclusions / insurer-side settlement mechanics, and distribution-paying fund thresholds and withdrawal consequences remain outside the calculator.`,
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'flexi-3'),
      buildVariant(context.document, 'flexi-5'),
      buildVariant(context.document, 'twenty'),
    ],
  }
}

export function parseEtiqaInvestFlexPrimeIi(context: ParseContext): IlpCatalogProduct {
  return buildProduct(context, 'prime-ii')
}

export function parseEtiqaInvestFlexPro(context: ParseContext): IlpCatalogProduct {
  return buildProduct(context, 'pro')
}

export function parseEtiqaInvestVista(context: ParseContext): IlpCatalogProduct {
  return buildProduct(context, 'vista')
}
