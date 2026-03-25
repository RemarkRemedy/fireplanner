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

type GreatWealthChoice =
  | 'choice-5'
  | 'choice-10-under-6000'
  | 'choice-10-6000-and-above'
  | 'choice-15-under-6000'
  | 'choice-15-6000-and-above'

const CHOICE_5_WITHDRAWAL_AND_SURRENDER = [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05]
const CHOICE_10_WITHDRAWAL_AND_SURRENDER = [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05]
const CHOICE_15_WITHDRAWAL_AND_SURRENDER = [1, 1, 0.8, 0.6, 0.5, 0.5, 0.45, 0.3, 0.25, 0.15, 0.1, 0.08, 0.08, 0.07, 0.07]
const CHOICE_5_PREMIUM_HOLIDAY = [1, 1, 0.75, 0.6, 0.45, 0.5]
const CHOICE_10_PREMIUM_HOLIDAY = [1, 1, 0.75, 0.75, 0.75, 0, 0.5, 0.5, 0.25, 0.25]
const CHOICE_15_PREMIUM_HOLIDAY = [1, 1, 0.8, 0.8, 0.8, 0.6, 0.6, 0.6, 0.5, 0.5, 0.4, 0.4, 0.4, 0.2, 0.2]
const CHOICE_15_POLICY_FEE_RATE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 15, rate: 0.015 },
  { startPolicyYear: 16, endPolicyYear: null, rate: 0.007 },
] as const
const DEFAULT_POLICY_FEE_RATE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
  { startPolicyYear: 11, endPolicyYear: null, rate: 0.007 },
] as const
const FIXED_POLICY_FEE = 60

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
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

function isChoice5(choice: GreatWealthChoice): boolean {
  return choice === 'choice-5'
}

function isChoice10(choice: GreatWealthChoice): boolean {
  return choice === 'choice-10-under-6000' || choice === 'choice-10-6000-and-above'
}

function isChoice15(choice: GreatWealthChoice): boolean {
  return choice === 'choice-15-under-6000' || choice === 'choice-15-6000-and-above'
}

function needsFixedPolicyFee(choice: GreatWealthChoice): boolean {
  return choice === 'choice-10-under-6000' || choice === 'choice-15-under-6000'
}

function buildChoice5WelcomeTiers(): IlpTemplateBonusTier[] {
  return [
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.15 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
  ]
}

function buildChoice10WelcomeTiers(): IlpTemplateBonusTier[] {
  return [
    { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 3_599.99, rate: 0.05 },
    { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 5_999.99, rate: 0.1 },
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.2 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.4 },
  ]
}

function buildChoice15WelcomeTiers(): IlpTemplateBonusTier[] {
  return [
    { currency: 'SGD', minAnnualPremium: 1_200, maxAnnualPremium: 2_399.99, rate: 0.075 },
    { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 3_599.99, rate: 0.15 },
    { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 5_999.99, rate: 0.25 },
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.3 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.55 },
  ]
}

function buildBonuses(
  choice: GreatWealthChoice,
  page3: IlpCatalogSourceRef,
  page4: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  const welcomeTiers = isChoice5(choice)
    ? buildChoice5WelcomeTiers()
    : isChoice10(choice)
      ? buildChoice10WelcomeTiers()
      : buildChoice15WelcomeTiers()

  return [
    {
      id: 'welcome-bonus',
      type: 'allocation',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: welcomeTiers,
      notes: [
        'Applied to each payment of basic regular premium during the first policy year only.',
        'No Welcome Bonus is paid while the policy is on premium holiday.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'premium-bonus',
      type: 'allocation',
      label: 'Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: isChoice5(choice) ? 6 : isChoice10(choice) ? 11 : 16,
      endPolicyYear: null,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Applied to each payment of basic regular premium from the published start year onward.',
        'Payment ceases when premiums are not paid up to date or when a partial withdrawal occurred in the prior 12 months, and resumes when the published conditions are satisfied again.',
        'Basic regular premium falling due during premium holiday does not earn Premium Bonus even if later repaid.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: isChoice15(choice) ? 15 : 10,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        `Applied annually from the end of the ${isChoice15(choice) ? 15 : 10}th policy year onward.`,
        'No Loyalty Bonus is payable for a policy year in which any partial withdrawal occurred.',
      ],
      sourceRefs: [page4],
    },
  ]
}

function buildFeeRules(
  choice: GreatWealthChoice,
  page10: IlpCatalogSourceRef,
  page11: IlpCatalogSourceRef,
  page16: IlpCatalogSourceRef,
  page17: IlpCatalogSourceRef,
): IlpTemplateFeeRule[] {
  const rateSchedule = isChoice15(choice) ? CHOICE_15_POLICY_FEE_RATE_SCHEDULE : DEFAULT_POLICY_FEE_RATE_SCHEDULE
  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'policy-fee-rate',
      label: 'Policy Fee',
      basis: 'account-value',
      rate: 0,
      rateSchedule: rateSchedule.map((tier) => ({ ...tier })),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Modeled as the published percentage-based monthly policy fee on account value.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'death-ti-insurance-charge',
      label: 'Death / TI Insurance Charge',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'great-eastern-wa4-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Requires insured-life details plus the current net regular-premium and top-up premium bases before the calculator can model the monthly insurance charge.',
        'Models the published 101% of total basic regular premiums paid plus 101% of total single premium top-ups paid, less 101% of total partial withdrawals including charges, minus policy value sum-at-risk formula.',
      ],
      sourceRefs: [page11, page16, page17],
    },
  ]

  if (needsFixedPolicyFee(choice)) {
    feeRules.push({
      id: 'policy-fee-fixed-low-annualised-premium',
      label: 'Additional Fixed Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: FIXED_POLICY_FEE },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the additional S$5 monthly policy fee for Choice 10 / Choice 15 where prevailing Annualised Premium is below S$6,000.',
        'Use the matching high-annualised-premium variant instead when prevailing Annualised Premium is at least S$6,000.',
      ],
      sourceRefs: [page10],
    })
  }

  return feeRules
}

function buildEventChargeRules(
  choice: GreatWealthChoice,
  page4: IlpCatalogSourceRef,
  page5: IlpCatalogSourceRef,
  page6: IlpCatalogSourceRef,
  page8: IlpCatalogSourceRef,
): IlpTemplateEventChargeRule[] {
  const premiumHolidaySchedule = isChoice5(choice)
    ? CHOICE_5_PREMIUM_HOLIDAY
    : isChoice10(choice)
      ? CHOICE_10_PREMIUM_HOLIDAY
      : CHOICE_15_PREMIUM_HOLIDAY
  const withdrawalSchedule = isChoice5(choice)
    ? CHOICE_5_WITHDRAWAL_AND_SURRENDER
    : isChoice10(choice)
      ? CHOICE_10_WITHDRAWAL_AND_SURRENDER
      : CHOICE_15_WITHDRAWAL_AND_SURRENDER
  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(premiumHolidaySchedule),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'Charged monthly during premium holiday based on the prevailing Annualised Premium.',
      ],
      sourceRefs: [page4, page5],
    },
    {
      id: 'top-up-premium-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies a 3% upfront charge on each accepted single premium top-up.',
        'Single-premium top-ups below the published S$1,000 minimum are blocked.',
        'Single-premium top-ups are also blocked while a premium holiday is active or when due basic regular premiums are not paid up to date.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(withdrawalSchedule),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies to partial withdrawals according to the published policy-year schedule.',
      ],
      sourceRefs: [page8],
    },
  ]

  if (!isChoice5(choice)) {
    eventChargeRules.splice(1, 0, {
      id: 'premium-holiday-charge-refund',
      label: 'Premium Holiday Charge Refund',
      trigger: 'premium-holiday-repayment',
      basis: 'premium-holiday-charge-refund',
      appliesTo: ['policy'],
      rate: 1,
      rateSchedule: [],
      amount: 0,
      sourceChargeRuleId: 'premium-holiday-charge',
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-contribution-share',
      notes: [
        'Refunds 100% of premium-holiday charges when the published accepted-application refund path is used.',
        'The one-time application limit, six-month lookback, and accepted-application gating remain informational only in V1.',
      ],
      sourceRefs: [page5],
    })
  }

  return eventChargeRules
}

function buildVariant(
  document: ExtractedPdfDocument,
  choice: GreatWealthChoice,
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Choice 15', 12))
  const page3 = sourceRef(3, 'Welcome bonus and premium bonus', snippetNear(document, 3, 'Welcome bonus', 24))
  const page4 = sourceRef(4, 'Premium bonus continuation, loyalty bonus, and premium holiday', snippetNear(document, 4, 'Loyalty bonus', 24))
  const page5 = sourceRef(5, 'Premium holiday charge refund', snippetNear(document, 5, 'Premium holiday charge refund', 24))
  const page6 = sourceRef(6, 'Single premium top-ups', snippetNear(document, 6, 'Single premium top-ups', 18))
  const page8 = sourceRef(8, 'Partial withdrawal and surrender charges', snippetNear(document, 8, 'Partial withdrawal charge', 24))
  const page10 = sourceRef(10, 'Policy fee', snippetNear(document, 10, 'Policy fee', 20))
  const page11 = sourceRef(11, 'Insurance charge', snippetNear(document, 11, 'Insurance charge', 24))
  const page16 = sourceRef(16, 'Appendix insurance charge rates 1-78', snippetNear(document, 16, 'Appendix', 18))
  const page17 = sourceRef(17, 'Appendix insurance charge rates 79-99', snippetNear(document, 17, 'Age Next', 18))

  const choiceSuffix = choice
  const mipLength = isChoice15(choice) ? 15 : 10
  const eecTable = isChoice5(choice)
    ? CHOICE_5_WITHDRAWAL_AND_SURRENDER
    : isChoice10(choice)
      ? CHOICE_10_WITHDRAWAL_AND_SURRENDER
      : CHOICE_15_WITHDRAWAL_AND_SURRENDER

  return {
    id: `sgd-mip-${mipLength}-${choiceSuffix}`,
    currency: 'SGD',
    mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6],
      },
    ],
    bonuses: buildBonuses(choice, page3, page4),
    feeRules: buildFeeRules(choice, page10, page11, page16, page17),
    eventChargeRules: buildEventChargeRules(choice, page4, page5, page6, page8),
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    },
    eecTable: [...eecTable],
    warnings: [
      'GREAT Wealth Advantage 4 is modeled as a supported V1 corridor. The parser captures Welcome Bonus, Premium Bonus, Loyalty Bonus, policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101% paid-premium floor after partial withdrawals including withdrawal charges and current amount owing, with TPD capped by a manual remaining aggregate TPD cap, premium-holiday charge, the premium-holiday-charge refund path, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and the published partial-withdrawal / surrender charge schedules.',
      ...(needsFixedPolicyFee(choice)
        ? ['This low-annualised-premium variant assumes the additional S$5 monthly policy fee applies throughout the modeled path unless you manually switch variants after a premium change.']
        : isChoice10(choice) || isChoice15(choice)
          ? ['This high-annualised-premium variant assumes the additional S$5 monthly policy fee does not apply throughout the modeled path unless you manually switch variants after a premium change.']
          : []),
    ],
    unsupportedItems: [
      'The current-state death / terminal-illness / TPD benefit estimate needs a manual current amount owing input because current debt is not reconstructed from history in V1.',
      'The current-state TPD estimate needs a manual remaining aggregate TPD cap input because Great Eastern’s S$5,000,000 aggregate TPD limit is not reconstructed across policies and riders in V1.',
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state, but TPD continuation-event state plus terminal-illness exclusions, settlement, and broader post-claim continuation remain informational only.',
      'Administrative gating on premium reductions, change of life assured, and AFR remains informational only.',
      ...(isChoice10(choice) || isChoice15(choice)
        ? ['Prevailing-annualised-premium transitions across the S$6,000 fixed-fee threshold are not modeled dynamically; switch variants manually if the threshold changes after a premium reduction.']
        : []),
    ],
    sourceRefs: [page1, page3, page4, page5, page6, page8, page10, page11, page16, page17],
  }
}

export function parseGreatEasternWealthAdvantage4(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-wealth-advantage-4',
    insurer: 'Great Eastern',
    productName: 'GREAT Wealth Advantage 4',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-tpd-benefit-estimate',
      'branch:great-eastern-wa4-welcome-bonus',
      'branch:great-eastern-wa4-premium-bonus',
      'branch:great-eastern-wa4-loyalty-bonus',
      'branch:great-eastern-wa4-policy-fee-rate',
      'branch:great-eastern-wa4-fixed-policy-fee',
      'branch:great-eastern-wa4-insurance-charge',
      'branch:great-eastern-wa4-premium-holiday-charge',
      'branch:great-eastern-wa4-premium-holiday-charge-refund',
      'branch:great-eastern-wa4-top-up-premium-charge',
      'branch:great-eastern-wa4-partial-withdrawal-charge',
      'branch:great-eastern-wa4-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-paid-up-to-date-block',
    ],
    metadataOnlyBehaviors: [
      'great-eastern-wa4-tpd-continuation-event',
      'great-eastern-wa4-rider-premium-deduction-treatment',
      'great-eastern-wa4-fixed-fee-threshold-transition',
      'great-eastern-wa4-change-of-life-assured',
      'great-eastern-wa4-automatic-fund-rebalancing-administration',
    ],
    warnings: [
      'GREAT Wealth Advantage 4 is cataloged as a supported V1 corridor. The parser captures the published bonus path, policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals including withdrawal charges and current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, premium-holiday charge, the premium-holiday-charge refund path, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and partial-withdrawal / surrender schedules, while TPD continuation-event state, terminal-illness exclusions / settlement / broader post-claim continuation, and administrative gating on premium reductions, change of life assured, and AFR remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'choice-5'),
      buildVariant(context.document, 'choice-10-under-6000'),
      buildVariant(context.document, 'choice-10-6000-and-above'),
      buildVariant(context.document, 'choice-15-under-6000'),
      buildVariant(context.document, 'choice-15-6000-and-above'),
    ],
  }
}
