## ilp.ts excerpt: basis + exit basis helpers
}

export interface IlpCumulativePaidPremiumChargeConfig {
  annualisedPremiumAtIssue?: number
  countRateSchedule?: IlpCumulativePaidPremiumRateTier[]
}

export interface IlpChargeRule {
  id: string
  label: string
  basis: 'account-value' | 'annual-contribution' | 'fixed-annual' | 'assurance-sum-at-risk' | 'premium-base-mip-multiplier' | 'cumulative-paid-regular-premium' | 'initial-single-premium' | 'initial-single-premium-base'
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
  initialSinglePremium?: number
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
  exitChargeBasis?: 'account-value' | 'initial-single-premium-base'
  funds: IlpFund[]
  bonuses: IlpBonusRule[]
  chargeRules?: IlpChargeRule[]
  eventChargeRules?: IlpEventChargeRule[]
  catalogSource?: IlpCatalogSource

## ilp.ts excerpt: inception state + exit charge helpers
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

function computeCurrentValueSnapshot(
  input: IlpPolicyInput,
  initialSinglePremiumState: IlpInitialSinglePremiumState = computeInitialSinglePremiumState(buildNormalizedPolicyInput(input)),
): {
  initialSinglePremiumState: IlpInitialSinglePremiumState
  eecRateNow: number
  totalCurrentValue: number
  cancelNowPenalty: number
} {
  const eecRateNow = resolveCurrentExitChargeRate(input)
  const currentValueByAccount = new Map(
    input.accounts.map((account) => [account.id, getEffectiveCurrentValue(account, initialSinglePremiumState)]),
  )
  const totalCurrentValue = Array.from(currentValueByAccount.values()).reduce((sum, value) => sum + value, 0)
  const cancelNowPenalty = computeExitChargeAmount(input, eecRateNow, currentValueByAccount)

  return {
    initialSinglePremiumState,
    eecRateNow,
    totalCurrentValue,
    cancelNowPenalty,
  }
}

## ilp.ts excerpt: recurring charge switch
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

      case 'initial-single-premium-base': {
        const totalCharge = getOriginalInitialSinglePremiumBase(input) * resolveChargeRate(rule, context)
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

## ilp.ts excerpt: projection loop exit-charge usage
export function projectIlpPolicy(
  input: IlpPolicyInput,
  scenario: ReturnScenario,
): IlpProjectionResult {
  assertBeforeMip(input)
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
    const eecRate = getExitChargeBasis(input) === 'initial-single-premium-base'
      ? lookupEecRate(eecReferenceYear, input.eecTable)
      : (isPostMip ? 0 : lookupEecRate(eecReferenceYear, input.eecTable))
    const openBalances = new Map(
      input.accounts.map((account) => [account.id, previousClose.get(account.id) ?? getEffectiveCurrentValue(account, initialSinglePremiumState)]),
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
