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
  lineWindow = 10,
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
  const page1 = sourceRef(1, 'Plan overview and payout election', snippetNear(document, 1, 'Secure Monthly Income', 16))
  const page2 = sourceRef(2, 'Secure Monthly Income mechanics', snippetNear(document, 2, 'Secure Monthly Income', 18))
  const page3 = sourceRef(3, 'Premium and top-up allocation', snippetNear(document, 3, '100% of Single Premium less Premium Charge', 16))
  const page4 = sourceRef(4, 'Charges and premium charge', snippetNear(document, 4, 'Premium Charge', 20))
  const page5 = sourceRef(5, 'Top-up premium charge and charge notes', snippetNear(document, 5, 'Top-Up Premium', 18))
  const page6 = sourceRef(6, 'Partial withdrawals and surrender', snippetNear(document, 6, 'Partial Withdrawals', 18))
  const page7 = sourceRef(7, 'Reinstatement and payout continuation', snippetNear(document, 7, 'Reinstatement', 18))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge deducted from each ad hoc top-up before top-up units are purchased.',
      ],
      sourceRefs: [page3, page5],
    },
  ]

  return {
    id: 'sgd-open-ended-sp',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3],
      },
    ],
    bonuses: [],
    feeRules: [],
    eventChargeRules,
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
      notes: [
        'Secure Monthly Income is paid by redeeming policy units after the selected payout start and for the selected payout period.',
      ],
      sourceRefs: [page1, page2, page7],
    },
    eecTable: [],
    warnings: [
      'AIA Elite Secure Income - Single Premium is cataloged as a partial modeled subset in V1. The parser captures the published 3% top-up premium charge and scheduled payout capability through the payout-state kernel, while the initial single-premium charge and payout amount remain manual or informational inputs.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Secure Monthly Income amount, payout age, and payout period selection remain manual-assumption inputs in V1.',
      'The published 5% charge on the initial single premium remains informational only until V1 supports explicit single-premium seeding.',
      'Single-premium principal tracking remains informational only in V1.',
      'Supplementary charge deductions remain informational only.',
      'Full-surrender and partial-withdrawal charge schedules remain informational only.',
      'Death, accidental-death, and terminal-illness benefit formulas remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Reinstatement effects on payout continuity remain informational only.',
      'Fund switching is not allowed and remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7],
  }
}

export function parseAiaEliteSecureIncomeSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-elite-secure-income-single-premium',
    insurer: 'AIA Singapore',
    productName: 'AIA Elite Secure Income - Single Premium',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:aia-elite-secure-income-sp-top-up-premium-charge',
      'kernel:scheduled-payout-manual-assumption',
    ],
    metadataOnlyBehaviors: [
      'aia-elite-secure-income-sp-secure-monthly-income-election',
      'aia-elite-secure-income-sp-single-premium-charge',
      'aia-elite-secure-income-sp-single-premium-principal-tracking',
      'aia-elite-secure-income-sp-supplementary-charge',
      'aia-elite-secure-income-sp-full-surrender-charge',
      'aia-elite-secure-income-sp-partial-withdrawal-charge',
      'aia-elite-secure-income-sp-death-benefit',
      'aia-elite-secure-income-sp-accidental-death-benefit',
      'aia-elite-secure-income-sp-terminal-illness-benefit',
      'aia-elite-secure-income-sp-fund-management-charge',
      'aia-elite-secure-income-sp-reinstatement',
      'aia-elite-secure-income-sp-no-fund-switching',
    ],
    warnings: [
      'AIA Elite Secure Income - Single Premium is cataloged as a partial modeled subset in V1. The parser captures the published 3% top-up premium charge and scheduled payout capability through the payout-state kernel, while the initial single-premium charge, payout selection, single-premium principal tracking, protection benefits, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
