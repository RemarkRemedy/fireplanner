import type { IlpCatalogSourceRef, IlpTemplateBonus, IlpVitalityStatus } from '../../../src/lib/ilp-catalog/types.js'
import { buildAiaPlatinumWealthProduct, type ParseContext } from './aiaPlatinumWealthShared.js'

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

export function parseAiaPlatinumWealthElite2(context: ParseContext) {
  const product = buildAiaPlatinumWealthProduct(context, {
    id: 'aia-platinum-wealth-elite-2',
    productName: 'AIA Platinum Wealth Elite 2.0',
    supportStatus: 'supported',
    economicsStatus: 'supported',
    catalogWarningLabel: 'supported V1 product for the regular-pay 5-year corridor',
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
      'aia-platinum-wealth-elite-2-single-premium-corridor',
      'aia-platinum-wealth-elite-2-premium-term-extension',
      'aia-platinum-wealth-elite-2-free-legacy-cover',
      'aia-platinum-wealth-elite-2-no-lapse-history-and-non-manual-charge-indebtedness',
      'aia-platinum-wealth-elite-2-income-withdrawal-privilege',
      'aia-platinum-wealth-elite-2-death-benefit-bequest-option',
      'aia-platinum-wealth-elite-2-change-of-insured-and-layering',
      'aia-platinum-wealth-elite-2-fund-switching-and-rebalancing',
    ],
    productWarning: 'The parser captures premium-year regular premium charges, the 3% top-up premium charge with blocking in months where regular premiums are not paid when due, the premium-holiday charge schedule, the regular-premium withdrawal / surrender charge schedules, the first-layer administration charge via issue-age and initial insured-amount inputs with no-lapse fixed-charge carry during the published privilege window, a manual-input insurance-risk-charge placeholder sourced from the policy illustration with the same fixed-charge carry seam, a static-assumption Vitality Fund Boost schedule for the regular-pay corridor, the current-state death benefit corridor via manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs that remain user-supplied by design in this app, and the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after manual current insured amount, current amount owing, current No Lapse Privilege mode, and remaining aggregate TI cap inputs are supplied, while the single-pay corridor, premium-term extension, Free Legacy Cover waivers, no-lapse activation history, bequest elections, and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current ordinary death, terminal-illness, and residual-after-TI snapshot surface.',
    additionalVariantWarnings: [
      'The current executable slice intentionally excludes the optional extension of the regular premium term beyond five years.',
    ],
    unsupportedItems: [
      'Single-pay corridor and the 5% single-premium charge remain informational only in V1.',
      'Optional extension of the regular premium term beyond five years remains informational only in V1.',
      'Administration charge is modeled for the first issue-date insured-amount layer only. Change-of-insured layering and new-layer charge resets remain informational only.',
      'Insurance Risk Charge is modeled only as a manual-input annualized placeholder because the applicable insurer illustration rate depends on underwriting and Free Legacy Cover state. Free Legacy Cover, no-lapse activation history, and non-manual charge indebtedness remain informational only.',
      'Income Withdrawal Privilege and change-of-insured effects remain informational only, while Vitality Fund Boost is modeled under a static assumed status for the regular-pay corridor only.',
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

  return product
}
