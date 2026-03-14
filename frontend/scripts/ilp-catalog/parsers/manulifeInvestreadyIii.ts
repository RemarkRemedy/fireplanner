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

const PREMIUM_SHORTFALL_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
] as const

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
  lineWindow = 12,
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
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Manulife InvestReady (III)', 16))
  const page2 = sourceRef(2, 'MIP and flexi start table', snippetNear(document, 2, 'Flexi start date', 18))
  const page6 = sourceRef(6, 'COI and administrative charge', snippetNear(document, 6, 'Cost of Insurance', 22))
  const page8 = sourceRef(8, 'Premium shortfall charge table', snippetNear(document, 8, 'Premium Shortfall Charge', 28))
  const page9 = sourceRef(9, 'Top-up premium and flexi options', snippetNear(document, 9, 'Top-up premium', 18))
  const page19 = sourceRef(19, 'Appendix A annual COI table', snippetNear(document, 19, 'Annual Cost of Insurance', 22))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'cost-of-insurance',
      label: 'Cost of Insurance (Death / TI)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'manulife-investready-iii-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires insured-life details plus the current net regular premium base and current net top-up premium base before the calculator can model the annualised COI.',
        'Models the published 101% paid-premium floor net-amount-at-risk formula for death and terminal illness benefit.',
      ],
      sourceRefs: [page6, page19],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'pro-rata-by-value',
      notes: [
        'Models the published monthly premium shortfall charge before the Flexi Start date for the 5 Years Flexi 4 corridor.',
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page2, page8],
    },
  ]

  return {
    id: 'sgd-mip-5-flexi-4',
    currency: 'SGD',
    mipLength: 5,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page9],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [1, 1, 0.75, 0.4, 0.2],
    warnings: [
      'Manulife InvestReady (III) is cataloged as a partial modeled subset in V1. The parser captures the 5 Years Flexi 4 corridor: the published account-value administration charge path, the premium-shortfall charge path before Flexi Start, and the new protected-base COI formula after you enter the insured-life details and current premium bases.',
      'Flexi-start premium variation, welcome / annual-premium / loyalty bonuses, surrender charges, withdrawal charges, and fund-level management charges remain outside the current engine.',
    ],
    unsupportedItems: [
      'Welcome Bonus, Annual Premium Bonus, and Loyalty Bonus remain informational only.',
      'Full-surrender and partial-withdrawal charge schedules remain informational only.',
      'Top-up underwriting and dividend distribution remain informational only.',
      'Death / terminal-illness payout handling remains informational only beyond the modeled COI deduction.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
      'Regular premium variation from Flexi Start onwards remains informational only.',
      'The zero top-up-premium charge remains implicit and is not authored as a calculator rule.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
    ],
    sourceRefs: [page1, page2, page6, page8, page9, page19],
  }
}

export function parseManulifeInvestreadyIii(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-iii',
    insurer: 'Manulife Singapore',
    productName: 'Manulife InvestReady (III)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
    ],
    metadataOnlyBehaviors: [
      'manulife-investready-iii-welcome-bonus',
      'manulife-investready-iii-annual-premium-bonus',
      'manulife-investready-iii-loyalty-bonus',
      'manulife-investready-iii-full-surrender-charge',
      'manulife-investready-iii-partial-withdrawal-charge',
      'manulife-investready-iii-top-up-underwriting',
      'manulife-investready-iii-dividend-distribution-mode',
      'manulife-investready-iii-benefit-payout-handling',
      'manulife-investready-iii-reinstatement',
      'manulife-investready-iii-flexi-start-premium-variation',
      'manulife-investready-iii-fund-management-charge',
    ],
    warnings: [
      'Manulife InvestReady (III) is cataloged as a partial modeled subset in V1. The parser captures the 5 Years Flexi 4 corridor: the published 2.50% / 1.00% administration-charge path, the premium-shortfall charge before Flexi Start, and the new protected-base COI formula after you enter the insured-life details and current premium bases, while bonuses, surrender/withdrawal schedules, flexi-start premium variation, benefit payouts, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
