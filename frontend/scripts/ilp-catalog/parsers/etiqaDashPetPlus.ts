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

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Rider overview and benefits', snippetNear(document, 1, 'optional single Premium investment-linked insurance rider', 20))
  const page2 = sourceRef(2, 'Surrender and partial withdrawal options', snippetNear(document, 2, 'Partial Withdrawal', 20))
  const page3 = sourceRef(3, 'Yearly renewability and maturity', snippetNear(document, 3, 'Yearly Renewability', 18))
  const page4 = sourceRef(4, 'Premium allocation and rider account value', snippetNear(document, 4, '100% of the single Premium paid', 18))
  const page6 = sourceRef(6, 'Zero-charge subscription and redemption illustration', snippetNear(document, 6, 'There is no fees and charges incurred for the purchase', 18))
  const page7 = sourceRef(7, 'Management charge and fund management fee', snippetNear(document, 7, 'Management Charge', 18))
  const page7Dividend = sourceRef(7, 'Distribution of Dividend', snippetNear(document, 7, 'Distribution of Dividend', 18))
  const page8 = sourceRef(8, 'Top-up and fund switching', snippetNear(document, 8, 'Top-up (Ad-hoc / Recurring)', 20))
  const page9 = sourceRef(9, 'Free look and grace period', snippetNear(document, 9, 'Grace Period', 18))

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
        'The published subscription illustration states no fees and charges are incurred for the initial rider single premium purchase.',
      ],
      sourceRefs: [page4, page6],
    },
    {
      id: 'management-charge',
      label: 'Management Charge',
      basis: 'account-value',
      rate: 0.0075,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Deducted monthly from rider account value while the rider remains in force.',
      ],
      sourceRefs: [page7],
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
        'The published subscription illustration states no fees and charges are incurred for top-ups.',
      ],
      sourceRefs: [page6, page8],
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
        'The published redemption illustration states no fees and charges are incurred upon withdrawal of the portfolio fund.',
        'PayNow transfer fees remain informational only because they depend on the payout option rather than the rider ledger itself.',
      ],
      sourceRefs: [page2, page6],
    },
  ]

  return {
    id: 'sgd-open-ended-rider',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Rider Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page4, page8],
      },
    ],
    bonuses: [],
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
        'Portfolio-fund dividends default to reinvestment unless the policyholder elects payout.',
        'Dividend payout leaves the rider and is credited into the linked Basic policy, so V1 treats payout as a rider-side outflow and does not model the receiving Basic policy ledger.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page7Dividend],
    },
    eecTable: [],
    warnings: [
      'Dash PET Plus is cataloged as a supported V1 rider. The parser captures the zero-charge rider subscription, zero-charge top-up and withdrawal path, the 0.75% annual management charge through the open-ended rider basis, the current-state death benefit as the higher of rider account value or the 105%-of-paid-premiums floor after rider withdrawals and current amounts owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, and reinvest-default distribution support.',
      'This is a yearly renewable rider attached to a basic policy; rider renewability and basic-policy dependency remain informational only in V1.',
      'This open-ended rider product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because rider debt and cross-policy TI cap usage are not reconstructed from history in V1.',
      'The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published partial-TI continuation corridor after manual claim-amount and residual-death input, but claim exclusions and insurer-side settlement mechanics remain informational only.',
      'Yearly renewability, basic-policy attachment gating, and unilateral rider termination notice remain informational only.',
      'PayNow transfer charges remain informational only because they depend on payout method rather than the rider ledger.',
      'Fund-level management fees remain informational only because they depend on the selected ILP sub-fund.',
      'Dividend crediting into the linked Basic policy, automatic portfolio rebalancing, grace-period funding, and free-look handling remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page6, page7, page7Dividend, page8, page9],
  }
}

export function parseEtiqaDashPetPlus(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-dash-pet-plus',
    insurer: 'Etiqa',
    productName: 'Dash PET Plus',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:etiqa-dash-pet-plus-zero-single-premium-charge',
      'branch:etiqa-dash-pet-plus-management-charge',
      'branch:etiqa-dash-pet-plus-zero-top-up-charge',
      'branch:etiqa-dash-pet-plus-zero-partial-withdrawal-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'etiqa-dash-pet-plus-yearly-renewability',
      'etiqa-dash-pet-plus-basic-policy-dependency',
      'etiqa-dash-pet-plus-paynow-transfer-charge',
      'etiqa-dash-pet-plus-fund-management-fee',
      'etiqa-dash-pet-plus-dividend-crediting-to-basic-policy',
      'etiqa-dash-pet-plus-automatic-portfolio-rebalancing',
      'etiqa-dash-pet-plus-grace-period-top-up-funding',
      'etiqa-dash-pet-plus-free-look',
    ],
    warnings: [
      'Dash PET Plus is cataloged as a supported V1 rider. The parser captures the zero-charge rider subscription, zero-charge top-up and withdrawal path, the 0.75% annual management charge through the open-ended rider basis, reinvest-default distribution support, the current-state death benefit as the higher of rider account value or the 105%-of-paid-premiums floor after rider withdrawals and current amounts owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, while yearly renewability, basic-policy dependency, payout-method fees, Basic-policy crediting, and claim exclusions / insurer-side settlement mechanics remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
