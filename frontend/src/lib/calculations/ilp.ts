import {
  AIA_PLP2_DEATH_RATE_TABLE,
  AIA_VENTURE_BENEFIT_CHARGE_RATE_TABLE,
  FWD_FLEXI_ELITE_DEATH_RATE_TABLE,
  GREAT_EASTERN_PRESTIGE_LEGACY_STANDARD_RATE_TABLE,
  GREAT_EASTERN_WA4_DEATH_TI_RATE_TABLE,
  HSBC_FLEXI_DEATH_TI_RATE_TABLE,
  INCOME_INVEST_FLEX_DEATH_TI_RATE_TABLE,
  INCOME_LEGACY_FLEX_SOLITAIRE_DEATH_TI_RATE_TABLE,
  type IlpAssuranceRateTable,
  MANULIFE_INVESTREADY_III_DEATH_TI_RATE_TABLE,
  SINGLIFE_SAVVY_INVEST_II_DEATH_TI_RATE_TABLE,
  MANULIFE_SMARTRETIRE_DEATH_RATE_TABLE,
  MANULIFE_MANUINVEST_DUO_DEATH_TI_TPD_RATE_TABLE,
  MANULIFE_SMARTRETIRE_WOP_TPD_RATE_TABLE,
  PRUACTIVE_LINKGUARD_COMBINED_RATE_TABLE,
  PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE,
  PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE,
  PRUVANTAGE_PROSPER_DEATH_RATE_TABLE,
  TOKIO_MPC_UNZO_DEATH_RATE_TABLE,
} from '@/lib/data/ilpAssuranceTables'
import {
  MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
  PRUDENTIAL_ASSURE_II_MULTIPLIERS,
  PRUDENTIAL_PROSPER_SUM_AT_RISK_MULTIPLIERS,
  TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER,
} from '@/lib/data/ilpAssuranceConfig'
import { lookupEecRate } from '@/lib/data/ilpDefaults'

export interface IlpFund {
  name: string
  allocation: number
  ocf: number
  grossReturnLow: number
  grossReturnMid: number
  grossReturnHigh: number
}

export interface IlpAccount {
  id: string
  label: string
  feeRate: number
  currentValue: number
  contributionShare: number
  subjectToEec: boolean
  postMipFeeRate: number | null
  contributionRules?: IlpContributionRule[]
}

export interface IlpContributionRule {
  phase: 'during-icp' | 'after-icp' | 'after-mip' | 'top-up'
  contributionShare: number
}

export interface IlpPolicyEvent {
  id: string
  type: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'regular-premium-increase' | 'policy-repayment' | 'top-up' | 'recurring-single-premium' | 'recurring-single-premium-resumption' | 'assurance-benefit-reduction' | 'assurance-benefit-resumption' | 'lapse'
  startPolicyMonth: number
  durationMonths: number
  amount?: number
  accountId?: string
  chargeWaived?: boolean
  chargeWaiverGrantId?: string
  chargeRefunded?: boolean
  bonusSuspensionWaived?: boolean
  repayMissedPremiums?: boolean
  repaymentAccountId?: string
  resultingSumAssured?: number
  resultingWealthAssureValue?: number
}

export type IlpRegularPremiumPaymentFrequency = 'annual' | 'semi-annual' | 'quarterly' | 'monthly'

export type IlpScheduledPayoutState = 'secure-income' | 'target-income'

export interface IlpScheduledPayoutStateSupport {
  defaultState: IlpScheduledPayoutState
  suppressWhileLapsed: boolean
  stateAfterPremiumHolidayActivation?: IlpScheduledPayoutState
  stateAfterReinstatement?: IlpScheduledPayoutState
}

export interface IlpScheduledPayoutSupport {
  mode: 'manual-assumption'
  accountId: string
  fallbackAccountIds?: string[]
  allowedFrequencies?: IlpRegularPremiumPaymentFrequency[]
  minimumStartPolicyYear?: number
  requiresTargetRetirementAgeStart?: boolean
  minimumAnnualWithdrawalAmount?: number
  minimumWithdrawalAmountPerOccurrence?: number
  minimumRemainingPolicyValue?: number
  source: 'policy-redemption'
  payoutStateSupport?: IlpScheduledPayoutStateSupport
}

export interface IlpPolicyStateSupport {
  automaticLapseOnAccountValueDepletion: boolean
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
  minimumTopUpStartPolicyMonth?: number
  topUpRepaymentClearance?: {
    includeMissedPremiums?: boolean
    priorOffsetRules?: Array<{
      trigger: 'partial-withdrawal' | 'regular-premium-reduction'
      accountIds?: string[]
    }>
  }
}

export type IlpScheduledPayoutAssumption =
  | {
      mode: 'disabled'
    }
  | {
      mode: 'scheduled-redemption'
      source: 'manual-assumption'
      accountId: string
      startPolicyYear: number
      durationYears: number
      annualPayoutAmount: number
      frequency?: IlpRegularPremiumPaymentFrequency
    }

export interface IlpDistributionSupport {
  mode: 'manual-assumption'
  accountIds: string[]
  minimumAnnualPayoutAmount?: number
  minimumAnnualPayoutCurrency?: 'SGD' | 'USD'
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
}

export type IlpDistributionAssumption =
  | {
      mode: 'disabled'
    }
  | {
      mode: 'reinvest'
      source: 'catalog-default' | 'manual-assumption'
    }
  | {
      mode: 'cash-payout'
      source: 'manual-assumption'
      annualYieldRate: number
    }

export interface IlpBonusSuspensionRule {
  trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
  suspensionMonths: number
  startOffsetMonths?: number
  accountIds?: string[]
}

export type IlpBonusQualificationRule = {
  trigger: 'premium-holiday' | 'partial-withdrawal' | 'reinvested-dividend-withdrawal' | 'regular-premium-reduction' | 'scheduled-payout'
  accountIds?: string[]
} & (
  | { disqualifyThroughPolicyYear: number }
  | { disqualifyInReferenceYear: true }
  | { disqualifyThroughReferenceYear: true }
  | {
      disqualifyWhenCumulativeAmountExceeds: 'annualised-regular-premium-at-issue'
      countFromPolicyYear: number
    }
  | {
    disqualifyIfAnyFromPolicyYear: number
  }
  | {
    disqualifyIfAnyInLookbackMonths: number
  }
)
  | {
    formula: 'policy-year-growth-measure'
    minimumRatio: number
    rounding: 'floor-whole-percent'
  }
  | {
    formula: 'cumulative-effective-account-value-ratio'
    maximumRatio: number
    includeReinvestedDividendWithdrawals?: true
  }
  | {
    formula: 'no-new-premium-arrears-in-lookback-months'
    lookbackMonths: number
  }

export interface IlpBonusRestorationRule {
  trigger: 'premium-holiday-repayment' | 'policy-repayment'
  basis: 'repaid-premium-with-missed-months' | 'account-value-plus-repaid-premium-with-missed-months' | 'repaid-premium'
}

export interface IlpBonusExcludedValueRule {
  trigger: 'premium-holiday-repayment' | 'policy-repayment' | 'top-up' | 'recurring-single-premium'
  basis: 'repaid-premium' | 'event-amount'
  lookbackMonths?: number
  netAmountFactor?: number
}

export interface IlpBonusPreservedValueRule {
  trigger: 'partial-withdrawal'
  basis: 'event-amount'
  accountIds?: string[]
  requiresBonusSuspensionWaived?: boolean
}

export interface IlpChargeSuspensionRule {
  trigger: 'premium-holiday'
  basis: 'prorate-by-overlap-months'
}

export interface IlpBonusRule {
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
  rate: number
  amount: number
  appliesTo: string[]
  startPolicyYear: number
  endPolicyYear: number | null
  yearBasis?: 'policy-year' | 'premium-year'
  cadenceYears?: number
  requiresPremiumsPaidUpToDate?: boolean
  requiredRegularPremiumPaymentFrequency?: IlpRegularPremiumPaymentFrequency
  tieredRates?: IlpBonusTier[]
  policyYearRateSchedule?: Array<{
    startPolicyYear: number
    endPolicyYear: number | null
    rate: number
  }>
  vitalityStatusRateSchedule?: Array<{
    status: 'bronze' | 'silver' | 'gold' | 'platinum'
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
  qualificationRules?: IlpBonusQualificationRule[]
  suspensionRules?: IlpBonusSuspensionRule[]
  restorationRules?: IlpBonusRestorationRule[]
  excludedValueRules?: IlpBonusExcludedValueRule[]
  preservedValueRules?: IlpBonusPreservedValueRule[]
}

export interface IlpBonusTier {
  currency: 'SGD' | 'USD'
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

export interface IlpAssuranceProfile {
  currentAgeNextBirthday: number
  sex: 'male' | 'female'
  smokerStatus: 'smoker' | 'non-smoker'
  lifeAssuredMode?: 'single-life' | 'multi-life'
  currentOldestLifeAgeNextBirthday?: number
  currentOldestLifeSex?: 'male' | 'female'
  currentYoungestLifeAgeNextBirthday?: number
  currentNetRegularPremiumBase?: number
  currentNetRepaymentBase?: number
  currentSumAssured?: number
  currentWealthAssureValue?: number
  currentBasicSumAssured?: number
  initialBasicSumAssuredAtIssue?: number
  currentNetSupplementaryPremiumBase?: number
  currentNetProtectedPremiumBase?: number
  currentAccidentalDeathFloorAmount?: number
  currentLockedInPolicyValue?: number
  currentAdjustedSinglePremium?: number
  currentProtectionAge?: number
  currentTpdAccelerationRatio?: number
  targetRetirementAge?: number
  currentAmountOwing?: number
  currentDeathBenefitRateTier?: 'net-premium-105' | 'net-premium-101'
  currentRetainedMultiplierStatus?: 'multiplier-expired' | 'multiplier-retained'
  currentAcceleratedTiPayoutMode?: 'same-as-death-benefit' | 'lower-than-death-benefit'
  currentNoLapsePrivilegeMode?: 'not-in-effect' | 'expiry-age-85' | 'expiry-age-100'
}

export interface IlpClaimProfile {
  currentClaimHistory?: {
    family?: 'none' | 'ti-advancement' | 'tpd-waiver' | 'tpd-staged-payout' | 'accidental-disability-staged-payout'
    admissionStatus?: 'not-admitted' | 'admitted' | 'admitted-and-settled'
    remainingWaivedPremiumMonths?: number
    remainingProtectedDeathCoverBase?: number
    remainingStagedBenefitBalance?: number
    refundGateStatus?: 'intact' | 'broken'
  }
  currentIndebtedness?: number
  remainingAggregateTiCap?: number
  remainingAggregateTiCiCap?: number
  currentTiClaimStatus?: 'not-triggered' | 'triggered' | 'admitted' | 'admitted-and-settled'
  currentTiClaimBenefitAmount?: number
  currentResidualDeathBenefitAfterTiClaim?: number
  currentTpdClaimStatus?: 'not-triggered' | 'triggered' | 'admitted' | 'admitted-and-settled'
  currentTpdClaimBenefitAmount?: number
  remainingAggregateTpdCap?: number
  currentExcludedClaimBonusValue?: number
  currentExcludedValueCohorts?: Array<{
    bonusId: string
    accountId: string
    amount: number
    remainingMonths: number | null
  }>
  currentBonusAdjustmentFactors?: Array<{
    bonusId: string
    factor: number
  }>
  currentInvestPlusSpPowerUpBonusStatus?: 'due-and-uncredited' | 'already-credited-or-not-payable'
  currentInvestPlusSpInitialPowerUpBonusAmount?: number
  currentInvestPlusSpTopUpPowerUpBonusAmount?: number
  currentInvestPlusSpObservedInitialAccountValueAverage?: number
  currentInvestPlusSpRepresentativeManagementChargeRate?: number
  currentInvestStarterPolicyChargeRefundAverageAccountValue?: number
  currentInvestStarterPolicyChargeRefundStatus?: 'due-and-uncredited' | 'already-credited-or-not-payable'
  currentRefundEligibleDeathCoiCollected?: number
  currentDeathCoiRefundStatus?: 'due-and-uncredited' | 'already-credited-or-not-payable'
  currentSmartRetireRefundGateStatus?: 'intact' | 'broken'
  currentSmartRetireDeathClaimStatus?: 'not-triggered' | 'admitted-and-settled'
  currentAccidentalDeathMode?: 'standard-accident' | 'restricted-activity-accident'
  currentWopOnTpdClaimStatus?: 'not-triggered' | 'admitted' | 'admitted-and-settled'
  currentRemainingWopPremiumWaiverMonths?: number
  currentTpdContinuationEventStatus?: 'triggered' | 'not-triggered'
  currentTpdSettlementMode?: 'same-as-death-benefit' | 'lower-than-death-benefit'
  currentTpdPayoutStage?: 'full-benefit-payable-now' | 'initial-lump-sum-payable-now' | 'balance-lump-sum-payable-now'
  currentTpdRemainingBalance?: number
  currentAccidentalDisabilityPayoutStage?: 'initial-lump-sum-payable-now' | 'balance-lump-sum-payable-now'
  currentAccidentalDisabilityRemainingBalance?: number
}

export interface IlpTokioProtectionStateConfig {
  mode: 'locked-in-policy-value' | 'locked-in-policy-value-with-adjusted-single-premium'
  trackedValueAccountIds: string[]
  withdrawalReductionAccountIds: string[]
}

export interface IlpAssuranceChargeConfig {
  formula:
    | 'prudential-prosper-death'
    | 'prudential-prosper-accidental-death'
    | 'prudential-assure-ii-combined'
    | 'prudential-linkguard-combined'
    | 'aia-plp2-plus-death'
    | 'aia-plp2-max-death'
    | 'aia-pro-achiever-3-benefit-charge'
    | 'aia-venture-benefit-charge'
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
  tokioProtectionState?: IlpTokioProtectionStateConfig
}

export interface IlpPremiumBaseMultiplierTier {
  startPolicyYear: number
  endPolicyYear: number | null
  mode: 'policy-year' | 'fixed'
  multiplier?: number
}

export interface IlpPremiumBaseChargeConfig {
  useHigherOfCommencementAndPrevailing: boolean
  capRate?: number
  multiplierYearBasis?: 'policy-year' | 'premium-year'
  multiplierSchedule: IlpPremiumBaseMultiplierTier[]
}

export interface IlpCumulativePaidPremiumRateTier {
  minAnnualisedPremiumsPaid: number
  maxAnnualisedPremiumsPaid: number | null
  rate: number
}

export interface IlpCumulativePaidPremiumChargeConfig {
  annualisedPremiumAtIssue?: number
  countRateSchedule?: IlpCumulativePaidPremiumRateTier[]
}

export interface IlpChargeRule {
  id: string
  label: string
  basis: 'account-value' | 'annual-contribution' | 'fixed-annual' | 'assurance-sum-at-risk' | 'premium-base-mip-multiplier' | 'premium-base-mip-multiplier-capped-account-value' | 'cumulative-paid-regular-premium' | 'initial-single-premium' | 'initial-single-premium-base'
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
  yearBasis?: 'policy-year' | 'premium-year'
  requiresPremiumsPaidUpToDate?: boolean
  suspensionRules?: IlpChargeSuspensionRule[]
  startPolicyYear?: number
  endPolicyYear?: number | null
  appliesTo: string[]
  assuranceValueAppliesTo?: string[]
  fallbackAppliesTo?: string[]
  rateSchedule?: IlpChargeRateTier[]
  amountSchedule?: IlpChargeAmountTier[]
  rate: number
  amount: number
  assuranceConfig?: IlpAssuranceChargeConfig
  premiumBaseConfig?: IlpPremiumBaseChargeConfig
  cumulativePaidPremiumConfig?: IlpCumulativePaidPremiumChargeConfig
  requiresManualInput?: boolean
  allocation: 'pro-rata-by-value' | 'pro-rata-by-contribution-share' | 'equal-split'
}

export interface IlpChargeRateTier {
  startPolicyYear: number
  endPolicyYear: number | null
  rate: number
}

export interface IlpChargeAmountTier {
  startPolicyYear: number
  endPolicyYear: number | null
  amount: number
}

export interface IlpEventChargeRateTier {
  startPolicyYear: number
  endPolicyYear: number | null
  rate: number
}

export interface IlpEventChargeRule {
  id: string
  label: string
  trigger: 'partial-withdrawal' | 'regular-premium-reduction' | 'premium-holiday' | 'premium-holiday-repayment' | 'top-up' | 'recurring-single-premium'
  basis: 'event-amount' | 'account-value' | 'premium-reduction-with-startup-recovery' | 'premium-reduction-tiered-startup-recovery' | 'repaid-premium-with-missed-months' | 'annual-premium-with-overlap-months' | 'committed-annual-premium-with-overlap-months' | 'premium-holiday-charge-refund' | 'source-event-charge-refund' | 'event-amount-with-overlap-months' | 'annual-reduction-with-active-months' | 'fixed-amount-with-overlap-months'
  activeWindow?: 'during-mip' | 'after-mip' | 'policy-term'
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
  rate: number
  rateSchedule?: IlpEventChargeRateTier[]
  amount: number
  sourceChargeRuleId?: string
  sourceBonusId?: string
  requiresManualInput?: boolean
  exclusiveGroup?: string
  groupResolution?: 'max-total-charge'
  allocation: 'pro-rata-by-value' | 'pro-rata-by-contribution-share' | 'equal-split'
}

export interface IlpCatalogSource {
  productId: string
  productName: string
  variantId: string
  variantLabel: string
  catalogVersion: string
  generatedAt?: string
  supportStatus: 'supported' | 'partial' | 'parser-error'
  economicsStatus: 'supported' | 'partial-modeled-subset' | 'metadata-only'
  structureStatus: 'structured' | 'brochure-partial'
  modeledEconomics: string[]
  metadataOnlyBehaviors: string[]
}

export interface IlpPolicyInput {
  id: string
  name: string
  insurer: string
  currency: 'SGD' | 'USD'
  monthlyContribution: number
  regularPremiumPaymentFrequency?: IlpRegularPremiumPaymentFrequency
  initialSinglePremium?: number
  monthsAlreadyPaid: number
  currentAcceptedRegularPremiumMonths?: number
  currentPolicyYear: number
  vitalityStatus?: 'bronze' | 'silver' | 'gold' | 'platinum'
  icpMonths?: number
  mipBasis?: 'finite' | 'open-ended'
  assuranceProfile?: IlpAssuranceProfile
  claimProfile?: IlpClaimProfile
  policyStateSupport?: IlpPolicyStateSupport
  scheduledPayoutSupport?: IlpScheduledPayoutSupport
  scheduledPayoutAssumption?: IlpScheduledPayoutAssumption
  distributionSupport?: IlpDistributionSupport
  distributionAssumption?: IlpDistributionAssumption
  policyEvents?: IlpPolicyEvent[]
  accounts: IlpAccount[]
  mipLength?: number | null
  postMipYears: number
  eecTable: number[]
  eecYearBasis?: 'policy-year' | 'premium-year'
  exitChargeBasis?: 'account-value' | 'initial-single-premium-base'
  funds: IlpFund[]
  bonuses: IlpBonusRule[]
  chargeRules?: IlpChargeRule[]
  eventChargeRules?: IlpEventChargeRule[]
  catalogSource?: IlpCatalogSource
  catalogWarnings?: string[]
  discountRate: number
  // Persisted with the ILP policy contract for UI round-tripping and downstream
  // analysis surfaces even though the current calculator stays nominal.
  inflationRate: number
  alternativeReturn: number
}

export type ReturnScenario = 'low' | 'mid' | 'high'

export interface IlpAccountYearRow {
  accountId: string
  open: number
  contributionAmount: number
  grossFee: number
  bonusCredit: number
  netFee: number
  withdrawalAmount: number
  close: number
}

export interface IlpYearRow {
  year: number
  policyYear: number
  policyState: 'in-force' | 'lapsed'
  scheduledPayoutState: 'inactive' | 'lapsed' | IlpScheduledPayoutState
  annualContribution: number
  annualWithdrawals: number
  accounts: IlpAccountYearRow[]
  combinedValue: number
  eecRate: number
  eecCharge: number
  surrenderValue: number
  cumulativePremiums: number
  cumulativeGrossFees: number
  cumulativeBonuses: number
}

export interface IlpProjectionResult {
  scenario: ReturnScenario
  blendedNetReturn: number
  rows: IlpYearRow[]
}

export interface IlpNpvExitOption {
  exitYear: number
  policyYear: number
  eecRate: number
  eecCharge: number
  pvEec: number
  npvGrossFees: number
  npvBonuses: number
  totalNpvFees: number
  netSurrenderValue: number
  totalContributions: number
}

export interface IlpNpvAnalysis {
  surrenderNow: {
    eecRate: number
    eecCharge: number
    npvFees: number
    netSurrenderValue: number
  }
  futureExitOptions: IlpNpvExitOption[]
  bestExitYear: number
  bestExitNpvFees: number
  holdToMip: {
    npvGrossFees: number
    npvBonuses: number
    totalNpvFees: number
    finalValue: number
    totalContributions: number
  }
}

export interface IlpOpportunityCost {
  alternativePortfolioValue: number
  ilpValueAtHorizon: number
  difference: number
  atBestExit: {
    exitYear: number
    alternativeValue: number
    ilpValueAtHorizon: number
    difference: number
  }
}

export interface IlpSummaryMetrics {
  totalPremiumsPaid: number
  totalFeesCharged: number
  totalBonusesReceived: number
  netFeeDrag: number
  currentSurrenderValue: number
  cancelNowPenalty: number
  currentDeathBenefitEstimate?: number
  currentAccidentalDeathBenefitEstimate?: number
  currentTiBenefitEstimate?: number
  currentTiBenefitAfterTpdEstimate?: number
  currentResidualDeathBenefitAfterTiEstimate?: number
  currentTpdBenefitEstimate?: number
  currentAccidentalTpdBenefitEstimate?: number
  currentResidualDeathBenefitAfterTpdEstimate?: number
  currentAccidentalDisabilityBenefitEstimate?: number
}

export interface IlpProjectedPolicyAnalysis {
  mode: 'projected'
  policyId: string
  policyName: string
  insurer: string
  currency: IlpPolicyInput['currency']
  projections: Record<ReturnScenario, IlpProjectionResult>
  npvAnalysis: IlpNpvAnalysis
  opportunityCost: IlpOpportunityCost
  summary: IlpSummaryMetrics
}

export interface IlpCurrentOnlyPolicyAnalysis {
  mode: 'current-only'
  reason: 'mature-finite-policy'
  policyId: string
  policyName: string
  insurer: string
  currency: IlpPolicyInput['currency']
  summary: IlpSummaryMetrics
}

export type IlpPolicyAnalysis = IlpProjectedPolicyAnalysis | IlpCurrentOnlyPolicyAnalysis

export interface IlpComparisonRow {
  metric: string
  unit: 'currency' | 'percent' | 'years' | 'text'
  values: Record<string, number | string>
  lowerIsBetter: boolean | null
}

export interface IlpFullAnalysis {
  policies: IlpPolicyAnalysis[]
  comparison: IlpComparisonRow[]
}

const CONTRIBUTION_TOLERANCE = 0.001
const HSBC_WEALTH_FOCUS_DEATH_BENEFIT_FLOOR_MULTIPLIER = 1.01
const MANULIFE_SMARTRETIRE_DEATH_BENEFIT_FLOOR_MULTIPLIER = 1.05

function supportsCurrentAdmittedTiClaimState(productId?: string): boolean {
  return productId === 'hsbc-life-wealth-harvest'
    || productId === 'hsbc-life-wealth-abundance'
    || productId === 'hsbc-life-wealth-voyage'
    || productId === 'hsbc-life-wealth-accelerate'
    || productId === 'hsbc-life-wealth-focus-flexi-1'
    || productId === 'hsbc-life-wealth-focus-flexi-3'
    || productId === 'hsbc-life-wealth-focus-flexi-5'
    || productId === 'hsbc-life-flexi-protector'
    || productId === 'hsbc-life-goal-builder-ii'
    || productId === 'hsbc-life-wealth-invest-cash-srs'
    || productId === 'hsbc-life-wealth-invest-cpf'
    || productId === 'etiqa-tiq-invest'
    || productId === 'etiqa-dash-pet-plus'
    || productId === 'etiqa-invest-flex-prime-ii'
    || productId === 'etiqa-invest-flex-pro'
    || productId === 'etiqa-invest-vista'
    || productId === 'etiqa-invest-smart-flex-ii'
    || productId === 'etiqa-invest-smart-vista'
    || productId === 'etiqa-invest-flex-wealth-ii'
    || productId === 'etiqa-invest-wealth-purpose'
    || productId === 'etiqa-invest-starter'
    || productId === 'tokio-marine-goassure'
    || productId === 'great-eastern-wealth-advantage-4'
    || productId === 'great-eastern-investment-linked-insurance-plan-2'
    || productId === 'great-eastern-prestige-legacy-advantage'
    || productId === 'aia-platinum-wealth-elite-2'
    || productId === 'aia-platinum-wealth-legacy'
    || productId === 'aia-elite-secure-income-5-pay'
    || productId === 'aia-elite-secure-income-single-premium'
    || productId === 'aia-platinum-retirement-elite'
    || productId === 'great-eastern-great-invest-advantage-sp'
    || productId === 'great-eastern-great-invest-advantage-rsp'
    || productId === 'great-eastern-great-invest-advantage-2-sp'
    || productId === 'great-eastern-great-invest-advantage-2-rsp'
    || productId === 'manulife-manuinvest-duo'
    || productId === 'manulife-manulink-investor-ii'
    || productId === 'manulife-investready-growth'
    || productId === 'manulife-investready-iii'
    || productId === 'manulife-investready-iii-sep-2025'
    || productId === 'singlife-legacy-invest'
    || productId === 'singlife-savvy-invest-ii'
    || productId === 'income-invest-flex'
    || productId === 'income-invest-flex-vantage'
    || productId === 'income-invest-flex-trivantage'
    || productId === 'income-legacy-flex-solitaire'
}

function supportsCurrentSettledTiClaimTermination(productId?: string): boolean {
  return productId === 'hsbc-life-wealth-invest-cash-srs'
    || productId === 'hsbc-life-wealth-invest-cpf'
    || productId === 'etiqa-invest-starter'
    || productId === 'aia-elite-secure-income-5-pay'
    || productId === 'aia-elite-secure-income-single-premium'
    || productId === 'aia-platinum-retirement-elite'
    || productId === 'great-eastern-wealth-advantage-4'
    || productId === 'great-eastern-investment-linked-insurance-plan-2'
    || productId === 'great-eastern-great-invest-advantage-sp'
    || productId === 'great-eastern-great-invest-advantage-rsp'
    || productId === 'great-eastern-great-invest-advantage-2-sp'
    || productId === 'great-eastern-great-invest-advantage-2-rsp'
    || productId === 'singlife-legacy-invest'
    || productId === 'singlife-savvy-invest-ii'
    || productId === 'income-invest-flex'
    || productId === 'income-invest-flex-vantage'
    || productId === 'income-invest-flex-trivantage'
    || productId === 'income-legacy-flex-solitaire'
}

function isCurrentTiClaimStatusActive(
  status: IlpClaimProfile['currentTiClaimStatus'],
): boolean {
  return status === 'triggered'
    || status === 'admitted'
    || status === 'admitted-and-settled'
}

function getSmartRetireClaimHistory(
  input: IlpPolicyInput,
): IlpClaimProfile['currentClaimHistory'] | undefined {
  return input.claimProfile?.currentClaimHistory
}

function getSmartRetireWopClaimAdmissionStatus(
  input: IlpPolicyInput,
): 'not-admitted' | 'admitted' | 'admitted-and-settled' | undefined {
  const claimHistory = getSmartRetireClaimHistory(input)
  if (claimHistory?.family === 'tpd-waiver' && claimHistory.admissionStatus != null) {
    return claimHistory.admissionStatus
  }

  switch (input.claimProfile?.currentWopOnTpdClaimStatus) {
    case 'not-triggered':
      return 'not-admitted'
    case 'admitted':
      return 'admitted'
    case 'admitted-and-settled':
      return 'admitted-and-settled'
    default:
      return undefined
  }
}

function getSmartRetireRemainingWaiverMonthsInput(
  input: IlpPolicyInput,
): number | undefined {
  const claimHistory = getSmartRetireClaimHistory(input)
  if (claimHistory?.family === 'tpd-waiver' && claimHistory.remainingWaivedPremiumMonths != null) {
    return claimHistory.remainingWaivedPremiumMonths
  }

  return input.claimProfile?.currentRemainingWopPremiumWaiverMonths
}

function getSmartRetireRefundGateStatus(
  input: IlpPolicyInput,
): 'intact' | 'broken' | undefined {
  const claimHistory = getSmartRetireClaimHistory(input)
  if (claimHistory?.refundGateStatus != null) {
    return claimHistory.refundGateStatus
  }

  return input.claimProfile?.currentSmartRetireRefundGateStatus
}

function getCurrentClaimHistoryRemainingProtectedDeathCoverBase(
  input: IlpPolicyInput,
): number | undefined {
  const claimHistory = input.claimProfile?.currentClaimHistory
  if (
    claimHistory?.family !== 'ti-advancement'
    || claimHistory.remainingProtectedDeathCoverBase == null
  ) {
    return undefined
  }

  return Math.max(0, claimHistory.remainingProtectedDeathCoverBase)
}

function getCurrentClaimHistoryRemainingStagedBenefitBalance(
  input: IlpPolicyInput,
  family: NonNullable<NonNullable<IlpClaimProfile['currentClaimHistory']>['family']> = 'tpd-staged-payout',
): number | undefined {
  const claimHistory = input.claimProfile?.currentClaimHistory
  if (
    claimHistory?.family !== family
    || claimHistory.remainingStagedBenefitBalance == null
  ) {
    return undefined
  }

  return Math.max(0, claimHistory.remainingStagedBenefitBalance)
}

function supportsClaimHistoryProtectedDeathCoverBase(productId?: string): boolean {
  return productId?.startsWith('hsbc-life-wealth-focus-flexi-') ?? false
}

function computeCurrentDeathBenefitFromClaimHistoryProtectedBase(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
): number | undefined {
  if (!supportsClaimHistoryProtectedDeathCoverBase(input.catalogSource?.productId)) {
    return undefined
  }

  const remainingProtectedDeathCoverBase = getCurrentClaimHistoryRemainingProtectedDeathCoverBase(input)
  const currentAmountOwing = input.assuranceProfile?.currentAmountOwing
  if (remainingProtectedDeathCoverBase == null || currentAmountOwing == null) {
    return undefined
  }

  const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
  const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)

  return Math.max(
    0,
    Math.max(regularAccountValue, remainingProtectedDeathCoverBase) + topUpAccountValue - Math.max(0, currentAmountOwing),
  )
}

function supportsManualCurrentResidualDeathBenefitAfterTiClaim(productId?: string): boolean {
  return productId === 'hsbc-life-wealth-harvest'
    || productId === 'hsbc-life-wealth-abundance'
    || productId === 'hsbc-life-wealth-voyage'
    || productId === 'hsbc-life-wealth-accelerate'
    || productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    || productId === 'hsbc-life-goal-builder-ii'
    || productId === 'etiqa-tiq-invest'
    || productId === 'etiqa-dash-pet-plus'
    || productId === 'etiqa-invest-flex-prime-ii'
    || productId === 'etiqa-invest-flex-pro'
    || productId === 'etiqa-invest-vista'
    || productId === 'etiqa-invest-smart-flex-ii'
    || productId === 'etiqa-invest-smart-vista'
    || productId === 'etiqa-invest-flex-wealth-ii'
    || productId === 'etiqa-invest-wealth-purpose'
    || productId === 'tokio-marine-goassure'
    || productId === 'great-eastern-prestige-legacy-advantage'
    || productId === 'aia-platinum-wealth-elite-2'
    || productId === 'aia-platinum-wealth-legacy'
    || productId === 'manulife-manuinvest-duo'
    || productId === 'manulife-manulink-investor-ii'
    || productId === 'manulife-investready-growth'
    || productId === 'manulife-investready-iii'
    || productId === 'manulife-investready-iii-sep-2025'
}

function supportsManualCurrentTiClaimBenefitAmount(productId?: string): boolean {
  return supportsManualCurrentResidualDeathBenefitAfterTiClaim(productId)
    || supportsCurrentSettledTiClaimTermination(productId)
}

function supportsDerivedCurrentTiClaimBenefitAmount(productId?: string): boolean {
  return productId === 'hsbc-life-flexi-protector'
}

function supportsCurrentAdmittedTiAccidentalDeathContinuation(productId?: string): boolean {
  return productId?.startsWith('hsbc-life-wealth-focus-flexi-') ?? false
}

function supportsCurrentAdmittedTpdClaimState(productId?: string): boolean {
  return productId === 'great-eastern-great-life-advantage-4'
    || productId === 'manulife-manuinvest-duo'
}

function supportsManualCurrentTpdClaimBenefitAmount(productId?: string): boolean {
  return supportsCurrentAdmittedTpdClaimState(productId)
    || supportsCurrentSettledTpdClaimTermination(productId)
}

function supportsCurrentSettledTpdClaimTermination(productId?: string): boolean {
  return productId === 'great-eastern-great-life-advantage-4'
    || productId === 'great-eastern-wealth-advantage-4'
    || productId === 'great-eastern-investment-linked-insurance-plan-2'
}

function isCurrentTpdClaimStatusActive(
  status: IlpClaimProfile['currentTpdClaimStatus'],
): boolean {
  return status === 'triggered'
    || status === 'admitted'
    || status === 'admitted-and-settled'
}

function hasActiveCurrentLapse(input: IlpPolicyInput): boolean {
  const currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0

  return currentPolicyMonth > 0 && (input.policyEvents ?? []).some((event) => (
    event.type === 'lapse'
    && currentPolicyMonth >= event.startPolicyMonth
    && currentPolicyMonth < (event.startPolicyMonth + event.durationMonths)
  ))
}

function supportsCurrentTiClaimIndebtednessOverride(productId?: string): boolean {
  return productId === 'hsbc-life-wealth-harvest'
    || productId === 'hsbc-life-wealth-abundance'
    || productId === 'hsbc-life-wealth-voyage'
    || productId === 'hsbc-life-wealth-accelerate'
    || productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    || productId === 'manulife-investready-growth'
    || productId === 'manulife-investready-iii'
    || productId === 'manulife-investready-iii-sep-2025'
}

function resolveCurrentTiClaimIndebtedness(input: IlpPolicyInput): number | undefined {
  if (!supportsCurrentTiClaimIndebtednessOverride(input.catalogSource?.productId)) {
    return undefined
  }

  if (input.claimProfile?.currentIndebtedness != null) {
    return Math.max(0, input.claimProfile.currentIndebtedness)
  }

  if (input.assuranceProfile?.currentAmountOwing != null) {
    return Math.max(0, input.assuranceProfile.currentAmountOwing)
  }

  return undefined
}

function computeCurrentDeathBenefitAtTiClaim(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  const productId = input.catalogSource?.productId
  if (!supportsCurrentTiClaimIndebtednessOverride(productId)) {
    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  const claimTimeIndebtedness = resolveCurrentTiClaimIndebtedness(input)
  if (claimTimeIndebtedness == null) {
    return undefined
  }

  const currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0

  if (productId?.startsWith('hsbc-life-wealth-focus-flexi-')) {
    const regularProtectedFloor = resolveCurrentHsbcRegularProtectedFloor(input, currentPolicyMonth)
    if (regularProtectedFloor == null) {
      return undefined
    }

    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)

    return Math.max(
      0,
      Math.max(
        totalCurrentValue,
        topUpAccountValue + Math.max(regularAccountValue, regularProtectedFloor),
      ) - claimTimeIndebtedness,
    )
  }

  if (productId === 'hsbc-life-wealth-abundance' || productId === 'hsbc-life-wealth-voyage') {
    const regularProtectedFloor = resolveCurrentHsbcRegularProtectedFloor(input, currentPolicyMonth)
    if (regularProtectedFloor == null) {
      return undefined
    }

    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)

    return Math.max(
      0,
      (topUpAccountValue + Math.max(regularAccountValue, regularProtectedFloor)) - claimTimeIndebtedness,
    )
  }

  if (productId === 'hsbc-life-wealth-accelerate') {
    const profile = input.assuranceProfile
    if (profile?.currentAgeNextBirthday == null || currentPolicyMonth <= 18) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const adHocTopUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const recurringSinglePremiumAmount = currentPolicyMonth > 0
      ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
      : 0
    const baseBenefit = totalCurrentValue * 1.01

    if (profile.currentAgeNextBirthday >= 66) {
      return Math.max(0, baseBenefit - claimTimeIndebtedness)
    }

    const enhancedBase = Math.max(
      0,
      totalCurrentValue - adHocTopUpAmount - recurringSinglePremiumAmount,
    )
    const enhancedCap = input.currency === 'USD' ? 350_000 : 500_000
    const upliftBenefit = Math.min(enhancedBase * 0.15, enhancedCap)

    return Math.max(0, baseBenefit + upliftBenefit - claimTimeIndebtedness)
  }

  if (productId === 'hsbc-life-wealth-harvest') {
    return Math.max(0, (totalCurrentValue * 1.02) - claimTimeIndebtedness)
  }

  if (
    productId === 'manulife-investready-growth'
    || productId === 'manulife-investready-iii'
    || productId === 'manulife-investready-iii-sep-2025'
  ) {
    const profile = input.assuranceProfile
    if (
      profile?.currentNetRegularPremiumBase == null
      || profile.currentNetSupplementaryPremiumBase == null
    ) {
      return undefined
    }

    const protectedBase = Math.max(
      0,
      profile.currentNetRegularPremiumBase + profile.currentNetSupplementaryPremiumBase,
    )

    return Math.max(
      0,
      Math.max(
        totalCurrentValue,
        protectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
      ) - claimTimeIndebtedness,
    )
  }

  return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
}

function applyCurrentAdmittedTiClaimState(
  input: IlpPolicyInput,
  summary: IlpSummaryMetrics,
  currentValueByAccount: Map<string, number>,
): IlpSummaryMetrics {
  const currentTiClaimStatus = input.claimProfile?.currentTiClaimStatus
  const productId = input.catalogSource?.productId
  if (
    !isCurrentTiClaimStatusActive(currentTiClaimStatus)
    || !supportsCurrentAdmittedTiClaimState(productId)
  ) {
    return summary
  }

  if (hasActiveCurrentLapse(input)) {
    return summary
  }

  if (
    currentTiClaimStatus === 'admitted-and-settled'
    && supportsCurrentSettledTiClaimTermination(productId)
  ) {
    return {
      ...summary,
      currentDeathBenefitEstimate: 0,
      currentAccidentalDeathBenefitEstimate: undefined,
      currentTiBenefitEstimate: undefined,
      currentResidualDeathBenefitAfterTiEstimate: undefined,
    }
  }

  const manualResidualDeathBenefitAfterTiClaim = supportsManualCurrentResidualDeathBenefitAfterTiClaim(
    productId,
  ) && input.claimProfile?.currentResidualDeathBenefitAfterTiClaim != null
    ? Math.max(0, input.claimProfile.currentResidualDeathBenefitAfterTiClaim)
    : undefined
  const claimHistoryResidualDeathBenefitAfterTiClaim = supportsClaimHistoryProtectedDeathCoverBase(productId)
    ? computeCurrentDeathBenefitFromClaimHistoryProtectedBase(input, currentValueByAccount)
    : undefined
  const manualCurrentTiClaimBenefitAmount = (
    (currentTiClaimStatus === 'triggered' || currentTiClaimStatus === 'admitted')
    && supportsManualCurrentTiClaimBenefitAmount(productId)
    && input.claimProfile?.currentTiClaimBenefitAmount != null
  )
    ? Math.max(0, input.claimProfile.currentTiClaimBenefitAmount)
    : undefined
  const derivedCurrentTiClaimBenefitAmount = (
    currentTiClaimStatus === 'triggered'
    || currentTiClaimStatus === 'admitted'
  ) && supportsDerivedCurrentTiClaimBenefitAmount(productId)
    ? summary.currentTiBenefitEstimate
    : undefined
  const currentDeathBenefitEstimate = supportsManualCurrentResidualDeathBenefitAfterTiClaim(
    productId,
  )
    ? (claimHistoryResidualDeathBenefitAfterTiClaim ?? manualResidualDeathBenefitAfterTiClaim)
    : summary.currentResidualDeathBenefitAfterTiEstimate
  const currentTiBenefitEstimate = manualCurrentTiClaimBenefitAmount ?? derivedCurrentTiClaimBenefitAmount

  if (
    supportsCurrentSettledTiClaimTermination(productId)
    && !supportsManualCurrentResidualDeathBenefitAfterTiClaim(productId)
  ) {
    return {
      ...summary,
      currentDeathBenefitEstimate: 0,
      currentAccidentalDeathBenefitEstimate: undefined,
      currentTiBenefitEstimate,
      currentResidualDeathBenefitAfterTiEstimate: undefined,
    }
  }

  return {
    ...summary,
    currentDeathBenefitEstimate,
    currentAccidentalDeathBenefitEstimate: supportsCurrentAdmittedTiAccidentalDeathContinuation(productId)
      ? currentDeathBenefitEstimate
      : undefined,
    currentTiBenefitEstimate,
    currentResidualDeathBenefitAfterTiEstimate: undefined,
  }
}

function applyCurrentAdmittedTpdClaimState(
  input: IlpPolicyInput,
  summary: IlpSummaryMetrics,
): IlpSummaryMetrics {
  const currentTpdClaimStatus = input.claimProfile?.currentTpdClaimStatus
  const productId = input.catalogSource?.productId

  if (!isCurrentTpdClaimStatusActive(currentTpdClaimStatus)) {
    return summary
  }

  if (hasActiveCurrentLapse(input)) {
    return summary
  }

  const isSettledTerminationState = supportsCurrentSettledTpdClaimTermination(productId)
    && (
      productId !== 'great-eastern-great-life-advantage-4'
      || input.claimProfile?.currentTpdContinuationEventStatus !== 'triggered'
    )

  const manualCurrentTpdClaimBenefitAmount = (
    (currentTpdClaimStatus === 'triggered' || currentTpdClaimStatus === 'admitted')
    && supportsManualCurrentTpdClaimBenefitAmount(productId)
    && input.claimProfile?.currentTpdClaimBenefitAmount != null
  )
    ? Math.max(0, input.claimProfile.currentTpdClaimBenefitAmount)
    : undefined

  if (isSettledTerminationState) {
    if (currentTpdClaimStatus !== 'admitted-and-settled') {
      return {
        ...summary,
        currentDeathBenefitEstimate: 0,
        currentAccidentalDeathBenefitEstimate: undefined,
        currentTiBenefitEstimate: undefined,
        currentTpdBenefitEstimate: manualCurrentTpdClaimBenefitAmount,
        currentTiBenefitAfterTpdEstimate: undefined,
        currentResidualDeathBenefitAfterTpdEstimate: undefined,
      }
    }

    return {
      ...summary,
      currentDeathBenefitEstimate: 0,
      currentAccidentalDeathBenefitEstimate: undefined,
      currentTiBenefitEstimate: undefined,
      currentTpdBenefitEstimate: undefined,
      currentTiBenefitAfterTpdEstimate: undefined,
      currentResidualDeathBenefitAfterTpdEstimate: undefined,
    }
  }

  if (!supportsCurrentAdmittedTpdClaimState(productId)) {
    return summary
  }

  return {
    ...summary,
    currentDeathBenefitEstimate: summary.currentResidualDeathBenefitAfterTpdEstimate,
    currentTiBenefitEstimate: summary.currentTiBenefitAfterTpdEstimate,
    currentTpdBenefitEstimate: manualCurrentTpdClaimBenefitAmount,
    currentTiBenefitAfterTpdEstimate: undefined,
    currentResidualDeathBenefitAfterTpdEstimate: undefined,
  }
}

interface IlpRepaymentEvent {
  type: 'premium-holiday-repayment' | 'policy-repayment'
  startPolicyMonth: number
  durationMonths: number
  amount: number
  accountId?: string
  sourceEventId?: string
}

interface IlpExcludedValueContribution {
  accountId: string
  startPolicyMonth: number
  amount: number
  expiryPolicyMonth: number | null
}

interface IlpExcludedValueCohort {
  balance: number
  expiryPolicyMonth: number | null
}

interface IlpPreservedValueContribution {
  accountId: string
  startPolicyMonth: number
  amount: number
}

interface IlpPreservedValueCohort {
  balance: number
}

interface IlpAssuranceStateResult {
  sumAssured: number | undefined
  wealthAssureValue: number | undefined
  growthFrozen: boolean
}

type IlpRecurringContributionPhase = Extract<IlpContributionRule['phase'], 'during-icp' | 'after-icp' | 'after-mip'>
type IlpProjectionYearRange = IlpCashflowYearContext['range']

function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${String(value)}`)
}

interface IlpCashflowYearContext {
  projectionYear: number
  policyYear: number
  isPostMip: boolean
  range: {
    startPolicyMonth: number
    endPolicyMonth: number
  }
  premiumHolidayMonths: number
  payableMonths: number
  paymentHistory: {
    premiumYearAtStart: number
    premiumYearAtEnd: number
    premiumsPaidUpToDate: boolean
  }
}

interface IlpBonusEligibilityMetrics {
  policyYearGrowthMeasure?: {
    currentYearEndValueBeforeBonus: number
    effectiveChargesThisYear: number
    priorYearEndValueAfterPriorBonus: number
    regularPremiumReceivedThisYear: number
  }
  cumulativeEffectiveAccountValueRatio?: {
    effectiveAccountValueAtReferencePoint: number
    cumulativePremiumsPaid: number
    cumulativeReinvestedDividendWithdrawals: number
  }
}

function buildInitialCumulativeBonusCreditsByBonusId(
  normalized: IlpNormalizedPolicyInput,
): Map<string, number> {
  return new Map(
    normalized.bonuses.rules
      .filter(({ bonus }) => bonus.oneTimePayoutBasis === 'step-up-booster-delta')
      .map(({ bonus }) => [bonus.id, 0]),
  )
}

interface IlpNormalizedContributionRoute {
  accountId: string
  phase: IlpContributionRule['phase']
  share: number
}

interface IlpNormalizedRecurringChargeRule {
  rule: IlpChargeRule
  appliesTo: IlpAccount[]
  fallbackAppliesTo: IlpAccount[]
}

interface IlpNormalizedEventChargeRule {
  rule: IlpEventChargeRule
  events: Array<IlpPolicyEvent | IlpRepaymentEvent>
}

type IlpAssuranceFormulaFamily =
  | 'prudential-prosper'
  | 'prudential-assure-ii'
  | 'prudential-linkguard'
  | 'aia-plp2'
  | 'aia-pro-achiever-3'
  | 'aia-venture'
  | 'hsbc-flexi'
  | 'protected-base-paid-premium-floor'
  | 'protected-base-paid-premium-floor-with-repayment'
  | 'protected-base-sum-assured'
  | 'protected-base-basic-sum-assured-with-topups'
  | 'manulife-smartretire-death'
  | 'manulife-smartretire-wop-tpd'
  | 'tokio-mpc-net-premium-floor'
  | 'tokio-mpc-locked-in-policy-value'
  | 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'

interface IlpTokioProtectionState {
  lockedInPolicyValue: number
  adjustedSinglePremium?: number
}

interface IlpNormalizedAssuranceRule {
  rule: IlpChargeRule & { assuranceConfig: IlpAssuranceChargeConfig }
  family: IlpAssuranceFormulaFamily
  appliesTo: IlpAccount[]
  appliesToIds: string[]
  assuranceValueAppliesTo: IlpAccount[]
  assuranceValueAppliesToIds: string[]
  fallbackAppliesTo: IlpAccount[]
  tokioTrackedValueAccountIds: string[]
  tokioWithdrawalReductionAccountIds: string[]
}

interface IlpNormalizedAssuranceKernel {
  profile?: IlpAssuranceProfile
  rules: IlpNormalizedAssuranceRule[]
  relevantAccountIds: string[]
  stateEvents: IlpPolicyEvent[]
}

interface IlpNormalizedMultiAccountStructure {
  regularPremiumAccountIds: string[]
  supplementaryPremiumAccountIds: string[]
  repaymentAccountIds: string[]
  fallbackDeductionOrderIds: string[]
  withdrawalChargeScopeAccountIds: string[]
}

type IlpNormalizedBonusTierBasis =
  | 'flat'
  | 'annual-premium'
  | 'sum-assured'
  | 'sum-assured-multiple'
  | 'account-value'
  | 'annual-premium-and-sum-assured-multiple'
  | 'annual-premium-and-account-value'
  | 'sum-assured-and-account-value'

interface IlpNormalizedBonusRule {
  bonus: IlpBonusRule
  targetAccountIds: string[]
  tierBasis: IlpNormalizedBonusTierBasis
  suspensionTriggers: IlpBonusSuspensionRule['trigger'][]
  restorationTriggers: IlpBonusRestorationRule['trigger'][]
  excludedValueTriggers: IlpBonusExcludedValueRule['trigger'][]
}

interface IlpNormalizedBonusKernel {
  rules: IlpNormalizedBonusRule[]
}

interface IlpNormalizedPolicyEvents {
  premiumHolidays: IlpPolicyEvent[]
  lapses: IlpPolicyEvent[]
  partialWithdrawals: IlpPolicyEvent[]
  reinvestedDividendWithdrawals: IlpPolicyEvent[]
  regularPremiumReductions: IlpPolicyEvent[]
  regularPremiumIncreases: IlpPolicyEvent[]
  policyRepayments: IlpPolicyEvent[]
  topUps: IlpPolicyEvent[]
  recurringSinglePremiums: IlpPolicyEvent[]
  recurringSinglePremiumResumptions: IlpPolicyEvent[]
  assuranceStateEvents: IlpPolicyEvent[]
}

interface IlpInitialSinglePremiumState {
  appliesAtProjectionStart: boolean
  grossContributionByAccount: Map<string, number>
  chargeByAccount: Map<string, number>
  netContributionByAccount: Map<string, number>
  totalGrossContribution: number
  totalCharge: number
}

interface IlpNormalizedPolicyInput {
  input: IlpPolicyInput
  contributionRoutesByPhase: Record<IlpContributionRule['phase'], IlpNormalizedContributionRoute[]>
  assurance: IlpNormalizedAssuranceKernel
  bonuses: IlpNormalizedBonusKernel
  multiAccount: IlpNormalizedMultiAccountStructure
  events: IlpNormalizedPolicyEvents
  regularPremiums: {
    committedAnnualPremiumAtIssue: number
    paidByPolicyMonth: Map<number, number>
    cumulativePaidByPolicyMonth: Map<number, number>
    premiumYearByPolicyMonth: Map<number, number>
    paidUpToDateByPolicyMonth: Map<number, boolean>
    arrearsByPolicyMonth: Map<number, number>
  }
}

function getMipBasis(input: Pick<IlpPolicyInput, 'mipBasis'>): 'finite' | 'open-ended' {
  return input.mipBasis ?? 'finite'
}

function getRegularPremiumPaymentFrequency(
  input: Pick<IlpPolicyInput, 'regularPremiumPaymentFrequency'>,
): IlpRegularPremiumPaymentFrequency {
  return input.regularPremiumPaymentFrequency ?? 'monthly'
}

function getRegularPremiumPaymentFrequencyMultiplier(
  frequency: IlpRegularPremiumPaymentFrequency,
): number {
  switch (frequency) {
    case 'annual':
      return 1
    case 'semi-annual':
      return 2
    case 'quarterly':
      return 4
    case 'monthly':
      return 12
  }
}

function getMinimumAnnualRegularPremiumAtFrequency(
  input: Pick<IlpPolicyInput, 'policyStateSupport' | 'regularPremiumPaymentFrequency'>,
): number | undefined {
  const frequency = getRegularPremiumPaymentFrequency(input)
  const minimumPremiumAmount = input.policyStateSupport?.minimumRegularPremiumAmountByFrequency?.[frequency]
  if (minimumPremiumAmount == null) return undefined

  return minimumPremiumAmount * getRegularPremiumPaymentFrequencyMultiplier(frequency)
}

function getExitChargeBasis(
  input: Pick<IlpPolicyInput, 'exitChargeBasis'>,
): 'account-value' | 'initial-single-premium-base' {
  return input.exitChargeBasis ?? 'account-value'
}

function startsAtProjectionInception(
  input: Pick<IlpPolicyInput, 'currentPolicyYear' | 'monthsAlreadyPaid' | 'initialSinglePremium'>,
): boolean {
  return (input.initialSinglePremium ?? 0) > CONTRIBUTION_TOLERANCE
    && input.currentPolicyYear === 1
    && input.monthsAlreadyPaid === 0
}

function hasFiniteMip(input: Pick<IlpPolicyInput, 'mipBasis' | 'mipLength'>): input is Pick<IlpPolicyInput, 'mipBasis'> & { mipLength: number } {
  return getMipBasis(input) === 'finite' && input.mipLength != null
}

export function isProjectedAnalysisEligible(
  input: Pick<IlpPolicyInput, 'currentPolicyYear' | 'mipBasis' | 'mipLength'>,
): boolean {
  return !hasFiniteMip(input) || input.currentPolicyYear < input.mipLength
}

function isPostMipPolicyYear(
  input: Pick<IlpPolicyInput, 'mipBasis' | 'mipLength'>,
  policyYear: number,
): boolean {
  return hasFiniteMip(input) && policyYear > input.mipLength
}

function assertBeforeMip(input: IlpPolicyInput) {
  if (hasFiniteMip(input) && input.currentPolicyYear >= input.mipLength) {
    throw new Error(
      `Cannot analyze ILP policy "${input.name}": current policy year ${input.currentPolicyYear} is already at or past MIP ${input.mipLength}.`,
    )
  }
}

function getScenarioGrossReturn(fund: IlpFund, scenario: ReturnScenario): number {
  switch (scenario) {
    case 'low':
      return fund.grossReturnLow
    case 'high':
      return fund.grossReturnHigh
    default:
      return fund.grossReturnMid
  }
}

function getTargetAccountIds(bonus: IlpBonusRule, allAccountIds: string[]): string[] {
  return bonus.appliesTo.length > 0 ? bonus.appliesTo : allAccountIds
}

function getProjectionMonthRange(
  input: IlpPolicyInput,
  projectionYear: number,
): { startPolicyMonth: number, endPolicyMonth: number } {
  return {
    startPolicyMonth: input.monthsAlreadyPaid + ((projectionYear - 1) * 12) + 1,
    endPolicyMonth: input.monthsAlreadyPaid + (projectionYear * 12),
  }
}

function sortPolicyEvents(events: IlpPolicyEvent[]): IlpPolicyEvent[] {
  return [...events].sort((left, right) => left.startPolicyMonth - right.startPolicyMonth)
}

function uniqueAccountIdsInDisplayOrder(
  accounts: IlpAccount[],
  accountIds: string[],
): string[] {
  const uniqueIds = new Set(accountIds)
  return accounts
    .map((account) => account.id)
    .filter((accountId) => uniqueIds.has(accountId))
}

function resolveAccountsInDisplayOrder(
  input: IlpPolicyInput,
  accountIds: string[],
): IlpAccount[] {
  const orderedIds = uniqueAccountIdsInDisplayOrder(input.accounts, accountIds)
  return orderedIds
    .map((accountId) => input.accounts.find((account) => account.id === accountId))
    .filter((account): account is IlpAccount => Boolean(account))
}

function buildNormalizedMultiAccountStructure(
  input: IlpPolicyInput,
  contributionRoutesByPhase: Record<IlpContributionRule['phase'], IlpNormalizedContributionRoute[]>,
): IlpNormalizedMultiAccountStructure {
  const regularPremiumAccountIds = uniqueAccountIdsInDisplayOrder(
    input.accounts,
    [
      ...contributionRoutesByPhase['during-icp'].map((route) => route.accountId),
      ...contributionRoutesByPhase['after-icp'].map((route) => route.accountId),
      ...contributionRoutesByPhase['after-mip'].map((route) => route.accountId),
    ],
  )
  const supplementaryPremiumAccountIds = uniqueAccountIdsInDisplayOrder(
    input.accounts,
    contributionRoutesByPhase['top-up'].map((route) => route.accountId),
  )
  const repaymentAccountIds = uniqueAccountIdsInDisplayOrder(
    input.accounts,
    [
      ...(input.policyEvents ?? [])
        .map((event) => event.repaymentAccountId)
        .filter((accountId): accountId is string => Boolean(accountId)),
      ...regularPremiumAccountIds,
    ],
  )
  const fallbackDeductionOrderIds = uniqueAccountIdsInDisplayOrder(
    input.accounts,
    [
      ...(input.chargeRules ?? []).flatMap((rule) => rule.fallbackAppliesTo ?? []),
      ...(input.eventChargeRules ?? []).flatMap((rule) => rule.fallbackAppliesTo ?? []),
    ],
  )
  const withdrawalChargeScopeAccountIds = uniqueAccountIdsInDisplayOrder(
    input.accounts,
    (input.eventChargeRules ?? [])
      .filter((rule) => rule.trigger === 'partial-withdrawal')
      .flatMap((rule) => rule.appliesTo),
  )
  return {
    regularPremiumAccountIds,
    supplementaryPremiumAccountIds,
    repaymentAccountIds,
    fallbackDeductionOrderIds,
    withdrawalChargeScopeAccountIds,
  }
}

function resolveSupplementaryContributionRoutes(
  normalized: IlpNormalizedPolicyInput,
): IlpNormalizedContributionRoute[] {
  return normalized.contributionRoutesByPhase['top-up']
    .filter((route) => normalized.multiAccount.supplementaryPremiumAccountIds.includes(route.accountId))
}

function resolveFallbackAccounts(
  normalized: IlpNormalizedPolicyInput,
  explicitFallbackAccountIds?: string[],
): IlpAccount[] {
  if (!explicitFallbackAccountIds || explicitFallbackAccountIds.length === 0) {
    return []
  }

  const orderedFallbackIds = normalized.multiAccount.fallbackDeductionOrderIds
    .filter((accountId) => explicitFallbackAccountIds.includes(accountId))
  const trailingExplicitIds = explicitFallbackAccountIds
    .filter((accountId) => !orderedFallbackIds.includes(accountId))

  return resolveAccountsInDisplayOrder(normalized.input, [...orderedFallbackIds, ...trailingExplicitIds])
}

function resolveWithdrawalChargeAccounts(
  normalized: IlpNormalizedPolicyInput,
  rule: IlpEventChargeRule,
  event: IlpPolicyEvent | IlpRepaymentEvent,
): IlpAccount[] {
  if (rule.trigger !== 'partial-withdrawal') {
    return resolveAccountsInDisplayOrder(normalized.input, rule.appliesTo)
  }

  const scopedAccountIds = normalized.multiAccount.withdrawalChargeScopeAccountIds
    .filter((accountId) => rule.appliesTo.includes(accountId))

  if ('accountId' in event && event.accountId) {
    return scopedAccountIds.includes(event.accountId)
      ? resolveAccountsInDisplayOrder(normalized.input, [event.accountId])
      : []
  }

  return resolveAccountsInDisplayOrder(normalized.input, scopedAccountIds)
}

function buildNormalizedAssuranceKernel(
  input: IlpPolicyInput,
): IlpNormalizedAssuranceKernel {
  const rules = (input.chargeRules ?? [])
    .filter((rule): rule is IlpChargeRule & { assuranceConfig: IlpAssuranceChargeConfig } => (
      rule.basis === 'assurance-sum-at-risk' && Boolean(rule.assuranceConfig)
    ))
    .map((rule) => {
      const appliesTo = resolveAccountsInDisplayOrder(input, rule.appliesTo)
      const appliesToIds = appliesTo.map((account) => account.id)
      const assuranceValueAppliesTo = resolveAccountsInDisplayOrder(
        input,
        rule.assuranceValueAppliesTo ?? rule.appliesTo,
      )
      const assuranceValueAppliesToIds = assuranceValueAppliesTo.map((account) => account.id)
      const fallbackAppliesTo = resolveAccountsInDisplayOrder(input, rule.fallbackAppliesTo ?? [])
      const tokioTrackedValueAccountIds = uniqueAccountIdsInDisplayOrder(
        input.accounts,
        rule.assuranceConfig.tokioProtectionState?.trackedValueAccountIds ?? [],
      )
      const tokioWithdrawalReductionAccountIds = uniqueAccountIdsInDisplayOrder(
        input.accounts,
        rule.assuranceConfig.tokioProtectionState?.withdrawalReductionAccountIds ?? [],
      )

      return {
        rule,
        family: getAssuranceFormulaFamily(rule.assuranceConfig),
        appliesTo,
        appliesToIds,
        assuranceValueAppliesTo,
        assuranceValueAppliesToIds,
        fallbackAppliesTo,
        tokioTrackedValueAccountIds,
        tokioWithdrawalReductionAccountIds,
      }
    })
    .filter((normalizedRule) => (
      normalizedRule.appliesTo.length > 0 && normalizedRule.assuranceValueAppliesTo.length > 0
    ))

  return {
    profile: input.assuranceProfile,
    rules,
    relevantAccountIds: uniqueAccountIdsInDisplayOrder(
      input.accounts,
      rules.flatMap((rule) => rule.appliesToIds),
    ),
    stateEvents: sortPolicyEvents((input.policyEvents ?? []).filter((event) => (
      event.type === 'assurance-benefit-reduction' || event.type === 'assurance-benefit-resumption'
    ))),
  }
}

function getBonusTierBasis(bonus: IlpBonusRule): IlpNormalizedBonusTierBasis {
  if (!bonus.tieredRates || bonus.tieredRates.length === 0) {
    return 'flat'
  }

  const usesAnnualPremium = bonus.tieredRates.some((tier) => (
    tier.minAnnualPremium != null || tier.maxAnnualPremium != null
  ))
  const usesSumAssured = bonus.tieredRates.some((tier) => (
    tier.minSumAssured != null || tier.maxSumAssured != null
  ))
  const usesSumAssuredMultiple = bonus.tieredRates.some((tier) => (
    tier.minSumAssuredMultiple != null || tier.maxSumAssuredMultiple != null
  ))
  const usesAccountValue = bonus.tieredRates.some((tier) => (
    tier.minAccountValue != null || tier.maxAccountValue != null
  ))

  if (usesAnnualPremium && usesSumAssuredMultiple) {
    return 'annual-premium-and-sum-assured-multiple'
  }
  if (usesAnnualPremium && usesAccountValue) {
    return 'annual-premium-and-account-value'
  }
  if (usesSumAssured && usesAccountValue) {
    return 'sum-assured-and-account-value'
  }
  if (usesAnnualPremium) {
    return 'annual-premium'
  }
  if (usesSumAssured) {
    return 'sum-assured'
  }
  if (usesSumAssuredMultiple) {
    return 'sum-assured-multiple'
  }
  if (usesAccountValue) {
    return 'account-value'
  }

  return 'flat'
}

function getBonusPrimaryTierInput(
  normalized: Pick<IlpNormalizedPolicyInput, 'regularPremiums' | 'input'>,
  bonus: Pick<IlpBonusRule, 'annualPremiumTierBasis'>,
  paidRegularPremiumThisYear: number,
): number {
  if (bonus.annualPremiumTierBasis === 'initial-basic-sum-assured-multiple-at-issue') {
    const initialBasicSumAssuredAtIssue = normalized.input.assuranceProfile?.initialBasicSumAssuredAtIssue ?? 0
    const committedAnnualPremiumAtIssue = normalized.regularPremiums.committedAnnualPremiumAtIssue

    if (committedAnnualPremiumAtIssue <= CONTRIBUTION_TOLERANCE) {
      return 0
    }

    return initialBasicSumAssuredAtIssue / committedAnnualPremiumAtIssue
  }

  if (bonus.annualPremiumTierBasis === 'initial-basic-sum-assured-at-issue') {
    return normalized.input.assuranceProfile?.initialBasicSumAssuredAtIssue ?? 0
  }

  if (bonus.annualPremiumTierBasis === 'initial-single-premium-at-issue') {
    return normalized.input.initialSinglePremium ?? 0
  }

  return bonus.annualPremiumTierBasis === 'committed-annual-premium-at-issue'
    ? normalized.regularPremiums.committedAnnualPremiumAtIssue
    : paidRegularPremiumThisYear
}

function getBonusAnnualPremiumTierInput(
  normalized: Pick<IlpNormalizedPolicyInput, 'regularPremiums'>,
  bonus: Pick<IlpBonusRule, 'annualPremiumTierBasis'>,
  paidRegularPremiumThisYear: number,
): number {
  if (
    bonus.annualPremiumTierBasis === 'committed-annual-premium-at-issue'
    || bonus.annualPremiumTierBasis === 'initial-basic-sum-assured-multiple-at-issue'
  ) {
    return normalized.regularPremiums.committedAnnualPremiumAtIssue
  }

  return paidRegularPremiumThisYear
}

function buildNormalizedBonusKernel(
  input: IlpPolicyInput,
): IlpNormalizedBonusKernel {
  const allAccountIds = input.accounts.map((account) => account.id)

  return {
    rules: input.bonuses.map((bonus) => ({
      bonus,
      targetAccountIds: getTargetAccountIds(bonus, allAccountIds),
      tierBasis: getBonusTierBasis(bonus),
      suspensionTriggers: [...new Set((bonus.suspensionRules ?? []).map((rule) => rule.trigger))],
      restorationTriggers: [...new Set((bonus.restorationRules ?? []).map((rule) => rule.trigger))],
      excludedValueTriggers: [...new Set((bonus.excludedValueRules ?? []).map((rule) => rule.trigger))],
    })),
  }
}

function isPremiumHolidayActiveAtMonth(
  normalized: Pick<IlpNormalizedPolicyInput, 'events'>,
  policyMonth: number,
): boolean {
  return normalized.events.premiumHolidays.some((event) => (
    policyMonth >= event.startPolicyMonth
    && policyMonth < (event.startPolicyMonth + event.durationMonths)
  ))
}

function isLapseActiveAtMonth(
  normalized: Pick<IlpNormalizedPolicyInput, 'events'>,
  policyMonth: number,
): boolean {
  return normalized.events.lapses.some((event) => (
    policyMonth >= event.startPolicyMonth
    && policyMonth < (event.startPolicyMonth + event.durationMonths)
  ))
}

function isLapseActiveForEntireRange(
  normalized: Pick<IlpNormalizedPolicyInput, 'events'>,
  range: IlpProjectionYearRange,
): boolean {
  return Array.from(
    { length: range.endPolicyMonth - range.startPolicyMonth + 1 },
    (_, index) => range.startPolicyMonth + index,
  ).every((policyMonth) => isLapseActiveAtMonth(normalized, policyMonth))
}

function buildNormalizedRegularPremiumState(
  normalized: Pick<IlpNormalizedPolicyInput, 'input' | 'events' | 'contributionRoutesByPhase'>,
): IlpNormalizedPolicyInput['regularPremiums'] {
  const maxPolicyMonth = normalized.input.monthsAlreadyPaid + (computeTotalProjectionYears(normalized.input) * 12)
  const currentPolicyMonth = Math.max(0, normalized.input.monthsAlreadyPaid)
  const paidByPolicyMonth = new Map<number, number>()
  const cumulativePaidByPolicyMonth = new Map<number, number>()
  const premiumYearByPolicyMonth = new Map<number, number>()
  const paidUpToDateByPolicyMonth = new Map<number, boolean>()
  const arrearsByPolicyMonth = new Map<number, number>()
  const repaymentByPolicyMonth = new Map<number, number>()
  let cumulativePaid = 0
  let arrears = 0
  const hasAcceptedPremiumSeed = supportsAcceptedRegularPremiumMonthSeed(normalized.input)
    && normalized.input.currentAcceptedRegularPremiumMonths != null
    && normalized.input.monthlyContribution > CONTRIBUTION_TOLERANCE
  let seededAcceptedPremiumMonths = hasAcceptedPremiumSeed
    ? Math.max(
      0,
      Math.min(
        currentPolicyMonth,
        normalized.input.currentAcceptedRegularPremiumMonths ?? 0,
      ),
    )
    : null

  for (const event of normalized.events.premiumHolidays) {
    if (!event.repayMissedPremiums) continue
    const repaymentMonth = event.startPolicyMonth + event.durationMonths
    const repaymentAmount = Array.from({ length: event.durationMonths }, (_, index) => (
      getScheduledMonthlyPremiumAtMonth(normalized as IlpNormalizedPolicyInput, event.startPolicyMonth + index)
    )).reduce((sum, value) => sum + value, 0)

    repaymentByPolicyMonth.set(
      repaymentMonth,
      (repaymentByPolicyMonth.get(repaymentMonth) ?? 0) + repaymentAmount,
    )
  }

  for (let policyMonth = 1; policyMonth <= maxPolicyMonth; policyMonth += 1) {
    const policyYear = getPolicyYearForMonth(policyMonth)
    const regularPremiumIsPayable = getMipBasis(normalized.input) === 'open-ended'
      || (hasFiniteMip(normalized.input) && policyYear <= normalized.input.mipLength)
      || hasAfterMipContributionRules(normalized.input)
    const scheduledMonthlyPremium = regularPremiumIsPayable
      ? getScheduledMonthlyPremiumAtMonth(normalized as IlpNormalizedPolicyInput, policyMonth)
      : 0
    const actualPaid = !regularPremiumIsPayable || isPremiumHolidayActiveAtMonth(normalized, policyMonth)
      ? 0
      : scheduledMonthlyPremium
    const repaymentAmount = repaymentByPolicyMonth.get(policyMonth) ?? 0

    cumulativePaid += actualPaid
    arrears = Math.max(0, arrears + scheduledMonthlyPremium - actualPaid - repaymentAmount)
    paidByPolicyMonth.set(policyMonth, actualPaid)
    cumulativePaidByPolicyMonth.set(policyMonth, cumulativePaid)
    if (seededAcceptedPremiumMonths != null) {
      if (
        policyMonth > currentPolicyMonth
        && regularPremiumIsPayable
        && !isPremiumHolidayActiveAtMonth(normalized, policyMonth)
        && actualPaid > CONTRIBUTION_TOLERANCE
      ) {
        seededAcceptedPremiumMonths += 1
      }

      premiumYearByPolicyMonth.set(
        policyMonth,
        Math.ceil(
          (
            policyMonth <= currentPolicyMonth
              ? Math.min(policyMonth, seededAcceptedPremiumMonths)
              : seededAcceptedPremiumMonths
          ) / 12,
        ),
      )
    } else {
      premiumYearByPolicyMonth.set(
        policyMonth,
        normalized.input.monthlyContribution > CONTRIBUTION_TOLERANCE
          ? Math.ceil(cumulativePaid / (normalized.input.monthlyContribution * 12))
          : 0,
      )
    }
    paidUpToDateByPolicyMonth.set(policyMonth, arrears <= CONTRIBUTION_TOLERANCE)
    arrearsByPolicyMonth.set(policyMonth, arrears)
  }

  return {
    committedAnnualPremiumAtIssue: normalized.input.monthlyContribution * 12,
    paidByPolicyMonth,
    cumulativePaidByPolicyMonth,
    premiumYearByPolicyMonth,
    paidUpToDateByPolicyMonth,
    arrearsByPolicyMonth,
  }
}

function supportsAcceptedRegularPremiumMonthSeed(
  input: Pick<IlpPolicyInput, 'catalogSource'>,
): boolean {
  return input.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
    || input.catalogSource?.productId === 'aia-platinum-retirement-elite'
    || input.catalogSource?.productId === 'aia-pro-lifetime-protector-ii'
    || input.catalogSource?.productId === 'aia-wealth-venture'
    || input.catalogSource?.productId === 'aia-platinum-wealth-venture-2'
}

function buildNormalizedPolicyInput(input: IlpPolicyInput): IlpNormalizedPolicyInput {
  const policyEvents = input.policyEvents ?? []
  const minimumRegularPremiumVariationStartPolicyMonth = input.policyStateSupport?.minimumRegularPremiumVariationStartPolicyMonth
  const premiumHolidays = sortPolicyEvents(policyEvents.filter((event) => (
    event.type === 'premium-holiday'
    && !(
      input.policyStateSupport?.minimumPremiumHolidayStartPolicyMonth != null
      && event.startPolicyMonth < input.policyStateSupport.minimumPremiumHolidayStartPolicyMonth
    )
  )))
  const rawRegularPremiumReductions = sortPolicyEvents(policyEvents.filter((event) => (
    event.type === 'regular-premium-reduction'
    && !(
      minimumRegularPremiumVariationStartPolicyMonth != null
      && event.startPolicyMonth < minimumRegularPremiumVariationStartPolicyMonth
    )
    && !(
      input.policyStateSupport?.blockRegularPremiumVariationDuringPremiumHoliday === true
      && premiumHolidays.some((holiday) => (
        event.startPolicyMonth >= holiday.startPolicyMonth
        && event.startPolicyMonth < (holiday.startPolicyMonth + holiday.durationMonths)
      ))
    )
  )))
  const rawRegularPremiumIncreases = sortPolicyEvents(policyEvents.filter((event) => (
    event.type === 'regular-premium-increase'
    && !(
      minimumRegularPremiumVariationStartPolicyMonth != null
      && event.startPolicyMonth < minimumRegularPremiumVariationStartPolicyMonth
    )
    && !(
      input.policyStateSupport?.blockRegularPremiumVariationDuringPremiumHoliday === true
      && premiumHolidays.some((holiday) => (
        event.startPolicyMonth >= holiday.startPolicyMonth
        && event.startPolicyMonth < (holiday.startPolicyMonth + holiday.durationMonths)
      ))
    )
  )))
  const rawTopUps = sortPolicyEvents(policyEvents.filter((event) => event.type === 'top-up'))
  const contributionRoutesByPhase = {
    'during-icp': normalizeContributionRoutes(input, 'during-icp'),
    'after-icp': normalizeContributionRoutes(input, 'after-icp'),
    'after-mip': normalizeContributionRoutes(input, 'after-mip'),
    'top-up': normalizeContributionRoutes(input, 'top-up'),
  } satisfies Record<IlpContributionRule['phase'], IlpNormalizedContributionRoute[]>

  const normalized = {
    input,
    contributionRoutesByPhase,
    assurance: buildNormalizedAssuranceKernel(input),
    bonuses: buildNormalizedBonusKernel(input),
    multiAccount: buildNormalizedMultiAccountStructure(input, contributionRoutesByPhase),
    events: {
      premiumHolidays,
      lapses: sortPolicyEvents(policyEvents.filter((event) => event.type === 'lapse')),
      partialWithdrawals: sortPolicyEvents(policyEvents.filter((event) => event.type === 'partial-withdrawal')),
      reinvestedDividendWithdrawals: sortPolicyEvents(policyEvents.filter((event) => event.type === 'reinvested-dividend-withdrawal')),
      regularPremiumReductions: [],
      regularPremiumIncreases: [],
      policyRepayments: sortPolicyEvents(policyEvents.filter((event) => event.type === 'policy-repayment')),
      topUps: rawTopUps,
      recurringSinglePremiums: sortPolicyEvents(policyEvents.filter((event) => event.type === 'recurring-single-premium')),
      recurringSinglePremiumResumptions: sortPolicyEvents(policyEvents.filter((event) => event.type === 'recurring-single-premium-resumption')),
      assuranceStateEvents: sortPolicyEvents(policyEvents.filter((event) => (
        event.type === 'assurance-benefit-reduction' || event.type === 'assurance-benefit-resumption'
      ))),
    },
    regularPremiums: {
      committedAnnualPremiumAtIssue: input.monthlyContribution * 12,
      paidByPolicyMonth: new Map<number, number>(),
      cumulativePaidByPolicyMonth: new Map<number, number>(),
      premiumYearByPolicyMonth: new Map<number, number>(),
      paidUpToDateByPolicyMonth: new Map<number, boolean>(),
      arrearsByPolicyMonth: new Map<number, number>(),
    },
  } satisfies IlpNormalizedPolicyInput

  const normalizedRegularPremiumVariationEvents = normalizeRegularPremiumVariationEvents(
    normalized,
    rawRegularPremiumReductions,
    rawRegularPremiumIncreases,
  )
  normalized.events.regularPremiumReductions = normalizedRegularPremiumVariationEvents.regularPremiumReductions
  normalized.events.regularPremiumIncreases = normalizedRegularPremiumVariationEvents.regularPremiumIncreases
  normalized.regularPremiums = buildNormalizedRegularPremiumState(normalized)
  normalized.events.topUps = rawTopUps.filter((event) => !(
    (
      input.policyStateSupport?.minimumTopUpStartPolicyMonth != null
      && event.startPolicyMonth < input.policyStateSupport.minimumTopUpStartPolicyMonth
    )
    || (
      input.policyStateSupport?.topUpRepaymentClearance != null
      && getTopUpRepaymentOutstandingAtMonth(
        normalized,
        event.startPolicyMonth,
        input.policyStateSupport.topUpRepaymentClearance,
      ) > CONTRIBUTION_TOLERANCE
    )
    || (
      input.policyStateSupport?.blockTopUpsDuringPremiumHoliday === true
      && premiumHolidays.some((holiday) => (
        event.startPolicyMonth >= holiday.startPolicyMonth
        && event.startPolicyMonth < (holiday.startPolicyMonth + holiday.durationMonths)
      ))
    )
    || (
      input.policyStateSupport?.blockTopUpsWhenPremiumsNotPaidUpToDate === true
      && !arePremiumsPaidUpToDateAtMonth(normalized, event.startPolicyMonth)
    )
    || (
      input.policyStateSupport?.minimumTopUpAmount != null
      && event.amount + CONTRIBUTION_TOLERANCE < input.policyStateSupport.minimumTopUpAmount
    )
    || (
      input.policyStateSupport?.topUpAmountIncrement != null
      && input.policyStateSupport.topUpAmountIncrement > CONTRIBUTION_TOLERANCE
      && Math.abs(
        (event.amount / input.policyStateSupport.topUpAmountIncrement)
        - Math.round(event.amount / input.policyStateSupport.topUpAmountIncrement),
      ) > CONTRIBUTION_TOLERANCE
    )
  ))
  normalized.events.recurringSinglePremiums = normalized.events.recurringSinglePremiums.filter((event) => !(
    (
      input.policyStateSupport?.minimumRecurringSinglePremiumStartPolicyMonth != null
      && event.startPolicyMonth < input.policyStateSupport.minimumRecurringSinglePremiumStartPolicyMonth
    )
    || (
      input.policyStateSupport?.minimumRecurringSinglePremiumMonthlyAmount != null
      && event.amount != null
      && event.amount + CONTRIBUTION_TOLERANCE < input.policyStateSupport.minimumRecurringSinglePremiumMonthlyAmount
    )
  ))
  return normalized
}

function overlapMonths(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): number {
  const start = Math.max(leftStart, rightStart)
  const end = Math.min(leftEnd, rightEnd)
  return Math.max(0, end - start + 1)
}

function buildCashflowYearContext(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
): IlpCashflowYearContext {
  const range = getProjectionMonthRange(normalized.input, projectionYear)
  const premiumHolidayMonths = Math.min(12, normalized.events.premiumHolidays
    .reduce((sum, event) => (
      sum + overlapMonths(
        range.startPolicyMonth,
        range.endPolicyMonth,
        event.startPolicyMonth,
        event.startPolicyMonth + event.durationMonths - 1,
      )
    ), 0))
  const policyYear = normalized.input.currentPolicyYear + projectionYear

  return {
    projectionYear,
    policyYear,
    isPostMip: isPostMipPolicyYear(normalized.input, policyYear),
    range,
    premiumHolidayMonths,
    payableMonths: Math.max(0, 12 - premiumHolidayMonths),
    paymentHistory: {
      premiumYearAtStart: getPremiumYearAtMonth(normalized, Math.max(range.startPolicyMonth - 1, 0)),
      premiumYearAtEnd: getPremiumYearAtMonth(normalized, range.endPolicyMonth),
      premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, range.endPolicyMonth),
    },
  }
}

function buildCashflowMonthContext(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): IlpCashflowYearContext {
  const policyYear = getPolicyYearForMonth(policyMonth)

  return {
    projectionYear: Math.max(1, policyYear - normalized.input.currentPolicyYear),
    policyYear,
    isPostMip: isPostMipPolicyYear(normalized.input, policyYear),
    range: {
      startPolicyMonth: policyMonth,
      endPolicyMonth: policyMonth,
    },
    premiumHolidayMonths: isPremiumHolidayActiveAtMonth(normalized, policyMonth) ? 1 : 0,
    payableMonths: isPremiumHolidayActiveAtMonth(normalized, policyMonth) ? 0 : 1,
    paymentHistory: {
      premiumYearAtStart: getPremiumYearAtMonth(normalized, Math.max(policyMonth - 1, 0)),
      premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
      premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
    },
  }
}

function getPremiumYearAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  if (policyMonth <= 0) return 0
  return normalized.regularPremiums.premiumYearByPolicyMonth.get(policyMonth) ?? 0
}

function arePremiumsPaidUpToDateAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): boolean {
  if (policyMonth <= 0) return true
  return normalized.regularPremiums.paidUpToDateByPolicyMonth.get(policyMonth) ?? true
}

function getPremiumArrearsAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  if (policyMonth <= 0) return 0
  return normalized.regularPremiums.arrearsByPolicyMonth.get(policyMonth) ?? 0
}

function getTopUpRepaymentOutstandingAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
  clearance: NonNullable<IlpPolicyStateSupport['topUpRepaymentClearance']>,
): number {
  if (policyMonth <= 0) return 0

  const missedPremiumObligation = clearance.includeMissedPremiums === true
    ? normalized.regularPremiums.arrearsByPolicyMonth.get(policyMonth) ?? 0
    : 0
  const priorOffsetObligation = (clearance.priorOffsetRules ?? []).reduce((sum, rule) => {
    switch (rule.trigger) {
      case 'partial-withdrawal':
        return sum + normalized.events.partialWithdrawals.reduce((eventSum, event) => {
          if (
            event.amount == null
            || event.amount <= 0
            || event.startPolicyMonth > policyMonth
          ) {
            return eventSum
          }
          if ((rule.accountIds?.length ?? 0) > 0 && (!event.accountId || !rule.accountIds.includes(event.accountId))) {
            return eventSum
          }

          return eventSum + event.amount
        }, 0)
      case 'regular-premium-reduction': {
        let reductionShortfall = 0
        const committedMonthlyPremium = normalized.input.monthlyContribution
        for (let month = 1; month <= policyMonth; month += 1) {
          reductionShortfall += Math.max(0, committedMonthlyPremium - getScheduledMonthlyPremiumAtMonth(normalized, month))
        }
        return sum + reductionShortfall
      }
    }
  }, 0)
  const cumulativePolicyRepayments = normalized.events.policyRepayments.reduce((sum, event) => (
    event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= policyMonth
      ? sum + event.amount
      : sum
  ), 0)

  return Math.max(0, missedPremiumObligation + priorOffsetObligation - cumulativePolicyRepayments)
}

function getRuleReferenceYear(
  context: IlpCashflowYearContext,
  yearBasis: 'policy-year' | 'premium-year' | undefined,
): number {
  return yearBasis === 'premium-year'
    ? context.paymentHistory.premiumYearAtEnd
    : context.policyYear
}

function getEecReferenceYear(
  input: IlpPolicyInput,
  context: IlpCashflowYearContext,
): number {
  return input.eecYearBasis === 'premium-year'
    ? context.paymentHistory.premiumYearAtEnd
    : context.policyYear
}

function getPolicyYearForMonth(policyMonth: number): number {
  return Math.floor((policyMonth - 1) / 12) + 1
}

function getAssuranceStateEventsForYear(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): IlpPolicyEvent[] {
  return normalized.assurance.stateEvents
    .filter((event) => (
      event.startPolicyMonth >= range.startPolicyMonth
      && event.startPolicyMonth <= range.endPolicyMonth
    ))
    .sort((left, right) => left.startPolicyMonth - right.startPolicyMonth)
}

function getTopUpRuleShare(account: IlpAccount): number {
  return account.contributionRules?.find((rule) => rule.phase === 'top-up')?.contributionShare ?? 0
}

function getPartialWithdrawalsByAccount(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): Map<string, number> {
  const withdrawals = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))

  for (const event of normalized.events.partialWithdrawals) {
    if (!event.accountId || event.amount == null || event.amount <= 0) continue
    if (event.startPolicyMonth < range.startPolicyMonth || event.startPolicyMonth > range.endPolicyMonth) continue

    withdrawals.set(event.accountId, (withdrawals.get(event.accountId) ?? 0) + event.amount)
  }

  return withdrawals
}

function isPartialWithdrawalSupportRuleActive(
  input: IlpPolicyInput,
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term',
  policyYear: number,
): boolean {
  return activeWindow === 'policy-term'
    || (activeWindow === 'during-mip' && !isPostMipPolicyYear(input, policyYear))
    || (activeWindow === 'after-mip' && isPostMipPolicyYear(input, policyYear))
}

function buildSingleMonthEventChargeContext(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): IlpCashflowYearContext {
  const policyYear = getPolicyYearForMonth(policyMonth)

  return {
    projectionYear: Math.max(1, Math.ceil(Math.max(policyMonth - normalized.input.monthsAlreadyPaid, 0) / 12)),
    policyYear,
    isPostMip: isPostMipPolicyYear(normalized.input, policyYear),
    range: {
      startPolicyMonth: policyMonth,
      endPolicyMonth: policyMonth,
    },
    premiumHolidayMonths: isPremiumHolidayActiveAtMonth(normalized, policyMonth) ? 1 : 0,
    payableMonths: 1,
    paymentHistory: {
      premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth - 1),
      premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
      premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
    },
  }
}

function getPriorGrossPartialWithdrawalsByAccount(
  normalized: IlpNormalizedPolicyInput,
  accountId: string,
  beforePolicyMonth: number,
): number {
  if (beforePolicyMonth <= 1) {
    return 0
  }

  const relevantChargeRules = (normalized.input.eventChargeRules ?? []).filter((rule) => (
    rule.trigger === 'partial-withdrawal'
    && rule.basis === 'event-amount'
    && rule.appliesTo.includes(accountId)
  ))

  if (relevantChargeRules.length === 0) {
    return normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.accountId === accountId
      && event.startPolicyMonth < beforePolicyMonth
      && event.amount != null
      && event.amount > 0
        ? sum + event.amount
        : sum
    ), 0)
  }

  const freeAmountPoolUsedByRule = new Map<string, number>()
  const unsupportedPoolBasis = new Set(['open-balance'])

  return normalized.events.partialWithdrawals.reduce((sum, event) => {
    if (
      event.accountId !== accountId
      || event.startPolicyMonth >= beforePolicyMonth
      || event.amount == null
      || event.amount <= 0
    ) {
      return sum
    }

    const eventPolicyYear = getPolicyYearForMonth(event.startPolicyMonth)
    const eventChargeContext = buildSingleMonthEventChargeContext(normalized, event.startPolicyMonth)
    const eventCharges = relevantChargeRules.reduce((chargeSum, rule) => {
      if (!isPartialWithdrawalSupportRuleActive(normalized.input, rule.activeWindow ?? 'policy-term', eventPolicyYear)) {
        return chargeSum
      }

      if (event.chargeWaived === true && rule.manualWaiverMode !== 'capped-free-event') {
        return chargeSum
      }

      if (rule.freeAmountPoolBasis && unsupportedPoolBasis.has(rule.freeAmountPoolBasis)) {
        return chargeSum
      }

      const freeAmount = computeFreePartialWithdrawalAmount(
        normalized,
        relevantChargeRules,
        rule,
        event,
        new Map<string, number>(),
        new Map<number, Map<string, number>>(),
        freeAmountPoolUsedByRule,
      )
      const chargeableAmount = Math.max(0, (event.amount ?? 0) - freeAmount)
      return chargeSum + (chargeableAmount * resolveEventChargeRate(rule, eventChargeContext)) + rule.amount
    }, 0)

    return sum + event.amount + eventCharges
  }, 0)
}

function getPriorPartialWithdrawalAmountsByAccount(
  normalized: IlpNormalizedPolicyInput,
  accountId: string,
  beforePolicyMonth: number,
): number {
  if (beforePolicyMonth <= 1) {
    return 0
  }

  return normalized.events.partialWithdrawals.reduce((sum, event) => (
    event.accountId === accountId
    && event.startPolicyMonth < beforePolicyMonth
    && event.amount != null
    && event.amount > 0
      ? sum + event.amount
      : sum
  ), 0)
}

function getEligiblePartialWithdrawalsByAccount(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  availableBeforeWithdrawalsByAccount: Map<string, number>,
): Map<string, number> {
  const withdrawals = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const startMonthRulesByAccount = new Map(
    (normalized.input.policyStateSupport?.minimumPartialWithdrawalStartPolicyMonthByAccount ?? [])
      .map((rule) => [rule.accountId, rule.startPolicyMonth] as const),
  )
  const minimumPartialWithdrawalAmount = normalized.input.policyStateSupport?.minimumPartialWithdrawalAmount
  const partialWithdrawalAmountIncrement = normalized.input.policyStateSupport?.partialWithdrawalAmountIncrement
  const maximumAmountRules = normalized.input.policyStateSupport?.partialWithdrawalMaximumAmountRules ?? []
  const remainingValueRules = normalized.input.policyStateSupport?.partialWithdrawalMinimumRemainingValueRules ?? []

  if (
    startMonthRulesByAccount.size === 0
    && minimumPartialWithdrawalAmount == null
    && partialWithdrawalAmountIncrement == null
    && maximumAmountRules.length === 0
    && remainingValueRules.length === 0
  ) {
    return getPartialWithdrawalsByAccount(normalized, context.range)
  }

  const runningBalances = new Map<string, number>(normalized.input.accounts.map((account) => [
    account.id,
    availableBeforeWithdrawalsByAccount.get(account.id) ?? 0,
  ]))

  for (const event of normalized.events.partialWithdrawals) {
    if (!event.accountId || event.amount == null || event.amount <= 0) continue
    if (event.startPolicyMonth < context.range.startPolicyMonth || event.startPolicyMonth > context.range.endPolicyMonth) continue

    const startMonth = startMonthRulesByAccount.get(event.accountId)
    if (startMonth != null && event.startPolicyMonth < startMonth) {
      continue
    }

    if (minimumPartialWithdrawalAmount != null && event.amount + CONTRIBUTION_TOLERANCE < minimumPartialWithdrawalAmount) {
      continue
    }

    if (
      partialWithdrawalAmountIncrement != null
      && partialWithdrawalAmountIncrement > CONTRIBUTION_TOLERANCE
    ) {
      const incrementUnits = event.amount / partialWithdrawalAmountIncrement
      if (Math.abs(incrementUnits - Math.round(incrementUnits)) > CONTRIBUTION_TOLERANCE) {
        continue
      }
    }

    const eventPolicyYear = getPolicyYearForMonth(event.startPolicyMonth)
    const applicableMaximumAmountRules = maximumAmountRules.filter((rule) => (
      rule.accountId === event.accountId
      && isPartialWithdrawalSupportRuleActive(normalized.input, rule.activeWindow, eventPolicyYear)
      && (rule.startPolicyYear == null || eventPolicyYear >= rule.startPolicyYear)
      && (rule.endPolicyYear == null || eventPolicyYear <= rule.endPolicyYear)
    ))
    if (applicableMaximumAmountRules.length > 0) {
      const cumulativePaidRegularPremium = normalized.regularPremiums.cumulativePaidByPolicyMonth.get(event.startPolicyMonth) ?? 0
      const violatesMaximumAmountRule = applicableMaximumAmountRules.some((rule) => {
        const accountValueBeforeWithdrawal = runningBalances.get(event.accountId) ?? 0
        const priorWithdrawals = rule.basis === 'account-value-less-prior-withdrawals'
          ? getPriorPartialWithdrawalAmountsByAccount(normalized, event.accountId, event.startPolicyMonth)
          : getPriorGrossPartialWithdrawalsByAccount(normalized, event.accountId, event.startPolicyMonth)
        const ruleBasisValue = rule.basis === 'account-value-less-prior-withdrawals'
          ? accountValueBeforeWithdrawal
          : cumulativePaidRegularPremium
        const maximumAmount = Math.max(0, (ruleBasisValue * rule.maximumValueRate) - priorWithdrawals)
        return event.amount > maximumAmount + CONTRIBUTION_TOLERANCE
      })

      if (violatesMaximumAmountRule) {
        continue
      }
    }

    const eventIsPostMip = isPostMipPolicyYear(normalized.input, eventPolicyYear)
    const applicableRules = remainingValueRules.filter((rule) => (
      rule.activeWindow === 'policy-term'
      || (rule.activeWindow === 'during-mip' && !eventIsPostMip)
      || (rule.activeWindow === 'after-mip' && eventIsPostMip)
    ))

    const currentPolicyValue = Array.from(runningBalances.values()).reduce((sum, value) => sum + value, 0)
    const withdrawalAccountBalance = runningBalances.get(event.accountId) ?? 0
    const nextWithdrawalAccountBalance = Math.max(0, withdrawalAccountBalance - event.amount)
    const nextPolicyValue = Math.max(0, currentPolicyValue - event.amount)

    const violatesMinimumRemainingValue = applicableRules.some((rule) => {
      if (rule.basis === 'policy-value') {
        return nextPolicyValue + CONTRIBUTION_TOLERANCE < (rule.minimumValue ?? 0)
      }

      if (rule.basis === 'initial-single-premium') {
        const monitoredAccountBalance = runningBalances.get(rule.accountId ?? '') ?? 0
        const nextMonitoredBalance = rule.accountId === event.accountId
          ? nextWithdrawalAccountBalance
          : monitoredAccountBalance
        const minimumValue = Math.max(0, (normalized.input.initialSinglePremium ?? 0) * (rule.minimumValueRate ?? 0))
        return nextMonitoredBalance + CONTRIBUTION_TOLERANCE < minimumValue
      }

      const monitoredAccountBalance = runningBalances.get(rule.accountId ?? '') ?? 0
      const nextMonitoredBalance = rule.accountId === event.accountId
        ? nextWithdrawalAccountBalance
        : monitoredAccountBalance
      return nextMonitoredBalance + CONTRIBUTION_TOLERANCE < (rule.minimumValue ?? 0)
    })
    if (violatesMinimumRemainingValue) {
      continue
    }

    withdrawals.set(event.accountId, (withdrawals.get(event.accountId) ?? 0) + event.amount)
    runningBalances.set(event.accountId, nextWithdrawalAccountBalance)
  }

  return withdrawals
}

function getReinvestedDividendWithdrawalsByAccount(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): Map<string, number> {
  const withdrawals = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))

  for (const event of normalized.events.reinvestedDividendWithdrawals) {
    if (!event.accountId || event.amount == null || event.amount <= 0) continue
    if (event.startPolicyMonth < range.startPolicyMonth || event.startPolicyMonth > range.endPolicyMonth) continue

    withdrawals.set(event.accountId, (withdrawals.get(event.accountId) ?? 0) + event.amount)
  }

  return withdrawals
}

function isScheduledPayoutBlockedByRetirementAge(
  input: Pick<IlpPolicyInput, 'currentPolicyYear' | 'assuranceProfile' | 'scheduledPayoutSupport'>,
  policyYear: number,
): boolean {
  if (input.scheduledPayoutSupport?.requiresTargetRetirementAgeStart !== true) {
    return false
  }

  const currentAgeNextBirthday = input.assuranceProfile?.currentAgeNextBirthday
  const targetRetirementAge = input.assuranceProfile?.targetRetirementAge
  if (currentAgeNextBirthday == null || targetRetirementAge == null) {
    return true
  }

  const projectedAgeNextBirthday = currentAgeNextBirthday + Math.max(0, policyYear - input.currentPolicyYear)
  return projectedAgeNextBirthday < targetRetirementAge
}

function isScheduledPayoutBlockedAtPolicyYear(
  input: Pick<IlpPolicyInput, 'currentPolicyYear' | 'assuranceProfile' | 'scheduledPayoutSupport'>,
  policyYear: number,
): boolean {
  const minimumStartPolicyYear = input.scheduledPayoutSupport?.minimumStartPolicyYear
  if (minimumStartPolicyYear != null && policyYear < minimumStartPolicyYear) {
    return true
  }

  return isScheduledPayoutBlockedByRetirementAge(input, policyYear)
}

function scheduledPayoutFrequencyOccurrencesPerYear(frequency: IlpRegularPremiumPaymentFrequency | undefined): number {
  switch (frequency) {
    case 'semi-annual':
      return 2
    case 'quarterly':
      return 4
    case 'monthly':
      return 12
    case 'annual':
    case undefined:
      return 1
  }
}

function isScheduledPayoutFrequencyAllowed(
  scheduledPayoutSupport: IlpPolicyInput['scheduledPayoutSupport'] | undefined,
  frequency: IlpRegularPremiumPaymentFrequency | undefined,
): boolean {
  const allowedFrequencies = scheduledPayoutSupport?.allowedFrequencies
  if (!allowedFrequencies || allowedFrequencies.length === 0) {
    return true
  }

  return allowedFrequencies.includes(frequency ?? 'annual')
}

function getScheduledPayoutsByAccount(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  scheduledPayoutState: IlpYearRow['scheduledPayoutState'],
  availableBeforeBaseWithdrawalsByAccount: Map<string, number>,
  partialWithdrawalByAccount: Map<string, number>,
): Map<string, number> {
  const payouts = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const scheduledPayout = normalized.input.scheduledPayoutAssumption

  if (
    !scheduledPayout
    || scheduledPayout.mode !== 'scheduled-redemption'
    || scheduledPayoutState === 'inactive'
    || scheduledPayoutState === 'lapsed'
  ) {
    return payouts
  }

  const payoutEndPolicyYear = scheduledPayout.startPolicyYear + scheduledPayout.durationYears - 1
  if (context.policyYear < scheduledPayout.startPolicyYear || context.policyYear > payoutEndPolicyYear) {
    return payouts
  }

  if (isScheduledPayoutBlockedAtPolicyYear(normalized.input, context.policyYear)) {
    return payouts
  }

  if (!isScheduledPayoutFrequencyAllowed(normalized.input.scheduledPayoutSupport, scheduledPayout.frequency)) {
    return payouts
  }

  const minimumAnnualWithdrawalAmount = normalized.input.scheduledPayoutSupport?.minimumAnnualWithdrawalAmount
  if (
    minimumAnnualWithdrawalAmount != null
    && scheduledPayout.annualPayoutAmount + CONTRIBUTION_TOLERANCE < minimumAnnualWithdrawalAmount
  ) {
    return payouts
  }

  const minimumWithdrawalAmountPerOccurrence = normalized.input.scheduledPayoutSupport?.minimumWithdrawalAmountPerOccurrence
  if (minimumWithdrawalAmountPerOccurrence != null) {
    const payoutAmountPerOccurrence = scheduledPayout.annualPayoutAmount
      / scheduledPayoutFrequencyOccurrencesPerYear(scheduledPayout.frequency)
    if (payoutAmountPerOccurrence + CONTRIBUTION_TOLERANCE < minimumWithdrawalAmountPerOccurrence) {
      return payouts
    }
  }

  const minimumRemainingPolicyValue = normalized.input.scheduledPayoutSupport?.minimumRemainingPolicyValue
  if (minimumRemainingPolicyValue != null) {
    const availablePolicyValueAfterPartialWithdrawals = Array.from(
      availableBeforeBaseWithdrawalsByAccount.entries(),
    ).reduce((total, [accountId, value]) => {
      return total + Math.max(0, value - (partialWithdrawalByAccount.get(accountId) ?? 0))
    }, 0)
    const actualScheduledPayoutAmount = Math.min(
      scheduledPayout.annualPayoutAmount,
      availablePolicyValueAfterPartialWithdrawals,
    )

    if (
      availablePolicyValueAfterPartialWithdrawals - actualScheduledPayoutAmount + CONTRIBUTION_TOLERANCE
      < minimumRemainingPolicyValue
    ) {
      return payouts
    }
  }

  const payoutAccountIds = [
    normalized.input.scheduledPayoutSupport?.accountId ?? scheduledPayout.accountId,
    ...(normalized.input.scheduledPayoutSupport?.fallbackAccountIds ?? []),
  ]
  let remainingPayout = scheduledPayout.annualPayoutAmount

  for (const accountId of payoutAccountIds) {
    if (remainingPayout <= CONTRIBUTION_TOLERANCE) break

    const availableBeforeScheduledPayout = Math.max(
      0,
      (availableBeforeBaseWithdrawalsByAccount.get(accountId) ?? 0) - (partialWithdrawalByAccount.get(accountId) ?? 0),
    )
    if (availableBeforeScheduledPayout <= CONTRIBUTION_TOLERANCE) continue

    const payoutAmount = Math.min(remainingPayout, availableBeforeScheduledPayout)
    payouts.set(accountId, payoutAmount)
    remainingPayout -= payoutAmount
  }

  return payouts
}

function resolveScheduledPayoutStateForYear(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
): IlpYearRow['scheduledPayoutState'] {
  const scheduledPayout = normalized.input.scheduledPayoutAssumption
  if (!scheduledPayout || scheduledPayout.mode !== 'scheduled-redemption') {
    return 'inactive'
  }

  const payoutEndPolicyYear = scheduledPayout.startPolicyYear + scheduledPayout.durationYears - 1
  if (context.policyYear < scheduledPayout.startPolicyYear || context.policyYear > payoutEndPolicyYear) {
    return 'inactive'
  }

  if (isScheduledPayoutBlockedAtPolicyYear(normalized.input, context.policyYear)) {
    return 'inactive'
  }

  const payoutStateSupport = normalized.input.scheduledPayoutSupport?.payoutStateSupport
  if (!payoutStateSupport) {
    return 'target-income'
  }

  const hasOverlappingLapse = payoutStateSupport.suppressWhileLapsed && Array.from(
    { length: context.range.endPolicyMonth - context.range.startPolicyMonth + 1 },
    (_, index) => context.range.startPolicyMonth + index,
  ).some((policyMonth) => isLapseActiveAtMonth(normalized, policyMonth))

  if (hasOverlappingLapse) {
    return 'lapsed'
  }

  let payoutState = payoutStateSupport.defaultState

  if (
    payoutStateSupport.stateAfterPremiumHolidayActivation
    && normalized.events.premiumHolidays.some((event) => event.startPolicyMonth <= context.range.endPolicyMonth)
  ) {
    payoutState = payoutStateSupport.stateAfterPremiumHolidayActivation
  }

  if (
    payoutStateSupport.stateAfterReinstatement
    && normalized.events.lapses.some((event) => (event.startPolicyMonth + event.durationMonths - 1) < context.range.startPolicyMonth)
  ) {
    payoutState = payoutStateSupport.stateAfterReinstatement
  }

  return payoutState
}

function getDistributionPayoutsByAccount(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
  openBalances: Map<string, number>,
): Map<string, number> {
  const payouts = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const distributionSupport = normalized.input.distributionSupport
  const distributionAssumption = normalized.input.distributionAssumption

  if (!distributionSupport || !distributionAssumption || distributionAssumption.mode !== 'cash-payout') {
    return payouts
  }

  const policyYear = normalized.input.currentPolicyYear + projectionYear
  const eligibleAccountIds = resolveDistributionPayoutAccountIds(normalized.input, policyYear)

  if (eligibleAccountIds.length === 0) {
    return payouts
  }

  for (const accountId of eligibleAccountIds) {
    const openBalance = openBalances.get(accountId) ?? 0
    if (openBalance <= 0) continue
    const payoutAmount = openBalance * distributionAssumption.annualYieldRate
    const minimumAnnualPayoutCurrency = distributionSupport.minimumAnnualPayoutCurrency ?? normalized.input.currency
    if (
      distributionSupport.minimumAnnualPayoutAmount != null
      && minimumAnnualPayoutCurrency === normalized.input.currency
      && payoutAmount < distributionSupport.minimumAnnualPayoutAmount
    ) {
      continue
    }
    payouts.set(accountId, payoutAmount)
  }

  return payouts
}

function mergeAccountAmountMaps(
  left: Map<string, number>,
  right: Map<string, number>,
): Map<string, number> {
  const merged = new Map(left)

  for (const [accountId, amount] of right.entries()) {
    merged.set(accountId, (merged.get(accountId) ?? 0) + amount)
  }

  return merged
}

function assertScheduledPayoutConfiguration(input: IlpPolicyInput): void {
  const accountIds = new Set(input.accounts.map((account) => account.id))

  if (input.scheduledPayoutSupport && !accountIds.has(input.scheduledPayoutSupport.accountId)) {
    throw new Error(`Scheduled payout support account "${input.scheduledPayoutSupport.accountId}" does not exist on policy "${input.name}".`)
  }

  for (const fallbackAccountId of input.scheduledPayoutSupport?.fallbackAccountIds ?? []) {
    if (!accountIds.has(fallbackAccountId)) {
      throw new Error(`Scheduled payout support fallback account "${fallbackAccountId}" does not exist on policy "${input.name}".`)
    }
  }

  if (
    input.scheduledPayoutSupport?.fallbackAccountIds?.includes(input.scheduledPayoutSupport.accountId)
  ) {
    throw new Error(`Scheduled payout support fallback accounts must not repeat the primary payout account on policy "${input.name}".`)
  }

  if (input.scheduledPayoutAssumption && !input.scheduledPayoutSupport) {
    throw new Error(`Scheduled payout assumption requires scheduled payout support on policy "${input.name}".`)
  }

  if (
    input.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && !accountIds.has(input.scheduledPayoutAssumption.accountId)
  ) {
    throw new Error(`Scheduled payout assumption account "${input.scheduledPayoutAssumption.accountId}" does not exist on policy "${input.name}".`)
  }

  if (
    input.scheduledPayoutSupport
    && input.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && input.scheduledPayoutSupport.accountId !== input.scheduledPayoutAssumption.accountId
  ) {
    throw new Error(`Scheduled payout assumption account must match scheduled payout support account on policy "${input.name}".`)
  }
}


function assertDistributionConfiguration(input: IlpPolicyInput): void {
  const accountIds = new Set(input.accounts.map((account) => account.id))

  if (input.distributionSupport) {
    for (const accountId of input.distributionSupport.accountIds) {
      if (!accountIds.has(accountId)) {
        throw new Error(`Distribution support account "${accountId}" does not exist on policy "${input.name}".`)
      }
    }

    input.distributionSupport.cashPayoutWindows?.forEach((window, windowIndex) => {
      if (window.endPolicyYear != null && window.endPolicyYear < window.startPolicyYear) {
        throw new Error(`Distribution support cash-payout window ${windowIndex + 1} has endPolicyYear before startPolicyYear on policy "${input.name}".`)
      }

      for (const accountId of window.accountIds) {
        if (!accountIds.has(accountId)) {
          throw new Error(`Distribution support cash-payout window account "${accountId}" does not exist on policy "${input.name}".`)
        }

        if (!input.distributionSupport?.accountIds.includes(accountId)) {
          throw new Error(`Distribution support cash-payout window account "${accountId}" must also exist in distributionSupport.accountIds on policy "${input.name}".`)
        }
      }
    })

    if (input.distributionSupport.cashPayoutWindows) {
      for (const accountId of input.distributionSupport.accountIds) {
        const appearsInWindow = input.distributionSupport.cashPayoutWindows.some((window) => window.accountIds.includes(accountId))
        if (!appearsInWindow) {
          throw new Error(`Distribution support account "${accountId}" must be represented in at least one cash-payout window on policy "${input.name}".`)
        }
      }

      const windows = input.distributionSupport.cashPayoutWindows
      for (let leftIndex = 0; leftIndex < windows.length; leftIndex += 1) {
        const leftWindow = windows[leftIndex]
        const leftEnd = leftWindow.endPolicyYear ?? Number.POSITIVE_INFINITY
        for (let rightIndex = leftIndex + 1; rightIndex < windows.length; rightIndex += 1) {
          const rightWindow = windows[rightIndex]
          const rightEnd = rightWindow.endPolicyYear ?? Number.POSITIVE_INFINITY
          const overlaps = leftWindow.startPolicyYear <= rightEnd && rightWindow.startPolicyYear <= leftEnd
          if (overlaps) {
            throw new Error(`Distribution support cash-payout windows must not overlap on policy "${input.name}".`)
          }
        }
      }
    }
  }

  if (input.distributionAssumption && !input.distributionSupport) {
    throw new Error(`Distribution assumption requires distribution support on policy "${input.name}".`)
  }

  if (
    input.distributionAssumption?.mode === 'cash-payout'
    && input.distributionSupport
    && !(
      input.distributionSupport.cashPayoutWindows?.length
      || input.distributionSupport.cashPayoutAllowedDuringMip
      || input.distributionSupport.cashPayoutAllowedAfterMip
    )
  ) {
    throw new Error(`Cash-payout distribution assumption requires at least one payout-eligible phase on policy "${input.name}".`)
  }
}

function assertAccruedAssuranceEntryPoint(input: IlpPolicyInput): void {
  const hasUnsupportedMidPolicyAccrual = input.chargeRules?.some((rule) => (
    rule.assuranceConfig?.accrual != null
    && (input.currentPolicyYear > 1 || input.monthsAlreadyPaid > 0)
    && input.currentPolicyYear < rule.assuranceConfig.accrual.settlementPolicyYear
  )) ?? false

  if (hasUnsupportedMidPolicyAccrual) {
    throw new Error(
      `Cannot analyze ILP policy "${input.name}": accrued assurance rules currently require inception-state inputs, so mid-policy entry before settlement is not supported.`,
    )
  }
}

function assertFreeAmountPoolEntryPoint(input: IlpPolicyInput): void {
  const unsupportedRule = input.eventChargeRules?.find((rule) => (
    rule.freeAmountPoolReferencePolicyYear != null
    && input.monthsAlreadyPaid > ((rule.freeAmountPoolReferencePolicyYear - 1) * 12)
  ))

  if (unsupportedRule) {
    throw new Error(
      `Cannot analyze ILP policy "${input.name}": free amount pools anchored to an earlier policy year require entry at or before the start of that reference year.`,
    )
  }
}

function resolveDistributionPayoutAccountIds(
  input: IlpPolicyInput,
  policyYear: number,
): string[] {
  const distributionSupport = input.distributionSupport
  if (!distributionSupport) return []

  if (distributionSupport.cashPayoutWindows?.length) {
    const matchingWindow = distributionSupport.cashPayoutWindows.find((window) => (
      policyYear >= window.startPolicyYear
      && (window.endPolicyYear == null || policyYear <= window.endPolicyYear)
    ))

    return matchingWindow ? [...matchingWindow.accountIds] : []
  }

  const payoutAllowed = isPostMipPolicyYear(input, policyYear)
    ? distributionSupport.cashPayoutAllowedAfterMip
    : distributionSupport.cashPayoutAllowedDuringMip

  return payoutAllowed ? [...distributionSupport.accountIds] : []
}

function getAnnualPremiumReductionAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return normalized.events.regularPremiumReductions
    .filter((event) => event.startPolicyMonth <= policyMonth)
    .reduce((sum, event) => sum + (event.amount ?? 0), 0)
}

function getAnnualPremiumIncreaseAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return normalized.events.regularPremiumIncreases
    .filter((event) => event.startPolicyMonth <= policyMonth)
    .reduce((sum, event) => sum + (event.amount ?? 0), 0)
}

function normalizeRegularPremiumVariationEvents(
  normalized: IlpNormalizedPolicyInput,
  rawRegularPremiumReductions: IlpPolicyEvent[],
  rawRegularPremiumIncreases: IlpPolicyEvent[],
): Pick<IlpNormalizedPolicyEvents, 'regularPremiumReductions' | 'regularPremiumIncreases'> {
  const minimumAnnualRegularPremium = getMinimumAnnualRegularPremiumAtFrequency(normalized.input)
  if (minimumAnnualRegularPremium == null) {
    return {
      regularPremiumReductions: rawRegularPremiumReductions,
      regularPremiumIncreases: rawRegularPremiumIncreases,
    }
  }

  const acceptedRegularPremiumReductions: IlpPolicyEvent[] = []
  const acceptedRegularPremiumIncreases: IlpPolicyEvent[] = []
  const regularPremiumVariationEvents = [
    ...rawRegularPremiumIncreases.map((event, index) => ({
      event,
      priority: 0,
      sequence: index,
      type: 'increase' as const,
    })),
    ...rawRegularPremiumReductions.map((event, index) => ({
      event,
      priority: 1,
      sequence: index,
      type: 'reduction' as const,
    })),
  ].sort((left, right) => (
    left.event.startPolicyMonth - right.event.startPolicyMonth
    || left.priority - right.priority
    || left.sequence - right.sequence
  ))

  for (const variationEvent of regularPremiumVariationEvents) {
    if (variationEvent.type === 'increase') {
      acceptedRegularPremiumIncreases.push(variationEvent.event)
      continue
    }

    normalized.events.regularPremiumReductions = [...acceptedRegularPremiumReductions, variationEvent.event]
    normalized.events.regularPremiumIncreases = acceptedRegularPremiumIncreases
    const resultingAnnualPremium = getScheduledAnnualPremiumAtMonth(normalized, variationEvent.event.startPolicyMonth)
    normalized.events.regularPremiumReductions = acceptedRegularPremiumReductions

    if (resultingAnnualPremium + CONTRIBUTION_TOLERANCE >= minimumAnnualRegularPremium) {
      acceptedRegularPremiumReductions.push(variationEvent.event)
    }
  }

  normalized.events.regularPremiumIncreases = acceptedRegularPremiumIncreases

  return {
    regularPremiumReductions: acceptedRegularPremiumReductions,
    regularPremiumIncreases: acceptedRegularPremiumIncreases,
  }
}

function getRecurringSinglePremiumAmountAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return normalized.events.recurringSinglePremiums
    .filter((event) => (
      event.amount != null
      && event.amount > 0
      && policyMonth >= event.startPolicyMonth
      && policyMonth < (event.startPolicyMonth + event.durationMonths)
      && isRecurringSinglePremiumEventActiveAtMonth(normalized, event, policyMonth)
    ))
    .reduce((sum, event) => sum + (event.amount ?? 0), 0)
}

function getRecurringSinglePremiumAmountAtMonthWithoutCommittedPremiumResumptionGate(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return normalized.events.recurringSinglePremiums
    .filter((event) => (
      event.amount != null
      && event.amount > 0
      && policyMonth >= event.startPolicyMonth
      && policyMonth < (event.startPolicyMonth + event.durationMonths)
    ))
    .reduce((sum, event) => {
      const gateEvents = [
        ...normalized.events.premiumHolidays,
        ...normalized.events.recurringSinglePremiumResumptions,
      ]
        .filter((gateEvent) => (
          gateEvent.startPolicyMonth >= event.startPolicyMonth
          && gateEvent.startPolicyMonth <= policyMonth
          && (
            gateEvent.type === 'premium-holiday'
            || gateEvent.type === 'recurring-single-premium-resumption'
          )
        ))
        .sort((left, right) => left.startPolicyMonth - right.startPolicyMonth)

      let isActive = true
      for (const gateEvent of gateEvents) {
        if (gateEvent.type === 'premium-holiday') {
          isActive = false
          continue
        }

        isActive = true
      }

      return isActive ? sum + (event.amount ?? 0) : sum
    }, 0)
}

function getCurrentRegularPremiumAnnualAmountAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  const annualReduction = getAnnualPremiumReductionAtMonth(normalized, policyMonth)
  const recurringSinglePremiumReductionAbsorbed = Math.min(
    annualReduction / 12,
    getRecurringSinglePremiumAmountAtMonthWithoutCommittedPremiumResumptionGate(normalized, policyMonth),
  ) * 12
  const residualRegularPremiumReduction = annualReduction - recurringSinglePremiumReductionAbsorbed

  return Math.max(
    0,
    normalized.regularPremiums.committedAnnualPremiumAtIssue
      - residualRegularPremiumReduction
      + getAnnualPremiumIncreaseAtMonth(normalized, policyMonth),
  )
}

function getCumulativeRecurringSinglePremiumPaidAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  let total = 0

  for (let month = 1; month <= policyMonth; month += 1) {
    total += getRecurringSinglePremiumAmountAtMonth(normalized, month)
  }

  return total
}

function getNetRecurringSinglePremiumAmountAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  const grossAmount = getRecurringSinglePremiumAmountAtMonth(normalized, policyMonth)
  if (grossAmount <= 0) {
    return 0
  }

  const policyYear = getPolicyYearForMonth(policyMonth)
  const isPostMip = isPostMipPolicyYear(normalized.input, policyYear)
  const eventContext: IlpCashflowYearContext = {
    projectionYear: 0,
    policyYear,
    isPostMip,
    range: {
      startPolicyMonth: policyMonth,
      endPolicyMonth: policyMonth,
    },
    premiumHolidayMonths: 0,
    payableMonths: 0,
    paymentHistory: {
      premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth),
      premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
      premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
    },
  }

  let totalCharge = 0
  for (const rule of normalized.input.eventChargeRules ?? []) {
    if (rule.trigger !== 'recurring-single-premium') {
      continue
    }

    const activeWindow = rule.activeWindow ?? 'policy-term'
    const isActive = activeWindow === 'policy-term'
      || (activeWindow === 'during-mip' && !isPostMip)
      || (activeWindow === 'after-mip' && isPostMip)
    if (!isActive) {
      continue
    }

    totalCharge += Math.max(0, grossAmount * resolveEventChargeRate(rule, eventContext)) + rule.amount
  }

  return Math.max(0, grossAmount - totalCharge)
}

function getCumulativeNetRecurringSinglePremiumPaidAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  let total = 0

  for (let month = 1; month <= policyMonth; month += 1) {
    total += getNetRecurringSinglePremiumAmountAtMonth(normalized, month)
  }

  return total
}

function getNetTopUpAmountForEvent(
  normalized: IlpNormalizedPolicyInput,
  event: IlpPolicyEvent,
): number {
  if (event.type !== 'top-up' || event.amount == null || event.amount <= 0) {
    return 0
  }

  const policyYear = getPolicyYearForMonth(event.startPolicyMonth)
  const isPostMip = isPostMipPolicyYear(normalized.input, policyYear)
  const eventContext: IlpCashflowYearContext = {
    projectionYear: 0,
    policyYear,
    isPostMip,
    range: {
      startPolicyMonth: event.startPolicyMonth,
      endPolicyMonth: event.startPolicyMonth,
    },
    premiumHolidayMonths: 0,
    payableMonths: 0,
    paymentHistory: {
      premiumYearAtStart: getPremiumYearAtMonth(normalized, event.startPolicyMonth),
      premiumYearAtEnd: getPremiumYearAtMonth(normalized, event.startPolicyMonth),
      premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, event.startPolicyMonth),
    },
  }

  let totalCharge = 0
  for (const rule of normalized.input.eventChargeRules ?? []) {
    if (rule.trigger !== 'top-up') {
      continue
    }

    const activeWindow = rule.activeWindow ?? 'policy-term'
    const isActive = activeWindow === 'policy-term'
      || (activeWindow === 'during-mip' && !isPostMip)
      || (activeWindow === 'after-mip' && isPostMip)
    if (!isActive) {
      continue
    }

    totalCharge += Math.max(0, event.amount * resolveEventChargeRate(rule, eventContext)) + rule.amount
  }

  return Math.max(0, event.amount - totalCharge)
}

function getCumulativeNetTopUpPaidAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return normalized.events.topUps.reduce((sum, event) => (
    event.startPolicyMonth <= policyMonth
      ? sum + getNetTopUpAmountForEvent(normalized, event)
      : sum
  ), 0)
}

function getInvestPlusSpNetPremiumBaseAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  let remainingInitialSinglePremium = Math.max(0, normalized.input.initialSinglePremium ?? 0)
  const remainingTopUpVintages = normalized.events.topUps
    .filter((event) => (
      event.startPolicyMonth <= policyMonth
      && event.amount != null
      && event.amount > 0
    ))
    .map((event) => ({
      startPolicyMonth: event.startPolicyMonth,
      remainingNetAmount: getNetTopUpAmountForEvent(normalized, event),
    }))

  for (const event of normalized.events.partialWithdrawals) {
    if (
      event.startPolicyMonth > policyMonth
      || event.amount == null
      || event.amount <= 0
    ) {
      continue
    }

    let remainingWithdrawalAmount = event.amount

    if (event.accountId !== 'policy') {
      for (let index = remainingTopUpVintages.length - 1; index >= 0 && remainingWithdrawalAmount > 0; index -= 1) {
        const vintage = remainingTopUpVintages[index]
        const appliedToVintage = Math.min(vintage.remainingNetAmount, remainingWithdrawalAmount)
        vintage.remainingNetAmount -= appliedToVintage
        remainingWithdrawalAmount -= appliedToVintage
      }
    }

    if (remainingWithdrawalAmount > 0) {
      remainingInitialSinglePremium = Math.max(0, remainingInitialSinglePremium - remainingWithdrawalAmount)
    }
  }

  return remainingInitialSinglePremium + remainingTopUpVintages.reduce((sum, vintage) => (
    sum + vintage.remainingNetAmount
  ), 0)
}

function isRecurringSinglePremiumEventActiveAtMonth(
  normalized: IlpNormalizedPolicyInput,
  recurringEvent: IlpPolicyEvent,
  policyMonth: number,
): boolean {
  if (recurringEvent.type !== 'recurring-single-premium') {
    return false
  }

  if (
    policyMonth < recurringEvent.startPolicyMonth
    || policyMonth >= (recurringEvent.startPolicyMonth + recurringEvent.durationMonths)
  ) {
    return false
  }

  const gateEvents = [
    ...normalized.events.premiumHolidays,
    ...normalized.events.recurringSinglePremiumResumptions,
  ]
    .filter((event) => (
      event.startPolicyMonth >= recurringEvent.startPolicyMonth
      && event.startPolicyMonth <= policyMonth
      && (
        event.type === 'premium-holiday'
        || event.type === 'recurring-single-premium-resumption'
      )
    ))
    .sort((left, right) => left.startPolicyMonth - right.startPolicyMonth)

  let isActive = true

  for (const event of gateEvents) {
    if (event.type === 'premium-holiday') {
      isActive = false
      continue
    }

    if (
      normalized.input.policyStateSupport?.requiresCommencementPremiumForRecurringSinglePremiumResumption === true
    ) {
      const currentRegularPremiumAmount = getCurrentRegularPremiumAnnualAmountAtMonth(
        normalized,
        event.startPolicyMonth,
      )

      if (
        Math.abs(
          currentRegularPremiumAmount - normalized.regularPremiums.committedAnnualPremiumAtIssue,
        ) > CONTRIBUTION_TOLERANCE
      ) {
        isActive = false
        continue
      }
    }

    isActive = true
  }

  return isActive
}

function getRecurringSinglePremiumActiveMonthsForEvent(
  normalized: IlpNormalizedPolicyInput,
  recurringEvent: IlpPolicyEvent,
  rangeStartPolicyMonth: number,
  rangeEndPolicyMonth: number,
): number {
  let activeMonths = 0

  for (let policyMonth = rangeStartPolicyMonth; policyMonth <= rangeEndPolicyMonth; policyMonth += 1) {
    if (isRecurringSinglePremiumEventActiveAtMonth(normalized, recurringEvent, policyMonth)) {
      activeMonths += 1
    }
  }

  return activeMonths
}

function getScheduledAnnualPremiumAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  const baseAnnualPremium = normalized.input.monthlyContribution * 12
  const monthlyReduction = getAnnualPremiumReductionAtMonth(normalized, policyMonth) / 12
  const recurringSinglePremiumReductionAbsorbed = Math.min(monthlyReduction, getRecurringSinglePremiumAmountAtMonth(normalized, policyMonth))
  const residualRegularPremiumReduction = (monthlyReduction - recurringSinglePremiumReductionAbsorbed) * 12
  const reducedAnnualPremium = baseAnnualPremium - residualRegularPremiumReduction + getAnnualPremiumIncreaseAtMonth(normalized, policyMonth)
  return Math.max(0, reducedAnnualPremium)
}

function getScheduledMonthlyPremiumAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return getScheduledAnnualPremiumAtMonth(normalized, policyMonth) / 12
}

function getCumulativePaidRegularPremiumAtMonth(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
): number {
  return normalized.regularPremiums.cumulativePaidByPolicyMonth.get(policyMonth) ?? 0
}

function getRegularPremiumReductionForYear(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): number {
  const baseAnnualPremium = normalized.input.monthlyContribution * 12
  let totalReduction = 0

  for (let policyMonth = range.startPolicyMonth; policyMonth <= range.endPolicyMonth; policyMonth += 1) {
    totalReduction += (baseAnnualPremium - getScheduledAnnualPremiumAtMonth(normalized, policyMonth)) / 12
  }

  return totalReduction
}

function getPremiumHolidayRepayments(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): IlpRepaymentEvent[] {
  return normalized.events.premiumHolidays
    .filter((event) => event.repayMissedPremiums)
    .map((event) => ({
      type: 'premium-holiday-repayment' as const,
      startPolicyMonth: event.startPolicyMonth + event.durationMonths,
      durationMonths: event.durationMonths,
      amount: Array.from({ length: event.durationMonths }, (_, index) => (
        getScheduledMonthlyPremiumAtMonth(normalized, event.startPolicyMonth + index)
      )).reduce((sum, value) => sum + value, 0),
      accountId: event.repaymentAccountId,
      sourceEventId: event.id,
    }))
    .filter((event) => event.startPolicyMonth >= range.startPolicyMonth && event.startPolicyMonth <= range.endPolicyMonth)
}

function getPolicyRepayments(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): IlpRepaymentEvent[] {
  return normalized.events.policyRepayments
    .filter((event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth >= range.startPolicyMonth
      && event.startPolicyMonth <= range.endPolicyMonth
    ))
    .map((event) => ({
      type: 'policy-repayment' as const,
      startPolicyMonth: event.startPolicyMonth,
      durationMonths: 1,
      amount: event.amount ?? 0,
      accountId: event.accountId,
      sourceEventId: event.id,
    }))
}

function isTokioAssuranceFormula(
  formula: IlpAssuranceChargeConfig['formula'],
): formula is Extract<IlpAssuranceChargeConfig['formula'], 'tokio-mpc-net-premium-floor' | 'tokio-mpc-locked-in-policy-value' | 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'> {
  return formula === 'tokio-mpc-net-premium-floor'
    || formula === 'tokio-mpc-locked-in-policy-value'
    || formula === 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
}

function usesStaticTokioMultiLifeProfile(
  profile: IlpAssuranceProfile,
  formula: IlpAssuranceChargeConfig['formula'],
) {
  return profile.lifeAssuredMode === 'multi-life' && isTokioAssuranceFormula(formula)
}

function getAssuranceRateSex(
  profile: IlpAssuranceProfile,
  formula: IlpAssuranceChargeConfig['formula'],
) {
  if (usesStaticTokioMultiLifeProfile(profile, formula)) {
    return profile.currentOldestLifeSex ?? profile.sex
  }

  return profile.sex
}

function getAssuranceRateAgeNextBirthday(
  profile: IlpAssuranceProfile,
  formula: IlpAssuranceChargeConfig['formula'],
  projectionYear = 1,
) {
  const baseAge = usesStaticTokioMultiLifeProfile(profile, formula)
    ? profile.currentOldestLifeAgeNextBirthday ?? profile.currentAgeNextBirthday
    : profile.currentAgeNextBirthday
  return baseAge + projectionYear - 1
}

function getAssuranceCoverageAgeNextBirthday(
  profile: IlpAssuranceProfile,
  formula: IlpAssuranceChargeConfig['formula'],
  projectionYear = 1,
) {
  const baseAge = usesStaticTokioMultiLifeProfile(profile, formula)
    ? profile.currentYoungestLifeAgeNextBirthday ?? profile.currentAgeNextBirthday
    : profile.currentAgeNextBirthday
  return baseAge + projectionYear - 1
}

function getAssuranceRiskClass(
  sex: 'male' | 'female',
  smokerStatus: 'smoker' | 'non-smoker',
) {
  return `${sex}-${smokerStatus}` as const
}

function getAssuranceFormulaFamily(
  config: IlpAssuranceChargeConfig,
): IlpAssuranceFormulaFamily {
  switch (config.formula) {
    case 'prudential-prosper-death':
    case 'prudential-prosper-accidental-death':
      return 'prudential-prosper'
    case 'prudential-assure-ii-combined':
      return 'prudential-assure-ii'
    case 'prudential-linkguard-combined':
      return 'prudential-linkguard'
    case 'aia-plp2-plus-death':
    case 'aia-plp2-max-death':
      return 'aia-plp2'
    case 'aia-pro-achiever-3-benefit-charge':
      return 'aia-pro-achiever-3'
    case 'aia-venture-benefit-charge':
      return 'aia-venture'
    case 'hsbc-flexi-choice-death-ti':
    case 'hsbc-flexi-max-death-ti':
      return 'hsbc-flexi'
    case 'great-eastern-wa4-death-ti':
    case 'fwd-invest-flexi-elite-death':
    case 'income-invest-flex-death-ti':
      return 'protected-base-paid-premium-floor'
    case 'fwd-invest-repayment-inclusive-death':
      return 'protected-base-paid-premium-floor-with-repayment'
    case 'great-eastern-gla4-death-ti':
      return 'protected-base-basic-sum-assured-with-topups'
    case 'great-eastern-pla-death-ti':
    case 'income-legacy-flex-solitaire-death-ti':
      return 'protected-base-sum-assured'
    case 'manulife-investready-iii-death-ti':
    case 'singlife-savvy-invest-ii-death-ti':
      return 'protected-base-paid-premium-floor'
    case 'manulife-smartretire-death':
      return 'manulife-smartretire-death'
    case 'manulife-smartretire-wop-tpd':
      return 'manulife-smartretire-wop-tpd'
    case 'manulife-manuinvest-duo-death-ti-tpd':
      return 'protected-base-sum-assured'
    case 'tokio-mpc-net-premium-floor':
      return 'tokio-mpc-net-premium-floor'
    case 'tokio-mpc-locked-in-policy-value':
      return 'tokio-mpc-locked-in-policy-value'
    case 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium':
      return 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
    default:
      return assertNever(config.formula)
  }
}

function resolveAssuranceRate(
  rule: IlpChargeRule,
  profile: IlpAssuranceProfile,
  policyYear: number,
  projectionYear: number,
  currentSumAssured?: number,
): number {
  if (!rule.assuranceConfig) {
    return 0
  }

  const ageNextBirthday = getAssuranceRateAgeNextBirthday(
    profile,
    rule.assuranceConfig.formula,
    projectionYear,
  )
  const riskClass = getAssuranceRiskClass(
    getAssuranceRateSex(profile, rule.assuranceConfig.formula),
    profile.smokerStatus,
  )

  switch (rule.assuranceConfig.formula) {
    case 'prudential-prosper-death':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(PRUVANTAGE_PROSPER_DEATH_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'prudential-prosper-accidental-death':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'prudential-assure-ii-combined':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'prudential-linkguard-combined':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(PRUACTIVE_LINKGUARD_COMBINED_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'aia-plp2-plus-death':
    case 'aia-plp2-max-death':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(AIA_PLP2_DEATH_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'aia-pro-achiever-3-benefit-charge':
    case 'aia-venture-benefit-charge':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(AIA_VENTURE_BENEFIT_CHARGE_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'hsbc-flexi-choice-death-ti':
    case 'hsbc-flexi-max-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(HSBC_FLEXI_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'great-eastern-wa4-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(GREAT_EASTERN_WA4_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'great-eastern-gla4-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(GREAT_EASTERN_WA4_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'great-eastern-pla-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(GREAT_EASTERN_PRESTIGE_LEGACY_STANDARD_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'fwd-invest-flexi-elite-death':
    case 'fwd-invest-repayment-inclusive-death':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(FWD_FLEXI_ELITE_DEATH_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'income-invest-flex-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(INCOME_INVEST_FLEX_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'income-legacy-flex-solitaire-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(INCOME_LEGACY_FLEX_SOLITAIRE_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'manulife-investready-iii-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(MANULIFE_INVESTREADY_III_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'singlife-savvy-invest-ii-death-ti':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(SINGLIFE_SAVVY_INVEST_II_DEATH_TI_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'manulife-smartretire-death':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(MANULIFE_SMARTRETIRE_DEATH_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'manulife-smartretire-wop-tpd':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(MANULIFE_SMARTRETIRE_WOP_TPD_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'manulife-manuinvest-duo-death-ti-tpd':
      return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(MANULIFE_MANUINVEST_DUO_DEATH_TI_TPD_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
    case 'tokio-mpc-net-premium-floor':
    case 'tokio-mpc-locked-in-policy-value':
    case 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium':
      switch (rule.assuranceConfig.rateTable) {
        case 'tokio-mpc-unzo-death':
          return applyAssuranceRateMultipliers(rule, lookupAssuranceRate(TOKIO_MPC_UNZO_DEATH_RATE_TABLE, riskClass, ageNextBirthday), policyYear, currentSumAssured)
        default:
          return 0
      }
    default:
      return assertNever(rule.assuranceConfig.formula)
  }
}

function lookupAssuranceRate(
  table: IlpAssuranceRateTable,
  riskClass: 'male-smoker' | 'male-non-smoker' | 'female-smoker' | 'female-non-smoker',
  ageNextBirthday: number,
): number {
  const rates = table[riskClass] ?? []
  const ageIndex = Math.max(Math.round(ageNextBirthday), 1) - 1
  if (rates[ageIndex] != null) {
    return rates[ageIndex]!
  }

  for (let index = Math.min(ageIndex, rates.length - 1); index >= 0; index -= 1) {
    if (rates[index] != null) {
      return rates[index]!
    }
  }

  return 0
}

function applyAssuranceRateMultipliers(
  rule: IlpChargeRule,
  baseRate: number,
  policyYear: number,
  currentSumAssured?: number,
): number {
  const config = rule.assuranceConfig
  if (!config) {
    return baseRate
  }

  let multiplier = 1

  for (const tier of config.policyYearRateMultiplierSchedule ?? []) {
    if (policyYear >= tier.startPolicyYear && (tier.endPolicyYear == null || policyYear <= tier.endPolicyYear)) {
      multiplier *= tier.multiplier
      break
    }
  }

  if (currentSumAssured != null) {
    for (const tier of config.sumAssuredRateMultiplierTiers ?? []) {
      if (currentSumAssured >= tier.minSumAssured && (tier.maxSumAssured == null || currentSumAssured <= tier.maxSumAssured)) {
        multiplier *= tier.multiplier
        break
      }
    }
  }

  return baseRate * multiplier
}

function getAssuranceRelevantAccountIds(normalized: IlpNormalizedPolicyInput): string[] {
  return normalized.assurance.relevantAccountIds
}

function sumBalancesForAccounts(
  balances: Map<string, number>,
  accountIds: string[],
): number {
  return accountIds.reduce((sum, accountId) => sum + (balances.get(accountId) ?? 0), 0)
}

function sumWithdrawalsForAccounts(
  withdrawals: Map<string, number>,
  accountIds: string[],
): number {
  return accountIds.reduce((sum, accountId) => sum + (withdrawals.get(accountId) ?? 0), 0)
}

function computePrudentialProsperSumAtRisk(
  formula: Extract<IlpAssuranceChargeConfig['formula'], 'prudential-prosper-death' | 'prudential-prosper-accidental-death'>,
  midpointRegularPremiumBase: number,
  midpointApplicableValue: number,
): number {
  const multiplier = formula === 'prudential-prosper-accidental-death'
    ? PRUDENTIAL_PROSPER_SUM_AT_RISK_MULTIPLIERS.accidentalDeath
    : PRUDENTIAL_PROSPER_SUM_AT_RISK_MULTIPLIERS.death
  return Math.max(0, Math.max(midpointRegularPremiumBase * multiplier, midpointApplicableValue) - midpointApplicableValue)
}

function computeHsbcFlexiSumAtRisk(
  formula: Extract<IlpAssuranceChargeConfig['formula'], 'hsbc-flexi-choice-death-ti' | 'hsbc-flexi-max-death-ti'>,
  profile: IlpAssuranceProfile,
  midpointApplicableValue: number,
  midpointSupplementaryPremiumBase: number,
): number {
  if (formula === 'hsbc-flexi-max-death-ti') {
    return Math.max(0, profile.currentBasicSumAssured ?? 0)
  }

  return Math.max(0, (profile.currentBasicSumAssured ?? 0) + midpointSupplementaryPremiumBase - midpointApplicableValue)
}

function computePrudentialLinkGuardSumAtRisk(
  profile: IlpAssuranceProfile,
  ageNextBirthday: number,
): number {
  const baseSumAssured = Math.max(0, profile.currentSumAssured ?? 0)
  // PRUActive LinkGuard's published worked example prices the guaranteed
  // Death / TPD / TI charge on the gross Multiplier Benefit before expiry and
  // on gross Sum Assured from the expiry age onward, not on AV-netted SAR.
  return baseSumAssured * (ageNextBirthday < 50 ? 2 : 1)
}

function computeAiaPlp2SumAtRisk(
  formula: Extract<IlpAssuranceChargeConfig['formula'], 'aia-plp2-plus-death' | 'aia-plp2-max-death'>,
  profile: IlpAssuranceProfile,
  midpointApplicableValue: number,
  midpointSupplementaryPremiumBase: number,
): number {
  if (formula === 'aia-plp2-plus-death') {
    return Math.max(0, profile.currentSumAssured ?? 0)
  }

  return Math.max(0, (profile.currentSumAssured ?? 0) + midpointSupplementaryPremiumBase - midpointApplicableValue)
}

function computeAiaVentureBenefitChargeSumAtRisk(
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
): number {
  const midpointProtectedBase = Math.max(
    0,
    regularPremiumBaseAtStartOfYear
      + supplementaryPremiumBaseAtStartOfYear
      + ((regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
  )

  return Math.max(0, midpointProtectedBase - midpointApplicableValue)
}

function computeAiaProAchiever3BenefitChargeSumAtRisk(
  protectedPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  supplementaryPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
): number {
  const midpointProtectedBase = Math.max(
    0,
    protectedPremiumBaseAtStartOfYear
      + ((regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
  )

  return Math.max(0, midpointProtectedBase - midpointApplicableValue)
}

function computeProtectedBaseSumAtRisk(
  formula: Extract<IlpAssuranceChargeConfig['formula'], 'great-eastern-wa4-death-ti' | 'great-eastern-gla4-death-ti' | 'great-eastern-pla-death-ti' | 'fwd-invest-flexi-elite-death' | 'income-invest-flex-death-ti' | 'income-legacy-flex-solitaire-death-ti' | 'manulife-investready-iii-death-ti' | 'singlife-savvy-invest-ii-death-ti' | 'manulife-manuinvest-duo-death-ti-tpd'>,
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
  sumAssuredAtStartOfYear: number | undefined,
): number {
  switch (formula) {
    case 'great-eastern-wa4-death-ti':
    case 'fwd-invest-flexi-elite-death':
    case 'income-invest-flex-death-ti':
    case 'manulife-investready-iii-death-ti':
    case 'singlife-savvy-invest-ii-death-ti': {
      const midpointProtectedBase = Math.max(
        0,
        regularPremiumBaseAtStartOfYear
          + supplementaryPremiumBaseAtStartOfYear
          + ((regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
      )

      return Math.max(0, (midpointProtectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER) - midpointApplicableValue)
    }

    case 'great-eastern-pla-death-ti':
    case 'income-legacy-flex-solitaire-death-ti':
      return Math.max(0, (sumAssuredAtStartOfYear ?? 0) - midpointApplicableValue)

    case 'great-eastern-gla4-death-ti': {
      const midpointSupplementaryPremiumBase = Math.max(
        0,
        supplementaryPremiumBaseAtStartOfYear + ((supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
      )
      const midpointProtectedBase = Math.max(0, (sumAssuredAtStartOfYear ?? 0) + midpointSupplementaryPremiumBase)
      return Math.max(0, midpointProtectedBase - midpointApplicableValue)
    }

    case 'manulife-manuinvest-duo-death-ti-tpd': {
      const midpointProtectedBase = Math.max(
        0,
        (sumAssuredAtStartOfYear ?? 0) - (currentYearApplicableWithdrawals / 2),
      )
      return Math.max(0, midpointProtectedBase - midpointApplicableValue)
    }
    default:
      return assertNever(formula)
  }
}

function computeProtectedBaseRepaymentInclusiveSumAtRisk(
  repaymentBaseAtStartOfYear: number,
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
): number {
  const midpointProtectedBase = Math.max(
    0,
    repaymentBaseAtStartOfYear
      + regularPremiumBaseAtStartOfYear
      + supplementaryPremiumBaseAtStartOfYear
      + ((regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
  )

  return Math.max(0, (midpointProtectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER) - midpointApplicableValue)
}

function computeSmartRetireDeathSumAtRisk(
  normalized: IlpNormalizedPolicyInput,
  policyYear: number,
  ageNextBirthday: number,
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
  sumAssuredAtStartOfYear: number | undefined,
): number {
  const profile = normalized.assurance.profile
  if (!profile) {
    return 0
  }

  if (profile.targetRetirementAge != null && ageNextBirthday >= profile.targetRetirementAge) {
    return 0
  }

  if (policyYear <= normalized.input.mipLength) {
    const midpointProtectedBase = Math.max(
      0,
      regularPremiumBaseAtStartOfYear
        + supplementaryPremiumBaseAtStartOfYear
        + ((regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
    )

    return Math.max(0, (midpointProtectedBase * MANULIFE_SMARTRETIRE_DEATH_BENEFIT_FLOOR_MULTIPLIER) - midpointApplicableValue)
  }

  if (profile.targetRetirementAge == null || sumAssuredAtStartOfYear == null) {
    return 0
  }

  return Math.max(
    0,
    Math.max(0, (sumAssuredAtStartOfYear - (currentYearApplicableWithdrawals / 2))) - midpointApplicableValue,
  )
}

function computeSmartRetireWopTpdSumAtRisk(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  ruleEndPolicyYear: number | null | undefined,
): number {
  if (ruleEndPolicyYear == null) {
    return 0
  }

  const coverageEndPolicyMonth = ruleEndPolicyYear * 12
  let cumulativeRemainingPremiumBase = 0
  let observedMonths = 0

  for (let policyMonth = context.range.startPolicyMonth; policyMonth <= context.range.endPolicyMonth; policyMonth += 1) {
    observedMonths += 1

    let remainingPremiumBaseAtMonth = 0
    for (let futurePolicyMonth = policyMonth; futurePolicyMonth <= coverageEndPolicyMonth; futurePolicyMonth += 1) {
      remainingPremiumBaseAtMonth += getScheduledMonthlyPremiumAtMonth(normalized, futurePolicyMonth)
    }

    cumulativeRemainingPremiumBase += Math.min(1_000_000, Math.max(0, remainingPremiumBaseAtMonth))
  }

  return observedMonths > 0
    ? cumulativeRemainingPremiumBase / observedMonths
    : 0
}

function computeTokioMpcNetPremiumFloorSumAtRisk(
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
): number {
  const midpointNetPremiumBase = Math.max(
    0,
    regularPremiumBaseAtStartOfYear + ((regularPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
  )

  return Math.max(0, midpointNetPremiumBase - (midpointApplicableValue * TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER))
}

function getInitialTokioProtectionStateForRule(
  normalized: IlpNormalizedPolicyInput,
  rule: IlpNormalizedAssuranceRule,
  openBalances: Map<string, number>,
): IlpTokioProtectionState | undefined {
  const tokioProtectionState = rule.rule.assuranceConfig.tokioProtectionState
  if (!tokioProtectionState) {
    return undefined
  }

  const trackedValue = sumBalancesForAccounts(openBalances, rule.tokioTrackedValueAccountIds)
  const lockedInPolicyValue = Math.max(
    normalized.assurance.profile?.currentLockedInPolicyValue
      ?? normalized.input.initialSinglePremium
      ?? trackedValue,
    0,
  )
  const adjustedSinglePremium = tokioProtectionState.mode === 'locked-in-policy-value-with-adjusted-single-premium'
    ? Math.max(
        normalized.assurance.profile?.currentAdjustedSinglePremium
          ?? normalized.input.initialSinglePremium
          ?? 0,
        0,
      )
    : undefined

  return {
    lockedInPolicyValue,
    adjustedSinglePremium,
  }
}

function computeTokioProtectionStateAndRisk(
  rule: IlpNormalizedAssuranceRule,
  startState: IlpTokioProtectionState,
  openBalances: Map<string, number>,
  provisionalCloseByAccount: Map<string, number>,
  carriedIndebtedness: number,
): {
  sumAtRisk: number
  nextState: IlpTokioProtectionState
} {
  const trackedValueAtOpen = sumBalancesForAccounts(openBalances, rule.tokioTrackedValueAccountIds)
  const trackedValueAtClose = sumBalancesForAccounts(provisionalCloseByAccount, rule.tokioTrackedValueAccountIds)
  const withdrawalReductionValueAtOpen = sumBalancesForAccounts(openBalances, rule.tokioWithdrawalReductionAccountIds)
  const withdrawalReductionValueAtClose = sumBalancesForAccounts(provisionalCloseByAccount, rule.tokioWithdrawalReductionAccountIds)

  const withdrawalRatio = withdrawalReductionValueAtOpen <= CONTRIBUTION_TOLERANCE
    ? 1
    : Math.max(0, Math.min(1, withdrawalReductionValueAtClose / withdrawalReductionValueAtOpen))
  const hasWithdrawalReduction = withdrawalReductionValueAtClose + CONTRIBUTION_TOLERANCE < withdrawalReductionValueAtOpen

  const reducedLockedInPolicyValue = Math.max(0, startState.lockedInPolicyValue * withdrawalRatio)
  const nextLockedInPolicyValue = hasWithdrawalReduction
    ? Math.max(reducedLockedInPolicyValue, trackedValueAtClose)
    : Math.max(reducedLockedInPolicyValue, trackedValueAtOpen, trackedValueAtClose)
  const nextAdjustedSinglePremium = startState.adjustedSinglePremium == null
    ? undefined
    : Math.max(0, startState.adjustedSinglePremium * withdrawalRatio)
  const midpointTrackedValue = Math.max(0, (trackedValueAtOpen + trackedValueAtClose) / 2)
  const midpointLockedInPolicyValue = Math.max(0, (startState.lockedInPolicyValue + nextLockedInPolicyValue) / 2)
  const midpointAdjustedSinglePremium = nextAdjustedSinglePremium == null
    ? 0
    : Math.max(0, ((startState.adjustedSinglePremium ?? 0) + nextAdjustedSinglePremium) / 2)
  const protectedFloor = rule.family === 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
    ? Math.max(midpointLockedInPolicyValue, midpointAdjustedSinglePremium)
    : midpointLockedInPolicyValue

  return {
    sumAtRisk: Math.max(0, protectedFloor - carriedIndebtedness - midpointTrackedValue),
    nextState: {
      lockedInPolicyValue: nextLockedInPolicyValue,
      adjustedSinglePremium: nextAdjustedSinglePremium,
    },
  }
}

function buildInitialTokioProtectionStateByRule(
  normalized: IlpNormalizedPolicyInput,
  openBalances: Map<string, number>,
): Map<string, IlpTokioProtectionState> {
  const stateByRule = new Map<string, IlpTokioProtectionState>()

  normalized.assurance.rules.forEach((rule) => {
    const state = getInitialTokioProtectionStateForRule(normalized, rule, openBalances)
    if (state) {
      stateByRule.set(rule.rule.id, state)
    }
  })

  return stateByRule
}

function computePrudentialAssureIiStateAndRisk(
  nextSumAssured: number,
  nextWealthAssureValue: number,
  nextGrowthFrozen: boolean,
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  openApplicableValue: number,
  provisionalApplicableValue: number,
  midpointApplicableValue: number,
  assuranceStateEvents: IlpPolicyEvent[],
): {
  sumAtRisk: number
  nextSumAssured: number
  nextWealthAssureValue: number
  nextGrowthFrozen: boolean
} {
  const endOfYearRegularPremiumBase = Math.max(
    0,
    regularPremiumBaseAtStartOfYear + regularPremiumPaidThisYear - currentYearApplicableWithdrawals,
  )
  const automaticNextState: IlpAssuranceStateResult = nextGrowthFrozen
    ? {
      sumAssured: Math.max(0, nextSumAssured - currentYearApplicableWithdrawals),
      wealthAssureValue: Math.max(0, nextWealthAssureValue - currentYearApplicableWithdrawals),
      growthFrozen: true,
    }
    : {
      sumAssured: Math.max(
        0,
        Math.min(
          Math.max(
            endOfYearRegularPremiumBase * PRUDENTIAL_ASSURE_II_MULTIPLIERS.floorRate,
            nextSumAssured + (regularPremiumBaseAtStartOfYear * PRUDENTIAL_ASSURE_II_MULTIPLIERS.growthRate),
          ),
          endOfYearRegularPremiumBase * PRUDENTIAL_ASSURE_II_MULTIPLIERS.capRate,
        ) - currentYearApplicableWithdrawals,
      ),
      wealthAssureValue: Math.max(
        Math.max(0, nextWealthAssureValue - currentYearApplicableWithdrawals),
        openApplicableValue,
        provisionalApplicableValue,
      ),
      growthFrozen: false,
    }

  const endState = assuranceStateEvents.reduce<IlpAssuranceStateResult>((state, event) => {
    if (event.type === 'assurance-benefit-reduction') {
      return {
        sumAssured: event.resultingSumAssured ?? state.sumAssured,
        wealthAssureValue: event.resultingWealthAssureValue ?? state.wealthAssureValue,
        growthFrozen: true,
      }
    }

    return {
      sumAssured: event.resultingSumAssured ?? state.sumAssured,
      wealthAssureValue: state.wealthAssureValue,
      growthFrozen: false,
    }
  }, automaticNextState)

  const midpointWealthAssureValue = Math.max(0, ((nextWealthAssureValue ?? 0) + (endState.wealthAssureValue ?? 0)) / 2)
  const midpointSumAssured = Math.max(0, ((nextSumAssured ?? 0) + (endState.sumAssured ?? 0)) / 2)

  return {
    sumAtRisk: Math.max(0, Math.max(midpointSumAssured, midpointWealthAssureValue, midpointApplicableValue) - midpointApplicableValue),
    nextSumAssured: endState.sumAssured ?? 0,
    nextWealthAssureValue: endState.wealthAssureValue ?? 0,
    nextGrowthFrozen: endState.growthFrozen,
  }
}

function computeAssuranceChargeByAccount(
  normalized: IlpNormalizedPolicyInput,
  policyYear: number,
  projectionYear: number,
  context: IlpCashflowYearContext,
  openBalances: Map<string, number>,
  provisionalCloseByAccount: Map<string, number>,
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  repaymentBaseAtStartOfYear: number,
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  protectedPremiumBaseAtStartOfYear: number,
  withdrawalByAccount: Map<string, number>,
  sumAssuredAtStartOfYear: number | undefined,
  wealthAssureValueAtStartOfYear: number | undefined,
  growthFrozenAtStartOfYear: boolean,
  tokioProtectionStateByRule: Map<string, IlpTokioProtectionState>,
  accruedChargeBalanceByRule: Map<string, number>,
  disabledAssuranceRuleIds: Set<string>,
): {
  charges: Map<string, number>
  chargesByRule: Map<string, number>
  nextSumAssured: number | undefined
  nextWealthAssureValue: number | undefined
  nextGrowthFrozen: boolean
  nextTokioProtectionStateByRule: Map<string, IlpTokioProtectionState>
  nextAccruedChargeBalanceByRule: Map<string, number>
  nextDisabledAssuranceRuleIds: Set<string>
} {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const chargesByRule = new Map<string, number>()
  const nextAccruedChargeBalanceByRule = new Map(accruedChargeBalanceByRule)
  const nextDisabledAssuranceRuleIds = new Set(disabledAssuranceRuleIds)
  const profile = normalized.assurance.profile
  if (!profile) {
    return {
      charges,
      chargesByRule,
      nextSumAssured: sumAssuredAtStartOfYear,
      nextWealthAssureValue: wealthAssureValueAtStartOfYear,
      nextGrowthFrozen: growthFrozenAtStartOfYear,
      nextTokioProtectionStateByRule: new Map(tokioProtectionStateByRule),
      nextAccruedChargeBalanceByRule,
      nextDisabledAssuranceRuleIds,
    }
  }

  let nextSumAssured = sumAssuredAtStartOfYear
  let nextWealthAssureValue = wealthAssureValueAtStartOfYear
  let nextGrowthFrozen = growthFrozenAtStartOfYear
  const nextTokioProtectionStateByRule = new Map(tokioProtectionStateByRule)
  const assuranceStateEvents = getAssuranceStateEventsForYear(normalized, context.range)
  const carriedTotalIndebtedness = Array.from(accruedChargeBalanceByRule.values()).reduce((sum, value) => sum + value, 0)

  for (const normalizedRule of normalized.assurance.rules) {
    const {
      rule,
      family,
      appliesTo,
      appliesToIds,
      assuranceValueAppliesToIds,
      fallbackAppliesTo,
    } = normalizedRule
    const isPostMip = isPostMipPolicyYear(input, policyYear)
    const isActive = rule.activeWindow === 'policy-term'
      || (rule.activeWindow === 'during-mip' && !isPostMip)
      || (rule.activeWindow === 'after-mip' && isPostMip)
    if (!isActive) continue
    if (rule.startPolicyYear != null && policyYear < rule.startPolicyYear) continue
    if (rule.endPolicyYear != null && policyYear > rule.endPolicyYear) continue
    const ruleCoverageAgeNextBirthday = getAssuranceCoverageAgeNextBirthday(
      profile,
      rule.assuranceConfig.formula,
      projectionYear,
    )
    if (rule.assuranceConfig.maxAgeNextBirthday != null && ruleCoverageAgeNextBirthday > rule.assuranceConfig.maxAgeNextBirthday) continue

    const openApplicableValue = sumBalancesForAccounts(openBalances, assuranceValueAppliesToIds)
    const provisionalApplicableValue = sumBalancesForAccounts(provisionalCloseByAccount, assuranceValueAppliesToIds)
    const midpointApplicableValue = Math.max(0, (openApplicableValue + provisionalApplicableValue) / 2)
    const currentYearApplicableWithdrawals = sumWithdrawalsForAccounts(withdrawalByAccount, appliesToIds)
    const supplementaryApplicableWithdrawals = normalized.multiAccount.supplementaryPremiumAccountIds.length > 0
      ? sumWithdrawalsForAccounts(withdrawalByAccount, normalized.multiAccount.supplementaryPremiumAccountIds)
      : currentYearApplicableWithdrawals
    const midpointRegularPremiumBase = Math.max(
      0,
      regularPremiumBaseAtStartOfYear + ((regularPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
    )
    const carriedAccruedCharge = nextAccruedChargeBalanceByRule.get(rule.id) ?? 0
    const isDisabledAfterInsufficientDeduction = nextDisabledAssuranceRuleIds.has(rule.id)
    const currentTokioProtectionState = nextTokioProtectionStateByRule.get(rule.id)
      ?? getInitialTokioProtectionStateForRule(normalized, normalizedRule, openBalances)

    let sumAtRisk = 0

    if (!isDisabledAfterInsufficientDeduction) switch (family) {
      case 'prudential-prosper':
        sumAtRisk = computePrudentialProsperSumAtRisk(
          rule.assuranceConfig.formula as Extract<IlpAssuranceChargeConfig['formula'], 'prudential-prosper-death' | 'prudential-prosper-accidental-death'>,
          midpointRegularPremiumBase,
          midpointApplicableValue,
        )
        break

      case 'hsbc-flexi': {
        const midpointSupplementaryPremiumBase = Math.max(
          0,
          supplementaryPremiumBaseAtStartOfYear + ((supplementaryPremiumPaidThisYear - supplementaryApplicableWithdrawals) / 2),
        )
        sumAtRisk = computeHsbcFlexiSumAtRisk(
          rule.assuranceConfig.formula as Extract<IlpAssuranceChargeConfig['formula'], 'hsbc-flexi-choice-death-ti' | 'hsbc-flexi-max-death-ti'>,
          profile,
          midpointApplicableValue,
          midpointSupplementaryPremiumBase,
        )
        break
      }

      case 'aia-plp2': {
        const midpointSupplementaryPremiumBase = Math.max(
          0,
          supplementaryPremiumBaseAtStartOfYear + ((supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
        )
        sumAtRisk = computeAiaPlp2SumAtRisk(
          rule.assuranceConfig.formula as Extract<IlpAssuranceChargeConfig['formula'], 'aia-plp2-plus-death' | 'aia-plp2-max-death'>,
          profile,
          midpointApplicableValue,
          midpointSupplementaryPremiumBase,
        )
        break
      }

      case 'aia-venture':
        sumAtRisk = computeAiaVentureBenefitChargeSumAtRisk(
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          supplementaryPremiumBaseAtStartOfYear,
          supplementaryPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
        )
        break

      case 'aia-pro-achiever-3':
        sumAtRisk = computeAiaProAchiever3BenefitChargeSumAtRisk(
          protectedPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          supplementaryPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
        )
        break

      case 'prudential-assure-ii': {
        if (nextWealthAssureValue == null || nextSumAssured == null) {
          continue
        }

        const assureIiState = computePrudentialAssureIiStateAndRisk(
          nextSumAssured,
          nextWealthAssureValue,
          nextGrowthFrozen,
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          openApplicableValue,
          provisionalApplicableValue,
          midpointApplicableValue,
          assuranceStateEvents,
        )
        sumAtRisk = assureIiState.sumAtRisk
        nextSumAssured = assureIiState.nextSumAssured
        nextWealthAssureValue = assureIiState.nextWealthAssureValue
        nextGrowthFrozen = assureIiState.nextGrowthFrozen
        break
      }

      case 'prudential-linkguard':
        sumAtRisk = computePrudentialLinkGuardSumAtRisk(profile, ruleCoverageAgeNextBirthday)
        break

      case 'protected-base-paid-premium-floor':
      case 'protected-base-sum-assured':
      case 'protected-base-basic-sum-assured-with-topups':
        sumAtRisk = computeProtectedBaseSumAtRisk(
          rule.assuranceConfig.formula as Extract<IlpAssuranceChargeConfig['formula'], 'great-eastern-wa4-death-ti' | 'great-eastern-gla4-death-ti' | 'great-eastern-pla-death-ti' | 'fwd-invest-flexi-elite-death' | 'income-invest-flex-death-ti' | 'income-legacy-flex-solitaire-death-ti' | 'manulife-investready-iii-death-ti' | 'singlife-savvy-invest-ii-death-ti' | 'manulife-manuinvest-duo-death-ti-tpd'>,
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          supplementaryPremiumBaseAtStartOfYear,
          supplementaryPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
          sumAssuredAtStartOfYear,
        )
        break

      case 'protected-base-paid-premium-floor-with-repayment':
        sumAtRisk = computeProtectedBaseRepaymentInclusiveSumAtRisk(
          repaymentBaseAtStartOfYear,
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          supplementaryPremiumBaseAtStartOfYear,
          supplementaryPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
        )
        break

      case 'manulife-smartretire-death':
        sumAtRisk = computeSmartRetireDeathSumAtRisk(
          normalized,
          policyYear,
          ruleCoverageAgeNextBirthday,
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          supplementaryPremiumBaseAtStartOfYear,
          supplementaryPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
          sumAssuredAtStartOfYear,
        )
        break

      case 'manulife-smartretire-wop-tpd':
        sumAtRisk = computeSmartRetireWopTpdSumAtRisk(normalized, context, rule.endPolicyYear)
        break

      case 'tokio-mpc-net-premium-floor':
        sumAtRisk = computeTokioMpcNetPremiumFloorSumAtRisk(
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
        )
        break

      case 'tokio-mpc-locked-in-policy-value':
      case 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium': {
        if (!currentTokioProtectionState) {
          continue
        }

        const tokioProtectionResult = computeTokioProtectionStateAndRisk(
          normalizedRule,
          currentTokioProtectionState,
          openBalances,
          provisionalCloseByAccount,
          carriedTotalIndebtedness,
        )
        sumAtRisk = tokioProtectionResult.sumAtRisk
        nextTokioProtectionStateByRule.set(rule.id, tokioProtectionResult.nextState)
        break
      }
    }

    const annualizedCharge = resolveAssuranceRate(
      rule,
      profile,
      policyYear,
      projectionYear,
      nextSumAssured ?? profile.currentSumAssured ?? profile.currentBasicSumAssured,
    ) / 1000
      * sumAtRisk
      * rule.assuranceConfig.monthlyModalFactor
      * 12

    const accrual = rule.assuranceConfig.accrual
    const isWithinAccrualWindow = accrual != null
      && policyYear >= accrual.startPolicyYear
      && policyYear <= accrual.endPolicyYear
    const isSettlementOrLater = accrual != null
      && policyYear >= accrual.settlementPolicyYear

    if (!isDisabledAfterInsufficientDeduction && isWithinAccrualWindow) {
      nextAccruedChargeBalanceByRule.set(rule.id, carriedAccruedCharge + annualizedCharge)
      continue
    }

    const totalChargeDue = carriedAccruedCharge + (
      isDisabledAfterInsufficientDeduction
        ? 0
        : (isSettlementOrLater ? annualizedCharge : annualizedCharge)
    )
    if (totalChargeDue <= CONTRIBUTION_TOLERANCE) {
      nextAccruedChargeBalanceByRule.set(rule.id, 0)
      continue
    }

    const { allocations, remainingCharge } = applyChargeAllocationsWithFallbackDetailed(
      totalChargeDue,
      rule.allocation,
      appliesTo,
      fallbackAppliesTo,
      openBalances,
      true,
    )

    for (const [accountId, amount] of allocations.entries()) {
      charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
    }
    chargesByRule.set(
      rule.id,
      (chargesByRule.get(rule.id) ?? 0) + Array.from(allocations.values()).reduce((sum, value) => sum + value, 0),
    )

    if (
      rule.assuranceConfig.disableFutureChargesOnInsufficientDeduction
      && remainingCharge > CONTRIBUTION_TOLERANCE
    ) {
      nextDisabledAssuranceRuleIds.add(rule.id)
    }

    nextAccruedChargeBalanceByRule.set(
      rule.id,
      (accrual != null || rule.assuranceConfig.disableFutureChargesOnInsufficientDeduction)
        ? remainingCharge
        : 0,
    )
  }

  return {
    charges,
    chargesByRule,
    nextSumAssured,
    nextWealthAssureValue,
    nextGrowthFrozen,
    nextTokioProtectionStateByRule,
    nextAccruedChargeBalanceByRule,
    nextDisabledAssuranceRuleIds,
  }
}

function resolveTieredBonusRate(
  bonus: Pick<IlpBonusRule, 'rate' | 'tieredRates'>,
  tierBasis: IlpNormalizedBonusTierBasis,
  primaryTierInput: number,
  annualPremiumInput: number,
  currency: IlpPolicyInput['currency'],
  accountValue?: number,
): number {
  if (!bonus.tieredRates || bonus.tieredRates.length === 0 || tierBasis === 'flat') {
    return bonus.rate
  }

  const matchedTier = bonus.tieredRates.find((tier) => {
    if (tier.currency !== currency) return false

    const matchesAnnualPremium = (() => {
      if (
        tierBasis === 'account-value'
        || tierBasis === 'sum-assured'
        || tierBasis === 'sum-assured-and-account-value'
        || tierBasis === 'sum-assured-multiple'
      ) {
        return true
      }

      const aboveMin = tier.minAnnualPremium == null || annualPremiumInput >= tier.minAnnualPremium
      const belowMax = tier.maxAnnualPremium == null || annualPremiumInput <= tier.maxAnnualPremium
      return aboveMin && belowMax
    })()

    const matchesSumAssured = (() => {
      if (
        tierBasis === 'annual-premium'
        || tierBasis === 'account-value'
        || tierBasis === 'annual-premium-and-account-value'
        || tierBasis === 'sum-assured-multiple'
        || tierBasis === 'annual-premium-and-sum-assured-multiple'
      ) {
        return true
      }

      const aboveMin = tier.minSumAssured == null || primaryTierInput >= tier.minSumAssured
      const belowMax = tier.maxSumAssured == null || primaryTierInput <= tier.maxSumAssured
      return aboveMin && belowMax
    })()

    const matchesSumAssuredMultiple = (() => {
      if (
        tierBasis === 'flat'
        || tierBasis === 'annual-premium'
        || tierBasis === 'sum-assured'
        || tierBasis === 'account-value'
        || tierBasis === 'annual-premium-and-account-value'
        || tierBasis === 'sum-assured-and-account-value'
      ) {
        return true
      }

      const aboveMin = tier.minSumAssuredMultiple == null || primaryTierInput >= tier.minSumAssuredMultiple
      const belowMax = tier.maxSumAssuredMultiple == null || primaryTierInput <= tier.maxSumAssuredMultiple
      return aboveMin && belowMax
    })()

    const matchesAccountValue = (() => {
      if (
        tierBasis === 'annual-premium'
        || tierBasis === 'sum-assured'
        || tierBasis === 'sum-assured-multiple'
        || tierBasis === 'annual-premium-and-sum-assured-multiple'
      ) {
        return true
      }

      const aboveMin = tier.minAccountValue == null || (accountValue ?? 0) >= tier.minAccountValue
      const belowMax = tier.maxAccountValue == null || (accountValue ?? 0) <= tier.maxAccountValue
      return aboveMin && belowMax
    })()

    return matchesAnnualPremium && matchesSumAssured && matchesSumAssuredMultiple && matchesAccountValue
  })

  return matchedTier?.rate ?? bonus.rate
}

function resolveNormalizedBonusRate(
  normalizedBonus: IlpNormalizedBonusRule,
  primaryTierInput: number,
  annualPremiumInput: number,
  currency: IlpPolicyInput['currency'],
  accountValue?: number,
  referenceYear?: number,
): number {
  const { bonus, tierBasis } = normalizedBonus

  const scheduledRate = bonus.policyYearRateSchedule?.find((tier) => (
    referenceYear != null
    && referenceYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || referenceYear <= tier.endPolicyYear)
  ))?.rate

  if (scheduledRate != null) {
    return scheduledRate
  }

  return resolveTieredBonusRate(bonus, tierBasis, primaryTierInput, annualPremiumInput, currency, accountValue)
}

function resolvePolicyRepaymentAmountCountedInBonusAdjustmentFactor(
  normalized: IlpNormalizedPolicyInput,
  config: NonNullable<IlpNormalizedBonusRule['bonus']['adjustmentFactorConfig']>,
  context: IlpCashflowYearContext,
  repaymentEvents: IlpRepaymentEvent[],
): number {
  const currentYearPolicyRepayments = config.includePolicyRepaymentsInPaidRegularPremium
    ? repaymentEvents.reduce((sum, event) => (
        event.type === 'policy-repayment'
          ? sum + event.amount
          : sum
      ), 0)
    : 0

  if (
    currentYearPolicyRepayments <= CONTRIBUTION_TOLERANCE
    || (config.policyRepaymentPriorOffsetRules?.length ?? 0) === 0
  ) {
    return currentYearPolicyRepayments
  }

  const priorPolicyMonthEnd = context.range.startPolicyMonth - 1
  if (priorPolicyMonthEnd <= 0) return currentYearPolicyRepayments

  const priorPolicyRepayments = normalized.events.policyRepayments
    .filter((event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= priorPolicyMonthEnd
    ))
    .reduce((sum, event) => sum + (event.amount ?? 0), 0)

  const priorOffsetAmount = (config.policyRepaymentPriorOffsetRules ?? []).reduce((sum, rule) => {
    switch (rule.trigger) {
      case 'partial-withdrawal':
        return sum + normalized.events.partialWithdrawals.reduce((eventSum, event) => {
          if (
            event.amount == null
            || event.amount <= 0
            || event.startPolicyMonth > priorPolicyMonthEnd
          ) {
            return eventSum
          }
          if ((rule.accountIds?.length ?? 0) > 0 && (!event.accountId || !rule.accountIds?.includes(event.accountId))) {
            return eventSum
          }

          return eventSum + event.amount
        }, 0)
      case 'regular-premium-reduction': {
        let reductionShortfall = 0
        const committedMonthlyPremium = normalized.input.monthlyContribution
        for (let policyMonth = 1; policyMonth <= priorPolicyMonthEnd; policyMonth += 1) {
          const scheduledMonthlyPremium = getScheduledMonthlyPremiumAtMonth(normalized, policyMonth)
          reductionShortfall += Math.max(0, committedMonthlyPremium - scheduledMonthlyPremium)
        }
        return sum + reductionShortfall
      }
    }
  }, 0)

  const outstandingPriorOffset = Math.max(0, priorOffsetAmount - priorPolicyRepayments)
  return Math.max(0, currentYearPolicyRepayments - outstandingPriorOffset)
}

function resolveBonusAdjustmentFactor(
  normalized: IlpNormalizedPolicyInput,
  normalizedBonus: IlpNormalizedBonusRule,
  context: IlpCashflowYearContext,
  regularPremiumPaidThisYear: number,
  partialWithdrawalByAccount: Map<string, number>,
  repaymentEvents: IlpRepaymentEvent[],
  availableBeforeBaseWithdrawalsByAccount: Map<string, number>,
  cumulativeBonusAdjustmentFactorByBonusId: Map<string, number>,
): number {
  const config = normalizedBonus.bonus.adjustmentFactorConfig
  if (!config) return 1

  switch (config.formula) {
    case 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium': {
      const committedAnnualPremium = normalized.input.monthlyContribution * 12
      if (committedAnnualPremium <= CONTRIBUTION_TOLERANCE) return 0

      const policyRepaymentsCountedAsRegularPremium = resolvePolicyRepaymentAmountCountedInBonusAdjustmentFactor(
        normalized,
        config,
        context,
        repaymentEvents,
      )
      const partialWithdrawals = config.withdrawalAccountIds.reduce(
        (sum, accountId) => sum + (partialWithdrawalByAccount.get(accountId) ?? 0),
        0,
      )
      const rawFactor = (
        regularPremiumPaidThisYear
        + policyRepaymentsCountedAsRegularPremium
        - partialWithdrawals
      ) / committedAnnualPremium
      return Math.max(0, Math.min(1, rawFactor))
    }
    case 'cumulative-withdrawal-factor-product-over-account-value': {
      const startingFactor = cumulativeBonusAdjustmentFactorByBonusId.get(normalizedBonus.bonus.id) ?? 1
      if (context.policyYear < (config.countFromPolicyYear ?? 1)) {
        return startingFactor
      }

      const currentYearFactor = config.withdrawalAccountIds.reduce((product, accountId) => {
        const withdrawalAmount = partialWithdrawalByAccount.get(accountId) ?? 0
        const availableBeforeBaseWithdrawals = availableBeforeBaseWithdrawalsByAccount.get(accountId) ?? 0

        if (
          withdrawalAmount <= CONTRIBUTION_TOLERANCE
          || availableBeforeBaseWithdrawals <= CONTRIBUTION_TOLERANCE
        ) {
          return product
        }

        const withdrawalFactor = Math.max(
          0,
          1 - Math.min(1, withdrawalAmount / availableBeforeBaseWithdrawals),
        )
        return product * withdrawalFactor
      }, 1)

      return Math.max(0, Math.min(1, startingFactor * currentYearFactor))
    }
  }
}

function buildInitialBonusAdjustmentFactorByBonusId(
  normalized: IlpNormalizedPolicyInput,
): Map<string, number> {
  const seededFactors = normalized.input.claimProfile?.currentBonusAdjustmentFactors ?? []

  return new Map(
    normalized.bonuses.rules
      .filter(({ bonus }) => bonus.adjustmentFactorConfig?.formula === 'cumulative-withdrawal-factor-product-over-account-value')
      .map(({ bonus }) => {
        const seededFactor = seededFactors.find((entry) => entry.bonusId === bonus.id)?.factor
        return [bonus.id, seededFactor == null ? 1 : Math.max(0, Math.min(1, seededFactor))]
      }),
  )
}

function computeNextBonusAdjustmentFactorsByBonusId(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  currentBonusAdjustmentFactorByBonusId: Map<string, number>,
  partialWithdrawalByAccount: Map<string, number>,
  availableBeforeBaseWithdrawalsByAccount: Map<string, number>,
): Map<string, number> {
  const next = new Map(currentBonusAdjustmentFactorByBonusId)

  for (const normalizedBonus of normalized.bonuses.rules) {
    const config = normalizedBonus.bonus.adjustmentFactorConfig
    if (config?.formula !== 'cumulative-withdrawal-factor-product-over-account-value') {
      continue
    }

    if (context.policyYear < (config.countFromPolicyYear ?? 1)) {
      continue
    }

    const currentFactor = next.get(normalizedBonus.bonus.id) ?? 1
    const yearFactor = config.withdrawalAccountIds.reduce((product, accountId) => {
      const withdrawalAmount = partialWithdrawalByAccount.get(accountId) ?? 0
      const availableBeforeBaseWithdrawals = availableBeforeBaseWithdrawalsByAccount.get(accountId) ?? 0

      if (
        withdrawalAmount <= CONTRIBUTION_TOLERANCE
        || availableBeforeBaseWithdrawals <= CONTRIBUTION_TOLERANCE
      ) {
        return product
      }

      return product * Math.max(
        0,
        1 - Math.min(1, withdrawalAmount / availableBeforeBaseWithdrawals),
      )
    }, 1)

    next.set(normalizedBonus.bonus.id, Math.max(0, Math.min(1, currentFactor * yearFactor)))
  }

  return next
}

function computeTieredStartupRecoveryCharge(
  normalized: IlpNormalizedPolicyInput,
  rule: IlpEventChargeRule,
  event: Pick<IlpPolicyEvent, 'startPolicyMonth' | 'amount'>,
): number {
  const { input } = normalized
  const reductionAmount = event.amount ?? 0
  if (reductionAmount <= 0 || !rule.sourceBonusId) {
    return rule.amount
  }

  const startupBonus = input.bonuses.find((bonus) => bonus.id === rule.sourceBonusId)
  if (!startupBonus) {
    return rule.amount
  }

  const currentAnnualPremium = getScheduledAnnualPremiumAtMonth(normalized, Math.max(1, event.startPolicyMonth - 1))
  const reducedAnnualPremium = Math.max(0, currentAnnualPremium - reductionAmount)
  const tierBasis = getBonusTierBasis(startupBonus)
  const currentTierInput = getBonusPrimaryTierInput(normalized, startupBonus, currentAnnualPremium)
  const reducedTierInput = getBonusPrimaryTierInput(normalized, startupBonus, reducedAnnualPremium)
  const currentAnnualPremiumTierInput = getBonusAnnualPremiumTierInput(normalized, startupBonus, currentAnnualPremium)
  const reducedAnnualPremiumTierInput = getBonusAnnualPremiumTierInput(normalized, startupBonus, reducedAnnualPremium)
  const currentRate = resolveTieredBonusRate(startupBonus, tierBasis, currentTierInput, currentAnnualPremiumTierInput, input.currency)
  const reducedRate = resolveTieredBonusRate(startupBonus, tierBasis, reducedTierInput, reducedAnnualPremiumTierInput, input.currency)
  const currentStartupBonusAmount = currentAnnualPremium * currentRate
  const reducedStartupBonusAmount = reducedAnnualPremium * reducedRate
  const monthsPassedSinceInception = Math.max(event.startPolicyMonth - 1, 0)
  const committedMipMonths = Math.max(1, (hasFiniteMip(input) ? input.mipLength : computeTotalProjectionYears(input)) * 12)
  const remainingFactor = Math.max(0, 1 - (monthsPassedSinceInception / committedMipMonths))

  return Math.max(0, currentStartupBonusAmount - reducedStartupBonusAmount) * remainingFactor + rule.amount
}

function getNormalizedEventsForBonusTrigger(
  normalized: IlpNormalizedPolicyInput,
  trigger: IlpBonusSuspensionRule['trigger'],
): Array<Pick<IlpPolicyEvent, 'id' | 'startPolicyMonth' | 'durationMonths' | 'bonusSuspensionWaived' | 'accountId' | 'amount'>> {
  switch (trigger) {
    case 'premium-holiday':
      return normalized.events.premiumHolidays.filter((event) => event.bonusSuspensionWaived !== true)
    case 'partial-withdrawal':
      return normalized.events.partialWithdrawals.filter((event) => event.bonusSuspensionWaived !== true)
    case 'reinvested-dividend-withdrawal':
      return normalized.events.reinvestedDividendWithdrawals.filter((event) => event.bonusSuspensionWaived !== true)
    case 'regular-premium-reduction':
      return normalized.events.regularPremiumReductions.filter((event) => event.bonusSuspensionWaived !== true)
    case 'scheduled-payout': {
      const scheduledPayout = normalized.input.scheduledPayoutAssumption
      if (!scheduledPayout || scheduledPayout.mode !== 'scheduled-redemption') {
        return []
      }

      return Array.from({ length: scheduledPayout.durationYears }, (_, index) => ({
        id: `scheduled-payout-${scheduledPayout.startPolicyYear + index}`,
        startPolicyMonth: ((scheduledPayout.startPolicyYear + index - 1) * 12) + 1,
        durationMonths: 12,
        accountId: normalized.input.scheduledPayoutSupport?.accountId ?? scheduledPayout.accountId,
        amount: 0,
      }))
    }
  }
}

function getBonusEligibilityFraction(
  normalizedBonus: IlpNormalizedBonusRule,
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  eligibilityMetrics?: IlpBonusEligibilityMetrics,
): number {
  if (!isBonusEligibleByRequirementAndQualification(normalizedBonus, normalized, context, eligibilityMetrics)) {
    return 0
  }

  if (normalizedBonus.bonus.suspensionRules == null || normalizedBonus.bonus.suspensionRules.length === 0) {
    return 1
  }
  const range = context.range
  const suspendedMonths = (normalizedBonus.bonus.suspensionRules ?? []).reduce((sum, rule) => {
    const overlapForRule = getNormalizedEventsForBonusTrigger(normalized, rule.trigger)
      .reduce((innerSum, event) => {
        if (rule.accountIds?.length) {
          if (!event.accountId || !rule.accountIds.includes(event.accountId)) {
            return innerSum
          }
        }

        const suspensionDuration = rule.trigger === 'regular-premium-reduction'
          ? rule.suspensionMonths
          : Math.max(rule.suspensionMonths, event.durationMonths)
        const suspensionStartPolicyMonth = event.startPolicyMonth + (rule.startOffsetMonths ?? 0)
        return innerSum + overlapMonths(
          range.startPolicyMonth,
          range.endPolicyMonth,
          suspensionStartPolicyMonth,
          suspensionStartPolicyMonth + suspensionDuration - 1,
        )
      }, 0)

    return sum + overlapForRule
  }, 0)

  return Math.max(0, (12 - Math.min(12, suspendedMonths)) / 12)
}

function isBonusEligibleByRequirementAndQualification(
  normalizedBonus: IlpNormalizedBonusRule,
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  eligibilityMetrics?: IlpBonusEligibilityMetrics,
): boolean {
  const referenceYear = getBonusReferenceYear(normalizedBonus, context)

  if (
    normalizedBonus.bonus.requiredRegularPremiumPaymentFrequency
    && getRegularPremiumPaymentFrequency(normalized.input) !== normalizedBonus.bonus.requiredRegularPremiumPaymentFrequency
  ) {
    return false
  }

  if (normalizedBonus.bonus.requiresPremiumsPaidUpToDate && !context.paymentHistory.premiumsPaidUpToDate) {
    return false
  }

  if ((normalizedBonus.bonus.qualificationRules ?? []).some((rule) => {
    if ('formula' in rule) {
      switch (rule.formula) {
        case 'policy-year-growth-measure': {
          const metric = eligibilityMetrics?.policyYearGrowthMeasure
          if (!metric) {
            return true
          }

          const denominator = metric.priorYearEndValueAfterPriorBonus + metric.regularPremiumReceivedThisYear
          if (denominator <= CONTRIBUTION_TOLERANCE) {
            return true
          }

          const rawRatio = (metric.currentYearEndValueBeforeBonus + metric.effectiveChargesThisYear) / denominator
          const roundedRatio = rule.rounding === 'floor-whole-percent'
            ? Math.floor((rawRatio + CONTRIBUTION_TOLERANCE) * 100) / 100
            : rawRatio

          return roundedRatio + CONTRIBUTION_TOLERANCE < rule.minimumRatio
        }

        case 'cumulative-effective-account-value-ratio': {
          const metric = eligibilityMetrics?.cumulativeEffectiveAccountValueRatio
          if (!metric) {
            return true
          }

          if (metric.cumulativePremiumsPaid <= CONTRIBUTION_TOLERANCE) {
            return true
          }

          const effectiveAccountValueAtReferencePoint = metric.effectiveAccountValueAtReferencePoint
            + (rule.includeReinvestedDividendWithdrawals === true
              ? metric.cumulativeReinvestedDividendWithdrawals
              : 0)
          const rawRatio = effectiveAccountValueAtReferencePoint / metric.cumulativePremiumsPaid
          return rawRatio - CONTRIBUTION_TOLERANCE > rule.maximumRatio
        }
        case 'no-new-premium-arrears-in-lookback-months': {
          const lookbackStartPolicyMonth = Math.max(0, context.range.endPolicyMonth - rule.lookbackMonths)
          const arrearsBeforeWindow = getPremiumArrearsAtMonth(normalized, lookbackStartPolicyMonth)
          const arrearsAtReferencePoint = getPremiumArrearsAtMonth(normalized, context.range.endPolicyMonth)
          return arrearsAtReferencePoint > arrearsBeforeWindow + CONTRIBUTION_TOLERANCE
        }
      }
    }

    return getNormalizedEventsForBonusTrigger(normalized, rule.trigger).some((event) => {
      if (rule.accountIds?.length) {
        if (!event.accountId || !rule.accountIds.includes(event.accountId)) {
          return false
        }
      }

      if ('disqualifyWhenCumulativeAmountExceeds' in rule) {
        const countFromPolicyMonth = ((rule.countFromPolicyYear - 1) * 12) + 1
        const cumulativeAmount = getNormalizedEventsForBonusTrigger(normalized, rule.trigger)
          .reduce((sum, candidate) => {
            if (candidate.startPolicyMonth < countFromPolicyMonth || candidate.startPolicyMonth > context.range.endPolicyMonth) {
              return sum
            }

            if (rule.accountIds?.length) {
              if (!candidate.accountId || !rule.accountIds.includes(candidate.accountId)) {
                return sum
              }
            }

            return sum + (candidate.amount ?? 0)
          }, 0)

        switch (rule.disqualifyWhenCumulativeAmountExceeds) {
          case 'annualised-regular-premium-at-issue':
            return cumulativeAmount > ((normalized.input.monthlyContribution * 12) + CONTRIBUTION_TOLERANCE)
        }
      }

      if ('disqualifyIfAnyFromPolicyYear' in rule) {
        const countFromPolicyMonth = ((rule.disqualifyIfAnyFromPolicyYear - 1) * 12) + 1
        return event.startPolicyMonth >= countFromPolicyMonth
          && event.startPolicyMonth <= context.range.endPolicyMonth
      }

      if ('disqualifyIfAnyInLookbackMonths' in rule) {
        const lookbackStartPolicyMonth = Math.max(1, context.range.endPolicyMonth - rule.disqualifyIfAnyInLookbackMonths + 1)
        return event.startPolicyMonth >= lookbackStartPolicyMonth
          && event.startPolicyMonth <= context.range.endPolicyMonth
      }

      if ('disqualifyInReferenceYear' in rule) {
        return event.startPolicyMonth >= context.range.startPolicyMonth
          && event.startPolicyMonth <= context.range.endPolicyMonth
      }

      return event.startPolicyMonth <= (
        'disqualifyThroughPolicyYear' in rule
          ? (rule.disqualifyThroughPolicyYear * 12)
          : (referenceYear * 12)
      )
    })
  })) {
    return false
  }

  return true
}

function isBonusSuspendedDuringRange(
  normalizedBonus: IlpNormalizedBonusRule,
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
): boolean {
  if (normalizedBonus.bonus.suspensionRules == null || normalizedBonus.bonus.suspensionRules.length === 0) {
    return false
  }

  return (normalizedBonus.bonus.suspensionRules ?? []).some((rule) => (
    getNormalizedEventsForBonusTrigger(normalized, rule.trigger).some((event) => {
      if (rule.accountIds?.length) {
        if (!event.accountId || !rule.accountIds.includes(event.accountId)) {
          return false
        }
      }

      const suspensionDuration = rule.trigger === 'regular-premium-reduction'
        ? rule.suspensionMonths
        : Math.max(rule.suspensionMonths, event.durationMonths)
      const suspensionStartPolicyMonth = event.startPolicyMonth + (rule.startOffsetMonths ?? 0)

      return overlapMonths(
        context.range.startPolicyMonth,
        context.range.endPolicyMonth,
        suspensionStartPolicyMonth,
        suspensionStartPolicyMonth + suspensionDuration - 1,
      ) > 0
    })
  ))
}

function getBonusReferenceYear(
  normalizedBonus: IlpNormalizedBonusRule,
  context: IlpCashflowYearContext,
): number {
  return normalizedBonus.bonus.yearBasis === 'premium-year'
    ? context.paymentHistory.premiumYearAtEnd
    : context.range.endPolicyMonth > 0
      ? getPolicyYearForMonth(context.range.endPolicyMonth)
      : context.policyYear
}

function isBonusDueForReferenceYear(
  normalizedBonus: IlpNormalizedBonusRule,
  referenceYear: number,
): boolean {
  const cadenceYears = normalizedBonus.bonus.cadenceYears ?? 1
  return ((referenceYear - normalizedBonus.bonus.startPolicyYear) % cadenceYears) === 0
}

function computeRestoredBonusCredit(
  normalized: Pick<IlpNormalizedPolicyInput, 'regularPremiums'>,
  normalizedBonus: IlpNormalizedBonusRule,
  accountId: string,
  accountOpenBalance: number,
  annualRegularContribution: number,
  currency: IlpPolicyInput['currency'],
  repaymentEvents: IlpRepaymentEvent[],
): number {
  if (normalizedBonus.bonus.restorationRules == null || normalizedBonus.bonus.restorationRules.length === 0) {
    return 0
  }

  if (!normalizedBonus.targetAccountIds.includes(accountId)) {
    return 0
  }

  const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
  return (normalizedBonus.bonus.restorationRules ?? []).reduce((sum, rule) => {
    return sum + repaymentEvents.reduce((eventSum, event) => {
      if (rule.trigger !== event.type) {
        return eventSum
      }

      const primaryTierInput = getBonusPrimaryTierInput(
        normalized,
        normalizedBonus.bonus,
        annualRegularContribution + event.amount,
      )
      const annualPremiumTierInput = getBonusAnnualPremiumTierInput(
        normalized,
        normalizedBonus.bonus,
        annualRegularContribution + event.amount,
      )
      const effectiveRate = resolveNormalizedBonusRate(
        normalizedBonus,
        primaryTierInput,
        annualPremiumTierInput,
        currency,
        accountOpenBalance + event.amount,
      )

      switch (rule.basis) {
        case 'repaid-premium-with-missed-months':
          return eventSum + (((event.amount * effectiveRate * event.durationMonths) / 12) / splitCount)
        case 'account-value-plus-repaid-premium-with-missed-months':
          return eventSum + ((((accountOpenBalance + event.amount) * effectiveRate * event.durationMonths) / 12) / splitCount)
        case 'repaid-premium':
          return eventSum + ((event.amount * effectiveRate) / splitCount)
      }
    }, 0)
  }, 0)
}

function buildExcludedValueContributions(
  normalized: IlpNormalizedPolicyInput,
  normalizedBonus: IlpNormalizedBonusRule,
  range: IlpProjectionYearRange,
  repaymentEvents: IlpRepaymentEvent[],
): IlpExcludedValueContribution[] {
  if (normalizedBonus.bonus.excludedValueRules == null || normalizedBonus.bonus.excludedValueRules.length === 0) {
    return []
  }

  const routes = resolveSupplementaryContributionRoutes(normalized)
  const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
  const contributions: IlpExcludedValueContribution[] = []

  for (const rule of normalizedBonus.bonus.excludedValueRules ?? []) {
    const netAmountFactor = rule.netAmountFactor ?? 1

    const pushContribution = (accountId: string, startPolicyMonth: number, amount: number) => {
      if (!normalizedBonus.targetAccountIds.includes(accountId)) {
        return
      }

      if (amount <= CONTRIBUTION_TOLERANCE) {
        return
      }

      contributions.push({
        accountId,
        startPolicyMonth,
        amount,
        expiryPolicyMonth: rule.lookbackMonths != null ? (startPolicyMonth + rule.lookbackMonths) : null,
      })
    }

    switch (rule.trigger) {
      case 'premium-holiday-repayment':
      case 'policy-repayment':
        for (const event of repaymentEvents) {
          if (event.type !== rule.trigger) continue

          if (event.accountId) {
            pushContribution(
              event.accountId,
              event.startPolicyMonth,
              rule.basis === 'repaid-premium'
                ? event.amount
                : event.amount * netAmountFactor,
            )
            continue
          }

          for (const accountId of normalizedBonus.targetAccountIds) {
            pushContribution(
              accountId,
              event.startPolicyMonth,
              (rule.basis === 'repaid-premium'
                ? event.amount
                : event.amount * netAmountFactor) / splitCount,
            )
          }
        }
        break

      case 'top-up':
        for (const event of normalized.events.topUps) {
          if (event.amount == null || event.amount <= 0) continue
          if (event.startPolicyMonth < range.startPolicyMonth || event.startPolicyMonth > range.endPolicyMonth) continue

          if (event.accountId) {
            pushContribution(event.accountId, event.startPolicyMonth, event.amount * netAmountFactor)
            continue
          }

          for (const route of routes) {
            pushContribution(route.accountId, event.startPolicyMonth, event.amount * route.share * netAmountFactor)
          }
        }
        break

      case 'recurring-single-premium':
        for (let policyMonth = range.startPolicyMonth; policyMonth <= range.endPolicyMonth; policyMonth += 1) {
          const activeEvents = normalized.events.recurringSinglePremiums.filter((event) => (
            event.amount != null
            && event.amount > 0
            && policyMonth >= event.startPolicyMonth
            && policyMonth < (event.startPolicyMonth + event.durationMonths)
            && isRecurringSinglePremiumEventActiveAtMonth(normalized, event, policyMonth)
          ))
          if (activeEvents.length === 0) continue

          const scheduledRecurringMonthly = activeEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0)
          const monthlyReduction = getAnnualPremiumReductionAtMonth(normalized, policyMonth) / 12
          const recurringReductionAbsorbed = Math.min(monthlyReduction, scheduledRecurringMonthly)

          for (const event of activeEvents) {
            const eventShare = (event.amount ?? 0) / scheduledRecurringMonthly
            const netMonthlyAmount = ((event.amount ?? 0) - (recurringReductionAbsorbed * eventShare)) * netAmountFactor
            if (netMonthlyAmount <= CONTRIBUTION_TOLERANCE) continue

            if (event.accountId) {
              pushContribution(event.accountId, policyMonth, netMonthlyAmount)
              continue
            }

            for (const route of routes) {
              pushContribution(route.accountId, policyMonth, netMonthlyAmount * route.share)
            }
          }
        }
        break
      }
  }

  return contributions
}

function buildPreservedValueContributions(
  normalizedBonus: IlpNormalizedBonusRule,
  range: IlpProjectionYearRange,
  partialWithdrawalEvents: IlpPolicyEvent[],
): IlpPreservedValueContribution[] {
  if (normalizedBonus.bonus.preservedValueRules == null || normalizedBonus.bonus.preservedValueRules.length === 0) {
    return []
  }

  const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
  const contributions: IlpPreservedValueContribution[] = []

  for (const rule of normalizedBonus.bonus.preservedValueRules) {
    for (const event of partialWithdrawalEvents) {
      if (
        event.amount == null
        || event.amount <= 0
        || event.startPolicyMonth < range.startPolicyMonth
        || event.startPolicyMonth > range.endPolicyMonth
      ) {
        continue
      }

      if (rule.requiresBonusSuspensionWaived === true && event.bonusSuspensionWaived !== true) {
        continue
      }

      if (event.accountId != null) {
        if (rule.accountIds != null && !rule.accountIds.includes(event.accountId)) {
          continue
        }

        if (!normalizedBonus.targetAccountIds.includes(event.accountId)) {
          continue
        }

        contributions.push({
          accountId: event.accountId,
          startPolicyMonth: event.startPolicyMonth,
          amount: event.amount,
        })
        continue
      }

      if (rule.accountIds != null && rule.accountIds.length > 0) {
        continue
      }

      for (const accountId of normalizedBonus.targetAccountIds) {
        contributions.push({
          accountId,
          startPolicyMonth: event.startPolicyMonth,
          amount: event.amount / splitCount,
        })
      }
    }
  }

  return contributions
}

function buildInitialExcludedBonusCohortsByBonusId(
  normalized: IlpNormalizedPolicyInput,
): Map<string, Map<string, IlpExcludedValueCohort[]>> {
  const projectionStartPolicyMonth = normalized.input.monthsAlreadyPaid + 1
  const seededCohorts = normalized.input.claimProfile?.currentExcludedValueCohorts ?? []

  return new Map(
    normalized.bonuses.rules
      .filter(({ bonus }) => (bonus.excludedValueRules?.length ?? 0) > 0)
      .map(({ bonus, targetAccountIds }) => {
        const cohortsByAccount = new Map<string, IlpExcludedValueCohort[]>(
          targetAccountIds.map((accountId) => {
            const activeCohorts = seededCohorts
              .filter((cohort) => cohort.bonusId === bonus.id && cohort.accountId === accountId)
              .map((cohort) => ({
                balance: Math.max(0, cohort.amount),
                expiryPolicyMonth: cohort.remainingMonths == null
                  ? null
                  : projectionStartPolicyMonth + Math.max(1, Math.round(cohort.remainingMonths)),
              }))
              .filter((cohort) => cohort.balance > CONTRIBUTION_TOLERANCE)

            return [accountId, activeCohorts]
          }),
        )

        return [bonus.id, cohortsByAccount]
      }),
  )
}

function buildInitialPreservedBonusCohortsByBonusId(
  normalized: IlpNormalizedPolicyInput,
): Map<string, Map<string, IlpPreservedValueCohort[]>> {
  return new Map(
    normalized.bonuses.rules
      .filter(({ bonus }) => (bonus.preservedValueRules?.length ?? 0) > 0)
      .map(({ bonus, targetAccountIds }) => [
        bonus.id,
        new Map<string, IlpPreservedValueCohort[]>(
          targetAccountIds.map((accountId) => [accountId, []]),
        ),
      ]),
  )
}

function resolveStepUpBoosterCumulativeWithdrawals(
  normalized: IlpNormalizedPolicyInput,
  normalizedBonus: IlpNormalizedBonusRule,
  context: IlpCashflowYearContext,
): number {
  const config = normalizedBonus.bonus.stepUpPayoutConfig
  if (!config) return 0

  return normalized.events.partialWithdrawals.reduce((sum, event) => {
    if (
      event.amount == null
      || event.amount <= 0
      || event.startPolicyMonth > context.range.endPolicyMonth
      || !event.accountId
      || !config.partialWithdrawalAccountIds.includes(event.accountId)
    ) {
      return sum
    }

    if (getPolicyYearForMonth(event.startPolicyMonth) < config.countPartialWithdrawalsFromPolicyYear) {
      return sum
    }

    return sum + event.amount
  }, 0)
}

function computeBonusCreditForRule(
  normalized: IlpNormalizedPolicyInput,
  normalizedBonus: IlpNormalizedBonusRule,
  context: IlpCashflowYearContext,
  repaymentEvents: IlpRepaymentEvent[],
  eligibilityMetrics: IlpBonusEligibilityMetrics,
  excludedBonusValueByBonusId: Map<string, Map<string, number>>,
  preservedBonusValueByBonusId: Map<string, Map<string, number>>,
  accountId: string,
  accountOpenBalance: number,
  annualRegularContributionToAccount: number,
  annualRegularContribution: number,
  regularPremiumPaidThisYear: number,
  partialWithdrawalByAccount: Map<string, number>,
  availableBeforeBaseWithdrawalsByAccount: Map<string, number>,
  cumulativeBonusAdjustmentFactorByBonusId: Map<string, number>,
  cumulativeBonusCreditsByBonusId: Map<string, number>,
  cumulativeRegularPremiumsPaid: number,
  currency: IlpPolicyInput['currency'],
): number {
  const bonus = normalizedBonus.bonus
  const referenceYear = getBonusReferenceYear(normalizedBonus, context)
  if (!normalizedBonus.targetAccountIds.includes(accountId)) return 0
  if (referenceYear < bonus.startPolicyYear) return 0
  if (bonus.endPolicyYear != null && referenceYear > bonus.endPolicyYear) return 0
  if (!isBonusDueForReferenceYear(normalizedBonus, referenceYear)) return 0

  const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
  const primaryTierInput = getBonusPrimaryTierInput(normalized, bonus, annualRegularContribution)
  const annualPremiumTierInput = getBonusAnnualPremiumTierInput(normalized, bonus, annualRegularContribution)
  const effectiveRate = resolveNormalizedBonusRate(
    normalizedBonus,
    primaryTierInput,
    annualPremiumTierInput,
    currency,
    accountOpenBalance,
    referenceYear,
  )
    * resolveBonusAdjustmentFactor(
      normalized,
      normalizedBonus,
      context,
      regularPremiumPaidThisYear,
      partialWithdrawalByAccount,
      repaymentEvents,
      availableBeforeBaseWithdrawalsByAccount,
      cumulativeBonusAdjustmentFactorByBonusId,
    )
  const eligibilityFraction = getBonusEligibilityFraction(normalizedBonus, normalized, context, eligibilityMetrics)

  switch (bonus.mode) {
    case 'annual-rate':
      return Math.max(
        0,
        accountOpenBalance
          - (excludedBonusValueByBonusId.get(bonus.id)?.get(accountId) ?? 0)
          + (preservedBonusValueByBonusId.get(bonus.id)?.get(accountId) ?? 0),
      ) * effectiveRate * eligibilityFraction
    case 'monthly-rate':
      return 0
    case 'premium-allocation':
      if (bonus.annualPremiumTierBasis === 'initial-single-premium-at-issue') {
        if (referenceYear === bonus.startPolicyYear) {
          return ((normalized.input.initialSinglePremium ?? 0) / splitCount) * effectiveRate * eligibilityFraction
        }
        return 0
      }

      return (
        (normalizedBonus.targetAccountIds.length > 0
          ? annualRegularContributionToAccount
          : (annualRegularContribution / splitCount))
        * effectiveRate
        * eligibilityFraction
      )
    case 'one-time':
      if (bonus.oneTimePayoutBasis === 'initial-single-premium-at-issue') {
        return ((normalized.input.initialSinglePremium ?? 0) * effectiveRate * eligibilityFraction) / splitCount
      }

      if (bonus.oneTimePayoutBasis === 'committed-annual-premium-at-issue') {
        return (normalized.regularPremiums.committedAnnualPremiumAtIssue * effectiveRate * eligibilityFraction) / splitCount
      }

      if (bonus.oneTimePayoutBasis === 'step-up-booster-delta') {
        const config = bonus.stepUpPayoutConfig
        if (!config) return 0

        const cumulativeWithdrawals = resolveStepUpBoosterCumulativeWithdrawals(normalized, normalizedBonus, context)
        const reducedPremiumBase = Math.max(
          0,
          (cumulativeRegularPremiumsPaid - cumulativeWithdrawals) / config.premiumShortfallChargeYears,
        )
        const scheduledBoosterBase = Math.min(normalized.regularPremiums.committedAnnualPremiumAtIssue, reducedPremiumBase)
        const scheduledBoosterAmount = scheduledBoosterBase * effectiveRate * eligibilityFraction
        const previouslyCreditedAmount = cumulativeBonusCreditsByBonusId.get(bonus.id) ?? 0
        return Math.max(0, scheduledBoosterAmount - previouslyCreditedAmount) / splitCount
      }

      if (referenceYear === bonus.startPolicyYear) {
        return bonus.amount / splitCount
      }
      return 0
  }
}

function computeBonusCredit(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  repaymentEvents: IlpRepaymentEvent[],
  eligibilityMetrics: IlpBonusEligibilityMetrics,
  excludedBonusValueByBonusId: Map<string, Map<string, number>>,
  preservedBonusValueByBonusId: Map<string, Map<string, number>>,
  accountId: string,
  accountOpenBalance: number,
  annualRegularContributionToAccount: number,
  annualRegularContribution: number,
  regularPremiumPaidThisYear: number,
  partialWithdrawalByAccount: Map<string, number>,
  availableBeforeBaseWithdrawalsByAccount: Map<string, number>,
  cumulativeBonusAdjustmentFactorByBonusId: Map<string, number>,
  cumulativeBonusCreditsByBonusId: Map<string, number>,
  cumulativeRegularPremiumsPaid: number,
  currency: IlpPolicyInput['currency'],
): number {
  let total = 0

  for (const normalizedBonus of normalized.bonuses.rules) {
    total += computeBonusCreditForRule(
      normalized,
      normalizedBonus,
      context,
      repaymentEvents,
      eligibilityMetrics,
      excludedBonusValueByBonusId,
      preservedBonusValueByBonusId,
      accountId,
      accountOpenBalance,
      annualRegularContributionToAccount,
      annualRegularContribution,
      regularPremiumPaidThisYear,
      partialWithdrawalByAccount,
      availableBeforeBaseWithdrawalsByAccount,
      cumulativeBonusAdjustmentFactorByBonusId,
      cumulativeBonusCreditsByBonusId,
      cumulativeRegularPremiumsPaid,
      currency,
    )

    total += computeRestoredBonusCredit(
      normalized,
      normalizedBonus,
      accountId,
      accountOpenBalance,
      annualRegularContribution,
      currency,
      repaymentEvents,
    )
  }

  return total
}

function computeMonthlyRateBonusCreditForRuleAtMonth(
  normalized: IlpNormalizedPolicyInput,
  normalizedBonus: IlpNormalizedBonusRule,
  context: IlpCashflowYearContext,
  accountId: string,
  accountOpenBalance: number,
  currency: IlpPolicyInput['currency'],
): number {
  const bonus = normalizedBonus.bonus
  if (bonus.mode !== 'monthly-rate') return 0
  if (!normalizedBonus.targetAccountIds.includes(accountId)) return 0

  const referenceYear = getBonusReferenceYear(normalizedBonus, context)
  if (referenceYear < bonus.startPolicyYear) return 0
  if (bonus.endPolicyYear != null && referenceYear > bonus.endPolicyYear) return 0
  if (!isBonusDueForReferenceYear(normalizedBonus, referenceYear)) return 0

  const primaryTierInput = getBonusPrimaryTierInput(normalized, bonus, 0)
  const annualPremiumTierInput = getBonusAnnualPremiumTierInput(normalized, bonus, 0)
  const effectiveRate = resolveNormalizedBonusRate(
    normalizedBonus,
    primaryTierInput,
    annualPremiumTierInput,
    currency,
    accountOpenBalance,
    referenceYear,
  )
  if (!isBonusEligibleByRequirementAndQualification(normalizedBonus, normalized, context)) {
    return 0
  }
  if (isBonusSuspendedDuringRange(normalizedBonus, normalized, context)) {
    return 0
  }

  return Math.max(0, accountOpenBalance) * effectiveRate / 12
}

function getMonthlyWithdrawalAmountForAccount(
  normalized: IlpNormalizedPolicyInput,
  policyMonth: number,
  accountId: string,
): number {
  const partialWithdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => {
    if (
      event.startPolicyMonth !== policyMonth
      || event.amount == null
      || event.amount <= 0
      || event.accountId !== accountId
    ) {
      return sum
    }

    return sum + event.amount
  }, 0)

  const reinvestedDividendWithdrawalAmount = normalized.events.reinvestedDividendWithdrawals.reduce((sum, event) => {
    if (
      event.startPolicyMonth !== policyMonth
      || event.amount == null
      || event.amount <= 0
      || event.accountId !== accountId
    ) {
      return sum
    }

    return sum + event.amount
  }, 0)

  return partialWithdrawalAmount + reinvestedDividendWithdrawalAmount
}

function computeMonthlyRateBonusProjectionForAccount(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  accountId: string,
  openBalance: number,
  annualAssuranceCharge: number,
  blendedNetReturn: number,
  currency: IlpPolicyInput['currency'],
): { bonusCredit: number, close: number } | null {
  const monthlyBonuses = normalized.bonuses.rules.filter(({ bonus, targetAccountIds }) => (
    bonus.mode === 'monthly-rate' && targetAccountIds.includes(accountId)
  ))
  if (monthlyBonuses.length === 0) {
    return null
  }

  let balance = openBalance
  let totalBonusCredit = 0
  const monthlyNetReturn = Math.pow(1 + blendedNetReturn, 1 / 12) - 1

  for (let policyMonth = context.range.startPolicyMonth; policyMonth <= context.range.endPolicyMonth; policyMonth += 1) {
    const monthContext = buildCashflowMonthContext(normalized, policyMonth)
    const monthlyAdditionalCharge = computeAdditionalChargeByAccount(
      normalized,
      monthContext,
      new Map([[accountId, balance]]),
      new Map([[accountId, 0]]),
    ).get(accountId) ?? 0
    const monthlyGrossFee = monthlyAdditionalCharge + (annualAssuranceCharge / 12)
    const monthlyBonusCredit = monthlyBonuses.reduce((sum, normalizedBonus) => (
      sum + computeMonthlyRateBonusCreditForRuleAtMonth(
        normalized,
        normalizedBonus,
        monthContext,
        accountId,
        balance,
        currency,
      )
    ), 0)
    const monthlyWithdrawalAmount = getMonthlyWithdrawalAmountForAccount(normalized, policyMonth, accountId)

    totalBonusCredit += monthlyBonusCredit
    balance = Math.max(0, ((balance - (monthlyGrossFee - monthlyBonusCredit)) * (1 + monthlyNetReturn)) - monthlyWithdrawalAmount)
  }

  return {
    bonusCredit: totalBonusCredit,
    close: balance,
  }
}

function computeNextExcludedBonusCohortsForAccount(
  openBalance: number,
  sharableGrossFee: number,
  blendedNetReturn: number,
  activeCohorts: IlpExcludedValueCohort[],
  newContributions: IlpExcludedValueContribution[],
  availableBeforeBaseWithdrawals: number,
  withdrawalAmount: number,
): IlpExcludedValueCohort[] {
  const nextCohorts: IlpExcludedValueCohort[] = []

  for (const cohort of activeCohorts) {
    const openShare = openBalance > CONTRIBUTION_TOLERANCE
      ? Math.max(0, Math.min(1, cohort.balance / openBalance))
      : 0
    const cohortSharableFee = sharableGrossFee * openShare
    const balance = Math.max(0, (cohort.balance - cohortSharableFee) * (1 + blendedNetReturn))
    if (balance > CONTRIBUTION_TOLERANCE) {
      nextCohorts.push({
        balance,
        expiryPolicyMonth: cohort.expiryPolicyMonth,
      })
    }
  }

  for (const contribution of newContributions) {
    if (contribution.amount > CONTRIBUTION_TOLERANCE) {
      nextCohorts.push({
        balance: contribution.amount,
        expiryPolicyMonth: contribution.expiryPolicyMonth,
      })
    }
  }

  if (withdrawalAmount <= CONTRIBUTION_TOLERANCE || availableBeforeBaseWithdrawals <= CONTRIBUTION_TOLERANCE) {
    return nextCohorts
  }

  const withdrawalFactor = Math.max(
    0,
    1 - Math.min(1, withdrawalAmount / availableBeforeBaseWithdrawals),
  )

  return nextCohorts
    .map((cohort) => ({
      ...cohort,
      balance: cohort.balance * withdrawalFactor,
    }))
    .filter((cohort) => cohort.balance > CONTRIBUTION_TOLERANCE)
}

function computeNextPreservedBonusCohortsForAccount(
  openBalance: number,
  sharableGrossFee: number,
  blendedNetReturn: number,
  activeCohorts: IlpPreservedValueCohort[],
  newContributions: IlpPreservedValueContribution[],
  availableBeforeBaseWithdrawals: number,
  withdrawalAmount: number,
): IlpPreservedValueCohort[] {
  const nextCohorts: IlpPreservedValueCohort[] = []
  const preservedContributionAmount = newContributions.reduce((sum, contribution) => sum + contribution.amount, 0)

  for (const cohort of activeCohorts) {
    const openShare = openBalance > CONTRIBUTION_TOLERANCE
      ? Math.max(0, Math.min(1, cohort.balance / openBalance))
      : 0
    const cohortSharableFee = sharableGrossFee * openShare
    const balance = Math.max(0, (cohort.balance - cohortSharableFee) * (1 + blendedNetReturn))
    if (balance > CONTRIBUTION_TOLERANCE) {
      nextCohorts.push({ balance })
    }
  }

  for (const contribution of newContributions) {
    if (contribution.amount <= CONTRIBUTION_TOLERANCE) {
      continue
    }

    // Year-level projections deduct withdrawals after applying the year's
    // growth/fees, so newly preserved amounts should carry forward at face
    // value rather than getting a second year-one accrual here.
    if (contribution.amount > CONTRIBUTION_TOLERANCE) {
      nextCohorts.push({ balance: contribution.amount })
    }
  }

  const netWithdrawalAmount = Math.max(0, withdrawalAmount - preservedContributionAmount)
  if (netWithdrawalAmount <= CONTRIBUTION_TOLERANCE || availableBeforeBaseWithdrawals <= CONTRIBUTION_TOLERANCE) {
    return nextCohorts
  }

  const withdrawalFactor = Math.max(
    0,
    1 - Math.min(1, netWithdrawalAmount / availableBeforeBaseWithdrawals),
  )

  return nextCohorts
    .map((cohort) => ({
      balance: cohort.balance * withdrawalFactor,
    }))
    .filter((cohort) => cohort.balance > CONTRIBUTION_TOLERANCE)
}

function getRemainingMipYears(input: IlpPolicyInput): number {
  if (!hasFiniteMip(input)) {
    return input.postMipYears
  }

  return Math.max(0, input.mipLength - input.currentPolicyYear)
}

function getRuleShare(
  account: IlpAccount,
  phase: IlpContributionRule['phase'],
): number {
  const matchedRule = account.contributionRules?.find((rule) => rule.phase === phase)
  return matchedRule?.contributionShare ?? account.contributionShare
}

function normalizeContributionRoutes(
  input: IlpPolicyInput,
  phase: IlpContributionRule['phase'],
): IlpNormalizedContributionRoute[] {
  return input.accounts
    .map((account) => ({
      accountId: account.id,
      phase,
      share: phase === 'top-up' ? getTopUpRuleShare(account) : getRuleShare(account, phase),
    }))
    .filter((route) => route.share > 0)
}

function normalizeRecurringChargeRules(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
): IlpNormalizedRecurringChargeRule[] {
  const { input } = normalized
  const isPostMip = isPostMipPolicyYear(input, context.policyYear)

  return (input.chargeRules ?? [])
    .filter((rule) => rule.basis !== 'initial-single-premium')
    .filter((rule) => {
      const referenceYear = getRuleReferenceYear(context, rule.yearBasis)
      const isActive = rule.activeWindow === 'policy-term'
        || (rule.activeWindow === 'during-mip' && !isPostMip)
        || (rule.activeWindow === 'after-mip' && isPostMip)

      return isActive
        && (rule.startPolicyYear == null || referenceYear >= rule.startPolicyYear)
        && (rule.endPolicyYear == null || referenceYear <= rule.endPolicyYear)
    })
    .map((rule) => ({
      rule,
      appliesTo: resolveAccountsInDisplayOrder(input, rule.appliesTo),
      fallbackAppliesTo: resolveFallbackAccounts(normalized, rule.fallbackAppliesTo),
    }))
    .filter((normalizedRule) => normalizedRule.appliesTo.length > 0)
}

function getOriginalInitialSinglePremiumBase(
  input: Pick<IlpPolicyInput, 'initialSinglePremium'>,
): number {
  return Math.max(0, input.initialSinglePremium ?? 0)
}

function getOriginalNetInitialSinglePremiumBase(
  normalized: IlpNormalizedPolicyInput,
): number {
  const initialSinglePremium = getOriginalInitialSinglePremiumBase(normalized.input)
  if (initialSinglePremium <= 0) {
    return 0
  }

  const inceptionContext = buildInceptionChargeContext()
  let totalCharge = 0

  for (const rule of normalized.input.chargeRules ?? []) {
    const basisMatches = rule.basis === 'initial-single-premium' || rule.basis === 'initial-single-premium-base'
    if (!basisMatches) {
      continue
    }

    const referenceYear = getRuleReferenceYear(inceptionContext, rule.yearBasis)
    const isActive = rule.activeWindow === 'policy-term' || rule.activeWindow === 'during-mip'
    if (
      !isActive
      || (rule.startPolicyYear != null && referenceYear < rule.startPolicyYear)
      || (rule.endPolicyYear != null && referenceYear > rule.endPolicyYear)
    ) {
      continue
    }

    totalCharge += initialSinglePremium * resolveChargeRate(rule, inceptionContext)
    if (rule.basis === 'initial-single-premium') {
      totalCharge += resolveChargeAmount(rule, inceptionContext)
    }
  }

  return Math.max(0, initialSinglePremium - totalCharge)
}

function buildInceptionChargeContext(): IlpCashflowYearContext {
  return {
    projectionYear: 0,
    policyYear: 1,
    isPostMip: false,
    range: {
      startPolicyMonth: 0,
      endPolicyMonth: 0,
    },
    premiumHolidayMonths: 0,
    payableMonths: 0,
    paymentHistory: {
      premiumYearAtStart: 0,
      premiumYearAtEnd: 0,
      premiumsPaidUpToDate: true,
    },
  }
}

function computeInitialSinglePremiumState(
  normalized: IlpNormalizedPolicyInput,
): IlpInitialSinglePremiumState {
  const grossContributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const chargeByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const netContributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))

  if (!startsAtProjectionInception(normalized.input)) {
    return {
      appliesAtProjectionStart: false,
      grossContributionByAccount,
      chargeByAccount,
      netContributionByAccount,
      totalGrossContribution: 0,
      totalCharge: 0,
    }
  }

  const initialSinglePremium = normalized.input.initialSinglePremium ?? 0
  for (const route of normalized.contributionRoutesByPhase['during-icp']) {
    grossContributionByAccount.set(
      route.accountId,
      (grossContributionByAccount.get(route.accountId) ?? 0) + (initialSinglePremium * route.share),
    )
  }

  const inceptionContext = buildInceptionChargeContext()
  const initialChargeRules = (normalized.input.chargeRules ?? [])
    .filter((rule) => rule.basis === 'initial-single-premium')
    .filter((rule) => {
      const referenceYear = getRuleReferenceYear(inceptionContext, rule.yearBasis)
      const isActive = rule.activeWindow === 'policy-term' || rule.activeWindow === 'during-mip'
      return isActive
        && (rule.startPolicyYear == null || referenceYear >= rule.startPolicyYear)
        && (rule.endPolicyYear == null || referenceYear <= rule.endPolicyYear)
    })
    .map((rule) => ({
      rule,
      appliesTo: resolveAccountsInDisplayOrder(normalized.input, rule.appliesTo),
      fallbackAppliesTo: resolveFallbackAccounts(normalized, rule.fallbackAppliesTo),
    }))
    .filter((normalizedRule) => normalizedRule.appliesTo.length > 0)

  const initialSinglePremiumBaseChargeRules = (normalized.input.chargeRules ?? [])
    .filter((rule) => rule.basis === 'initial-single-premium-base')
    .filter((rule) => {
      const referenceYear = getRuleReferenceYear(inceptionContext, rule.yearBasis)
      const isActive = rule.activeWindow === 'policy-term' || rule.activeWindow === 'during-mip'
      return isActive
        && (rule.startPolicyYear == null || referenceYear >= rule.startPolicyYear)
        && (rule.endPolicyYear == null || referenceYear <= rule.endPolicyYear)
    })
    .map((rule) => ({
      rule,
      appliesTo: resolveAccountsInDisplayOrder(normalized.input, rule.appliesTo),
      fallbackAppliesTo: resolveFallbackAccounts(normalized, rule.fallbackAppliesTo),
    }))
    .filter((normalizedRule) => normalizedRule.appliesTo.length > 0)

  for (const { rule, appliesTo, fallbackAppliesTo } of initialChargeRules) {
    const rateCharge = appliesTo.reduce((sum, account) => (
      sum + ((grossContributionByAccount.get(account.id) ?? 0) * resolveChargeRate(rule, inceptionContext))
    ), 0)
    const totalCharge = rateCharge + resolveChargeAmount(rule, inceptionContext)
    const allocations = applyChargeAllocationsWithFallback(
      totalCharge,
      rule.allocation,
      appliesTo,
      fallbackAppliesTo,
      grossContributionByAccount,
    )

    for (const [accountId, amount] of allocations.entries()) {
      chargeByAccount.set(accountId, (chargeByAccount.get(accountId) ?? 0) + amount)
    }
  }

  for (const { rule, appliesTo, fallbackAppliesTo } of initialSinglePremiumBaseChargeRules) {
    const totalCharge = initialSinglePremium * resolveChargeRate(rule, inceptionContext)
    const allocations = applyChargeAllocationsWithFallback(
      totalCharge,
      rule.allocation,
      appliesTo,
      fallbackAppliesTo,
      grossContributionByAccount,
    )

    for (const [accountId, amount] of allocations.entries()) {
      chargeByAccount.set(accountId, (chargeByAccount.get(accountId) ?? 0) + amount)
    }
  }

  let totalGrossContribution = 0
  let totalCharge = 0
  for (const account of normalized.input.accounts) {
    const grossContribution = grossContributionByAccount.get(account.id) ?? 0
    const charge = chargeByAccount.get(account.id) ?? 0
    netContributionByAccount.set(account.id, Math.max(0, grossContribution - charge))
    totalGrossContribution += grossContribution
    totalCharge += charge
  }

  return {
    appliesAtProjectionStart: true,
    grossContributionByAccount,
    chargeByAccount,
    netContributionByAccount,
    totalGrossContribution,
    totalCharge,
  }
}

function getEffectiveCurrentValue(
  account: IlpAccount,
  initialSinglePremiumState: IlpInitialSinglePremiumState,
): number {
  return account.currentValue + (initialSinglePremiumState.netContributionByAccount.get(account.id) ?? 0)
}

function resolveCurrentExitChargeRate(input: IlpPolicyInput): number {
  if (getExitChargeBasis(input) === 'initial-single-premium-base') {
    return lookupEecRate(input.currentPolicyYear, input.eecTable)
  }

  return getMipBasis(input) === 'open-ended'
    ? 0
    : lookupEecRate(input.currentPolicyYear, input.eecTable)
}

function computeExitChargeAmount(
  input: IlpPolicyInput,
  exitChargeRate: number,
  currentValueByAccount: Map<string, number>,
): number {
  if (exitChargeRate <= 0) return 0

  if (getExitChargeBasis(input) === 'initial-single-premium-base') {
    return getOriginalInitialSinglePremiumBase(input) * exitChargeRate
  }

  return input.accounts
    .filter((account) => account.subjectToEec)
    .reduce((sum, account) => sum + (currentValueByAccount.get(account.id) ?? 0) * exitChargeRate, 0)
}

function resolveCurrentSmartRetirePastDueCoiRefundCredit(
  input: IlpPolicyInput,
): { accountId: string, amount: number } | null {
  if (!isSmartRetireProduct(input)) {
    return null
  }

  const currentAgeNextBirthday = input.assuranceProfile?.currentAgeNextBirthday
  const targetRetirementAge = input.assuranceProfile?.targetRetirementAge
  if (
    currentAgeNextBirthday == null
    || targetRetirementAge == null
    || currentAgeNextBirthday < targetRetirementAge
    || input.claimProfile?.currentRefundEligibleDeathCoiCollected == null
    || input.claimProfile?.currentDeathCoiRefundStatus !== 'due-and-uncredited'
    || !hasSmartRetireRefundGateInput(input)
    || isSmartRetireRefundGateBroken(input)
  ) {
    return null
  }

  const amount = Math.max(0, input.claimProfile.currentRefundEligibleDeathCoiCollected)
  if (amount <= CONTRIBUTION_TOLERANCE) {
    return null
  }

  const normalized = buildNormalizedPolicyInput(input)
  const accountId = normalized.assurance.rules.find(({ rule }) => rule.id === 'cost-of-insurance-death')?.rule.appliesTo[0] ?? 'policy'
  return { accountId, amount }
}

function hasSmartRetireRefundGateInput(input: IlpPolicyInput): boolean {
  return getSmartRetireRefundGateStatus(input) != null
    || (
      input.claimProfile?.currentSmartRetireDeathClaimStatus != null
      && getSmartRetireWopClaimAdmissionStatus(input) != null
    )
}

function isSmartRetireRefundGateBroken(input: IlpPolicyInput): boolean {
  const explicitRefundGateStatus = getSmartRetireRefundGateStatus(input)
  if (explicitRefundGateStatus != null) {
    return explicitRefundGateStatus === 'broken'
  }

  return input.claimProfile?.currentSmartRetireDeathClaimStatus === 'admitted-and-settled'
    || getSmartRetireWopClaimAdmissionStatus(input) === 'admitted'
    || getSmartRetireWopClaimAdmissionStatus(input) === 'admitted-and-settled'
}

function resolveCurrentInvestStarterPastDuePolicyChargeRefundCredit(
  input: IlpPolicyInput,
): { accountId: string, amount: number } | null {
  if (!isInvestStarterProduct(input)) {
    return null
  }

  if (
    input.monthsAlreadyPaid < 36
    || input.claimProfile?.currentInvestStarterPolicyChargeRefundAverageAccountValue == null
    || input.claimProfile?.currentInvestStarterPolicyChargeRefundStatus !== 'due-and-uncredited'
  ) {
    return null
  }

  const averageAccountValue = Math.max(0, input.claimProfile.currentInvestStarterPolicyChargeRefundAverageAccountValue)
  const amount = averageAccountValue * 0.008
  if (amount <= CONTRIBUTION_TOLERANCE) {
    return null
  }

  const accountId = input.chargeRules.find((rule) => rule.id === 'policy-charge')?.appliesTo[0] ?? 'portfolio'
  return { accountId, amount }
}

function resolveCurrentInvestPlusSpPastDuePowerUpBonusCredits(
  input: IlpPolicyInput,
): Array<{ accountId: string, amount: number }> {
  if (!isInvestPlusSpProduct(input)) {
    return []
  }

  if (
    input.monthsAlreadyPaid < 36
    || input.claimProfile?.currentInvestPlusSpPowerUpBonusStatus !== 'due-and-uncredited'
  ) {
    return []
  }

  const credits = [
    {
      accountId: 'policy',
      amount: Math.max(0, input.claimProfile.currentInvestPlusSpInitialPowerUpBonusAmount ?? 0),
    },
    {
      accountId: 'topup',
      amount: Math.max(0, input.claimProfile.currentInvestPlusSpTopUpPowerUpBonusAmount ?? 0),
    },
  ].filter((credit) => credit.amount > CONTRIBUTION_TOLERANCE)

  return credits
}

function getInvestPlusSpCurrentCycleObservedMonths(
  input: IlpPolicyInput,
): number {
  if (!isInvestPlusSpProduct(input)) {
    return 0
  }

  return Math.max(0, input.monthsAlreadyPaid % 36)
}

function getInvestPlusSpPowerUpBonusRateForCompletedYears(
  completedYears: number,
): number {
  if (completedYears < 3 || completedYears % 3 !== 0) {
    return 0
  }

  if (completedYears >= 12) return 0.012
  if (completedYears >= 9) return 0.009
  if (completedYears >= 6) return 0.006
  return 0.003
}

function getInvestPlusSpTopUpVintagePolicyChargeRate(
  policyChargeRule: IlpChargeRule | undefined,
  vintagePolicyYear: number,
): number {
  if (policyChargeRule == null) {
    return 0
  }

  const matchedTier = policyChargeRule.rateSchedule?.find((tier) => (
    vintagePolicyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || vintagePolicyYear <= tier.endPolicyYear)
  ))

  return matchedTier?.rate ?? policyChargeRule.rate
}

function getInvestPlusSpTopUpVintagePartialWithdrawalChargeRate(
  partialWithdrawalChargeRule: IlpEventChargeRule | undefined,
  vintagePolicyYear: number,
): number {
  if (partialWithdrawalChargeRule == null) {
    return 0
  }

  const matchedTier = partialWithdrawalChargeRule.rateSchedule?.find((tier) => (
    vintagePolicyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || vintagePolicyYear <= tier.endPolicyYear)
  ))

  return matchedTier?.rate ?? partialWithdrawalChargeRule.rate
}

function buildInvestPlusSpProjectedInitialPowerUpBonusCreditByYear(
  input: IlpPolicyInput,
  normalized: IlpNormalizedPolicyInput,
  initialSinglePremiumState: IlpInitialSinglePremiumState,
  blendedNetReturn: number,
  totalProjectionYears: number,
): Map<number, number> {
  if (!isInvestPlusSpProduct(input) || totalProjectionYears <= 0) {
    return new Map()
  }

  const policyAccount = input.accounts.find((account) => account.id === 'policy')
  if (!policyAccount) {
    return new Map()
  }

  const topupAccount = input.accounts.find((account) => account.id === 'topup')
  const projectionStartPolicyMonth = input.monthsAlreadyPaid + 1
  const projectionEndPolicyMonth = input.monthsAlreadyPaid + (totalProjectionYears * 12)
  const observedMonthsInCurrentCycle = getInvestPlusSpCurrentCycleObservedMonths(input)
  const observedAverageInitialAccountValue = input.claimProfile?.currentInvestPlusSpObservedInitialAccountValueAverage
  const firstProjectedDuePolicyMonth = input.monthsAlreadyPaid + (
    observedMonthsInCurrentCycle === 0
      ? 36
      : (36 - observedMonthsInCurrentCycle)
  )
  const blockFirstProjectedBonusUntilObservedAverage = observedMonthsInCurrentCycle > 0
    && observedAverageInitialAccountValue == null

  let policyBalance = getEffectiveCurrentValue(policyAccount, initialSinglePremiumState)
  let topupBalance = topupAccount == null
    ? 0
    : getEffectiveCurrentValue(topupAccount, initialSinglePremiumState)

  for (const credit of resolveCurrentInvestPlusSpPastDuePowerUpBonusCredits(input)) {
    if (credit.accountId === 'policy') {
      policyBalance += credit.amount
    } else if (credit.accountId === 'topup') {
      topupBalance += credit.amount
    }
  }

  const monthlyNetReturn = Math.pow(1 + blendedNetReturn, 1 / 12) - 1
  const policyChargeRule = input.chargeRules.find((rule) => rule.id === 'policy-charge')
  const partialWithdrawalChargeRule = input.eventChargeRules?.find((rule) => (
    rule.id === 'partial-withdrawal-charge'
    && rule.trigger === 'partial-withdrawal'
  ))
  const projectedPolicyMonthEndBalances = new Map<number, number>()
  const projectedBonusByYear = new Map<number, number>()

  for (let policyMonth = projectionStartPolicyMonth; policyMonth <= projectionEndPolicyMonth; policyMonth += 1) {
    for (const event of normalized.events.topUps) {
      if (
        event.startPolicyMonth === policyMonth
        && event.amount != null
        && event.amount > 0
      ) {
        topupBalance += getNetTopUpAmountForEvent(normalized, event)
      }
    }

    for (const event of normalized.events.partialWithdrawals) {
      if (
        event.startPolicyMonth !== policyMonth
        || event.amount == null
        || event.amount <= 0
      ) {
        continue
      }

      let remainingWithdrawalAmount = event.amount

      if (event.accountId === 'policy') {
        policyBalance = Math.max(0, policyBalance - remainingWithdrawalAmount)
        remainingWithdrawalAmount = 0
      } else if (event.accountId === 'topup') {
        const appliedToTopup = Math.min(topupBalance, remainingWithdrawalAmount)
        topupBalance -= appliedToTopup
        remainingWithdrawalAmount -= appliedToTopup
      } else {
        const appliedToTopup = Math.min(topupBalance, remainingWithdrawalAmount)
        topupBalance -= appliedToTopup
        remainingWithdrawalAmount -= appliedToTopup
        if (remainingWithdrawalAmount > CONTRIBUTION_TOLERANCE) {
          policyBalance = Math.max(0, policyBalance - remainingWithdrawalAmount)
          remainingWithdrawalAmount = 0
        }
      }

      if (
        partialWithdrawalChargeRule != null
        && remainingWithdrawalAmount <= CONTRIBUTION_TOLERANCE
        && event.accountId === 'policy'
      ) {
        const policyYear = getPolicyYearForMonth(policyMonth)
        const monthlyContext: IlpCashflowYearContext = {
          projectionYear: Math.max(1, policyYear - input.currentPolicyYear),
          policyYear,
          isPostMip: isPostMipPolicyYear(input, policyYear),
          range: {
            startPolicyMonth: policyMonth,
            endPolicyMonth: policyMonth,
          },
          premiumHolidayMonths: 0,
          payableMonths: 0,
          paymentHistory: {
            premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth - 1),
            premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
            premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
          },
        }
        const chargeRate = resolveEventChargeRate(partialWithdrawalChargeRule, monthlyContext)
        policyBalance = Math.max(0, policyBalance - (event.amount * chargeRate))
      }
    }

    if (policyChargeRule != null) {
      const policyYear = getPolicyYearForMonth(policyMonth)
      const monthlyContext: IlpCashflowYearContext = {
        projectionYear: Math.max(1, policyYear - input.currentPolicyYear),
        policyYear,
        isPostMip: isPostMipPolicyYear(input, policyYear),
        range: {
          startPolicyMonth: policyMonth,
          endPolicyMonth: policyMonth,
        },
        premiumHolidayMonths: 0,
        payableMonths: 0,
        paymentHistory: {
          premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth - 1),
          premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
          premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
        },
      }
      const monthlyPolicyCharge = (
        (policyBalance * resolveChargeRate(policyChargeRule, monthlyContext)) / 12
      ) + (resolveChargeAmount(policyChargeRule, monthlyContext) / 12)
      policyBalance = Math.max(0, policyBalance - monthlyPolicyCharge)
    }

    policyBalance = Math.max(0, policyBalance * (1 + monthlyNetReturn))
    topupBalance = Math.max(0, topupBalance * (1 + monthlyNetReturn))
    projectedPolicyMonthEndBalances.set(policyMonth, policyBalance)

    const completedYears = policyMonth / 12
    const powerUpBonusRate = getInvestPlusSpPowerUpBonusRateForCompletedYears(completedYears)
    if (powerUpBonusRate <= CONTRIBUTION_TOLERANCE) {
      continue
    }

    let averageInitialAccountValue: number | null = null
    if (policyMonth === firstProjectedDuePolicyMonth && observedMonthsInCurrentCycle > 0) {
      if (blockFirstProjectedBonusUntilObservedAverage) {
        averageInitialAccountValue = null
      } else {
        let projectedObservedSum = 0
        for (let month = projectionStartPolicyMonth; month <= policyMonth; month += 1) {
          projectedObservedSum += projectedPolicyMonthEndBalances.get(month) ?? 0
        }
        averageInitialAccountValue = (
          ((observedAverageInitialAccountValue ?? 0) * observedMonthsInCurrentCycle)
          + projectedObservedSum
        ) / 36
      }
    } else if (!blockFirstProjectedBonusUntilObservedAverage || policyMonth < firstProjectedDuePolicyMonth) {
      let trailingProjectedSum = 0
      for (let month = policyMonth - 35; month <= policyMonth; month += 1) {
        trailingProjectedSum += projectedPolicyMonthEndBalances.get(month) ?? 0
      }
      averageInitialAccountValue = trailingProjectedSum / 36
    }

    if (averageInitialAccountValue == null || averageInitialAccountValue <= CONTRIBUTION_TOLERANCE) {
      continue
    }

    const projectedBonus = averageInitialAccountValue * powerUpBonusRate
    if (projectedBonus <= CONTRIBUTION_TOLERANCE) {
      continue
    }

    const projectionYear = Math.max(1, getPolicyYearForMonth(policyMonth) - input.currentPolicyYear)
    projectedBonusByYear.set(
      projectionYear,
      (projectedBonusByYear.get(projectionYear) ?? 0) + projectedBonus,
    )
    policyBalance += projectedBonus
  }

  return projectedBonusByYear
}

function buildInvestPlusSpProjectedTopUpPowerUpBonusCreditByYear(
  input: IlpPolicyInput,
  normalized: IlpNormalizedPolicyInput,
  blendedNetReturn: number,
  totalProjectionYears: number,
): Map<number, number> {
  if (!isInvestPlusSpProduct(input) || totalProjectionYears <= 0) {
    return new Map()
  }

  const representativeManagementChargeRate = input.claimProfile?.currentInvestPlusSpRepresentativeManagementChargeRate
  if (representativeManagementChargeRate == null) {
    return new Map()
  }

  const projectionStartPolicyMonth = input.monthsAlreadyPaid + 1
  const projectionEndPolicyMonth = input.monthsAlreadyPaid + (totalProjectionYears * 12)
  const monthlyNetReturn = Math.pow(1 + blendedNetReturn, 1 / 12) - 1
  const policyChargeRule = input.chargeRules.find((rule) => rule.id === 'policy-charge')
  const partialWithdrawalChargeRule = input.eventChargeRules?.find((rule) => (
    rule.id === 'partial-withdrawal-charge'
    && rule.trigger === 'partial-withdrawal'
  ))
  const projectedBonusByYear = new Map<number, number>()
  const projectedTopUpVintages: Array<{
    startPolicyMonth: number
    remainingBalance: number
    monthEndBalances: number[]
  }> = []

  for (let policyMonth = projectionStartPolicyMonth; policyMonth <= projectionEndPolicyMonth; policyMonth += 1) {
    for (const event of normalized.events.topUps) {
      if (
        event.startPolicyMonth === policyMonth
        && event.amount != null
        && event.amount > 0
      ) {
        const netTopUpAmount = getNetTopUpAmountForEvent(normalized, event)
        if (netTopUpAmount > CONTRIBUTION_TOLERANCE) {
          projectedTopUpVintages.push({
            startPolicyMonth: event.startPolicyMonth,
            remainingBalance: netTopUpAmount,
            monthEndBalances: [],
          })
        }
      }
    }

    for (const event of normalized.events.partialWithdrawals) {
      if (
        event.startPolicyMonth !== policyMonth
        || event.amount == null
        || event.amount <= 0
        || event.accountId === 'policy'
      ) {
        continue
      }

      let remainingWithdrawalAmount = event.amount
      for (let index = projectedTopUpVintages.length - 1; index >= 0 && remainingWithdrawalAmount > CONTRIBUTION_TOLERANCE; index -= 1) {
        const vintage = projectedTopUpVintages[index]
        if (vintage.startPolicyMonth > policyMonth || vintage.remainingBalance <= CONTRIBUTION_TOLERANCE) {
          continue
        }

        const appliedToVintage = Math.min(vintage.remainingBalance, remainingWithdrawalAmount)
        vintage.remainingBalance -= appliedToVintage
        const vintagePolicyMonth = policyMonth - vintage.startPolicyMonth + 1
        const vintagePolicyYear = Math.floor((vintagePolicyMonth - 1) / 12) + 1
        const partialWithdrawalCharge = appliedToVintage * getInvestPlusSpTopUpVintagePartialWithdrawalChargeRate(
          partialWithdrawalChargeRule,
          vintagePolicyYear,
        )
        vintage.remainingBalance = Math.max(0, vintage.remainingBalance - partialWithdrawalCharge)
        remainingWithdrawalAmount -= appliedToVintage
      }
    }

    for (const vintage of projectedTopUpVintages) {
      if (vintage.startPolicyMonth > policyMonth) {
        continue
      }

      const vintagePolicyMonth = policyMonth - vintage.startPolicyMonth + 1
      const vintagePolicyYear = Math.floor((vintagePolicyMonth - 1) / 12) + 1
      const monthlyChargeRate = (
        getInvestPlusSpTopUpVintagePolicyChargeRate(policyChargeRule, vintagePolicyYear)
        + representativeManagementChargeRate
      ) / 12

      vintage.remainingBalance = Math.max(0, vintage.remainingBalance * (1 - monthlyChargeRate))
      vintage.remainingBalance = Math.max(0, vintage.remainingBalance * (1 + monthlyNetReturn))
      vintage.monthEndBalances.push(vintage.remainingBalance)

      const completedYears = vintagePolicyMonth / 12
      const powerUpBonusRate = getInvestPlusSpPowerUpBonusRateForCompletedYears(completedYears)
      if (
        vintagePolicyMonth % 36 !== 0
        || powerUpBonusRate <= CONTRIBUTION_TOLERANCE
        || vintage.monthEndBalances.length < 36
      ) {
        continue
      }

      const trailingAverageAdditionalAccountValue = vintage.monthEndBalances
        .slice(-36)
        .reduce((sum, balance) => sum + balance, 0) / 36
      const projectedBonus = trailingAverageAdditionalAccountValue * powerUpBonusRate
      if (projectedBonus <= CONTRIBUTION_TOLERANCE) {
        continue
      }

      const projectionYear = Math.max(1, getPolicyYearForMonth(policyMonth) - input.currentPolicyYear)
      projectedBonusByYear.set(
        projectionYear,
        (projectedBonusByYear.get(projectionYear) ?? 0) + projectedBonus,
      )
      vintage.remainingBalance += projectedBonus
    }
  }

  return projectedBonusByYear
}

function isSmartRetireProduct(
  input: IlpPolicyInput,
): boolean {
  return input.catalogSource?.productId === 'manulife-smartretire-v-income'
    || input.catalogSource?.productId === 'manulife-smartretire-v-sum'
}

function isInvestStarterProduct(
  input: IlpPolicyInput,
): boolean {
  return input.catalogSource?.productId === 'etiqa-invest-starter'
}

function isInvestPlusSpProduct(
  input: IlpPolicyInput,
): boolean {
  return input.catalogSource?.productId === 'etiqa-invest-plus-sp'
}

function hasActiveCurrentScheduledRedemption(
  input: IlpPolicyInput,
): boolean {
  return input.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && input.scheduledPayoutAssumption.startPolicyYear <= input.currentPolicyYear
    && !isScheduledPayoutBlockedAtPolicyYear(input, input.currentPolicyYear)
}

export function canReconstructCurrentAiaEliteSecureIncome5PayProtectedBase(
  input: IlpPolicyInput,
): boolean {
  return input.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
    && input.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && input.scheduledPayoutAssumption.startPolicyYear > input.currentPolicyYear
}

export function canReconstructCurrentAiaEliteSecureIncomeSinglePremiumProtectedBase(
  input: IlpPolicyInput,
): boolean {
  return input.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
    && (input.initialSinglePremium ?? 0) > CONTRIBUTION_TOLERANCE
    && input.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && input.scheduledPayoutAssumption.startPolicyYear > input.currentPolicyYear
}

function hasActiveCurrentGoalBuilderIiScheduledPayout(
  input: IlpPolicyInput,
): boolean {
  return input.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    && hasActiveCurrentScheduledRedemption(input)
}

function hasCurrentPolicyYearGoalBuilderIiScheduledPayout(
  input: IlpPolicyInput,
): boolean {
  const scheduledPayout = input.scheduledPayoutAssumption
  const payoutEndPolicyYear = (
    scheduledPayout?.mode === 'scheduled-redemption'
      ? scheduledPayout.startPolicyYear + scheduledPayout.durationYears - 1
      : null
  )

  return hasActiveCurrentGoalBuilderIiScheduledPayout(input)
    && payoutEndPolicyYear != null
    && input.currentPolicyYear <= payoutEndPolicyYear
}

function getGoalBuilderIiCompletedScheduledPayoutErosion(
  input: IlpPolicyInput,
): number {
  if (input.catalogSource?.productId !== 'hsbc-life-goal-builder-ii') {
    return 0
  }

  const scheduledPayout = input.scheduledPayoutAssumption
  if (!scheduledPayout || scheduledPayout.mode !== 'scheduled-redemption') {
    return 0
  }

  if (!isScheduledPayoutFrequencyAllowed(input.scheduledPayoutSupport, scheduledPayout.frequency)) {
    return 0
  }

  const minimumAnnualWithdrawalAmount = input.scheduledPayoutSupport?.minimumAnnualWithdrawalAmount
  if (
    minimumAnnualWithdrawalAmount != null
    && scheduledPayout.annualPayoutAmount + CONTRIBUTION_TOLERANCE < minimumAnnualWithdrawalAmount
  ) {
    return 0
  }

  const minimumWithdrawalAmountPerOccurrence = input.scheduledPayoutSupport?.minimumWithdrawalAmountPerOccurrence
  if (minimumWithdrawalAmountPerOccurrence != null) {
    const payoutAmountPerOccurrence = scheduledPayout.annualPayoutAmount
      / scheduledPayoutFrequencyOccurrencesPerYear(scheduledPayout.frequency)
    if (payoutAmountPerOccurrence + CONTRIBUTION_TOLERANCE < minimumWithdrawalAmountPerOccurrence) {
      return 0
    }
  }

  const payoutEndPolicyYear = scheduledPayout.startPolicyYear + scheduledPayout.durationYears - 1
  const lastCompletedPolicyYear = Math.min(input.currentPolicyYear - 1, payoutEndPolicyYear)
  if (lastCompletedPolicyYear < scheduledPayout.startPolicyYear) {
    return 0
  }

  let completedScheduledPayoutErosion = 0
  for (let policyYear = scheduledPayout.startPolicyYear; policyYear <= lastCompletedPolicyYear; policyYear += 1) {
    if (isScheduledPayoutBlockedAtPolicyYear(input, policyYear)) {
      continue
    }

    // Keep the active current policy year manual because intra-year payout timing is still not reconstructable.
    completedScheduledPayoutErosion += scheduledPayout.annualPayoutAmount
  }

  return completedScheduledPayoutErosion
}

function resolveCurrentGoalBuilderIiSumInsured(
  input: IlpPolicyInput,
  currentPolicyMonth: number,
): number | undefined {
  if (input.catalogSource?.productId !== 'hsbc-life-goal-builder-ii') {
    return undefined
  }

  if (hasCurrentPolicyYearGoalBuilderIiScheduledPayout(input)) {
    if (input.assuranceProfile?.currentSumAssured == null) {
      return undefined
    }

    return Math.max(0, input.assuranceProfile.currentSumAssured)
  }

  const normalized = buildNormalizedPolicyInput(input)
  const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
    ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
    : 0
  const adHocTopUpAmount = normalized.events.topUps.reduce((sum, event) => (
    event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= currentPolicyMonth
      ? sum + event.amount
      : sum
  ), 0)
  const recurringSinglePremiumAmount = currentPolicyMonth > 0
    ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
    : 0
  const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
    event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= currentPolicyMonth
      ? sum + event.amount
      : sum
  ), 0)
  const completedScheduledPayoutErosion = getGoalBuilderIiCompletedScheduledPayoutErosion(input)

  return Math.max(
    0,
    (
      (cumulativeRegularPremiumPaid * 1.01)
      + adHocTopUpAmount
      + recurringSinglePremiumAmount
      - withdrawalAmount
      - completedScheduledPayoutErosion
    ),
  )
}

function resolveCurrentGoalBuilderIiAccidentalDeathSumInsured(
  input: IlpPolicyInput,
  currentPolicyMonth: number,
): number | undefined {
  if (input.catalogSource?.productId !== 'hsbc-life-goal-builder-ii') {
    return undefined
  }

  if (hasCurrentPolicyYearGoalBuilderIiScheduledPayout(input)) {
    if (input.assuranceProfile?.currentAccidentalDeathFloorAmount == null) {
      return undefined
    }

    return Math.max(0, input.assuranceProfile.currentAccidentalDeathFloorAmount)
  }

  const normalized = buildNormalizedPolicyInput(input)
  const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
    ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
    : 0
  const adHocTopUpAmount = normalized.events.topUps.reduce((sum, event) => (
    event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= currentPolicyMonth
      ? sum + event.amount
      : sum
  ), 0)
  const recurringSinglePremiumAmount = currentPolicyMonth > 0
    ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
    : 0
  const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
    event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= currentPolicyMonth
      ? sum + event.amount
      : sum
  ), 0)
  const completedScheduledPayoutErosion = getGoalBuilderIiCompletedScheduledPayoutErosion(input)

  return Math.max(
    0,
    Math.min(2_000_000, cumulativeRegularPremiumPaid * 2)
      + adHocTopUpAmount
      + recurringSinglePremiumAmount
      - withdrawalAmount
      - completedScheduledPayoutErosion,
  )
}

function resolveCurrentAiaEliteSecureIncome5PayProtectedBase(
  input: IlpPolicyInput,
  currentPolicyMonth: number,
): number | undefined {
  if (input.catalogSource?.productId !== 'aia-elite-secure-income-5-pay') {
    return undefined
  }

  if (!canReconstructCurrentAiaEliteSecureIncome5PayProtectedBase(input)) {
    if (input.assuranceProfile?.currentNetProtectedPremiumBase == null) {
      return undefined
    }

    return Math.max(0, input.assuranceProfile.currentNetProtectedPremiumBase)
  }

  const normalized = buildNormalizedPolicyInput(input)
  const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
    ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
    : 0

  return Math.max(0, cumulativeRegularPremiumPaid)
}

function resolveCurrentAiaEliteSecureIncomeSinglePremiumProtectedBase(
  input: IlpPolicyInput,
): number | undefined {
  if (input.catalogSource?.productId !== 'aia-elite-secure-income-single-premium') {
    return undefined
  }

  if (!canReconstructCurrentAiaEliteSecureIncomeSinglePremiumProtectedBase(input)) {
    if (input.assuranceProfile?.currentNetProtectedPremiumBase == null) {
      return undefined
    }

    return Math.max(0, input.assuranceProfile.currentNetProtectedPremiumBase)
  }

  return Math.max(0, input.initialSinglePremium ?? 0)
}

function resolveCurrentHsbcRegularProtectedFloor(
  input: IlpPolicyInput,
  currentPolicyMonth: number,
): number | undefined {
  if (
    !input.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    && input.catalogSource?.productId !== 'hsbc-life-wealth-abundance'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-voyage'
  ) {
    return undefined
  }

  if (hasActiveCurrentScheduledRedemption(input)) {
    if (input.assuranceProfile?.currentNetProtectedPremiumBase == null) {
      return undefined
    }

    return Math.max(0, input.assuranceProfile.currentNetProtectedPremiumBase)
  }

  const normalized = buildNormalizedPolicyInput(input)
  const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
    ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
    : 0
  const regularWithdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
    event.accountId === 'regular'
    && event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= currentPolicyMonth
      ? sum + event.amount
      : sum
  ), 0)

  return Math.max(
    0,
    (cumulativeRegularPremiumPaid * HSBC_WEALTH_FOCUS_DEATH_BENEFIT_FLOOR_MULTIPLIER) - regularWithdrawalAmount,
  )
}

function resolveCurrentHsbcRegularAccidentalDeathFloor(
  input: IlpPolicyInput,
  currentPolicyMonth: number,
): number | undefined {
  if (
    !input.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    && input.catalogSource?.productId !== 'hsbc-life-wealth-abundance'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-voyage'
  ) {
    return undefined
  }

  if (hasActiveCurrentScheduledRedemption(input)) {
    if (input.assuranceProfile?.currentAccidentalDeathFloorAmount == null) {
      return undefined
    }

    return Math.max(0, input.assuranceProfile.currentAccidentalDeathFloorAmount)
  }

  const normalized = buildNormalizedPolicyInput(input)
  const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
    ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
    : 0
  const regularWithdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
    event.accountId === 'regular'
    && event.amount != null
    && event.amount > 0
    && event.startPolicyMonth <= currentPolicyMonth
      ? sum + event.amount
      : sum
  ), 0)

  return Math.max(
    0,
    Math.min(2_000_000, cumulativeRegularPremiumPaid * 2) - regularWithdrawalAmount,
  )
}

function getSmartRetireRemainingWopPremiumWaiverMonths(
  input: IlpPolicyInput,
): number {
  if (
    !isSmartRetireProduct(input)
    || !hasFiniteMip(input)
    || getSmartRetireWopClaimAdmissionStatus(input) !== 'admitted'
  ) {
    return 0
  }

  const remainingMonthsUntilFlexiStart = Math.max(0, (input.mipLength * 12) - input.monthsAlreadyPaid)
  if (remainingMonthsUntilFlexiStart <= 0) {
    return 0
  }

  const remainingWaiverMonthsInput = getSmartRetireRemainingWaiverMonthsInput(input)
  if (remainingWaiverMonthsInput == null) {
    return remainingMonthsUntilFlexiStart
  }

  return Math.max(
    0,
    Math.min(
      remainingMonthsUntilFlexiStart,
      Math.round(remainingWaiverMonthsInput),
    ),
  )
}

function getSmartRetireWopWaivedMonthsForRange(
  input: IlpPolicyInput,
  range: IlpProjectionYearRange,
): number {
  const remainingWaiverMonths = getSmartRetireRemainingWopPremiumWaiverMonths(input)
  if (remainingWaiverMonths <= 0) {
    return 0
  }

  return overlapMonths(
    range.startPolicyMonth,
    range.endPolicyMonth,
    input.monthsAlreadyPaid + 1,
    input.monthsAlreadyPaid + remainingWaiverMonths,
  )
}

function getSmartRetireRegularPremiumContributionSplit(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
): { ownerPaid: number, waived: number } {
  const waivedMonths = getSmartRetireWopWaivedMonthsForRange(normalized.input, context.range)
  if (waivedMonths <= 0) {
    return { ownerPaid: 0, waived: 0 }
  }

  const waivedMonthCutoff = context.range.startPolicyMonth + waivedMonths - 1
  let ownerPaid = 0
  let waived = 0

  for (let policyMonth = context.range.startPolicyMonth; policyMonth <= context.range.endPolicyMonth; policyMonth += 1) {
    const scheduledMonthlyPremium = getScheduledMonthlyPremiumAtMonth(normalized, policyMonth)
    if (scheduledMonthlyPremium <= CONTRIBUTION_TOLERANCE) {
      continue
    }

    if (policyMonth <= waivedMonthCutoff) {
      waived += scheduledMonthlyPremium
      continue
    }

    if (isPremiumHolidayActiveAtMonth(normalized, policyMonth)) {
      continue
    }

    ownerPaid += scheduledMonthlyPremium
  }

  return { ownerPaid, waived }
}

function computeCurrentValueSnapshot(
  input: IlpPolicyInput,
  initialSinglePremiumState: IlpInitialSinglePremiumState = computeInitialSinglePremiumState(buildNormalizedPolicyInput(input)),
): {
  initialSinglePremiumState: IlpInitialSinglePremiumState
  currentValueByAccount: Map<string, number>
  eecRateNow: number
  totalCurrentValue: number
  cancelNowPenalty: number
} {
  const eecRateNow = resolveCurrentExitChargeRate(input)
  const currentValueByAccount = new Map(
    input.accounts.map((account) => [account.id, getEffectiveCurrentValue(account, initialSinglePremiumState)]),
  )
  for (const powerUpBonusCredit of resolveCurrentInvestPlusSpPastDuePowerUpBonusCredits(input)) {
    currentValueByAccount.set(
      powerUpBonusCredit.accountId,
      (currentValueByAccount.get(powerUpBonusCredit.accountId) ?? 0) + powerUpBonusCredit.amount,
    )
  }
  const investStarterPastDuePolicyChargeRefundCredit = resolveCurrentInvestStarterPastDuePolicyChargeRefundCredit(input)
  if (investStarterPastDuePolicyChargeRefundCredit != null) {
    currentValueByAccount.set(
      investStarterPastDuePolicyChargeRefundCredit.accountId,
      (currentValueByAccount.get(investStarterPastDuePolicyChargeRefundCredit.accountId) ?? 0) + investStarterPastDuePolicyChargeRefundCredit.amount,
    )
  }
  const smartRetirePastDueRefundCredit = resolveCurrentSmartRetirePastDueCoiRefundCredit(input)
  if (smartRetirePastDueRefundCredit != null) {
    currentValueByAccount.set(
      smartRetirePastDueRefundCredit.accountId,
      (currentValueByAccount.get(smartRetirePastDueRefundCredit.accountId) ?? 0) + smartRetirePastDueRefundCredit.amount,
    )
  }
  const totalCurrentValue = Array.from(currentValueByAccount.values()).reduce((sum, value) => sum + value, 0)
  const cancelNowPenalty = computeExitChargeAmount(input, eecRateNow, currentValueByAccount)

  return {
    initialSinglePremiumState,
    currentValueByAccount,
    eecRateNow,
    totalCurrentValue,
    cancelNowPenalty,
  }
}

export function computeCurrentDeathBenefitEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-death-benefit-estimate')
  ) {
    return undefined
  }

  const currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  if (input.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const regularProtectedFloor = resolveCurrentHsbcRegularProtectedFloor(input, currentPolicyMonth)
    if (regularProtectedFloor == null) {
      return undefined
    }
    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(
      0,
      Math.max(
        totalCurrentValue,
        topUpAccountValue + Math.max(regularAccountValue, regularProtectedFloor),
      ) - currentAmountOwing,
    )
  }

  if (
    input.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || input.catalogSource?.productId === 'hsbc-life-wealth-voyage'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const regularProtectedFloor = resolveCurrentHsbcRegularProtectedFloor(input, currentPolicyMonth)
    if (regularProtectedFloor == null) {
      return undefined
    }
    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(
      0,
      (topUpAccountValue + Math.max(regularAccountValue, regularProtectedFloor)) - currentAmountOwing,
    )
  }

  if (input.catalogSource?.productId === 'hsbc-life-wealth-accelerate') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null || profile.currentAgeNextBirthday == null) {
      return undefined
    }

    // The Start-up Bonus account value is excluded for non-accidental death in
    // the first 18 policy months, and the current-state shell does not split that
    // value out of today’s IUA balance.
    if (currentPolicyMonth <= 18) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const adHocTopUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const recurringSinglePremiumAmount = currentPolicyMonth > 0
      ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
      : 0
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const baseBenefit = totalCurrentValue * 1.01

    if (profile.currentAgeNextBirthday >= 66) {
      return Math.max(0, baseBenefit - currentAmountOwing)
    }

    const enhancedBase = Math.max(
      0,
      totalCurrentValue - adHocTopUpAmount - recurringSinglePremiumAmount,
    )
    const enhancedCap = input.currency === 'USD' ? 350_000 : 500_000
    const upliftBenefit = Math.min(enhancedBase * 0.15, enhancedCap)

    return Math.max(0, baseBenefit + upliftBenefit - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'hsbc-life-goal-builder-ii') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const sumInsured = resolveCurrentGoalBuilderIiSumInsured(input, currentPolicyMonth)
    if (sumInsured == null) {
      return undefined
    }
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(0, Math.max(totalCurrentValue, sumInsured) - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'hsbc-life-wealth-harvest') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    return Math.max(0, (totalCurrentValue * 1.02) - Math.max(0, profile.currentAmountOwing))
  }

  if (input.catalogSource?.productId === 'prudential-pruactive-linkguard') {
    const profile = input.assuranceProfile
    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentSumAssured == null
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const multiplier = profile.currentAgeNextBirthday < 50
      ? 2
      : profile.currentRetainedMultiplierStatus === 'multiplier-retained'
        ? 2
        : profile.currentRetainedMultiplierStatus === 'multiplier-expired'
          ? 1
          : null
    if (multiplier == null) {
      return undefined
    }

    return Math.max(
      0,
      (profile.currentSumAssured * multiplier) + totalCurrentValue - Math.max(0, profile.currentAmountOwing),
    )
  }

  if (
    input.catalogSource?.productId === 'manulife-smartretire-v-income'
    || input.catalogSource?.productId === 'manulife-smartretire-v-sum'
  ) {
    if (!hasFiniteMip(input)) {
      return undefined
    }

    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    if (input.catalogSource.productId === 'manulife-smartretire-v-income') {
      const scheduledPayout = input.scheduledPayoutAssumption
      if (
        input.currentPolicyYear <= input.mipLength
        && scheduledPayout?.mode === 'scheduled-redemption'
        // Historical or currently active scheduled-redemption assumptions can imply
        // prior policy-account withdrawals that the current-state shortcut cannot
        // reconstruct exactly from today’s static snapshot.
        && hasActiveCurrentScheduledRedemption(input)
      ) {
        return undefined
      }
    }

    if (input.currentPolicyYear > input.mipLength) {
      if (profile.targetRetirementAge == null) {
        return undefined
      }

      if (profile.currentAgeNextBirthday < profile.targetRetirementAge) {
        if (profile.currentBasicSumAssured == null) {
          return undefined
        }

        return Math.max(
          0,
          Math.max(totalCurrentValue, profile.currentBasicSumAssured) - currentAmountOwing,
        )
      }

      return Math.max(0, totalCurrentValue - currentAmountOwing)
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount) * MANULIFE_SMARTRETIRE_DEATH_BENEFIT_FLOOR_MULTIPLIER,
    )

    return Math.max(0, Math.max(totalCurrentValue, protectedFloor) - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'prudential-pruvantage-prosper') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const cumulativeGrowthFlexWithdrawals = normalized.events.partialWithdrawals.reduce((sum, event) => (
      (event.accountId == null || event.accountId === 'growth' || event.accountId === 'flex')
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const growthFlexAccountValue = Math.max(0, currentValueByAccount.get('growth') ?? 0)
      + Math.max(0, currentValueByAccount.get('flex') ?? 0)
    const additionalAccountValue = Math.max(0, currentValueByAccount.get('additional') ?? 0)
    const protectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER) - cumulativeGrowthFlexWithdrawals,
    )
    const grossDeathBenefit = Math.max(protectedFloor, growthFlexAccountValue) + additionalAccountValue

    return Math.max(0, grossDeathBenefit - Math.max(0, profile.currentAmountOwing))
  }

  if (input.catalogSource?.productId === 'prudential-pruvantage-wealth-ii') {
    if (input.distributionAssumption?.mode === 'cash-payout') {
      return undefined
    }

    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const cumulativeGrowthFlexWithdrawals = normalized.events.partialWithdrawals.reduce((sum, event) => (
      (event.accountId == null || event.accountId === 'growth' || event.accountId === 'flex')
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const growthFlexAccountValue = Math.max(0, currentValueByAccount.get('growth') ?? 0)
      + Math.max(0, currentValueByAccount.get('flex') ?? 0)
    const additionalAccountValue = Math.max(0, currentValueByAccount.get('additional') ?? 0)
    const protectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER) - cumulativeGrowthFlexWithdrawals,
    )
    const grossDeathBenefit = Math.max(protectedFloor, growthFlexAccountValue) + additionalAccountValue

    return Math.max(0, grossDeathBenefit - Math.max(0, profile.currentAmountOwing))
  }

  if (input.catalogSource?.productId === 'prudential-pruvantage-assure-sp') {
    const profile = input.assuranceProfile
    if (
      profile?.currentSumAssured == null
      || profile.currentWealthAssureValue == null
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const initialInvestmentAccountValue = Math.max(0, currentValueByAccount.get('iia') ?? 0)
    const additionalInvestmentAccountValue = Math.max(0, currentValueByAccount.get('aia') ?? 0)
    const protectedBase = Math.max(
      0,
      Math.max(profile.currentSumAssured, profile.currentWealthAssureValue, initialInvestmentAccountValue),
    )

    return Math.max(0, protectedBase + additionalInvestmentAccountValue - Math.max(0, profile.currentAmountOwing))
  }

  if (input.catalogSource?.productId === 'prudential-pruvantage-assure-ii') {
    const profile = input.assuranceProfile
    if (
      profile?.currentSumAssured == null
      || profile.currentWealthAssureValue == null
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const growthFlexAccountValue = Math.max(0, currentValueByAccount.get('growth') ?? 0)
      + Math.max(0, currentValueByAccount.get('flex') ?? 0)
    const additionalInvestmentAccountValue = Math.max(0, currentValueByAccount.get('additional') ?? 0)
    const protectedBase = Math.max(
      0,
      Math.max(profile.currentSumAssured, profile.currentWealthAssureValue, growthFlexAccountValue),
    )

    return Math.max(0, protectedBase + additionalInvestmentAccountValue - Math.max(0, profile.currentAmountOwing))
  }

  if (
    input.catalogSource?.productId === 'income-invest-flex'
    || input.catalogSource?.productId === 'income-invest-flex-vantage'
    || input.catalogSource?.productId === 'income-invest-flex-trivantage'
  ) {
    if (currentPolicyMonth < 12) {
      if (input.claimProfile?.currentExcludedClaimBonusValue == null) {
        return undefined
      }

      return Math.max(0, totalCurrentValue - Math.max(0, input.claimProfile.currentExcludedClaimBonusValue))
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount) * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
    )

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (
    input.catalogSource?.productId === 'aia-invest-easy-cash-srs'
    || input.catalogSource?.productId === 'aia-invest-easy-cpf'
  ) {
    return totalCurrentValue
  }

  if (input.catalogSource?.productId === 'income-snack-investment') {
    return totalCurrentValue
  }

  if (input.catalogSource?.productId === 'income-astralink-va2') {
    const profile = input.assuranceProfile
    if (profile?.currentBasicSumAssured == null) {
      return undefined
    }

    return Math.max(totalCurrentValue, Math.max(0, profile.currentBasicSumAssured))
  }

  if (input.catalogSource?.productId === 'great-eastern-prestige-portfolio') {
    return totalCurrentValue
  }

  if (input.catalogSource?.productId === 'aia-platinum-retirement-elite') {
    return Math.max(0, totalCurrentValue * 1.05)
  }

  if (input.catalogSource?.productId === 'great-eastern-prestige-legacy-advantage') {
    const profile = input.assuranceProfile
    if (profile?.currentSumAssured == null) {
      return undefined
    }

    return Math.max(totalCurrentValue, Math.max(0, profile.currentSumAssured))
  }

  if (input.catalogSource?.productId === 'aia-platinum-wealth-elite-2') {
    const profile = input.assuranceProfile
    if (profile?.currentSumAssured == null) {
      return undefined
    }

    return Math.max(totalCurrentValue, Math.max(0, profile.currentSumAssured))
  }

  if (input.catalogSource?.productId === 'aia-platinum-wealth-legacy') {
    const profile = input.assuranceProfile
    if (
      profile?.currentSumAssured == null
      || profile.currentAmountOwing == null
      || profile.currentNoLapsePrivilegeMode == null
    ) {
      return undefined
    }

    const currentInsuredAmount = Math.max(0, profile.currentSumAssured)
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const netPolicyValue = Math.max(0, totalCurrentValue - currentAmountOwing)
    const currentAge = profile.currentAgeNextBirthday

    if (currentAge >= 123) {
      return netPolicyValue
    }

    if (profile.currentNoLapsePrivilegeMode === 'not-in-effect') {
      return Math.max(currentInsuredAmount, netPolicyValue)
    }

    if (profile.currentNoLapsePrivilegeMode === 'expiry-age-85') {
      return currentAge <= 85
        ? Math.max(currentInsuredAmount, netPolicyValue)
        : netPolicyValue
    }

    if (currentAge <= 85) {
      return Math.max(currentInsuredAmount, netPolicyValue)
    }

    if (currentAge <= 100) {
      return Math.max(
        netPolicyValue,
        Math.max(0, currentInsuredAmount * 0.8),
        Math.max(0, currentInsuredAmount - currentAmountOwing),
      )
    }

    return Math.max(netPolicyValue, Math.max(0, currentInsuredAmount - currentAmountOwing))
  }

  if (input.catalogSource?.productId === 'aia-pro-lifetime-protector-ii') {
    const profile = input.assuranceProfile
    if (profile?.currentSumAssured == null) {
      return undefined
    }

    const currentInsuredAmount = Math.max(0, profile.currentSumAssured)
    const variantId = input.catalogSource.variantId
    if (variantId === 'sgd-open-ended-plus') {
      return currentInsuredAmount + Math.max(0, totalCurrentValue)
    }

    if (variantId !== 'sgd-open-ended-max') {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(0, currentInsuredAmount + topUpAmount - withdrawalAmount)

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (
    input.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
  ) {
    const protectedBase = resolveCurrentAiaEliteSecureIncomeSinglePremiumProtectedBase(input)
    if (protectedBase == null) {
      return undefined
    }

    return Math.max(totalCurrentValue * 1.05, protectedBase)
  }

  if (input.catalogSource?.productId === 'aia-elite-secure-income-5-pay') {
    const protectedBase = resolveCurrentAiaEliteSecureIncome5PayProtectedBase(input, currentPolicyMonth)
    if (protectedBase == null) {
      return undefined
    }

    return Math.max(totalCurrentValue * 1.05, protectedBase)
  }

  if (input.catalogSource?.productId === 'aia-pro-achiever-3') {
    const profile = input.assuranceProfile
    if (profile?.currentNetProtectedPremiumBase == null) {
      return undefined
    }

    return Math.max(totalCurrentValue, Math.max(0, profile.currentNetProtectedPremiumBase))
  }

  if (
    input.catalogSource?.productId === 'aia-wealth-venture'
    || input.catalogSource?.productId === 'aia-platinum-wealth-venture-2'
  ) {
    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(0, cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount)

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (input.catalogSource?.productId === 'tokio-marine-gowealth-enrich') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const singlePremiumAccountValue = Math.max(0, currentValueByAccount.get('policy') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)

    return Math.max(0, (singlePremiumAccountValue * 1.05) + topUpAccountValue - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'tokio-marine-goelite') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const singlePremiumAccountValue = Math.max(0, currentValueByAccount.get('policy') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)

    return Math.max(0, (singlePremiumAccountValue * 1.05) + topUpAccountValue - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'tokio-marine-wealth-enhancer-cpfis') {
    const singlePremiumAccountValue = Math.max(0, currentValueByAccount.get('policy') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)

    return Math.max(0, (singlePremiumAccountValue * 1.05) + topUpAccountValue)
  }

  if (input.catalogSource?.productId === 'tokio-marine-goassure') {
    const profile = input.assuranceProfile
    if (
      profile?.currentAmountOwing == null
      || profile.currentProtectionAge == null
      || profile.currentAgeNextBirthday == null
    ) {
      return undefined
    }

    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const protectedAccountValue = Math.max(
      0,
      (currentValueByAccount.get('initial') ?? 0) + (currentValueByAccount.get('accumulation') ?? 0),
    )

    if (profile.currentAgeNextBirthday < profile.currentProtectionAge) {
      return Math.max(0, (protectedAccountValue * 1.01) - currentAmountOwing)
    }

    if (profile.currentBasicSumAssured == null) {
      return undefined
    }

    return Math.max(0, Math.max(protectedAccountValue, profile.currentBasicSumAssured) - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'fwd-invest-goal-1') {
    return Math.max(0, totalCurrentValue * 1.05)
  }

  if (input.catalogSource?.productId === 'fwd-invest-first-summit') {
    return Math.max(0, totalCurrentValue * 1.05)
  }

  if (input.catalogSource?.productId === 'fwd-invest-first-max') {
    return Math.max(0, totalCurrentValue * 1.05)
  }

  if (input.catalogSource?.productId === 'income-wealthlink-gl3') {
    const profile = input.assuranceProfile
    if (profile?.currentAgeNextBirthday == null) {
      return undefined
    }

    let deathBenefitRate: number
    if (profile.currentAgeNextBirthday <= 65) {
      deathBenefitRate = 1.05
    } else if (profile.currentAgeNextBirthday >= 67) {
      deathBenefitRate = 1.01
    } else {
      if (profile.currentDeathBenefitRateTier == null) {
        return undefined
      }

      deathBenefitRate = profile.currentDeathBenefitRateTier === 'net-premium-105' ? 1.05 : 1.01
    }

    const normalized = buildNormalizedPolicyInput(input)
    const initialSinglePremiumBase = getOriginalNetInitialSinglePremiumBase(normalized)
    const topUpAmount = getCumulativeNetTopUpPaidAtMonth(normalized, currentPolicyMonth)
    const recurringSinglePremiumAmount = getCumulativeNetRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const netPremium = Math.max(
      0,
      initialSinglePremiumBase + topUpAmount + recurringSinglePremiumAmount - withdrawalAmount,
    )

    return Math.max(0, netPremium * deathBenefitRate)
  }

  if (input.catalogSource?.productId === 'great-eastern-great-life-advantage-4') {
    const profile = input.assuranceProfile
    if (profile?.currentBasicSumAssured == null || profile.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalChargeAmount = computeCumulativeSimplePartialWithdrawalChargesForCurrentState(
      normalized,
      currentPolicyMonth,
    )
    if (withdrawalChargeAmount == null) {
      return undefined
    }

    const protectedBase = Math.max(
      0,
      profile.currentBasicSumAssured + topUpAmount - withdrawalAmount - withdrawalChargeAmount,
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(0, Math.max(totalCurrentValue, protectedBase) - currentAmountOwing)
  }

  if (
    input.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || input.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalChargeAmount = computeCumulativeSimplePartialWithdrawalChargesForCurrentState(
      normalized,
      currentPolicyMonth,
    )
    if (withdrawalChargeAmount == null) {
      return undefined
    }

    const grossProtectedFloor = Math.max(
      0,
      ((cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount - withdrawalChargeAmount) * 1.01),
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(0, Math.max(totalCurrentValue, grossProtectedFloor) - currentAmountOwing)
  }

  if (
    input.catalogSource?.productId === 'great-eastern-great-invest-advantage-sp'
    || input.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-sp'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const grossProtectedFloor = Math.max(
      0,
      (((input.initialSinglePremium ?? 0) + topUpAmount - withdrawalAmount) * 1.10),
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(0, Math.max(totalCurrentValue, grossProtectedFloor) - currentAmountOwing)
  }

  if (
    input.catalogSource?.productId === 'great-eastern-great-invest-advantage-rsp'
    || input.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-rsp'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const grossProtectedFloor = Math.max(
      0,
      ((cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount) * 1.10),
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    return Math.max(0, Math.max(totalCurrentValue, grossProtectedFloor) - currentAmountOwing)
  }

  if (input.catalogSource?.productId === 'prudential-prulink-investgrowth-sp') {
    if (input.distributionAssumption?.mode === 'cash-payout') {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(
      0,
      (((input.initialSinglePremium ?? 0) + topUpAmount - withdrawalAmount) * 1.10),
    )

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (input.catalogSource?.productId === 'prudential-prulink-investgrowth') {
    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(
      0,
      ((cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount) * 1.10),
    )

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (input.catalogSource?.productId === 'manulife-manulink-investor-ii') {
    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const recurringSinglePremiumAmount = currentPolicyMonth > 0
      ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
      : 0
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedFloor = Math.max(
      0,
      (((input.initialSinglePremium ?? 0) + topUpAmount + recurringSinglePremiumAmount - withdrawalAmount) * 0.01),
    )

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (input.catalogSource?.productId === 'etiqa-invest-plus-sp') {
    const normalized = buildNormalizedPolicyInput(input)
    const netPremiumBase = getInvestPlusSpNetPremiumBaseAtMonth(normalized, currentPolicyMonth)
    const protectedFloor = Math.max(
      0,
      netPremiumBase * 1.01,
    )

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (
    input.catalogSource?.productId === 'etiqa-tiq-invest'
    || input.catalogSource?.productId === 'etiqa-dash-pet-plus'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const adHocTopUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const recurringTopUpAmount = currentPolicyMonth > 0
      ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
      : 0
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const grossPremiumsPaid = Math.max(
      0,
      (input.initialSinglePremium ?? 0) + adHocTopUpAmount + recurringTopUpAmount,
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)

    if (input.catalogSource.productId === 'etiqa-tiq-invest') {
      const protectedFloor = Math.max(
        0,
        (grossPremiumsPaid * 1.05) - withdrawalAmount - currentAmountOwing,
      )

      return Math.max(totalCurrentValue, protectedFloor)
    }

    const protectedFloor = Math.max(
      0,
      ((grossPremiumsPaid - withdrawalAmount) * 1.05) - currentAmountOwing,
    )

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (input.catalogSource?.productId === 'etiqa-invest-starter') {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const grossProtectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount) * 1.05,
    )

    return Math.max(0, Math.max(totalCurrentValue, grossProtectedFloor) - currentAmountOwing)
  }

  if (
    input.catalogSource?.productId === 'singlife-legacy-invest'
    || input.catalogSource?.productId === 'singlife-savvy-invest-ii'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const grossPremiumsPaid = Math.max(
      0,
      (input.initialSinglePremium ?? 0) + cumulativeRegularPremiumPaid + topUpAmount - withdrawalAmount,
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const protectedFloor = Math.max(0, (grossPremiumsPaid * 1.01) - currentAmountOwing)

    return Math.max(totalCurrentValue, protectedFloor)
  }

  if (
    input.catalogSource?.productId === 'etiqa-invest-smart-flex-ii'
    || input.catalogSource?.productId === 'etiqa-invest-smart-vista'
    || input.catalogSource?.productId === 'etiqa-invest-flex-wealth-ii'
    || input.catalogSource?.productId === 'etiqa-invest-flex-prime-ii'
    || input.catalogSource?.productId === 'etiqa-invest-flex-pro'
    || input.catalogSource?.productId === 'etiqa-invest-vista'
    || input.catalogSource?.productId === 'etiqa-invest-wealth-purpose'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const regularWithdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.accountId === 'regular'
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const regularProtectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid * 1.01) - regularWithdrawalAmount,
    )

    return Math.max(
      0,
      (topUpAccountValue + Math.max(regularAccountValue, regularProtectedFloor)) - currentAmountOwing,
    )
  }

  if (
    input.catalogSource?.productId === 'hsbc-life-wealth-invest-cpf'
    || input.catalogSource?.productId === 'hsbc-life-wealth-invest-cash-srs'
  ) {
    const profile = input.assuranceProfile
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const adHocTopUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const recurringTopUpAmount = currentPolicyMonth > 0
      ? getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
      : 0
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const grossPremiumsPaid = Math.max(
      0,
      (input.initialSinglePremium ?? 0) + adHocTopUpAmount + recurringTopUpAmount - withdrawalAmount,
    )
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const protectedFloor = Math.max(0, (grossPremiumsPaid * 1.01) - currentAmountOwing)

    return Math.max(totalCurrentValue, protectedFloor)
  }

  const profile = input.assuranceProfile
  const assuranceRules = input.chargeRules?.filter((rule) => (
    rule.basis === 'assurance-sum-at-risk'
    && rule.assuranceConfig != null
  )) ?? []

  if (!profile || assuranceRules.length === 0) return undefined

  let supportedEstimate: number | undefined

  for (const rule of assuranceRules) {
    switch (rule.assuranceConfig?.formula) {
      case 'manulife-investready-iii-death-ti': {
        if (
          profile.currentNetRegularPremiumBase == null
          || profile.currentNetSupplementaryPremiumBase == null
        ) {
          continue
        }

        const protectedBase = Math.max(
          0,
          profile.currentNetRegularPremiumBase + profile.currentNetSupplementaryPremiumBase,
        )
        const requiresCurrentAmountOwing = input.catalogSource?.productId === 'manulife-investready-growth'
          || input.catalogSource?.productId === 'manulife-investready-iii'
          || input.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
        if (requiresCurrentAmountOwing && profile.currentAmountOwing == null) {
          continue
        }

        const currentAmountOwing = requiresCurrentAmountOwing
          ? Math.max(0, profile.currentAmountOwing ?? 0)
          : 0
        const estimate = Math.max(
          0,
          Math.max(
            totalCurrentValue,
            protectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
          ) - currentAmountOwing,
        )
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'fwd-invest-repayment-inclusive-death': {
        if (
          profile.currentNetRegularPremiumBase == null
          || profile.currentNetSupplementaryPremiumBase == null
          || profile.currentNetRepaymentBase == null
        ) {
          continue
        }

        const protectedBase = Math.max(
          0,
          profile.currentNetRegularPremiumBase
            + profile.currentNetSupplementaryPremiumBase
            + profile.currentNetRepaymentBase,
        )
        const estimate = Math.max(
          totalCurrentValue * 1.05,
          protectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
        )
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'fwd-invest-flexi-elite-death': {
        if (
          profile.currentNetRegularPremiumBase == null
          || profile.currentNetSupplementaryPremiumBase == null
        ) {
          continue
        }

        const protectedBase = Math.max(
          0,
          profile.currentNetRegularPremiumBase + profile.currentNetSupplementaryPremiumBase,
        )
        const estimate = Math.max(
          totalCurrentValue * 1.05,
          protectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
        )
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'manulife-manuinvest-duo-death-ti-tpd': {
        if (profile.currentSumAssured == null) {
          continue
        }

        const estimate = Math.max(totalCurrentValue, Math.max(0, profile.currentSumAssured))
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'income-legacy-flex-solitaire-death-ti': {
        if (profile.currentSumAssured == null) {
          continue
        }

        const estimate = Math.max(totalCurrentValue, Math.max(0, profile.currentSumAssured))
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'hsbc-flexi-choice-death-ti': {
        if (
          profile.currentBasicSumAssured == null
          || profile.currentNetSupplementaryPremiumBase == null
        ) {
          continue
        }

        const estimate = Math.max(
          totalCurrentValue,
          Math.max(0, profile.currentBasicSumAssured + profile.currentNetSupplementaryPremiumBase),
        )
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'hsbc-flexi-max-death-ti': {
        if (profile.currentBasicSumAssured == null) {
          continue
        }

        const estimate = Math.max(0, profile.currentBasicSumAssured) + totalCurrentValue
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'tokio-mpc-net-premium-floor': {
        if (profile.currentNetRegularPremiumBase == null) {
          continue
        }

        if (rule.activeWindow === 'during-mip' && !hasFiniteMip(input)) {
          continue
        }

        const protectedAccountIds = rule.assuranceValueAppliesTo ?? rule.appliesTo
        const protectedAccountValue = sumBalancesForAccounts(currentValueByAccount, protectedAccountIds)
        const supplementalAccountValue = Math.max(0, totalCurrentValue - protectedAccountValue)
        const valueFloorEstimate = supplementalAccountValue + (protectedAccountValue * TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER)
        const coverageAgeNextBirthday = getAssuranceCoverageAgeNextBirthday(
          profile,
          rule.assuranceConfig.formula,
        )
        const isWithinNetPremiumCorridor = rule.activeWindow === 'policy-term'
          ? (rule.assuranceConfig.maxAgeNextBirthday == null
            || coverageAgeNextBirthday <= rule.assuranceConfig.maxAgeNextBirthday)
          : (hasFiniteMip(input) && input.currentPolicyYear <= input.mipLength)
        const estimate = isWithinNetPremiumCorridor
          ? supplementalAccountValue + Math.max(
            protectedAccountValue * TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER,
            Math.max(0, profile.currentNetRegularPremiumBase),
          )
          : valueFloorEstimate

        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'tokio-mpc-locked-in-policy-value': {
        if (profile.currentLockedInPolicyValue == null) {
          continue
        }

        if (rule.activeWindow === 'during-mip' && !hasFiniteMip(input)) {
          continue
        }

        const coverageAgeNextBirthday = getAssuranceCoverageAgeNextBirthday(
          profile,
          rule.assuranceConfig.formula,
        )
        const isWithinLockedInCorridor = rule.activeWindow === 'policy-term'
          ? (rule.assuranceConfig.maxAgeNextBirthday == null
            || coverageAgeNextBirthday <= rule.assuranceConfig.maxAgeNextBirthday)
          : (hasFiniteMip(input) && input.currentPolicyYear <= input.mipLength)

        const estimate = isWithinLockedInCorridor
          ? Math.max(totalCurrentValue, Math.max(0, profile.currentLockedInPolicyValue))
          : totalCurrentValue

        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium': {
        if (
          profile.currentLockedInPolicyValue == null
          || profile.currentAdjustedSinglePremium == null
        ) {
          continue
        }

        const estimate = Math.max(
          totalCurrentValue,
          Math.max(0, profile.currentLockedInPolicyValue),
          Math.max(0, profile.currentAdjustedSinglePremium),
        )

        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      default:
        break
    }
  }

  return supportedEstimate
}

function computeCumulativeSimplePartialWithdrawalChargesForCurrentState(
  normalized: IlpNormalizedPolicyInput,
  currentPolicyMonth: number,
): number | undefined {
  if (currentPolicyMonth <= 0) {
    return 0
  }

  const partialWithdrawalRules = (normalized.input.eventChargeRules ?? []).filter((rule) => (
    rule.trigger === 'partial-withdrawal'
  ))
  if (partialWithdrawalRules.length === 0) {
    return 0
  }

  const supportsCurrentStateShortcut = partialWithdrawalRules.every((rule) => (
    rule.basis === 'event-amount'
    && rule.exclusiveGroup == null
    && rule.groupResolution == null
    && rule.freeEventCount == null
    && rule.freeEventStartPolicyYear == null
    && rule.freeEventMaxAmountRate == null
    && rule.freeEventMaxAmountBasis == null
    && rule.freeAmountPoolRate == null
    && rule.freeAmountPoolBasis == null
    && rule.freeAmountPoolReferencePolicyYear == null
  ))
  if (!supportsCurrentStateShortcut) {
    return undefined
  }

  let totalCharge = 0

  for (const event of normalized.events.partialWithdrawals) {
    if (
      event.amount == null
      || event.amount <= 0
      || event.startPolicyMonth > currentPolicyMonth
      || event.chargeWaived === true
    ) {
      continue
    }

    const policyYear = getPolicyYearForMonth(event.startPolicyMonth)
    const isPostMip = isPostMipPolicyYear(normalized.input, policyYear)
    const eventContext: IlpCashflowYearContext = {
      projectionYear: 1,
      policyYear,
      isPostMip,
      range: {
        startPolicyMonth: event.startPolicyMonth,
        endPolicyMonth: event.startPolicyMonth,
      },
      premiumHolidayMonths: 0,
      payableMonths: 1,
      paymentHistory: {
        premiumYearAtStart: getPremiumYearAtMonth(normalized, event.startPolicyMonth - 1),
        premiumYearAtEnd: getPremiumYearAtMonth(normalized, event.startPolicyMonth),
        premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, event.startPolicyMonth),
      },
    }

    for (const rule of partialWithdrawalRules) {
      const activeWindow = rule.activeWindow ?? 'policy-term'
      if (
        (activeWindow === 'during-mip' && isPostMip)
        || (activeWindow === 'after-mip' && !isPostMip)
      ) {
        continue
      }

      totalCharge += Math.max(0, event.amount * resolveEventChargeRate(rule, eventContext)) + rule.amount
    }
  }

  return totalCharge
}

export function computeCurrentTiBenefitEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-ti-benefit-estimate')
  ) {
    return undefined
  }

  const currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  const profile = input.assuranceProfile
  const claimProfile = input.claimProfile

  if (
    input.catalogSource?.productId === 'hsbc-life-wealth-invest-cpf'
    || input.catalogSource?.productId === 'hsbc-life-wealth-invest-cash-srs'
    || input.catalogSource?.productId === 'singlife-legacy-invest'
    || input.catalogSource?.productId === 'singlife-savvy-invest-ii'
    || input.catalogSource?.productId === 'great-eastern-great-invest-advantage-sp'
    || input.catalogSource?.productId === 'great-eastern-great-invest-advantage-rsp'
    || input.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-sp'
    || input.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-rsp'
    || input.catalogSource?.productId === 'great-eastern-great-life-advantage-4'
    || input.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || input.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
  ) {
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  if (input.catalogSource?.productId === 'income-legacy-flex-solitaire') {
    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  if (input.catalogSource?.productId === 'aia-platinum-retirement-elite') {
    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  if (input.catalogSource?.productId === 'income-astralink-va2') {
    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  if (
    input.catalogSource?.productId === 'income-invest-flex'
    || input.catalogSource?.productId === 'income-invest-flex-vantage'
    || input.catalogSource?.productId === 'income-invest-flex-trivantage'
  ) {
    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  if (input.catalogSource?.productId === 'tokio-marine-goassure') {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(4_500_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'prudential-pruactive-linkguard') {
    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentSumAssured == null
      || profile.currentAmountOwing == null
      || profile.currentAcceleratedTiPayoutMode == null
    ) {
      return undefined
    }

    const multiplier = profile.currentAgeNextBirthday < 50
      ? 2
      : profile.currentRetainedMultiplierStatus === 'multiplier-retained'
        ? 2
        : profile.currentRetainedMultiplierStatus === 'multiplier-expired'
          ? 1
          : null
    if (multiplier == null) {
      return undefined
    }

    const baseBenefit = Math.max(
      0,
      (profile.currentSumAssured * multiplier) - Math.max(0, profile.currentAmountOwing),
    )

    if (profile.currentAcceleratedTiPayoutMode === 'same-as-death-benefit') {
      return Math.max(0, baseBenefit + totalCurrentValue)
    }

    return baseBenefit
  }

  if (
    input.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
    || input.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
  ) {
    return computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  }

  if (
    input.catalogSource?.productId === 'manulife-investready-growth'
    || input.catalogSource?.productId === 'manulife-investready-iii'
    || input.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
  ) {
    if (
      claimProfile?.remainingAggregateTiCap == null
      || claimProfile?.remainingAggregateTiCiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitAtTiClaim(
      input,
      currentValueByAccount,
      totalCurrentValue,
    )
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      deathBenefitAtClaim,
      Math.max(0, claimProfile.remainingAggregateTiCap),
      Math.max(0, claimProfile.remainingAggregateTiCiCap),
      1_000_000,
    )
  }

  if (
    input.catalogSource?.productId === 'hsbc-life-wealth-harvest'
    || input.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || input.catalogSource?.productId === 'hsbc-life-wealth-voyage'
  ) {
    if (
      claimProfile?.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitAtTiClaim(
      input,
      currentValueByAccount,
      totalCurrentValue,
    )
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(3_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')) {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitAtTiClaim(
      input,
      currentValueByAccount,
      totalCurrentValue,
    )
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(3_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'hsbc-life-wealth-accelerate') {
    if (
      claimProfile?.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitAtTiClaim(
      input,
      currentValueByAccount,
      totalCurrentValue,
    )
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(3_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'hsbc-life-goal-builder-ii') {
    if (
      !profile
      || profile.currentAmountOwing == null
      || !claimProfile
      || claimProfile.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const sumInsured = resolveCurrentGoalBuilderIiSumInsured(input, currentPolicyMonth)
    if (sumInsured == null) {
      return undefined
    }
    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const remainingAggregateTiCap = Math.max(0, Math.min(3_000_000, claimProfile.remainingAggregateTiCap))
    const deathBenefitAtClaim = Math.max(0, Math.max(totalCurrentValue, sumInsured) - currentAmountOwing)

    return Math.min(remainingAggregateTiCap, deathBenefitAtClaim)
  }

  if (input.catalogSource?.productId === 'manulife-manulink-investor-ii') {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(1_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'etiqa-tiq-invest') {
    if (
      profile?.currentAmountOwing == null
      || claimProfile?.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'etiqa-dash-pet-plus') {
    if (
      profile?.currentAmountOwing == null
      || claimProfile?.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (
    input.catalogSource?.productId === 'etiqa-invest-starter'
    || input.catalogSource?.productId === 'etiqa-invest-flex-wealth-ii'
    || input.catalogSource?.productId === 'etiqa-invest-flex-prime-ii'
    || input.catalogSource?.productId === 'etiqa-invest-flex-pro'
    || input.catalogSource?.productId === 'etiqa-invest-vista'
  ) {
    if (
      profile?.currentAmountOwing == null
      || claimProfile?.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (
    input.catalogSource?.productId === 'etiqa-invest-smart-flex-ii'
    || input.catalogSource?.productId === 'etiqa-invest-smart-vista'
    || input.catalogSource?.productId === 'etiqa-invest-wealth-purpose'
  ) {
    if (
      profile?.currentAmountOwing == null
      || claimProfile?.remainingAggregateTiCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (
    input.catalogSource?.productId === 'aia-platinum-wealth-elite-2'
    || input.catalogSource?.productId === 'aia-platinum-wealth-legacy'
  ) {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(2_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (
    input.catalogSource?.productId === 'fwd-invest-first-horizon'
    || input.catalogSource?.productId === 'fwd-invest-flexi-vii'
  ) {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(2_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'manulife-manuinvest-duo') {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(1_000_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'great-eastern-prestige-legacy-advantage') {
    if (claimProfile?.remainingAggregateTiCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(7_500_000, claimProfile.remainingAggregateTiCap)),
      deathBenefitAtClaim,
    )
  }

  const assuranceRules = input.chargeRules?.filter((rule) => (
    rule.basis === 'assurance-sum-at-risk'
    && rule.assuranceConfig != null
  )) ?? []

  if (
    !profile
    || !claimProfile
    || claimProfile.currentIndebtedness == null
    || claimProfile.remainingAggregateTiCap == null
    || assuranceRules.length === 0
  ) {
    return undefined
  }

  let supportedEstimate: number | undefined
  const remainingAggregateTiCap = Math.max(0, Math.min(3_000_000, claimProfile.remainingAggregateTiCap))

  for (const rule of assuranceRules) {
    switch (rule.assuranceConfig?.formula) {
      case 'hsbc-flexi-choice-death-ti': {
        if (
          profile.currentBasicSumAssured == null
          || profile.currentNetSupplementaryPremiumBase == null
        ) {
          continue
        }

        const deathBenefitAtClaim = Math.max(
          0,
          Math.max(
            totalCurrentValue,
            profile.currentBasicSumAssured + profile.currentNetSupplementaryPremiumBase,
          ) - claimProfile.currentIndebtedness,
        )
        const estimate = Math.min(remainingAggregateTiCap, deathBenefitAtClaim)
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      case 'hsbc-flexi-max-death-ti': {
        if (profile.currentBasicSumAssured == null) {
          continue
        }

        const deathBenefitAtClaim = Math.max(
          0,
          (profile.currentBasicSumAssured + totalCurrentValue) - claimProfile.currentIndebtedness,
        )
        const estimate = Math.min(remainingAggregateTiCap, deathBenefitAtClaim)
        supportedEstimate = supportedEstimate == null
          ? estimate
          : Math.max(supportedEstimate, estimate)
        break
      }
      default:
        break
    }
  }

  return supportedEstimate
}

export function computeCurrentTpdBenefitEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-tpd-benefit-estimate')
  ) {
    return undefined
  }

  const _currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  const profile = input.assuranceProfile
  const claimProfile = input.claimProfile

  if (input.catalogSource?.productId === 'tokio-marine-goassure') {
    if (
      profile?.currentProtectionAge == null
      || profile.currentAgeNextBirthday == null
    ) {
      return undefined
    }

    if (profile.currentAgeNextBirthday >= profile.currentProtectionAge) {
      return 0
    }

    if (
      profile.currentTpdAccelerationRatio == null
      || claimProfile?.remainingAggregateTpdCap == null
    ) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(4_500_000, claimProfile.remainingAggregateTpdCap)),
      Math.max(0, deathBenefitAtClaim * profile.currentTpdAccelerationRatio),
    )
  }

  if (input.catalogSource?.productId === 'prudential-pruactive-linkguard') {
    if (claimProfile?.currentTpdPayoutStage == null) {
      return undefined
    }

    if (claimProfile.currentTpdPayoutStage === 'balance-lump-sum-payable-now') {
      const remainingStagedBenefitBalance = getCurrentClaimHistoryRemainingStagedBenefitBalance(input)
        ?? claimProfile.currentTpdRemainingBalance
      if (remainingStagedBenefitBalance == null) {
        return undefined
      }

      return Math.max(0, remainingStagedBenefitBalance)
    }

    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentSumAssured == null
      || profile.currentAmountOwing == null
      || claimProfile.currentTpdSettlementMode == null
    ) {
      return undefined
    }

    const multiplier = profile.currentAgeNextBirthday < 50
      ? 2
      : profile.currentRetainedMultiplierStatus === 'multiplier-retained'
        ? 2
        : profile.currentRetainedMultiplierStatus === 'multiplier-expired'
          ? 1
          : null
    if (multiplier == null) {
      return undefined
    }

    const tpdSumAssured = Math.max(
      0,
      (profile.currentSumAssured * multiplier) - Math.max(0, profile.currentAmountOwing),
    )
    const firstPayableLumpSum = Math.min(2_000_000, tpdSumAssured)

    if (claimProfile.currentTpdSettlementMode === 'same-as-death-benefit') {
      return Math.max(0, firstPayableLumpSum + totalCurrentValue)
    }

    return firstPayableLumpSum
  }

  if (input.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2') {
    if (claimProfile?.remainingAggregateTpdCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTpdCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'income-astralink-va2') {
    if (claimProfile?.remainingAggregateTpdCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(6_500_000, claimProfile.remainingAggregateTpdCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'great-eastern-great-life-advantage-4') {
    if (claimProfile?.remainingAggregateTpdCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTpdCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'great-eastern-wealth-advantage-4') {
    if (claimProfile?.remainingAggregateTpdCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTpdCap)),
      deathBenefitAtClaim,
    )
  }

  if (input.catalogSource?.productId === 'manulife-manuinvest-duo') {
    if (claimProfile?.remainingAggregateTpdCap == null) {
      return undefined
    }

    const deathBenefitAtClaim = computeCurrentDeathBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
    if (deathBenefitAtClaim == null) {
      return undefined
    }

    return Math.min(
      Math.max(0, Math.min(5_000_000, claimProfile.remainingAggregateTpdCap)),
      deathBenefitAtClaim,
    )
  }

  const assuranceRules = input.chargeRules?.filter((rule) => (
    rule.basis === 'assurance-sum-at-risk'
    && rule.assuranceConfig != null
  )) ?? []

  if (
    !profile
    || !claimProfile
    || profile.currentBasicSumAssured == null
    || claimProfile.currentIndebtedness == null
    || claimProfile.remainingAggregateTpdCap == null
    || assuranceRules.length === 0
  ) {
    return undefined
  }

  const supportsHsbcFlexiTpd = assuranceRules.some((rule) => (
    rule.assuranceConfig?.formula === 'hsbc-flexi-choice-death-ti'
    || rule.assuranceConfig?.formula === 'hsbc-flexi-max-death-ti'
  ))

  if (!supportsHsbcFlexiTpd) {
    return undefined
  }

  const remainingAggregateTpdCap = Math.max(0, Math.min(6_000_000, claimProfile.remainingAggregateTpdCap))

  if (
    input.catalogSource?.productId === 'hsbc-life-flexi-protector'
    && claimProfile.currentTpdPayoutStage === 'balance-lump-sum-payable-now'
  ) {
    const remainingStagedBenefitBalance = getCurrentClaimHistoryRemainingStagedBenefitBalance(input)
      ?? claimProfile.currentTpdRemainingBalance
    if (remainingStagedBenefitBalance == null) {
      return undefined
    }

    return Math.min(
      remainingAggregateTpdCap,
      Math.max(0, remainingStagedBenefitBalance),
    )
  }

  const tpdBenefitAtClaim = Math.max(
    0,
    profile.currentBasicSumAssured - claimProfile.currentIndebtedness,
  )

  return Math.min(remainingAggregateTpdCap, tpdBenefitAtClaim)
}

export function computeCurrentAccidentalTpdBenefitEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-accidental-tpd-benefit-estimate')
  ) {
    return undefined
  }

  if (input.catalogSource?.productId !== 'income-astralink-va2') {
    return undefined
  }

  const profile = input.assuranceProfile
  const claimProfile = input.claimProfile
  if (
    profile?.currentAgeNextBirthday == null
    || profile.currentBasicSumAssured == null
    || claimProfile?.currentAccidentalDeathMode == null
  ) {
    return undefined
  }

  if (profile.currentAgeNextBirthday >= 70) {
    return undefined
  }

  const currentTpdBenefitEstimate = computeCurrentTpdBenefitEstimate(input, currentValueByAccount, totalCurrentValue)
  if (currentTpdBenefitEstimate == null) {
    return undefined
  }

  const accidentalTpdRate = claimProfile.currentAccidentalDeathMode === 'restricted-activity-accident' ? 0.3 : 1
  const accidentalTpdAtClaim = currentTpdBenefitEstimate + (Math.max(0, profile.currentBasicSumAssured) * accidentalTpdRate)

  if (claimProfile.remainingAggregateTpdCap == null) {
    return accidentalTpdAtClaim
  }

  return Math.min(
    Math.max(0, Math.min(6_500_000, claimProfile.remainingAggregateTpdCap)),
    accidentalTpdAtClaim,
  )
}

export function computeCurrentResidualDeathBenefitAfterTiEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-residual-death-benefit-after-ti-estimate')
  ) {
    return undefined
  }

  if (
    input.catalogSource?.productId !== 'hsbc-life-wealth-harvest'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-abundance'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-voyage'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-focus-flexi-1'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-focus-flexi-3'
    && input.catalogSource?.productId !== 'hsbc-life-wealth-focus-flexi-5'
    && input.catalogSource?.productId !== 'hsbc-life-flexi-protector'
    && input.catalogSource?.productId !== 'great-eastern-prestige-legacy-advantage'
    && input.catalogSource?.productId !== 'aia-platinum-wealth-elite-2'
    && input.catalogSource?.productId !== 'aia-platinum-wealth-legacy'
    && input.catalogSource?.productId !== 'manulife-manuinvest-duo'
    && input.catalogSource?.productId !== 'manulife-manulink-investor-ii'
    && input.catalogSource?.productId !== 'manulife-investready-growth'
    && input.catalogSource?.productId !== 'manulife-investready-iii'
    && input.catalogSource?.productId !== 'manulife-investready-iii-sep-2025'
  ) {
    return undefined
  }

  const currentDeathBenefitEstimate = computeCurrentDeathBenefitAtTiClaim(
    input,
    currentValueByAccount,
    totalCurrentValue,
  )
  const currentTiBenefitEstimate = computeCurrentTiBenefitEstimate(
    input,
    currentValueByAccount,
    totalCurrentValue,
  )

  if (input.catalogSource?.productId === 'hsbc-life-flexi-protector') {
    if (currentTiBenefitEstimate == null) {
      return undefined
    }

    return Math.max(0, totalCurrentValue - currentTiBenefitEstimate)
  }

  if (
    currentDeathBenefitEstimate == null
    || currentTiBenefitEstimate == null
  ) {
    return undefined
  }

  return Math.max(0, currentDeathBenefitEstimate - currentTiBenefitEstimate)
}

export function computeCurrentResidualDeathBenefitAfterTpdEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-residual-death-benefit-after-tpd-estimate')
  ) {
    return undefined
  }

  if (input.catalogSource?.productId === 'great-eastern-great-life-advantage-4') {
    if (input.claimProfile?.currentTpdContinuationEventStatus == null) {
      return undefined
    }

    return input.claimProfile.currentTpdContinuationEventStatus === 'triggered'
      ? Math.max(0, totalCurrentValue)
      : 0
  }

  if (input.catalogSource?.productId !== 'manulife-manuinvest-duo') {
    return undefined
  }

  const currentDeathBenefitEstimate = computeCurrentDeathBenefitEstimate(
    input,
    currentValueByAccount,
    totalCurrentValue,
  )
  const currentTpdBenefitEstimate = computeCurrentTpdBenefitEstimate(
    input,
    currentValueByAccount,
    totalCurrentValue,
  )

  if (
    currentDeathBenefitEstimate == null
    || currentTpdBenefitEstimate == null
  ) {
    return undefined
  }

  return Math.max(0, currentDeathBenefitEstimate - currentTpdBenefitEstimate)
}

export function computeCurrentTiBenefitAfterTpdEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-ti-benefit-after-tpd-estimate')
  ) {
    return undefined
  }

  if (input.catalogSource?.productId !== 'great-eastern-great-life-advantage-4') {
    return undefined
  }

  if (input.claimProfile?.currentTpdContinuationEventStatus == null) {
    return undefined
  }

  return input.claimProfile.currentTpdContinuationEventStatus === 'triggered'
    ? Math.max(0, totalCurrentValue)
    : 0
}

export function computeCurrentAccidentalDisabilityBenefitEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-accidental-disability-benefit-estimate')
  ) {
    return undefined
  }

  const _currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  const claimProfile = input.claimProfile
  if (claimProfile?.currentAccidentalDisabilityPayoutStage == null) {
    return undefined
  }

  if (claimProfile.currentAccidentalDisabilityPayoutStage === 'balance-lump-sum-payable-now') {
    const remainingStagedBenefitBalance = getCurrentClaimHistoryRemainingStagedBenefitBalance(
      input,
      'accidental-disability-staged-payout',
    ) ?? claimProfile.currentAccidentalDisabilityRemainingBalance
    if (remainingStagedBenefitBalance == null) {
      return undefined
    }

    return Math.max(0, remainingStagedBenefitBalance)
  }

  const productId = input.catalogSource?.productId
  if (
    productId !== 'prudential-pruvantage-assure-ii'
    && productId !== 'prudential-pruvantage-assure-sp'
    && productId !== 'prudential-pruvantage-wealth-ii'
  ) {
    return undefined
  }

  const accidentalDisabilityBenefitAtClaim = computeCurrentDeathBenefitEstimate(
    input,
    currentValueByAccount,
    totalCurrentValue,
  )
  if (accidentalDisabilityBenefitAtClaim == null) {
    return undefined
  }

  return Math.min(2_000_000, accidentalDisabilityBenefitAtClaim)
}

export function computeCurrentAccidentalDeathBenefitEstimate(
  input: IlpPolicyInput,
  currentValueByAccount: Map<string, number>,
  totalCurrentValue: number,
): number | undefined {
  if (
    input.catalogSource?.modeledEconomics != null
    && !input.catalogSource.modeledEconomics.includes('kernel:current-accidental-death-benefit-estimate')
  ) {
    return undefined
  }

  const currentPolicyMonth = Number.isFinite(input.monthsAlreadyPaid)
    ? Math.max(0, input.monthsAlreadyPaid)
    : 0
  if (hasActiveCurrentLapse(input)) {
    return undefined
  }

  if (input.catalogSource?.productId !== 'great-eastern-prestige-portfolio') {
    if (
      input.catalogSource?.productId !== 'income-astralink-va2'
      && input.catalogSource?.productId !== 'income-wealthlink-gl3'
      && input.catalogSource?.productId !== 'aia-invest-easy-cash-srs'
      && input.catalogSource?.productId !== 'aia-invest-easy-cpf'
      && input.catalogSource?.productId !== 'aia-elite-secure-income-single-premium'
      && input.catalogSource?.productId !== 'aia-elite-secure-income-5-pay'
      && input.catalogSource?.productId !== 'aia-pro-achiever-3'
      && input.catalogSource?.productId !== 'aia-wealth-venture'
      && input.catalogSource?.productId !== 'aia-platinum-wealth-venture-2'
      && input.catalogSource?.productId !== 'aia-platinum-retirement-elite'
      && input.catalogSource?.productId !== 'income-snack-investment'
      && input.catalogSource?.productId !== 'tokio-marine-goaffluence'
      && input.catalogSource?.productId !== 'tokio-marine-gowealth-enrich'
      && input.catalogSource?.productId !== 'tokio-marine-goelite'
      && input.catalogSource?.productId !== 'tokio-marine-wealth-flexi-link-5-10'
      && input.catalogSource?.productId !== 'tokio-marine-wealth-flexi-link-3-12'
      && input.catalogSource?.productId !== 'prudential-pruvantage-prosper'
      && input.catalogSource?.productId !== 'prudential-pruvantage-wealth-ii'
      && !input.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
      && input.catalogSource?.productId !== 'hsbc-life-wealth-abundance'
      && input.catalogSource?.productId !== 'hsbc-life-wealth-voyage'
      && input.catalogSource?.productId !== 'hsbc-life-goal-builder-ii'
    ) {
      return undefined
    }
  }

  const profile = input.assuranceProfile

  if (
    input.catalogSource?.productId === 'tokio-marine-wealth-flexi-link-5-10'
    || input.catalogSource?.productId === 'tokio-marine-wealth-flexi-link-3-12'
  ) {
    if (currentPolicyMonth >= 12 || profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const hasAmbiguousWithdrawalAccountHistory = normalized.events.partialWithdrawals.some((event) => (
      event.accountId == null
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
    ))
    if (hasAmbiguousWithdrawalAccountHistory) {
      return undefined
    }

    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const accumulationWithdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.accountId === 'accumulation'
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const totalInvestmentValue = Math.max(0, currentValueByAccount.get('accumulation') ?? 0)
    const netPremiums = Math.max(0, cumulativeRegularPremiumPaid - accumulationWithdrawalAmount)
    const grossAccidentalDeathBenefit = Math.max(totalInvestmentValue * 1.05, netPremiums * 1.05)

    return Math.max(0, grossAccidentalDeathBenefit - Math.max(0, profile.currentAmountOwing))
  }

  const currentDeathBenefitEstimate = computeCurrentDeathBenefitEstimate(
    input,
    currentValueByAccount,
    totalCurrentValue,
  )
  if (currentDeathBenefitEstimate == null) {
    return undefined
  }

  if (input.catalogSource?.productId === 'aia-elite-secure-income-single-premium') {
    if (currentPolicyMonth >= 60) {
      return undefined
    }

    if ((input.initialSinglePremium ?? 0) <= 0) {
      return undefined
    }

    return currentDeathBenefitEstimate + (Math.max(0, input.initialSinglePremium ?? 0) * 0.1)
  }

  if (input.catalogSource?.productId === 'aia-elite-secure-income-5-pay') {
    if (currentPolicyMonth >= 60) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0

    return currentDeathBenefitEstimate + (Math.max(0, cumulativeRegularPremiumPaid) * 0.5)
  }

  if (input.catalogSource?.productId === 'aia-platinum-retirement-elite') {
    if (currentPolicyMonth >= 60) {
      return undefined
    }

    if ((input.initialSinglePremium ?? 0) > CONTRIBUTION_TOLERANCE) {
      return currentDeathBenefitEstimate + (Math.max(0, input.initialSinglePremium ?? 0) * 0.1)
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0

    return currentDeathBenefitEstimate + (Math.max(0, cumulativeRegularPremiumPaid) * 0.5)
  }

  if (
    input.catalogSource?.productId === 'aia-pro-achiever-3'
    || input.catalogSource?.productId === 'aia-wealth-venture'
    || input.catalogSource?.productId === 'aia-platinum-wealth-venture-2'
  ) {
    if (currentPolicyMonth >= 24) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0

    return currentDeathBenefitEstimate + Math.max(0, cumulativeRegularPremiumPaid)
  }

  if (input.catalogSource?.productId === 'prudential-pruvantage-prosper') {
    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const cumulativeGrowthFlexWithdrawals = normalized.events.partialWithdrawals.reduce((sum, event) => (
      (event.accountId == null || event.accountId === 'growth' || event.accountId === 'flex')
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const growthFlexAccountValue = Math.max(0, currentValueByAccount.get('growth') ?? 0)
      + Math.max(0, currentValueByAccount.get('flex') ?? 0)
    const additionalAccountValue = Math.max(0, currentValueByAccount.get('additional') ?? 0)
    const protectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid * 1.05) - cumulativeGrowthFlexWithdrawals,
    )
    const grossAccidentalDeathBenefit = Math.max(protectedFloor, growthFlexAccountValue) + additionalAccountValue

    return Math.max(0, grossAccidentalDeathBenefit - Math.max(0, profile.currentAmountOwing))
  }

  if (input.catalogSource?.productId === 'prudential-pruvantage-wealth-ii') {
    if (input.distributionAssumption?.mode === 'cash-payout') {
      return undefined
    }

    if (profile?.currentAmountOwing == null) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const cumulativeRegularPremiumPaid = currentPolicyMonth > 0
      ? getCumulativePaidRegularPremiumAtMonth(normalized, currentPolicyMonth)
      : 0
    const cumulativeGrowthFlexWithdrawals = normalized.events.partialWithdrawals.reduce((sum, event) => (
      (event.accountId == null || event.accountId === 'growth' || event.accountId === 'flex')
      && event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const growthFlexAccountValue = Math.max(0, currentValueByAccount.get('growth') ?? 0)
      + Math.max(0, currentValueByAccount.get('flex') ?? 0)
    const additionalAccountValue = Math.max(0, currentValueByAccount.get('additional') ?? 0)
    const protectedFloor = Math.max(
      0,
      (cumulativeRegularPremiumPaid * 1.05) - cumulativeGrowthFlexWithdrawals,
    )
    const grossAccidentalDeathBenefit = Math.max(protectedFloor, growthFlexAccountValue) + additionalAccountValue

    return Math.max(0, grossAccidentalDeathBenefit - Math.max(0, profile.currentAmountOwing))
  }

  if (
    input.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
  ) {
    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentAmountOwing == null
      || profile.currentAgeNextBirthday >= 75
    ) {
      return undefined
    }

    const regularAccidentalDeathFloor = resolveCurrentHsbcRegularAccidentalDeathFloor(input, currentPolicyMonth)
    if (regularAccidentalDeathFloor == null) {
      return undefined
    }

    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const grossAccidentalDeathBenefit = Math.max(regularAccountValue, regularAccidentalDeathFloor) + topUpAccountValue

    return Math.max(
      currentDeathBenefitEstimate,
      Math.max(0, grossAccidentalDeathBenefit - Math.max(0, profile.currentAmountOwing)),
    )
  }

  if (input.catalogSource?.productId === 'tokio-marine-goaffluence') {
    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentAgeNextBirthday >= 75
      || input.mipLength == null
      || input.currentPolicyYear > input.mipLength
    ) {
      return undefined
    }

    const hasPremiumBandHistoryAmbiguity = (input.policyEvents ?? []).some((event) => (
      event.startPolicyMonth <= currentPolicyMonth
      && (event.type === 'premium-holiday' || event.type === 'regular-premium-reduction')
    ))
    if (hasPremiumBandHistoryAmbiguity) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const annualisedRegularPremium = Math.max(0, normalized.regularPremiums.committedAnnualPremiumAtIssue)
    if (annualisedRegularPremium <= 0) {
      return undefined
    }

    const accidentalDeathBenefit = annualisedRegularPremium < 12_000
      ? 50_000
      : annualisedRegularPremium < 24_000
        ? 75_000
        : 100_000

    return currentDeathBenefitEstimate + accidentalDeathBenefit
  }

  if (
    input.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || input.catalogSource?.productId === 'hsbc-life-wealth-voyage'
  ) {
    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentAgeNextBirthday >= 75
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const regularAccidentalDeathFloor = resolveCurrentHsbcRegularAccidentalDeathFloor(input, currentPolicyMonth)
    if (regularAccidentalDeathFloor == null) {
      return undefined
    }

    const regularAccountValue = Math.max(0, currentValueByAccount.get('regular') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const grossAccidentalDeathBenefit = Math.max(regularAccountValue, regularAccidentalDeathFloor) + topUpAccountValue
    const netAccidentalDeathBenefit = Math.max(0, grossAccidentalDeathBenefit - Math.max(0, profile.currentAmountOwing))

    return Math.max(currentDeathBenefitEstimate, netAccidentalDeathBenefit)
  }

  if (input.catalogSource?.productId === 'hsbc-life-goal-builder-ii') {
    if (
      profile?.currentAgeNextBirthday == null
      || profile.currentAgeNextBirthday >= 75
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const accidentalDeathSumInsured = resolveCurrentGoalBuilderIiAccidentalDeathSumInsured(input, currentPolicyMonth)
    if (accidentalDeathSumInsured == null) {
      return undefined
    }

    const netAccidentalDeathBenefit = Math.max(
      0,
      Math.max(totalCurrentValue, accidentalDeathSumInsured) - Math.max(0, profile.currentAmountOwing),
    )

    return Math.max(currentDeathBenefitEstimate, netAccidentalDeathBenefit)
  }

  if (input.catalogSource?.productId === 'great-eastern-prestige-portfolio') {
    if (profile?.currentAgeNextBirthday == null) {
      return undefined
    }

    if (profile.currentAgeNextBirthday >= 80) {
      return currentDeathBenefitEstimate
    }

    if (profile.currentBasicSumAssured == null) {
      return undefined
    }

    return Math.max(currentDeathBenefitEstimate, Math.max(0, profile.currentBasicSumAssured))
  }

  if (input.catalogSource?.productId === 'income-wealthlink-gl3') {
    if (profile.currentAgeNextBirthday < 66 || profile.currentAgeNextBirthday >= 75) {
      return undefined
    }

    const currentPolicyMonthForWealthLink = Number.isFinite(input.monthsAlreadyPaid)
      ? Math.max(0, input.monthsAlreadyPaid)
      : 0
    const normalized = buildNormalizedPolicyInput(input)
    const initialSinglePremiumBase = getOriginalNetInitialSinglePremiumBase(normalized)
    const topUpAmount = getCumulativeNetTopUpPaidAtMonth(normalized, currentPolicyMonthForWealthLink)
    const recurringSinglePremiumAmount = getCumulativeNetRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonthForWealthLink)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonthForWealthLink
        ? sum + event.amount
        : sum
    ), 0)
    const netPremium = Math.max(
      0,
      initialSinglePremiumBase + topUpAmount + recurringSinglePremiumAmount - withdrawalAmount,
    )

    return Math.max(totalCurrentValue, netPremium * 1.05)
  }

  if (
    input.catalogSource?.productId === 'aia-invest-easy-cash-srs'
    || input.catalogSource?.productId === 'aia-invest-easy-cpf'
  ) {
    if (currentPolicyMonth >= 12) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const recurringSinglePremiumAmount = getCumulativeRecurringSinglePremiumPaidAtMonth(normalized, currentPolicyMonth)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const protectedPremiumBase = Math.max(
      0,
      (input.initialSinglePremium ?? 0) + topUpAmount + recurringSinglePremiumAmount - withdrawalAmount,
    )

    return Math.max(currentDeathBenefitEstimate, protectedPremiumBase * 1.1)
  }

  if (input.catalogSource?.productId === 'tokio-marine-gowealth-enrich') {
    if (
      profile.currentAgeNextBirthday == null
      || profile.currentAgeNextBirthday >= 75
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const singlePremiumAccountValue = Math.max(0, currentValueByAccount.get('policy') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const accidentalDeathBenefit = Math.max(0, (singlePremiumAccountValue * 1.2) + topUpAccountValue - currentAmountOwing)

    return Math.max(currentDeathBenefitEstimate, accidentalDeathBenefit)
  }

  if (input.catalogSource?.productId === 'tokio-marine-goelite') {
    if (
      profile.currentAgeNextBirthday == null
      || profile.currentAgeNextBirthday >= 75
      || profile.currentAmountOwing == null
    ) {
      return undefined
    }

    const currentAmountOwing = Math.max(0, profile.currentAmountOwing)
    const singlePremiumAccountValue = Math.max(0, currentValueByAccount.get('policy') ?? 0)
    const topUpAccountValue = Math.max(0, currentValueByAccount.get('topup') ?? 0)
    const accidentalDeathBenefit = Math.max(0, (singlePremiumAccountValue * 1.1) + topUpAccountValue - currentAmountOwing)

    return Math.max(currentDeathBenefitEstimate, accidentalDeathBenefit)
  }

  if (profile?.currentAgeNextBirthday == null) {
    return undefined
  }

  if (input.catalogSource?.productId === 'income-snack-investment') {
    if (profile.currentAgeNextBirthday >= 75) {
      return undefined
    }

    const normalized = buildNormalizedPolicyInput(input)
    const topUpAmount = normalized.events.topUps.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const withdrawalAmount = normalized.events.partialWithdrawals.reduce((sum, event) => (
      event.amount != null
      && event.amount > 0
      && event.startPolicyMonth <= currentPolicyMonth
        ? sum + event.amount
        : sum
    ), 0)
    const netPremium = Math.max(0, (input.initialSinglePremium ?? 0) + topUpAmount - withdrawalAmount)

    return Math.max(currentDeathBenefitEstimate, netPremium * 1.05)
  }

  if (profile.currentAgeNextBirthday >= 70) {
    return currentDeathBenefitEstimate
  }

  if (profile.currentBasicSumAssured == null) {
    return undefined
  }

  const accidentalDeathMode = input.claimProfile?.currentAccidentalDeathMode
  if (accidentalDeathMode == null) {
    return undefined
  }

  const accidentalDeathRate = accidentalDeathMode === 'restricted-activity-accident' ? 0.3 : 1
  return currentDeathBenefitEstimate + (Math.max(0, profile.currentBasicSumAssured) * accidentalDeathRate)
}

function getEventChargeEvents(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  rule: IlpEventChargeRule,
  repaymentEvents: IlpRepaymentEvent[],
): Array<IlpPolicyEvent | IlpRepaymentEvent> {
  switch (rule.trigger) {
    case 'premium-holiday-repayment':
      return repaymentEvents.filter((event) => event.type === 'premium-holiday-repayment')
    case 'recurring-single-premium':
      return normalized.events.recurringSinglePremiums.filter((event) => (
        overlapMonths(
          context.range.startPolicyMonth,
          context.range.endPolicyMonth,
          event.startPolicyMonth,
          event.startPolicyMonth + event.durationMonths - 1,
        ) > 0
      ))
    case 'premium-holiday':
      return normalized.events.premiumHolidays.filter((event) => (
        overlapMonths(
          context.range.startPolicyMonth,
          context.range.endPolicyMonth,
          event.startPolicyMonth,
          event.startPolicyMonth + event.durationMonths - 1,
        ) > 0
      ))
    case 'regular-premium-reduction':
      if (rule.basis === 'annual-reduction-with-active-months') {
        return normalized.events.regularPremiumReductions.filter((event) => (
          overlapMonths(
            context.range.startPolicyMonth,
            context.range.endPolicyMonth,
            event.startPolicyMonth,
            Number.MAX_SAFE_INTEGER,
          ) > 0
        )).slice(0, 1)
      }
      return normalized.events.regularPremiumReductions.filter((event) => (
        event.startPolicyMonth >= context.range.startPolicyMonth
        && event.startPolicyMonth <= context.range.endPolicyMonth
      ))
    case 'partial-withdrawal':
      return normalized.events.partialWithdrawals.filter((event) => (
        event.startPolicyMonth >= context.range.startPolicyMonth
        && event.startPolicyMonth <= context.range.endPolicyMonth
      ))
    case 'top-up':
      return normalized.events.topUps.filter((event) => (
        event.startPolicyMonth >= context.range.startPolicyMonth
        && event.startPolicyMonth <= context.range.endPolicyMonth
      ))
  }
}

function normalizeEventChargeRules(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  repaymentEvents: IlpRepaymentEvent[],
): IlpNormalizedEventChargeRule[] {
  const isPostMip = isPostMipPolicyYear(normalized.input, context.policyYear)

  return (normalized.input.eventChargeRules ?? [])
    .filter((rule) => {
      const activeWindow = rule.activeWindow ?? 'policy-term'
      return activeWindow === 'policy-term'
        || (activeWindow === 'during-mip' && !isPostMip)
        || (activeWindow === 'after-mip' && isPostMip)
    })
    .map((rule) => {
      const events = getEventChargeEvents(normalized, context, rule, repaymentEvents)

      return {
        rule,
        events,
      }
    })
    .filter((normalizedRule) => normalizedRule.events.length > 0)
}

function hasAfterMipContributionRules(input: IlpPolicyInput): boolean {
  return input.accounts.some((account) => (
    account.contributionRules?.some((rule) => rule.phase === 'after-mip')
  ))
}

function getContributionPhaseMonths(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  ignorePayableMonthInterruptions = false,
): Record<'during-icp' | 'after-icp' | 'after-mip', number> {
  const icpMonths = Math.max(normalized.input.icpMonths ?? 0, 0)
  const { startPolicyMonth: yearStartMonth, endPolicyMonth: yearEndMonth } = context.range
  const payableMonths = ignorePayableMonthInterruptions
    ? (yearEndMonth - yearStartMonth + 1)
    : context.payableMonths

  if (context.isPostMip) {
    return {
      'during-icp': 0,
      'after-icp': 0,
      'after-mip': payableMonths,
    }
  }

  const duringIcpStart = Math.max(yearStartMonth, 1)
  const duringIcpEnd = Math.min(yearEndMonth, icpMonths)
  const duringIcpMonths = Math.max(0, duringIcpEnd - duringIcpStart + 1)
  const afterIcpMonths = Math.max(0, payableMonths - duringIcpMonths)

  return {
    'during-icp': duringIcpMonths,
    'after-icp': afterIcpMonths,
    'after-mip': 0,
  }
}

function resolveContributionByAccount(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  contributionForYear: number,
  ignorePayableMonthInterruptions = false,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  if (contributionForYear <= 0) {
    return contributionByAccount
  }

  const phaseMonths = getContributionPhaseMonths(normalized, context, ignorePayableMonthInterruptions)
  for (const phase of ['during-icp', 'after-icp', 'after-mip'] as const) {
    const phaseContribution = contributionForYear * (phaseMonths[phase] / 12)
    if (phaseContribution <= 0) continue

    for (const route of normalized.contributionRoutesByPhase[phase as IlpRecurringContributionPhase]) {
      contributionByAccount.set(
        route.accountId,
        (contributionByAccount.get(route.accountId) ?? 0) + (phaseContribution * route.share),
      )
    }
  }

  return contributionByAccount
}

function getRepaymentContributionByAccount(
  normalized: IlpNormalizedPolicyInput,
  repaymentEvents: IlpRepaymentEvent[],
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))

  for (const event of repaymentEvents) {
    if (event.amount <= 0) continue

    const targetAccountId = event.accountId
      ?? normalized.input.accounts.find((account) => account.id === 'aua')?.id
      ?? normalized.input.accounts[0]?.id

    if (!targetAccountId) continue

    contributionByAccount.set(
      targetAccountId,
      (contributionByAccount.get(targetAccountId) ?? 0) + event.amount,
    )
  }

  return contributionByAccount
}

function getTopUpContributionByAccount(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const routes = resolveSupplementaryContributionRoutes(normalized)

  for (const event of normalized.events.topUps) {
    if (event.amount == null || event.amount <= 0) continue
    if (event.startPolicyMonth < range.startPolicyMonth || event.startPolicyMonth > range.endPolicyMonth) continue

    if (event.accountId) {
      contributionByAccount.set(
        event.accountId,
        (contributionByAccount.get(event.accountId) ?? 0) + event.amount,
      )
      continue
    }

    for (const route of routes) {
      contributionByAccount.set(
        route.accountId,
        (contributionByAccount.get(route.accountId) ?? 0) + (event.amount * route.share),
      )
    }
  }

  return contributionByAccount
}

function getRecurringSinglePremiumContributionByAccount(
  normalized: IlpNormalizedPolicyInput,
  range: IlpProjectionYearRange,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const routes = resolveSupplementaryContributionRoutes(normalized)

  for (let policyMonth = range.startPolicyMonth; policyMonth <= range.endPolicyMonth; policyMonth += 1) {
    const activeEvents = normalized.events.recurringSinglePremiums.filter((event) => (
      event.amount != null
      && event.amount > 0
      && policyMonth >= event.startPolicyMonth
      && policyMonth < (event.startPolicyMonth + event.durationMonths)
      && isRecurringSinglePremiumEventActiveAtMonth(normalized, event, policyMonth)
    ))
    if (activeEvents.length === 0) continue

    const scheduledRecurringMonthly = activeEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0)
    const monthlyReduction = getAnnualPremiumReductionAtMonth(normalized, policyMonth) / 12
    const recurringReductionAbsorbed = Math.min(monthlyReduction, scheduledRecurringMonthly)

    for (const event of activeEvents) {
      const eventShare = (event.amount ?? 0) / scheduledRecurringMonthly
      const netMonthlyAmount = (event.amount ?? 0) - (recurringReductionAbsorbed * eventShare)
      if (netMonthlyAmount <= 0) continue

      if (event.accountId) {
        contributionByAccount.set(
          event.accountId,
          (contributionByAccount.get(event.accountId) ?? 0) + netMonthlyAmount,
        )
        continue
      }

      for (const route of routes) {
        contributionByAccount.set(
          route.accountId,
          (contributionByAccount.get(route.accountId) ?? 0) + (netMonthlyAmount * route.share),
        )
      }
    }
  }

  return contributionByAccount
}

function allocateChargeTotal(
  totalAmount: number,
  allocation: IlpChargeRule['allocation'] | IlpEventChargeRule['allocation'],
  appliesTo: IlpAccount[],
  openBalances: Map<string, number>,
): Map<string, number> {
  const allocations = new Map<string, number>()
  if (appliesTo.length === 0 || totalAmount === 0) {
    return allocations
  }

  if (allocation === 'equal-split') {
    const splitAmount = totalAmount / appliesTo.length
    for (const account of appliesTo) {
      allocations.set(account.id, splitAmount)
    }
    return allocations
  }

  if (allocation === 'pro-rata-by-contribution-share') {
    const totalContributionShare = appliesTo.reduce((sum, account) => sum + account.contributionShare, 0)
    if (totalContributionShare <= 0) {
      const splitAmount = totalAmount / appliesTo.length
      for (const account of appliesTo) {
        allocations.set(account.id, splitAmount)
      }
      return allocations
    }

    for (const account of appliesTo) {
      allocations.set(account.id, totalAmount * (account.contributionShare / totalContributionShare))
    }
    return allocations
  }

  const totalOpen = appliesTo.reduce((sum, account) => sum + (openBalances.get(account.id) ?? 0), 0)
  if (totalOpen <= 0) {
    const splitAmount = totalAmount / appliesTo.length
    for (const account of appliesTo) {
      allocations.set(account.id, splitAmount)
    }
    return allocations
  }

  for (const account of appliesTo) {
    const accountOpen = openBalances.get(account.id) ?? 0
    allocations.set(account.id, totalAmount * (accountOpen / totalOpen))
  }

  return allocations
}

function resolveEventChargeRate(
  rule: IlpEventChargeRule,
  context: IlpCashflowYearContext,
): number {
  const referenceYear = getRuleReferenceYear(context, rule.yearBasis)
  const matchedTier = rule.rateSchedule?.find((tier) => (
    referenceYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || referenceYear <= tier.endPolicyYear)
  ))

  return matchedTier?.rate ?? rule.rate
}

function resolveEventChargeFreeLifetimeMonths(
  rule: IlpEventChargeRule,
  policyYear: number,
): number | undefined {
  if (
    rule.freeLifetimeMonthsStartPolicyYear != null
    && policyYear < rule.freeLifetimeMonthsStartPolicyYear
  ) {
    return undefined
  }

  const matchedTier = rule.freeLifetimeMonthsSchedule?.find((tier) => (
    policyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || policyYear <= tier.endPolicyYear)
  ))

  return matchedTier?.months ?? rule.freeLifetimeMonths
}

function getPremiumHolidayMonthsUsedBefore(
  normalized: IlpNormalizedPolicyInput,
  rule: IlpEventChargeRule,
  policyMonth: number,
): number {
  if (policyMonth <= 1) {
    return 0
  }

  const firstCountedPolicyMonth = rule.freeLifetimeMonthsStartPolicyYear != null
    ? ((rule.freeLifetimeMonthsStartPolicyYear - 1) * 12) + 1
    : 1
  if (policyMonth <= firstCountedPolicyMonth) {
    return 0
  }

  const lastResetMonth = rule.freeLifetimeMonthsResetOnRepayment
    ? normalized.events.premiumHolidays
      .filter((event) => event.repayMissedPremiums === true)
      .reduce((latest, event) => {
        const repaymentMonth = event.startPolicyMonth + event.durationMonths
        return repaymentMonth < policyMonth ? Math.max(latest, repaymentMonth) : latest
      }, 0)
    : 0

  return normalized.events.premiumHolidays.reduce((sum, event) => (
    sum + overlapMonths(
      Math.max(lastResetMonth + 1, firstCountedPolicyMonth),
      policyMonth - 1,
      event.startPolicyMonth,
      event.startPolicyMonth + event.durationMonths - 1,
    )
  ), 0)
}

function resolveChargeAmount(
  rule: IlpChargeRule,
  context: IlpCashflowYearContext,
): number {
  const referenceYear = getRuleReferenceYear(context, rule.yearBasis)
  const matchedTier = rule.amountSchedule?.find((tier) => (
    referenceYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || referenceYear <= tier.endPolicyYear)
  ))

  return matchedTier?.amount ?? rule.amount
}

function resolveChargeRate(
  rule: IlpChargeRule,
  context: IlpCashflowYearContext,
): number {
  const referenceYear = getRuleReferenceYear(context, rule.yearBasis)
  const matchedTier = rule.rateSchedule?.find((tier) => (
    referenceYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || referenceYear <= tier.endPolicyYear)
  ))

  return matchedTier?.rate ?? rule.rate
}

function getRecurringChargeSuspensionMultiplier(
  rule: IlpChargeRule,
  context: IlpCashflowYearContext,
): number {
  let multiplier = 1

  for (const suspensionRule of rule.suspensionRules ?? []) {
    switch (suspensionRule.trigger) {
      case 'premium-holiday':
        if (suspensionRule.basis === 'prorate-by-overlap-months') {
          multiplier = Math.min(multiplier, Math.max(0, (12 - context.premiumHolidayMonths) / 12))
        }
        break
      default:
        assertNever(suspensionRule)
    }
  }

  return multiplier
}

function resolvePremiumBaseMultiplier(
  rule: IlpChargeRule,
  context: IlpCashflowYearContext,
): number {
  const referenceYear = getRuleReferenceYear(
    context,
    rule.premiumBaseConfig?.multiplierYearBasis ?? rule.yearBasis,
  )
  const matchedTier = rule.premiumBaseConfig?.multiplierSchedule.find((tier) => (
    referenceYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || referenceYear <= tier.endPolicyYear)
  ))

  if (!matchedTier) {
    return 0
  }

  return matchedTier.mode === 'policy-year'
    ? referenceYear
    : Math.max(0, matchedTier.multiplier ?? 0)
}

function resolveCumulativePaidRegularPremiumRate(
  normalized: IlpNormalizedPolicyInput,
  rule: IlpChargeRule,
  context: IlpCashflowYearContext,
  policyMonth: number,
): number {
  const annualisedPremiumAtIssue = rule.cumulativePaidPremiumConfig?.annualisedPremiumAtIssue
    ?? normalized.regularPremiums.committedAnnualPremiumAtIssue

  if (annualisedPremiumAtIssue > CONTRIBUTION_TOLERANCE) {
    const annualisedPremiumsPaid = Math.floor(
      getCumulativePaidRegularPremiumAtMonth(normalized, policyMonth) / annualisedPremiumAtIssue,
    )
    const matchedTier = rule.cumulativePaidPremiumConfig?.countRateSchedule?.find((tier) => (
      annualisedPremiumsPaid >= tier.minAnnualisedPremiumsPaid
      && (tier.maxAnnualisedPremiumsPaid == null || annualisedPremiumsPaid <= tier.maxAnnualisedPremiumsPaid)
    ))

    if (matchedTier) {
      return matchedTier.rate
    }
  }

  return resolveChargeRate(rule, context)
}

function computePremiumBaseMultiplierCharge(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  rule: IlpChargeRule,
): number {
  if (!rule.premiumBaseConfig) {
    return 0
  }

  const committedAnnualPremium = normalized.input.monthlyContribution * 12
  const multiplier = resolvePremiumBaseMultiplier(rule, context)
  const rate = resolveChargeRate(rule, context)

  if (multiplier <= 0 || rate <= 0) {
    return 0
  }

  let total = 0
  for (let policyMonth = context.range.startPolicyMonth; policyMonth <= context.range.endPolicyMonth; policyMonth += 1) {
    const prevailingAnnualPremium = getScheduledAnnualPremiumAtMonth(normalized, policyMonth)
    const premiumBase = rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing
      ? Math.max(committedAnnualPremium, prevailingAnnualPremium)
      : prevailingAnnualPremium

    total += (rate / 12) * premiumBase * multiplier
  }

  return total
}

function computePremiumBaseMultiplierCappedAccountValueCharge(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  rule: IlpChargeRule,
  appliesTo: IlpAccount[],
  openBalances: Map<string, number>,
): number {
  if (!rule.premiumBaseConfig) {
    return 0
  }

  const multiplier = resolvePremiumBaseMultiplier(rule, context)
  const accountValueRate = resolveChargeRate(rule, context)
  const capRate = rule.premiumBaseConfig.capRate ?? 0

  if (multiplier <= 0 || accountValueRate <= 0 || capRate <= 0) {
    return 0
  }

  const committedAnnualPremium = normalized.input.monthlyContribution * 12
  const prevailingAnnualPremium = getScheduledAnnualPremiumAtMonth(normalized, context.range.startPolicyMonth)
  const premiumBase = rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing
    ? Math.max(committedAnnualPremium, prevailingAnnualPremium)
    : prevailingAnnualPremium
  const accountValueCharge = appliesTo.reduce(
    (sum, account) => sum + ((openBalances.get(account.id) ?? 0) * accountValueRate),
    0,
  )
  const cappedPremiumBaseCharge = premiumBase * multiplier * capRate

  return Math.min(accountValueCharge, cappedPremiumBaseCharge)
}

function computeCumulativePaidRegularPremiumCharge(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  rule: IlpChargeRule,
): number {
  let total = 0

  for (let policyMonth = context.range.startPolicyMonth; policyMonth <= context.range.endPolicyMonth; policyMonth += 1) {
    const cumulativePaidRegularPremium = getCumulativePaidRegularPremiumAtMonth(normalized, policyMonth)
    const rate = resolveCumulativePaidRegularPremiumRate(normalized, rule, context, policyMonth)
    total += (rate / 12) * cumulativePaidRegularPremium
  }

  return total
}

function applyChargeAllocationsWithFallbackDetailed(
  totalCharge: number,
  allocation: IlpChargeRule['allocation'] | IlpEventChargeRule['allocation'],
  appliesTo: IlpAccount[],
  fallbackAppliesTo: IlpAccount[],
  openBalances: Map<string, number>,
  capPrimaryAllocationsAtOpenBalances = false,
): {
  allocations: Map<string, number>
  remainingCharge: number
} {
  if (fallbackAppliesTo.length === 0 && !capPrimaryAllocationsAtOpenBalances) {
    const allocations = allocateChargeTotal(totalCharge, allocation, appliesTo, openBalances)
    const allocatedAmount = Array.from(allocations.values()).reduce((sum, value) => sum + value, 0)
    return {
      allocations,
      remainingCharge: Math.max(0, totalCharge - allocatedAmount),
    }
  }

  const allocations = new Map<string, number>()
  const applyCappedAllocations = (remainingCharge: number, candidateAccounts: IlpAccount[]): number => {
    let pending = remainingCharge
    let eligibleAccounts = candidateAccounts.filter((account) => (
      Math.max((openBalances.get(account.id) ?? 0) - (allocations.get(account.id) ?? 0), 0) > CONTRIBUTION_TOLERANCE
    ))

    while (pending > CONTRIBUTION_TOLERANCE && eligibleAccounts.length > 0) {
      const capacityByAccountId = new Map(
        eligibleAccounts.map((account) => [
          account.id,
          Math.max((openBalances.get(account.id) ?? 0) - (allocations.get(account.id) ?? 0), 0),
        ]),
      )
      const proposedAllocations = allocateChargeTotal(pending, allocation, eligibleAccounts, capacityByAccountId)
      let appliedThisPass = 0

      for (const account of eligibleAccounts) {
        const remainingCapacity = capacityByAccountId.get(account.id) ?? 0
        const proposedAmount = proposedAllocations.get(account.id) ?? 0
        const appliedAmount = Math.min(proposedAmount, remainingCapacity)

        if (appliedAmount <= 0) continue

        allocations.set(account.id, (allocations.get(account.id) ?? 0) + appliedAmount)
        pending -= appliedAmount
        appliedThisPass += appliedAmount
      }

      if (appliedThisPass <= CONTRIBUTION_TOLERANCE) {
        break
      }

      eligibleAccounts = eligibleAccounts.filter((account) => (
        Math.max((openBalances.get(account.id) ?? 0) - (allocations.get(account.id) ?? 0), 0) > CONTRIBUTION_TOLERANCE
      ))
    }

    return pending
  }

  const overflowCharge = applyCappedAllocations(totalCharge, appliesTo)
  if (overflowCharge > CONTRIBUTION_TOLERANCE) {
    applyCappedAllocations(overflowCharge, fallbackAppliesTo)
  }

  const allocatedAmount = Array.from(allocations.values()).reduce((sum, value) => sum + value, 0)
  return {
    allocations,
    remainingCharge: Math.max(0, totalCharge - allocatedAmount),
  }
}

function applyChargeAllocationsWithFallback(
  totalCharge: number,
  allocation: IlpChargeRule['allocation'] | IlpEventChargeRule['allocation'],
  appliesTo: IlpAccount[],
  fallbackAppliesTo: IlpAccount[],
  openBalances: Map<string, number>,
): Map<string, number> {
  return applyChargeAllocationsWithFallbackDetailed(
    totalCharge,
    allocation,
    appliesTo,
    fallbackAppliesTo,
    openBalances,
  ).allocations
}

function computePremiumHolidayChargeForEvent(
  normalized: IlpNormalizedPolicyInput,
  event: IlpPolicyEvent,
  rule: IlpEventChargeRule,
  context: IlpCashflowYearContext,
  monthRange?: { start: number, end: number },
  useCommittedPremium = false,
): number {
  const eventStart = event.startPolicyMonth
  const eventEnd = event.startPolicyMonth + event.durationMonths - 1
  const start = monthRange ? Math.max(eventStart, monthRange.start) : eventStart
  const end = monthRange ? Math.min(eventEnd, monthRange.end) : eventEnd

  let total = 0
  for (let policyMonth = start; policyMonth <= end; policyMonth += 1) {
    const lifetimeHolidayMonthIndex = getPremiumHolidayMonthsUsedBefore(normalized, rule, policyMonth) + 1
    const freeLifetimeMonths = resolveEventChargeFreeLifetimeMonths(rule, getPolicyYearForMonth(policyMonth))
    if (freeLifetimeMonths != null && lifetimeHolidayMonthIndex <= freeLifetimeMonths) {
      continue
    }

    const policyYear = getPolicyYearForMonth(policyMonth)
    const monthlyContext: IlpCashflowYearContext = {
      ...context,
      policyYear,
      paymentHistory: {
        ...context.paymentHistory,
        premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth - 1),
        premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
        premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
      },
    }
    const monthlyPremium = useCommittedPremium
      ? normalized.input.monthlyContribution
      : getScheduledMonthlyPremiumAtMonth(normalized, policyMonth)
    total += monthlyPremium * resolveEventChargeRate(rule, monthlyContext)
  }

  return total
}

function computeFixedAmountHolidayChargeForEvent(
  normalized: IlpNormalizedPolicyInput,
  event: IlpPolicyEvent,
  rule: IlpEventChargeRule,
  context: IlpCashflowYearContext,
  monthRange?: { start: number, end: number },
): number {
  const eventStart = event.startPolicyMonth
  const eventEnd = event.startPolicyMonth + event.durationMonths - 1
  const start = monthRange ? Math.max(eventStart, monthRange.start) : eventStart
  const end = monthRange ? Math.min(eventEnd, monthRange.end) : eventEnd

  let total = 0
  for (let policyMonth = start; policyMonth <= end; policyMonth += 1) {
    const lifetimeHolidayMonthIndex = getPremiumHolidayMonthsUsedBefore(normalized, rule, policyMonth) + 1
    const freeLifetimeMonths = resolveEventChargeFreeLifetimeMonths(rule, getPolicyYearForMonth(policyMonth))
    if (freeLifetimeMonths != null && lifetimeHolidayMonthIndex <= freeLifetimeMonths) {
      continue
    }

    const monthlyContext: IlpCashflowYearContext = {
      ...context,
      policyYear: getPolicyYearForMonth(policyMonth),
      paymentHistory: {
        ...context.paymentHistory,
        premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth - 1),
        premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
        premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
      },
    }
    total += (rule.amount ?? 0) * resolveEventChargeRate(rule, monthlyContext)
  }

  return total
}

function getManualWaiverGrantKey(event: Pick<IlpPolicyEvent, 'id' | 'chargeWaiverGrantId'>): string {
  return event.chargeWaiverGrantId?.trim() || event.id
}

function getManualWaiverGroupRules(
  eventChargeRules: IlpEventChargeRule[],
  rule: IlpEventChargeRule,
): IlpEventChargeRule[] {
  if (!rule.manualWaiverGrantGroup) {
    return []
  }

  return eventChargeRules.filter((candidate) => (
    candidate.manualWaiverGrantGroup === rule.manualWaiverGrantGroup
    && (
      candidate.trigger === 'partial-withdrawal'
      || candidate.trigger === 'premium-holiday'
      || candidate.trigger === 'regular-premium-reduction'
    )
  ))
}

function getPriorManualWaiverGrantKeys(
  normalized: IlpNormalizedPolicyInput,
  eventChargeRules: IlpEventChargeRule[],
  rule: IlpEventChargeRule,
  event: IlpPolicyEvent,
): Set<string> {
  const groupRules = getManualWaiverGroupRules(eventChargeRules, rule)
  if (groupRules.length === 0) {
    return new Set()
  }

  const allowedTriggers = new Set(groupRules.map((candidate) => candidate.trigger))
  const priorEvents = [
    ...normalized.events.partialWithdrawals,
    ...normalized.events.premiumHolidays,
    ...normalized.events.regularPremiumReductions,
  ].filter((candidate) => (
    candidate.chargeWaived === true
    && candidate.startPolicyMonth < event.startPolicyMonth
    && allowedTriggers.has(candidate.type)
  ))

  return new Set(priorEvents.map((candidate) => getManualWaiverGrantKey(candidate)))
}

function isManualWaiverHonored(
  normalized: IlpNormalizedPolicyInput,
  eventChargeRules: IlpEventChargeRule[],
  rule: IlpEventChargeRule,
  event: IlpPolicyEvent,
): boolean {
  if (event.chargeWaived !== true) {
    return false
  }

  if (rule.manualWaiverMaxGrantCount == null || !rule.manualWaiverGrantGroup) {
    return true
  }

  const priorGrantKeys = getPriorManualWaiverGrantKeys(normalized, eventChargeRules, rule, event)
  const currentGrantKey = getManualWaiverGrantKey(event)

  return priorGrantKeys.has(currentGrantKey) || priorGrantKeys.size < rule.manualWaiverMaxGrantCount
}

function resolveManualWaiverChargeMonthRange(
  normalized: IlpNormalizedPolicyInput,
  eventChargeRules: IlpEventChargeRule[],
  rule: IlpEventChargeRule,
  event: IlpPolicyEvent,
  monthRange: { start: number, end: number },
): { start: number, end: number } | null {
  if (
    event.chargeWaived !== true
    || rule.manualWaiverMaxOverlapMonths == null
    || !isManualWaiverHonored(normalized, eventChargeRules, rule, event)
  ) {
    return monthRange
  }

  const waivedEndPolicyMonth = event.startPolicyMonth + rule.manualWaiverMaxOverlapMonths - 1
  const chargeStartPolicyMonth = Math.max(monthRange.start, waivedEndPolicyMonth + 1)
  if (chargeStartPolicyMonth > monthRange.end) {
    return null
  }

  return {
    start: chargeStartPolicyMonth,
    end: monthRange.end,
  }
}

function computeFreePartialWithdrawalAmount(
  normalized: IlpNormalizedPolicyInput,
  eventChargeRules: IlpEventChargeRule[],
  rule: IlpEventChargeRule,
  event: IlpPolicyEvent,
  openBalances: Map<string, number>,
  openingBalancesByPolicyYear: Map<number, Map<string, number>>,
  freeAmountPoolUsedByRule: Map<string, number>,
): number {
  if (rule.trigger !== 'partial-withdrawal' || rule.basis !== 'event-amount') {
    return 0
  }

  if (event.amount == null || event.amount <= 0) {
    return 0
  }

  const eventPolicyYear = getPolicyYearForMonth(event.startPolicyMonth)
  if (rule.freeEventStartPolicyYear != null && eventPolicyYear < rule.freeEventStartPolicyYear) {
    return 0
  }

  if (rule.freeAmountPoolRate != null && rule.freeAmountPoolBasis != null && rule.freeAmountPoolReferencePolicyYear != null) {
    const poolBalances = rule.freeAmountPoolReferencePolicyYear === eventPolicyYear
      ? openBalances
      : openingBalancesByPolicyYear.get(rule.freeAmountPoolReferencePolicyYear)

    if (!poolBalances) {
      return 0
    }

    const totalPoolAmount = rule.freeAmountPoolBasis === 'initial-single-premium'
      ? Math.max(0, (normalized.input.initialSinglePremium ?? 0) * rule.freeAmountPoolRate)
      : normalized.multiAccount.withdrawalChargeScopeAccountIds
          .filter((accountId) => rule.appliesTo.includes(accountId))
          .reduce((sum, accountId) => sum + (poolBalances.get(accountId) ?? 0), 0) * rule.freeAmountPoolRate

    const usedPoolAmount = freeAmountPoolUsedByRule.get(rule.id) ?? 0
    const freeAmount = Math.max(0, Math.min(event.amount, totalPoolAmount - usedPoolAmount))
    if (freeAmount > 0) {
      freeAmountPoolUsedByRule.set(rule.id, usedPoolAmount + freeAmount)
    }
    return freeAmount
  }

  if ((rule.freeEventCount ?? 0) <= 0) {
    return 0
  }

  if (rule.manualWaiverMode === 'capped-free-event' && !isManualWaiverHonored(normalized, eventChargeRules, rule, event)) {
    return 0
  }

  const priorMatchingEvents = normalized.events.partialWithdrawals.filter((candidate) => (
    candidate.startPolicyMonth < event.startPolicyMonth
    && candidate.accountId != null
    && normalized.multiAccount.withdrawalChargeScopeAccountIds.includes(candidate.accountId)
    && rule.appliesTo.includes(candidate.accountId)
    && (rule.manualWaiverMode !== 'capped-free-event' || candidate.chargeWaived === true)
  ))

  if (priorMatchingEvents.length >= (rule.freeEventCount ?? 0)) {
    return 0
  }

  const maxFreeAmount = rule.freeEventMaxAmountRate != null
    ? (
        rule.freeEventMaxAmountBasis === 'initial-single-premium'
          ? Math.max(0, (normalized.input.initialSinglePremium ?? 0) * rule.freeEventMaxAmountRate)
          : rule.freeEventMaxAmountBasis === 'cumulative-paid-regular-premium'
            ? Math.max(0, (normalized.regularPremiums.cumulativePaidByPolicyMonth.get(event.startPolicyMonth) ?? 0) * rule.freeEventMaxAmountRate)
            : normalized.multiAccount.withdrawalChargeScopeAccountIds
                .filter((accountId) => rule.appliesTo.includes(accountId))
                .reduce((sum, accountId) => sum + (openBalances.get(accountId) ?? 0), 0) * rule.freeEventMaxAmountRate
      )
    : event.amount

  return Math.max(0, Math.min(event.amount, maxFreeAmount))
}

function computeAdditionalChargeByAccount(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  openBalances: Map<string, number>,
  contributionByAccount: Map<string, number>,
): Map<string, number> {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const chargeRules = normalizeRecurringChargeRules(normalized, context)

  for (const { rule, appliesTo, fallbackAppliesTo } of chargeRules) {
    if (rule.requiresPremiumsPaidUpToDate && !context.paymentHistory.premiumsPaidUpToDate) {
      continue
    }

    const suspensionMultiplier = getRecurringChargeSuspensionMultiplier(rule, context)
    if (suspensionMultiplier <= CONTRIBUTION_TOLERANCE) {
      continue
    }

    switch (rule.basis) {
      case 'account-value':
        for (const account of appliesTo) {
          const open = openBalances.get(account.id) ?? 0
          charges.set(account.id, (charges.get(account.id) ?? 0) + (open * resolveChargeRate(rule, context) * suspensionMultiplier))
        }
        break

      case 'annual-contribution':
        for (const account of appliesTo) {
          const routedContribution = contributionByAccount.get(account.id) ?? 0
          charges.set(account.id, (charges.get(account.id) ?? 0) + (routedContribution * resolveChargeRate(rule, context) * suspensionMultiplier))
        }
        break

      case 'fixed-annual': {
        const allocations = applyChargeAllocationsWithFallback(
          resolveChargeAmount(rule, context) * suspensionMultiplier,
          rule.allocation,
          appliesTo,
          fallbackAppliesTo,
          openBalances,
        )
        for (const [accountId, amount] of allocations.entries()) {
          charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
        }
        break
      }

      case 'assurance-sum-at-risk':
        break

      case 'premium-base-mip-multiplier': {
        const totalCharge = computePremiumBaseMultiplierCharge(normalized, context, rule) * suspensionMultiplier
        const allocations = applyChargeAllocationsWithFallback(
          totalCharge,
          rule.allocation,
          appliesTo,
          fallbackAppliesTo,
          openBalances,
        )
        for (const [accountId, amount] of allocations.entries()) {
          charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
        }
        break
      }

      case 'premium-base-mip-multiplier-capped-account-value': {
        const totalCharge = computePremiumBaseMultiplierCappedAccountValueCharge(
          normalized,
          context,
          rule,
          appliesTo,
          openBalances,
        ) * suspensionMultiplier
        const allocations = applyChargeAllocationsWithFallback(
          totalCharge,
          rule.allocation,
          appliesTo,
          fallbackAppliesTo,
          openBalances,
        )
        for (const [accountId, amount] of allocations.entries()) {
          charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
        }
        break
      }

      case 'cumulative-paid-regular-premium': {
        const totalCharge = computeCumulativePaidRegularPremiumCharge(normalized, context, rule) * suspensionMultiplier
        const allocations = applyChargeAllocationsWithFallback(
          totalCharge,
          rule.allocation,
          appliesTo,
          fallbackAppliesTo,
          openBalances,
        )
        for (const [accountId, amount] of allocations.entries()) {
          charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
        }
        break
      }

      case 'initial-single-premium-base': {
        const totalCharge = getOriginalInitialSinglePremiumBase(input) * resolveChargeRate(rule, context) * suspensionMultiplier
        const allocations = applyChargeAllocationsWithFallback(
          totalCharge,
          rule.allocation,
          appliesTo,
          fallbackAppliesTo,
          openBalances,
        )
        for (const [accountId, amount] of allocations.entries()) {
          charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
        }
        break
      }
    }
  }

  return charges
}

function computeEventChargeByAccount(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  repaymentEvents: IlpRepaymentEvent[],
  openBalances: Map<string, number>,
  openingBalancesByPolicyYear: Map<number, Map<string, number>>,
  freeAmountPoolUsedByRule: Map<string, number>,
): Map<string, number> {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const eventChargeRules = input.eventChargeRules ?? []
  const applications: Array<{
    rule: IlpEventChargeRule
    totalCharge: number
    allocations: Map<string, number>
  }> = []
  const smartRetireWaivedMonthsThisYear = getSmartRetireWopWaivedMonthsForRange(normalized.input, context.range)
  const smartRetireChargeStartPolicyMonth = context.range.startPolicyMonth + smartRetireWaivedMonthsThisYear

  const computeEventChargeAmount = (
    rule: IlpEventChargeRule,
    event: IlpPolicyEvent | IlpRepaymentEvent,
    smartRetireChargeMonthRange: { start: number, end: number },
  ): number => {
    const effectiveRuleRate = resolveEventChargeRate(rule, {
      ...context,
      policyYear: getPolicyYearForMonth(event.startPolicyMonth),
      paymentHistory: {
        ...context.paymentHistory,
        premiumYearAtStart: getPremiumYearAtMonth(normalized, event.startPolicyMonth - 1),
        premiumYearAtEnd: getPremiumYearAtMonth(normalized, event.startPolicyMonth),
        premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, event.startPolicyMonth),
      },
    })
    const appliesTo = resolveWithdrawalChargeAccounts(normalized, rule, event)
    if (appliesTo.length === 0) {
      return 0
    }

    switch (rule.basis) {
      case 'event-amount':
        return Math.max(
          0,
          ((event.amount ?? 0) - computeFreePartialWithdrawalAmount(
            normalized,
            eventChargeRules,
            rule,
            event as IlpPolicyEvent,
            openBalances,
            openingBalancesByPolicyYear,
            freeAmountPoolUsedByRule,
          )),
        ) * effectiveRuleRate + rule.amount

      case 'account-value':
        return appliesTo.reduce((sum, account) => sum + ((openBalances.get(account.id) ?? 0) * effectiveRuleRate), 0) + rule.amount

      case 'premium-reduction-with-startup-recovery': {
        const monthsPassedSinceInception = Math.max(event.startPolicyMonth - 1, 0)
        const committedMipMonths = Math.max(1, (hasFiniteMip(input) ? input.mipLength : computeTotalProjectionYears(input)) * 12)
        const remainingFactor = Math.max(0, 1 - (monthsPassedSinceInception / committedMipMonths))
        return ((event.amount ?? 0) * effectiveRuleRate * remainingFactor) + rule.amount
      }

      case 'premium-reduction-tiered-startup-recovery':
        return computeTieredStartupRecoveryCharge(normalized, rule, event)

      case 'repaid-premium-with-missed-months':
        return ((event.amount ?? 0) * effectiveRuleRate * event.durationMonths / 12) + rule.amount

      case 'annual-premium-with-overlap-months':
        {
          const chargeMonthRange = resolveManualWaiverChargeMonthRange(
            normalized,
            eventChargeRules,
            rule,
            event as IlpPolicyEvent,
            {
              start: smartRetireChargeMonthRange.start,
              end: smartRetireChargeMonthRange.end,
            },
          )
          if (!chargeMonthRange) {
            return 0
          }

          return computePremiumHolidayChargeForEvent(normalized, event as IlpPolicyEvent, rule, context, chargeMonthRange) + rule.amount
        }

      case 'committed-annual-premium-with-overlap-months':
        {
          const chargeMonthRange = resolveManualWaiverChargeMonthRange(
            normalized,
            eventChargeRules,
            rule,
            event as IlpPolicyEvent,
            {
              start: smartRetireChargeMonthRange.start,
              end: smartRetireChargeMonthRange.end,
            },
          )
          if (!chargeMonthRange) {
            return 0
          }

          return computePremiumHolidayChargeForEvent(normalized, event as IlpPolicyEvent, rule, context, chargeMonthRange, true) + rule.amount
        }

      case 'premium-holiday-charge-refund': {
        const sourceEventId = 'sourceEventId' in event ? event.sourceEventId : undefined
        const sourceEvent = normalized.events.premiumHolidays.find((candidate) => candidate.id === sourceEventId)
        const sourceChargeRule = eventChargeRules.find((candidate) => candidate.id === rule.sourceChargeRuleId)

        if (
          !sourceEvent
          || !sourceChargeRule
          || sourceChargeRule.id === rule.id
          || sourceChargeRule.basis === 'premium-holiday-charge-refund'
          || sourceChargeRule.basis === 'source-event-charge-refund'
        ) {
          return 0
        }

        const sourceCharge = computeEventChargeAmount(sourceChargeRule, sourceEvent, smartRetireChargeMonthRange)
        return -(sourceCharge * effectiveRuleRate) + rule.amount
      }

      case 'source-event-charge-refund': {
        if (!('chargeRefunded' in event) || event.chargeRefunded !== true) {
          return 0
        }

        const sourceChargeRule = eventChargeRules.find((candidate) => candidate.id === rule.sourceChargeRuleId)
        if (
          !sourceChargeRule
          || sourceChargeRule.id === rule.id
          || sourceChargeRule.basis === 'premium-holiday-charge-refund'
          || sourceChargeRule.basis === 'source-event-charge-refund'
        ) {
          return 0
        }

        const sourceCharge = computeEventChargeAmount(sourceChargeRule, event, smartRetireChargeMonthRange)
        return -(sourceCharge * effectiveRuleRate) + rule.amount
      }

      case 'event-amount-with-overlap-months': {
        const monthsInYear = getRecurringSinglePremiumActiveMonthsForEvent(
          normalized,
          event as IlpPolicyEvent,
          context.range.startPolicyMonth,
          context.range.endPolicyMonth,
        )
        return ((event.amount ?? 0) * monthsInYear * effectiveRuleRate) + rule.amount
      }

      case 'annual-reduction-with-active-months': {
        const chargeMonthRange = resolveManualWaiverChargeMonthRange(
          normalized,
          eventChargeRules,
          rule,
          event as IlpPolicyEvent,
          {
            start: smartRetireChargeMonthRange.start,
            end: smartRetireChargeMonthRange.end,
          },
        )
        if (!chargeMonthRange) {
          return 0
        }

        let totalCharge = 0
        for (let policyMonth = chargeMonthRange.start; policyMonth <= chargeMonthRange.end; policyMonth += 1) {
          const monthShortfall = ((input.monthlyContribution * 12) - getScheduledAnnualPremiumAtMonth(normalized, policyMonth)) / 12
          totalCharge += monthShortfall * resolveEventChargeRate(rule, {
            ...context,
            policyYear: getPolicyYearForMonth(policyMonth),
            paymentHistory: {
              ...context.paymentHistory,
              premiumYearAtStart: getPremiumYearAtMonth(normalized, policyMonth - 1),
              premiumYearAtEnd: getPremiumYearAtMonth(normalized, policyMonth),
              premiumsPaidUpToDate: arePremiumsPaidUpToDateAtMonth(normalized, policyMonth),
            },
          })
        }
        return totalCharge + rule.amount
      }

      case 'fixed-amount-with-overlap-months':
        {
          const chargeMonthRange = resolveManualWaiverChargeMonthRange(
            normalized,
            eventChargeRules,
            rule,
            event as IlpPolicyEvent,
            {
              start: smartRetireChargeMonthRange.start,
              end: smartRetireChargeMonthRange.end,
            },
          )
          if (!chargeMonthRange) {
            return 0
          }

          return computeFixedAmountHolidayChargeForEvent(
            normalized,
            event as IlpPolicyEvent,
            rule,
            context,
            chargeMonthRange,
          )
        }
    }
  }

  for (const { rule, events } of normalizeEventChargeRules(normalized, context, repaymentEvents)) {
    const ruleAllocations = new Map<string, number>()
    let ruleTotalCharge = 0

    for (const event of events) {
      if (event.type !== 'premium-holiday-repayment' && event.chargeWaived === true && (
        event.type === 'partial-withdrawal'
        || event.type === 'premium-holiday'
        || event.type === 'regular-premium-reduction'
      )) {
        const manualWaiverHonored = isManualWaiverHonored(normalized, eventChargeRules, rule, event)
        const usesCappedManualWaiver = event.type === 'partial-withdrawal'
          && rule.manualWaiverMode === 'capped-free-event'
          && manualWaiverHonored
        const usesBoundedManualWaiver = (
          (event.type === 'premium-holiday' || event.type === 'regular-premium-reduction')
          && rule.manualWaiverMaxOverlapMonths != null
          && manualWaiverHonored
        )
        if (manualWaiverHonored && !usesCappedManualWaiver && !usesBoundedManualWaiver) {
          continue
        }
      }

      const smartRetireChargeMonthRange = (
        smartRetireWaivedMonthsThisYear > 0
        && (event.type === 'premium-holiday' || event.type === 'regular-premium-reduction')
      )
        ? {
            start: smartRetireChargeStartPolicyMonth,
            end: context.range.endPolicyMonth,
          }
        : {
            start: context.range.startPolicyMonth,
            end: context.range.endPolicyMonth,
          }

      if (smartRetireChargeMonthRange.start > smartRetireChargeMonthRange.end) {
        continue
      }

      const totalCharge = computeEventChargeAmount(rule, event, smartRetireChargeMonthRange)
      const appliesTo = resolveWithdrawalChargeAccounts(normalized, rule, event)
      if (appliesTo.length === 0) continue

      const fallbackAccounts = resolveFallbackAccounts(normalized, rule.fallbackAppliesTo)
      const allocations = applyChargeAllocationsWithFallback(totalCharge, rule.allocation, appliesTo, fallbackAccounts, openBalances)

      for (const [accountId, amount] of allocations.entries()) {
        ruleAllocations.set(accountId, (ruleAllocations.get(accountId) ?? 0) + amount)
      }
      ruleTotalCharge += totalCharge
    }

    applications.push({
      rule,
      totalCharge: ruleTotalCharge,
      allocations: ruleAllocations,
    })
  }

  const groupedApplications = new Map<string, Array<(typeof applications)[number]>>()

  for (const application of applications) {
    const groupKey = application.rule.exclusiveGroup && application.rule.groupResolution === 'max-total-charge'
      ? application.rule.exclusiveGroup
      : null

    if (!groupKey) {
      for (const [accountId, amount] of application.allocations.entries()) {
        charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
      }
      continue
    }

    const existing = groupedApplications.get(groupKey) ?? []
    existing.push(application)
    groupedApplications.set(groupKey, existing)
  }

  for (const groupApplications of groupedApplications.values()) {
    const selectedApplication = groupApplications.reduce((best, current) => (
      current.totalCharge > best.totalCharge ? current : best
    ))

    for (const [accountId, amount] of selectedApplication.allocations.entries()) {
      charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
    }
  }

  return charges
}

export function computeTotalProjectionYears(input: IlpPolicyInput): number {
  return getMipBasis(input) === 'open-ended'
    ? input.postMipYears
    : getRemainingMipYears(input) + input.postMipYears
}

export function getMipEndProjectionIndex(input: IlpPolicyInput): number {
  if (hasFiniteMip(input)) {
    const remainingMipYears = getRemainingMipYears(input)
    if (remainingMipYears <= 0) {
      throw new Error(`Cannot resolve MIP end row for policy "${input.name}" because it is already mature.`)
    }
    return remainingMipYears - 1
  }

  const totalProjectionYears = computeTotalProjectionYears(input)
  if (totalProjectionYears <= 0) {
    throw new Error(`Cannot resolve projection end row for policy "${input.name}" because it has no remaining projection horizon.`)
  }
  return totalProjectionYears - 1
}

export function computeBlendedReturn(
  funds: IlpFund[],
  scenario: ReturnScenario,
): number {
  return funds.reduce((sum, fund) => (
    sum + fund.allocation * (getScenarioGrossReturn(fund, scenario) - fund.ocf)
  ), 0)
}

export function projectIlpPolicy(
  input: IlpPolicyInput,
  scenario: ReturnScenario,
): IlpProjectionResult {
  assertBeforeMip(input)
  assertAccruedAssuranceEntryPoint(input)
  assertFreeAmountPoolEntryPoint(input)
  assertScheduledPayoutConfiguration(input)
  assertDistributionConfiguration(input)
  const normalized = buildNormalizedPolicyInput(input)
  const initialSinglePremiumState = computeInitialSinglePremiumState(normalized)

  const blendedNetReturn = computeBlendedReturn(input.funds, scenario)
  const annualContribution = input.monthlyContribution * 12
  const totalYears = computeTotalProjectionYears(input)
  const previousClose = new Map(input.accounts.map((account) => [
    account.id,
    getEffectiveCurrentValue(account, initialSinglePremiumState),
  ]))
  const rows: IlpYearRow[] = []

  let cumulativeGrossFees = initialSinglePremiumState.totalCharge
  let cumulativeBonuses = 0
  let cumulativePremiums = (input.monthlyContribution * input.monthsAlreadyPaid) + initialSinglePremiumState.totalGrossContribution
  let cumulativeRegularPremiumsPaid = input.monthlyContribution * input.monthsAlreadyPaid
  let assuranceRegularPremiumBase = input.assuranceProfile?.currentNetRegularPremiumBase ?? 0
  let assuranceRepaymentBase = input.assuranceProfile?.currentNetRepaymentBase ?? 0
  let assuranceSupplementaryPremiumBase = input.assuranceProfile?.currentNetSupplementaryPremiumBase ?? 0
  let assuranceProtectedPremiumBase = input.assuranceProfile?.currentNetProtectedPremiumBase ?? 0
  let assuranceSumAssured = input.assuranceProfile?.currentSumAssured ?? input.assuranceProfile?.currentBasicSumAssured
  let assuranceWealthAssureValue = input.assuranceProfile?.currentWealthAssureValue
  let assuranceGrowthFrozen = false
  let assuranceAccruedChargeBalanceByRule = new Map<string, number>(
    normalized.assurance.rules.map(({ rule }) => [rule.id, 0]),
  )
  let disabledAssuranceRuleIds = new Set<string>(
    getSmartRetireWopClaimAdmissionStatus(input) === 'admitted'
      || getSmartRetireWopClaimAdmissionStatus(input) === 'admitted-and-settled'
      ? ['cost-of-insurance-wop-on-tpd']
      : [],
  )
  let tokioProtectionStateByRule = buildInitialTokioProtectionStateByRule(normalized, previousClose)
  const openingBalancesByPolicyYear = new Map<number, Map<string, number>>()
  const freeAmountPoolUsedByRule = new Map<string, number>()
  const assuranceRelevantAccountIds = getAssuranceRelevantAccountIds(normalized)
  const isSmartRetireCoiRefundProduct = isSmartRetireProduct(input)
  const smartRetireRefundTargetAge = isSmartRetireCoiRefundProduct ? input.assuranceProfile?.targetRetirementAge : undefined
  const smartRetireHasRefundInputs = isSmartRetireCoiRefundProduct
    && input.assuranceProfile?.currentAgeNextBirthday != null
    && smartRetireRefundTargetAge != null
    && input.claimProfile?.currentRefundEligibleDeathCoiCollected != null
    && hasSmartRetireRefundGateInput(input)
  const smartRetireCanProjectCoiRefund = smartRetireHasRefundInputs
    && input.assuranceProfile.currentAgeNextBirthday < smartRetireRefundTargetAge
  const smartRetireCanModelPastDueCoiRefund = smartRetireHasRefundInputs
    && input.assuranceProfile.currentAgeNextBirthday >= smartRetireRefundTargetAge
    && input.claimProfile?.currentDeathCoiRefundStatus != null
  const smartRetireRefundAccountId = (smartRetireCanProjectCoiRefund || smartRetireCanModelPastDueCoiRefund)
    ? normalized.assurance.rules.find(({ rule }) => rule.id === 'cost-of-insurance-death')?.rule.appliesTo[0] ?? 'policy'
    : undefined
  const smartRetireRefundDisqualifiedByClaim = isSmartRetireRefundGateBroken(input)
  let smartRetireRefundEligibleDeathCoiCollected = (smartRetireCanProjectCoiRefund || smartRetireCanModelPastDueCoiRefund)
    ? Math.max(0, input.claimProfile?.currentRefundEligibleDeathCoiCollected ?? 0)
    : 0
  let smartRetirePendingImmediateCoiRefund = (
    smartRetireCanModelPastDueCoiRefund
    && input.claimProfile?.currentDeathCoiRefundStatus === 'due-and-uncredited'
    && !smartRetireRefundDisqualifiedByClaim
  )
    ? smartRetireRefundEligibleDeathCoiCollected
    : 0
  const investStarterCanModelPastDuePolicyChargeRefund = isInvestStarterProduct(input)
    && input.monthsAlreadyPaid >= 36
    && input.claimProfile?.currentInvestStarterPolicyChargeRefundStatus != null
  const investStarterPolicyChargeRefundAccountId = investStarterCanModelPastDuePolicyChargeRefund
    ? input.chargeRules.find((rule) => rule.id === 'policy-charge')?.appliesTo[0] ?? 'portfolio'
    : undefined
  let investStarterPendingImmediatePolicyChargeRefund = (
    investStarterCanModelPastDuePolicyChargeRefund
    && input.claimProfile?.currentInvestStarterPolicyChargeRefundStatus === 'due-and-uncredited'
    && input.claimProfile?.currentInvestStarterPolicyChargeRefundAverageAccountValue != null
  )
    ? Math.max(0, input.claimProfile.currentInvestStarterPolicyChargeRefundAverageAccountValue) * 0.008
    : 0
  let investPlusSpPendingImmediatePowerUpBonusCreditByAccount = new Map<string, number>(
    resolveCurrentInvestPlusSpPastDuePowerUpBonusCredits(input).map((credit) => [credit.accountId, credit.amount]),
  )
  const investPlusSpProjectedInitialPowerUpBonusCreditByYear = buildInvestPlusSpProjectedInitialPowerUpBonusCreditByYear(
    input,
    normalized,
    initialSinglePremiumState,
    blendedNetReturn,
    totalYears,
  )
  const investPlusSpProjectedTopUpPowerUpBonusCreditByYear = buildInvestPlusSpProjectedTopUpPowerUpBonusCreditByYear(
    input,
    normalized,
    blendedNetReturn,
    totalYears,
  )
  let isPolicyLapsed = false
  let excludedBonusCohortsByBonusId = buildInitialExcludedBonusCohortsByBonusId(normalized)
  let preservedBonusCohortsByBonusId = buildInitialPreservedBonusCohortsByBonusId(normalized)
  let bonusAdjustmentFactorByBonusId = buildInitialBonusAdjustmentFactorByBonusId(normalized)
  const cumulativeBonusCreditsByBonusId = buildInitialCumulativeBonusCreditsByBonusId(normalized)
  let cumulativeAccountValueAddbacksForBonusQualification = 0
  let cumulativeReinvestedDividendWithdrawalsForBonusQualification = 0
  let cumulativeAssuranceChargesForBonusQualification = 0

  for (let year = 1; year <= totalYears; year += 1) {
    const policyYear = input.currentPolicyYear + year
    const isPostMip = isPostMipPolicyYear(input, policyYear)
    const context = buildCashflowYearContext(normalized, year)
    const hasExplicitLapseForYear = isLapseActiveForEntireRange(normalized, context.range)
    const policyState: IlpYearRow['policyState'] = (isPolicyLapsed || hasExplicitLapseForYear) ? 'lapsed' : 'in-force'
    const smartRetireWopWaivedMonthsThisYear = getSmartRetireWopWaivedMonthsForRange(input, context.range)
    const smartRetireWopActiveThisYear = smartRetireWopWaivedMonthsThisYear > 0
    const scheduledContributionForYear = ((isPostMip && !hasAfterMipContributionRules(input))
      ? 0
      : Math.max(0, annualContribution - getRegularPremiumReductionForYear(normalized, context.range)))
    const smartRetireWopContributionSplit = smartRetireWopActiveThisYear
      ? getSmartRetireRegularPremiumContributionSplit(normalized, context)
      : { ownerPaid: 0, waived: 0 }
    const ownerPaidRegularContributionForYear = smartRetireWopContributionSplit.ownerPaid
    const waivedRegularContributionForYear = smartRetireWopContributionSplit.waived
    const eecReferenceYear = getEecReferenceYear(input, context)
    const eecRate = getExitChargeBasis(input) === 'initial-single-premium-base'
      ? lookupEecRate(eecReferenceYear, input.eecTable)
      : (isPostMip ? 0 : lookupEecRate(eecReferenceYear, input.eecTable))
    const openBalances = new Map(
      input.accounts.map((account) => [account.id, previousClose.get(account.id) ?? getEffectiveCurrentValue(account, initialSinglePremiumState)]),
    )
    openingBalancesByPolicyYear.set(policyYear, new Map(openBalances))

    if (policyState === 'lapsed') {
      const combinedValue = Array.from(openBalances.values()).reduce((sum, value) => sum + value, 0)
      const scheduledPayoutState = resolveScheduledPayoutStateForYear(normalized, context) === 'inactive'
        ? 'inactive'
        : 'lapsed'
      const eecReferenceYear = getEecReferenceYear(input, context)
      const eecRate = getExitChargeBasis(input) === 'initial-single-premium-base'
        ? lookupEecRate(eecReferenceYear, input.eecTable)
        : (isPostMip ? 0 : lookupEecRate(eecReferenceYear, input.eecTable))
      const eecCharge = computeExitChargeAmount(input, eecRate, openBalances)

      rows.push({
        year,
        policyYear,
        policyState,
        scheduledPayoutState,
        annualContribution: 0,
        annualWithdrawals: 0,
        accounts: input.accounts.map((account) => ({
          accountId: account.id,
          open: openBalances.get(account.id) ?? account.currentValue,
          contributionAmount: 0,
          grossFee: 0,
          bonusCredit: 0,
          netFee: 0,
          withdrawalAmount: 0,
          close: openBalances.get(account.id) ?? account.currentValue,
        })),
        combinedValue,
        eecRate,
        eecCharge,
        surrenderValue: combinedValue - eecCharge,
        cumulativePremiums,
        cumulativeGrossFees,
        cumulativeBonuses,
      })
      continue
    }

    const scheduledRegularContributionByAccount = resolveContributionByAccount(
      normalized,
      context,
      smartRetireWopActiveThisYear ? ownerPaidRegularContributionForYear : scheduledContributionForYear,
      smartRetireWopActiveThisYear,
    )
    const waivedRegularContributionByAccount = waivedRegularContributionForYear > CONTRIBUTION_TOLERANCE
      ? resolveContributionByAccount(normalized, context, waivedRegularContributionForYear, true)
      : new Map<string, number>()
    // Annual-contribution charges stay on scheduled regular premiums only.
    // Premium-holiday repayments still count as paid regular premium for assurance bases,
    // but they are modeled separately from annual-contribution charge routing.
    const regularContributionByAccount = new Map(scheduledRegularContributionByAccount)
    const contributionByAccount = new Map(scheduledRegularContributionByAccount)
    for (const [accountId, amount] of waivedRegularContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const premiumHolidayRepaymentEvents = getPremiumHolidayRepayments(normalized, context.range)
    const policyRepaymentEvents = getPolicyRepayments(normalized, context.range)
    const repaymentEvents = [
      ...premiumHolidayRepaymentEvents,
      ...policyRepaymentEvents,
    ]
    const repaymentContributionByAccount = getRepaymentContributionByAccount(normalized, repaymentEvents)
    const scheduledRegularPremiumPaidThisYear = Array.from(scheduledRegularContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    const waivedRegularPremiumCreditedThisYear = Array.from(waivedRegularContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    const regularPremiumPaidThisYear = scheduledRegularPremiumPaidThisYear
      + Array.from(getRepaymentContributionByAccount(normalized, premiumHolidayRepaymentEvents).values()).reduce((sum, value) => sum + value, 0)
    for (const [accountId, amount] of repaymentContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const topUpContributionByAccount = getTopUpContributionByAccount(normalized, context.range)
    for (const [accountId, amount] of topUpContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const recurringSinglePremiumContributionByAccount = getRecurringSinglePremiumContributionByAccount(normalized, context.range)
    for (const [accountId, amount] of recurringSinglePremiumContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const supplementaryPremiumPaidThisYear = Array.from(topUpContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
      + Array.from(recurringSinglePremiumContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    const contributionForYear = Array.from(scheduledRegularContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
      + Array.from(repaymentContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
      + supplementaryPremiumPaidThisYear
    cumulativePremiums += contributionForYear
    cumulativeRegularPremiumsPaid += regularPremiumPaidThisYear
    const requestedPartialWithdrawalByAccount = getPartialWithdrawalsByAccount(normalized, context.range)
    const reinvestedDividendWithdrawalByAccount = getReinvestedDividendWithdrawalsByAccount(normalized, context.range)
    const reinvestedDividendWithdrawalsThisYear = Array.from(reinvestedDividendWithdrawalByAccount.values()).reduce((sum, value) => sum + value, 0)
    const distributionPayoutByAccount = getDistributionPayoutsByAccount(normalized, year, openBalances)
    const distributionPayoutsThisYear = Array.from(distributionPayoutByAccount.values()).reduce((sum, value) => sum + value, 0)
    const additionalChargeByAccount = computeAdditionalChargeByAccount(
      normalized,
      context,
      openBalances,
      regularContributionByAccount,
    )
    const eventChargeByAccount = computeEventChargeByAccount(
      normalized,
      context,
      repaymentEvents,
      openBalances,
      openingBalancesByPolicyYear,
      freeAmountPoolUsedByRule,
    )
    const bonusCreditByAccount = new Map<string, number>()
    const baseWithdrawalByAccount = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
    const availableBeforeBaseWithdrawalsByAccount = new Map<string, number>()
    const preBonusAvailableBeforeBaseWithdrawalsByAccount = new Map<string, number>()
    const effectiveChargesByAccount = new Map<string, number>()
    const activeExcludedBonusValueByBonusId = new Map<string, Map<string, number>>(
      normalized.bonuses.rules
        .filter(({ bonus }) => (bonus.excludedValueRules?.length ?? 0) > 0)
        .map(({ bonus, targetAccountIds }) => [
          bonus.id,
          new Map(targetAccountIds.map((accountId) => {
            const activeCohorts = (excludedBonusCohortsByBonusId.get(bonus.id)?.get(accountId) ?? [])
              .filter((cohort) => cohort.expiryPolicyMonth == null || cohort.expiryPolicyMonth > context.range.startPolicyMonth)
            return [
              accountId,
              activeCohorts.reduce((sum, cohort) => sum + cohort.balance, 0),
            ]
          })),
        ]),
    )
    const activePreservedBonusValueByBonusId = new Map<string, Map<string, number>>(
      normalized.bonuses.rules
        .filter(({ bonus }) => (bonus.preservedValueRules?.length ?? 0) > 0)
        .map(({ bonus, targetAccountIds }) => [
          bonus.id,
          new Map(targetAccountIds.map((accountId) => {
            const activeCohorts = preservedBonusCohortsByBonusId.get(bonus.id)?.get(accountId) ?? []
            return [
              accountId,
              activeCohorts.reduce((sum, cohort) => sum + cohort.balance, 0),
            ]
          })),
        ]),
    )

    for (const account of input.accounts) {
      const open = openBalances.get(account.id) ?? account.currentValue
      const activeFeeRate = isPostMip && account.postMipFeeRate != null
        ? account.postMipFeeRate
        : account.feeRate
      const baseGrossFee = open * activeFeeRate
      const extraCharges = (additionalChargeByAccount.get(account.id) ?? 0) + (eventChargeByAccount.get(account.id) ?? 0)
      const accountContribution = contributionByAccount.get(account.id) ?? 0
      effectiveChargesByAccount.set(account.id, baseGrossFee + extraCharges)
      preBonusAvailableBeforeBaseWithdrawalsByAccount.set(
        account.id,
        Math.max(0, (open - (baseGrossFee + extraCharges)) * (1 + blendedNetReturn) + accountContribution),
      )
    }

    const partialWithdrawalByAccount = getEligiblePartialWithdrawalsByAccount(
      normalized,
      context,
      preBonusAvailableBeforeBaseWithdrawalsByAccount,
    )
    const partialWithdrawalsThisYear = Array.from(partialWithdrawalByAccount.values()).reduce((sum, value) => sum + value, 0)

    const scheduledPayoutState = resolveScheduledPayoutStateForYear(normalized, context)
    const preBonusScheduledPayoutByAccount = getScheduledPayoutsByAccount(
      normalized,
      context,
      scheduledPayoutState,
      preBonusAvailableBeforeBaseWithdrawalsByAccount,
      partialWithdrawalByAccount,
    )
    const currentYearEndValueBeforeBonus = input.accounts.reduce((sum, account) => (
      sum
      + Math.max(
        0,
        (preBonusAvailableBeforeBaseWithdrawalsByAccount.get(account.id) ?? 0)
        - (partialWithdrawalByAccount.get(account.id) ?? requestedPartialWithdrawalByAccount.get(account.id) ?? 0)
        - (preBonusScheduledPayoutByAccount.get(account.id) ?? 0)
        - (reinvestedDividendWithdrawalByAccount.get(account.id) ?? 0)
        - (distributionPayoutByAccount.get(account.id) ?? 0),
      )
    ), 0)
    const bonusEligibilityMetrics: IlpBonusEligibilityMetrics = {
      policyYearGrowthMeasure: {
        currentYearEndValueBeforeBonus,
        effectiveChargesThisYear: Array.from(effectiveChargesByAccount.values()).reduce((sum, value) => sum + value, 0),
        priorYearEndValueAfterPriorBonus: input.accounts.reduce(
          (sum, account) => sum + (openBalances.get(account.id) ?? account.currentValue),
          0,
        ),
        regularPremiumReceivedThisYear: scheduledRegularPremiumPaidThisYear,
      },
      cumulativeEffectiveAccountValueRatio: {
        effectiveAccountValueAtReferencePoint: currentYearEndValueBeforeBonus
          + cumulativeAccountValueAddbacksForBonusQualification
          + partialWithdrawalsThisYear
          + distributionPayoutsThisYear
          + cumulativeAssuranceChargesForBonusQualification,
        cumulativePremiumsPaid: cumulativePremiums,
        cumulativeReinvestedDividendWithdrawals: cumulativeReinvestedDividendWithdrawalsForBonusQualification + reinvestedDividendWithdrawalsThisYear,
      },
    }

    for (const account of input.accounts) {
      bonusCreditByAccount.set(
        account.id,
        computeBonusCredit(
          normalized,
          context,
          repaymentEvents,
          bonusEligibilityMetrics,
          activeExcludedBonusValueByBonusId,
          activePreservedBonusValueByBonusId,
          account.id,
          openBalances.get(account.id) ?? account.currentValue,
          scheduledRegularContributionByAccount.get(account.id) ?? 0,
          scheduledRegularPremiumPaidThisYear,
          regularPremiumPaidThisYear,
          partialWithdrawalByAccount,
          preBonusAvailableBeforeBaseWithdrawalsByAccount,
          bonusAdjustmentFactorByBonusId,
          cumulativeBonusCreditsByBonusId,
          cumulativeRegularPremiumsPaid,
          input.currency,
        ),
      )
    }

    for (const normalizedBonus of normalized.bonuses.rules) {
      if (normalizedBonus.bonus.oneTimePayoutBasis !== 'step-up-booster-delta') {
        continue
      }

      const bonusCreditForRule = normalizedBonus.targetAccountIds.reduce((sum, accountId) => (
        sum + computeBonusCreditForRule(
          normalized,
          normalizedBonus,
          context,
          repaymentEvents,
          bonusEligibilityMetrics,
          activeExcludedBonusValueByBonusId,
          activePreservedBonusValueByBonusId,
          accountId,
          openBalances.get(accountId) ?? 0,
          scheduledRegularContributionByAccount.get(accountId) ?? 0,
          scheduledRegularPremiumPaidThisYear,
          regularPremiumPaidThisYear,
          partialWithdrawalByAccount,
          preBonusAvailableBeforeBaseWithdrawalsByAccount,
          bonusAdjustmentFactorByBonusId,
          cumulativeBonusCreditsByBonusId,
          cumulativeRegularPremiumsPaid,
          input.currency,
        )
      ), 0)

      if (bonusCreditForRule > CONTRIBUTION_TOLERANCE) {
        cumulativeBonusCreditsByBonusId.set(
          normalizedBonus.bonus.id,
          (cumulativeBonusCreditsByBonusId.get(normalizedBonus.bonus.id) ?? 0) + bonusCreditForRule,
        )
      }
    }
    const provisionalCloseByAccount = new Map<string, number>()

    for (const account of input.accounts) {
      const open = openBalances.get(account.id) ?? account.currentValue
      const activeFeeRate = isPostMip && account.postMipFeeRate != null
        ? account.postMipFeeRate
        : account.feeRate
      const baseGrossFee = open * activeFeeRate
      const extraCharges = (additionalChargeByAccount.get(account.id) ?? 0) + (eventChargeByAccount.get(account.id) ?? 0)
      const accountContribution = contributionByAccount.get(account.id) ?? 0
      const bonusCredit = bonusCreditByAccount.get(account.id) ?? 0
      const availableBeforeBaseWithdrawals = Math.max(
        0,
        (open - (baseGrossFee + extraCharges - bonusCredit)) * (1 + blendedNetReturn) + accountContribution,
      )
      availableBeforeBaseWithdrawalsByAccount.set(account.id, availableBeforeBaseWithdrawals)
    }

    const scheduledPayoutByAccount = getScheduledPayoutsByAccount(
      normalized,
      context,
      scheduledPayoutState,
      availableBeforeBaseWithdrawalsByAccount,
      partialWithdrawalByAccount,
    )

    for (const account of input.accounts) {
      const availableBeforeBaseWithdrawals = availableBeforeBaseWithdrawalsByAccount.get(account.id) ?? 0
      const partialWithdrawalAmount = partialWithdrawalByAccount.get(account.id) ?? 0
      const scheduledPayoutAmount = scheduledPayoutByAccount.get(account.id) ?? 0
      const baseWithdrawalAmount = partialWithdrawalAmount + scheduledPayoutAmount
      const reinvestedDividendWithdrawalAmount = reinvestedDividendWithdrawalByAccount.get(account.id) ?? 0
      const distributionPayoutAmount = distributionPayoutByAccount.get(account.id) ?? 0
      const withdrawalAmount = baseWithdrawalAmount + reinvestedDividendWithdrawalAmount + distributionPayoutAmount
      const closeBeforeAssurance = availableBeforeBaseWithdrawals - withdrawalAmount

      baseWithdrawalByAccount.set(account.id, baseWithdrawalAmount)
      provisionalCloseByAccount.set(account.id, Math.max(0, closeBeforeAssurance))
    }

    const withdrawalByAccount = mergeAccountAmountMaps(
      mergeAccountAmountMaps(baseWithdrawalByAccount, reinvestedDividendWithdrawalByAccount),
      distributionPayoutByAccount,
    )
    const annualWithdrawals = Array.from(withdrawalByAccount.values()).reduce((sum, value) => sum + value, 0)

    const assuranceChargeResult = computeAssuranceChargeByAccount(
      normalized,
      policyYear,
      year,
      context,
      openBalances,
      provisionalCloseByAccount,
      assuranceRegularPremiumBase,
      regularPremiumPaidThisYear + waivedRegularPremiumCreditedThisYear,
      assuranceRepaymentBase,
      assuranceSupplementaryPremiumBase,
      supplementaryPremiumPaidThisYear,
      assuranceProtectedPremiumBase,
      baseWithdrawalByAccount,
      assuranceSumAssured,
      assuranceWealthAssureValue,
      assuranceGrowthFrozen,
      tokioProtectionStateByRule,
      assuranceAccruedChargeBalanceByRule,
      disabledAssuranceRuleIds,
    )
    const assuranceChargeByAccount = assuranceChargeResult.charges
    const smartRetireDeathCoiChargedThisYear = assuranceChargeResult.chargesByRule.get('cost-of-insurance-death') ?? 0
    assuranceSumAssured = assuranceChargeResult.nextSumAssured
    assuranceWealthAssureValue = assuranceChargeResult.nextWealthAssureValue
    assuranceGrowthFrozen = assuranceChargeResult.nextGrowthFrozen
    tokioProtectionStateByRule = assuranceChargeResult.nextTokioProtectionStateByRule
    assuranceAccruedChargeBalanceByRule = assuranceChargeResult.nextAccruedChargeBalanceByRule
    disabledAssuranceRuleIds = assuranceChargeResult.nextDisabledAssuranceRuleIds
    const smartRetireCoverageAgeNextBirthday = input.assuranceProfile?.currentAgeNextBirthday != null
      ? input.assuranceProfile.currentAgeNextBirthday + year - 1
      : undefined

    if (
      smartRetireCanProjectCoiRefund
      && !smartRetireRefundDisqualifiedByClaim
      && smartRetireCoverageAgeNextBirthday != null
      && smartRetireRefundTargetAge != null
      && smartRetireCoverageAgeNextBirthday < smartRetireRefundTargetAge
    ) {
      smartRetireRefundEligibleDeathCoiCollected += smartRetireDeathCoiChargedThisYear
    }

    const smartRetireCoiRefundCredit = (
      smartRetireCanProjectCoiRefund
      && !smartRetireRefundDisqualifiedByClaim
      && smartRetireRefundAccountId != null
      && smartRetireCoverageAgeNextBirthday != null
      && smartRetireRefundTargetAge != null
      && smartRetireCoverageAgeNextBirthday === smartRetireRefundTargetAge
    )
      ? smartRetireRefundEligibleDeathCoiCollected
      : 0

    if (
      year === 1
      && investPlusSpPendingImmediatePowerUpBonusCreditByAccount.size > 0
    ) {
      for (const [accountId, amount] of investPlusSpPendingImmediatePowerUpBonusCreditByAccount.entries()) {
        bonusCreditByAccount.set(
          accountId,
          (bonusCreditByAccount.get(accountId) ?? 0) + amount,
        )
      }
      investPlusSpPendingImmediatePowerUpBonusCreditByAccount = new Map()
    }

    const investPlusSpProjectedInitialPowerUpBonusCredit = investPlusSpProjectedInitialPowerUpBonusCreditByYear.get(year) ?? 0
    if (investPlusSpProjectedInitialPowerUpBonusCredit > CONTRIBUTION_TOLERANCE) {
      bonusCreditByAccount.set(
        'policy',
        (bonusCreditByAccount.get('policy') ?? 0) + investPlusSpProjectedInitialPowerUpBonusCredit,
      )
    }
    const investPlusSpProjectedTopUpPowerUpBonusCredit = investPlusSpProjectedTopUpPowerUpBonusCreditByYear.get(year) ?? 0
    if (investPlusSpProjectedTopUpPowerUpBonusCredit > CONTRIBUTION_TOLERANCE) {
      bonusCreditByAccount.set(
        'topup',
        (bonusCreditByAccount.get('topup') ?? 0) + investPlusSpProjectedTopUpPowerUpBonusCredit,
      )
    }

    if (
      year === 1
      && investStarterPendingImmediatePolicyChargeRefund > CONTRIBUTION_TOLERANCE
      && investStarterPolicyChargeRefundAccountId != null
    ) {
      bonusCreditByAccount.set(
        investStarterPolicyChargeRefundAccountId,
        (bonusCreditByAccount.get(investStarterPolicyChargeRefundAccountId) ?? 0) + investStarterPendingImmediatePolicyChargeRefund,
      )
      investStarterPendingImmediatePolicyChargeRefund = 0
    }

    if (
      year === 1
      && smartRetirePendingImmediateCoiRefund > CONTRIBUTION_TOLERANCE
      && smartRetireRefundAccountId != null
    ) {
      bonusCreditByAccount.set(
        smartRetireRefundAccountId,
        (bonusCreditByAccount.get(smartRetireRefundAccountId) ?? 0) + smartRetirePendingImmediateCoiRefund,
      )
      smartRetireRefundEligibleDeathCoiCollected = 0
      smartRetirePendingImmediateCoiRefund = 0
    }

    if (smartRetireCoiRefundCredit > CONTRIBUTION_TOLERANCE && smartRetireRefundAccountId != null) {
      bonusCreditByAccount.set(
        smartRetireRefundAccountId,
        (bonusCreditByAccount.get(smartRetireRefundAccountId) ?? 0) + smartRetireCoiRefundCredit,
      )
      smartRetireRefundEligibleDeathCoiCollected = 0
    }

    const monthlyRateProjectionByAccount = new Map<string, { bonusCredit: number, close: number }>()
    for (const account of input.accounts) {
      const monthlyRateProjection = computeMonthlyRateBonusProjectionForAccount(
        normalized,
        context,
        account.id,
        openBalances.get(account.id) ?? account.currentValue,
        assuranceChargeByAccount.get(account.id) ?? 0,
        blendedNetReturn,
        input.currency,
      )
      if (!monthlyRateProjection) {
        continue
      }

      monthlyRateProjectionByAccount.set(account.id, monthlyRateProjection)
      bonusCreditByAccount.set(
        account.id,
        (bonusCreditByAccount.get(account.id) ?? 0) + monthlyRateProjection.bonusCredit,
      )
    }

    const accountRows: IlpAccountYearRow[] = []
    let combinedValue = 0
    let eecCharge = 0

    for (const account of input.accounts) {
      const open = openBalances.get(account.id) ?? account.currentValue
      const activeFeeRate = isPostMip && account.postMipFeeRate != null
        ? account.postMipFeeRate
        : account.feeRate
      const baseGrossFee = open * activeFeeRate
      const extraCharges = (additionalChargeByAccount.get(account.id) ?? 0)
        + (eventChargeByAccount.get(account.id) ?? 0)
        + (assuranceChargeByAccount.get(account.id) ?? 0)
      const grossFee = baseGrossFee + extraCharges
      const accountContribution = contributionByAccount.get(account.id) ?? 0
      const bonusCredit = bonusCreditByAccount.get(account.id) ?? 0
      const netFee = grossFee - bonusCredit
      const withdrawalAmount = withdrawalByAccount.get(account.id) ?? 0
      const close = monthlyRateProjectionByAccount.get(account.id)?.close
        ?? Math.max(0, (open - netFee) * (1 + blendedNetReturn) + accountContribution - withdrawalAmount)

      cumulativeGrossFees += grossFee
      cumulativeBonuses += bonusCredit
      combinedValue += close

      previousClose.set(account.id, close)
      accountRows.push({
        accountId: account.id,
        open,
        contributionAmount: accountContribution,
        grossFee,
        bonusCredit,
        netFee,
        withdrawalAmount,
        close,
      })
    }

    const nextExcludedBonusCohortsByBonusId = new Map<string, Map<string, IlpExcludedValueCohort[]>>()
    const nextPreservedBonusCohortsByBonusId = new Map<string, Map<string, IlpPreservedValueCohort[]>>()
    for (const normalizedBonus of normalized.bonuses.rules) {
      if ((normalizedBonus.bonus.excludedValueRules?.length ?? 0) === 0) {
        if ((normalizedBonus.bonus.preservedValueRules?.length ?? 0) === 0) {
          continue
        }
      }

      const excludedContributions = buildExcludedValueContributions(
        normalized,
        normalizedBonus,
        context.range,
        repaymentEvents,
      )
      const preservedContributions = buildPreservedValueContributions(
        normalizedBonus,
        context.range,
        normalized.events.partialWithdrawals,
      )
      const nextByAccount = new Map<string, IlpExcludedValueCohort[]>()
      const nextPreservedByAccount = new Map<string, IlpPreservedValueCohort[]>()
      for (const accountId of normalizedBonus.targetAccountIds) {
        const account = input.accounts.find((candidate) => candidate.id === accountId)
        if (!account) {
          continue
        }

        const open = openBalances.get(accountId) ?? account.currentValue
        const activeFeeRate = isPostMip && account.postMipFeeRate != null
          ? account.postMipFeeRate
          : account.feeRate
        const baseGrossFee = open * activeFeeRate
        // Event charges on current-year supplementary premiums are already reflected
        // in the new contribution amount when netAmountFactor is provided.
        const sharableGrossFee = baseGrossFee
          + (additionalChargeByAccount.get(accountId) ?? 0)
          + (assuranceChargeByAccount.get(accountId) ?? 0)
        const activeCohorts = (excludedBonusCohortsByBonusId.get(normalizedBonus.bonus.id)?.get(accountId) ?? [])
          .filter((cohort) => cohort.expiryPolicyMonth == null || cohort.expiryPolicyMonth > context.range.startPolicyMonth)
        const newContributions = excludedContributions.filter((contribution) => contribution.accountId === accountId)
        const newPreservedContributions = preservedContributions.filter((contribution) => contribution.accountId === accountId)
        const availableBeforeBaseWithdrawals = availableBeforeBaseWithdrawalsByAccount.get(accountId) ?? 0
        const withdrawalAmount = withdrawalByAccount.get(accountId) ?? 0
        if ((normalizedBonus.bonus.excludedValueRules?.length ?? 0) > 0) {
          nextByAccount.set(
            accountId,
            computeNextExcludedBonusCohortsForAccount(
              open,
              sharableGrossFee,
              blendedNetReturn,
              activeCohorts,
              newContributions,
              availableBeforeBaseWithdrawals,
              withdrawalAmount,
            ),
          )
        }
        if ((normalizedBonus.bonus.preservedValueRules?.length ?? 0) > 0) {
          const activePreservedCohorts = preservedBonusCohortsByBonusId.get(normalizedBonus.bonus.id)?.get(accountId) ?? []
          nextPreservedByAccount.set(
            accountId,
            computeNextPreservedBonusCohortsForAccount(
              open,
              sharableGrossFee,
              blendedNetReturn,
              activePreservedCohorts,
              newPreservedContributions,
              availableBeforeBaseWithdrawals,
              withdrawalAmount,
            ),
          )
        }
      }

      if ((normalizedBonus.bonus.excludedValueRules?.length ?? 0) > 0) {
        nextExcludedBonusCohortsByBonusId.set(normalizedBonus.bonus.id, nextByAccount)
      }
      if ((normalizedBonus.bonus.preservedValueRules?.length ?? 0) > 0) {
        nextPreservedBonusCohortsByBonusId.set(normalizedBonus.bonus.id, nextPreservedByAccount)
      }
    }
    excludedBonusCohortsByBonusId = nextExcludedBonusCohortsByBonusId
    preservedBonusCohortsByBonusId = nextPreservedBonusCohortsByBonusId
    bonusAdjustmentFactorByBonusId = computeNextBonusAdjustmentFactorsByBonusId(
      normalized,
      context,
      bonusAdjustmentFactorByBonusId,
      partialWithdrawalByAccount,
      preBonusAvailableBeforeBaseWithdrawalsByAccount,
    )
    cumulativeAccountValueAddbacksForBonusQualification += partialWithdrawalsThisYear + distributionPayoutsThisYear
    cumulativeReinvestedDividendWithdrawalsForBonusQualification += reinvestedDividendWithdrawalsThisYear
    cumulativeAssuranceChargesForBonusQualification += Array.from(assuranceChargeByAccount.values()).reduce((sum, value) => sum + value, 0)

    eecCharge = computeExitChargeAmount(input, eecRate, previousClose)

    rows.push({
      year,
      policyYear,
      policyState,
      scheduledPayoutState,
      annualContribution: contributionForYear,
      annualWithdrawals,
      accounts: accountRows,
      combinedValue,
      eecRate,
      eecCharge,
      surrenderValue: combinedValue - eecCharge,
      cumulativePremiums,
      cumulativeGrossFees: cumulativeGrossFees,
      cumulativeBonuses: cumulativeBonuses,
    })

    if (
      input.policyStateSupport?.automaticLapseOnAccountValueDepletion
      && combinedValue <= CONTRIBUTION_TOLERANCE
    ) {
      isPolicyLapsed = true
    }

    const assuranceWithdrawalsThisYear = sumWithdrawalsForAccounts(baseWithdrawalByAccount, assuranceRelevantAccountIds)
    assuranceRegularPremiumBase = Math.max(
      0,
      assuranceRegularPremiumBase + regularPremiumPaidThisYear + waivedRegularPremiumCreditedThisYear - assuranceWithdrawalsThisYear,
    )
    assuranceRepaymentBase = Math.max(
      0,
      assuranceRepaymentBase - assuranceWithdrawalsThisYear,
    )
    assuranceSupplementaryPremiumBase = Math.max(
      0,
      assuranceSupplementaryPremiumBase + supplementaryPremiumPaidThisYear - (
        normalized.multiAccount.supplementaryPremiumAccountIds.length > 0
          ? sumWithdrawalsForAccounts(baseWithdrawalByAccount, normalized.multiAccount.supplementaryPremiumAccountIds)
          : sumWithdrawalsForAccounts(baseWithdrawalByAccount, assuranceRelevantAccountIds)
      ),
    )
    assuranceProtectedPremiumBase = Math.max(
      0,
      assuranceProtectedPremiumBase + regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - assuranceWithdrawalsThisYear,
    )
  }

  return {
    scenario,
    blendedNetReturn,
    rows,
  }
}

export function computeNpvAnalysis(
  input: IlpPolicyInput,
  projection: IlpProjectionResult,
  initialSinglePremiumState?: IlpInitialSinglePremiumState,
): IlpNpvAnalysis {
  assertBeforeMip(input)
  const currentValueSnapshot = computeCurrentValueSnapshot(input, initialSinglePremiumState)

  const optimizationYears = hasFiniteMip(input)
    ? getRemainingMipYears(input)
    : computeTotalProjectionYears(input)
  if (optimizationYears <= 0) {
    throw new Error(
      `Cannot compute NPV analysis: policy "${input.name}" has no remaining projection horizon.`,
    )
  }

  const surrenderNow = {
    eecRate: currentValueSnapshot.eecRateNow,
    eecCharge: currentValueSnapshot.cancelNowPenalty,
    npvFees: currentValueSnapshot.cancelNowPenalty,
    netSurrenderValue: currentValueSnapshot.totalCurrentValue - currentValueSnapshot.cancelNowPenalty,
  }

  let cumulativeNpvGrossFees = 0
  let cumulativeNpvBonuses = 0
  const futureExitOptions: IlpNpvExitOption[] = []

  for (const row of projection.rows) {
    const discountFactor = Math.pow(1 + input.discountRate, row.year)
    const previousRow = projection.rows[row.year - 2]
    const grossFeesThisYear = row.cumulativeGrossFees - (previousRow?.cumulativeGrossFees ?? 0)
    const bonusesThisYear = row.cumulativeBonuses - (previousRow?.cumulativeBonuses ?? 0)

    cumulativeNpvGrossFees += grossFeesThisYear / discountFactor
    cumulativeNpvBonuses += bonusesThisYear / discountFactor

    const pvEec = row.eecCharge / discountFactor
    futureExitOptions.push({
      exitYear: row.year,
      policyYear: row.policyYear,
      eecRate: row.eecRate,
      eecCharge: row.eecCharge,
      pvEec,
      npvGrossFees: cumulativeNpvGrossFees,
      npvBonuses: cumulativeNpvBonuses,
      totalNpvFees: cumulativeNpvGrossFees - cumulativeNpvBonuses + pvEec,
      netSurrenderValue: row.surrenderValue,
      totalContributions: row.cumulativePremiums,
    })
  }

  const scanLimit = Math.min(optimizationYears, futureExitOptions.length)
  if (scanLimit <= 0) {
    throw new Error(`Cannot compute best exit year for policy "${input.name}" because it has no projected rows.`)
  }

  let bestIndex = 0
  for (let index = 1; index < scanLimit; index += 1) {
    if (futureExitOptions[index].totalNpvFees < futureExitOptions[bestIndex].totalNpvFees) {
      bestIndex = index
    }
  }

  const mipEndIndex = getMipEndProjectionIndex(input)
  const mipEndRow = projection.rows[mipEndIndex]
  const mipEndOption = futureExitOptions[mipEndIndex]

  return {
    surrenderNow,
    futureExitOptions,
    bestExitYear: futureExitOptions[bestIndex].exitYear,
    bestExitNpvFees: futureExitOptions[bestIndex].totalNpvFees,
    holdToMip: {
      npvGrossFees: mipEndOption.npvGrossFees,
      npvBonuses: mipEndOption.npvBonuses,
      totalNpvFees: mipEndOption.totalNpvFees,
      finalValue: mipEndRow.combinedValue,
      totalContributions: mipEndRow.cumulativePremiums,
    },
  }
}

export function computeOpportunityCost(
  input: IlpPolicyInput,
  projection: IlpProjectionResult,
  npv: IlpNpvAnalysis,
): IlpOpportunityCost {
  const horizonYears = hasFiniteMip(input)
    ? getRemainingMipYears(input)
    : computeTotalProjectionYears(input)
  const horizonRow = projection.rows[getMipEndProjectionIndex(input)]
  const ilpValueAtHorizon = horizonRow.combinedValue
  const growthRate = input.alternativeReturn

  let alternativePortfolioValue = npv.surrenderNow.netSurrenderValue * Math.pow(1 + growthRate, horizonYears)
  const mipEndIndex = getMipEndProjectionIndex(input)
  const contributionRows = projection.rows.slice(0, mipEndIndex + 1)

  for (const row of contributionRows) {
    alternativePortfolioValue += row.annualContribution * Math.pow(1 + growthRate, horizonYears - row.year)
  }

  const bestExit = npv.futureExitOptions.find((option) => option.exitYear === npv.bestExitYear)
  if (!bestExit) {
    throw new Error(`Best exit year ${npv.bestExitYear} could not be found for policy "${input.name}".`)
  }

  const yearsAfterBestExit = Math.max(horizonYears - bestExit.exitYear, 0)
  let alternativeAtBestExit = bestExit.netSurrenderValue * Math.pow(1 + growthRate, yearsAfterBestExit)
  for (const row of contributionRows.filter((candidate) => candidate.year > bestExit.exitYear)) {
    alternativeAtBestExit += row.annualContribution * Math.pow(1 + growthRate, horizonYears - row.year)
  }

  return {
    alternativePortfolioValue,
    ilpValueAtHorizon,
    difference: alternativePortfolioValue - ilpValueAtHorizon,
    atBestExit: {
      exitYear: bestExit.exitYear,
      alternativeValue: alternativeAtBestExit,
      ilpValueAtHorizon,
      difference: alternativeAtBestExit - ilpValueAtHorizon,
    },
  }
}

export function computeSummaryMetrics(
  input: IlpPolicyInput,
  projection: IlpProjectionResult,
  initialSinglePremiumState?: IlpInitialSinglePremiumState,
): IlpSummaryMetrics {
  const mipEndRow = projection.rows[getMipEndProjectionIndex(input)]
  const currentValueSnapshot = computeCurrentValueSnapshot(input, initialSinglePremiumState)
  const currentDeathBenefitEstimate = computeCurrentDeathBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentAccidentalDeathBenefitEstimate = computeCurrentAccidentalDeathBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentTiBenefitEstimate = computeCurrentTiBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentTiBenefitAfterTpdEstimate = computeCurrentTiBenefitAfterTpdEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentResidualDeathBenefitAfterTiEstimate = computeCurrentResidualDeathBenefitAfterTiEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentTpdBenefitEstimate = computeCurrentTpdBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentAccidentalTpdBenefitEstimate = computeCurrentAccidentalTpdBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentResidualDeathBenefitAfterTpdEstimate = computeCurrentResidualDeathBenefitAfterTpdEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentAccidentalDisabilityBenefitEstimate = computeCurrentAccidentalDisabilityBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )

  return applyCurrentAdmittedTpdClaimState(input, applyCurrentAdmittedTiClaimState(input, {
    totalPremiumsPaid: mipEndRow.cumulativePremiums,
    totalFeesCharged: mipEndRow.cumulativeGrossFees,
    totalBonusesReceived: mipEndRow.cumulativeBonuses,
    netFeeDrag: mipEndRow.cumulativeGrossFees - mipEndRow.cumulativeBonuses,
    currentSurrenderValue: currentValueSnapshot.totalCurrentValue - currentValueSnapshot.cancelNowPenalty,
    cancelNowPenalty: currentValueSnapshot.cancelNowPenalty,
    currentDeathBenefitEstimate,
    currentAccidentalDeathBenefitEstimate,
    currentTiBenefitEstimate,
    currentTiBenefitAfterTpdEstimate,
    currentResidualDeathBenefitAfterTiEstimate,
    currentTpdBenefitEstimate,
    currentAccidentalTpdBenefitEstimate,
    currentResidualDeathBenefitAfterTpdEstimate,
    currentAccidentalDisabilityBenefitEstimate,
  }, currentValueSnapshot.currentValueByAccount))
}

export function computeCurrentOnlySummaryMetrics(
  input: IlpPolicyInput,
  initialSinglePremiumState?: IlpInitialSinglePremiumState,
): IlpSummaryMetrics {
  const currentValueSnapshot = computeCurrentValueSnapshot(input, initialSinglePremiumState)
  const currentDeathBenefitEstimate = computeCurrentDeathBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentAccidentalDeathBenefitEstimate = computeCurrentAccidentalDeathBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentTiBenefitEstimate = computeCurrentTiBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentTiBenefitAfterTpdEstimate = computeCurrentTiBenefitAfterTpdEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentResidualDeathBenefitAfterTiEstimate = computeCurrentResidualDeathBenefitAfterTiEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentTpdBenefitEstimate = computeCurrentTpdBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentAccidentalTpdBenefitEstimate = computeCurrentAccidentalTpdBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentResidualDeathBenefitAfterTpdEstimate = computeCurrentResidualDeathBenefitAfterTpdEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )
  const currentAccidentalDisabilityBenefitEstimate = computeCurrentAccidentalDisabilityBenefitEstimate(
    input,
    currentValueSnapshot.currentValueByAccount,
    currentValueSnapshot.totalCurrentValue,
  )

  return applyCurrentAdmittedTpdClaimState(input, applyCurrentAdmittedTiClaimState(input, {
    totalPremiumsPaid: 0,
    totalFeesCharged: 0,
    totalBonusesReceived: 0,
    netFeeDrag: 0,
    currentSurrenderValue: currentValueSnapshot.totalCurrentValue - currentValueSnapshot.cancelNowPenalty,
    cancelNowPenalty: currentValueSnapshot.cancelNowPenalty,
    currentDeathBenefitEstimate,
    currentAccidentalDeathBenefitEstimate,
    currentTiBenefitEstimate,
    currentTiBenefitAfterTpdEstimate,
    currentResidualDeathBenefitAfterTiEstimate,
    currentTpdBenefitEstimate,
    currentAccidentalTpdBenefitEstimate,
    currentResidualDeathBenefitAfterTpdEstimate,
    currentAccidentalDisabilityBenefitEstimate,
  }, currentValueSnapshot.currentValueByAccount))
}

export function analyzeCurrentOnlyIlpPolicy(input: IlpPolicyInput): IlpCurrentOnlyPolicyAnalysis {
  const initialSinglePremiumState = computeInitialSinglePremiumState(buildNormalizedPolicyInput(input))
  const summary = computeCurrentOnlySummaryMetrics(input, initialSinglePremiumState)

  return {
    mode: 'current-only',
    reason: 'mature-finite-policy',
    policyId: input.id,
    policyName: input.name,
    insurer: input.insurer,
    currency: input.currency,
    summary,
  }
}

export function analyzeIlpPolicy(input: IlpPolicyInput): IlpProjectedPolicyAnalysis {
  const initialSinglePremiumState = computeInitialSinglePremiumState(buildNormalizedPolicyInput(input))
  const projections: Record<ReturnScenario, IlpProjectionResult> = {
    low: projectIlpPolicy(input, 'low'),
    mid: projectIlpPolicy(input, 'mid'),
    high: projectIlpPolicy(input, 'high'),
  }
  const npvAnalysis = computeNpvAnalysis(input, projections.mid, initialSinglePremiumState)
  const opportunityCost = computeOpportunityCost(input, projections.mid, npvAnalysis)
  const summary = computeSummaryMetrics(input, projections.mid, initialSinglePremiumState)

  return {
    mode: 'projected',
    policyId: input.id,
    policyName: input.name,
    insurer: input.insurer,
    currency: input.currency,
    projections,
    npvAnalysis,
    opportunityCost,
    summary,
  }
}

export function buildComparisonTable(
  analyses: IlpPolicyAnalysis[],
  policyCurrencies: Record<string, IlpPolicyInput['currency']>,
): IlpComparisonRow[] {
  if (analyses.length < 2) return []

  const sameCurrency = new Set(Object.values(policyCurrencies)).size === 1
  const currencyRule = (lowerIsBetter: boolean): boolean | null => (sameCurrency ? lowerIsBetter : null)
  const valuesFor = (picker: (analysis: IlpPolicyAnalysis) => number | string): Record<string, number | string> =>
    Object.fromEntries(analyses.map((analysis) => [analysis.policyId, picker(analysis)]))
  const projectedValue = (
    analysis: IlpPolicyAnalysis,
    picker: (projected: IlpProjectedPolicyAnalysis) => number | string,
  ): number | string => (analysis.mode === 'projected' ? picker(analysis) : '—')

  return [
    { metric: 'Insurer', unit: 'text', lowerIsBetter: null, values: valuesFor((analysis) => analysis.insurer || 'Unknown') },
    { metric: 'Projection Horizon', unit: 'years', lowerIsBetter: null, values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.projections.mid.rows.length)) },
    { metric: 'Total Premiums Paid (to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.summary.totalPremiumsPaid)) },
    { metric: 'Total Fees Charged (gross, to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.summary.totalFeesCharged)) },
    { metric: 'Bonuses Received (to horizon)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.summary.totalBonusesReceived)) },
    { metric: 'Net Fee Drag (to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.summary.netFeeDrag)) },
    {
      metric: 'Fee Drag % of Premiums',
      unit: 'percent',
      lowerIsBetter: true,
      values: valuesFor((analysis) => projectedValue(analysis, (projected) => (
        projected.summary.totalPremiumsPaid > CONTRIBUTION_TOLERANCE
          ? projected.summary.netFeeDrag / projected.summary.totalPremiumsPaid
          : 0
      ))),
    },
    { metric: 'Cancel-Now Penalty', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.cancelNowPenalty) },
    { metric: 'Surrender Value Today', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.summary.currentSurrenderValue) },
    {
      metric: 'Death Benefit Today',
      unit: 'currency',
      lowerIsBetter: currencyRule(false),
      values: valuesFor((analysis) => analysis.summary.currentDeathBenefitEstimate ?? '—'),
    },
    ...(analyses.some((analysis) => analysis.summary.currentAccidentalDeathBenefitEstimate != null)
      ? [{
          metric: 'Accidental Death Benefit Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentAccidentalDeathBenefitEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentTiBenefitEstimate != null)
      ? [{
          metric: 'TI Benefit Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentTiBenefitEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentTiBenefitAfterTpdEstimate != null)
      ? [{
          metric: 'TI Benefit After TPD Claim Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentTiBenefitAfterTpdEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentResidualDeathBenefitAfterTiEstimate != null)
      ? [{
          metric: 'Death Benefit After TI Claim Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentResidualDeathBenefitAfterTiEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentTpdBenefitEstimate != null)
      ? [{
          metric: 'TPD Benefit Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentTpdBenefitEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentAccidentalTpdBenefitEstimate != null)
      ? [{
          metric: 'Accidental TPD Benefit Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentAccidentalTpdBenefitEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentResidualDeathBenefitAfterTpdEstimate != null)
      ? [{
          metric: 'Death Benefit After TPD Claim Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentResidualDeathBenefitAfterTpdEstimate ?? '—'),
        }]
      : []),
    ...(analyses.some((analysis) => analysis.summary.currentAccidentalDisabilityBenefitEstimate != null)
      ? [{
          metric: 'Accidental Disability Benefit Today',
          unit: 'currency' as const,
          lowerIsBetter: currencyRule(false),
          values: valuesFor((analysis) => analysis.summary.currentAccidentalDisabilityBenefitEstimate ?? '—'),
        }]
      : []),
    { metric: 'NPV Fees (Surrender Now)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.npvAnalysis.surrenderNow.npvFees)) },
    { metric: 'Best Exit Year', unit: 'years', lowerIsBetter: null, values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.npvAnalysis.bestExitYear)) },
    { metric: 'NPV Fees (Best Exit)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.npvAnalysis.bestExitNpvFees)) },
    { metric: 'NPV Fees (Hold to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.npvAnalysis.holdToMip.totalNpvFees)) },
    { metric: 'Final Value (horizon end, mid)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.npvAnalysis.holdToMip.finalValue)) },
    { metric: 'Opportunity Cost (vs surrender now)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => projectedValue(analysis, (projected) => projected.opportunityCost.difference)) },
  ]
}

export function analyzeAllPolicies(inputs: IlpPolicyInput[]): IlpFullAnalysis {
  const policies = inputs.map((policy) => (
    isProjectedAnalysisEligible(policy)
      ? analyzeIlpPolicy(policy)
      : analyzeCurrentOnlyIlpPolicy(policy)
  ))
  const policyCurrencies = Object.fromEntries(inputs.map((policy) => [policy.id, policy.currency]))
  return {
    policies,
    comparison: buildComparisonTable(policies, policyCurrencies),
  }
}
