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
  const page3 = sourceRef(3, 'Benefits', snippetNear(document, 3, 'Death Benefit', 18))
  const page5Dividends = sourceRef(5, 'Distribution of dividend', snippetNear(document, 5, 'Only cash purchased Policy', 26))
  const page5 = sourceRef(5, 'Fees and charges', snippetNear(document, 5, 'Redemption Fee', 22))
  const page6 = sourceRef(6, 'Subscription and premium types', snippetNear(document, 6, 'Premium (single, recurring and top-up)', 22))
  const page8 = sourceRef(8, 'Redemption of units', snippetNear(document, 8, 'Minimum Partial Redemption Amount', 18))
  const page11 = sourceRef(11, 'Switching of units', snippetNear(document, 11, 'SWITCHING OF UNITS', 20))
  const page14 = sourceRef(14, 'Key policy provisions', snippetNear(document, 14, 'Free-look Period', 18))
  const isSrs = fundingMode === 'srs'

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: isSrs ? 'Single Premium Charge (SRS)' : 'Single Premium Charge (Cash)',
      basis: 'annual-contribution',
      rate: 0.05,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        isSrs
          ? 'Enter the actual distributor-selected single-premium charge for the SRS corridor before trusting the projection.'
          : 'Enter the actual distributor-selected single-premium charge for the cash corridor before trusting the projection.',
        'The product summary publishes only the maximum premium-charge corridor of up to 5%.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: isSrs ? 'Top-up Premium Charge (SRS)' : 'Top-up Premium Charge (Cash)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      requiresManualInput: true,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        isSrs
          ? 'Enter the actual distributor-selected top-up premium charge for the SRS corridor before trusting top-up scenarios.'
          : 'Enter the actual distributor-selected top-up premium charge for the cash corridor before trusting top-up scenarios.',
        'The product summary publishes only the maximum premium-charge corridor of up to 5%.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'recurring-single-premium-charge',
      label: isSrs ? 'Recurring Single Premium Charge (SRS)' : 'Recurring Single Premium Charge (Cash)',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      requiresManualInput: true,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        isSrs
          ? 'Enter the actual distributor-selected recurring single premium charge for the SRS corridor before trusting the projection.'
          : 'Enter the actual distributor-selected recurring single premium charge for the cash corridor before trusting the projection.',
        'Use recurring-single-premium events to represent the approved annual, half-yearly, or quarterly cadence.',
        'The product summary publishes only the maximum premium-charge corridor of up to 5%.',
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
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      ...(isSrs ? {} : { minimumAnnualPayoutAmount: 30 }),
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: !isSrs,
      cashPayoutAllowedAfterMip: !isSrs,
      source: 'distribution-paying-funds',
      notes: isSrs
        ? [
            'SRS-funded policies default dividend distributions to reinvestment because the published payout election is only available to cash-purchased policies.',
            'V1 seeds reinvestment by default because no SRS cash-payout path is modeled, while designated-bank-account payout operations remain informational only.',
          ]
        : [
            'Cash-funded policies default dividend distributions to reinvestment and may elect cash payout for dividend-paying ILP sub-funds.',
            'V1 seeds reinvestment by default; payout elections use a manual annual distribution-yield assumption while designated-bank-account payout operations remain informational only.',
          ],
      sourceRefs: [page5Dividends],
    },
    eecTable: [],
    warnings: [
      isSrs
        ? 'HSBC Life Wealth Invest (SRS) is cataloged as a supported V1 product. The parser captures the distributor-selected premium-charge surface through manual input for initial single premiums, recurring single premiums, and top-ups, plus reinvest-only distribution support, the nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions through the open-ended no-MIP basis.'
        : 'HSBC Life Wealth Invest (Cash) is cataloged as a supported V1 product. The parser captures the distributor-selected premium-charge surface through manual input for initial single premiums, recurring single premiums, and top-ups, plus reinvest-default distribution support, the nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions through the open-ended no-MIP basis.',
      'Enter the actual single-premium, recurring-single-premium, and top-up premium-charge percentages from the issued policy or quotation before trusting the analysis.',
      'Switching fees are currently nil, while switching behavior, dividend cash-payout operations, and bank-routing edge cases remain outside the current calculator surface.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'The current terminal-illness benefit amount is modeled as the same higher-of policy value or 101%-of-paid-premiums corridor after current amounts owing, and the current admitted-state TI payable amount is supported through the published termination corridor after manual claim-amount entry, but claim exclusions and insurer-side payout mechanics remain informational only.',
      'Recurring single premium enrollment approval, allocation-change requests, and failed-deduction handling remain informational only.',
      'Fund-level management charges and additional ILP-sub-fund charges remain informational only because they depend on the selected fund mix and are not a single product-level rate.',
      'Fund switching administration remains informational only.',
      'Designated-bank-account payout operations remain informational only.',
      'Termination and free-look refund behavior remain informational only.',
    ],
    sourceRefs: [page3, page5Dividends, page5, page6, page8, page11, page14],
  }
}

export function parseHsbcWealthInvestCashSrs(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-wealth-invest-cash-srs',
    insurer: 'HSBC Life',
    productName: 'HSBC Life Wealth Invest (Cash/SRS)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:hsbc-life-wealth-invest-cash-srs-max-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-top-up-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-zero-redemption-fee',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'tokio-recurring-single-premium-routing',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'hsbc-life-wealth-invest-cash-srs-fund-management-charge',
      'hsbc-life-wealth-invest-cash-srs-additional-ilp-sub-fund-charges',
      'hsbc-life-wealth-invest-cash-srs-dividend-bank-account-routing',
      'hsbc-life-wealth-invest-cash-srs-fund-switching',
      'hsbc-life-wealth-invest-cash-srs-free-look-refund',
      'hsbc-life-wealth-invest-cash-srs-termination',
    ],
    warnings: [
      'HSBC Life Wealth Invest (Cash/SRS) is cataloged as a supported V1 product. The parser captures separate cash and SRS corridors for the distributor-selected single-premium, recurring-single-premium, and top-up charge paths through manual input, reinvest-default or reinvest-only distribution support, the nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions through the open-ended no-MIP basis, the current-state death and terminal-illness benefit amount as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals and current amounts owing, and the current admitted-state TI payable amount through the published automatic-termination TI corridor after manual claim-amount entry, while terminal-illness claim exceptions, fund-level charges, payout operations, and free-look behavior remain informational only beyond the modeled current ordinary death-benefit and terminal-illness estimates.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'cash'),
      buildVariant(context.document, 'srs'),
    ],
  }
}
