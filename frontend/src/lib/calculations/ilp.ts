import {
  HSBC_FLEXI_DEATH_TI_RATE_TABLE,
  PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE,
  PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE,
  PRUVANTAGE_PROSPER_DEATH_RATE_TABLE,
} from '@/lib/data/ilpAssuranceTables'
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
  multiplierSchedule: IlpPremiumBaseMultiplierTier[]
}

export interface IlpChargeRule {
  id: string
  label: string
  basis: 'account-value' | 'annual-contribution' | 'fixed-annual' | 'assurance-sum-at-risk' | 'premium-base-mip-multiplier'
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
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
  assuranceProfile?: IlpAssuranceProfile
  policyEvents?: IlpPolicyEvent[]
  accounts: IlpAccount[]
  mipLength: number
  postMipYears: number
  eecTable: number[]
  funds: IlpFund[]
  bonuses: IlpBonusRule[]
  chargeRules?: IlpChargeRule[]
  eventChargeRules?: IlpEventChargeRule[]
  catalogSource?: IlpCatalogSource
  catalogWarnings?: string[]
  discountRate: number
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

type IlpAssuranceFormulaFamily = 'prudential-prosper' | 'prudential-assure-ii' | 'hsbc-flexi'

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

interface IlpNormalizedMultiAccountRole {
  accountId: string
  receivesRegularPremium: boolean
  receivesSupplementaryPremium: boolean
  receivesRepayment: boolean
  isFallbackDeductionAccount: boolean
  isWithdrawalChargeScope: boolean
}

interface IlpNormalizedMultiAccountStructure {
  rolesByAccountId: Record<string, IlpNormalizedMultiAccountRole>
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
}

function assertBeforeMip(input: IlpPolicyInput) {
  if (input.currentPolicyYear >= input.mipLength) {
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
  const rolesByAccountId = Object.fromEntries(input.accounts.map((account) => {
    const role: IlpNormalizedMultiAccountRole = {
      accountId: account.id,
      receivesRegularPremium: regularPremiumAccountIds.includes(account.id),
      receivesSupplementaryPremium: supplementaryPremiumAccountIds.includes(account.id),
      receivesRepayment: repaymentAccountIds.includes(account.id),
      isFallbackDeductionAccount: fallbackDeductionOrderIds.includes(account.id),
      isWithdrawalChargeScope: withdrawalChargeScopeAccountIds.includes(account.id),
    }

    return [account.id, role]
  }))

  return {
    rolesByAccountId,
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

function buildNormalizedPolicyInput(input: IlpPolicyInput): IlpNormalizedPolicyInput {
  const policyEvents = input.policyEvents ?? []
  const contributionRoutesByPhase = {
    'during-icp': normalizeContributionRoutes(input, 'during-icp'),
    'after-icp': normalizeContributionRoutes(input, 'after-icp'),
    'after-mip': normalizeContributionRoutes(input, 'after-mip'),
    'top-up': normalizeContributionRoutes(input, 'top-up'),
  } satisfies Record<IlpContributionRule['phase'], IlpNormalizedContributionRoute[]>

  return {
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
  }
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
    isPostMip: policyYear > normalized.input.mipLength,
    range,
    premiumHolidayMonths,
    payableMonths: Math.max(0, 12 - premiumHolidayMonths),
  }
}

function getPolicyYearForMonth(policyMonth: number): number {
  return Math.floor((policyMonth - 1) / 12) + 1
}

function getAssuranceStateEventsForYear(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
): IlpPolicyEvent[] {
  const range = buildCashflowYearContext(normalized, projectionYear).range

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
  projectionYear: number,
): Map<string, number> {
  const withdrawals = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const range = buildCashflowYearContext(normalized, projectionYear).range

  for (const event of normalized.events.partialWithdrawals) {
    if (!event.accountId || event.amount == null || event.amount <= 0) continue
    if (event.startPolicyMonth < range.startPolicyMonth || event.startPolicyMonth > range.endPolicyMonth) continue

    withdrawals.set(event.accountId, (withdrawals.get(event.accountId) ?? 0) + event.amount)
  }

  return withdrawals
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

function getRegularPremiumReductionForYear(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
): number {
  const range = buildCashflowYearContext(normalized, projectionYear).range
  const baseAnnualPremium = normalized.input.monthlyContribution * 12
  let totalReduction = 0

  for (let policyMonth = range.startPolicyMonth; policyMonth <= range.endPolicyMonth; policyMonth += 1) {
    totalReduction += (baseAnnualPremium - getScheduledAnnualPremiumAtMonth(normalized, policyMonth)) / 12
  }

  return totalReduction
}

function getPremiumHolidayRepayments(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
): IlpSyntheticEvent[] {
  const range = buildCashflowYearContext(normalized, projectionYear).range

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
  const multiplier = formula === 'prudential-prosper-accidental-death' ? 1.05 : 1.01
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
          Math.max(endOfYearRegularPremiumBase * 1.03, nextSumAssured + (regularPremiumBaseAtStartOfYear * 0.03)),
          endOfYearRegularPremiumBase * 1.6,
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
  const assuranceStateEvents = getAssuranceStateEventsForYear(normalized, projectionYear)

  for (const { rule, family, appliesTo, appliesToIds, fallbackAppliesTo } of normalized.assurance.rules) {
    const isPostMip = policyYear > input.mipLength
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

function resolveBonusRateFromBonus(
  bonus: Pick<IlpBonusRule, 'rate' | 'tieredRates'>,
  annualContribution: number,
  currency: IlpPolicyInput['currency'],
  accountValue?: number,
): number {
  if (bonus.tieredRates && bonus.tieredRates.length > 0) {
    const matchedTier = bonus.tieredRates.find((tier) => {
      if (tier.currency !== currency) return false
      const aboveMin = tier.minAnnualPremium == null || annualContribution >= tier.minAnnualPremium
      const belowMax = tier.maxAnnualPremium == null || annualContribution <= tier.maxAnnualPremium
      const aboveAccountMin = tier.minAccountValue == null || (accountValue ?? 0) >= tier.minAccountValue
      const belowAccountMax = tier.maxAccountValue == null || (accountValue ?? 0) <= tier.maxAccountValue
      return aboveMin && belowMax && aboveAccountMin && belowAccountMax
    })
    if (matchedTier) {
      return matchedTier.rate
    }
  }

  return bonus.rate
}

function resolveNormalizedBonusRate(
  normalizedBonus: IlpNormalizedBonusRule,
  annualContribution: number,
  currency: IlpPolicyInput['currency'],
  accountValue?: number,
): number {
  const { bonus, tierBasis } = normalizedBonus

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
  const currentRate = resolveBonusRateFromBonus(startupBonus, currentAnnualPremium, input.currency)
  const reducedRate = resolveBonusRateFromBonus(startupBonus, reducedAnnualPremium, input.currency)
  const currentStartupBonusAmount = currentAnnualPremium * currentRate
  const reducedStartupBonusAmount = reducedAnnualPremium * reducedRate
  const monthsPassedSinceInception = Math.max(event.startPolicyMonth - 1, 0)
  const committedMipMonths = input.mipLength * 12
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
  projectionYear: number,
): number {
  if (normalizedBonus.bonus.suspensionRules == null || normalizedBonus.bonus.suspensionRules.length === 0) {
    return 1
  }

  const range = buildCashflowYearContext(normalized, projectionYear).range
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

function computeRestoredBonusCredit(
  normalizedBonus: IlpNormalizedBonusRule,
  accountId: string,
  accountOpenBalance: number,
  annualContribution: number,
  currency: IlpPolicyInput['currency'],
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
): number {
  if (normalizedBonus.bonus.restorationRules == null || normalizedBonus.bonus.restorationRules.length === 0) {
    return 0
  }

  if (!normalizedBonus.targetAccountIds.includes(accountId)) {
    return 0
  }

  const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
  const repaymentEvents = getPremiumHolidayRepayments(normalized, projectionYear)

  return (normalizedBonus.bonus.restorationRules ?? []).reduce((sum, rule) => {
    if (rule.trigger !== 'premium-holiday-repayment') {
      return sum
    }

    return sum + repaymentEvents.reduce((eventSum, event) => {
      const effectiveRate = resolveNormalizedBonusRate(
        normalizedBonus,
        annualContribution + event.amount,
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
  accountId: string,
  policyYear: number,
  accountOpenBalance: number,
  accountContribution: number,
  annualContribution: number,
  currency: IlpPolicyInput['currency'],
  projectionYear: number,
): number {
  let total = 0

  for (const normalizedBonus of normalized.bonuses.rules) {
    const bonus = normalizedBonus.bonus
    if (!normalizedBonus.targetAccountIds.includes(accountId)) continue
    if (policyYear < bonus.startPolicyYear) continue
    if (bonus.endPolicyYear != null && policyYear > bonus.endPolicyYear) continue

    const splitCount = Math.max(normalizedBonus.targetAccountIds.length, 1)
    const effectiveRate = resolveNormalizedBonusRate(normalizedBonus, annualContribution, currency, accountOpenBalance)
    const eligibilityFraction = getBonusEligibilityFraction(normalizedBonus, normalized, projectionYear)

    switch (bonus.mode) {
      case 'annual-rate':
        total += accountOpenBalance * effectiveRate * eligibilityFraction
        break
      case 'premium-allocation':
        total += (
          (normalizedBonus.targetAccountIds.length > 0 ? accountContribution : (annualContribution / splitCount))
          * effectiveRate
          * eligibilityFraction
        )
        break
      case 'one-time':
        if (policyYear === bonus.startPolicyYear) {
          total += bonus.amount / splitCount
        }
        break
    }

    total += computeRestoredBonusCredit(
      normalizedBonus,
      accountId,
      accountOpenBalance,
      annualContribution,
      currency,
      normalized,
      projectionYear,
    )
  }

  return total
}

function getRemainingMipYears(input: IlpPolicyInput): number {
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
  policyYear: number,
): IlpNormalizedRecurringChargeRule[] {
  const { input } = normalized
  const isPostMip = policyYear > input.mipLength

  return (input.chargeRules ?? [])
    .filter((rule) => {
      const isActive = rule.activeWindow === 'policy-term'
        || (rule.activeWindow === 'during-mip' && !isPostMip)
        || (rule.activeWindow === 'after-mip' && isPostMip)

      return isActive
        && (rule.startPolicyYear == null || policyYear >= rule.startPolicyYear)
        && (rule.endPolicyYear == null || policyYear <= rule.endPolicyYear)
    })
    .map((rule) => ({
      rule,
      appliesTo: resolveAccountsInDisplayOrder(input, rule.appliesTo),
      fallbackAppliesTo: resolveFallbackAccounts(normalized, rule.fallbackAppliesTo),
    }))
    .filter((normalizedRule) => normalizedRule.appliesTo.length > 0)
}

function normalizeEventChargeRules(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
): IlpNormalizedEventChargeRule[] {
  const context = buildCashflowYearContext(normalized, projectionYear)
  const isPostMip = context.policyYear > normalized.input.mipLength

  return (normalized.input.eventChargeRules ?? [])
    .filter((rule) => {
      const activeWindow = rule.activeWindow ?? 'policy-term'
      return activeWindow === 'policy-term'
        || (activeWindow === 'during-mip' && !isPostMip)
        || (activeWindow === 'after-mip' && isPostMip)
    })
    .map((rule) => {
      const events = rule.trigger === 'premium-holiday-repayment'
        ? getPremiumHolidayRepayments(normalized, projectionYear)
        : rule.trigger === 'recurring-single-premium'
          ? normalized.events.recurringSinglePremiums.filter((event) => (
              overlapMonths(
                context.range.startPolicyMonth,
                context.range.endPolicyMonth,
                event.startPolicyMonth,
                event.startPolicyMonth + event.durationMonths - 1,
              ) > 0
            ))
          : rule.trigger === 'regular-premium-reduction' && rule.basis === 'annual-reduction-with-active-months'
            ? normalized.events.regularPremiumReductions.filter((event) => (
                overlapMonths(
                  context.range.startPolicyMonth,
                  context.range.endPolicyMonth,
                  event.startPolicyMonth,
                  Number.MAX_SAFE_INTEGER,
                ) > 0
              )).slice(0, 1)
            : rule.trigger === 'premium-holiday'
              ? normalized.events.premiumHolidays.filter((event) => (
                  overlapMonths(
                    context.range.startPolicyMonth,
                    context.range.endPolicyMonth,
                    event.startPolicyMonth,
                    event.startPolicyMonth + event.durationMonths - 1,
                  ) > 0
                ))
              : [
                ...normalized.events.partialWithdrawals,
                ...normalized.events.topUps,
                ...normalized.events.regularPremiumReductions,
                ...normalized.events.regularPremiumIncreases,
                ...normalized.events.assuranceStateEvents,
              ].filter((event) => (
                  event.type === rule.trigger
                  && event.startPolicyMonth >= context.range.startPolicyMonth
                  && event.startPolicyMonth <= context.range.endPolicyMonth
                ))

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
  projectionYear: number,
): Record<'during-icp' | 'after-icp' | 'after-mip', number> {
  const icpMonths = Math.max(normalized.input.icpMonths ?? 0, 0)
  const context = buildCashflowYearContext(normalized, projectionYear)
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
  projectionYear: number,
  contributionForYear: number,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  if (contributionForYear <= 0) {
    return contributionByAccount
  }

  const phaseMonths = getContributionPhaseMonths(normalized, projectionYear)
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
  projectionYear: number,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const repaymentEvents = getPremiumHolidayRepayments(normalized, projectionYear)

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
  projectionYear: number,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const routes = resolveSupplementaryContributionRoutes(normalized)
  const range = buildCashflowYearContext(normalized, projectionYear).range

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
  projectionYear: number,
): Map<string, number> {
  const contributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const routes = resolveSupplementaryContributionRoutes(normalized)
  const range = buildCashflowYearContext(normalized, projectionYear).range

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
  policyYear: number,
): number {
  const matchedTier = rule.rateSchedule?.find((tier) => (
    policyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || policyYear <= tier.endPolicyYear)
  ))

  return matchedTier?.rate ?? rule.rate
}

function resolveChargeAmount(
  rule: IlpChargeRule,
  policyYear: number,
): number {
  const matchedTier = rule.amountSchedule?.find((tier) => (
    policyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || policyYear <= tier.endPolicyYear)
  ))

  return matchedTier?.amount ?? rule.amount
}

function resolveChargeRate(
  rule: IlpChargeRule,
  policyYear: number,
): number {
  const matchedTier = rule.rateSchedule?.find((tier) => (
    policyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || policyYear <= tier.endPolicyYear)
  ))

  return matchedTier?.rate ?? rule.rate
}

function resolvePremiumBaseMultiplier(
  rule: IlpChargeRule,
  policyYear: number,
): number {
  const matchedTier = rule.premiumBaseConfig?.multiplierSchedule.find((tier) => (
    policyYear >= tier.startPolicyYear
    && (tier.endPolicyYear == null || policyYear <= tier.endPolicyYear)
  ))

  if (!matchedTier) {
    return 0
  }

  return matchedTier.mode === 'policy-year'
    ? policyYear
    : Math.max(0, matchedTier.multiplier ?? 0)
}

function computePremiumBaseMultiplierCharge(
  normalized: IlpNormalizedPolicyInput,
  projectionYear: number,
  policyYear: number,
  rule: IlpChargeRule,
): number {
  if (!rule.premiumBaseConfig) {
    return 0
  }

  const range = buildCashflowYearContext(normalized, projectionYear).range
  const committedAnnualPremium = normalized.input.monthlyContribution * 12
  const multiplier = resolvePremiumBaseMultiplier(rule, policyYear)

  if (multiplier <= 0) {
    return 0
  }

  let total = 0
  for (let policyMonth = range.startPolicyMonth; policyMonth <= range.endPolicyMonth; policyMonth += 1) {
    const prevailingAnnualPremium = getScheduledAnnualPremiumAtMonth(normalized, policyMonth)
    const premiumBase = rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing
      ? Math.max(committedAnnualPremium, prevailingAnnualPremium)
      : prevailingAnnualPremium

    total += (rule.rate / 12) * premiumBase * multiplier
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
    const monthlyPremium = useCommittedPremium
      ? normalized.input.monthlyContribution
      : getScheduledMonthlyPremiumAtMonth(normalized, policyMonth)
    total += monthlyPremium * resolveEventChargeRate(rule, policyYear)
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
  projectionYear: number,
  policyYear: number,
  openBalances: Map<string, number>,
  contributionByAccount: Map<string, number>,
): Map<string, number> {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const chargeRules = normalizeRecurringChargeRules(normalized, policyYear)

  for (const { rule, appliesTo, fallbackAppliesTo } of chargeRules) {

    switch (rule.basis) {
      case 'account-value':
        for (const account of appliesTo) {
          const open = openBalances.get(account.id) ?? 0
          charges.set(account.id, (charges.get(account.id) ?? 0) + (open * resolveChargeRate(rule, policyYear)))
        }
        break

      case 'annual-contribution':
        for (const account of appliesTo) {
          const routedContribution = contributionByAccount.get(account.id) ?? 0
          charges.set(account.id, (charges.get(account.id) ?? 0) + (routedContribution * resolveChargeRate(rule, policyYear)))
        }
        break

      case 'fixed-annual': {
        const allocations = applyChargeAllocationsWithFallback(
          resolveChargeAmount(rule, policyYear),
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
        const totalCharge = computePremiumBaseMultiplierCharge(normalized, projectionYear, policyYear, rule)
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
  projectionYear: number,
  openBalances: Map<string, number>,
): Map<string, number> {
  const { input } = normalized
  const charges = new Map<string, number>(input.accounts.map((account) => [account.id, 0]))
  const context = buildCashflowYearContext(normalized, projectionYear)
  const eventChargeRules = input.eventChargeRules ?? []
  const applications: Array<{
    rule: IlpEventChargeRule
    totalCharge: number
    allocations: Map<string, number>
  }> = []

  for (const { rule, events } of normalizeEventChargeRules(normalized, projectionYear)) {
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
      const effectiveRuleRate = resolveEventChargeRate(rule, getPolicyYearForMonth(event.startPolicyMonth))
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
          const committedMipMonths = input.mipLength * 12
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
          totalCharge = computePremiumHolidayChargeForEvent(normalized, event as IlpPolicyEvent, rule, {
            start: context.range.startPolicyMonth,
            end: context.range.endPolicyMonth,
          }) + rule.amount
          break

        case 'committed-annual-premium-with-overlap-months':
          totalCharge = computePremiumHolidayChargeForEvent(normalized, event as IlpPolicyEvent, rule, {
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

          const sourceCharge = computePremiumHolidayChargeForEvent(normalized, sourceEvent, sourceChargeRule)
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
            totalCharge += monthShortfall * resolveEventChargeRate(rule, getPolicyYearForMonth(policyMonth))
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
  return getRemainingMipYears(input) + input.postMipYears
}

export function getMipEndProjectionIndex(input: IlpPolicyInput): number {
  const remainingMipYears = getRemainingMipYears(input)
  if (remainingMipYears <= 0) {
    throw new Error(`Cannot resolve MIP end row for policy "${input.name}" because it is already mature.`)
  }
  return remainingMipYears - 1
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
    const isPostMip = policyYear > input.mipLength
    const scheduledContributionForYear = (isPostMip && !hasAfterMipContributionRules(input))
      ? 0
      : Math.max(0, annualContribution - getRegularPremiumReductionForYear(normalized, year))
    const eecRate = isPostMip ? 0 : lookupEecRate(policyYear, input.eecTable)
    const openBalances = new Map(
      input.accounts.map((account) => [account.id, previousClose.get(account.id) ?? account.currentValue]),
    )
    const contributionByAccount = resolveContributionByAccount(normalized, year, scheduledContributionForYear)
    const repaymentContributionByAccount = getPremiumHolidayRepaymentContributionByAccount(normalized, year)
    const regularPremiumPaidThisYear = Array.from(contributionByAccount.values()).reduce((sum, value) => sum + value, 0)
      + Array.from(repaymentContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    for (const [accountId, amount] of repaymentContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const topUpContributionByAccount = getTopUpContributionByAccount(normalized, year)
    for (const [accountId, amount] of topUpContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const recurringSinglePremiumContributionByAccount = getRecurringSinglePremiumContributionByAccount(normalized, year)
    for (const [accountId, amount] of recurringSinglePremiumContributionByAccount.entries()) {
      contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
    }
    const supplementaryPremiumPaidThisYear = Array.from(topUpContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
      + Array.from(recurringSinglePremiumContributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    const contributionForYear = Array.from(contributionByAccount.values()).reduce((sum, value) => sum + value, 0)
    cumulativePremiums += contributionForYear
    const withdrawalByAccount = getPartialWithdrawalsByAccount(normalized, year)
    const annualWithdrawals = Array.from(withdrawalByAccount.values()).reduce((sum, value) => sum + value, 0)
    const additionalChargeByAccount = computeAdditionalChargeByAccount(
      normalized,
      year,
      policyYear,
      openBalances,
      contributionByAccount,
    )
    const eventChargeByAccount = computeEventChargeByAccount(normalized, year, openBalances)
    const provisionalCloseByAccount = new Map<string, number>()

    for (const account of input.accounts) {
      const open = openBalances.get(account.id) ?? account.currentValue
      const activeFeeRate = isPostMip && account.postMipFeeRate != null
        ? account.postMipFeeRate
        : account.feeRate
      const baseGrossFee = open * activeFeeRate
      const extraCharges = (additionalChargeByAccount.get(account.id) ?? 0) + (eventChargeByAccount.get(account.id) ?? 0)
      const accountContribution = contributionByAccount.get(account.id) ?? 0
      const bonusCredit = computeBonusCredit(
        normalized,
        account.id,
        policyYear,
        open,
        accountContribution,
        contributionForYear,
        input.currency,
        year,
      )
      const withdrawalAmount = withdrawalByAccount.get(account.id) ?? 0
      const closeBeforeAssurance = (open - (baseGrossFee + extraCharges - bonusCredit)) * (1 + blendedNetReturn)
        + accountContribution
        - withdrawalAmount

      provisionalCloseByAccount.set(account.id, closeBeforeAssurance)
    }

    const assuranceChargeResult = computeAssuranceChargeByAccount(
      normalized,
      policyYear,
      year,
      openBalances,
      provisionalCloseByAccount,
      assuranceRegularPremiumBase,
      regularPremiumPaidThisYear,
      assuranceSupplementaryPremiumBase,
      supplementaryPremiumPaidThisYear,
      withdrawalByAccount,
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
      const bonusCredit = computeBonusCredit(
        normalized,
        account.id,
        policyYear,
        open,
        accountContribution,
        contributionForYear,
        input.currency,
        year,
      )
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

    const assuranceWithdrawalsThisYear = sumWithdrawalsForAccounts(withdrawalByAccount, assuranceRelevantAccountIds)
    assuranceRegularPremiumBase = Math.max(
      0,
      assuranceRegularPremiumBase + regularPremiumPaidThisYear - assuranceWithdrawalsThisYear,
    )
    assuranceSupplementaryPremiumBase = Math.max(
      0,
      assuranceSupplementaryPremiumBase + supplementaryPremiumPaidThisYear - (
        normalized.multiAccount.supplementaryPremiumAccountIds.length > 0
          ? sumWithdrawalsForAccounts(withdrawalByAccount, normalized.multiAccount.supplementaryPremiumAccountIds)
          : sumWithdrawalsForAccounts(withdrawalByAccount, assuranceRelevantAccountIds)
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

  const remainingMipYears = getRemainingMipYears(input)
  if (remainingMipYears <= 0) {
    throw new Error(
      `Cannot compute NPV analysis: policy "${input.name}" is already at or past MIP.`,
    )
  }

  const eecRateNow = lookupEecRate(input.currentPolicyYear, input.eecTable)
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

  const scanLimit = Math.min(remainingMipYears, futureExitOptions.length)
  if (scanLimit <= 0) {
    throw new Error(`Cannot compute best exit year for policy "${input.name}" because it has no pre-MIP rows.`)
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
  const remainingMipYears = getRemainingMipYears(input)
  const horizonRow = projection.rows[getMipEndProjectionIndex(input)]
  const ilpValueAtHorizon = horizonRow.combinedValue
  const growthRate = input.alternativeReturn

  let alternativePortfolioValue = npv.surrenderNow.netSurrenderValue * Math.pow(1 + growthRate, remainingMipYears)
  const mipEndIndex = getMipEndProjectionIndex(input)
  const contributionRows = projection.rows.slice(0, mipEndIndex + 1)

  for (const row of contributionRows) {
    alternativePortfolioValue += row.annualContribution * Math.pow(1 + growthRate, remainingMipYears - row.year)
  }

  const bestExit = npv.futureExitOptions.find((option) => option.exitYear === npv.bestExitYear)
  if (!bestExit) {
    throw new Error(`Best exit year ${npv.bestExitYear} could not be found for policy "${input.name}".`)
  }

  const yearsAfterBestExit = Math.max(remainingMipYears - bestExit.exitYear, 0)
  let alternativeAtBestExit = bestExit.netSurrenderValue * Math.pow(1 + growthRate, yearsAfterBestExit)
  for (const row of contributionRows.filter((candidate) => candidate.year > bestExit.exitYear)) {
    alternativeAtBestExit += row.annualContribution * Math.pow(1 + growthRate, remainingMipYears - row.year)
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
  const eecRateNow = lookupEecRate(input.currentPolicyYear, input.eecTable)
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
    { metric: 'Total Premiums Paid (to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.totalPremiumsPaid) },
    { metric: 'Total Fees Charged (gross, to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.totalFeesCharged) },
    { metric: 'Bonuses Received (to MIP)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.summary.totalBonusesReceived) },
    { metric: 'Net Fee Drag (to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.netFeeDrag) },
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
    { metric: 'NPV Fees (Hold to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.holdToMip.totalNpvFees) },
    { metric: 'Final Value (MIP end, mid)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.npvAnalysis.holdToMip.finalValue) },
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
