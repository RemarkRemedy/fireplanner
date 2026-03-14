import {
  HSBC_FLEXI_DEATH_TI_RATE_TABLE,
  MANULIFE_INVESTREADY_III_DEATH_TI_RATE_TABLE,
  MANULIFE_MANUINVEST_DUO_DEATH_TI_TPD_RATE_TABLE,
  PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE,
  PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE,
  PRUVANTAGE_PROSPER_DEATH_RATE_TABLE,
} from '@/lib/data/ilpAssuranceTables'
import {
  MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER,
  PRUDENTIAL_ASSURE_II_MULTIPLIERS,
  PRUDENTIAL_PROSPER_SUM_AT_RISK_MULTIPLIERS,
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
  type: 'premium-holiday' | 'partial-withdrawal' | 'regular-premium-reduction' | 'regular-premium-increase' | 'top-up' | 'recurring-single-premium' | 'recurring-single-premium-resumption' | 'assurance-benefit-reduction' | 'assurance-benefit-resumption'
  startPolicyMonth: number
  durationMonths: number
  amount?: number
  accountId?: string
  chargeWaived?: boolean
  repayMissedPremiums?: boolean
  repaymentAccountId?: string
  resultingSumAssured?: number
  resultingWealthAssureValue?: number
}

export interface IlpScheduledPayoutSupport {
  mode: 'manual-assumption'
  accountId: string
  source: 'policy-redemption'
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
    }

export interface IlpDistributionSupport {
  mode: 'manual-assumption'
  accountIds: string[]
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
  trigger: 'premium-holiday' | 'partial-withdrawal' | 'regular-premium-reduction'
  suspensionMonths: number
}

export interface IlpBonusRestorationRule {
  trigger: 'premium-holiday-repayment'
  basis: 'repaid-premium-with-missed-months' | 'account-value-plus-repaid-premium-with-missed-months'
}

export interface IlpBonusRule {
  id: string
  type: 'power-up' | 'loyalty' | 'allocation' | 'sign-up' | 'custom'
  label: string
  mode: 'annual-rate' | 'premium-allocation' | 'one-time'
  rate: number
  amount: number
  appliesTo: string[]
  startPolicyYear: number
  endPolicyYear: number | null
  yearBasis?: 'policy-year' | 'premium-year'
  cadenceYears?: number
  requiresPremiumsPaidUpToDate?: boolean
  tieredRates?: IlpBonusTier[]
  suspensionRules?: IlpBonusSuspensionRule[]
  restorationRules?: IlpBonusRestorationRule[]
}

export interface IlpBonusTier {
  currency: 'SGD' | 'USD'
  minAnnualPremium: number | null
  maxAnnualPremium: number | null
  minAccountValue?: number | null
  maxAccountValue?: number | null
  rate: number
}

export interface IlpAssuranceProfile {
  currentAgeNextBirthday: number
  sex: 'male' | 'female'
  smokerStatus: 'smoker' | 'non-smoker'
  currentNetRegularPremiumBase?: number
  currentSumAssured?: number
  currentWealthAssureValue?: number
  currentBasicSumAssured?: number
  currentNetSupplementaryPremiumBase?: number
}

export interface IlpAssuranceChargeConfig {
  formula:
    | 'prudential-prosper-death'
    | 'prudential-prosper-accidental-death'
    | 'prudential-assure-ii-combined'
    | 'hsbc-flexi-choice-death-ti'
    | 'hsbc-flexi-max-death-ti'
    | 'manulife-investready-iii-death-ti'
    | 'manulife-manuinvest-duo-death-ti-tpd'
  monthlyModalFactor: number
  maxAgeNextBirthday?: number
}

export interface IlpPremiumBaseMultiplierTier {
  startPolicyYear: number
  endPolicyYear: number | null
  mode: 'policy-year' | 'fixed'
  multiplier?: number
}

export interface IlpPremiumBaseChargeConfig {
  useHigherOfCommencementAndPrevailing: boolean
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
  basis: 'account-value' | 'annual-contribution' | 'fixed-annual' | 'assurance-sum-at-risk' | 'premium-base-mip-multiplier' | 'cumulative-paid-regular-premium'
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
  yearBasis?: 'policy-year' | 'premium-year'
  startPolicyYear?: number
  endPolicyYear?: number | null
  appliesTo: string[]
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
  basis: 'event-amount' | 'account-value' | 'premium-reduction-with-startup-recovery' | 'premium-reduction-tiered-startup-recovery' | 'repaid-premium-with-missed-months' | 'annual-premium-with-overlap-months' | 'committed-annual-premium-with-overlap-months' | 'premium-holiday-charge-refund' | 'event-amount-with-overlap-months' | 'annual-reduction-with-active-months'
  activeWindow?: 'during-mip' | 'after-mip' | 'policy-term'
  yearBasis?: 'policy-year' | 'premium-year'
  appliesTo: string[]
  fallbackAppliesTo?: string[]
  freeLifetimeMonths?: number
  freeEventCount?: number
  freeEventStartPolicyYear?: number
  freeEventMaxAmountRate?: number
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
  monthsAlreadyPaid: number
  currentPolicyYear: number
  icpMonths?: number
  mipBasis?: 'finite' | 'open-ended'
  assuranceProfile?: IlpAssuranceProfile
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
}

export interface IlpPolicyAnalysis {
  policyId: string
  policyName: string
  insurer: string
  currency: IlpPolicyInput['currency']
  projections: Record<ReturnScenario, IlpProjectionResult>
  npvAnalysis: IlpNpvAnalysis
  opportunityCost: IlpOpportunityCost
  summary: IlpSummaryMetrics
}

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

interface IlpSyntheticEvent {
  type: 'premium-holiday-repayment'
  startPolicyMonth: number
  durationMonths: number
  amount: number
  accountId?: string
  sourceEventId?: string
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
  events: Array<IlpPolicyEvent | IlpSyntheticEvent>
}

type IlpAssuranceFormulaFamily =
  | 'prudential-prosper'
  | 'prudential-assure-ii'
  | 'hsbc-flexi'
  | 'protected-base-paid-premium-floor'
  | 'protected-base-sum-assured'

interface IlpNormalizedAssuranceRule {
  rule: IlpChargeRule & { assuranceConfig: IlpAssuranceChargeConfig }
  family: IlpAssuranceFormulaFamily
  appliesTo: IlpAccount[]
  appliesToIds: string[]
  fallbackAppliesTo: IlpAccount[]
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

type IlpNormalizedBonusTierBasis = 'flat' | 'annual-premium' | 'account-value' | 'annual-premium-and-account-value'

interface IlpNormalizedBonusRule {
  bonus: IlpBonusRule
  targetAccountIds: string[]
  tierBasis: IlpNormalizedBonusTierBasis
  suspensionTriggers: IlpBonusSuspensionRule['trigger'][]
  restorationTriggers: IlpBonusRestorationRule['trigger'][]
}

interface IlpNormalizedBonusKernel {
  rules: IlpNormalizedBonusRule[]
}

interface IlpNormalizedPolicyEvents {
  premiumHolidays: IlpPolicyEvent[]
  partialWithdrawals: IlpPolicyEvent[]
  regularPremiumReductions: IlpPolicyEvent[]
  regularPremiumIncreases: IlpPolicyEvent[]
  topUps: IlpPolicyEvent[]
  recurringSinglePremiums: IlpPolicyEvent[]
  recurringSinglePremiumResumptions: IlpPolicyEvent[]
  assuranceStateEvents: IlpPolicyEvent[]
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

function hasFiniteMip(input: Pick<IlpPolicyInput, 'mipBasis' | 'mipLength'>): input is Pick<IlpPolicyInput, 'mipBasis'> & { mipLength: number } {
  return getMipBasis(input) === 'finite' && input.mipLength != null
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
  event: IlpPolicyEvent | IlpSyntheticEvent,
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
      const fallbackAppliesTo = resolveAccountsInDisplayOrder(input, rule.fallbackAppliesTo ?? [])

      return {
        rule,
        family: getAssuranceFormulaFamily(rule.assuranceConfig),
        appliesTo,
        appliesToIds,
        fallbackAppliesTo,
      }
    })
    .filter((normalizedRule) => normalizedRule.appliesTo.length > 0)

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
  const usesAccountValue = bonus.tieredRates.some((tier) => (
    tier.minAccountValue != null || tier.maxAccountValue != null
  ))

  if (usesAnnualPremium && usesAccountValue) {
    return 'annual-premium-and-account-value'
  }
  if (usesAnnualPremium) {
    return 'annual-premium'
  }
  if (usesAccountValue) {
    return 'account-value'
  }

  return 'flat'
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

function buildNormalizedRegularPremiumState(
  normalized: Pick<IlpNormalizedPolicyInput, 'input' | 'events' | 'contributionRoutesByPhase'>,
): IlpNormalizedPolicyInput['regularPremiums'] {
  const maxPolicyMonth = normalized.input.monthsAlreadyPaid + (computeTotalProjectionYears(normalized.input) * 12)
  const paidByPolicyMonth = new Map<number, number>()
  const cumulativePaidByPolicyMonth = new Map<number, number>()
  const premiumYearByPolicyMonth = new Map<number, number>()
  const paidUpToDateByPolicyMonth = new Map<number, boolean>()
  const arrearsByPolicyMonth = new Map<number, number>()
  const repaymentByPolicyMonth = new Map<number, number>()
  let cumulativePaid = 0
  let arrears = 0

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
    premiumYearByPolicyMonth.set(
      policyMonth,
      normalized.input.monthlyContribution > CONTRIBUTION_TOLERANCE
        ? Math.ceil(cumulativePaid / (normalized.input.monthlyContribution * 12))
        : 0,
    )
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

function buildNormalizedPolicyInput(input: IlpPolicyInput): IlpNormalizedPolicyInput {
  const policyEvents = input.policyEvents ?? []
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
      premiumHolidays: sortPolicyEvents(policyEvents.filter((event) => event.type === 'premium-holiday')),
      partialWithdrawals: sortPolicyEvents(policyEvents.filter((event) => event.type === 'partial-withdrawal')),
      regularPremiumReductions: sortPolicyEvents(policyEvents.filter((event) => event.type === 'regular-premium-reduction')),
      regularPremiumIncreases: sortPolicyEvents(policyEvents.filter((event) => event.type === 'regular-premium-increase')),
      topUps: sortPolicyEvents(policyEvents.filter((event) => event.type === 'top-up')),
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

  normalized.regularPremiums = buildNormalizedRegularPremiumState(normalized)
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

function getScheduledPayoutsByAccount(
  normalized: IlpNormalizedPolicyInput,
  policyYear: number,
): Map<string, number> {
  const payouts = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const scheduledPayout = normalized.input.scheduledPayoutAssumption

  if (!scheduledPayout || scheduledPayout.mode !== 'scheduled-redemption') {
    return payouts
  }

  const payoutEndPolicyYear = scheduledPayout.startPolicyYear + scheduledPayout.durationYears - 1
  if (policyYear < scheduledPayout.startPolicyYear || policyYear > payoutEndPolicyYear) {
    return payouts
  }

  payouts.set(scheduledPayout.accountId, scheduledPayout.annualPayoutAmount)
  return payouts
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
  const payoutAllowed = isPostMipPolicyYear(normalized.input, policyYear)
    ? distributionSupport.cashPayoutAllowedAfterMip
    : distributionSupport.cashPayoutAllowedDuringMip

  if (!payoutAllowed) {
    return payouts
  }

  for (const accountId of distributionSupport.accountIds) {
    const openBalance = openBalances.get(accountId) ?? 0
    if (openBalance <= 0) continue
    payouts.set(accountId, openBalance * distributionAssumption.annualYieldRate)
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
  }

  if (input.distributionAssumption && !input.distributionSupport) {
    throw new Error(`Distribution assumption requires distribution support on policy "${input.name}".`)
  }

  if (
    input.distributionAssumption?.mode === 'cash-payout'
    && input.distributionSupport
    && !input.distributionSupport.cashPayoutAllowedDuringMip
    && !input.distributionSupport.cashPayoutAllowedAfterMip
  ) {
    throw new Error(`Cash-payout distribution assumption requires at least one payout-eligible phase on policy "${input.name}".`)
  }
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
): IlpSyntheticEvent[] {
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

function getAssuranceRiskClass(profile: IlpAssuranceProfile) {
  return `${profile.sex}-${profile.smokerStatus}` as const
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
    case 'hsbc-flexi-choice-death-ti':
    case 'hsbc-flexi-max-death-ti':
      return 'hsbc-flexi'
    case 'manulife-investready-iii-death-ti':
      return 'protected-base-paid-premium-floor'
    case 'manulife-manuinvest-duo-death-ti-tpd':
      return 'protected-base-sum-assured'
    default:
      return assertNever(config.formula)
  }
}

function resolveAssuranceRate(
  rule: IlpChargeRule,
  ageNextBirthday: number,
  profile: IlpAssuranceProfile,
): number {
  if (!rule.assuranceConfig) {
    return 0
  }

  const ageIndex = Math.min(Math.max(Math.round(ageNextBirthday), 1), 120) - 1
  const riskClass = getAssuranceRiskClass(profile)

  switch (rule.assuranceConfig.formula) {
    case 'prudential-prosper-death':
      return PRUVANTAGE_PROSPER_DEATH_RATE_TABLE[riskClass][ageIndex] ?? 0
    case 'prudential-prosper-accidental-death':
      return PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE[riskClass][ageIndex] ?? 0
    case 'prudential-assure-ii-combined':
      return PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE[riskClass][ageIndex] ?? 0
    case 'hsbc-flexi-choice-death-ti':
    case 'hsbc-flexi-max-death-ti':
      return HSBC_FLEXI_DEATH_TI_RATE_TABLE[riskClass][ageIndex] ?? 0
    case 'manulife-investready-iii-death-ti':
      return MANULIFE_INVESTREADY_III_DEATH_TI_RATE_TABLE[riskClass][ageIndex] ?? 0
    case 'manulife-manuinvest-duo-death-ti-tpd':
      return MANULIFE_MANUINVEST_DUO_DEATH_TI_TPD_RATE_TABLE[riskClass][ageIndex] ?? 0
    default:
      return assertNever(rule.assuranceConfig.formula)
  }
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

function computeProtectedBaseSumAtRisk(
  formula: Extract<IlpAssuranceChargeConfig['formula'], 'manulife-investready-iii-death-ti' | 'manulife-manuinvest-duo-death-ti-tpd'>,
  regularPremiumBaseAtStartOfYear: number,
  regularPremiumPaidThisYear: number,
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  currentYearApplicableWithdrawals: number,
  midpointApplicableValue: number,
  sumAssuredAtStartOfYear: number | undefined,
): number {
  switch (formula) {
    case 'manulife-investready-iii-death-ti': {
      const midpointProtectedBase = Math.max(
        0,
        regularPremiumBaseAtStartOfYear
          + supplementaryPremiumBaseAtStartOfYear
          + ((regularPremiumPaidThisYear + supplementaryPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
      )

      return Math.max(0, (midpointProtectedBase * MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER) - midpointApplicableValue)
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
  supplementaryPremiumBaseAtStartOfYear: number,
  supplementaryPremiumPaidThisYear: number,
  withdrawalByAccount: Map<string, number>,
  sumAssuredAtStartOfYear: number | undefined,
  wealthAssureValueAtStartOfYear: number | undefined,
  growthFrozenAtStartOfYear: boolean,
): {
  charges: Map<string, number>
  nextSumAssured: number | undefined
  nextWealthAssureValue: number | undefined
  nextGrowthFrozen: boolean
} {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const profile = normalized.assurance.profile
  if (!profile) {
    return {
      charges,
      nextSumAssured: sumAssuredAtStartOfYear,
      nextWealthAssureValue: wealthAssureValueAtStartOfYear,
      nextGrowthFrozen: growthFrozenAtStartOfYear,
    }
  }

  let nextSumAssured = sumAssuredAtStartOfYear
  let nextWealthAssureValue = wealthAssureValueAtStartOfYear
  let nextGrowthFrozen = growthFrozenAtStartOfYear
  const ageNextBirthday = profile.currentAgeNextBirthday + projectionYear - 1
  const assuranceStateEvents = getAssuranceStateEventsForYear(normalized, context.range)

  for (const { rule, family, appliesTo, appliesToIds, fallbackAppliesTo } of normalized.assurance.rules) {
    const isPostMip = isPostMipPolicyYear(input, policyYear)
    const isActive = rule.activeWindow === 'policy-term'
      || (rule.activeWindow === 'during-mip' && !isPostMip)
      || (rule.activeWindow === 'after-mip' && isPostMip)
    if (!isActive) continue
    if (rule.startPolicyYear != null && policyYear < rule.startPolicyYear) continue
    if (rule.endPolicyYear != null && policyYear > rule.endPolicyYear) continue
    if (rule.assuranceConfig.maxAgeNextBirthday != null && ageNextBirthday > rule.assuranceConfig.maxAgeNextBirthday) continue

    const openApplicableValue = sumBalancesForAccounts(openBalances, appliesToIds)
    const provisionalApplicableValue = sumBalancesForAccounts(provisionalCloseByAccount, appliesToIds)
    const midpointApplicableValue = Math.max(0, (openApplicableValue + provisionalApplicableValue) / 2)
    const currentYearApplicableWithdrawals = sumWithdrawalsForAccounts(withdrawalByAccount, appliesToIds)
    const supplementaryApplicableWithdrawals = normalized.multiAccount.supplementaryPremiumAccountIds.length > 0
      ? sumWithdrawalsForAccounts(withdrawalByAccount, normalized.multiAccount.supplementaryPremiumAccountIds)
      : currentYearApplicableWithdrawals
    const midpointRegularPremiumBase = Math.max(
      0,
      regularPremiumBaseAtStartOfYear + ((regularPremiumPaidThisYear - currentYearApplicableWithdrawals) / 2),
    )

    let sumAtRisk = 0

    switch (family) {
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

      case 'protected-base-paid-premium-floor':
      case 'protected-base-sum-assured':
        sumAtRisk = computeProtectedBaseSumAtRisk(
          rule.assuranceConfig.formula as Extract<IlpAssuranceChargeConfig['formula'], 'manulife-investready-iii-death-ti' | 'manulife-manuinvest-duo-death-ti-tpd'>,
          regularPremiumBaseAtStartOfYear,
          regularPremiumPaidThisYear,
          supplementaryPremiumBaseAtStartOfYear,
          supplementaryPremiumPaidThisYear,
          currentYearApplicableWithdrawals,
          midpointApplicableValue,
          sumAssuredAtStartOfYear,
        )
        break
    }

    const annualizedCharge = resolveAssuranceRate(rule, ageNextBirthday, profile) / 1000
      * sumAtRisk
      * rule.assuranceConfig.monthlyModalFactor
      * 12

    const allocations = applyChargeAllocationsWithFallback(
      annualizedCharge,
      rule.allocation,
      appliesTo,
      fallbackAppliesTo,
      openBalances,
    )

    for (const [accountId, amount] of allocations.entries()) {
      charges.set(accountId, (charges.get(accountId) ?? 0) + amount)
    }
  }

  return { charges, nextSumAssured, nextWealthAssureValue, nextGrowthFrozen }
}

function resolveTieredBonusRate(
  bonus: Pick<IlpBonusRule, 'rate' | 'tieredRates'>,
  tierBasis: IlpNormalizedBonusTierBasis,
  annualContribution: number,
  currency: IlpPolicyInput['currency'],
  accountValue?: number,
): number {
  if (!bonus.tieredRates || bonus.tieredRates.length === 0 || tierBasis === 'flat') {
    return bonus.rate
  }

  const matchedTier = bonus.tieredRates.find((tier) => {
    if (tier.currency !== currency) return false

    const matchesAnnualPremium = (() => {
      if (tierBasis === 'account-value') return true
      const aboveMin = tier.minAnnualPremium == null || annualContribution >= tier.minAnnualPremium
      const belowMax = tier.maxAnnualPremium == null || annualContribution <= tier.maxAnnualPremium
      return aboveMin && belowMax
    })()

    const matchesAccountValue = (() => {
      if (tierBasis === 'annual-premium') return true
      const aboveMin = tier.minAccountValue == null || (accountValue ?? 0) >= tier.minAccountValue
      const belowMax = tier.maxAccountValue == null || (accountValue ?? 0) <= tier.maxAccountValue
      return aboveMin && belowMax
    })()

    return matchesAnnualPremium && matchesAccountValue
  })

  return matchedTier?.rate ?? bonus.rate
}

function resolveNormalizedBonusRate(
  normalizedBonus: IlpNormalizedBonusRule,
  annualContribution: number,
  currency: IlpPolicyInput['currency'],
  accountValue?: number,
): number {
  const { bonus, tierBasis } = normalizedBonus

  return resolveTieredBonusRate(bonus, tierBasis, annualContribution, currency, accountValue)
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
  const currentRate = resolveTieredBonusRate(startupBonus, tierBasis, currentAnnualPremium, input.currency)
  const reducedRate = resolveTieredBonusRate(startupBonus, tierBasis, reducedAnnualPremium, input.currency)
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
): IlpPolicyEvent[] {
  switch (trigger) {
    case 'premium-holiday':
      return normalized.events.premiumHolidays
    case 'partial-withdrawal':
      return normalized.events.partialWithdrawals
    case 'regular-premium-reduction':
      return normalized.events.regularPremiumReductions
  }
}

function getBonusEligibilityFraction(
  normalizedBonus: IlpNormalizedBonusRule,
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
): number {
  if (normalizedBonus.bonus.requiresPremiumsPaidUpToDate && !context.paymentHistory.premiumsPaidUpToDate) {
    return 0
  }

  if (normalizedBonus.bonus.suspensionRules == null || normalizedBonus.bonus.suspensionRules.length === 0) {
    return 1
  }
  const range = context.range
  const suspendedMonths = (normalizedBonus.bonus.suspensionRules ?? []).reduce((sum, rule) => {
    const overlapForRule = getNormalizedEventsForBonusTrigger(normalized, rule.trigger)
      .reduce((innerSum, event) => {
        const suspensionDuration = rule.trigger === 'regular-premium-reduction'
          ? rule.suspensionMonths
          : Math.max(rule.suspensionMonths, event.durationMonths)
        return innerSum + overlapMonths(
          range.startPolicyMonth,
          range.endPolicyMonth,
          event.startPolicyMonth,
          event.startPolicyMonth + suspensionDuration - 1,
        )
      }, 0)

    return sum + overlapForRule
  }, 0)

  return Math.max(0, (12 - Math.min(12, suspendedMonths)) / 12)
}

function getBonusReferenceYear(
  normalizedBonus: IlpNormalizedBonusRule,
  context: IlpCashflowYearContext,
): number {
  return normalizedBonus.bonus.yearBasis === 'premium-year'
    ? context.paymentHistory.premiumYearAtEnd
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
  normalizedBonus: IlpNormalizedBonusRule,
  accountId: string,
  accountOpenBalance: number,
  annualRegularContribution: number,
  currency: IlpPolicyInput['currency'],
  repaymentEvents: IlpSyntheticEvent[],
): number {
  if (normalizedBonus.bonus.restorationRules == null || normalizedBonus.bonus.restorationRules.length === 0) {
    return 0
  }

  if (!normalizedBonus.targetAccountIds.includes(accountId)) {
    return 0
  }

  const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
  return (normalizedBonus.bonus.restorationRules ?? []).reduce((sum, rule) => {
    if (rule.trigger !== 'premium-holiday-repayment') {
      return sum
    }

    return sum + repaymentEvents.reduce((eventSum, event) => {
      const effectiveRate = resolveNormalizedBonusRate(
        normalizedBonus,
        annualRegularContribution + event.amount,
        currency,
        accountOpenBalance + event.amount,
      )

      switch (rule.basis) {
        case 'repaid-premium-with-missed-months':
          return eventSum + (((event.amount * effectiveRate * event.durationMonths) / 12) / splitCount)
        case 'account-value-plus-repaid-premium-with-missed-months':
          return eventSum + ((((accountOpenBalance + event.amount) * effectiveRate * event.durationMonths) / 12) / splitCount)
      }
    }, 0)
  }, 0)
}

function computeBonusCredit(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  repaymentEvents: IlpSyntheticEvent[],
  accountId: string,
  accountOpenBalance: number,
  annualRegularContributionToAccount: number,
  annualRegularContribution: number,
  currency: IlpPolicyInput['currency'],
): number {
  let total = 0

  for (const normalizedBonus of normalized.bonuses.rules) {
    const bonus = normalizedBonus.bonus
    const referenceYear = getBonusReferenceYear(normalizedBonus, context)
    if (!normalizedBonus.targetAccountIds.includes(accountId)) continue
    if (referenceYear < bonus.startPolicyYear) continue
    if (bonus.endPolicyYear != null && referenceYear > bonus.endPolicyYear) continue
    if (!isBonusDueForReferenceYear(normalizedBonus, referenceYear)) continue

    const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
    const effectiveRate = resolveNormalizedBonusRate(normalizedBonus, annualRegularContribution, currency, accountOpenBalance)
    const eligibilityFraction = getBonusEligibilityFraction(normalizedBonus, normalized, context)

    switch (bonus.mode) {
      case 'annual-rate':
        total += accountOpenBalance * effectiveRate * eligibilityFraction
        break
      case 'premium-allocation':
        total += (
          (normalizedBonus.targetAccountIds.length > 0
            ? annualRegularContributionToAccount
            : (annualRegularContribution / splitCount))
          * effectiveRate
          * eligibilityFraction
        )
        break
      case 'one-time':
        if (referenceYear === bonus.startPolicyYear) {
          total += bonus.amount / splitCount
        }
        break
    }

    total += computeRestoredBonusCredit(
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

function getEventChargeEvents(
  normalized: IlpNormalizedPolicyInput,
  context: IlpCashflowYearContext,
  rule: IlpEventChargeRule,
  repaymentEvents: IlpSyntheticEvent[],
): Array<IlpPolicyEvent | IlpSyntheticEvent> {
  switch (rule.trigger) {
    case 'premium-holiday-repayment':
      return repaymentEvents
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
  repaymentEvents: IlpSyntheticEvent[],
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
): Record<'during-icp' | 'after-icp' | 'after-mip', number> {
  const icpMonths = Math.max(normalized.input.icpMonths ?? 0, 0)
  const { startPolicyMonth: yearStartMonth, endPolicyMonth: yearEndMonth } = context.range

  if (context.isPostMip) {
    return {
      'during-icp': 0,
      'after-icp': 0,
      'after-mip': context.payableMonths,
    }
  }

  const duringIcpStart = Math.max(yearStartMonth, 1)
  const duringIcpEnd = Math.min(yearEndMonth, icpMonths)
  const duringIcpMonths = Math.max(0, duringIcpEnd - duringIcpStart + 1)
  const afterIcpMonths = Math.max(0, context.payableMonths - duringIcpMonths)

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
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  if (contributionForYear <= 0) {
    return contributionByAccount
  }

  const phaseMonths = getContributionPhaseMonths(normalized, context)
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

function getPremiumHolidayRepaymentContributionByAccount(
  normalized: IlpNormalizedPolicyInput,
  repaymentEvents: IlpSyntheticEvent[],
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

function applyChargeAllocationsWithFallback(
  totalCharge: number,
  allocation: IlpChargeRule['allocation'] | IlpEventChargeRule['allocation'],
  appliesTo: IlpAccount[],
  fallbackAppliesTo: IlpAccount[],
  openBalances: Map<string, number>,
): Map<string, number> {
  if (fallbackAppliesTo.length === 0) {
    return allocateChargeTotal(totalCharge, allocation, appliesTo, openBalances)
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

  return allocations
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
  const priorHolidayMonths = Math.max(
    0,
    normalized.events.premiumHolidays
      .filter((candidate) => (
        candidate.startPolicyMonth < event.startPolicyMonth
      ))
      .reduce((sum, candidate) => sum + candidate.durationMonths, 0),
  )

  let total = 0
  for (let policyMonth = start; policyMonth <= end; policyMonth += 1) {
    const lifetimeHolidayMonthIndex = priorHolidayMonths + (policyMonth - event.startPolicyMonth) + 1
    if (rule.freeLifetimeMonths != null && lifetimeHolidayMonthIndex <= rule.freeLifetimeMonths) {
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

function computeFreePartialWithdrawalAmount(
  normalized: IlpNormalizedPolicyInput,
  rule: IlpEventChargeRule,
  event: IlpPolicyEvent,
  openBalances: Map<string, number>,
): number {
  if (rule.trigger !== 'partial-withdrawal' || rule.basis !== 'event-amount') {
    return 0
  }

  if ((rule.freeEventCount ?? 0) <= 0 || event.amount == null || event.amount <= 0) {
    return 0
  }

  const eventPolicyYear = getPolicyYearForMonth(event.startPolicyMonth)
  if (rule.freeEventStartPolicyYear != null && eventPolicyYear < rule.freeEventStartPolicyYear) {
    return 0
  }

  const priorMatchingEvents = normalized.events.partialWithdrawals
    .filter((candidate) => (
      candidate.startPolicyMonth < event.startPolicyMonth
      && candidate.accountId != null
      && normalized.multiAccount.withdrawalChargeScopeAccountIds.includes(candidate.accountId)
      && rule.appliesTo.includes(candidate.accountId)
    ))

  if (priorMatchingEvents.length >= (rule.freeEventCount ?? 0)) {
    return 0
  }

  const maxFreeAmount = rule.freeEventMaxAmountRate != null
    ? normalized.multiAccount.withdrawalChargeScopeAccountIds
        .filter((accountId) => rule.appliesTo.includes(accountId))
        .reduce((sum, accountId) => sum + (openBalances.get(accountId) ?? 0), 0) * rule.freeEventMaxAmountRate
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

    switch (rule.basis) {
      case 'account-value':
        for (const account of appliesTo) {
          const open = openBalances.get(account.id) ?? 0
          charges.set(account.id, (charges.get(account.id) ?? 0) + (open * resolveChargeRate(rule, context)))
        }
        break

      case 'annual-contribution':
        for (const account of appliesTo) {
          const routedContribution = contributionByAccount.get(account.id) ?? 0
          charges.set(account.id, (charges.get(account.id) ?? 0) + (routedContribution * resolveChargeRate(rule, context)))
        }
        break

      case 'fixed-annual': {
        const allocations = applyChargeAllocationsWithFallback(
          resolveChargeAmount(rule, context),
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
        const totalCharge = computePremiumBaseMultiplierCharge(normalized, context, rule)
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
        const totalCharge = computeCumulativePaidRegularPremiumCharge(normalized, context, rule)
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
  repaymentEvents: IlpSyntheticEvent[],
  openBalances: Map<string, number>,
): Map<string, number> {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const eventChargeRules = input.eventChargeRules ?? []
  const applications: Array<{
    rule: IlpEventChargeRule
    totalCharge: number
    allocations: Map<string, number>
  }> = []

  for (const { rule, events } of normalizeEventChargeRules(normalized, context, repaymentEvents)) {
    const ruleAllocations = new Map<string, number>()
    let ruleTotalCharge = 0

    for (const event of events) {
      if (event.type !== 'premium-holiday-repayment' && event.chargeWaived === true && (
        event.type === 'partial-withdrawal'
        || event.type === 'premium-holiday'
        || event.type === 'regular-premium-reduction'
      )) {
        continue
      }

      let totalCharge = 0
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
      if (appliesTo.length === 0) continue

      switch (rule.basis) {
        case 'event-amount':
          totalCharge = Math.max(0, ((event.amount ?? 0) - computeFreePartialWithdrawalAmount(normalized, rule, event as IlpPolicyEvent, openBalances))) * effectiveRuleRate + rule.amount
          break

        case 'account-value':
          totalCharge = appliesTo.reduce((sum, account) => sum + ((openBalances.get(account.id) ?? 0) * effectiveRuleRate), 0) + rule.amount
          break

        case 'premium-reduction-with-startup-recovery': {
          const monthsPassedSinceInception = Math.max(event.startPolicyMonth - 1, 0)
          const committedMipMonths = Math.max(1, (hasFiniteMip(input) ? input.mipLength : computeTotalProjectionYears(input)) * 12)
          const remainingFactor = Math.max(0, 1 - (monthsPassedSinceInception / committedMipMonths))
          totalCharge = ((event.amount ?? 0) * effectiveRuleRate * remainingFactor) + rule.amount
          break
        }

        case 'premium-reduction-tiered-startup-recovery':
          totalCharge = computeTieredStartupRecoveryCharge(normalized, rule, event)
          break

        case 'repaid-premium-with-missed-months':
          totalCharge = ((event.amount ?? 0) * effectiveRuleRate * event.durationMonths / 12) + rule.amount
          break

        case 'annual-premium-with-overlap-months':
          totalCharge = computePremiumHolidayChargeForEvent(normalized, event as IlpPolicyEvent, rule, context, {
            start: context.range.startPolicyMonth,
            end: context.range.endPolicyMonth,
          }) + rule.amount
          break

        case 'committed-annual-premium-with-overlap-months':
          totalCharge = computePremiumHolidayChargeForEvent(normalized, event as IlpPolicyEvent, rule, context, {
            start: context.range.startPolicyMonth,
            end: context.range.endPolicyMonth,
          }, true) + rule.amount
          break

        case 'premium-holiday-charge-refund': {
          const sourceEventId = 'sourceEventId' in event ? event.sourceEventId : undefined
          const sourceEvent = normalized.events.premiumHolidays.find((candidate) => candidate.id === sourceEventId)
          const sourceChargeRule = eventChargeRules.find((candidate) => candidate.id === rule.sourceChargeRuleId)

          if (!sourceEvent || !sourceChargeRule) {
            totalCharge = 0
            break
          }

          const sourceCharge = computePremiumHolidayChargeForEvent(normalized, sourceEvent, sourceChargeRule, context)
          totalCharge = -(sourceCharge * effectiveRuleRate) + rule.amount
          break
        }

        case 'event-amount-with-overlap-months': {
          const monthsInYear = getRecurringSinglePremiumActiveMonthsForEvent(
            normalized,
            event as IlpPolicyEvent,
            context.range.startPolicyMonth,
            context.range.endPolicyMonth,
          )
          totalCharge = ((event.amount ?? 0) * monthsInYear * effectiveRuleRate) + rule.amount
          break
        }

        case 'annual-reduction-with-active-months': {
          totalCharge = 0
          for (let policyMonth = context.range.startPolicyMonth; policyMonth <= context.range.endPolicyMonth; policyMonth += 1) {
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
          totalCharge += rule.amount
          break
        }
      }

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
  assertScheduledPayoutConfiguration(input)
  assertDistributionConfiguration(input)
  const normalized = buildNormalizedPolicyInput(input)

  const blendedNetReturn = computeBlendedReturn(input.funds, scenario)
  const annualContribution = input.monthlyContribution * 12
  const totalYears = computeTotalProjectionYears(input)
  const previousClose = new Map(input.accounts.map((account) => [account.id, account.currentValue]))
  const rows: IlpYearRow[] = []

  let cumulativeGrossFees = 0
  let cumulativeBonuses = 0
  let cumulativePremiums = input.monthlyContribution * input.monthsAlreadyPaid
  let assuranceRegularPremiumBase = input.assuranceProfile?.currentNetRegularPremiumBase ?? 0
  let assuranceSupplementaryPremiumBase = input.assuranceProfile?.currentNetSupplementaryPremiumBase ?? 0
  let assuranceSumAssured = input.assuranceProfile?.currentSumAssured
  let assuranceWealthAssureValue = input.assuranceProfile?.currentWealthAssureValue
  let assuranceGrowthFrozen = false
  const assuranceRelevantAccountIds = getAssuranceRelevantAccountIds(normalized)

  for (let year = 1; year <= totalYears; year += 1) {
    const policyYear = input.currentPolicyYear + year
    const isPostMip = isPostMipPolicyYear(input, policyYear)
    const context = buildCashflowYearContext(normalized, year)
    const scheduledContributionForYear = (isPostMip && !hasAfterMipContributionRules(input))
      ? 0
      : Math.max(0, annualContribution - getRegularPremiumReductionForYear(normalized, context.range))
    const eecReferenceYear = getEecReferenceYear(input, context)
    const eecRate = isPostMip ? 0 : lookupEecRate(eecReferenceYear, input.eecTable)
    const openBalances = new Map(
      input.accounts.map((account) => [account.id, previousClose.get(account.id) ?? account.currentValue]),
    )
    const scheduledRegularContributionByAccount = resolveContributionByAccount(normalized, context, scheduledContributionForYear)
    // Annual-contribution charges stay on scheduled regular premiums only.
    // Premium-holiday repayments still count as paid regular premium for assurance bases,
    // but they are modeled separately from annual-contribution charge routing.
    const regularContributionByAccount = new Map(scheduledRegularContributionByAccount)
    const contributionByAccount = new Map(scheduledRegularContributionByAccount)
    const premiumHolidayRepaymentEvents = getPremiumHolidayRepayments(normalized, context.range)
    const repaymentContributionByAccount = getPremiumHolidayRepaymentContributionByAccount(normalized, premiumHolidayRepaymentEvents)
    const scheduledRegularPremiumPaidThisYear = Array.from(scheduledRegularContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    const regularPremiumPaidThisYear = scheduledRegularPremiumPaidThisYear
      + Array.from(repaymentContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
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
    const contributionForYear = Array.from(contributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    cumulativePremiums += contributionForYear
    const partialWithdrawalByAccount = getPartialWithdrawalsByAccount(normalized, context.range)
    const requestedScheduledPayoutByAccount = getScheduledPayoutsByAccount(normalized, policyYear)
    const distributionPayoutByAccount = getDistributionPayoutsByAccount(normalized, year, openBalances)
    const additionalChargeByAccount = computeAdditionalChargeByAccount(
      normalized,
      context,
      openBalances,
      regularContributionByAccount,
    )
    const eventChargeByAccount = computeEventChargeByAccount(normalized, context, premiumHolidayRepaymentEvents, openBalances)
    const bonusCreditByAccount = new Map<string, number>()
    const scheduledPayoutByAccount = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
    const baseWithdrawalByAccount = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))

    for (const account of input.accounts) {
      bonusCreditByAccount.set(
        account.id,
        computeBonusCredit(
          normalized,
          context,
          premiumHolidayRepaymentEvents,
          account.id,
          openBalances.get(account.id) ?? account.currentValue,
          scheduledRegularContributionByAccount.get(account.id) ?? 0,
          scheduledRegularPremiumPaidThisYear,
          input.currency,
        ),
      )
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
      const partialWithdrawalAmount = partialWithdrawalByAccount.get(account.id) ?? 0
      const requestedScheduledPayout = requestedScheduledPayoutByAccount.get(account.id) ?? 0
      const availableBeforeBaseWithdrawals = Math.max(
        0,
        (open - (baseGrossFee + extraCharges - bonusCredit)) * (1 + blendedNetReturn) + accountContribution,
      )
      const scheduledPayoutAmount = Math.min(
        requestedScheduledPayout,
        Math.max(availableBeforeBaseWithdrawals - partialWithdrawalAmount, 0),
      )
      const baseWithdrawalAmount = partialWithdrawalAmount + scheduledPayoutAmount
      const distributionPayoutAmount = distributionPayoutByAccount.get(account.id) ?? 0
      const withdrawalAmount = baseWithdrawalAmount + distributionPayoutAmount
      const closeBeforeAssurance = availableBeforeBaseWithdrawals - withdrawalAmount

      scheduledPayoutByAccount.set(account.id, scheduledPayoutAmount)
      baseWithdrawalByAccount.set(account.id, baseWithdrawalAmount)

      provisionalCloseByAccount.set(account.id, Math.max(0, closeBeforeAssurance))
    }

    const withdrawalByAccount = mergeAccountAmountMaps(baseWithdrawalByAccount, distributionPayoutByAccount)
    const annualWithdrawals = Array.from(withdrawalByAccount.values()).reduce((sum, value) => sum + value, 0)

    const assuranceChargeResult = computeAssuranceChargeByAccount(
      normalized,
      policyYear,
      year,
      context,
      openBalances,
      provisionalCloseByAccount,
      assuranceRegularPremiumBase,
      regularPremiumPaidThisYear,
      assuranceSupplementaryPremiumBase,
      supplementaryPremiumPaidThisYear,
      baseWithdrawalByAccount,
      assuranceSumAssured,
      assuranceWealthAssureValue,
      assuranceGrowthFrozen,
    )
    const assuranceChargeByAccount = assuranceChargeResult.charges
    assuranceSumAssured = assuranceChargeResult.nextSumAssured
    assuranceWealthAssureValue = assuranceChargeResult.nextWealthAssureValue
    assuranceGrowthFrozen = assuranceChargeResult.nextGrowthFrozen

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
      const close = Math.max(0, (open - netFee) * (1 + blendedNetReturn) + accountContribution - withdrawalAmount)

      cumulativeGrossFees += grossFee
      cumulativeBonuses += bonusCredit
      combinedValue += close

      if (account.subjectToEec) {
        eecCharge += close * eecRate
      }

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

    rows.push({
      year,
      policyYear,
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

    const assuranceWithdrawalsThisYear = sumWithdrawalsForAccounts(baseWithdrawalByAccount, assuranceRelevantAccountIds)
    assuranceRegularPremiumBase = Math.max(
      0,
      assuranceRegularPremiumBase + regularPremiumPaidThisYear - assuranceWithdrawalsThisYear,
    )
    assuranceSupplementaryPremiumBase = Math.max(
      0,
      assuranceSupplementaryPremiumBase + supplementaryPremiumPaidThisYear - (
        normalized.multiAccount.supplementaryPremiumAccountIds.length > 0
          ? sumWithdrawalsForAccounts(baseWithdrawalByAccount, normalized.multiAccount.supplementaryPremiumAccountIds)
          : sumWithdrawalsForAccounts(baseWithdrawalByAccount, assuranceRelevantAccountIds)
      ),
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
): IlpNpvAnalysis {
  assertBeforeMip(input)

  const optimizationYears = hasFiniteMip(input)
    ? getRemainingMipYears(input)
    : computeTotalProjectionYears(input)
  if (optimizationYears <= 0) {
    throw new Error(
      `Cannot compute NPV analysis: policy "${input.name}" has no remaining projection horizon.`,
    )
  }

  const eecRateNow = getMipBasis(input) === 'open-ended'
    ? 0
    : lookupEecRate(input.currentPolicyYear, input.eecTable)
  const totalCurrentValue = input.accounts.reduce((sum, account) => sum + account.currentValue, 0)
  const eecChargeNow = input.accounts
    .filter((account) => account.subjectToEec)
    .reduce((sum, account) => sum + account.currentValue * eecRateNow, 0)

  const surrenderNow = {
    eecRate: eecRateNow,
    eecCharge: eecChargeNow,
    npvFees: eecChargeNow,
    netSurrenderValue: totalCurrentValue - eecChargeNow,
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
): IlpSummaryMetrics {
  const mipEndRow = projection.rows[getMipEndProjectionIndex(input)]
  const eecRateNow = getMipBasis(input) === 'open-ended'
    ? 0
    : lookupEecRate(input.currentPolicyYear, input.eecTable)
  const totalCurrentValue = input.accounts.reduce((sum, account) => sum + account.currentValue, 0)
  const cancelNowPenalty = input.accounts
    .filter((account) => account.subjectToEec)
    .reduce((sum, account) => sum + account.currentValue * eecRateNow, 0)

  return {
    totalPremiumsPaid: mipEndRow.cumulativePremiums,
    totalFeesCharged: mipEndRow.cumulativeGrossFees,
    totalBonusesReceived: mipEndRow.cumulativeBonuses,
    netFeeDrag: mipEndRow.cumulativeGrossFees - mipEndRow.cumulativeBonuses,
    currentSurrenderValue: totalCurrentValue - cancelNowPenalty,
    cancelNowPenalty,
  }
}

export function analyzeIlpPolicy(input: IlpPolicyInput): IlpPolicyAnalysis {
  const projections: Record<ReturnScenario, IlpProjectionResult> = {
    low: projectIlpPolicy(input, 'low'),
    mid: projectIlpPolicy(input, 'mid'),
    high: projectIlpPolicy(input, 'high'),
  }
  const npvAnalysis = computeNpvAnalysis(input, projections.mid)
  const opportunityCost = computeOpportunityCost(input, projections.mid, npvAnalysis)
  const summary = computeSummaryMetrics(input, projections.mid)

  return {
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

  return [
    { metric: 'Insurer', unit: 'text', lowerIsBetter: null, values: valuesFor((analysis) => analysis.insurer || 'Unknown') },
    { metric: 'Projection Horizon', unit: 'years', lowerIsBetter: null, values: valuesFor((analysis) => analysis.projections.mid.rows.length) },
    { metric: 'Total Premiums Paid (to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.totalPremiumsPaid) },
    { metric: 'Total Fees Charged (gross, to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.totalFeesCharged) },
    { metric: 'Bonuses Received (to horizon)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.summary.totalBonusesReceived) },
    { metric: 'Net Fee Drag (to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.netFeeDrag) },
    {
      metric: 'Fee Drag % of Premiums',
      unit: 'percent',
      lowerIsBetter: true,
      values: valuesFor((analysis) => (
        analysis.summary.totalPremiumsPaid > CONTRIBUTION_TOLERANCE
          ? analysis.summary.netFeeDrag / analysis.summary.totalPremiumsPaid
          : 0
      )),
    },
    { metric: 'Cancel-Now Penalty', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.cancelNowPenalty) },
    { metric: 'Surrender Value Today', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.summary.currentSurrenderValue) },
    { metric: 'NPV Fees (Surrender Now)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.surrenderNow.npvFees) },
    { metric: 'Best Exit Year', unit: 'years', lowerIsBetter: null, values: valuesFor((analysis) => analysis.npvAnalysis.bestExitYear) },
    { metric: 'NPV Fees (Best Exit)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.bestExitNpvFees) },
    { metric: 'NPV Fees (Hold to horizon)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.holdToMip.totalNpvFees) },
    { metric: 'Final Value (horizon end, mid)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.npvAnalysis.holdToMip.finalValue) },
    { metric: 'Opportunity Cost (vs surrender now)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.opportunityCost.difference) },
  ]
}

export function analyzeAllPolicies(inputs: IlpPolicyInput[]): IlpFullAnalysis {
  const policies = inputs.map(analyzeIlpPolicy)
  const policyCurrencies = Object.fromEntries(inputs.map((policy) => [policy.id, policy.currency]))
  return {
    policies,
    comparison: buildComparisonTable(policies, policyCurrencies),
  }
}
