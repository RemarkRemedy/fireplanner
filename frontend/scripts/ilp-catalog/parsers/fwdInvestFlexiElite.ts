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

type FlexMode = 'flexi-3' | 'flexi-5'

const INITIAL_ACCOUNT_CHARGE_RATE = 0.025
const CONTRIBUTION_BONUS_RATE = 0.02

const BOOSTER_BONUS_TIERS: Record<FlexMode, Array<{ currency: 'SGD', minAnnualPremium: number | null, maxAnnualPremium: number | null, rate: number }>> = {
  'flexi-3': [
    { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.08 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.16 },
  ],
  'flexi-5': [
    { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.1 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.26 },
  ],
}

const REDEMPTION_FEE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE: Record<FlexMode, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  'flexi-3': [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  ],
  'flexi-5': [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  ],
}

const SURRENDER_CHARGE_SCHEDULE: Record<FlexMode, number[]> = {
  'flexi-3': [1, 1, 0.79, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05],
  'flexi-5': [1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.18, 0.12, 0.03],
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function flexModeLabel(flexMode: FlexMode): string {
  return flexMode === 'flexi-3' ? '10 years – (3 flexi)' : '10 years – (5 flexi)'
}

function buildInitialAccountChargeRule(page6: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'initial-account-charge',
    label: 'Initial Account Charge',
    basis: 'account-value',
    yearBasis: 'policy-year',
    rate: INITIAL_ACCOUNT_CHARGE_RATE,
    amount: 0,
    appliesTo: ['initial'],
    activeWindow: 'during-mip',
    notes: [
      'Models the published monthly initial-account charge on the initial-units-account value during the 10-year minimum investment term.',
      'The charge remains deductible even when regular premiums are not being paid during the minimum investment term.',
      'Pending-transaction deferral timing remains informational only in V1.',
    ],
    sourceRefs: [page6],
  }
}

function buildInsuranceChargeRule(page6: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'insurance-charge',
    label: 'Insurance Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['initial', 'accumulation'],
    assuranceValueAppliesTo: ['initial', 'accumulation'],
    activeWindow: 'policy-term',
    requiresManualInput: true,
    assuranceConfig: {
      formula: 'fwd-invest-flexi-elite-death',
      monthlyModalFactor: 1 / 12,
      maxAgeNextBirthday: 99,
    },
    notes: [
      'Requires insured-life details and the current net regular-premium and top-up-premium bases before the calculator can model the monthly insurance charge.',
      'Models the published 101% of total regular premiums paid plus total top-up premiums paid, less total withdrawals made, minus policy value sum-at-risk formula.',
      'The protection-benefit payout path and multi-life administration remain informational only in V1.',
    ],
    sourceRefs: [page6],
  }
}

function buildVariant(document: ExtractedPdfDocument, flexMode: FlexMode): IlpTemplateVariant {
  const variantLabel = flexModeLabel(flexMode)
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest Flexi Elite', 18))
  const page2 = sourceRef(2, 'Booster Bonus and Annual Premium Bonus', snippetNear(document, 2, 'Booster Bonus', 22))
  const page3 = sourceRef(3, 'Contribution Bonus and Involuntary Unemployment Benefit', snippetNear(document, 3, 'Contribution Bonus', 28))
  const page5 = sourceRef(5, 'Regular premium and top-up premium overview', snippetNear(document, 5, 'Regular Premium for FWD Invest Flexi Elite', 30))
  const page6 = sourceRef(6, 'Initial account charge and insurance charge', snippetNear(document, 6, 'Initial account charge', 26))
  const page6Insurance = sourceRef(6, 'Initial account charge and insurance charge', snippetNear(document, 6, 'Insurance charge is payable', 20))
  const page7 = sourceRef(7, 'Top-up premium charge and premium shortfall charge period', snippetNear(document, 7, 'Premium charge', 28))
  const page8 = sourceRef(8, 'Premium shortfall charge formula', snippetNear(document, 8, 'The premium shortfall charge =', 28))
  const page9 = sourceRef(9, 'Redemption fee', snippetNear(document, 9, 'Redemption fee rate', 24))
  const page10 = sourceRef(10, 'Surrender charge', snippetNear(document, 10, 'Surrender charge rate', 26))
  const page11 = sourceRef(11, 'Withdrawal option overview', snippetNear(document, 11, 'Withdrawal option and Free Partial Withdrawal Benefit', 28))
  const page12 = sourceRef(12, 'Partial withdrawal limits and minimum account value', snippetNear(document, 12, 'Partial withdrawal limit', 28))
  const page13 = sourceRef(13, 'Free Partial Withdrawal Benefit', snippetNear(document, 13, 'Free Partial Withdrawal Benefit', 28))
  const page17 = sourceRef(17, 'Dividend distribution options', snippetNear(document, 17, 'What are the options to manage my dividends', 28))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'booster-bonus',
      type: 'sign-up',
      label: 'Booster Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      annualPremiumTierBasis: 'committed-annual-premium-at-issue',
      rate: null,
      amount: null,
      tieredRates: BOOSTER_BONUS_TIERS[flexMode].map((tier) => ({ ...tier })),
      notes: [
        `Applied on each regular premium received during the first policy year for the ${variantLabel} corridor, using the published reward band based on annualised regular premium at issue.`,
        'Missed regular premiums simply do not earn Booster Bonus; changing the regular premium payment frequency after issue still remains informational only in V1.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'annual-premium-bonus',
      type: 'allocation',
      label: 'Annual Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: 0.02,
      amount: null,
      requiresPremiumsPaidUpToDate: true,
      requiredRegularPremiumPaymentFrequency: 'annual',
      tieredRates: [],
      notes: [
        'Applied once on the first regular premium when the policy is issued on the annual premium payment frequency option.',
        'Booster Bonus and Contribution Bonus are modeled on the published receipt basis; any later payment-frequency changes remain informational only in V1.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'contribution-bonus',
      type: 'allocation',
      label: 'Contribution Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: flexMode === 'flexi-3' ? 4 : 6,
      endPolicyYear: 10,
      rate: CONTRIBUTION_BONUS_RATE,
      amount: null,
      tieredRates: [],
      notes: [
        `Applied on each regular premium received during the published ${flexMode === 'flexi-3' ? 'policy-year-4-to-10' : 'policy-year-6-to-10'} Contribution Bonus Payment Period for the ${variantLabel} corridor.`,
        'Missed regular premiums simply do not earn Contribution Bonus, and the payment period is not extended.',
      ],
      sourceRefs: [page3],
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
        'V1 blocks top-ups in policy months where regular premiums are not paid up to date.',
        'Minimum top-up amount and investment-strategy routing remain informational only in V1.',
      ],
      sourceRefs: [page5, page7],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['initial'],
      fallbackAppliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE[flexMode].map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published premium shortfall charge for the ${variantLabel} corridor during its authored shortfall-charge period.`,
        'Mark the premium-holiday event with an insurer-approved charge waiver when an admitted Involuntary Unemployment Benefit approval waives the premium shortfall charge for that missed-premium period.',
        'Mark the same premium-holiday event as charge-refunded when the charge was deducted first and later refunded after admitted Involuntary Unemployment Benefit approval.',
        'Involuntary Unemployment Benefit approval history, waiting-period gating, and full-repayment restart timing remain informational only in V1.',
      ],
      sourceRefs: [page3, page7, page8],
    },
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
        `Models the published retrospective refund of deducted premium shortfall charge for the ${variantLabel} corridor after admitted Involuntary Unemployment Benefit approval.`,
        'Use the same premium-holiday event and mark it as charge-refunded when the charge was deducted between the unemployment date and claim notification date and later refunded.',
        'Waiting-period gating, approval history before the current projection start, and full-repayment restart timing remain informational only in V1.',
      ],
      sourceRefs: [page3, page8],
    },
    {
      id: 'initial-account-redemption-fee',
      label: 'Initial Account Redemption Fee',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['initial'],
      manualWaiverMode: 'capped-free-event',
      freeEventCount: 2,
      freeEventStartPolicyYear: 3,
      freeEventMaxAmountRate: 0.1,
      freeEventMaxAmountBasis: 'open-balance',
      rate: 0,
      amount: 0,
      rateSchedule: REDEMPTION_FEE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published initial-units-account redemption-fee schedule for the ${variantLabel} corridor.`,
        'Mark a partial-withdrawal event as charge-waived when an admitted Free Partial Withdrawal Benefit request qualifies that withdrawal for redemption-fee waiver treatment.',
        'When that qualifying flag is present from policy year 3 onward, the first two such withdrawals waive redemption fee only up to 10% of the initial-units-account value at the time of withdrawal; any excess remains chargeable.',
        'V1 blocks authored initial-units-account withdrawals before policy month 25 and enforces the published minimum-account-value floor on explicit one-off partial-withdrawal events.',
        'Partial-withdrawal limit formulas, minimum withdrawal amount, and regular-withdrawal elections remain informational only.',
        'Free Partial Withdrawal Benefit life-event eligibility and proof requirements remain informational only in V1.',
      ],
      sourceRefs: [page9, page11, page12, page13],
    },
  ]

  return {
    id: `sgd-mip-10-${flexMode}`,
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: 10,
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
        sourceRefs: [page1, page5, page6, page11, page12, page13],
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
        sourceRefs: [page5, page7, page11],
      },
    ],
    bonuses,
    feeRules: [
      buildInitialAccountChargeRule(page6),
      buildInsuranceChargeRule(page6Insurance),
    ],
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 10,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$10 minimum remain reinvested.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...SURRENDER_CHARGE_SCHEDULE[flexMode]],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'initial', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'initial', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
    },
    warnings: [
      `FWD Invest Flexi Elite (${variantLabel}) is cataloged as a supported V1 product. The parser captures the published Booster Bonus, Annual Premium Bonus, Contribution Bonus, initial-account-value charge, monthly insurance charge, premium shortfall charge with admitted-state Involuntary Unemployment Benefit charge-waiver and retrospective charge-refund support on premium-holiday events, 5% top-up premium charge with blocking below the published S$3,000 minimum and in policy months where regular premiums are not paid up to date, initial-units-account redemption-fee schedule with admitted-state Free Partial Withdrawal Benefit capped charge-waiver support on qualifying partial-withdrawal events, the initial-units-account policy-month-25 one-off partial-withdrawal gate with the published S$3,000 minimum-account-value floor, initial-units-account surrender-charge schedule, and reinvest-default distribution-mode assumption surface.`,
      'Involuntary Unemployment Benefit approval history, waiting-period gating, and full-repayment restart timing remain metadata-only.',
      'Payment-frequency changes after issue, Free Partial Withdrawal Benefit eligibility and proof requirements, and broader premium-flexibility behavior remain metadata-only beyond the modeled initial-account policy-month-25 gate and S$3,000 minimum-account-value floor for explicit one-off partial withdrawals.',
    ],
    unsupportedItems: [
      'Involuntary Unemployment Benefit approval history, waiting-period gating, and full-repayment restart timing remain informational only beyond the modeled explicit charge-waived / charge-refunded premium-holiday path.',
      'Changing the regular premium payment frequency after issue remains informational only.',
      'Free Partial Withdrawal Benefit life-event eligibility and proof requirements remain informational only beyond the modeled explicit charge-waived partial-withdrawal path with two lifetime capped redemption-fee waivers from policy year 3 onward.',
      'Partial-withdrawal limit formulas, minimum withdrawal requirements, and regular-withdrawal elections remain informational only beyond the modeled initial-account policy-month-25 gate and S$3,000 minimum-account-value floor.',
      'Regular-premium reduction and increase windows, investment-strategy routing gates, and premium-payment continuation after the minimum investment term remain informational only beyond the modeled S$3,000 minimum top-up amount.',
      'Policy closure charge, fund-switching review rights, pending-transaction sale timing, and change-of-policy-currency handling remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page5, page6, page7, page8, page9, page10, page11, page12, page13, page17],
  }
}

export function parseFwdInvestFlexiElite(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-flexi-elite',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest Flexi Elite',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:current-death-benefit-estimate',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-elite-booster-bonus',
      'branch:fwd-invest-flexi-elite-annual-premium-bonus',
      'branch:fwd-invest-flexi-elite-contribution-bonus',
      'branch:fwd-invest-flexi-elite-initial-account-charge',
      'branch:fwd-invest-flexi-elite-insurance-charge',
      'branch:fwd-invest-flexi-elite-premium-shortfall-charge',
      'branch:fwd-invest-flexi-elite-top-up-premium-charge',
      'branch:fwd-invest-flexi-elite-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-elite-initial-account-surrender-charge',
      'kernel:free-withdrawal-event-cap',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-flexi-elite-involuntary-unemployment-benefit',
      'fwd-invest-flexi-elite-premium-shortfall-charge-refund',
      'fwd-invest-flexi-elite-free-partial-withdrawal-eligibility-and-proof',
      'fwd-invest-flexi-elite-partial-withdrawal-limits',
      'fwd-invest-flexi-elite-premium-flexibility-gates',
      'fwd-invest-flexi-elite-regular-withdrawal-option',
      'fwd-invest-flexi-elite-policy-closure-charge',
      'fwd-invest-flexi-elite-fund-switching',
      'fwd-invest-flexi-elite-change-of-policy-currency',
    ],
    warnings: [
      'FWD Invest Flexi Elite is cataloged as a supported V1 product. The current parser covers the published current-state ordinary death benefit as the higher of 105% of policy value or 101% of the protected premium base, Booster Bonus, Annual Premium Bonus, Contribution Bonus, initial-account-value charge, monthly insurance charge, premium shortfall charge with admitted-state Involuntary Unemployment Benefit charge-waiver and retrospective charge-refund support on premium-holiday events, top-up premium charge with blocking below the published S$3,000 minimum and in policy months where regular premiums are not paid up to date, redemption-fee schedule with admitted-state Free Partial Withdrawal Benefit capped charge-waiver support on qualifying partial-withdrawal events, the initial-units-account policy-month-25 one-off partial-withdrawal gate with the published S$3,000 minimum-account-value floor, surrender-charge schedule, and reinvest-default distribution support that fit the existing kernels.',
      'Involuntary Unemployment Benefit approval history, waiting-period gating, full-repayment restart timing, Free Partial Withdrawal Benefit eligibility and proof requirements, and broader premium-flexibility behavior remain metadata-only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'flexi-3'),
      buildVariant(context.document, 'flexi-5'),
    ],
  }
}
