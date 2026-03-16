import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
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
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.76 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.51 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.26 },
  { startPolicyYear: 4, endPolicyYear: 6, rate: 0.04 },
  { startPolicyYear: 7, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.2, 0.05, 0] as const
const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [4, 2.333, 1.5, 1, 0.818, 0.539, 0.25, 0.053, 0] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
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

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'AIA Pro Achiever 3.0', 22))
  const page2 = sourceRef(2, 'Welcome and Special Bonus', snippetNear(document, 2, 'Special Bonus', 18))
  const page5 = sourceRef(5, 'Regular premium charge and benefit charge', snippetNear(document, 5, 'Premium charge for basic regular premium', 24))
  const page8 = sourceRef(8, 'Full surrender charge', snippetNear(document, 8, 'Full Surrender Charge', 22))
  const page10 = sourceRef(10, 'Partial withdrawal charge', snippetNear(document, 10, 'Partial Withdrawal Charge', 22))
  const page11 = sourceRef(11, 'Top-up and withdrawal options', snippetNear(document, 11, 'Top-Up', 18))
  const page14 = sourceRef(14, 'Premium Pass and premium holiday interactions', snippetNear(document, 14, 'Premium Pass', 18))
  const page17 = sourceRef(17, 'Distribution of dividends', snippetNear(document, 17, 'Distribution of Dividends', 24))

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
        'Models the published basic regular premium charge schedule for the 10-year IIP corridor.',
        'Premium Reward, Special Bonus, Benefit Charge, and Premium Pass interactions remain informational only.',
      ],
      sourceRefs: [page2, page5],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted ad-hoc top-up premium.',
        'Top-ups are only accepted when regular premiums are fully paid when due, but that gating remains informational only in V1.',
      ],
      sourceRefs: [page5, page11],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge factor on withdrawn Regular Premium Policy Value for the 10-year IIP corridor.',
        'Premium Reduction Policy Value and Premium Reduction Top-Up units remain outside the current executable slice.',
      ],
      sourceRefs: [page10, page11],
    },
  ]

  return {
    id: 'sgd-iip-10',
    currency: 'SGD',
    mipLength: 10,
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
        sourceRefs: [page1, page5, page11],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'By default, fund dividends are reinvested into the policy as additional units.',
        'If a fund offers cash dividend payouts, that option is only allowed after the end of the relevant IIP; V1 seeds reinvestment by default and cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Pro Achiever 3.0 is cataloged as a supported V1 product for the regular-pay corridor. The parser models the 10-year IIP corridor: the premium-year regular premium charge schedule, the 5% top-up premium charge, the regular-premium full-surrender / partial-withdrawal charge schedules, and the reinvest-default distribution-mode assumption surface.',
      'Benefit Charge, Supplementary Charge, Premium Holiday Charge, Premium Pass, Premium Reduction, Premium Reward, and the Welcome / Special Bonus layer remain outside the current engine.',
      'Secondary Insured handling, the published S$50 dividend cash-out threshold, and fund-level charges remain informational only in V1.',
    ],
    unsupportedItems: [
      'Benefit Charge and the death / accidental-death benefit formulas remain informational only.',
      'Supplementary Charge, Premium Holiday Charge, and Premium Pass remain informational only because their interaction depends on premium-pass state that is not modeled in this slice.',
      'Premium Reduction Charge, Premium Reduction Policy Value, and Premium Reduction Top-Up units remain informational only.',
      'Premium Reward, Welcome Bonus, and Special Bonus remain informational only because they add units and depend on paid-up and bonus-state conditions outside the current executable slice.',
      'The published S$50 dividend cash-out threshold, post-IIP cash-election operations, and fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Top-up eligibility gating, fund switching, automatic fund switching, automatic fund re-balancing, and secondary insured handling remain informational only.',
    ],
    sourceRefs: [page1, page2, page5, page8, page10, page11, page14, page17],
  }
}

export function parseAiaProAchiever3({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-pro-achiever-3',
    insurer: 'AIA Singapore',
    productName: 'AIA Pro Achiever 3.0',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-pro-achiever-3-regular-premium-charge',
      'branch:aia-pro-achiever-3-top-up-premium-charge',
      'branch:aia-pro-achiever-3-partial-withdrawal-charge',
      'branch:aia-pro-achiever-3-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'aia-pro-achiever-3-benefit-charge',
      'aia-pro-achiever-3-supplementary-charge',
      'aia-pro-achiever-3-premium-holiday-charge',
      'aia-pro-achiever-3-premium-pass',
      'aia-pro-achiever-3-premium-reduction',
      'aia-pro-achiever-3-premium-reward',
      'aia-pro-achiever-3-welcome-bonus',
      'aia-pro-achiever-3-special-bonus',
      'aia-pro-achiever-3-secondary-insured-option',
      'aia-pro-achiever-3-dividend-cashout-threshold',
      'aia-pro-achiever-3-fund-management-charge',
    ],
    warnings: [
      'AIA Pro Achiever 3.0 is cataloged as a supported V1 product for the regular-pay corridor. The parser models the 10-year IIP premium-charge corridor, 5% top-up premium charge, the regular-premium withdrawal / surrender charge schedules, and reinvest-default dividend support with cash payout allowed only after IIP, while benefit-charge, premium-pass / premium-holiday interactions, premium-reduction mechanics, premium rewards / bonuses, and protection-side options remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
