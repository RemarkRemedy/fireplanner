import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

export interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

interface ChargeTier {
  startPolicyYear: number
  endPolicyYear: number | null
  rate: number
}

interface AiaPlatinumWealthConfig {
  id: string
  productName: string
  supportStatus?: IlpCatalogProduct['supportStatus']
  economicsStatus?: IlpCatalogProduct['economicsStatus']
  catalogWarningLabel?: string
  regularPremiumTermYears?: readonly number[]
  regularPremiumChargeSchedule: readonly ChargeTier[]
  premiumHolidayChargeSchedule: readonly ChargeTier[]
  regularFullSurrenderChargeSchedule?: readonly number[]
  regularPartialWithdrawalChargeSchedule?: readonly number[]
  regularPartialWithdrawalChargeFinalTierContinuesOnward?: boolean
  modeledEconomics: string[]
  coveredElsewhereBehaviors?: string[]
  metadataOnlyBehaviors: string[]
  productWarning: string
  unsupportedItems: string[]
  additionalVariantWarnings?: string[]
  planKeyword: string
  overviewPage: number
  premiumPage: number
  chargePage: number
  holidayPage: number
  topUpPage: number
  nonPaymentPage: number
  buildAdditionalFeeRules?: (refs: {
    overviewRef: IlpCatalogSourceRef
    premiumRef: IlpCatalogSourceRef
    chargeRef: IlpCatalogSourceRef
    holidayRef: IlpCatalogSourceRef
    topUpRef: IlpCatalogSourceRef
    nonPaymentRef: IlpCatalogSourceRef
  }) => IlpTemplateFeeRule[]
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
  lineWindow = 18,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(
  values: readonly number[],
  options: {
    finalTierContinuesOnward?: boolean
  } = {},
): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: options.finalTierContinuesOnward && index === values.length - 1
      ? null
      : index + 1,
    rate,
  }))
}

function buildEecTable(values: readonly number[], mipLength: number): number[] {
  if (values.length === 0) {
    return []
  }

  const table = [...values]
  const finalRate = values[values.length - 1]

  while (table.length < mipLength) {
    table.push(finalRate)
  }

  return table
}

function buildVariant(
  document: ExtractedPdfDocument,
  config: AiaPlatinumWealthConfig,
  premiumPaymentTermYears: number,
): IlpTemplateVariant {
  const catalogWarningLabel = config.catalogWarningLabel ?? 'partial modeled subset in V1'
  const overviewRef = sourceRef(
    config.overviewPage,
    'Plan overview and product structure',
    snippetNear(document, config.overviewPage, config.planKeyword, 20),
  )
  const premiumRef = sourceRef(
    config.premiumPage,
    'Regular premium and top-up allocation',
    snippetNear(document, config.premiumPage, '100% of Regular Premium less Premium Charge', 22),
  )
  const chargeRef = sourceRef(
    config.chargePage,
    'Premium charge and charge schedule',
    snippetNear(document, config.chargePage, 'Premium Charge', 22),
  )
  const holidayRef = sourceRef(
    config.holidayPage,
    'Premium holiday and surrender mechanics',
    snippetNear(document, config.holidayPage, 'Premium Holiday Charge', 24),
  )
  const topUpRef = sourceRef(
    config.topUpPage,
    'Top-up premium mechanics',
    snippetNear(document, config.topUpPage, 'top-up premium', 22),
  )
  const nonPaymentRef = sourceRef(
    config.nonPaymentPage,
    'Premium holiday continuation and non-payment',
    snippetNear(document, config.nonPaymentPage, 'Premium Holiday', 22),
  )

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Regular Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: config.regularPremiumChargeSchedule.map((tier) => ({ ...tier })),
      activeWindow: 'policy-term',
      notes: [
        'Models the published regular premium charge schedule for the supported regular-pay corridor.',
        'If regular premiums are missed and later resumed, the charge schedule continues from the rate band immediately after the last accepted premium.',
      ],
      sourceRefs: [premiumRef, chargeRef],
    },
    ...(config.buildAdditionalFeeRules?.({
      overviewRef,
      premiumRef,
      chargeRef,
      holidayRef,
      topUpRef,
      nonPaymentRef,
    }) ?? []),
  ]

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
        'Models the published 3% premium charge deducted from each accepted ad hoc top-up premium.',
        'Ad hoc top-ups are blocked in policy months where due regular premiums are not paid up to date.',
      ],
      sourceRefs: [premiumRef, topUpRef],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: config.premiumHolidayChargeSchedule.map((tier) => ({ ...tier })),
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'Charged monthly during premium holiday based on the annualised regular premium.',
        'The charge stops once all outstanding regular premiums are fully repaid.',
      ],
      sourceRefs: [holidayRef, nonPaymentRef],
    },
  ]

  if (config.regularPartialWithdrawalChargeSchedule) {
    eventChargeRules.push({
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(config.regularPartialWithdrawalChargeSchedule, {
        finalTierContinuesOnward: config.regularPartialWithdrawalChargeFinalTierContinuesOnward,
      }),
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge factor on withdrawn regular-premium policy value.',
        'Single-premium and top-up withdrawal behavior remains informational only in V1.',
      ],
      sourceRefs: [holidayRef, topUpRef],
    })
  }

  return {
    id: `sgd-mip-${premiumPaymentTermYears}`,
    currency: 'SGD',
    mipLength: premiumPaymentTermYears,
    paymentStructure: 'ppt',
    premiumPaymentTermYears,
    contributionMode: 'regular-pay',
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Regular Premium Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: Boolean(config.regularFullSurrenderChargeSchedule?.length),
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [overviewRef, premiumRef, topUpRef],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: config.regularFullSurrenderChargeSchedule
      ? buildEecTable(config.regularFullSurrenderChargeSchedule, premiumPaymentTermYears)
      : [],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
    },
    warnings: [
      `${config.productName} is cataloged as a ${catalogWarningLabel}. ${config.productWarning}`,
      ...(config.additionalVariantWarnings ?? []),
    ],
    unsupportedItems: config.unsupportedItems,
    sourceRefs: [overviewRef, premiumRef, chargeRef, holidayRef, topUpRef, nonPaymentRef],
  }
}

export function buildAiaPlatinumWealthProduct(
  context: ParseContext,
  config: AiaPlatinumWealthConfig,
): IlpCatalogProduct {
  const supportStatus = config.supportStatus ?? 'partial'
  const economicsStatus = config.economicsStatus ?? 'partial-modeled-subset'
  const catalogWarningLabel = config.catalogWarningLabel ?? 'partial modeled subset in V1'
  const regularPremiumTermYears = config.regularPremiumTermYears ?? [5]

  return {
    id: config.id,
    insurer: 'AIA Singapore',
    productName: config.productName,
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus,
    structureStatus: 'structured',
    economicsStatus,
    modeledEconomics: config.modeledEconomics,
    coveredElsewhereBehaviors: config.coveredElsewhereBehaviors ?? [],
    metadataOnlyBehaviors: config.metadataOnlyBehaviors,
    warnings: [
      `${config.productName} is cataloged as a ${catalogWarningLabel}. ${config.productWarning}`,
    ],
    archived: false,
    variants: regularPremiumTermYears.map((premiumPaymentTermYears) => buildVariant(
      context.document,
      config,
      premiumPaymentTermYears,
    )),
  }
}
