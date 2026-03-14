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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 12): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument, variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs'): IlpTemplateVariant {
  const isCash = variantId === 'sgd-open-ended-cash'
  const page1 = sourceRef(1, 'Plan description and benefits', snippetNear(document, 1, '#goElite', 20))
  const page3 = sourceRef(3, 'Recurring single premium, top-up premium, and partial withdrawal', snippetNear(document, 3, 'Recurring Single Premium', 28))
  const page5 = sourceRef(5, 'Dividend distribution', snippetNear(document, 5, 'Dividend Distribution', 28))
  const page6 = sourceRef(6, 'Fees and charges', snippetNear(document, 6, 'Administrative Charge', 28))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 100% allocation of the initial single premium into the Single Premium Units Account with no policy-level premium deduction.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: 0.01,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 1.00% p.a. administrative charge on the Single Premium Units Account value.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each recurring single premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page3, page6],
    },
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each top-up premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page3, page6],
    },
  ]

  return {
    id: variantId,
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Single Premium Units Account',
        feeRate: 0.01,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page6],
      },
      {
        id: 'topup',
        label: 'Top-up Units Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: isCash,
      cashPayoutAllowedAfterMip: isCash,
      source: 'distribution-paying-funds',
      notes: isCash
        ? [
            'Cash policies may reinvest dividends or receive cash payouts from dividend-paying ILP sub-funds, subject to the published minimum payout amount.',
            'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
          ]
        : [
            'SRS policies default dividend distributions to reinvestment, and the source summary does not offer a cash-payout election for this corridor.',
          ],
      sourceRefs: [page5],
    },
    eecTable: [],
    warnings: [
      isCash
        ? '#goElite (Cash) is cataloged as a partial modeled subset in V1. The parser captures the published zero single-premium charge, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, and the reinvest-default distribution-mode assumption surface through the open-ended single-premium basis.'
        : '#goElite (SRS) is cataloged as a partial modeled subset in V1. The parser captures the published zero single-premium charge, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, and the reinvest-only distribution-mode surface through the open-ended single-premium basis.',
      'The published $50 minimum dividend-payout threshold remains informational only.',
      'Recurring single premium and top-up availability only after one policy year remains informational only.',
    ],
    unsupportedItems: [
      'The 1.4% p.a. establishment charge on initial single premium for the first five policy years remains informational only because the current engine does not author recurring charges against the original single-premium base.',
      'The first-five-policy-years surrender charge remains informational only because it is calculated from the initial single premium rather than the current account value.',
      'Death and accidental-death benefit formulas remain informational only.',
      'Fund management fee and third-party banking / currency-conversion charges remain informational only.',
    ],
    sourceRefs: [page1, page3, page5, page6],
  }
}

export function parseTokioMarineGoElite(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goelite',
    insurer: 'Tokio Marine',
    productName: '#goElite',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:tokio-marine-goelite-zero-single-premium-charge',
      'branch:tokio-marine-goelite-administrative-charge',
      'branch:tokio-marine-goelite-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goelite-zero-partial-withdrawal-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-marine-goelite-establishment-charge',
      'tokio-marine-goelite-surrender-charge',
      'tokio-marine-goelite-protection-benefits',
      'tokio-marine-goelite-rsp-and-top-up-eligibility-gating',
      'tokio-marine-goelite-fund-level-and-third-party-charges',
      'tokio-marine-goelite-dividend-payout-threshold',
    ],
    warnings: [
      '#goElite is cataloged as a partial modeled subset in V1. The parser captures the published zero single-premium charge, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, and the cash-vs-SRS distribution-mode support surface, while the initial-premium-based establishment charge, surrender charge, and protection benefits remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'sgd-open-ended-cash'),
      buildVariant(context.document, 'sgd-open-ended-srs'),
    ],
  }
}
