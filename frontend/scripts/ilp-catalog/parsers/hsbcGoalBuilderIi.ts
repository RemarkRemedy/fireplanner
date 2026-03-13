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

const TERM_OPTIONS = [5, 10, 15] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

const WELCOME_BONUS_TIERS: Record<MipTerm, IlpTemplateBonusTier[]> = {
  5: [
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.15 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
    { currency: 'USD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.15 },
    { currency: 'USD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
  ],
  10: [
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.2 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.4 },
    { currency: 'USD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.2 },
    { currency: 'USD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.4 },
  ],
  15: [
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.3 },
    { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.55 },
    { currency: 'USD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.3 },
    { currency: 'USD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.55 },
  ],
}

const SURRENDER_CHARGE_BY_TERM: Record<MipTerm, number[]> = {
  5: [1, 1, 0.75, 0.6, 0.5, 0.3, 0.2, 0.1],
  10: [1, 1, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1],
  15: [1, 1, 0.75, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.08, 0.08, 0.08, 0.08, 0.08],
}

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 8): string {
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

function buildWelcomeBonus(term: MipTerm, currency: 'SGD' | 'USD', page4: IlpCatalogSourceRef): IlpTemplateBonus {
  return {
    id: 'welcome-bonus',
    type: 'allocation',
    label: 'Welcome Bonus',
    mode: 'premium-allocation',
    appliesTo: ['policy'],
    startPolicyYear: 1,
    endPolicyYear: 1,
    rate: 0,
    amount: null,
    tieredRates: WELCOME_BONUS_TIERS[term].filter((tier) => tier.currency === currency),
    notes: [
      'Applied to regular premiums paid in the first policy year only.',
      'Top-up premiums and recurrent single premiums are excluded.',
    ],
    sourceRefs: [page4],
  }
}

function buildPafRule(term: MipTerm, page8: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'product-administration-fee',
    label: 'Product Administration Fee',
    basis: 'premium-base-mip-multiplier',
    yearBasis: 'premium-year',
    rate: 0,
    amount: null,
    appliesTo: ['policy'],
    premiumBaseConfig: {
      useHigherOfCommencementAndPrevailing: false,
      multiplierYearBasis: 'policy-year',
      multiplierSchedule: [
        { startPolicyYear: 1, endPolicyYear: term, mode: 'policy-year' },
        { startPolicyYear: term + 1, endPolicyYear: null, mode: 'fixed', multiplier: term },
      ],
    },
    rateSchedule: [
      { startPolicyYear: 1, endPolicyYear: 8, rate: roundRate(0.025) },
      { startPolicyYear: 9, endPolicyYear: 24, rate: roundRate(0.006) },
    ],
    activeWindow: 'policy-term',
    startPolicyYear: 1,
    endPolicyYear: 24,
    notes: [
      'Premium Year selects the annual PAF band while Policy Year capped at premium term determines the multiplier.',
      'Premium holidays freeze Premium Year but do not stop the Product Administration Fee.',
    ],
    sourceRefs: [page8],
  }
}

function buildVariant(document: ExtractedPdfDocument, currency: 'SGD' | 'USD', term: MipTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'limited premium payment investment-linked product'))
  const page4 = sourceRef(4, 'Welcome bonus', snippetNear(document, 4, 'Welcome Bonus', 18))
  const page5 = sourceRef(5, 'Premium Year and loyalty bonus', snippetNear(document, 5, 'Premium Year', 18))
  const page8 = sourceRef(8, 'Product Administration Fee', snippetNear(document, 8, 'Product Administration Fee', 20))
  const page9 = sourceRef(9, 'Surrender penalty charge', snippetNear(document, 9, 'Surrender Penalty Charge', 20))
  const page11 = sourceRef(11, 'Top-up Premium(s) and Recurrent Single Premium(s)', snippetNear(document, 11, 'Top-up Premium(s) and Recurrent Single Premium(s)', 18))
  const page15 = sourceRef(15, 'Dividends', snippetNear(document, 15, 'dividend', 12))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: roundRate(0.03),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: ['Charged on ad-hoc top-up premiums after units are allocated.'],
      sourceRefs: [page11],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurrent Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: roundRate(0.03),
      amount: 0,
      activeWindow: 'after-mip',
      allocation: 'equal-split',
      notes: ['Charged on recurrent single premium contributions after the premium term.'],
      sourceRefs: [page11],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(SURRENDER_CHARGE_BY_TERM[term]),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: ['Uses the same premium-year based surrender penalty schedule as full surrender during the penalty period.'],
      sourceRefs: [page9],
    },
    {
      id: 'welcome-bonus-recovery-charge',
      label: 'Welcome Bonus Recovery Charge',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-tiered-startup-recovery',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      sourceBonusId: 'welcome-bonus',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: ['Models the published Welcome Bonus recovery formula on approved premium reduction.'],
      sourceRefs: [page4],
    },
  ]

  return {
    id: `${currency.toLowerCase()}-mip-${term}`,
    currency,
    mipLength: term,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page11],
      },
    ],
    bonuses: [
      buildWelcomeBonus(term, currency, page4),
    ],
    feeRules: [
      buildPafRule(term, page8),
    ],
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_BY_TERM[term]],
    eecYearBasis: 'premium-year',
    warnings: [
      'Goal Builder II is modeled as a partial subset in V1. The parser captures Welcome Bonus, Welcome Bonus recovery on premium reduction, Product Administration Fee, top-up / recurrent single premium charge, and Premium-Year-based surrender / partial-withdrawal penalties.',
      'Loyalty Bonus remains informational only in V1 because its every-2-Premium-Year cadence and 24-month top-up exclusion are not yet modeled.',
      'Dividend-paying funds are treated as reinvesting by default in V1. Cash payout elections remain informational only and are not reflected in projected values.',
    ],
    unsupportedItems: [
      'Loyalty Bonus cadence and top-up exclusion window remain informational only.',
      'Death and terminal illness benefit payout mechanics remain informational only.',
      'Dividend payout election remains informational only.',
      'Automatic paid-up / lapse state is not modeled beyond premium-holiday fee drag.',
      'Regular withdrawal behavior remains informational only.',
    ],
    sourceRefs: [page1, page4, page5, page8, page9, page11, page15],
  }
}

export function parseHsbcGoalBuilderIi({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  const sourceFileName = path.basename(document.filePath)

  return {
    id: 'hsbc-life-goal-builder-ii',
    insurer: 'HSBC Life',
    productName: 'Goal Builder II',
    sourceFileName,
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:goal-builder-ii-welcome-bonus',
      'branch:goal-builder-ii-welcome-bonus-recovery',
      'branch:goal-builder-ii-premium-year-paf',
      'branch:goal-builder-ii-top-up-premium-charge',
      'branch:goal-builder-ii-recurrent-single-premium-charge',
      'branch:goal-builder-ii-premium-year-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'goal-builder-ii-loyalty-bonus-cadence',
      'goal-builder-ii-death-ti-benefit',
      'goal-builder-ii-dividend-payout-election',
      'goal-builder-ii-regular-withdrawal',
    ],
    warnings: [
      'Goal Builder II is a partial modeled subset in V1. Premium-Year-based Product Administration Fee and surrender mechanics are modeled; loyalty bonus cadence, payout election, and death/TI payout mechanics are not.',
    ],
    archived: false,
    variants: TERM_OPTIONS.flatMap((term) => [
      buildVariant(document, 'SGD', term),
      buildVariant(document, 'USD', term),
    ]),
  }
}
