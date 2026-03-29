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

type VariantId =
  | 'sgd-open-ended-single-premium-cash'
  | 'sgd-open-ended-single-premium-srs'
  | 'sgd-open-ended-recurrent-single-premium-srs'

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument, variantId: VariantId): IlpTemplateVariant {
  const isSinglePremium = variantId === 'sgd-open-ended-single-premium-cash' || variantId === 'sgd-open-ended-single-premium-srs'
  const isRecurringSinglePremium = variantId === 'sgd-open-ended-recurrent-single-premium-srs'
  const premiumModeLabel = isSinglePremium ? 'single premium' : 'recurrent single premium'
  const premiumDocumentLabel = 'product quotation'
  const variantWarningLabel =
    variantId === 'sgd-open-ended-single-premium-cash'
      ? 'Prestige Portfolio (Single Premium / Cash)'
      : variantId === 'sgd-open-ended-single-premium-srs'
        ? 'Prestige Portfolio (Single Premium / SRS)'
        : 'Prestige Portfolio (Recurrent Single Premium / SRS)'

  const page2 = sourceRef(2, 'Benefits and premium types', snippetNear(document, 2, 'Premium type', 20))
  const page3 = sourceRef(3, 'Premium charge, wrap fee, and policy fee', snippetNear(document, 3, 'Premium charge', 28))
  const page4 = sourceRef(4, 'Top-ups, withdrawals, and surrender', snippetNear(document, 4, 'Partial Withdrawal of funds', 30))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: isSinglePremium ? 'premium-charge' : 'recurrent-single-premium-charge',
      label: 'Premium Charge',
      basis: isSinglePremium ? 'initial-single-premium' : 'annual-contribution',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        `Enter the actual ${premiumModeLabel} premium-charge percentage from the issued ${premiumDocumentLabel} before trusting the projection.`,
        'The product summary publishes only the configurable cap: up to 3% at policy start, and requestable up to 5% after issue.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'wrap-fee',
      label: 'Wrap Fee',
      basis: 'account-value',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Enter the actual quoted wrap-fee percentage before trusting the projection.',
        'The product summary publishes only the configurable cap: up to 1.5% p.a. at policy start, and requestable up to 2% p.a. after issue.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'account-value',
      rate: 0.002,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 0.2% p.a. policy fee deducted monthly from total investment value.',
      ],
      sourceRefs: [page3],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Investment Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        `Enter the actual top-up premium-charge percentage from the issued ${premiumDocumentLabel} before trusting any top-up scenario.`,
        'The summary states that the premium charge also applies to each accepted investment top-up.',
      ],
      sourceRefs: [page3, page4],
    },
    ...(isRecurringSinglePremium
      ? [{
          id: 'recurring-single-premium-charge',
          label: 'Recurring Single Premium Charge',
          trigger: 'recurring-single-premium' as const,
          basis: 'event-amount-with-overlap-months' as const,
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          requiresManualInput: true,
          activeWindow: 'policy-term' as const,
          allocation: 'equal-split' as const,
          notes: [
            `Enter the actual recurrent single premium-charge percentage from the issued ${premiumDocumentLabel} before trusting the projection.`,
            'Use recurring-single-premium events to represent the approved monthly, quarterly, half-yearly, or yearly SRS stream.',
          ],
          sourceRefs: [page2, page3],
        }]
      : []),
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
        'Models the published no-stated-charge partial-withdrawal path at the policy level.',
        'V1 blocks explicit one-off partial withdrawals below the published S$1,000 minimum value of units to be sold from the selected fund.',
        'V1 also blocks explicit one-off partial withdrawals that would leave the selected fund below the published S$1,000 minimum remaining value, using the current configured fund split as a same-row proportional proxy for the selected-fund balance.',
      ],
      sourceRefs: [page4],
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
        label: 'Policy Account',
        feeRate: 0.002,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          ...(isRecurringSinglePremium ? [{ phase: 'after-icp' as const, targetAccountId: 'policy', contributionShare: 1 }] : []),
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page2, page3, page4],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingSelectedFundValueRules: [
        {
          activeWindow: 'policy-term',
          accountId: 'policy',
          minimumValue: 1_000,
        },
      ],
    },
    eecTable: [],
    warnings: [
      `${variantWarningLabel} is cataloged as a supported V1 corridor. The parser captures the quote-driven premium-charge surface through manual input, the quote-driven wrap-fee surface through manual input, the published 0.2% p.a. policy fee, the current-state death-benefit estimate as total investment value, the current-state accidental-death estimate as the higher of total investment value or a manual current basic sum assured before age 80 next birthday, the quote-driven top-up premium-charge surface through manual input, and the nil policy-level withdrawal / surrender charge path through the open-ended basis together with the published S$1,000 minimum one-off partial withdrawal amount and the published S$1,000 selected-fund remaining-value floor.`,
      `Enter the actual premium-charge and wrap-fee percentages from the issued ${premiumDocumentLabel} before trusting the analysis.`,
    ],
    unsupportedItems: [
      'Regular-premium cash corridor remains informational only because the early-surrender deductions are shown only in the policy illustration rather than as a published fixed catalog schedule.',
      'Accidental-death claim admission, exclusions, settlement timing, and basic-sum-assured history after future withdrawals remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
      'SRS return-destination handling on withdrawals and surrender remains informational only.',
      'Fund switching, premium-apportionment changes, exact per-fund NAV divergence, and future insurer revisions of the stated withdrawal thresholds remain informational only beyond the modeled explicit selected-fund partial-withdrawal floor that uses the current configured fund split as a proportional selected-fund balance proxy.',
      'Post-issue fee changes, newly introduced fees, and fund-level charges remain informational only.',
    ],
    sourceRefs: [page2, page3, page4],
  }
}

export function parseGreatEasternPrestigePortfolio(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-prestige-portfolio',
    insurer: 'Great Eastern',
    productName: 'Prestige Portfolio',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'branch:great-eastern-prestige-portfolio-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-recurrent-single-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-wrap-fee-manual-input',
      'branch:great-eastern-prestige-portfolio-policy-fee',
      'branch:great-eastern-prestige-portfolio-top-up-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-partial-withdrawal-zero-charge',
      'branch:great-eastern-prestige-portfolio-open-ended-zero-surrender-charge',
      'kernel:partial-withdrawal-minimum-amount-block',
      'kernel:partial-withdrawal-selected-fund-minimum-value-block',
    ],
    coveredElsewhereBehaviors: [
      'great-eastern-prestige-portfolio-post-issue-fee-changes',
      'great-eastern-prestige-portfolio-fund-level-fees',
    ],
    metadataOnlyBehaviors: [
      'great-eastern-prestige-portfolio-regular-premium-corridor',
      'great-eastern-prestige-portfolio-regular-premium-surrender-deductions',
      'great-eastern-prestige-portfolio-accidental-death-claim-exclusions',
      'great-eastern-prestige-portfolio-basic-sum-assured-history',
      'great-eastern-prestige-portfolio-srs-return-destination',
      'great-eastern-prestige-portfolio-fund-switching-threshold-administration',
      'great-eastern-prestige-portfolio-fund-switching',
    ],
    warnings: [
      'Prestige Portfolio is cataloged as a supported V1 corridor for the single-premium cash, single-premium SRS, and recurrent-single-premium SRS paths. The parser captures the quote-driven premium-charge and wrap-fee surfaces through manual input, the published 0.2% p.a. policy fee, the current-state death-benefit estimate as total investment value, the current-state accidental-death estimate as the higher of total investment value or a manual current basic sum assured before age 80 next birthday, the quote-driven top-up and recurrent-single-premium charge paths through manual input, and the nil policy-level withdrawal / surrender charge path through the open-ended basis together with the published S$1,000 minimum one-off partial withdrawal amount and the published S$1,000 selected-fund remaining-value floor.',
      'Accidental-death claim admission, exclusions, settlement timing, basic-sum-assured history after future withdrawals, and the regular-premium cash corridor with policy-illustration-specific surrender deductions remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'sgd-open-ended-single-premium-cash'),
      buildVariant(context.document, 'sgd-open-ended-single-premium-srs'),
      buildVariant(context.document, 'sgd-open-ended-recurrent-single-premium-srs'),
    ],
  }
}
