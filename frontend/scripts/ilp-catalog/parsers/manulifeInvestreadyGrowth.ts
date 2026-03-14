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

const PREMIUM_SHORTFALL_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.62 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.32 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.26 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.21 },
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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 16,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(
  document: ExtractedPdfDocument,
  plan: { id: string, mipLength: 15 | 20, label: '15 Years Flexi 10' | '20 Years Flexi 10' },
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'Manulife InvestReady Growth', 18))
  const page4 = sourceRef(4, 'Bonuses', snippetNear(document, 4, 'Premium Bonus', 28))
  const page5 = sourceRef(5, 'COI and administrative charge', snippetNear(document, 5, 'Cost of Insurance', 26))
  const page7 = sourceRef(7, 'Premium shortfall charge', snippetNear(document, 7, 'Premium Shortfall Charge', 24))
  const page8 = sourceRef(8, 'Top-up premium', snippetNear(document, 8, 'Top-up Premium', 18))
  const page11 = sourceRef(11, 'Distribution of dividend', snippetNear(document, 11, 'Distribution of Dividend', 20))
  const page18 = sourceRef(18, 'Appendix A annual COI table', snippetNear(document, 18, 'Annual Cost of Insurance', 20))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'cost-of-insurance',
      label: 'Cost of Insurance (Death / TI)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'manulife-investready-iii-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires insured-life details plus the current net regular premium base and current net top-up premium base before the calculator can model the annualised COI.',
        'Models the published 101% paid-premium floor net-amount-at-risk formula for death and terminal illness benefit, including top-up premiums and withdrawals.',
      ],
      sourceRefs: [page1, page5, page18],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge schedule before Flexi Start for the ${plan.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page1, page7],
    },
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published prevailing 5.0% top-up charge.',
      ],
      sourceRefs: [page8],
    },
  ]

  return {
    id: plan.id,
    currency: 'SGD',
    mipLength: plan.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        postMipFeeRate: 0,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page8],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds may be reinvested or paid out in cash, subject to the product summary minimum payout amount.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page11],
    },
    eecTable: [],
    warnings: [
      `${plan.label} is cataloged as a partial modeled subset in V1. The parser captures the published 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the premium-shortfall charge before Flexi Start, the prevailing 5.0% top-up charge, and the reinvest-default distribution-mode assumption surface.`,
      'Administrative-charge economics, all bonus mechanics, surrender / partial-withdrawal charge schedules, partial-withdrawal flexibility, and fund-level management charges remain outside the current engine.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
    ],
    unsupportedItems: [
      'Administrative charge remains informational only because the published 6% accumulated minimum-premium base is not yet authored as a parser-backed charge basis.',
      'Welcome Bonus, Annual Premium Bonus, Premium Bonus, Booster Bonus, and Loyalty Bonus remain informational only.',
      'Full-surrender and partial-withdrawal charge schedules remain informational only, including the partial-withdrawal flexibility corridor and life-stage waiver.',
      'Death / terminal-illness payout handling remains informational only beyond the modeled COI deduction.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching, premium redirection, automatic fund rebalancing, change-of-payment-mode, and change-of-life-insured options remain informational only.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
    ],
    sourceRefs: [page1, page4, page5, page7, page8, page11, page18],
  }
}

export function parseManulifeInvestreadyGrowth(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-growth',
    insurer: 'Manulife Singapore',
    productName: 'Manulife InvestReady Growth',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:manulife-investready-growth-premium-shortfall-charge',
      'branch:manulife-investready-growth-top-up-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulife-investready-growth-administrative-charge',
      'manulife-investready-growth-welcome-bonus',
      'manulife-investready-growth-annual-premium-bonus',
      'manulife-investready-growth-premium-bonus',
      'manulife-investready-growth-booster-bonus',
      'manulife-investready-growth-loyalty-bonus',
      'manulife-investready-growth-partial-withdrawal-charge',
      'manulife-investready-growth-partial-withdrawal-flexibility',
      'manulife-investready-growth-surrender-charge',
      'manulife-investready-growth-dividend-payout-threshold',
      'manulife-investready-growth-reinvested-dividend-withdrawals',
      'manulife-investready-growth-benefit-payout-handling',
      'manulife-investready-growth-fund-management-charge',
      'manulife-investready-growth-fund-switching-and-redirection',
      'manulife-investready-growth-life-insured-change',
      'manulife-investready-growth-reinstatement',
    ],
    warnings: [
      'Manulife InvestReady Growth is cataloged as a partial modeled subset in V1. The parser captures the paid-premium-floor cost-of-insurance formula after you enter insured-life details and current premium bases, the premium-shortfall charge before Flexi Start, the prevailing 5.0% top-up charge, and the reinvest-default distribution-mode assumption surface, while the administrative charge, bonus mechanics, withdrawal / surrender schedules, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, {
        id: 'sgd-mip-15-flexi-10',
        mipLength: 15,
        label: '15 Years Flexi 10',
      }),
      buildVariant(context.document, {
        id: 'sgd-mip-20-flexi-10',
        mipLength: 20,
        label: '20 Years Flexi 10',
      }),
    ],
  }
}
