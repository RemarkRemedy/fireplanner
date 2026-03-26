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
      'kernel:top-up-paid-up-to-date-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
    ],
    coveredElsewhereBehaviors: ['aia-platinum-wealth-elite-2-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-platinum-wealth-elite-2-single-premium-corridor',
      'aia-platinum-wealth-elite-2-premium-term-extension',
      'aia-platinum-wealth-elite-2-administration-charge',
      'aia-platinum-wealth-elite-2-insurance-risk-charge',
      'aia-platinum-wealth-elite-2-free-legacy-cover',
      'aia-platinum-wealth-elite-2-no-lapse-privilege',
      'aia-platinum-wealth-elite-2-income-withdrawal-privilege',
      'aia-platinum-wealth-elite-2-death-benefit-bequest-option',
      'aia-platinum-wealth-elite-2-change-of-insured-and-layering',
      'aia-platinum-wealth-elite-2-fund-switching-and-rebalancing',
    ],
    productWarning: 'The parser captures premium-year regular premium charges, the 3% top-up premium charge with blocking in months where regular premiums are not paid when due, the premium-holiday charge schedule, the regular-premium withdrawal / surrender charge schedules, a static-assumption Vitality Fund Boost schedule for the regular-pay corridor, the current-state death benefit as the higher of current insured amount or policy value via a manual current insured amount input, and the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied, while the single-pay corridor, premium-term extension, administration charge, insurance risk charge, no-lapse mechanics, bequest elections, and terminal-illness claim exclusions / settlement workflow remain informational only beyond the modeled current ordinary death, terminal-illness, and residual-after-TI snapshot surface.',
    additionalVariantWarnings: [
      'The current executable slice intentionally excludes the optional extension of the regular premium term beyond five years.',
    ],
    unsupportedItems: [
      'Single-pay corridor and the 5% single-premium charge remain informational only in V1.',
      'Optional extension of the regular premium term beyond five years remains informational only in V1.',
      'Administration charge remains informational only because it depends on issue-age and change-of-insured layering state.',
      'Insurance Risk Charge, Free Legacy Cover, and No Lapse Privilege debt accrual remain informational only.',
      'Income Withdrawal Privilege and change-of-insured effects remain informational only, while Vitality Fund Boost is modeled under a static assumed status for the regular-pay corridor only.',
      'The current death benefit needs a manual current insured amount input because withdrawals, Income Withdrawal Privilege usage, and claim-side reductions are not reconstructed from history in V1.',
      'Death Benefit Bequest Option and other protection-side payout handling remain informational only.',
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both need manual current insured amount and remaining aggregate TI cap inputs because claim-side reductions and TI usage are not reconstructed from history in V1.',
      'Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim state remain informational only beyond the modeled current terminal-illness and residual-after-TI snapshot surface.',
      'Fund-level management charges, fund switching, and automatic fund re-balancing remain informational only.',
    ],
  })

  const variant = product.variants[0]
  if (!variant) return product

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
