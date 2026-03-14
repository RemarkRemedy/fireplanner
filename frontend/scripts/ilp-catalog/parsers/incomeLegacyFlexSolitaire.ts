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

type LegacyFlexMip = 5 | 10

interface LegacyFlexVariantConfig {
  id: string
  mipLength: LegacyFlexMip
  regularPremiumChargeSchedule: readonly number[]
  premiumHolidayChargeSchedule: readonly number[]
  withdrawalAndSurrenderChargeSchedule: readonly number[]
}

const TOP_UP_PREMIUM_CHARGE_RATE = 0.03

const VARIANT_CONFIGS: readonly LegacyFlexVariantConfig[] = [
  {
    id: 'sgd-regular-mip-5',
    mipLength: 5,
    regularPremiumChargeSchedule: [0.28, 0.23, 0.14, 0.07, 0.05],
    premiumHolidayChargeSchedule: [0.9, 0.8, 0.6, 0.4, 0.2],
    withdrawalAndSurrenderChargeSchedule: [0.9, 0.8, 0.6, 0.4, 0.2],
  },
  {
    id: 'sgd-regular-mip-10',
    mipLength: 10,
    regularPremiumChargeSchedule: [0.35, 0.26, 0.15, 0.1, 0.045, 0.03, 0.03, 0.03, 0.03, 0.03],
    premiumHolidayChargeSchedule: [0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2],
    withdrawalAndSurrenderChargeSchedule: [0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2],
  },
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

function buildVariant(document: ExtractedPdfDocument, config: LegacyFlexVariantConfig): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Policy description and product structure', snippetNear(document, 1, 'Legacy Flex Solitaire is a whole life investment-linked plan', 20))
  const page2 = sourceRef(2, 'Loyalty bonus, top-ups, and future premium option', snippetNear(document, 2, 'We will provide an annual loyalty bonus', 22))
  const page9 = sourceRef(9, 'Premium charge schedule and policy fee', snippetNear(document, 9, '7.1 Premium Charge', 24))
  const page11 = sourceRef(11, 'Partial withdrawal and premium holiday mechanics', snippetNear(document, 11, '7.7 Partial Withdrawal Charge', 24))
  const page12 = sourceRef(12, 'Subscription of premium and top-up units', snippetNear(document, 12, '100% of your regular premium less any premium charge', 22))
  const page25 = sourceRef(25, 'Appendix 2 surrender, partial withdrawal, and premium holiday charges', snippetNear(document, 25, 'Appendix 2', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Regular Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['premium'],
      rateSchedule: buildRateSchedule(config.regularPremiumChargeSchedule),
      activeWindow: 'policy-term',
      notes: [
        'Models the published regular premium charge schedule by accepted regular-premium year for the regular-premium corridors only.',
        'The separate single-premium corridor remains informational only in V1.',
      ],
      sourceRefs: [page9, page12],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: TOP_UP_PREMIUM_CHARGE_RATE,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge on each accepted top-up premium allocated into the top-up account.',
        'Top-ups are blocked during premium holiday, but that acceptance gating remains informational only in V1.',
      ],
      sourceRefs: [page2, page9, page12],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['premium'],
      fallbackAppliesTo: ['topup'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(config.premiumHolidayChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium holiday charge on annualised regular premium during the selected minimum investment period.',
        'The charge is taken from the premium account first and falls back to the top-up account if the premium account is insufficient.',
      ],
      sourceRefs: [page11, page25],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['premium'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(config.withdrawalAndSurrenderChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix 2 charge factor on partial withdrawals from the premium account during the selected minimum investment period.',
        'Top-up-account withdrawals after 12 months are charge-free, but first-12-month top-up-account withdrawal charges remain informational only in V1.',
        'Withdrawal access option withdrawals remain informational only in V1.',
      ],
      sourceRefs: [page11, page25],
    },
  ]

  return {
    id: config.id,
    currency: 'SGD',
    mipLength: config.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'premium',
        label: 'Premium Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'premium', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'premium', contributionShare: 1 },
        ],
        sourceRefs: [page1, page12],
      },
      {
        id: 'topup',
        label: 'Top-up Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page2, page12],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...config.withdrawalAndSurrenderChargeSchedule],
    warnings: [
      `Legacy Flex Solitaire is modeled as a partial regular-premium subset in V1 for the ${config.mipLength}-year MIP corridor. The parser captures the premium-year regular premium charge schedule, top-up premium charge, premium-holiday charge, and premium-account Appendix 2 partial-withdrawal / surrender charge schedule.`,
      'Single-premium charging, loyalty bonus, policy fee, insurance cover charge, No Lapse Guarantee, and top-up-account first-12-month charge timing remain informational only in V1.',
    ],
    unsupportedItems: [
      'Single-premium corridor remains informational only in V1, including the 4% single-premium charge and the single-premium Appendix 2 charge schedule.',
      'Loyalty Bonus remains informational only because the current runtime does not distinguish chargeable premium-account withdrawals from top-up-account or withdrawal-access withdrawals for bonus suspension.',
      'Policy fee remains informational only because it depends on policy-entry sum assured and original insured entry age.',
      'Insurance cover charge and all protection-benefit formulas remain informational only because they depend on sum at risk plus insured-life inputs.',
      'No Lapse Guarantee debt carry and termination behavior remain informational only.',
      'Future Premium Option and recurring top-up enrollment remain informational only.',
      'Withdrawal Access Option and retirement/distribution payout elections remain informational only.',
      'Fund-level annual management fees, fund switching, and suspension of dealings remain informational only.',
      'Top-up-account withdrawals and surrenders within the first 12 months remain informational only because the current executable slice treats the top-up account as charge-free throughout.',
    ],
    sourceRefs: [page1, page2, page9, page11, page12, page25],
  }
}

export function parseIncomeLegacyFlexSolitaire({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-legacy-flex-solitaire',
    insurer: 'Income Insurance',
    productName: 'Legacy Flex Solitaire (VA3S / VA3R)',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:income-legacy-flex-solitaire-regular-premium-charge',
      'branch:income-legacy-flex-solitaire-top-up-premium-charge',
      'branch:income-legacy-flex-solitaire-premium-holiday-charge',
      'branch:income-legacy-flex-solitaire-appendix-2-withdrawal-and-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'income-legacy-flex-solitaire-single-premium-corridor',
      'income-legacy-flex-solitaire-loyalty-bonus',
      'income-legacy-flex-solitaire-policy-fee',
      'income-legacy-flex-solitaire-insurance-cover-charge',
      'income-legacy-flex-solitaire-no-lapse-guarantee',
      'income-legacy-flex-solitaire-future-premium-option',
      'income-legacy-flex-solitaire-withdrawal-access-option',
      'income-legacy-flex-solitaire-retirement-and-distribution-options',
      'income-legacy-flex-solitaire-secondary-insured-and-bequest-option',
      'income-legacy-flex-solitaire-top-up-account-first-12-month-charge-window',
      'income-legacy-flex-solitaire-fund-level-annual-management-fee',
      'income-legacy-flex-solitaire-fund-switching-and-suspension',
      'income-legacy-flex-solitaire-protection-benefits',
    ],
    warnings: [
      'Legacy Flex Solitaire (VA3S / VA3R) is cataloged as a partial modeled subset in V1. The current parser models only the regular-premium 5-year and 10-year corridors: premium-year regular premium charges, top-up premium charge, premium-holiday charge, and premium-account Appendix 2 withdrawal / surrender charges. The single-premium corridor, loyalty bonus, policy fee, protection-side charges, No Lapse Guarantee, and top-up-account first-12-month charge timing remain outside the current engine.',
    ],
    archived: false,
    variants: VARIANT_CONFIGS.map((config) => buildVariant(document, config)),
  }
}
