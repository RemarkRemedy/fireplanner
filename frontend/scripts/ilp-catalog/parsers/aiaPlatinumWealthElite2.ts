import type { IlpCatalogSourceRef, IlpTemplateBonus, IlpVitalityStatus } from '../../../src/lib/ilp-catalog/types.js'
import { buildAiaPlatinumWealthProduct, type ParseContext } from './aiaPlatinumWealthShared.js'

const SINGLE_PAY_FULL_SURRENDER_CHARGE_SCHEDULE = [0.18, 0.15, 0.12, 0.08, 0.04, 0] as const
const SINGLE_PAY_PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [0.22, 0.176, 0.136, 0.087, 0.042, 0] as const

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

function snippetNear(
  context: ParseContext,
  pageNumber: number,
  keyword: string,
  lineWindow = 18,
): string {
  const page = context.document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVitalityStatusSchedule(
  status: IlpVitalityStatus,
  yearOneRate: number,
  yearsTwoToFiveRate: number,
) {
  return [
    { status, startPolicyYear: 1, endPolicyYear: 1, rate: yearOneRate },
    { status, startPolicyYear: 2, endPolicyYear: 5, rate: yearsTwoToFiveRate },
  ]
}

function buildSinglePayVariant(context: ParseContext) {
  const overviewRef = sourceRef(
    1,
    'Plan overview and product structure',
    snippetNear(context, 1, 'Platinum Wealth Elite 2.0', 20),
  )
  const premiumRef = sourceRef(
    4,
    'Single premium and top-up allocation',
    snippetNear(context, 4, 'Premium Charge = 5% of Single Premium', 24),
  )
  const chargeRef = sourceRef(
    4,
    'Single-premium charge and administration / insurance corridor',
    snippetNear(context, 4, 'Single Premium', 24),
  )
  const withdrawalRef = sourceRef(
    6,
    'Single-pay withdrawal and surrender schedule',
    snippetNear(context, 6, 'Single Premium Units', 24),
  )
  const topUpRef = sourceRef(
    8,
    'Top-up premium mechanics',
    snippetNear(context, 8, 'top-up premium', 22),
  )
  const nonPaymentRef = sourceRef(
    9,
    'No Lapse Privilege',
    snippetNear(context, 9, 'No Lapse Privilege', 28),
  )
  const vitalityRef = sourceRef(
    15,
    'Vitality Fund Boost',
    snippetNear(context, 15, 'Single Premium (SP)', 30),
  )

  const vitalityBonus: IlpTemplateBonus = {
    id: 'vitality-fund-boost',
    type: 'allocation',
    label: 'Vitality Fund Boost',
    mode: 'one-time',
    oneTimePayoutBasis: 'initial-single-premium-at-issue',
    cadenceYears: 1,
    appliesTo: ['policy'],
    startPolicyYear: 1,
    endPolicyYear: 5,
    rate: 0,
    amount: 0,
    tieredRates: [],
    vitalityStatusRateSchedule: [
      ...buildVitalityStatusSchedule('bronze', 0, 0),
      ...buildVitalityStatusSchedule('silver', 0.001, 0),
      ...buildVitalityStatusSchedule('gold', 0.001, 0.001),
      ...buildVitalityStatusSchedule('platinum', 0.001, 0.002),
    ],
    notes: [
      'Rate is re-rated annually by Vitality status 45 days before each policy anniversary. This model uses a static assumption for the entire projection.',
      'The published Jul 2025 summary shows Silver status only receiving the boost in policy year 1, with years 2-5 marked not applicable on the single-pay corridor.',
      'No-status termination, post-termination reinstatement rules, and layer-specific exclusions remain informational only in this corridor.',
      'This modeled bonus applies to the single-pay corridor as annual single-premium-unit credits on the issue date and later policy anniversaries through policy year 5.',
    ],
    sourceRefs: [vitalityRef],
  }

  return {
    id: 'sgd-single-pay',
    currency: 'SGD' as const,
    mipLength: 5,
    paymentStructure: 'single-pay' as const,
    contributionMode: 'single-pay' as const,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Single Pay Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp' as const, targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up' as const, targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [overviewRef, premiumRef, topUpRef],
      },
    ],
    bonuses: [vitalityBonus],
    feeRules: [
      {
        id: 'single-premium-charge',
        label: 'Single Premium Charge',
        basis: 'initial-single-premium',
        rate: 0.05,
        amount: 0,
        appliesTo: ['policy'],
        activeWindow: 'policy-term',
        notes: [
          'Models the published 5% premium charge deducted from the accepted single premium before units are purchased.',
        ],
        sourceRefs: [premiumRef, chargeRef],
      },
      {
        id: 'administration-charge',
        label: 'Administration Charge',
        basis: 'insured-amount-at-issue',
        rate: 0,
        amount: 0,
        appliesTo: ['policy'],
        activeWindow: 'policy-term',
        startPolicyYear: 1,
        endPolicyYear: 4,
        issueAgeRateTiers: [
          { minIssueAgeNextBirthday: 1, maxIssueAgeNextBirthday: 20, rate: 0.0016 },
          { minIssueAgeNextBirthday: 21, maxIssueAgeNextBirthday: 25, rate: 0.0018 },
          { minIssueAgeNextBirthday: 26, maxIssueAgeNextBirthday: 30, rate: 0.0024 },
          { minIssueAgeNextBirthday: 31, maxIssueAgeNextBirthday: 35, rate: 0.0032 },
          { minIssueAgeNextBirthday: 36, maxIssueAgeNextBirthday: 40, rate: 0.0040 },
          { minIssueAgeNextBirthday: 41, maxIssueAgeNextBirthday: 45, rate: 0.0053 },
          { minIssueAgeNextBirthday: 46, maxIssueAgeNextBirthday: 50, rate: 0.0066 },
          { minIssueAgeNextBirthday: 51, maxIssueAgeNextBirthday: 60, rate: 0.0092 },
          { minIssueAgeNextBirthday: 61, maxIssueAgeNextBirthday: 65, rate: 0.0104 },
        ],
        carryForwardOnInsufficientDeductionWithinPolicyYears: {
          startPolicyYear: 1,
          endPolicyYear: 15,
        },
        notes: [
          'Models the published first-layer administration charge as insured amount at issue multiplied by the issue-age annual administration-charge rate during the first four policy years.',
          'This executable slice assumes the original issue-date insured amount only. Change-of-insured layering and new-layer resets remain informational only.',
          'The engine derives issue age from current Age Next Birthday and Current Policy Year, and needs the initial insured amount at issue to price the charge.',
          'The Jul 2025 summary marks the age-66-to-70 band as regular-pay only, so the single-pay corridor keeps the published tiers through age 65.',
        ],
        sourceRefs: [chargeRef],
      },
      {
        id: 'insurance-risk-charge',
        label: 'Insurance Risk Charge',
        basis: 'fixed-annual',
        rate: 0,
        amount: 0,
        requiresManualInput: true,
        carryForwardOnInsufficientDeductionWithinPolicyYears: {
          startPolicyYear: 1,
          endPolicyYear: 15,
        },
        appliesTo: ['policy'],
        activeWindow: 'policy-term',
        notes: [
          'Manual-input approximation for the monthly Insurance Risk Charge deducted on the prevailing insured-amount-less-policy-value corridor.',
          'Enter the annualized Insurance Risk Charge from the policy illustration. If the illustration shows a monthly amount, multiply it by 12.',
          'Applicable rates depend on underwriting class, Free Legacy Cover waiver state, and other illustration factors that are not fully published in the summary.',
        ],
        sourceRefs: [chargeRef],
      },
    ],
    eventChargeRules: [
      {
        id: 'top-up-premium-charge',
        label: 'Top-up Premium Charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0.03,
        amount: 0,
        activeWindow: 'policy-term',
        allocation: 'equal-split',
        notes: [
          'Models the published 3% premium charge deducted from each accepted ad hoc top-up premium.',
        ],
        sourceRefs: [premiumRef, topUpRef],
      },
      {
        id: 'partial-withdrawal-charge',
        label: 'Partial Withdrawal Charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
        rateSchedule: SINGLE_PAY_PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE.map((rate, index) => ({
          startPolicyYear: index + 1,
          endPolicyYear: index + 1,
          rate,
        })),
        activeWindow: 'policy-term',
        allocation: 'equal-split',
        notes: [
          'Models the published single-pay partial withdrawal charge factor on withdrawn single-premium policy value.',
          'Top-up withdrawal behavior remains informational only in V1.',
        ],
        sourceRefs: [withdrawalRef],
      },
    ],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      accountValueDepletionNonLapseWindows: [
        { startPolicyYear: 1, endPolicyYear: 15 },
      ],
    },
    eecTable: [...SINGLE_PAY_FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Platinum Wealth Elite 2.0 is cataloged as a supported V1 product for the single-pay corridor. The parser captures the 5% single-premium charge, the 3% top-up premium charge, the published single-pay partial-withdrawal / surrender charge schedules, the first-layer administration charge via issue-age and initial insured-amount inputs with no-lapse fixed-charge carry during the published privilege window, a manual-input insurance-risk-charge placeholder sourced from the policy illustration with the same fixed-charge carry seam, a static-assumption Vitality Fund Boost schedule for the single-pay corridor, and the current-state death benefit corridor plus terminal-illness and residual-after-TI snapshots via the same manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs, while premium-term extension, Free Legacy Cover waivers, no-lapse activation history, bequest elections, and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current ordinary death, terminal-illness, and residual-after-TI snapshot surface.',
    ],
    unsupportedItems: [
      'Premium-term extension remains informational only in V1 because it applies to the regular-pay corridor only.',
      'Administration charge is modeled for the first issue-date insured-amount layer only. Change-of-insured layering and new-layer charge resets remain informational only.',
      'Insurance Risk Charge is modeled only as a manual-input annualized placeholder because the applicable insurer illustration rate depends on underwriting and Free Legacy Cover state. Free Legacy Cover, no-lapse activation history, and non-manual charge indebtedness remain informational only.',
      'Income Withdrawal Privilege and change-of-insured effects remain informational only, while Vitality Fund Boost is modeled under a static assumed status for the single-pay corridor only.',
      'The current death benefit keeps manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs because withdrawals, debt, no-lapse status, Income Withdrawal Privilege usage, and claim-side reductions change the live corridor in ways this app cannot observe; those inputs are manual by design in V1.',
      'Death Benefit Bequest Option and other protection-side payout handling remain informational only.',
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both keep manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs because the live insured amount, debt, no-lapse status, and cross-policy TI usage are current policy facts this app cannot observe; those inputs are manual by design in V1.',
      'Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.',
      'Fund-level management charges, fund switching, and automatic fund re-balancing remain informational only.',
    ],
    sourceRefs: [overviewRef, premiumRef, chargeRef, withdrawalRef, topUpRef, nonPaymentRef, vitalityRef],
  }
}

export function parseAiaPlatinumWealthElite2(context: ParseContext) {
  const product = buildAiaPlatinumWealthProduct(context, {
    id: 'aia-platinum-wealth-elite-2',
    productName: 'AIA Platinum Wealth Elite 2.0',
    supportStatus: 'supported',
    economicsStatus: 'supported',
    catalogWarningLabel: 'supported V1 product for the regular-pay 5-year corridor plus the single-pay corridor',
    planKeyword: 'Platinum Wealth Elite 2.0',
    overviewPage: 1,
    premiumPage: 4,
    chargePage: 4,
    holidayPage: 5,
    topUpPage: 8,
    nonPaymentPage: 9,
    regularPremiumChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.25 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.15 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.08 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.06 },
    ],
    premiumHolidayChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0 },
    ],
    regularFullSurrenderChargeSchedule: [0.5, 0.4, 0.3, 0.2, 0.1, 0],
    regularPartialWithdrawalChargeSchedule: [1, 0.667, 0.429, 0.25, 0.111, 0],
    modeledEconomics: [
      'branch:aia-platinum-wealth-elite-2-regular-premium-charge',
      'branch:aia-platinum-wealth-elite-2-single-premium-charge',
      'branch:aia-platinum-wealth-elite-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-elite-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-elite-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-elite-2-full-surrender-charge',
      'branch:aia-platinum-wealth-elite-2-vitality-bonus',
      'branch:aia-platinum-wealth-elite-2-no-lapse-administration-charge-carry',
      'branch:aia-platinum-wealth-elite-2-insurance-risk-charge-manual-input',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:no-lapse-fixed-charge-debt-carry',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
    ],
    coveredElsewhereBehaviors: ['aia-platinum-wealth-elite-2-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-platinum-wealth-elite-2-premium-term-extension',
      'aia-platinum-wealth-elite-2-free-legacy-cover',
      'aia-platinum-wealth-elite-2-no-lapse-history-and-non-manual-charge-indebtedness',
      'aia-platinum-wealth-elite-2-income-withdrawal-privilege',
      'aia-platinum-wealth-elite-2-death-benefit-bequest-option',
      'aia-platinum-wealth-elite-2-change-of-insured-and-layering',
      'aia-platinum-wealth-elite-2-fund-switching-and-rebalancing',
    ],
    productWarning: 'The parser captures premium-year regular premium charges on the regular-pay corridor, the 5% single-premium charge on the single-pay corridor, the 3% top-up premium charge with blocking in months where regular premiums are not paid when due, the premium-holiday charge schedule on the regular-pay corridor, the published regular-premium and single-premium withdrawal / surrender charge schedules, the first-layer administration charge via issue-age and initial insured-amount inputs with no-lapse fixed-charge carry during the published privilege window, a manual-input insurance-risk-charge placeholder sourced from the policy illustration with the same fixed-charge carry seam, a static-assumption Vitality Fund Boost schedule for both the regular-pay and single-pay corridors, the current-state death benefit corridor via manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs that remain user-supplied by design in this app, and the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs are supplied, while premium-term extension, Free Legacy Cover waivers, no-lapse activation history, bequest elections, and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current ordinary death, terminal-illness, and residual-after-TI snapshot surface.',
    unsupportedItems: [
      'Optional extension of the regular premium term beyond five years remains informational only in V1.',
      'Administration charge is modeled for the first issue-date insured-amount layer only. Change-of-insured layering and new-layer charge resets remain informational only.',
      'Insurance Risk Charge is modeled only as a manual-input annualized placeholder because the applicable insurer illustration rate depends on underwriting and Free Legacy Cover state. Free Legacy Cover, no-lapse activation history, and non-manual charge indebtedness remain informational only.',
      'Income Withdrawal Privilege and change-of-insured effects remain informational only, while Vitality Fund Boost is modeled under a static assumed status for the regular-pay and single-pay corridors only.',
      'The current death benefit keeps manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs because withdrawals, debt, no-lapse status, Income Withdrawal Privilege usage, and claim-side reductions change the live corridor in ways this app cannot observe; those inputs are manual by design in V1.',
      'Death Benefit Bequest Option and other protection-side payout handling remain informational only.',
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both keep manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs because the live insured amount, debt, no-lapse status, and cross-policy TI usage are current policy facts this app cannot observe; those inputs are manual by design in V1.',
      'Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.',
      'Fund-level management charges, fund switching, and automatic fund re-balancing remain informational only.',
    ],
    buildAdditionalFeeRules: ({ chargeRef }) => [
      {
        id: 'administration-charge',
        label: 'Administration Charge',
        basis: 'insured-amount-at-issue',
        rate: 0,
        amount: 0,
        appliesTo: ['policy'],
        activeWindow: 'policy-term',
        startPolicyYear: 1,
        endPolicyYear: 4,
        issueAgeRateTiers: [
          { minIssueAgeNextBirthday: 1, maxIssueAgeNextBirthday: 20, rate: 0.0016 },
          { minIssueAgeNextBirthday: 21, maxIssueAgeNextBirthday: 25, rate: 0.0018 },
          { minIssueAgeNextBirthday: 26, maxIssueAgeNextBirthday: 30, rate: 0.0024 },
          { minIssueAgeNextBirthday: 31, maxIssueAgeNextBirthday: 35, rate: 0.0032 },
          { minIssueAgeNextBirthday: 36, maxIssueAgeNextBirthday: 40, rate: 0.0040 },
          { minIssueAgeNextBirthday: 41, maxIssueAgeNextBirthday: 45, rate: 0.0053 },
          { minIssueAgeNextBirthday: 46, maxIssueAgeNextBirthday: 50, rate: 0.0066 },
          { minIssueAgeNextBirthday: 51, maxIssueAgeNextBirthday: 60, rate: 0.0092 },
          { minIssueAgeNextBirthday: 61, maxIssueAgeNextBirthday: 65, rate: 0.0104 },
          { minIssueAgeNextBirthday: 66, maxIssueAgeNextBirthday: 70, rate: 0.0126 },
        ],
        notes: [
          'Models the published first-layer administration charge as insured amount at issue multiplied by the issue-age annual administration-charge rate during the first four policy years.',
          'This executable slice assumes the original issue-date insured amount only. Change-of-insured layering and new-layer resets remain informational only.',
          'The engine derives issue age from current Age Next Birthday and Current Policy Year, and needs the initial insured amount at issue to price the charge.',
        ],
        sourceRefs: [chargeRef],
      },
      {
        id: 'insurance-risk-charge',
        label: 'Insurance Risk Charge',
        basis: 'fixed-annual',
        rate: 0,
        amount: 0,
        requiresManualInput: true,
        appliesTo: ['policy'],
        activeWindow: 'policy-term',
        notes: [
          'Manual-input approximation for the monthly Insurance Risk Charge deducted on the prevailing insured-amount-less-policy-value corridor.',
          'Enter the annualized Insurance Risk Charge from the policy illustration. If the illustration shows a monthly amount, multiply it by 12.',
          'Applicable rates depend on underwriting class, Free Legacy Cover waiver state, and other illustration factors that are not fully published in the summary.',
        ],
        sourceRefs: [chargeRef],
      },
    ],
  })

  const variant = product.variants[0]
  if (!variant) return product

  variant.policyStateSupport = {
    ...variant.policyStateSupport,
    automaticLapseOnAccountValueDepletion: true,
    accountValueDepletionNonLapseWindows: [
      { startPolicyYear: 1, endPolicyYear: 15 },
    ],
  }
  variant.feeRules = variant.feeRules.map((rule) => (
    rule.id === 'administration-charge' || rule.id === 'insurance-risk-charge'
      ? {
          ...rule,
          carryForwardOnInsufficientDeductionWithinPolicyYears: {
            startPolicyYear: 1,
            endPolicyYear: 15,
          },
        }
      : rule
  ))

  const vitalityRef = sourceRef(
    15,
    'Vitality Fund Boost',
    snippetNear(context, 15, 'Vitality Fund Boost', 28),
  )
  const vitalityNotes = [
    'Rate is re-rated annually by Vitality status 45 days before each policy anniversary. This model uses a static assumption for the entire projection.',
    'The published Jul 2025 summary shows Silver status only receiving the boost in policy year 1, with years 2-5 marked not applicable.',
    'No-status termination, post-termination reinstatement rules, change-of-insured eligibility, and layer-specific exclusions remain informational only in this corridor.',
    'This modeled bonus applies to the regular-pay corridor only. Single-premium Vitality Fund Boost remains inside the metadata-only single-pay corridor.',
  ]

  const vitalityBonus: IlpTemplateBonus = {
    id: 'vitality-fund-boost',
    type: 'allocation',
    label: 'Vitality Fund Boost',
    mode: 'premium-allocation',
    appliesTo: ['policy'],
    startPolicyYear: 1,
    endPolicyYear: 5,
    requiresPremiumsPaidUpToDate: true,
    rate: 0,
    amount: 0,
    tieredRates: [],
    vitalityStatusRateSchedule: [
      ...buildVitalityStatusSchedule('bronze', 0, 0),
      ...buildVitalityStatusSchedule('silver', 0.01, 0),
      ...buildVitalityStatusSchedule('gold', 0.01, 0.01),
      ...buildVitalityStatusSchedule('platinum', 0.01, 0.02),
    ],
    notes: vitalityNotes,
    sourceRefs: [vitalityRef],
  }

  variant.bonuses = [...variant.bonuses, vitalityBonus]
  product.variants = [...product.variants, buildSinglePayVariant(context)]

  return product
}
