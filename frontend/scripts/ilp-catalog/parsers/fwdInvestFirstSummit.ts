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

const MIP_LENGTH = 10
const INITIAL_ACCOUNT_CHARGE_RATE = 0.0395
const SURRENDER_CHARGE_SCHEDULE = [1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Summit', 24))
  const page4 = sourceRef(4, 'Regular premium and top-up overview', snippetNear(document, 4, 'Regular Premium', 26))
  const page5 = sourceRef(5, 'Initial account charge', snippetNear(document, 5, 'Initial account charge', 28))
  const page6 = sourceRef(6, 'Accumulation account charge and top-up premium charge', snippetNear(document, 6, 'Accumulation account charge', 28))
  const page7 = sourceRef(7, 'Premium shortfall charge', snippetNear(document, 7, 'Premium shortfall charge', 28))
  const page8 = sourceRef(8, 'Premium reduction charge and redemption fee', snippetNear(document, 8, 'Premium reduction charge', 30))
  const page9 = sourceRef(9, 'Withdrawal options and minimum account value', snippetNear(document, 9, 'Withdrawal options', 30))
  const page10 = sourceRef(10, 'Partial and regular withdrawal rules', snippetNear(document, 10, 'Partial withdrawal', 26))
  const page20 = sourceRef(20, 'Support benefit exclusions and policy termination', snippetNear(document, 20, 'no premium shortfall charge', 24))
  const page22 = sourceRef(22, 'Appendix A surrender charge rate', snippetNear(document, 22, 'Appendix A – Surrender charge rate', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: INITIAL_ACCOUNT_CHARGE_RATE,
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published 3.95% p.a. initial-account charge for the 10-year premium-payment-term base-layer corridor.',
        'The charge remains deductible even when regular premiums are not paid during the premium payment term.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'accumulation-account-charge',
      label: 'Accumulation Account Charge',
      basis: 'premium-base-mip-multiplier-capped-account-value',
      yearBasis: 'policy-year',
      rate: 0.015,
      amount: 0,
      appliesTo: ['accumulation'],
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        capRate: 0.007,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
        ],
      },
      activeWindow: 'policy-term',
      notes: [
        'Models the published accumulation-account charge as the lower of 1.50% p.a. of accumulation-account value or 0.70% p.a. of the 10-year premium base at issue.',
        'The cap remains anchored to the annualised regular premium committed at the effective date, matching the published formula.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted top-up premium.',
        'Top-up eligibility from month 13 and the lifetime top-up cap remain informational only in V1.',
      ],
      sourceRefs: [page4, page6],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      rate: 0.09,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published 9% p.a. premium shortfall charge on unpaid premiums after 24 continuous months of missed premiums during the premium payment term.',
        'Support Benefit waivers, reinstatement timing, and accumulation of outstanding unpaid charges remain informational only.',
      ],
      sourceRefs: [page7, page20],
    },
    {
      id: 'premium-reduction-charge',
      label: 'Premium Reduction Charge',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      rateSchedule: [
        { startPolicyYear: 3, endPolicyYear: 4, rate: 0.09 },
      ],
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published 9% p.a. premium reduction charge on the reduced annualised regular premium during policy years 3 to 4 for the 10-year corridor.',
        'Support Benefit waivers and subsequent premium restorations remain informational only.',
      ],
      sourceRefs: [page8, page20],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'No redemption fee is stated for withdrawals.',
        'During the premium payment term, the executable path assumes withdrawals only from the accumulation units account after the first 24 months.',
        'Initial-units-account withdrawal lockout, regular-withdrawal timing, minimum withdrawal amount, and minimum account-value rules remain informational only.',
      ],
      sourceRefs: [page8, page9, page10],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page4, page5, page9, page22],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page4, page6, page7, page9, page10],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'FWD Invest First Summit is cataloged as a supported V1 corridor. The parser captures the SGD 10-year base-layer corridor only: initial-account charge, capped accumulation-account charge, top-up premium charge, premium shortfall charge, premium reduction charge, zero redemption fee on the executable withdrawal path, and the 10-year surrender-charge schedule.',
      'Booster Bonus, Loyalty Bonus, Perpetual Bonus, Support Benefit logic, multi-life protection structure, and broader policy-flexibility behavior remain outside the current engine.',
    ],
    unsupportedItems: [
      'Booster Bonus, Loyalty Bonus, and Perpetual Bonus remain informational only.',
      'Support Benefit waiver/refund logic, premium-shortfall recovery state, and outstanding-charge accumulation remain informational only.',
      'Death benefit, multi-life last-survivor handling, and change-of-person-insured behavior remain informational only.',
      'Top-up cap, top-up eligibility timing, minimum withdrawal amount, regular withdrawal scheduling, and minimum account-value gates remain informational only.',
      'Policy closure charge, change-of-policy-currency handling, switching-fee review rights, and fund management charges remain informational only.',
    ],
    sourceRefs: [page1, page4, page5, page6, page7, page8, page9, page10, page20, page22],
  }
}

export function parseFwdInvestFirstSummit(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-first-summit',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Summit',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:fwd-invest-first-summit-initial-account-charge',
      'branch:fwd-invest-first-summit-accumulation-account-charge',
      'branch:fwd-invest-first-summit-top-up-premium-charge',
      'branch:fwd-invest-first-summit-premium-shortfall-charge',
      'branch:fwd-invest-first-summit-premium-reduction-charge',
      'branch:fwd-invest-first-summit-zero-redemption-fee',
      'branch:fwd-invest-first-summit-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-summit-booster-bonus',
      'fwd-invest-first-summit-loyalty-bonus',
      'fwd-invest-first-summit-perpetual-bonus',
      'fwd-invest-first-summit-support-benefit-waiver-and-refund',
      'fwd-invest-first-summit-death-benefit',
      'fwd-invest-first-summit-multi-life-last-survivor',
      'fwd-invest-first-summit-change-of-person-insured',
      'fwd-invest-first-summit-minimum-withdrawal-rules',
      'fwd-invest-first-summit-policy-closure-charge',
      'fwd-invest-first-summit-change-of-policy-currency',
      'fwd-invest-first-summit-fund-management-charge',
    ],
    warnings: [
      'FWD Invest First Summit is cataloged as a supported V1 corridor. The current parser covers the SGD 10-year base-layer corridor: initial-account charge, capped accumulation-account charge, top-up premium charge, premium shortfall charge, premium reduction charge, zero redemption fee on the executable withdrawal path, and the 10-year surrender-charge schedule.',
      'Bonuses, Support Benefit behavior, and multi-life protection structure remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
