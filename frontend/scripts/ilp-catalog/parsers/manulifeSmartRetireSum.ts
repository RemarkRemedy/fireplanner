import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateEventChargeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const VARIANTS = [
  {
    id: 'sgd-mip-8-flexi-3',
    label: '8 Years Flexi 3',
    mipLength: 8,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
    ],
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0],
  },
  {
    id: 'sgd-mip-8-flexi-5',
    label: '8 Years Flexi 5',
    mipLength: 8,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.4 },
    ],
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0],
  },
  {
    id: 'sgd-mip-12-flexi-8',
    label: '12 Years Flexi 8',
    mipLength: 12,
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
    ],
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0],
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

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate: roundRate(rate),
  }))
}

function buildVariant(
  document: ExtractedPdfDocument,
  variantDefinition: typeof VARIANTS[number],
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'Target Retirement Sum', 18))
  const page3 = sourceRef(3, 'Target retirement sum and minimum premium', snippetNear(document, 3, 'Payment of Target Retirement Sum', 18))
  const page5 = sourceRef(5, 'Administrative charge and surrender charge', snippetNear(document, 5, 'Administrative Charge', 22))
  const page6 = sourceRef(6, 'Partial withdrawal charge and premium shortfall charge', snippetNear(document, 6, 'Premium Shortfall Charge', 24))
  const page8 = sourceRef(8, 'Regular income drawdown and policy options', snippetNear(document, 8, 'Regular Income Drawdown', 22))
  const page9 = sourceRef(9, 'Distribution of dividend', snippetNear(document, 9, 'Distribution of Dividend', 20))

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
        'Models the published prevailing 0% top-up charge.',
      ],
      sourceRefs: [page8],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: variantDefinition.premiumShortfallSchedule.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge before Flexi Start for the ${variantDefinition.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page1, page6],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(variantDefinition.withdrawalAndSurrenderChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published MIP partial-withdrawal charge schedule for the ${variantDefinition.label} corridor.`,
      ],
      sourceRefs: [page5, page6],
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
        postMipFeeRate: 0.0075,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page8],
      },
    ],
    bonuses: [],
    feeRules: [],
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
      sourceRefs: [page9],
    },
    eecTable: [...variantDefinition.withdrawalAndSurrenderChargeSchedule],
    warnings: [
      `${variantDefinition.label} is cataloged as a partial modeled subset in V1. The parser captures the published 2.50% / 0.75% administrative-charge path, the MIP withdrawal / surrender charge schedule, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, and the reinvest-default distribution-mode assumption surface.`,
      'Target Retirement Sum withdrawal, optional regular-income drawdown elections, hybrid death-benefit / COI mechanics, waiver-of-premium on TPD, COI refund at target retirement age, bonuses, and fund-level management charges remain outside the current engine.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
    ],
    unsupportedItems: [
      'Target Retirement Sum withdrawal remains informational only and should be represented manually with withdrawal events if needed.',
      'Optional regular-income drawdown elections remain informational only.',
      'Death-benefit formulas and monthly COI deductions remain informational only because they switch from a 105%-of-paid-premium floor during MIP to a fixed basic-sum-insured corridor during accumulation and then stop at the target retirement age.',
      'Waiver of Premium benefit on TPD and its separate COI table remain informational only.',
      'Refund of Cost of Insurance at target retirement age remains informational only.',
      'Welcome Bonus and Loyalty Bonus remain informational only.',
      'Flexi-start regular-premium variation and change-of-basic-sum-insured mechanics remain informational only.',
      'Lapsing / reinstatement effects and benefit-payout handling remain informational only.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
      'Fund-level management charges, fund switching, premium redirection, and automatic fund rebalancing remain informational only.',
    ],
    sourceRefs: [page1, page3, page5, page6, page8, page9],
  }
}

export function parseManulifeSmartRetireSum({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-smartretire-v-sum',
    insurer: 'Manulife Singapore',
    productName: 'Manulife SmartRetire (V) - Sum',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:manulife-smartretire-v-administrative-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
      'branch:manulife-smartretire-v-premium-shortfall-charge',
      'branch:manulife-smartretire-v-zero-top-up-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulife-smartretire-v-sum-target-retirement-sum-withdrawal',
      'manulife-smartretire-v-sum-regular-income-drawdown',
      'manulife-smartretire-v-sum-death-benefit',
      'manulife-smartretire-v-sum-waiver-of-premium-benefit',
      'manulife-smartretire-v-sum-coi-refund',
      'manulife-smartretire-v-sum-welcome-bonus',
      'manulife-smartretire-v-sum-loyalty-bonus',
      'manulife-smartretire-v-sum-flexi-start-premium-variation',
      'manulife-smartretire-v-sum-reinstatement',
      'manulife-smartretire-v-sum-dividend-payout-threshold',
      'manulife-smartretire-v-sum-reinvested-dividend-withdrawal',
      'manulife-smartretire-v-sum-fund-management-charge',
      'manulife-smartretire-v-sum-fund-switching-and-redirection',
    ],
    warnings: [
      'Manulife SmartRetire (V) - Sum is cataloged as a supported V1 product for the regular-pay corridors. The parser captures the published administrative-charge path, MIP withdrawal / surrender schedule, premium-shortfall charge before Flexi Start, prevailing 0% top-up charge, and the reinvest-default distribution-mode assumption surface, while retirement-sum withdrawal handling, optional drawdown elections, hybrid COI mechanics, TPD waiver, COI refund, bonuses, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: VARIANTS.map((variantDefinition) => buildVariant(document, variantDefinition)),
  }
}
