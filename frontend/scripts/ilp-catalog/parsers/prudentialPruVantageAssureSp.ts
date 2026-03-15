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
      rate: 0,
      rateSchedule: buildRateSchedule(WITHDRAWAL_AND_SURRENDER_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies to Initial Investment Account withdrawals only during the first 8 policy years.',
        'There is no withdrawal charge on the Additional Investment Account.',
        'The first Initial Investment Account withdrawal free up to 10% of original single premium is not modeled automatically in V1.',
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
    bonuses: [],
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
      'This single-premium product currently models administration charges, Appendix A combined assurance charges, top-up premium charges, Initial Investment Account withdrawal charges, Initial Investment Account surrender charges, and reinvest-default distribution support.',
      'The enhanced single-premium allocation tiers, the recurring 8-year Loyalty Bonus, and the first Initial Investment Account withdrawal free up to 10% of original single premium remain informational only in V1.',
      'Enter insured-life details and use the current net regular premium base field as the current net single-premium base to activate the modeled assurance charge path.',
      'The current ILP engine does not yet track original single-premium principal separately from recurring-premium inputs, so premiums-paid and opportunity-cost outputs should be treated as partial for this product.',
    ],
    unsupportedItems: [
      `Enhanced single-premium allocation tiers (${SINGLE_PREMIUM_ALLOCATION_TIERS.map((tier) => `${tier.allocationRate * 100}%`).join(' / ')}) remain informational only.`,
      'Loyalty Bonus paid every block of 8 completed policy years remains informational only.',
      'First Initial Investment Account withdrawal free up to 10% of original single premium remains informational only.',
      'Change of life assured and sum assured / Wealth Assure Value reduction-resumption options remain informational only.',
      'The published dividend payout election remains informational only insofar as the policy-specific payout yield remains a manual assumption in V1.',
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
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:assure-sp-administration-charge',
      'branch:assure-sp-combined-assurance',
      'branch:assure-sp-top-up-charge',
      'branch:assure-sp-charged-withdrawal',
      'branch:assure-sp-iia-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'pruvantage-assure-sp-single-premium-allocation-enhancement',
      'pruvantage-assure-sp-loyalty-bonus-every-8-years',
      'pruvantage-assure-sp-first-withdrawal-free-up-to-10pct-single-premium',
      'pruvantage-assure-sp-single-premium-principal-tracking',
      'pruvantage-assure-sp-change-of-life-assured',
      'pruvantage-assure-sp-sum-assured-wealth-assure-reduction-resumption',
      'pruvantage-assure-sp-dividend-payout-yield-assumption',
    ],
    warnings: [
      'PRUVantage Assure (SP) is cataloged as a partial modeled subset in V1. The parser captures the two-account structure, administration charge, combined Appendix A assurance charge, top-up premium charge, Initial Investment Account withdrawal / surrender charge schedules, and reinvest-default distribution support, but the enhanced single-premium allocation, recurring 8-year loyalty bonus, first-withdrawal free cap, and single-premium principal tracking remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
