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

const MIP_LENGTH = 10
const INITIAL_ACCOUNT_CHARGE_RATE = 0.0395
const SURRENDER_CHARGE_SCHEDULE = [1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09] as const
const BOOSTER_BONUS_TIERS = [
  { currency: 'SGD' as const, minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.02 },
  { currency: 'SGD' as const, minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.07 },
  { currency: 'SGD' as const, minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.09 },
  { currency: 'SGD' as const, minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.12 },
  { currency: 'SGD' as const, minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.15 },
]

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Booster Bonus', snippetNear(document, 2, 'Booster Bonus', 28))
  const page3 = sourceRef(3, 'Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 28))
  const page4 = sourceRef(4, 'Perpetual Bonus', snippetNear(document, 4, 'Perpetual Bonus', 24))

  return [
    {
      id: 'booster-bonus',
      type: 'sign-up',
      label: 'Booster Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 3,
      rate: null,
      amount: null,
      tieredRates: BOOSTER_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Models the published Booster Bonus rates for the supported 10-year premium-payment-term corridor, applied on each regular premium received during the first 3 policy years.',
        'Top-up premiums do not earn Booster Bonus.',
      ],
      sourceRefs: [page2, page3],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: 10,
      rate: 0.006,
      amount: null,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published during-premium-term Loyalty Bonus for the supported 10-year premium-payment-term corridor.',
        'Pending-transaction timing remains informational only in V1.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'perpetual-bonus',
      type: 'loyalty',
      label: 'Perpetual Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: null,
      rate: 0.01,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published 1.00% p.a. Perpetual Bonus on accumulation-units-account value from the policy year after the end of the premium payment term.',
        'Pending-transaction timing and policy-in-force qualification remain informational only in V1.',
      ],
      sourceRefs: [page4],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Summit', 24))
  const page4 = sourceRef(4, 'Regular premium and top-up overview', snippetNear(document, 4, 'Regular Premium', 26))
  const page5 = sourceRef(5, 'Initial account charge', snippetNear(document, 5, 'Initial account charge', 28))
  const page6 = sourceRef(6, 'Accumulation account charge and top-up premium charge', snippetNear(document, 6, 'Accumulation account charge', 28))
  const page7 = sourceRef(7, 'Premium shortfall charge', snippetNear(document, 7, 'Premium shortfall charge', 28))
  const page8 = sourceRef(8, 'Premium reduction charge and redemption fee', snippetNear(document, 8, 'Premium reduction charge', 30))
  const page9 = sourceRef(9, 'Withdrawal options and minimum account value', snippetNear(document, 9, 'Withdrawal options', 30))
  const page10 = sourceRef(10, 'Partial and regular withdrawal rules', snippetNear(document, 10, 'Partial withdrawal', 26))
  const page20 = sourceRef(20, 'Support benefit exclusions and policy termination', snippetNear(document, 20, 'no premium shortfall charge', 24))
  const page22 = sourceRef(22, 'Appendix A surrender charge rate', snippetNear(document, 22, 'Appendix A – Surrender charge rate', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: INITIAL_ACCOUNT_CHARGE_RATE,
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published 3.95% p.a. initial-account charge for the 10-year premium-payment-term base-layer corridor.',
        'The charge remains deductible even when regular premiums are not paid during the premium payment term.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'accumulation-account-charge',
      label: 'Accumulation Account Charge',
      basis: 'premium-base-mip-multiplier-capped-account-value',
      yearBasis: 'policy-year',
      rate: 0.015,
      amount: 0,
      appliesTo: ['accumulation'],
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        capRate: 0.007,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
        ],
      },
      activeWindow: 'policy-term',
      notes: [
        'Models the published accumulation-account charge as the lower of 1.50% p.a. of accumulation-account value or 0.70% p.a. of the 10-year premium base at issue.',
        'The cap remains anchored to the annualised regular premium committed at the effective date, matching the published formula.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
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
        'V1 blocks top-ups below the published S$3,000 minimum, before policy month 13, and in policy months where regular premiums are not paid up to date.',
        'The lifetime top-up cap remains informational only in V1.',
      ],
      sourceRefs: [page4, page6],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      rate: 0.09,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published 9% p.a. premium shortfall charge on unpaid premiums after 24 continuous months of missed premiums during the premium payment term.',
        'Mark the premium-holiday event with an insurer-approved charge waiver when an admitted Support Benefit approval waives the premium shortfall charge for that missed-premium period.',
        'Mark the same premium-holiday event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
        'Support Benefit approval history, reinstatement timing, and accumulation of outstanding unpaid charges remain informational only.',
      ],
      sourceRefs: [page7, page20],
    },
    {
      id: 'premium-shortfall-charge-refund',
      label: 'Premium Shortfall Charge Refund',
      trigger: 'premium-holiday',
      basis: 'source-event-charge-refund',
      appliesTo: ['accumulation'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-shortfall-charge',
      notes: [
        'Models the published retrospective refund of deducted premium shortfall charge after admitted Support Benefit approval.',
        'Use the same premium-holiday event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
        'Approval history before the current projection start, reinstatement timing, and broader unpaid-charge accumulation remain informational only.',
      ],
      sourceRefs: [page7, page20],
    },
    {
      id: 'premium-reduction-charge',
      label: 'Premium Reduction Charge',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      rateSchedule: [
        { startPolicyYear: 3, endPolicyYear: 4, rate: 0.09 },
      ],
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published 9% p.a. premium reduction charge on the reduced annualised regular premium during policy years 3 to 4 for the 10-year corridor.',
        'Mark the reduction event with an insurer-approved charge waiver when an admitted Support Benefit approval waives the premium reduction charge for that period.',
        'Mark the same reduction event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
        'Support Benefit approval history and subsequent premium restorations remain informational only.',
      ],
      sourceRefs: [page8, page20],
    },
    {
      id: 'premium-reduction-charge-refund',
      label: 'Premium Reduction Charge Refund',
      trigger: 'regular-premium-reduction',
      basis: 'source-event-charge-refund',
      appliesTo: ['accumulation'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-reduction-charge',
      notes: [
        'Models the published retrospective refund of deducted premium reduction charge after admitted Support Benefit approval.',
        'Use the same reduction event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
        'Approval history before the current projection start and later premium restorations remain informational only.',
      ],
      sourceRefs: [page8, page20],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'No redemption fee is stated for withdrawals.',
        'During the premium payment term, the executable path assumes authored one-off withdrawals only from the accumulation units account from the 25th policy month onward.',
        'The executable path blocks authored partial withdrawals that would leave the monitored remaining value below the published minimum-account-value threshold.',
        'Initial-units-account withdrawal lockout after the premium payment term, regular-withdrawal timing, and minimum withdrawal amount remain informational only.',
      ],
      sourceRefs: [page8, page9, page10],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: MIP_LENGTH,
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
        sourceRefs: [page1, page4, page5, page9, page22],
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
        sourceRefs: [page4, page6, page7, page9, page10],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      minimumTopUpStartPolicyMonth: 13,
    },
    warnings: [
      'FWD Invest First Summit is cataloged as a supported V1 corridor. The parser captures the SGD 10-year premium-payment corridor only: initial-account charge, capped accumulation-account charge, top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and in policy months where regular premiums are not paid up to date, premium shortfall charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on premium-holiday events, premium reduction charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on reduction events, zero redemption fee on the executable one-off partial-withdrawal path with accumulation-account start-month and minimum-remaining-value gating, the published Booster Bonus rates for policy years 1 to 3, the published 0.6% p.a. during-premium-term Loyalty Bonus for policy years 4 to 10, the published 1.0% p.a. Perpetual Bonus on accumulation-units-account value from policy year 11 onward, the 10-year surrender-charge schedule, and the current-state death-benefit estimate as 105% of policy value.',
      'Support Benefit approval history, multi-life last-survivor handling, and broader policy-flexibility behavior remain outside the current engine.',
    ],
    unsupportedItems: [
      'Booster Bonus pending-transaction timing and reward-band change notices remain informational only beyond the modeled 10-year-corridor bonus rates.',
      'Loyalty Bonus pending-transaction timing remains informational only beyond the modeled published 0.6% p.a. during-premium-term bonus rate and the published adjustment-factor formula.',
      'Perpetual Bonus qualification and pending-transaction timing remain informational only beyond the modeled published 1.0% p.a. accumulation-account bonus rate.',
      'Support Benefit approval history, premium-shortfall recovery state, and outstanding-charge accumulation remain informational only beyond the modeled explicit charge-waived / charge-refunded event path.',
      'Multi-life last-survivor handling and change-of-person-insured behavior remain informational only beyond the modeled current ordinary death-benefit amount.',
      'Top-up cap, minimum withdrawal amount, regular withdrawal scheduling, and initial-units-account withdrawal rules beyond the modeled S$3,000 top-up minimum and the modeled accumulation-account one-off path remain informational only.',
      'Policy closure charge, change-of-policy-currency handling, switching-fee review rights, and fund management charges remain informational only.',
    ],
    sourceRefs: [page1, page4, page5, page6, page7, page8, page9, page10, page20, page22],
  }
}

export function parseFwdInvestFirstSummit(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-first-summit',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Summit',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:fwd-invest-first-summit-initial-account-charge',
      'branch:fwd-invest-first-summit-accumulation-account-charge',
      'branch:fwd-invest-first-summit-top-up-premium-charge',
      'branch:fwd-invest-first-summit-premium-shortfall-charge',
      'branch:fwd-invest-first-summit-premium-reduction-charge',
      'branch:fwd-invest-first-summit-zero-redemption-fee',
      'branch:fwd-invest-first-summit-booster-bonus',
      'branch:fwd-invest-first-summit-loyalty-bonus',
      'branch:fwd-invest-first-summit-perpetual-bonus',
      'branch:fwd-invest-first-summit-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-first-summit-policy-closure-charge',
      'fwd-invest-first-summit-fund-management-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-summit-support-benefit-waiver-and-refund',
      'fwd-invest-first-summit-multi-life-last-survivor',
      'fwd-invest-first-summit-change-of-person-insured',
      'fwd-invest-first-summit-minimum-withdrawal-rules',
      'fwd-invest-first-summit-change-of-policy-currency',
    ],
    warnings: [
      'FWD Invest First Summit is cataloged as a supported V1 corridor. The current parser covers the SGD 10-year premium-payment corridor: initial-account charge, capped accumulation-account charge, top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and in policy months where regular premiums are not paid up to date, premium shortfall charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on premium-holiday events, premium reduction charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on reduction events, zero redemption fee on the executable withdrawal path, the published Booster Bonus rates for policy years 1 to 3, the published 0.6% p.a. during-premium-term Loyalty Bonus for policy years 4 to 10, the published 1.0% p.a. Perpetual Bonus on accumulation-units-account value from policy year 11 onward, the 10-year surrender-charge schedule, and the current-state death-benefit estimate as 105% of policy value.',
      'Support Benefit approval history, multi-life last-survivor handling, and broader policy-flexibility behavior remain metadata-only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
