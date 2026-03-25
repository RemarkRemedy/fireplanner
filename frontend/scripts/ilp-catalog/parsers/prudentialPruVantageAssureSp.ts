import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpTemplateBonus,
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

const MIP_LENGTH = 8
const SINGLE_PREMIUM_ALLOCATION_TIERS = [
  { minSinglePremium: 50_000, maxSinglePremium: 149_999.99, allocationRate: 1 },
  { minSinglePremium: 150_000, maxSinglePremium: 399_999.99, allocationRate: 1.005 },
  { minSinglePremium: 400_000, maxSinglePremium: null, allocationRate: 1.01 },
] as const
const WITHDRAWAL_AND_SURRENDER_SCHEDULE = [0.12, 0.105, 0.09, 0.075, 0.06, 0.045, 0.03, 0.015]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
}

function formatPercent(value: number): string {
  const percentage = value * 100
  return Number.isInteger(percentage) ? `${percentage}%` : `${percentage.toFixed(1)}%`
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 6): string {
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

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page3 = sourceRef(3, 'Accounts and Death Benefit', snippetNear(document, 3, 'Initial Investment Account'))
  const page7 = sourceRef(7, 'Premium Size and Loyalty Bonus', snippetNear(document, 7, 'Premium Size'))
  const page7Dividend = sourceRef(7, 'Dividend payout election', snippetNear(document, 7, 'distribution of dividends'))
  const page8 = sourceRef(8, 'Charges', snippetNear(document, 8, 'Administration Charge'))
  const page12 = sourceRef(12, 'Partial Withdrawal Charge', snippetNear(document, 12, 'Partial Withdrawal Charge Table'))
  const page13 = sourceRef(13, 'Surrender Charge', snippetNear(document, 13, 'Surrender Charge Table'))
  const page16 = sourceRef(16, 'Change of Life Assured and Wealth Assure adjustments', snippetNear(document, 16, 'Change of Life Assured'))
  const page17 = sourceRef(17, 'Reduce Sum Assured/Wealth Assure Value', snippetNear(document, 17, 'Reduce Sum Assured/Wealth Assure Value'))
  const page18 = sourceRef(18, 'Top-up premium with the Investment Booster (Lump Sum)', snippetNear(document, 18, 'Investment Booster (Lump Sum)'))
  const page22 = sourceRef(22, 'Appendix A assurance charges', snippetNear(document, 22, 'Appendix A – Assurance Charges'))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'administration-charge',
      label: 'Administration Charge',
      basis: 'account-value',
      rate: roundRate(0.008),
      amount: null,
      appliesTo: ['iia'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: MIP_LENGTH,
      notes: [
        'Modeled as a monthly 0.8% p.a. administration charge on the Initial Investment Account only for the first 8 policy years.',
        'There are no administration charges on the Additional Investment Account.',
      ],
      sourceRefs: [page8],
    },
    {
      id: 'assurance-charge-combined',
      label: 'Assurance Charge (Appendix A total charge curve)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: 0,
      assuranceConfig: {
        formula: 'prudential-assure-ii-combined',
        monthlyModalFactor: 0.0834,
      },
      requiresManualInput: true,
      appliesTo: ['iia'],
      fallbackAppliesTo: ['aia'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Modeled from Prudential Appendix A as the published total charge curve for death and accidental disability benefits.',
        'Enter the insured-life details and use the current net single-premium base in the current net regular premium base field to activate the modeled assurance charge path.',
        'Charges the Initial Investment Account first and falls back to the Additional Investment Account when the Initial Investment Account is exhausted.',
      ],
      sourceRefs: [page8, page22],
    },
  ]

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'single-premium-allocation-enhancement',
      type: 'sign-up',
      label: 'Single Premium Allocation Enhancement',
      mode: 'premium-allocation',
      annualPremiumTierBasis: 'initial-single-premium-at-issue',
      appliesTo: ['iia'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: 0,
      amount: null,
      tieredRates: SINGLE_PREMIUM_ALLOCATION_TIERS.map((tier) => ({
        currency: 'SGD',
        minAnnualPremium: tier.minSinglePremium,
        maxAnnualPremium: tier.maxSinglePremium,
        rate: roundRate(Math.max(0, tier.allocationRate - 1)),
      })),
      notes: [
        'Models the published initial single-premium allocation enhancement tiers for the SGD corridor.',
        'The enhancement is credited only on the original initial single premium and therefore uses the original single-premium input at issue in V1.',
      ],
      sourceRefs: [page7],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['iia'],
      startPolicyYear: 8,
      endPolicyYear: null,
      cadenceYears: 8,
      rate: 0.008,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published 0.8% loyalty bonus on the latest Initial Investment Account value after every block of eight completed policy years.',
        'Top-ups in the Additional Investment Account do not receive the Loyalty Bonus.',
      ],
      sourceRefs: [page7],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Investment Booster Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['aia'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies a 3% upfront premium charge on Investment Booster (Lump Sum) top-ups.',
        'The remaining top-up premium is credited to the Additional Investment Account.',
      ],
      sourceRefs: [page8, page18],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['iia'],
      freeEventCount: 1,
      freeEventMaxAmountRate: 0.1,
      freeEventMaxAmountBasis: 'initial-single-premium',
      rate: 0,
      rateSchedule: buildRateSchedule(WITHDRAWAL_AND_SURRENDER_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies to Initial Investment Account withdrawals only during the first 8 policy years.',
        'There is no withdrawal charge on the Additional Investment Account.',
        'The first Initial Investment Account withdrawal is charge-free up to 10% of the original single premium; any excess remains subject to the published withdrawal-charge table.',
      ],
      sourceRefs: [page12],
    },
  ]

  return {
    id: 'sgd-mip-8',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'iia',
        label: 'Initial Investment Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'iia', contributionShare: 1 },
        ],
        sourceRefs: [page3, page7],
      },
      {
        id: 'aia',
        label: 'Additional Investment Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'aia', contributionShare: 1 },
        ],
        sourceRefs: [page3, page18],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['iia', 'aia'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying PRULink funds default to reinvestment unless the policyholder elects dividend payout.',
        'Choosing dividend payout lowers the published Wealth Assure Value relative to reinvestment.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page7Dividend],
    },
    eecTable: [...WITHDRAWAL_AND_SURRENDER_SCHEDULE],
    warnings: [
      'This supported template models administration charges, Appendix A combined assurance charges, the recurring 8-year Loyalty Bonus on the Initial Investment Account, the current-state death-benefit estimate as the higher of current sum assured, current Wealth Assure Value, or Initial Investment Account value plus Additional Investment Account value after manual current amount owing, top-up premium charges, Initial Investment Account withdrawal / surrender charge schedules including the first-withdrawal 10%-of-original-single-premium free cap, and reinvest-default distribution support.',
      'The payable-now accidental-disability snapshot is modeled from the same current corridor once the current accidental-disability payout stage is filled.',
      'Enter insured-life details and use the current net regular premium base field as the current net single-premium base to activate the modeled assurance charge path.',
      'Enter current sum assured, current Wealth Assure Value, and current amount owing before trusting the current-state death-benefit estimate.',
    ],
    unsupportedItems: [
      'Change of life assured and sum assured / Wealth Assure Value reduction-resumption options remain informational only.',
      'The current-state death-benefit estimate needs a manual current amount owing input because outstanding debt is not reconstructed from history in V1.',
      'Accidental-disability deferment timing, staged later-balance release, disability-status revalidation, suicide and pre-existing-condition exclusions, and broader claim settlement mechanics remain informational only beyond the modeled payable-now accidental-disability snapshot.',
    ],
    sourceRefs: [page3, page7, page7Dividend, page8, page12, page13, page16, page17, page18, page22],
  }
}

export function parsePrudentialPruVantageAssureSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'prudential-pruvantage-assure-sp',
    insurer: 'Prudential',
    productName: 'PRUVantage Assure (SP)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:assure-sp-administration-charge',
      'branch:assure-sp-combined-assurance',
      'branch:assure-sp-single-premium-allocation-enhancement',
      'branch:assure-sp-loyalty-bonus',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-disability-benefit-estimate',
      'branch:assure-sp-top-up-charge',
      'branch:assure-sp-first-free-withdrawal',
      'branch:assure-sp-charged-withdrawal',
      'branch:assure-sp-iia-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'pruvantage-assure-sp-change-of-life-assured',
      'pruvantage-assure-sp-sum-assured-wealth-assure-reduction-resumption',
      'pruvantage-assure-sp-death-claim-exclusions',
    ],
    warnings: [
      'PRUVantage Assure (SP) is cataloged as a supported V1 product. The parser captures the two-account structure, administration charge, combined Appendix A assurance charge, the published single-premium allocation enhancement tiers on the original initial single premium, the recurring 8-year loyalty bonus on the Initial Investment Account, the current-state death-benefit estimate as the higher of current sum assured, current Wealth Assure Value, or Initial Investment Account value plus Additional Investment Account value after manual current amount owing, a payable-now accidental-disability snapshot from that same corridor once the current accidental-disability payout stage is filled, top-up premium charge, Initial Investment Account withdrawal / surrender charge schedules including the first-withdrawal free cap tied to original single premium, and reinvest-default distribution support, while later accidental-disability release timing and change-of-life-assured / reduction-resumption mechanics remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
