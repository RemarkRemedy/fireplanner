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

const PREMIUM_SHORTFALL_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
] as const

const WELCOME_BONUS_TIERS = [
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 47_999.99, rate: 0.01 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.02 },
] as const
const ANNUAL_PREMIUM_BONUS_RATE = 0

const WITHDRAWAL_AND_SURRENDER_CHARGE_SCHEDULE = [1, 1, 0.75, 0.4, 0.2] as const

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
  lineWindow = 12,
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

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page4 = sourceRef(4, 'Welcome Bonus', snippetNear(document, 4, 'Welcome Bonus rate is based on the table below', 24))
  const page5 = sourceRef(5, 'Loyalty Bonus', snippetNear(document, 5, 'Loyalty Bonus rate is based on the table below', 24))

  return [
    {
      id: 'welcome-bonus',
      type: 'sign-up',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: WELCOME_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Applied to the first 12 months of regular basic premium paid, excluding top-up premiums.',
        'The supported SGD 5 Years Flexi 4 corridor uses the published 1% / 2% welcome-bonus tiers by annualised basic premium.',
      ],
      sourceRefs: [page4],
    },
    {
      id: 'annual-premium-bonus',
      type: 'allocation',
      label: 'Annual Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: ANNUAL_PREMIUM_BONUS_RATE,
      amount: null,
      requiresPremiumsPaidUpToDate: true,
      requiredRegularPremiumPaymentFrequency: 'annual',
      tieredRates: [],
      notes: [
        'Applied once on the first annual regular basic premium when the policy is issued on annual premium payment mode.',
        'Any later change from annual to a non-annual premium payment mode during the premium-shortfall-charge period remains informational only in V1.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 6,
      endPolicyYear: null,
      rate: 0,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'The supported SGD 5 Years Flexi 4 corridor publishes a 0.0% loyalty-bonus rate after MIP, so the executable bonus remains economically neutral.',
        'Partial withdrawals or withdrawals of reinvested dividends in the preceding 12 months suspend loyalty-bonus eligibility, but the published rate for this corridor is zero.',
      ],
      sourceRefs: [page5],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Manulife InvestReady (III)', 16))
  const page2 = sourceRef(2, 'MIP and flexi start table', snippetNear(document, 2, 'Flexi start date', 18))
  const page6 = sourceRef(6, 'COI and administrative charge', snippetNear(document, 6, 'Cost of Insurance', 22))
  const page8 = sourceRef(8, 'Withdrawal and premium shortfall charge tables', snippetNear(document, 8, 'Partial Withdrawal Charge', 28))
  const page9 = sourceRef(9, 'Top-up premium and flexi options', snippetNear(document, 9, 'Top-up premium', 24))
  const page10 = sourceRef(10, 'Partial withdrawal rules', snippetNear(document, 10, 'Partial Withdrawal', 22))
  const page12 = sourceRef(12, 'Distribution of dividends', snippetNear(document, 12, 'Distribution of Dividends', 20))
  const page19 = sourceRef(19, 'Appendix A annual COI table', snippetNear(document, 19, 'Annual Cost of Insurance', 22))

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
        'Models the published 101% paid-premium floor net-amount-at-risk formula for death and terminal illness benefit.',
      ],
      sourceRefs: [page6, page19],
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
        'Models the published prevailing 0% top-up charge for the 5 Years Flexi 4 corridor.',
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
      rateSchedule: PREMIUM_SHORTFALL_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'pro-rata-by-value',
      notes: [
        'Models the published monthly premium shortfall charge before the Flexi Start date for the 5 Years Flexi 4 corridor.',
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page2, page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(WITHDRAWAL_AND_SURRENDER_CHARGE_SCHEDULE),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published MIP partial-withdrawal charge schedule for the 5 Years Flexi 4 corridor.',
        'Partial-withdrawal amount limits and minimum residual-account-value conditions remain informational only in V1.',
      ],
      sourceRefs: [page8, page10],
    },
  ]

  return {
    id: 'sgd-mip-5-flexi-4',
    currency: 'SGD',
    mipLength: 5,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page9],
      },
    ],
    bonuses: buildBonuses(document),
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
      sourceRefs: [page12],
    },
    eecTable: [...WITHDRAWAL_AND_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'Manulife InvestReady (III) is cataloged as a supported V1 corridor. The parser captures the 5 Years Flexi 4 administration-charge path, the 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the published 1% / 2% welcome-bonus tiers, the annual-premium bonus gate when the seed uses annual premium frequency, the corridor’s 0.0% loyalty-bonus rate after MIP, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, the MIP partial-withdrawal charge schedule, the MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface.',
      'Flexi-start premium variation, annual-mode clawback on later payment-mode changes, partial-withdrawal amount limits, dividend threshold behavior, and fund-level management charges remain informational only.',
      'Dividend-paying funds seed reinvestment by default in V1. Cash payout requires a manual annual distribution-yield assumption and the published $40 minimum payout threshold remains informational only.',
    ],
    unsupportedItems: [
      'Changing the regular premium payment mode from annual to a non-annual mode during the premium-shortfall-charge period remains informational only.',
      'Top-up underwriting remains informational only.',
      'The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.',
      'Death / terminal-illness payout handling remains informational only beyond the modeled COI deduction.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
      'Regular premium variation from Flexi Start onwards remains informational only.',
      'Partial-withdrawal amount limits, minimum withdrawal amount, and minimum residual-account-value rules remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
    ],
    sourceRefs: [page1, page2, page6, page8, page9, page10, page12, page19],
  }
}

export function parseManulifeInvestreadyIii(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-iii',
    insurer: 'Manulife Singapore',
    productName: 'Manulife InvestReady (III)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:manulife-investready-iii-welcome-bonus',
      'branch:manulife-investready-iii-annual-premium-bonus',
      'branch:manulife-investready-iii-loyalty-bonus',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'branch:manulife-investready-iii-partial-withdrawal-charge',
      'branch:manulife-investready-iii-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulife-investready-iii-top-up-underwriting',
      'manulife-investready-iii-dividend-payout-threshold',
      'manulife-investready-iii-reinvested-dividend-withdrawals',
      'manulife-investready-iii-benefit-payout-handling',
      'manulife-investready-iii-reinstatement',
      'manulife-investready-iii-flexi-start-premium-variation',
      'manulife-investready-iii-fund-management-charge',
    ],
    warnings: [
      'Manulife InvestReady (III) is cataloged as a supported V1 corridor. The parser captures the published 2.50% / 1.00% administration-charge path, the 101% paid-premium-floor COI formula after you enter insured-life details and current premium bases, the published 1% / 2% welcome-bonus tiers, the annual-premium bonus gate under the annual premium-frequency assumption, the corridor’s 0.0% loyalty-bonus rate after MIP, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, the MIP partial-withdrawal charge schedule, the MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface, while annual-mode clawback on later payment-mode changes, flexi-start premium variation, benefit payouts, and fund-level charges remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
