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

const REGULAR_PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.2 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.1 },
  { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
] as const

const PREMIUM_HOLIDAY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
  { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
] as const

const SINGLE_PREMIUM_SUPPLEMENTARY_CHARGE_RATE = 0.005
const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.5,
  0.45,
  0.4,
  0.35,
  0.3,
  0.25,
  0.2,
  0.15,
  0.1,
  0.05,
  0,
] as const

const SINGLE_PREMIUM_FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.12,
  0.11,
  0.1,
  0.09,
  0.08,
  0.07,
  0.06,
  0.05,
  0.04,
  0.03,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  1,
  0.818,
  0.667,
  0.538,
  0.429,
  0.333,
  0.25,
  0.176,
  0.111,
  0.053,
  0,
] as const

const SINGLE_PREMIUM_PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  0.136,
  0.124,
  0.111,
  0.099,
  0.087,
  0.075,
  0.064,
  0.053,
  0.042,
  0.031,
  0,
] as const

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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 14,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
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

function buildRegularPremiumVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and Target Monthly Retirement Income', snippetNear(document, 1, 'Target Monthly Retirement Income', 18))
  const page2 = sourceRef(2, 'Monthly Retirement Income and Power-up Bonus', snippetNear(document, 2, 'Monthly Retirement Income', 18))
  const page3 = sourceRef(3, 'Regular premium and top-up subscription', snippetNear(document, 3, '100% of Regular Premium less Premium Charge', 18))
  const page4 = sourceRef(4, 'Supplementary Charge and Premium Holiday Charge', snippetNear(document, 4, 'Supplementary Charge', 18))
  const page5 = sourceRef(4, 'Full Surrender Charge and Partial Withdrawal Charge', snippetNear(document, 4, 'Full Surrender Charge', 20))
  const page6 = sourceRef(5, 'Top-up and withdrawal effects', snippetNear(document, 5, 'You may request to pay additional top-up premium', 20))
  const page7 = sourceRef(7, 'Premium holiday and reinstatement', snippetNear(document, 7, 'For reinstatement', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Regular Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: REGULAR_PREMIUM_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'policy-term',
      notes: [
        'Models the published regular premium charge schedule by accepted premium count.',
        'If premiums were missed and later resumed, the regular premium charge continues from the band immediately after the last accepted regular premium.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: roundRate(0.025),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 5,
      notes: [
        'Models the published 2.50% p.a. charge on Regular Premium Policy Value for the regular-pay corridor.',
        'The separate 0.50% p.a. single-premium supplementary charge remains outside the current executable slice.',
      ],
      sourceRefs: [page4],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge on each accepted top-up premium.',
        'V1 blocks ad-hoc top-ups in policy months where regular premiums are no longer paid up to date.',
      ],
      sourceRefs: [page3, page6],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_HOLIDAY_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'Charged monthly during premium holiday based on the annualised regular premium.',
        'The charge stops once all outstanding regular premiums are fully repaid.',
      ],
      sourceRefs: [page4, page7],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge factor on withdrawn Regular Premium Policy Value.',
        'V1 blocks explicit one-off partial withdrawals that would leave policy value below the published S$10,000 residual floor.',
        'The single-premium withdrawal schedule and published minimum withdrawal amount remain outside the current regular-pay-only executable slice.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'committed-annual-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      cadenceYears: 5,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.125,
      amount: 0,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'cumulative-withdrawal-factor-product-over-account-value',
        withdrawalAccountIds: ['policy'],
        countFromPolicyYear: 6,
      },
      notes: [
        'Models the published regular-pay 12.5% of annual premium Power-up Bonus from the end of policy year 10 and every fifth policy year thereafter.',
        'Partial withdrawals from policy year 6 onward reduce the bonus by the published cumulative product of withdrawal factors.',
      ],
      sourceRefs: [page2, page5],
    },
  ]

  return {
    id: 'sgd-mip-5',
    currency: 'SGD',
    mipLength: 5,
    paymentStructure: 'mip',
    contributionMode: 'regular-pay',
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Regular Premium Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page6],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    },
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      requiresTargetRetirementAgeStart: true,
      source: 'policy-redemption',
      payoutStateSupport: {
        defaultState: 'target-income',
        suppressWhileLapsed: true,
        stateAfterReinstatement: 'target-income',
      },
      notes: [
        'Target Monthly Retirement Income after the selected retirement age is paid by redeeming units from policy value.',
      ],
      sourceRefs: [page1, page2],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Platinum Retirement Elite is cataloged as a supported V1 product. The current parser captures the regular-pay 5-year corridor: premium-year regular premium charges, the 2.50% p.a. regular-premium supplementary charge, the premium-holiday charge schedule, annual-state lapse after projected account-value depletion, the 3% top-up premium charge with blocking in months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the regular-premium withdrawal / surrender charge schedules, the regular-pay Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability once a manual payout assumption is supplied with the published target-retirement-age start gate, the current-state death and terminal-illness benefit amount as 105% of policy value, and the current accidental-death uplift as 50% of cumulative paid regular premiums during the first 5 policy years, including lapse suppression in the annual-state model.',
      'Target Monthly Retirement Income amount, payout-period selection, exact month-level commencement timing, and stepped-up-income election remain manual or informational inputs in V1.',
      'The single-pay corridor, including 5% initial premium charge, 0.50% p.a. single-premium supplementary charge, and single-premium withdrawal / surrender charge schedules, remains outside the current executable slice.',
    ],
    unsupportedItems: [
      'Target Monthly Retirement Income amount, Target Payout Period, and Stepped-up Income Option remain manual-assumption inputs in V1. Target Retirement Age is used only as the scheduled-payout start gate in the annual-state model.',
      'Single-premium Power-up Bonus remains informational only because it depends on separately documented single-premium policy-value tracking.',
      'Single-pay and SRS single-premium corridors remain informational only in V1, including the 5% single-premium charge and single-premium withdrawal / surrender charge schedules.',
      'The current-state terminal-illness benefit amount is modeled as the same amount as the current death-benefit estimate, and the current accidental-death amount is modeled as the current death-benefit estimate plus 50% of cumulative paid regular premiums during the first 5 policy years, but accidental-death and terminal-illness claim admission, exclusions, settlement, and policy-termination handling remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Top-up suspension remains informational only.',
      'Fund switching mechanics remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7],
  }
}

function buildSinglePremiumVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and Target Monthly Retirement Income', snippetNear(document, 1, 'Target Monthly Retirement Income', 18))
  const page2 = sourceRef(2, 'Monthly Retirement Income and Power-up Bonus', snippetNear(document, 2, 'Power-up Bonus', 22))
  const page3 = sourceRef(3, 'Single premium and top-up subscription', snippetNear(document, 3, '100% of Single Premium less Premium Charge', 18))
  const page4 = sourceRef(4, 'Single-premium charges and surrender schedule', snippetNear(document, 4, 'Single Premium Units', 28))
  const page5 = sourceRef(4, 'Single-premium partial withdrawal charge', snippetNear(document, 4, 'Partial Withdrawal Charge = Partial Withdrawal Charge Factor x Single Premium Policy Value Withdrawn', 20))
  const page6 = sourceRef(5, 'Top-up and withdrawal effects', snippetNear(document, 5, 'You may request to make a partial withdrawal', 18))
  const page7 = sourceRef(7, 'Payout continuation and termination', snippetNear(document, 7, 'when the policy value is not sufficient', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'annual-contribution',
      rate: 0.05,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 5% premium charge deducted from the initial single premium before units are purchased.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: roundRate(SINGLE_PREMIUM_SUPPLEMENTARY_CHARGE_RATE),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 5,
      notes: [
        'Models the published 0.50% p.a. supplementary charge on Single Premium Policy Value for the first 5 policy years.',
      ],
      sourceRefs: [page4],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge on each accepted top-up premium.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(SINGLE_PREMIUM_PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published policy-year partial withdrawal charge factor on withdrawn Single Premium Policy Value.',
        'Partial withdrawals from policy year 6 onward reduce the Power-up Bonus by the published cumulative product of withdrawal factors.',
        'V1 blocks explicit one-off partial withdrawals that would leave policy value below the published S$10,000 residual floor.',
      ],
      sourceRefs: [page4, page5, page6],
    },
  ]

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'initial-single-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      cadenceYears: 5,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.025,
      amount: 0,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'cumulative-withdrawal-factor-product-over-account-value',
        withdrawalAccountIds: ['policy'],
        countFromPolicyYear: 6,
      },
      notes: [
        'Models the published single-pay 2.5% of Single Premium Power-up Bonus from the end of policy year 10 and every fifth policy year thereafter.',
        'Partial withdrawals from policy year 6 onward reduce the bonus by the published cumulative product of withdrawal factors.',
      ],
      sourceRefs: [page2, page6],
    },
  ]

  return {
    id: 'sgd-open-ended-sp',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    paymentStructure: 'single-pay',
    contributionMode: 'single-pay',
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Single Premium Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    },
    eecTable: [...SINGLE_PREMIUM_FULL_SURRENDER_CHARGE_SCHEDULE],
    exitChargeBasis: 'account-value',
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      requiresTargetRetirementAgeStart: true,
      source: 'policy-redemption',
      payoutStateSupport: {
        defaultState: 'target-income',
        suppressWhileLapsed: true,
        stateAfterReinstatement: 'target-income',
      },
      notes: [
        'Target Monthly Retirement Income after the selected retirement age is paid by redeeming units from policy value.',
      ],
      sourceRefs: [page1, page2, page7],
    },
    warnings: [
      'AIA Platinum Retirement Elite is cataloged as a supported V1 product. The current parser captures the SGD single-pay corridor: the 5% single-premium charge, the 0.50% p.a. single-premium supplementary charge for the first 5 policy years, the 3% top-up premium charge, the single-premium withdrawal / surrender charge schedules, the single-premium Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability once a manual payout assumption is supplied with the published target-retirement-age start gate, the current-state death and terminal-illness benefit amount as 105% of policy value, and the current accidental-death uplift as 10% of a manual initial single premium input during the first 5 policy years, including lapse suppression in the annual-state model.',
      'Target Monthly Retirement Income amount, payout-period selection, exact month-level commencement timing, and stepped-up-income election remain manual or informational inputs in V1.',
      'This executable single-pay slice is limited to the SGD cash corridor. USD and SRS single-pay selection remain informational only.',
    ],
    unsupportedItems: [
      'USD and SRS single-pay corridor selection remain informational only in V1.',
      'The current-state terminal-illness benefit amount is modeled as the same amount as the current death-benefit estimate, and the current accidental-death amount is modeled as the current death-benefit estimate plus 10% of a manual initial single premium input during the first 5 policy years, but accidental-death and terminal-illness claim admission, exclusions, settlement, and policy-termination handling remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7],
  }
}

export function parseAiaPlatinumRetirementElite({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-platinum-retirement-elite',
    insurer: 'AIA Singapore',
    productName: 'AIA Platinum Retirement Elite',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-platinum-retirement-elite-regular-premium-charge',
      'branch:aia-platinum-retirement-elite-regular-supplementary-charge',
      'branch:aia-platinum-retirement-elite-single-premium-charge',
      'branch:aia-platinum-retirement-elite-single-supplementary-charge',
      'branch:aia-platinum-retirement-elite-top-up-premium-charge',
      'branch:aia-platinum-retirement-elite-premium-holiday-charge',
      'branch:aia-platinum-retirement-elite-partial-withdrawal-charge',
      'branch:aia-platinum-retirement-elite-full-surrender-charge',
      'branch:aia-platinum-retirement-elite-power-up-bonus-no-withdrawal-corridor',
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-target-retirement-age-gate',
      'kernel:scheduled-payout-first-year-proration',
      'kernel:lapse-reinstatement-payout-state',
    ],
    coveredElsewhereBehaviors: ['aia-platinum-retirement-elite-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-platinum-retirement-elite-monthly-retirement-income-election',
      'aia-platinum-retirement-elite-stepped-up-income-option',
      'aia-platinum-retirement-elite-fund-switching',
      'aia-platinum-retirement-elite-usd-and-srs-single-pay-selection',
    ],
    warnings: [
      'AIA Platinum Retirement Elite is cataloged as a supported V1 product. The parser captures the regular-pay 5-year corridor including annual-state lapse after projected account-value depletion, the SGD single-pay corridor, the regular-premium and single-premium supplementary-charge paths, the withdrawal / surrender schedules for each modeled corridor with the published S$10,000 residual policy-value floor on explicit one-off withdrawals, the Power-up Bonus corridors from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability once a manual payout assumption and target-retirement-age input are supplied with the published annual-state start gate, the current-state death and terminal-illness benefit amount as 105% of policy value, and the current accidental-death uplift as 50% of cumulative paid regular premiums or 10% of a manual initial single premium input during the first 5 policy years, while payout-election inputs, accidental-death claim admission / exclusions / settlement, terminal-illness claim admission / exclusions / settlement, fund-level charges, and USD/SRS single-pay selection remain informational only beyond the modeled current ordinary death, accidental death, and terminal-illness benefit amounts.',
    ],
    archived: false,
    variants: [
      buildRegularPremiumVariant(document),
      buildSinglePremiumVariant(document),
    ],
  }
}
