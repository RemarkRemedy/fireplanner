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

const TERM_OPTIONS = [10, 15, 20] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

interface VariantConfig {
  mipLength: MipTerm
  annualPremiumMin: number
  startupBonusTiers: IlpTemplateBonusTier[]
  policyChargeRate: number
  policyChargeTailRates: Array<{
    minAnnualisedPremiumsPaid: number
    maxAnnualisedPremiumsPaid: number | null
    rate: number
  }>
  surrenderRates: number[]
  specialBonusStartYear: number
  specialBonusEndYear: number
  premiumFreePeriodNote: string
}

const PREMIUM_CHARGE_RATE = 0.03

const VARIANT_CONFIGS: Record<MipTerm, VariantConfig> = {
  10: {
    mipLength: 10,
    annualPremiumMin: 4_800,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 9_599.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.32 },
    ],
    policyChargeRate: 0.025,
    policyChargeTailRates: [
      { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 5, rate: 0.012 },
      { minAnnualisedPremiumsPaid: 6, maxAnnualisedPremiumsPaid: 6, rate: 0.01 },
      { minAnnualisedPremiumsPaid: 7, maxAnnualisedPremiumsPaid: 7, rate: 0.0086 },
      { minAnnualisedPremiumsPaid: 8, maxAnnualisedPremiumsPaid: 8, rate: 0.0075 },
      { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.0067 },
      { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
    ],
    surrenderRates: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    specialBonusStartYear: 6,
    specialBonusEndYear: 10,
    premiumFreePeriodNote: 'Up to 60 months of Premium-Free Period may be accumulated across the 10-year premium payment term.',
  },
  15: {
    mipLength: 15,
    annualPremiumMin: 3_600,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 7_199.99, rate: 0.18 },
      { currency: 'SGD', minAnnualPremium: 7_200, maxAnnualPremium: null, rate: 0.4 },
    ],
    policyChargeRate: 0.0205,
    policyChargeTailRates: [
      { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 8, rate: 0.0113 },
      { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.01 },
      { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: 10, rate: 0.009 },
      { minAnnualisedPremiumsPaid: 11, maxAnnualisedPremiumsPaid: 11, rate: 0.0082 },
      { minAnnualisedPremiumsPaid: 12, maxAnnualisedPremiumsPaid: 12, rate: 0.0075 },
      { minAnnualisedPremiumsPaid: 13, maxAnnualisedPremiumsPaid: 13, rate: 0.007 },
      { minAnnualisedPremiumsPaid: 14, maxAnnualisedPremiumsPaid: 14, rate: 0.0065 },
      { minAnnualisedPremiumsPaid: 15, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
    ],
    surrenderRates: [1, 1, 0.81, 0.7, 0.6, 0.58, 0.53, 0.51, 0.4, 0.38, 0.33, 0.28, 0.22, 0.18, 0.08],
    specialBonusStartYear: 11,
    specialBonusEndYear: 15,
    premiumFreePeriodNote: 'Up to 84 months of Premium-Free Period may be accumulated across the 15-year premium payment term.',
  },
  20: {
    mipLength: 20,
    annualPremiumMin: 2_400,
    startupBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0.37 },
      { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: null, rate: 0.75 },
    ],
    policyChargeRate: 0.0195,
    policyChargeTailRates: [
      { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 9, rate: 0.0134 },
      { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: 10, rate: 0.012 },
      { minAnnualisedPremiumsPaid: 11, maxAnnualisedPremiumsPaid: 11, rate: 0.011 },
      { minAnnualisedPremiumsPaid: 12, maxAnnualisedPremiumsPaid: 12, rate: 0.01 },
      { minAnnualisedPremiumsPaid: 13, maxAnnualisedPremiumsPaid: 13, rate: 0.0093 },
      { minAnnualisedPremiumsPaid: 14, maxAnnualisedPremiumsPaid: 14, rate: 0.0086 },
      { minAnnualisedPremiumsPaid: 15, maxAnnualisedPremiumsPaid: 15, rate: 0.008 },
      { minAnnualisedPremiumsPaid: 16, maxAnnualisedPremiumsPaid: 16, rate: 0.0075 },
      { minAnnualisedPremiumsPaid: 17, maxAnnualisedPremiumsPaid: 17, rate: 0.0071 },
      { minAnnualisedPremiumsPaid: 18, maxAnnualisedPremiumsPaid: 18, rate: 0.0067 },
      { minAnnualisedPremiumsPaid: 19, maxAnnualisedPremiumsPaid: 19, rate: 0.0064 },
      { minAnnualisedPremiumsPaid: 20, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
    ],
    surrenderRates: [1, 1, 0.9, 0.75, 0.63, 0.59, 0.55, 0.51, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.14, 0.1, 0.08, 0.08, 0.08, 0.08],
    specialBonusStartYear: 16,
    specialBonusEndYear: 20,
    premiumFreePeriodNote: 'Up to 132 months of Premium-Free Period may be accumulated across the 20-year premium payment term.',
  },
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

function buildBonuses(config: VariantConfig, page2: IlpCatalogSourceRef, page3: IlpCatalogSourceRef): IlpTemplateBonus[] {
  return [
    {
      id: 'startup-bonus',
      type: 'sign-up',
      label: 'Start-up Bonus',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: config.startupBonusTiers.map((tier) => ({ ...tier })),
      notes: [
        'Credited on regular premium received during the first policy year only.',
        'Top-up premiums do not receive the Start-up Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'special-bonus',
      type: 'allocation',
      label: 'Special Bonus',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: config.specialBonusStartYear,
      endPolicyYear: config.specialBonusEndYear,
      rate: 0.03,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied on each regular premium received during the published Special Bonus Period.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['regular'],
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      rate: 0.001,
      amount: null,
      tieredRates: [],
      suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
      notes: [
        'Applied monthly on the Regular Premium Account from the month after the premium payment term ends.',
        'No Loyalty Bonus is paid on the Top-up Account.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(config: VariantConfig, page18: IlpCatalogSourceRef): IlpTemplateFeeRule[] {
  return [
    {
      id: 'policy-charge-during-premium-term',
      label: 'Policy Charge',
      basis: 'cumulative-paid-regular-premium',
      rate: roundRate(config.policyChargeRate),
      amount: null,
      appliesTo: ['regular'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: config.mipLength,
      cumulativePaidPremiumConfig: {
        annualisedPremiumAtIssue: config.annualPremiumMin,
      },
      notes: [
        'Models the published monthly policy charge as a percentage of cumulative regular premiums actually paid during the premium payment term.',
      ],
      sourceRefs: [page18],
    },
    {
      id: 'policy-charge-after-premium-term',
      label: 'Policy Charge',
      basis: 'cumulative-paid-regular-premium',
      rate: roundRate(config.policyChargeTailRates[0]?.rate ?? 0),
      amount: null,
      appliesTo: ['regular'],
      activeWindow: 'policy-term',
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      cumulativePaidPremiumConfig: {
        annualisedPremiumAtIssue: config.annualPremiumMin,
        countRateSchedule: config.policyChargeTailRates.map((tier) => ({ ...tier })),
      },
      notes: [
        'Models the published post-premium-term policy charge using the Number of Annualised Regular Premiums Paid tiers.',
      ],
      sourceRefs: [page18],
    },
  ]
}

function buildEventChargeRules(page7: IlpCatalogSourceRef, page18: IlpCatalogSourceRef, page23: IlpCatalogSourceRef): IlpTemplateEventChargeRule[] {
  return [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: PREMIUM_CHARGE_RATE,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies a 3% upfront charge on recurring and ad-hoc top-up premiums.',
      ],
      sourceRefs: [page7, page18],
    },
    {
      id: 'startup-bonus-recovery-charge',
      label: 'Start-up Bonus Recovery Charge',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-tiered-startup-recovery',
      appliesTo: ['regular'],
      rate: 0,
      amount: 0,
      sourceBonusId: 'startup-bonus',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Start-up Bonus recovery charge when regular premium is reduced.',
      ],
      sourceRefs: [page7, page23],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateVariant {
  const config = VARIANT_CONFIGS[term]
  const page1 = sourceRef(1, 'Plan description and death benefit', snippetNear(document, 1, 'PRODUCT SUMMARY: Invest Wealth Purpose', 12))
  const page2 = sourceRef(2, 'Start-up Bonus and Special Bonus', snippetNear(document, 2, 'Start-up Bonus', 18))
  const page3 = sourceRef(3, 'Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 16))
  const page4 = sourceRef(4, 'Premium-Free Period', snippetNear(document, 4, 'Premium-Free Period', 18))
  const page6 = sourceRef(6, 'Premium Repayment and missed premiums', snippetNear(document, 6, 'Premium Repayment', 18))
  const page7 = sourceRef(7, 'Change in Regular Premium and Top-up', snippetNear(document, 7, 'Change in Regular Premium', 18))
  const page8 = sourceRef(8, 'Partial Withdrawal and Full Surrender', snippetNear(document, 8, 'Partial Withdrawal', 18))
  const page9 = sourceRef(9, 'Change of Life Insured', snippetNear(document, 9, 'Change of Life Insured', 18))
  const page18 = sourceRef(18, 'Policy Charge', snippetNear(document, 18, 'Policy charge is payable', 18))
  const page19 = sourceRef(19, 'Policy Charge example and Premium-Free Period freeze', snippetNear(document, 19, 'Policyowner exercises Premium-Free Period', 18))
  const page21 = sourceRef(21, 'Partial Withdrawal Charge', snippetNear(document, 21, 'Partial withdrawal charge', 18))
  const page22 = sourceRef(22, 'Surrender Charge', snippetNear(document, 22, 'Surrender charge', 18))
  const page23 = sourceRef(23, 'Start-up Bonus Recovery Charge and Insurance Charge', snippetNear(document, 23, 'Start-up Bonus recovery charge', 18))

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: config.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'regular',
        label: 'Regular Premium Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'regular', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'regular', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page7, page8],
      },
      {
        id: 'topup',
        label: 'Top-up Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page7, page8],
      },
    ],
    bonuses: buildBonuses(config, page2, page3),
    feeRules: buildFeeRules(config, page18),
    eventChargeRules: buildEventChargeRules(page7, page18, page23),
    eecTable: [...config.surrenderRates],
    warnings: [
      'Invest Wealth Purpose is modeled as a partial subset in V1. The parser captures the cumulative-paid policy charge, Start-up / Special / Loyalty Bonuses, top-up premium charge, Start-up Bonus recovery charge, and surrender-charge horizon.',
      config.premiumFreePeriodNote,
      'Premium-Free Period entitlement months, premium shortfall charges after that entitlement is exhausted, and free partial withdrawal allowances remain informational only in V1.',
      'Death / terminal illness insurance charge and change-of-life-insured effects remain informational only in V1.',
    ],
    unsupportedItems: [
      'Premium-Free Period entitlement tracking remains informational only.',
      'Premium shortfall charge remains informational only.',
      'Free partial withdrawal allowance from the Regular Premium Account remains informational only.',
      'Death and terminal illness insurance charge remains informational only.',
      'Change of Life Insured remains informational only.',
      'Optional riders remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page6, page7, page8, page9, page18, page19, page21, page22, page23],
  }
}

export function parseEtiqaInvestWealthPurpose(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-invest-wealth-purpose',
    insurer: 'Etiqa',
    productName: 'Invest Wealth Purpose',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:etiqa-wealth-purpose-startup-bonus',
      'branch:etiqa-wealth-purpose-special-bonus',
      'branch:etiqa-wealth-purpose-loyalty-bonus',
      'branch:etiqa-wealth-purpose-cumulative-paid-policy-charge',
      'branch:etiqa-wealth-purpose-top-up-premium-charge',
      'branch:etiqa-wealth-purpose-startup-bonus-recovery',
      'branch:etiqa-wealth-purpose-surrender-charge',
      'branch:etiqa-wealth-purpose-top-up-account-routing',
    ],
    metadataOnlyBehaviors: [
      'etiqa-wealth-purpose-premium-free-period-entitlement',
      'etiqa-wealth-purpose-premium-shortfall-charge',
      'etiqa-wealth-purpose-free-partial-withdrawal-limit',
      'etiqa-wealth-purpose-insurance-charge',
      'etiqa-wealth-purpose-change-of-life-insured',
      'etiqa-wealth-purpose-optional-riders',
    ],
    warnings: [
      'Invest Wealth Purpose is currently modeled as a partial product in V1. The regular-premium / top-up account structure, cumulative-paid policy charge, Start-up / Special / Loyalty Bonuses, top-up premium charge, Start-up Bonus recovery charge, and surrender-charge schedule are modeled.',
      'Premium-Free Period entitlement months, premium shortfall charges after entitlement exhaustion, free partial withdrawal allowances, and insurance-charge behavior remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(context.document, term)),
  }
}
