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

type Ilp2Choice = 'choice-5' | 'choice-10-under-6000' | 'choice-10-6000-and-above'

const CHOICE_5_WITHDRAWAL_AND_SURRENDER = [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05]
const CHOICE_10_WITHDRAWAL_AND_SURRENDER = [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05]
const CHOICE_5_PREMIUM_HOLIDAY = [1, 1, 0.75, 0.6, 0.45, 0.5]
const CHOICE_10_PREMIUM_HOLIDAY = [1, 1, 0.75, 0.75, 0.75, 0, 0.5, 0.5, 0.25, 0.25]
const POLICY_FEE_RATE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
  { startPolicyYear: 11, endPolicyYear: null, rate: 0.007 },
] as const
const CHOICE_10_FIXED_POLICY_FEE = 60

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

function buildBonuses(
  choice: Ilp2Choice,
  page2: IlpCatalogSourceRef,
  page3: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  const isChoice5 = choice === 'choice-5'

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
      tieredRates: isChoice5 ? buildChoice5WelcomeTiers() : buildChoice10WelcomeTiers(),
      notes: [
        'Applied to each payment of basic regular premium during the first policy year only.',
        'No Welcome Bonus is paid while the policy is on premium holiday.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'premium-bonus',
      type: 'allocation',
      label: 'Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: isChoice5 ? 6 : 11,
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
      sourceRefs: [page2, page3],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Applied annually from the end of the 10th policy year onward.',
        'No Loyalty Bonus is payable for a policy year in which any partial withdrawal occurred.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(
  choice: Ilp2Choice,
  page10: IlpCatalogSourceRef,
  page11: IlpCatalogSourceRef,
  page16: IlpCatalogSourceRef,
  page17: IlpCatalogSourceRef,
): IlpTemplateFeeRule[] {
  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'policy-fee-rate',
      label: 'Policy Fee',
      basis: 'account-value',
      rate: 0,
      rateSchedule: POLICY_FEE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
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

  if (choice === 'choice-10-under-6000') {
    feeRules.push({
      id: 'policy-fee-fixed-low-annualised-premium',
      label: 'Additional Fixed Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: CHOICE_10_FIXED_POLICY_FEE },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the additional S$5 monthly policy fee for Choice 10 where prevailing Annualised Premium is below S$6,000.',
        'Use the high-annualised-premium Choice 10 variant instead when prevailing Annualised Premium is at least S$6,000.',
      ],
      sourceRefs: [page10],
    })
  }

  return feeRules
}

function buildEventChargeRules(
  choice: Ilp2Choice,
  page4: IlpCatalogSourceRef,
  page5: IlpCatalogSourceRef,
  page8: IlpCatalogSourceRef,
): IlpTemplateEventChargeRule[] {
  const isChoice5 = choice === 'choice-5'
  const premiumHolidaySchedule = isChoice5 ? CHOICE_5_PREMIUM_HOLIDAY : CHOICE_10_PREMIUM_HOLIDAY
  const withdrawalSchedule = isChoice5 ? CHOICE_5_WITHDRAWAL_AND_SURRENDER : CHOICE_10_WITHDRAWAL_AND_SURRENDER
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
      sourceRefs: [page5],
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

  if (!isChoice5) {
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
        'Refunds 100% of premium-holiday charges for Choice 10 when the published accepted-application refund path is used.',
        'The one-time application limit, six-month lookback, and accepted-application gating remain informational only in V1.',
      ],
      sourceRefs: [page5],
    })
  }

  return eventChargeRules
}

function buildVariant(
  document: ExtractedPdfDocument,
  choice: Ilp2Choice,
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Choice 5 and Choice 10', 12))
  const page2 = sourceRef(2, 'Welcome bonus and premium bonus', snippetNear(document, 2, 'Welcome bonus', 22))
  const page3 = sourceRef(3, 'Premium bonus continuation and loyalty bonus', snippetNear(document, 3, 'Loyalty bonus', 20))
  const page4 = sourceRef(4, 'Premium holiday charge', snippetNear(document, 4, 'Premium holiday charge', 22))
  const page5 = sourceRef(5, 'Premium holiday charge refund and top-ups', snippetNear(document, 5, 'Premium holiday charge refund', 22))
  const page8 = sourceRef(8, 'Partial withdrawal and surrender charges', snippetNear(document, 8, 'Partial withdrawal charge', 24))
  const page10 = sourceRef(10, 'Policy fee', snippetNear(document, 10, 'Policy fee', 18))
  const page11 = sourceRef(11, 'Insurance charge', snippetNear(document, 11, 'insurance charge', 18))
  const page16 = sourceRef(16, 'Appendix insurance charge rates 1-78', snippetNear(document, 16, 'Rates of insurance charge', 18))
  const page17 = sourceRef(17, 'Appendix insurance charge rates 79-99', snippetNear(document, 17, '79', 18))

  const isChoice5 = choice === 'choice-5'
  const variantId = isChoice5
    ? 'sgd-mip-10-choice-5'
    : choice === 'choice-10-under-6000'
      ? 'sgd-mip-10-choice-10-under-6000'
      : 'sgd-mip-10-choice-10-6000-and-above'
  const eecTable = isChoice5 ? CHOICE_5_WITHDRAWAL_AND_SURRENDER : CHOICE_10_WITHDRAWAL_AND_SURRENDER

  return {
    id: variantId,
    currency: 'SGD',
    mipLength: 10,
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
        sourceRefs: [page1, page5],
      },
    ],
    bonuses: buildBonuses(choice, page2, page3),
    feeRules: buildFeeRules(choice, page10, page11, page16, page17),
    eventChargeRules: buildEventChargeRules(choice, page4, page5, page8),
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    },
    eecTable: [...eecTable],
    warnings: [
      'Investment-linked Insurance Plan 2 is modeled as a supported V1 corridor. The parser captures Welcome Bonus, Premium Bonus, Loyalty Bonus, policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101% paid-premium floor after partial withdrawals including withdrawal charges and current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, premium-holiday charge, the Choice 10 premium-holiday-charge refund path, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and the published partial-withdrawal / surrender charge schedules.',
      'TPD continuation-event behavior, rider-premium deductions from account value, change-of-life-assured mechanics, AFR administration, and terminal-illness exclusions / settlement / broader post-claim continuation remain informational only in V1.',
      ...(choice === 'choice-10-under-6000'
        ? ['This Choice 10 low-annualised-premium variant assumes the additional S$5 monthly policy fee applies throughout the modeled path unless you manually switch variants after a premium change.']
        : choice === 'choice-10-6000-and-above'
          ? ['This Choice 10 high-annualised-premium variant assumes the additional S$5 monthly policy fee does not apply throughout the modeled path unless you manually switch variants after a premium change.']
          : []),
    ],
    unsupportedItems: [
      'The current-state death / terminal-illness / TPD benefit estimate needs a manual current amount owing input because current debt is not reconstructed from history in V1.',
      'The current-state TPD benefit estimate also needs a manual remaining aggregate TPD cap because the published S$5 million aggregate insurer limit is not reconstructed from cross-policy history in V1.',
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state, but TPD continuation-event state plus terminal-illness exclusions / settlement / broader post-claim continuation remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate.',
      'Administrative gating on premium reductions, change of life assured, and AFR remains informational only.',
      ...(choice === 'choice-10-under-6000' || choice === 'choice-10-6000-and-above'
        ? ['Choice 10 prevailing-annualised-premium transitions across the S$6,000 fixed-fee threshold are not modeled dynamically; switch variants manually if the threshold changes after a premium reduction.']
        : []),
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page8, page10, page11, page16, page17],
  }
}

export function parseGreatEasternInvestmentLinkedInsurancePlan2(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-investment-linked-insurance-plan-2',
    insurer: 'Great Eastern',
    productName: 'Investment-linked Insurance Plan 2',
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
      'branch:great-eastern-ilp2-welcome-bonus',
      'branch:great-eastern-ilp2-premium-bonus',
      'branch:great-eastern-ilp2-loyalty-bonus',
      'branch:great-eastern-ilp2-policy-fee-rate',
      'branch:great-eastern-ilp2-choice10-fixed-policy-fee',
      'branch:great-eastern-ilp2-insurance-charge',
      'branch:great-eastern-ilp2-premium-holiday-charge',
      'branch:great-eastern-ilp2-premium-holiday-charge-refund',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'branch:great-eastern-ilp2-top-up-premium-charge',
      'branch:great-eastern-ilp2-partial-withdrawal-charge',
      'branch:great-eastern-ilp2-surrender-charge',
    ],
    coveredElsewhereBehaviors: ['great-eastern-ilp2-choice10-fixed-fee-threshold-transition'],
    metadataOnlyBehaviors: [
      'great-eastern-ilp2-tpd-continuation-event',
      'great-eastern-ilp2-rider-premium-deduction-treatment',
      'great-eastern-ilp2-change-of-life-assured',
      'great-eastern-ilp2-automatic-fund-rebalancing-administration',
    ],
    warnings: [
      'Investment-linked Insurance Plan 2 is cataloged as a supported V1 corridor. The parser captures the published bonus path, policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals including withdrawal charges and current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, premium-holiday charge, the Choice 10 premium-holiday-charge refund path, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and partial-withdrawal / surrender schedules, while TPD continuation-event state, rider premium-deduction treatment, Choice 10 fixed-fee-threshold transitions, change-of-life-assured handling, automatic fund rebalancing administration, and terminal-illness exclusions / settlement / broader post-claim continuation remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'choice-5'),
      buildVariant(context.document, 'choice-10-under-6000'),
      buildVariant(context.document, 'choice-10-6000-and-above'),
    ],
  }
}
