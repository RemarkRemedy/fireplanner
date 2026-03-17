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

const MIP_LENGTH = 5
const WITHDRAWAL_AND_SURRENDER_CHARGE = [0.17, 0.14, 0.11, 0.07, 0.04] as const

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
  const page1 = sourceRef(1, 'Plan overview and single premium structure', snippetNear(document, 1, 'Prestige Legacy Advantage is a single premium whole of life investment-linked plan', 20))
  const page3 = sourceRef(3, 'Partial withdrawal, free withdrawal facility, and surrender mechanics', snippetNear(document, 3, 'Partial withdrawal & free partial withdrawal facility', 24))
  const page4 = sourceRef(4, 'Policy fee and premium charge', snippetNear(document, 4, 'Policy fee', 24))
  const page5 = sourceRef(5, 'Partial withdrawal charge, surrender charge, and insurance charge', snippetNear(document, 5, 'Partial Withdrawal Charge', 24))
  const page17 = sourceRef(17, 'Appendix standard-life insurance rates', snippetNear(document, 17, 'Standard Life - Non-Guaranteed Monthly Insurance Charge Rates', 20))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'initial-single-premium',
      rate: 0.05,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 5% premium charge deducted from the initial single premium at policy issue.',
      ],
      sourceRefs: [page1, page4],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'during-mip',
      notes: [
        'Enter the actual annual policy-fee amount derived from the published entry-age and basic-sum-assured table before trusting the projection.',
        'The published schedule applies only during the first five policy years and is based on the basic sum assured at policy commencement.',
      ],
      sourceRefs: [page4],
    },
    {
      id: 'insurance-charge',
      label: 'Insurance Charge',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      requiresManualInput: true,
      assuranceConfig: {
        formula: 'great-eastern-pla-death-ti',
        monthlyModalFactor: 1,
        maxAgeNextBirthday: 122,
      },
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published Standard Life monthly insurance-charge appendix on net sum assured.',
        'Enter the current sum assured before trusting the projection; current-sum-assured tracking after future top-ups, withdrawals, and free-withdrawal limits remains informational only.',
        'Non-standard underwriting classes and region-specific insurance-charge rates remain informational only.',
      ],
      sourceRefs: [page5, page17],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'single-premium-top-up-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge deducted from each accepted single-premium top-up.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(WITHDRAWAL_AND_SURRENDER_CHARGE),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published policy-year partial withdrawal charge schedule during the first five policy years.',
        'The free 5% annual partial-withdrawal allowance from policy year 11 onward remains informational only in V1.',
      ],
      sourceRefs: [page3, page5],
    },
  ]

  return {
    id: 'sgd-mip-5-single-premium',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page4],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...WITHDRAWAL_AND_SURRENDER_CHARGE],
    warnings: [
      'Prestige Legacy Advantage is cataloged as a supported Standard Life single-premium corridor in V1. The parser captures the initial single-premium charge, the first-five-policy-year withdrawal / surrender charge schedule, the entry-age-and-basic-sum-assured policy-fee surface through manual input, and the Standard Life monthly insurance-charge appendix on net sum assured.',
      'Enter the actual first-five-year policy-fee amount and current sum assured before trusting the projection.',
    ],
    unsupportedItems: [
      'Single-premium principal tracking remains informational only in V1.',
      'Current-sum-assured tracking after future top-ups, partial withdrawals, and the free partial withdrawal annual limit from policy year 11 onward remains informational only.',
      'Death and terminal illness benefit reductions remain informational only beyond the manual current-sum-assured corridor.',
      'Non-lapse privilege debt carry and lapse/reinstatement behavior remain informational only.',
      'Non-standard underwriting classes and region-specific insurance-charge rates remain informational only.',
      'Fund-level management and custodian fees remain informational only.',
      'Sum assured reductions and fund switching remain informational only.',
    ],
    sourceRefs: [page1, page3, page4, page5, page17],
  }
}

export function parseGreatEasternPrestigeLegacyAdvantage({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-prestige-legacy-advantage',
    insurer: 'Great Eastern',
    productName: 'Prestige Legacy Advantage',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:great-eastern-pla-single-premium-charge',
      'branch:great-eastern-pla-top-up-premium-charge',
      'branch:great-eastern-pla-policy-fee-manual-input',
      'branch:great-eastern-pla-standard-life-insurance-charge',
      'branch:great-eastern-pla-withdrawal-charge',
      'branch:great-eastern-pla-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'great-eastern-pla-single-premium-principal-tracking',
      'great-eastern-pla-current-sum-assured-tracking',
      'great-eastern-pla-death-and-terminal-illness-benefits',
      'great-eastern-pla-non-lapse-privilege',
      'great-eastern-pla-free-partial-withdrawal-annual-limit',
      'great-eastern-pla-non-standard-insurance-rate-classes',
      'great-eastern-pla-fund-level-fees',
      'great-eastern-pla-sum-assured-reduction',
      'great-eastern-pla-fund-switching',
    ],
    warnings: [
      'Prestige Legacy Advantage is cataloged as a supported Standard Life single-premium corridor in V1. The parser captures the initial single-premium charge, single-premium top-up charge, the first-five-policy-year withdrawal / surrender charge schedule, the entry-age-and-basic-sum-assured policy-fee surface through manual input, and the Standard Life monthly insurance-charge appendix on net sum assured, while non-lapse privilege, free-withdrawal-limit current-sum-assured adjustments, and non-standard insurance-rate classes remain metadata-only.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
