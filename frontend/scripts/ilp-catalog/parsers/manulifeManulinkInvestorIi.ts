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

type FundingMode = 'cash' | 'srs'

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument, fundingMode: FundingMode): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Manulink Investor (II) is a single premium investment-linked policy', 12))
  const page2 = sourceRef(2, 'Premium charge and top-ups', snippetNear(document, 2, 'Premium charge', 18))
  const page2Recurring = sourceRef(2, 'Recurring single premium option', snippetNear(document, 2, 'Recurring Single Premium Option', 16))
  const page3 = sourceRef(3, 'Withdrawals, switching, and dividends', snippetNear(document, 3, 'Partial Withdrawal', 18))
  const page5 = sourceRef(5, 'Ending the policy', snippetNear(document, 5, 'Ending the policy', 14))
  const isSrs = fundingMode === 'srs'

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: isSrs ? 'Single Premium Charge (SRS)' : 'Single Premium Charge (Cash)',
      basis: 'annual-contribution',
      rate: 0.03,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        isSrs
          ? 'Models the published 3% charge on the initial single premium for the SRS-funded corridor.'
          : 'Models the published 3% charge on the initial single premium for the cash-funded corridor.',
      ],
      sourceRefs: [page2],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: isSrs ? 'Top-up Premium Charge (SRS)' : 'Top-up Premium Charge (Cash)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        isSrs
          ? 'Models the published 3% charge on each top-up premium for the SRS-funded corridor.'
          : 'Models the published 3% charge on each top-up premium for the cash-funded corridor.',
      ],
      sourceRefs: [page2],
    },
  ]

  if (isSrs) {
    eventChargeRules.push({
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge (SRS)',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% charge on each recurring single premium paid under the SRS-only RSP option.',
        'Use recurring-single-premium events to represent the standing SRS instruction and its chosen cadence.',
      ],
      sourceRefs: [page2, page2Recurring],
    })
  }

  return {
    id: isSrs ? 'sgd-open-ended-srs' : 'sgd-open-ended-cash',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2],
      },
    ],
    bonuses: [],
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
      notes: isSrs
        ? [
            'SRS-funded policies default dividend distributions to reinvestment, while payout elections remain available subject to the published fund-level rules.',
            'V1 seeds reinvestment by default; payout elections use a manual annual distribution-yield assumption and do not distinguish SRS-account crediting from direct cash settlement.',
            'Payouts below the published $40 minimum remain reinvested.',
          ]
        : [
            'Cash-funded policies may reinvest fund dividends or receive them as payouts subject to the published fund-level rules.',
            'V1 seeds reinvestment by default; payout elections use a manual annual distribution-yield assumption, and payouts below the published $40 minimum remain reinvested.',
          ],
      sourceRefs: [page3],
    },
    eecTable: [],
    warnings: [
      isSrs
        ? 'Manulink Investor (II) (SRS) is cataloged as a supported V1 product. The parser captures the published 3% single-premium, top-up, and SRS recurring-single-premium charge path plus reinvest-default distribution support through the open-ended no-MIP basis.'
        : 'Manulink Investor (II) (Cash) is cataloged as a supported V1 product. The parser captures the published 3% single-premium and top-up charge path plus reinvest-default distribution support through the open-ended no-MIP basis.',
      'CPF funding availability and CPF dividend-crediting behavior remain metadata-only because the product summary does not publish an explicit CPF premium-charge rate in the modeled corridor.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'The current terminal-illness benefit estimate and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap input because the product summary publishes a S$1 million TI limit and a cross-policy TI/CI limit that are not reconstructed from claims history in V1.',
      'Terminal-illness claim admission / exclusions / settlement, suicide exclusion handling, and claim-notification timing remain informational only beyond the modeled current death, terminal-illness, and residual-after-TI estimates.',
      'Partial-withdrawal and full-surrender administration remain informational only.',
      'Fund-level management fees remain informational only because they vary by chosen ILP sub-fund and are published in the fund summaries.',
      'Fund-switching remains informational only.',
      'CPF routing and payout-destination operations remain informational only.',
      'Lapsing and termination behavior remains informational only.',
    ],
    sourceRefs: [page1, page2, page2Recurring, page3, page5],
  }
}

export function parseManulifeManulinkInvestorIi(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-manulink-investor-ii',
    insurer: 'Manulife Singapore',
    productName: 'Manulink Investor (II)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:manulink-investor-ii-single-premium-charge',
      'branch:manulink-investor-ii-top-up-premium-charge',
      'branch:manulink-investor-ii-srs-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulink-investor-ii-cpf-funding-route',
      'manulink-investor-ii-cpf-dividend-crediting',
      'manulink-investor-ii-partial-withdrawal',
      'manulink-investor-ii-full-surrender',
      'manulink-investor-ii-fund-management-fee',
      'manulink-investor-ii-fund-switching',
      'manulink-investor-ii-lapse-and-termination',
    ],
    warnings: [
      'Manulink Investor (II) is cataloged as a supported V1 product. The parser captures separate cash and SRS corridors for the published 3% single-premium and top-up charges, the SRS recurring-single-premium charge path, the current-state death benefit as the higher of account value or 1% of single premium, top-up premium, and recurring single premium paid less withdrawals, the current terminal-illness benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TI cap subject to the published S$1 million TI limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, and reinvest-default distribution support through the open-ended no-MIP basis, while terminal-illness claim handling, CPF funding, and fund-level charges remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'cash'),
      buildVariant(context.document, 'srs'),
    ],
  }
}
