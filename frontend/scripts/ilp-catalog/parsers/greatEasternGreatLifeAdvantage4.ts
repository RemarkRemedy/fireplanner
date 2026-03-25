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

const PARTIAL_WITHDRAWAL_AND_SURRENDER_CHARGE = [1, 1] as const
const PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.76 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.51 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.26 },
  { startPolicyYear: 4, endPolicyYear: 6, rate: 0.04 },
  { startPolicyYear: 7, endPolicyYear: null, rate: 0 },
] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 12): string {
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
    rate,
  }))
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and protection scope', snippetNear(document, 1, 'GREAT Life Advantage 4 is a regular premium whole of life investment-linked policy', 18))
  const page5 = sourceRef(5, 'Premium charge and premium reward', snippetNear(document, 5, 'Premium charge for basic regular premium', 28))
  const page6 = sourceRef(6, 'Premium holiday and refund privilege', snippetNear(document, 6, 'Premium holiday and premium holiday charge', 30))
  const page10 = sourceRef(10, 'Single premium top-ups and partial withdrawal', snippetNear(document, 10, 'Single premium top-ups', 18))
  const page11 = sourceRef(11, 'Surrender charge and policy fee', snippetNear(document, 11, 'Surrender and surrender charge', 24))
  const page12 = sourceRef(12, 'Insurance charge and account mechanics', snippetNear(document, 12, 'Policy fee', 18))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'premium-reward',
      type: 'allocation',
      label: 'Premium Reward',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Adds 2% of each payment of basic regular premium from policy year 10 onward once the first nine policy years of base premium have been fully paid.',
        'Premium-stream resets after basic regular premium increases remain informational only in V1.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: PREMIUM_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'policy-term',
      notes: [
        'Models the published premium-year charge schedule on the basic regular premium stream.',
        'Any increase in basic regular premium starts a new premium stream with its own charge clock and remains informational only in V1.',
      ],
      sourceRefs: [page5, page6],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published S$5 monthly policy fee as a fixed S$60 annual drag.',
      ],
      sourceRefs: [page11, page12],
    },
    {
      id: 'insurance-charge',
      label: 'Insurance Charge',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'great-eastern-gla4-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Requires insured-life details plus the current basic sum assured and current net single-premium top-up base before the calculator can model the monthly insurance charge.',
        'Models the published net-sum-assured formula: basic sum assured plus total single-premium top-ups less total withdrawals including partial-withdrawal charges, minus account value.',
      ],
      sourceRefs: [page12],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_AND_SURRENDER_CHARGE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'Models the published monthly premium-holiday charge during the first two policy years as 100% of annualised basic regular premium divided by 12.',
        'Premium holiday after the first two policy years keeps the policy in force with ongoing deductions but no separate premium-holiday charge.',
      ],
      sourceRefs: [page6],
    },
    {
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
        'Refunds 100% of premium-holiday charges on reinstatement when the published first-two-policy-years conditions are met.',
        'The once-per-policy usage limit and the no-prior-withdrawal gate remain informational only in V1.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'top-up-premium-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% charge on each accepted single premium top-up.',
        'Single-premium top-ups below the published S$1,000 minimum are blocked.',
        'Single-premium top-ups are also blocked while a premium holiday is active or when due basic regular premiums are not paid up to date.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_AND_SURRENDER_CHARGE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies the published 100% partial-withdrawal charge in policy years 1 and 2.',
      ],
      sourceRefs: [page10, page11],
    },
  ]

  return {
    id: 'sgd-open-ended-regular-pay',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
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
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page10],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    },
    eecTable: [...PARTIAL_WITHDRAWAL_AND_SURRENDER_CHARGE],
    warnings: [
      'GREAT Life Advantage 4 is cataloged as a supported V1 corridor. The parser captures the premium-year regular premium charge schedule, the 2% premium reward path, the fixed S$5 monthly policy fee, the monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or current basic sum assured plus top-ups less withdrawals including withdrawal charges after current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current residual death-benefit estimate after a TPD claim today as account value when a manual Continuation Event status is set to triggered, the current TI benefit estimate after a TPD claim today as account value on the same supported continuation surface, the first-two-policy-years premium-holiday charge and refund privilege, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and the first-two-policy-years withdrawal / surrender charge schedule.',
      'Non-lapse guarantee debt carry, rider deductions, and basic-sum-assured / premium-stream state changes remain metadata only outside the modeled current snapshot.',
    ],
    unsupportedItems: [
      'The current-state death / terminal-illness / TPD benefit estimate needs manual current basic sum assured and current amount owing inputs because current debt and protected-base history are not reconstructed in V1.',
      'The current-state TPD estimate needs a manual remaining aggregate TPD cap input because Great Eastern’s S$5,000,000 aggregate TPD limit is not reconstructed across policies and riders in V1.',
      'The current residual death-benefit estimate after a TPD claim today and the current TI benefit estimate after a TPD claim today both need a manual Continuation Event status because qualifying Additional CI UDR attachment and in-force state at TPD admission are not reconstructed in V1.',
      'Non-lapse guarantee debt carry, rider continuation, and lapse/reinstatement sequencing after a Continuation Event remain informational only.',
      'Basic sum assured changes, GISA milestones, and premium-stream resets after regular-premium increases remain informational only.',
      'Rider-side charge deductions and rider continuation behavior remain informational only.',
      'Fund-level management fees, AFR, and fund switching remain informational only.',
      'Child cover, terminal-illness claim admission / exclusions / settlement, and other protection-benefit claim administration remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate and fee drag.',
    ],
    sourceRefs: [page1, page5, page6, page10, page11, page12],
  }
}

export function parseGreatEasternGreatLifeAdvantage4({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-great-life-advantage-4',
    insurer: 'Great Eastern',
    productName: 'GREAT Life Advantage 4',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
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
      'kernel:current-ti-benefit-after-tpd-estimate',
      'kernel:current-residual-death-benefit-after-tpd-estimate',
      'branch:great-life-advantage-4-premium-charge',
      'branch:great-life-advantage-4-premium-reward',
      'branch:great-life-advantage-4-policy-fee',
      'branch:great-life-advantage-4-insurance-charge',
      'branch:great-life-advantage-4-premium-holiday-charge',
      'branch:great-life-advantage-4-premium-holiday-charge-refund',
      'branch:great-life-advantage-4-top-up-charge',
      'branch:great-life-advantage-4-withdrawal-charge',
      'branch:great-life-advantage-4-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-paid-up-to-date-block',
    ],
    metadataOnlyBehaviors: [
      'great-life-advantage-4-non-lapse-guarantee-debt',
      'great-life-advantage-4-continuation-event',
      'great-life-advantage-4-basic-sum-assured-state',
      'great-life-advantage-4-regular-premium-stream-reset',
      'great-life-advantage-4-rider-charge-deductions',
      'great-life-advantage-4-child-cover',
      'great-life-advantage-4-gisa-option',
      'great-life-advantage-4-fund-level-fees',
      'great-life-advantage-4-afr-and-fund-switching',
    ],
    warnings: [
      'GREAT Life Advantage 4 is cataloged as a supported V1 corridor. The parser captures the premium-year regular premium charge schedule, premium reward, fixed policy fee, monthly insurance charge, the current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or current basic sum assured plus top-ups less withdrawals including withdrawal charges after current amount owing, with TPD capped by a manual remaining aggregate TPD cap, the current residual death-benefit estimate after a TPD claim today as account value when a manual Continuation Event status is set to triggered, the current TI benefit estimate after a TPD claim today as account value on the same supported continuation surface, first-two-policy-years premium-holiday charge and refund privilege, the published S$1,000 single-premium top-up minimum, premium-holiday and paid-up-to-date top-up blocking, and first-two-policy-years withdrawal / surrender charges, while non-lapse guarantee debt carry, rider-side continuation and deduction behavior, basic-sum-assured and premium-stream state changes, and broader protection-benefit claim handling remain informational only beyond the modeled current death / terminal-illness / TPD benefit estimate, current residual death-after-TPD estimate, current TI-after-TPD estimate, and fee drag.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
