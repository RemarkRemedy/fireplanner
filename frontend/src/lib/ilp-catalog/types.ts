export type IlpCatalogSupportStatus = 'supported' | 'partial' | 'parser-error'
export type IlpCatalogStructureStatus = 'structured' | 'brochure-partial'
export type IlpCatalogEconomicsStatus = 'supported' | 'partial-modeled-subset' | 'metadata-only'
export type IlpCatalogCurrency = 'SGD' | 'USD'
export type IlpCatalogSourceDocumentType = 'summary' | 'brochure'
export type IlpCatalogSourceClass = 'summary' | 'brochure-only'
export type IlpMipBasis = 'finite' | 'open-ended'

export interface IlpCatalogSourceRef {
  page: number
  section: string
  excerpt: string
}

export interface IlpTemplateContributionRule {
  phase: 'during-icp' | 'after-icp' | 'after-mip' | 'top-up'
  targetAccountId: string
  contributionShare: number
}

export interface IlpTemplateAccount {
  id: string
  label: string
  feeRate: number | null
  postMipFeeRate: number | null
  subjectToEec: boolean
  contributionRules: IlpTemplateContributionRule[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateBonusTier {
  currency: IlpCatalogCurrency
  minAnnualPremium: number | null
  maxAnnualPremium: number | null
  minAccountValue?: number | null
  maxAccountValue?: number | null
  rate: number
}

export interface IlpTemplateBonus {
  id: string
  type: 'power-up' | 'loyalty' | 'allocation' | 'sign-up' | 'custom'
  label: string
  mode: 'annual-rate' | 'premium-allocation' | 'one-time'
  appliesTo: string[]
  startPolicyYear: number
  endPolicyYear: number | null
  yearBasis?: 'policy-year' | 'premium-year'
  cadenceYears?: number
  requiresPremiumsPaidUpToDate?: boolean
  requiredRegularPremiumPaymentFrequency?: 'annual' | 'semi-annual' | 'quarterly' | 'monthly'
  rate: number | null
  amount: number | null
  tieredRates: IlpTemplateBonusTier[]
  adjustmentFactorConfig?: {
    formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium'
    withdrawalAccountIds: string[]
  }
  suspensionRules?: Array<{
    trigger: 'premium-holiday' | 'partial-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
    suspensionMonths: number
  }>
  restorationRules?: Array<{
    trigger: 'premium-holiday-repayment'
    basis: 'repaid-premium-with-missed-months' | 'account-value-plus-repaid-premium-with-missed-months'
  }>
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateFeeRule {
  id: string
  label: string
  basis?: 'account-value' | 'annual-contribution' | 'fixed-annual' | 'assurance-sum-at-risk' | 'premium-base-mip-multiplier' | 'premium-base-mip-multiplier-capped-account-value' | 'cumulative-paid-regular-premium' | 'initial-single-premium' | 'initial-single-premium-base'
  yearBasis?: 'policy-year' | 'premium-year'
  requiresPremiumsPaidUpToDate?: boolean
  rate: number | null
  amount?: number | null
  assuranceConfig?: {
    formula:
      | 'prudential-prosper-death'
      | 'prudential-prosper-accidental-death'
      | 'prudential-assure-ii-combined'
      | 'prudential-linkguard-combined'
      | 'aia-plp2-plus-death'
      | 'aia-plp2-max-death'
      | 'hsbc-flexi-choice-death-ti'
      | 'hsbc-flexi-max-death-ti'
      | 'great-eastern-wa4-death-ti'
      | 'great-eastern-gla4-death-ti'
      | 'great-eastern-pla-death-ti'
      | 'fwd-invest-flexi-elite-death'
      | 'income-invest-flex-death-ti'
      | 'income-legacy-flex-solitaire-death-ti'
      | 'manulife-investready-iii-death-ti'
      | 'manulife-manuinvest-duo-death-ti-tpd'
      | 'tokio-mpc-net-premium-floor'
      | 'tokio-mpc-locked-in-policy-value'
      | 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
    rateTable?:
      | 'tokio-mpc-unzo-death'
    monthlyModalFactor: number
    maxAgeNextBirthday?: number
    policyYearRateMultiplierSchedule?: Array<{
      startPolicyYear: number
      endPolicyYear: number | null
      multiplier: number
    }>
    sumAssuredRateMultiplierTiers?: Array<{
      minSumAssured: number
      maxSumAssured: number | null
      multiplier: number
    }>
    accrual?: {
      startPolicyYear: number
      endPolicyYear: number
      settlementPolicyYear: number
    }
    disableFutureChargesOnInsufficientDeduction?: boolean
    tokioProtectionState?: {
      mode: 'locked-in-policy-value' | 'locked-in-policy-value-with-adjusted-single-premium'
      trackedValueAccountIds: string[]
      withdrawalReductionAccountIds: string[]
    }
  }
  premiumBaseConfig?: {
    useHigherOfCommencementAndPrevailing: boolean
    capRate?: number
    multiplierYearBasis?: 'policy-year' | 'premium-year'
    multiplierSchedule: Array<{
      startPolicyYear: number
      endPolicyYear: number | null
      mode: 'policy-year' | 'fixed'
      multiplier?: number
    }>
  }
  cumulativePaidPremiumConfig?: {
    annualisedPremiumAtIssue?: number
    countRateSchedule?: Array<{
      minAnnualisedPremiumsPaid: number
      maxAnnualisedPremiumsPaid: number | null
      rate: number
    }>
  }
  requiresManualInput?: boolean
  appliesTo: string[]
  assuranceValueAppliesTo?: string[]
  fallbackAppliesTo?: string[]
  rateSchedule?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    rate: number
  }>
  amountSchedule?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    amount: number
  }>
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
  startPolicyYear?: number
  endPolicyYear?: number | null
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateEventChargeRule {
  id: string
  label: string
  trigger: 'partial-withdrawal' | 'regular-premium-reduction' | 'premium-holiday' | 'premium-holiday-repayment' | 'top-up' | 'recurring-single-premium'
  basis: 'event-amount' | 'account-value' | 'premium-reduction-with-startup-recovery' | 'premium-reduction-tiered-startup-recovery' | 'repaid-premium-with-missed-months' | 'annual-premium-with-overlap-months' | 'committed-annual-premium-with-overlap-months' | 'premium-holiday-charge-refund' | 'event-amount-with-overlap-months' | 'annual-reduction-with-active-months'
  yearBasis?: 'policy-year' | 'premium-year'
  appliesTo: string[]
  fallbackAppliesTo?: string[]
  freeLifetimeMonths?: number
  freeEventCount?: number
  freeEventStartPolicyYear?: number
  freeEventMaxAmountRate?: number
  freeEventMaxAmountBasis?: 'open-balance' | 'initial-single-premium'
  freeAmountPoolRate?: number
  freeAmountPoolBasis?: 'open-balance-at-start-policy-year' | 'initial-single-premium'
  freeAmountPoolReferencePolicyYear?: number
  rate: number | null
  rateSchedule?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    rate: number
  }>
  amount: number | null
  sourceChargeRuleId?: string
  sourceBonusId?: string
  requiresManualInput?: boolean
  exclusiveGroup?: string
  groupResolution?: 'max-total-charge'
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
  allocation: 'pro-rata-by-value' | 'pro-rata-by-contribution-share' | 'equal-split'
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateScheduledPayoutSupport {
  mode: 'manual-assumption'
  accountId: string
  fallbackAccountIds?: string[]
  source: 'policy-redemption'
  payoutStateSupport?: {
    defaultState: 'secure-income' | 'target-income'
    suppressWhileLapsed: boolean
    stateAfterPremiumHolidayActivation?: 'secure-income' | 'target-income'
    stateAfterReinstatement?: 'secure-income' | 'target-income'
  }
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateDistributionSupport {
  mode: 'manual-assumption'
  accountIds: string[]
  minimumAnnualPayoutAmount?: number
  minimumAnnualPayoutCurrency?: IlpCatalogCurrency
  recordDateInstructionLeadDays?: number
  cashPayoutWindows?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    accountIds: string[]
  }>
  defaultMode: 'reinvest'
  cashPayoutAllowedDuringMip: boolean
  cashPayoutAllowedAfterMip: boolean
  source: 'distribution-paying-funds'
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplatePolicyStateSupport {
  automaticLapseOnAccountValueDepletion: boolean
}

export interface IlpTemplateVariant {
  id: string
  currency: IlpCatalogCurrency
  mipBasis?: IlpMipBasis
  mipLength?: number | null
  icpMonths: number
  accounts: IlpTemplateAccount[]
  bonuses: IlpTemplateBonus[]
  feeRules: IlpTemplateFeeRule[]
  eventChargeRules: IlpTemplateEventChargeRule[]
  policyStateSupport?: IlpTemplatePolicyStateSupport
  scheduledPayoutSupport?: IlpTemplateScheduledPayoutSupport
  distributionSupport?: IlpTemplateDistributionSupport
  eecTable: number[]
  eecYearBasis?: 'policy-year' | 'premium-year'
  exitChargeBasis?: 'account-value' | 'initial-single-premium-base'
  warnings: string[]
  unsupportedItems: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpCatalogProduct {
  id: string
  insurer: string
  productName: string
  sourceFileName: string
  sourceChecksumSha256: string
  sourceDocumentType: IlpCatalogSourceDocumentType
  sourceClass: IlpCatalogSourceClass
  supportStatus: IlpCatalogSupportStatus
  structureStatus: IlpCatalogStructureStatus
  economicsStatus: IlpCatalogEconomicsStatus
  modeledEconomics: string[]
  metadataOnlyBehaviors: string[]
  warnings: string[]
  archived: boolean
  variants: IlpTemplateVariant[]
}

export interface IlpCatalogManifest {
  catalogVersion: string
  generatedAt: string
  parserVersion: string
  sourceStrategy: 'manual-pdf-corpus'
  productsCount: number
  supportedCount: number
  partialCount: number
  parserErrorCount: number
  summarySourceCount: number
  brochureOnlySourceCount: number
  brochurePartialEligibleCount: number
}
