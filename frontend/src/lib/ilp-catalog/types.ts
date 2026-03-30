export type IlpCatalogSupportStatus = 'supported' | 'partial' | 'parser-error'
export type IlpCatalogStructureStatus = 'structured' | 'brochure-partial'
export type IlpCatalogEconomicsStatus = 'supported' | 'partial-modeled-subset' | 'metadata-only'
export type IlpCatalogCurrency = 'SGD' | 'USD'
export type IlpCatalogSourceDocumentType = 'summary' | 'brochure'
export type IlpCatalogSourceClass = 'summary' | 'brochure-only'
export type IlpMipBasis = 'finite' | 'open-ended'
export type IlpVitalityStatus = 'bronze' | 'silver' | 'gold' | 'platinum'
export type IlpRegularPremiumPaymentFrequency = 'annual' | 'semi-annual' | 'quarterly' | 'monthly'

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
  minSumAssured?: number | null
  maxSumAssured?: number | null
  minSumAssuredMultiple?: number | null
  maxSumAssuredMultiple?: number | null
  minAccountValue?: number | null
  maxAccountValue?: number | null
  rate: number
}

export interface IlpTemplateBonus {
  id: string
  type: 'power-up' | 'loyalty' | 'allocation' | 'sign-up' | 'custom'
  label: string
  mode: 'annual-rate' | 'monthly-rate' | 'premium-allocation' | 'one-time'
  oneTimePayoutBasis?: 'fixed-amount' | 'committed-annual-premium-at-issue' | 'initial-single-premium-at-issue' | 'step-up-booster-delta'
  annualPremiumTierBasis?:
    | 'projected-paid-regular-premium-this-year'
    | 'committed-annual-premium-at-issue'
    | 'initial-basic-sum-assured-at-issue'
    | 'initial-basic-sum-assured-multiple-at-issue'
    | 'initial-single-premium-at-issue'
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
  policyYearRateSchedule?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    rate: number
  }>
  vitalityStatusRateSchedule?: Array<{
    status: IlpVitalityStatus
    startPolicyYear: number
    endPolicyYear: number | null
    rate: number
  }>
  stepUpPayoutConfig?: {
    premiumShortfallChargeYears: number
    partialWithdrawalAccountIds: string[]
    countPartialWithdrawalsFromPolicyYear: number
  }
  adjustmentFactorConfig?: {
    formula:
      | 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium'
      | 'cumulative-withdrawal-factor-product-over-account-value'
    withdrawalAccountIds: string[]
    countFromPolicyYear?: number
    includePolicyRepaymentsInPaidRegularPremium?: boolean
    policyRepaymentPriorOffsetRules?: Array<{
      trigger: 'partial-withdrawal' | 'regular-premium-reduction'
      accountIds?: string[]
    }>
  }
  qualificationRules?: Array<
    | {
        trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
        accountIds?: string[]
        disqualifyThroughPolicyYear: number
      }
    | {
        trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
        accountIds?: string[]
        disqualifyInReferenceYear: true
      }
    | {
        trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
        accountIds?: string[]
        disqualifyThroughReferenceYear: true
      }
    | {
        trigger: 'partial-withdrawal'
        accountIds?: string[]
        disqualifyWhenCumulativeAmountExceeds: 'annualised-regular-premium-at-issue'
        countFromPolicyYear: number
    }
    | {
        trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
        accountIds?: string[]
        disqualifyIfAnyFromPolicyYear: number
      }
    | {
        trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
        accountIds?: string[]
        disqualifyIfAnyInLookbackMonths: number
      }
    | {
        formula: 'policy-year-growth-measure'
        minimumRatio: number
        rounding: 'floor-whole-percent'
      }
    | {
        formula: 'cumulative-effective-account-value-ratio'
        maximumRatio: number
        includeReinvestedDividendWithdrawals?: boolean
      }
    | {
        formula: 'no-new-premium-arrears-in-lookback-months'
        lookbackMonths: number
      }
  >
  suspensionRules?: Array<{
    trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
    suspensionMonths: number
    startOffsetMonths?: number
    accountIds?: string[]
  }>
  restorationRules?: Array<{
    trigger: 'premium-holiday-repayment' | 'policy-repayment'
    basis: 'repaid-premium-with-missed-months' | 'account-value-plus-repaid-premium-with-missed-months' | 'repaid-premium'
  }>
  excludedValueRules?: Array<{
    trigger: 'premium-holiday-repayment' | 'policy-repayment' | 'top-up' | 'recurring-single-premium'
    basis: 'repaid-premium' | 'event-amount'
    lookbackMonths?: number
    netAmountFactor?: number
  }>
  preservedValueRules?: Array<{
    trigger: 'partial-withdrawal'
    basis: 'event-amount'
    accountIds?: string[]
    requiresBonusSuspensionWaived?: boolean
  }>
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateFeeRule {
  id: string
  label: string
  basis?: 'account-value' | 'annual-contribution' | 'fixed-annual' | 'assurance-sum-at-risk' | 'insured-amount-at-issue' | 'premium-base-mip-multiplier' | 'premium-base-mip-multiplier-capped-account-value' | 'cumulative-paid-regular-premium' | 'initial-single-premium' | 'initial-single-premium-base'
  yearBasis?: 'policy-year' | 'premium-year'
  requiresPremiumsPaidUpToDate?: boolean
  suspensionRules?: Array<{
    trigger: 'premium-holiday'
    basis: 'prorate-by-overlap-months'
  }>
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
      | 'aia-venture-benefit-charge'
      | 'aia-pro-achiever-3-benefit-charge'
      | 'hsbc-flexi-choice-death-ti'
      | 'hsbc-flexi-max-death-ti'
      | 'great-eastern-wa4-death-ti'
      | 'great-eastern-gla4-death-ti'
      | 'great-eastern-pla-death-ti'
      | 'fwd-invest-flexi-elite-death'
      | 'fwd-invest-repayment-inclusive-death'
      | 'income-invest-flex-death-ti'
      | 'income-legacy-flex-solitaire-death-ti'
      | 'manulife-investready-iii-death-ti'
      | 'singlife-savvy-invest-ii-death-ti'
      | 'manulife-smartretire-death'
      | 'manulife-smartretire-wop-tpd'
      | 'manulife-manuinvest-duo-death-ti-tpd'
      | 'tokio-mpc-net-premium-floor'
      | 'tokio-mpc-locked-in-policy-value'
      | 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
      | 'tokio-mpc-goassure-basic-sum-at-risk'
      | 'tokio-mpc-goassure-tpd-sum-at-risk'
    rateTable?:
      | 'tokio-mpc-unzo-death'
      | 'tokio-goassure-mpc-death'
      | 'tokio-goassure-mpc-tpd'
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
  issueAgeRateTiers?: Array<{
    minIssueAgeNextBirthday: number
    maxIssueAgeNextBirthday: number | null
    rate: number
  }>
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
  carryForwardOnInsufficientDeductionWithinPolicyYears?: {
    startPolicyYear: number
    endPolicyYear: number
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
  basis: 'event-amount' | 'account-value' | 'premium-reduction-with-startup-recovery' | 'premium-reduction-tiered-startup-recovery' | 'repaid-premium-with-missed-months' | 'annual-premium-with-overlap-months' | 'committed-annual-premium-with-overlap-months' | 'premium-holiday-charge-refund' | 'source-event-charge-refund' | 'event-amount-with-overlap-months' | 'annual-reduction-with-active-months' | 'fixed-amount-with-overlap-months'
  yearBasis?: 'policy-year' | 'premium-year'
  appliesTo: string[]
  fallbackAppliesTo?: string[]
  manualWaiverMode?: 'full-skip' | 'capped-free-event'
  manualWaiverGrantGroup?: string
  manualWaiverMaxGrantCount?: number
  manualWaiverMaxOverlapMonths?: number
  freeLifetimeMonths?: number
  freeLifetimeMonthsStartPolicyYear?: number
  freeLifetimeMonthsSchedule?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    months: number
  }>
  freeLifetimeMonthsResetOnRepayment?: boolean
  freeEventCount?: number
  freeEventStartPolicyYear?: number
  freeEventMaxAmountRate?: number
  freeEventMaxAmountBasis?: 'open-balance' | 'initial-single-premium' | 'cumulative-paid-regular-premium'
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
  allowedFrequencies?: Array<'annual' | 'semi-annual' | 'quarterly' | 'monthly'>
  minimumStartPolicyYear?: number
  requiresTargetRetirementAgeStart?: boolean
  minimumAnnualWithdrawalAmount?: number
  minimumWithdrawalAmountPerOccurrence?: number
  minimumRemainingPolicyValue?: number
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
  accountValueDepletionNonLapseWindows?: Array<{
    startPolicyYear: number
    endPolicyYear: number
  }>
  accountValueDepletionNonLapseTerminationRules?: Array<
    | {
        trigger: 'partial-withdrawal' | 'premium-holiday'
        disqualifyIfAnyFromPolicyYear: number
        endPolicyYear?: number | null
      }
    | {
        trigger: 'partial-withdrawal'
        basis: 'cumulative-withdrawals-exceed-open-balance-at-start-policy-year-rate'
        startPolicyYear: number
        endPolicyYear: number | null
        maximumValueRate: number
        accountIds?: string[]
      }
  >
  minimumRegularPremiumVariationStartPolicyMonth?: number
  minimumRegularPremiumAmountByFrequency?: Partial<Record<IlpRegularPremiumPaymentFrequency, number>>
  blockRegularPremiumVariationDuringPremiumHoliday?: boolean
  blockTopUpsDuringPremiumHoliday?: boolean
  blockTopUpsWhenPremiumsNotPaidUpToDate?: boolean
  minimumTopUpAmount?: number
  topUpAmountIncrement?: number
  minimumRecurringSinglePremiumMonthlyAmount?: number
  minimumRecurringSinglePremiumStartPolicyMonth?: number
  requiresCommencementPremiumForRecurringSinglePremiumResumption?: boolean
  minimumPremiumHolidayStartPolicyMonth?: number
  minimumPartialWithdrawalStartPolicyMonthByAccount?: Array<{
    accountId: string
    startPolicyMonth: number
  }>
  minimumPartialWithdrawalAmount?: number
  partialWithdrawalAmountIncrement?: number
  partialWithdrawalMaximumAmountRules?: Array<{
    activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
    accountId: string
    basis:
      | 'cumulative-paid-regular-premium-less-prior-gross-withdrawals'
      | 'account-value-less-prior-withdrawals'
    startPolicyYear?: number
    endPolicyYear?: number | null
    maximumValueRate: number
  }>
  partialWithdrawalMinimumRemainingValueRules?: Array<{
    activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
    basis: 'account-value' | 'policy-value' | 'initial-single-premium'
    accountId?: string
    minimumValue?: number
    minimumValueRate?: number
  }>
  partialWithdrawalMinimumRemainingSelectedFundValueRules?: Array<{
    activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
    accountId: string
    minimumValue: number
    minimumValueExclusive?: boolean
  }>
  minimumTopUpStartPolicyMonth?: number
  topUpRepaymentClearance?: {
    includeMissedPremiums?: boolean
    priorOffsetRules?: Array<{
      trigger: 'partial-withdrawal' | 'regular-premium-reduction'
      accountIds?: string[]
    }>
  }
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
  coveredElsewhereBehaviors: string[]
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
