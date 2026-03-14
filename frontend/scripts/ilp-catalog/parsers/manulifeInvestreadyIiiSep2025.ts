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

const VARIANTS = [
  {
    id: 'sgd-mip-5-flexi-4-sep-2025',
    label: '5 Years Flexi 4',
    mipLength: 5,
    postMipFeeRate: 0.01,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
    ],
  },
  {
    id: 'sgd-mip-7-flexi-5-sep-2025',
    label: '7 Years Flexi 5',
    mipLength: 7,
    postMipFeeRate: 0.01,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.77 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
    ],
  },
  {
    id: 'sgd-mip-10-flexi-3-sep-2025',
    label: '10 Years Flexi 3',
    mipLength: 10,
    postMipFeeRate: 0.007,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
    ],
  },
  {
    id: 'sgd-mip-10-flexi-5-sep-2025',
    label: '10 Years Flexi 5',
    mipLength: 10,
    postMipFeeRate: 0.007,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
    ],
  },
  {
    id: 'sgd-mip-10-flexi-8-sep-2025',
    label: '10 Years Flexi 8',
    mipLength: 10,
    postMipFeeRate: 0.007,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.47 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.44 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.21 },
    ],
  },
  {
    id: 'sgd-mip-13-flexi-10-sep-2025',
    label: '13 Years Flexi 10',
    mipLength: 13,
    postMipFeeRate: 0.007,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.81 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.53 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.27 },
      { startPolicyYear: 9, endPolicyYear: 9, rate: 0.22 },
      { startPolicyYear: 10, endPolicyYear: 10, rate: 0.14 },
    ],
  },
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
  lineWindow = 18,
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
  variantDefinition: typeof VARIANTS[number],
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'Manulife InvestReady (III)', 18))
  const page4 = sourceRef(4, 'Bonuses', snippetNear(document, 4, 'Loyalty Bonus', 24))
  const page6 = sourceRef(6, 'COI, administrative charge, and policy fee', snippetNear(document, 6, 'Cost of Insurance', 28))
  const page9 = sourceRef(9, 'Top-up premium and policy options', snippetNear(document, 9, 'Top-up Premium', 20))
  const page12 = sourceRef(12, 'Distribution of dividends', snippetNear(document, 12, 'Distribution of Dividends', 22))
  const page20 = sourceRef(20, 'Appendix A annual COI table', snippetNear(document, 20, 'Annual Cost of Insurance for Death Benefit', 20))

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
      sourceRefs: [page1, page6, page20],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published prevailing 0% top-up charge for this cohort.',
      ],
      sourceRefs: [page9],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: variantDefinition.premiumShortfallSchedule.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge before Flexi Start for the ${variantDefinition.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page1, page9],
    },
  ]

  return {
    id: variantDefinition.id,
    currency: 'SGD',
    mipLength: variantDefinition.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.025,
        postMipFeeRate: variantDefinition.postMipFeeRate,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page9],
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
        'During MIP, dividend-paying funds are compulsory to be reinvested.',
        'After MIP, V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page12],
    },
    eecTable: [],
    warnings: [
      `${variantDefinition.label} is cataloged as a partial modeled subset in V1. The parser captures the published 2.50% / ${(variantDefinition.postMipFeeRate * 100).toFixed(2)}% administration-charge path, the 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, and the reinvest-default distribution-mode assumption surface.`,
      'Policy-fee thresholds, all bonus mechanics, surrender / partial-withdrawal charge schedules, and life-stage partial-withdrawal waivers remain outside the current engine.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
    ],
    unsupportedItems: [
      'Policy fee remains informational only because it depends on the first-year annualised premium band selected for the variant.',
      'Welcome Bonus, Annual Premium Bonus, Loyalty Bonus, and Step-up Booster Bonus remain informational only.',
      'Full-surrender and partial-withdrawal charge schedules remain informational only, including the life-stage partial-withdrawal waiver corridor.',
      'Death / terminal-illness payout handling remains informational only beyond the modeled COI deduction.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching, premium redirection, automatic fund rebalancing, and change-of-mode-of-payment options remain informational only.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
    ],
    sourceRefs: [page1, page4, page6, page9, page12, page20],
  }
}

export function parseManulifeInvestreadyIiiSep2025(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-iii-sep-2025',
    insurer: 'Manulife Singapore',
    productName: 'Manulife InvestReady (III)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulife-investready-iii-policy-fee',
      'manulife-investready-iii-welcome-bonus',
      'manulife-investready-iii-annual-premium-bonus',
      'manulife-investready-iii-loyalty-bonus',
      'manulife-investready-iii-step-up-booster-bonus',
      'manulife-investready-iii-full-surrender-charge',
      'manulife-investready-iii-partial-withdrawal-charge',
      'manulife-investready-iii-life-stage-partial-withdrawal',
      'manulife-investready-iii-dividend-payout-threshold',
      'manulife-investready-iii-reinvested-dividend-withdrawals',
      'manulife-investready-iii-benefit-payout-handling',
      'manulife-investready-iii-fund-management-charge',
      'manulife-investready-iii-fund-switching-and-redirection',
      'manulife-investready-iii-reinstatement',
    ],
    warnings: [
      'Manulife InvestReady (III) Sep-2025 summary cohort is cataloged as a separate partial modeled subset in V1. The parser captures the published administration-charge path, the 101% paid-premium-floor cost-of-insurance formula after you enter insured-life details and current premium bases, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, and the reinvest-default distribution-mode assumption surface, while policy-fee thresholds, bonus mechanics, withdrawal / surrender schedules, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: VARIANTS.map((variant) => buildVariant(context.document, variant)),
  }
}
