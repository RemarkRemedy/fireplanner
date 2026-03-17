import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

type ManuInvestDuoMip = 10 | 15 | 20

interface ManuInvestDuoVariantConfig {
  id: string
  mipLength: ManuInvestDuoMip
  withdrawalAndSurrenderChargeSchedule: readonly number[]
  loyaltyBonusDuringMipRate: number
  loyaltyBonusAfterMipRate: number
}

const VARIANT_CONFIGS: readonly ManuInvestDuoVariantConfig[] = [
  {
    id: 'sgd-mip-10',
    mipLength: 10,
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.8, 0.63, 0.55, 0.47, 0.4, 0.3, 0.2, 0.08],
    loyaltyBonusDuringMipRate: 0.001,
    loyaltyBonusAfterMipRate: 0.002,
  },
  {
    id: 'sgd-mip-15',
    mipLength: 15,
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.83, 0.68, 0.61, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.08],
    loyaltyBonusDuringMipRate: 0.002,
    loyaltyBonusAfterMipRate: 0.005,
  },
  {
    id: 'sgd-mip-20',
    mipLength: 20,
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.9, 0.81, 0.71, 0.65, 0.59, 0.53, 0.48, 0.43, 0.38, 0.34, 0.3, 0.26, 0.22, 0.18, 0.14, 0.1, 0.09, 0.08],
    loyaltyBonusDuringMipRate: 0.003,
    loyaltyBonusAfterMipRate: 0.008,
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
  lineWindow = 14,
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
    rate,
  }))
}

function buildBonuses(
  config: ManuInvestDuoVariantConfig,
  page4: IlpCatalogSourceRef,
  page8: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  return [
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 7,
      endPolicyYear: config.mipLength,
      rate: config.loyaltyBonusDuringMipRate,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        `Models the published annual Loyalty Bonus rate from policy year 7 through the end of the ${config.mipLength}-year MIP corridor.`,
        'The policy must stay in force, and no partial withdrawals in the preceding 12 months are allowed for the loyalty bonus to be credited.',
        'Top-up premiums remain eligible as part of account value, while withdrawals of accumulated reinvested dividends remain informational only in V1.',
      ],
      sourceRefs: [page4, page8],
    },
    {
      id: 'loyalty-bonus-2',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      rate: config.loyaltyBonusAfterMipRate,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        `Models the published annual Loyalty Bonus rate after the ${config.mipLength}-year MIP ends.`,
        'The policy must stay in force, and no partial withdrawals in the preceding 12 months are allowed for the loyalty bonus to be credited.',
        'Top-up premiums remain eligible as part of account value, while withdrawals of accumulated reinvested dividends remain informational only in V1.',
      ],
      sourceRefs: [page4, page8],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, config: ManuInvestDuoVariantConfig): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'ManuInvest Duo is a regular-premium investment-linked plan', 20))
  const page4 = sourceRef(4, 'Welcome Bonus and Loyalty Bonus', snippetNear(document, 4, 'Welcome Bonus', 28))
  const page5 = sourceRef(5, 'COI and administrative charge', snippetNear(document, 5, 'Cost of Insurance', 26))
  const page6 = sourceRef(6, 'Partial withdrawal charge and surrender charge', snippetNear(document, 6, 'Partial withdrawal charge', 24))
  const page8 = sourceRef(8, 'Top-up premium option', snippetNear(document, 8, 'Top-up Premium', 18))
  const page9 = sourceRef(9, 'Premium Flexibility Benefit and withdrawals', snippetNear(document, 9, 'Premium Flexibility Benefit', 24))
  const page14 = sourceRef(14, 'Distribution of Dividend', snippetNear(document, 14, 'If you choose to invest in any fund(s) that pays dividends', 20))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'cost-of-insurance',
      label: 'Cost of Insurance (Death / TI / TPD)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'manulife-manuinvest-duo-death-ti-tpd',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires insured-life details plus the current sum insured before the calculator can model the annualised cost of insurance.',
        'Models the published death / terminal illness / TPD NAAR formula of [sum insured less partial withdrawals] less account value.',
      ],
      sourceRefs: [page1, page5],
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
        'Models the published prevailing 0% top-up charge for the selected 10-year MIP corridor.',
      ],
      sourceRefs: [page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(config.withdrawalAndSurrenderChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published ${config.mipLength}-year MIP partial-withdrawal charge schedule.`,
        'The S$50 withdrawal-flexibility fee corridor after the 5th policy anniversary remains informational only in V1.',
      ],
      sourceRefs: [page6, page9],
    },
  ]

  return {
    id: config.id,
    currency: 'SGD',
    mipLength: config.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.05,
        postMipFeeRate: 0.01,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page4, page5, page8],
      },
    ],
    bonuses: buildBonuses(config, page4, page8),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds may be reinvested or paid out in cash, subject to the product summary minimum payout amount.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published $40 minimum annual threshold remain reinvested.',
      ],
      sourceRefs: [page14],
    },
    eecTable: [...config.withdrawalAndSurrenderChargeSchedule],
    warnings: [
      `ManuInvest Duo is cataloged as a supported V1 corridor for the ${config.mipLength}-year MIP. The parser captures the published 5.00% / 1.00% administration-charge path, the protected-base cost-of-insurance formula after you enter insured-life details and current sum insured, the current-state death-benefit estimate from that same current sum insured, the published Loyalty Bonus rate windows, the prevailing 0% top-up charge, the MIP partial-withdrawal charge schedule, the MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface.`,
      'Premium shortfall charging remains metadata-only because Premium Flexibility Benefit waives the published shortfall charge up to a cumulative missed-premium limit that the current event kernel does not yet track.',
      'Welcome Bonus, withdrawal-flexibility fee handling, and fund-level management charges remain informational only.',
      'Dividend-paying funds seed reinvestment by default in V1. Cash payout requires a manual annual distribution-yield assumption with the published $40 minimum annual payout threshold.',
    ],
    unsupportedItems: [
      'Death, terminal-illness, and TPD benefit payout handling remain informational only beyond the current death-benefit estimate.',
      'Welcome Bonus remains informational only because the published bonus grid depends on the issue-time sum-insured multiple.',
      'Premium shortfall charge and Premium Flexibility Benefit remain informational only because they depend on a cumulative missed-premium allowance ledger.',
      'The S$50 withdrawal-flexibility fee corridor and the published aggregate annual withdrawal cap remain informational only.',
      'Withdrawals of accumulated reinvested dividends remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund-switching, premium redirection, automatic rebalancing, and payment-mode changes remain informational only.',
      'Change-of-sum-insured and change-of-life-insured options remain informational only.',
    ],
    sourceRefs: [page1, page5, page8, page9, page14],
  }
}

export function parseManulifeManuinvestDuo(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-manuinvest-duo',
    insurer: 'Manulife Singapore',
    productName: 'ManuInvest Duo',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'branch:manuinvest-duo-loyalty-bonus',
      'branch:manuinvest-duo-administrative-charge',
      'branch:manuinvest-duo-zero-top-up-charge',
      'branch:manuinvest-duo-partial-withdrawal-charge',
      'branch:manuinvest-duo-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manuinvest-duo-welcome-bonus',
      'manuinvest-duo-premium-shortfall-charge',
      'manuinvest-duo-premium-flexibility-benefit',
      'manuinvest-duo-withdrawal-flexibility-charge-threshold',
      'manuinvest-duo-death-ti-tpd-benefit-payout-handling',
      'manuinvest-duo-reinvested-dividend-withdrawals',
      'manuinvest-duo-fund-management-charge',
      'manuinvest-duo-fund-switching-and-redirection',
      'manuinvest-duo-sum-insured-change',
      'manuinvest-duo-life-insured-change',
    ],
    warnings: [
      'ManuInvest Duo is cataloged as a supported V1 corridor. The parser captures the published 5.00% / 1.00% administration-charge path, the protected-base death / TI / TPD cost-of-insurance formula after you enter insured-life details and current sum insured, the current-state death-benefit estimate from that same current sum insured, the published Loyalty Bonus rate windows, the prevailing 0% top-up charge, the MIP withdrawal / surrender charge schedules, and the reinvest-default distribution-mode assumption surface with the published $40 minimum annual payout threshold, while the issue-time Welcome Bonus grid, premium-flexibility shortfall behavior, withdrawal-flexibility fee handling, death / TI / TPD claim-side treatment, and fund-level charges remain informational only.',
    ],
    archived: false,
    variants: VARIANT_CONFIGS.map((config) => buildVariant(context.document, config)),
  }
}
