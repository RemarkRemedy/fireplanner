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

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'ManuInvest Duo is a regular-premium investment-linked plan', 20))
  const page5 = sourceRef(5, 'COI and administrative charge', snippetNear(document, 5, 'Cost of Insurance', 26))
  const page7 = sourceRef(7, 'Premium shortfall charge and management charge', snippetNear(document, 7, 'Premium Shortfall Charge', 26))
  const page8 = sourceRef(8, 'Top-up premium option', snippetNear(document, 8, 'Top-up Premium', 18))
  const page9 = sourceRef(9, 'Premium Flexibility Benefit and withdrawals', snippetNear(document, 9, 'Premium Flexibility Benefit', 24))

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
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipLength: 10,
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
        sourceRefs: [page1, page5, page8],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      'ManuInvest Duo is cataloged as a partial modeled subset in V1. The parser captures the 10-year MIP corridor: the published 5.00% / 1.00% administration-charge path, the protected-base cost-of-insurance formula after you enter insured-life details and current sum insured, and the prevailing 0% top-up charge.',
      'Premium shortfall charging remains metadata-only because Premium Flexibility Benefit waives the published shortfall charge up to a cumulative missed-premium limit that the current event kernel does not yet track.',
      'Welcome Bonus, Loyalty Bonus, surrender / partial-withdrawal charges, and fund-level management charges remain outside the current engine.',
    ],
    unsupportedItems: [
      'Death, terminal-illness, and TPD benefit payout handling remain informational only beyond the modeled cost-of-insurance deduction.',
      'Welcome Bonus and Loyalty Bonus remain informational only.',
      'Premium shortfall charge and Premium Flexibility Benefit remain informational only because they depend on a cumulative missed-premium allowance ledger.',
      'Full-surrender and partial-withdrawal charge schedules remain informational only, including the S$50 withdrawal-floor rule and withdrawal-flexibility threshold.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund-switching, premium redirection, automatic rebalancing, and payment-mode changes remain informational only.',
      'Change-of-sum-insured and change-of-life-insured options remain informational only.',
    ],
    sourceRefs: [page1, page5, page7, page8, page9],
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
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:manuinvest-duo-administrative-charge',
      'branch:manuinvest-duo-zero-top-up-charge',
    ],
    metadataOnlyBehaviors: [
      'manuinvest-duo-welcome-bonus',
      'manuinvest-duo-loyalty-bonus',
      'manuinvest-duo-premium-shortfall-charge',
      'manuinvest-duo-premium-flexibility-benefit',
      'manuinvest-duo-partial-withdrawal-charge',
      'manuinvest-duo-surrender-charge',
      'manuinvest-duo-benefit-payout-handling',
      'manuinvest-duo-fund-management-charge',
      'manuinvest-duo-fund-switching-and-redirection',
      'manuinvest-duo-sum-insured-change',
      'manuinvest-duo-life-insured-change',
    ],
    warnings: [
      'ManuInvest Duo is cataloged as a partial modeled subset in V1. The parser captures the published 10-year MIP administration-charge path, the protected-base death / TI / TPD cost-of-insurance formula after you enter insured-life details and current sum insured, and the prevailing 0% top-up charge, while bonus mechanics, premium-flexibility shortfall behavior, withdrawal / surrender charges, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
