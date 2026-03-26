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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page3 = sourceRef(3, 'Benefits', snippetNear(document, 3, 'Death Benefit', 18))
  const page5 = sourceRef(5, 'Fees and charges', snippetNear(document, 5, 'Redemption Fee', 22))
  const page6 = sourceRef(6, 'Subscription and premium types', snippetNear(document, 6, 'Premium (single, recurring and top-up)', 22))
  const page8 = sourceRef(8, 'Redemption of units', snippetNear(document, 8, 'Minimum Partial Redemption Amount', 18))
  const page11 = sourceRef(11, 'Switching of units', snippetNear(document, 11, 'SWITCHING OF UNITS', 20))
  const page14 = sourceRef(14, 'Key policy provisions', snippetNear(document, 14, 'Free-look Period', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge (CPF)',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 100% allocation of the initial single premium into units with no policy-level premium deduction.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge (CPF)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 100% allocation of approved top-up premiums into units with no policy-level top-up deduction.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge (CPF)',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 100% allocation of approved recurring single premiums into units with no policy-level deduction.',
        'Use recurring-single-premium events to represent the approved annual, half-yearly, or quarterly cadence.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the currently nil redemption-fee path for partial redemptions.',
      ],
      sourceRefs: [page5, page8],
    },
  ]

  return {
    id: 'sgd-open-ended-cpf',
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
        sourceRefs: [page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    },
    eecTable: [],
    warnings: [
      'HSBC Life Wealth Invest (CPF) is cataloged as a supported V1 product. The parser captures the published zero-charge single-premium, recurring-single-premium, approved top-up, nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions for the CPF corridor through the open-ended no-MIP basis.',
      'Switching fees are currently nil, but switching behavior and CPF eligibility constraints remain outside the current calculator surface.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'The current terminal-illness benefit amount is modeled as the same higher-of policy value or 101%-of-paid-premiums corridor after current amounts owing, and the current admitted-state TI payable amount is supported through the published termination corridor after manual claim-amount entry, but claim exclusions and insurer-side payout mechanics remain informational only.',
      'Recurring single premium enrollment approval, allocation-change requests, and failed-deduction handling remain informational only.',
      'Fund-level management charges and additional ILP-sub-fund charges remain informational only because they depend on the selected fund mix and are not a single product-level rate.',
      'Switching administration and CPF fund-eligibility constraints remain informational only.',
      'Termination and free-look refund behavior remain informational only.',
    ],
    sourceRefs: [page3, page5, page6, page8, page11, page14],
  }
}

export function parseHsbcWealthInvestCpf(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-wealth-invest-cpf',
    insurer: 'HSBC Life',
    productName: 'HSBC Life Wealth Invest (CPF)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:hsbc-life-wealth-invest-cpf-zero-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-top-up-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-redemption-fee',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'tokio-recurring-single-premium-routing',
    ],
    coveredElsewhereBehaviors: [
      'hsbc-life-wealth-invest-cpf-fund-management-charge',
      'hsbc-life-wealth-invest-cpf-additional-ilp-sub-fund-charges',
    ],
    metadataOnlyBehaviors: [
      'hsbc-life-wealth-invest-cpf-switching-eligibility-constraints',
      'hsbc-life-wealth-invest-cpf-free-look-refund',
      'hsbc-life-wealth-invest-cpf-termination',
    ],
    warnings: [
      'HSBC Life Wealth Invest (CPF) is cataloged as a supported V1 product. The parser captures the published zero-charge single-premium, recurring-single-premium, approved top-up, nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions for the CPF corridor through the open-ended no-MIP basis, the current-state death and terminal-illness benefit amount as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals and current amounts owing, and the current admitted-state TI payable amount through the published automatic-termination TI corridor after manual claim-amount entry, while terminal-illness claim exceptions, switching constraints, free-look behavior, and fund-level charges remain informational only beyond the modeled current ordinary death-benefit and terminal-illness estimates.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
