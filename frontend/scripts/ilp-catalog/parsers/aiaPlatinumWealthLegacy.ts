import type { IlpCatalogSourceRef, IlpTemplateEventChargeRule, IlpTemplateFeeRule, IlpTemplateVariant } from '../../../src/lib/ilp-catalog/types.js'
import { buildAiaPlatinumWealthProduct, type ParseContext } from './aiaPlatinumWealthShared.js'

const SINGLE_PAY_FULL_SURRENDER_CHARGE_SCHEDULE = [0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.04, 0.02, 0.01] as const

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

function buildSinglePayVariant(context: ParseContext): IlpTemplateVariant {
  const overviewRef = sourceRef(
    1,
    'Plan overview and product structure',
    snippetNear(context, 1, 'AIA Platinum Wealth Legacy', 20),
  )
  const premiumRef = sourceRef(
    3,
    'Single premium and top-up allocation',
    snippetNear(context, 3, 'Premium Charge = 5% of Single Premium', 22),
  )
  const chargeRef = sourceRef(
    3,
    'Single-premium charge and illustration-backed placeholders',
    snippetNear(context, 3, 'Single Premium', 24),
  )
  const withdrawalRef = sourceRef(
    4,
    'Single-pay withdrawal and surrender schedule',
    snippetNear(context, 4, 'Single Premium', 24),
  )
  const topUpRef = sourceRef(
    6,
    'Top-up premium mechanics',
    snippetNear(context, 6, 'top-up premium', 22),
  )

  const feeRules: IlpTemplateFeeRule[] = [
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
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 10,
      notes: [
        'Manual-input approximation for the published monthly administration charge corridor during the first 10 policy years.',
        'Enter the annualized administration charge from the policy illustration. If the illustration shows a monthly amount, multiply it by 12.',
        'Rate depends on entry age and insured amount. The published summary does not include rate tables.',
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
        'Manual-input approximation for the monthly Insurance Risk Charge deducted on the prevailing sum-at-risk corridor.',
        'Enter the annualized Insurance Risk Charge from the policy illustration. If the illustration shows a monthly amount, multiply it by 12.',
        'Applicable rates depend on underwriting class and insurer illustration factors that are not published in the summary.',
      ],
      sourceRefs: [chargeRef],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
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
      rateSchedule: SINGLE_PAY_FULL_SURRENDER_CHARGE_SCHEDULE.map((rate, index) => ({
        startPolicyYear: index + 1,
        endPolicyYear: index + 1,
        rate,
      })),
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published single-pay partial withdrawal charge factor on withdrawn policy value.',
      ],
      sourceRefs: [withdrawalRef],
    },
  ]

  return {
    id: 'sgd-single-pay',
    currency: 'SGD',
    mipLength: 5,
    paymentStructure: 'single-pay',
    contributionMode: 'single-pay',
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Single Pay Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [overviewRef, premiumRef, topUpRef],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...SINGLE_PAY_FULL_SURRENDER_CHARGE_SCHEDULE],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
    },
    warnings: [
      'AIA Platinum Wealth Legacy is cataloged as a supported V1 product for the single-pay corridor. The parser captures the 5% single-premium charge, the 3% top-up premium charge, the published single-pay partial-withdrawal / surrender charge schedules, manual-input administration-charge and insurance-risk-charge placeholders sourced from the policy illustration, and the current-state death benefit corridor plus terminal-illness and residual-after-TI snapshots via the same manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs, while no-lapse activation or expiry election mechanics and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current snapshot surface.',
    ],
    unsupportedItems: [
      'Administration charge is modeled only as a manual-input annualized placeholder because the applicable age / insured-amount rates live in the policy illustration rather than the product summary.',
      'The current death benefit keeps manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs because adjusted partial-withdrawal history, debt, and no-lapse state are live policy facts this app cannot observe; those inputs are manual by design in V1.',
      'Insurance Risk Charge is modeled only as a manual-input annualized placeholder because the applicable standard / non-standard life rates live in the policy illustration rather than the product summary. No Lapse Privilege activation or termination and expiry-age election mechanics remain informational only.',
      'Adjusted partial withdrawal, layer creation from insured-amount changes, and minimum-insured-amount gating remain informational only.',
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both keep manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs because debt, no-lapse status, and cross-policy TI usage are current policy facts this app cannot observe; those inputs are manual by design in V1.',
      'Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.',
      'Other protection-side payout handling remains informational only.',
      'Fund-level management charges and no-fund-switching constraints remain informational only.',
    ],
    sourceRefs: [overviewRef, premiumRef, chargeRef, withdrawalRef, topUpRef],
  }
}

export function parseAiaPlatinumWealthLegacy(context: ParseContext) {
  const product = buildAiaPlatinumWealthProduct(context, {
    id: 'aia-platinum-wealth-legacy',
    productName: 'AIA Platinum Wealth Legacy',
    supportStatus: 'supported',
    economicsStatus: 'supported',
    catalogWarningLabel: 'supported V1 product for the regular-pay 5-year corridor plus the single-pay corridor',
    planKeyword: 'AIA Platinum Wealth Legacy',
    overviewPage: 1,
    premiumPage: 3,
    chargePage: 3,
    holidayPage: 4,
    topUpPage: 6,
    nonPaymentPage: 7,
    regularPremiumChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0.36 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.18 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.06 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.06 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.04 },
    ],
    premiumHolidayChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0 },
    ],
    regularFullSurrenderChargeSchedule: [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05],
    regularPartialWithdrawalChargeSchedule: [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05],
    modeledEconomics: [
      'branch:aia-platinum-wealth-legacy-regular-premium-charge',
      'branch:aia-platinum-wealth-legacy-single-premium-charge',
      'branch:aia-platinum-wealth-legacy-top-up-premium-charge',
      'branch:aia-platinum-wealth-legacy-premium-holiday-charge',
      'branch:aia-platinum-wealth-legacy-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-legacy-full-surrender-charge',
      'branch:aia-platinum-wealth-legacy-administration-charge-manual-input',
      'branch:aia-platinum-wealth-legacy-insurance-risk-charge-manual-input',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
    ],
    coveredElsewhereBehaviors: ['aia-platinum-wealth-legacy-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-platinum-wealth-legacy-no-lapse-privilege',
      'aia-platinum-wealth-legacy-expiry-age-election',
      'aia-platinum-wealth-legacy-layering-and-adjusted-partial-withdrawal',
      'aia-platinum-wealth-legacy-no-fund-switching',
    ],
    productWarning: 'The parser captures premium-year regular premium charges, the 5% single-premium charge, the 3% top-up premium charge with the paid-up-to-date block on the regular-pay corridor only, the premium-holiday charge schedule on the regular-pay corridor, the published regular-pay and single-pay partial-withdrawal / surrender charge schedules, manual-input administration-charge and insurance-risk-charge placeholders sourced from the policy illustration, the current-state death benefit corridor via manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs that remain user-supplied by design in this app, and the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied, while no-lapse activation or expiry election mechanics and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current ordinary death, terminal-illness, and residual-after-TI snapshot surface.',
    unsupportedItems: [
      'Administration charge is modeled only as a manual-input annualized placeholder because the applicable age / insured-amount rates live in the policy illustration rather than the product summary.',
      'The current death benefit keeps manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs because adjusted partial-withdrawal history, debt, and no-lapse state are live policy facts this app cannot observe; those inputs are manual by design in V1.',
      'Insurance Risk Charge is modeled only as a manual-input annualized placeholder because the applicable standard / non-standard life rates live in the policy illustration rather than the product summary. No Lapse Privilege activation or termination and expiry-age election mechanics remain informational only.',
      'Adjusted partial withdrawal, layer creation from insured-amount changes, and minimum-insured-amount gating remain informational only.',
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both keep manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs because debt, no-lapse status, and cross-policy TI usage are current policy facts this app cannot observe; those inputs are manual by design in V1.',
      'Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.',
      'Other protection-side payout handling remains informational only.',
      'Fund-level management charges and no-fund-switching constraints remain informational only.',
    ],
    buildAdditionalFeeRules: ({ chargeRef }) => [
      {
        id: 'administration-charge',
        label: 'Administration Charge',
        basis: 'fixed-annual',
        rate: 0,
        amount: 0,
        requiresManualInput: true,
        appliesTo: ['policy'],
        activeWindow: 'policy-term',
        startPolicyYear: 1,
        endPolicyYear: 10,
        notes: [
          'Manual-input approximation for the published monthly administration charge corridor during the first 10 policy years.',
          'Enter the annualized administration charge from the policy illustration. If the illustration shows a monthly amount, multiply it by 12.',
          'Rate depends on entry age and insured amount. The published summary does not include rate tables.',
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
          'Manual-input approximation for the monthly Insurance Risk Charge deducted on the prevailing sum-at-risk corridor.',
          'Enter the annualized Insurance Risk Charge from the policy illustration. If the illustration shows a monthly amount, multiply it by 12.',
          'Applicable rates depend on underwriting class and insurer illustration factors that are not published in the summary.',
        ],
        sourceRefs: [chargeRef],
      },
    ],
  })

  product.variants = [...product.variants, buildSinglePayVariant(context)]
  return product
}
