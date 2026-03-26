import type { IlpChargeRule, IlpPolicyInput } from '@/lib/calculations/ilp'
import { DEFAULT_ALTERNATIVE_RETURN, DEFAULT_DISCOUNT_RATE, DEFAULT_INFLATION_RATE } from '@/lib/data/ilpDefaults'
import { formatCatalogVariantLabel } from '@/lib/ilp-catalog/labels'
import type { IlpCatalogManifest, IlpCatalogProduct, IlpTemplateAccount, IlpTemplateBonus, IlpTemplateFeeRule, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { ilpPolicySeedSchema, type IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'

type IlpResolvedVitalityStatus = NonNullable<IlpPolicyInput['vitalityStatus']>

const DEFAULT_TEMPLATE_FUND: IlpPolicyInput['funds'][number] = {
  name: 'Default ILP Fund',
  allocation: 1,
  ocf: 0.015,
  grossReturnLow: 0.06,
  grossReturnMid: 0.08,
  grossReturnHigh: 0.1,
}

function usesInitialSinglePremiumBase(variant: IlpTemplateVariant): boolean {
  return variant.feeRules.some((rule) => (
    rule.basis === 'initial-single-premium'
    || rule.basis === 'initial-single-premium-base'
  )) || variant.exitChargeBasis === 'initial-single-premium-base'
}

function usesInitialSinglePremiumEventBase(variant: IlpTemplateVariant): boolean {
  return variant.eventChargeRules.some((rule) => (
    rule.freeEventMaxAmountBasis === 'initial-single-premium'
    || rule.freeAmountPoolBasis === 'initial-single-premium'
  ))
}

function usesOriginalSinglePremiumBase(variant: IlpTemplateVariant): boolean {
  return variant.feeRules.some((rule) => rule.basis === 'initial-single-premium-base')
    || variant.exitChargeBasis === 'initial-single-premium-base'
}

function supportsSeededRecurringContributionRouting(variant: IlpTemplateVariant): boolean {
  const recurringPhases = new Set(['during-icp', 'after-icp', 'after-mip'])
  const hasRecurringContributionRules = variant.accounts.some((account) => (
    account.contributionRules.some((rule) => recurringPhases.has(rule.phase))
  ))
  if (!hasRecurringContributionRules) return true

  return variant.accounts.some((account) => (
    account.contributionRules.some((rule) => rule.phase === 'after-icp')
  ))
}

function seedsInitialSinglePremiumRouting(variant: IlpTemplateVariant): boolean {
  return usesInitialSinglePremiumBase(variant)
    || usesInitialSinglePremiumEventBase(variant)
    || variant.feeRules.some((rule) => (
    !usesInitialSinglePremiumBase(variant)
    && rule.basis === 'annual-contribution'
    && rule.id === 'single-premium-charge'
    && !supportsSeededRecurringContributionRouting(variant)
    ))
}

function deriveSeedMonthlyContribution(product: IlpCatalogProduct, variant: IlpTemplateVariant): number {
  if (!supportsSeededRecurringContributionRouting(variant)) {
    return 0
  }

  if (seedsInitialSinglePremiumRouting(variant)) {
    return 0
  }

  return product.metadataOnlyBehaviors.some((behavior) => (
    behavior.endsWith('single-premium-principal-tracking')
    && !behavior.endsWith('recurrent-single-premium-principal-tracking')
  ))
    ? 0
    : 350
}

function deriveSeedPostMipYears(variant: IlpTemplateVariant): number {
  return variant.mipBasis === 'open-ended' ? 20 : 10
}

function sameRate(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return false
  return Math.abs(left - right) < 0.000001
}

function formatCurrencyAmount(currency: string, amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatExplicitCurrencyAmount(currency: string, amount: number): string {
  const formattedAmount = new Intl.NumberFormat('en-SG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  if (currency === 'SGD') return `S$${formattedAmount}`
  if (currency === 'USD') return `US$${formattedAmount}`
  return formatCurrencyAmount(currency, amount)
}

function deriveAccountFeeRate(account: IlpTemplateAccount, feeRules: IlpTemplateFeeRule[]): number {
  if (account.feeRate != null) {
    return account.feeRate
  }

  const matchingRule = feeRules.find((rule) => (
    rule.basis === 'account-value'
    && rule.rate != null
    && (rule.rateSchedule?.length ?? 0) === 0
    && (rule.amountSchedule?.length ?? 0) === 0
    && rule.startPolicyYear == null
    && rule.endPolicyYear == null
    && rule.appliesTo.length === 1
    && rule.appliesTo[0] === account.id
  ))
  return matchingRule?.rate ?? 0
}

function isCoveredByAccountFee(rule: IlpTemplateFeeRule, accounts: IlpTemplateAccount[]): boolean {
  if (rule.basis !== 'account-value') return false
  if (rule.rate == null || rule.appliesTo.length !== 1) return false
  if (rule.startPolicyYear != null || rule.endPolicyYear != null) return false

  const account = accounts.find((candidate) => candidate.id === rule.appliesTo[0])
  if (!account) return false

  if (rule.activeWindow === 'during-mip') {
    return sameRate(account.feeRate, rule.rate)
  }

  if (rule.activeWindow === 'after-mip') {
    return sameRate(account.postMipFeeRate, rule.rate)
  }

  return sameRate(account.feeRate, rule.rate) && sameRate(account.postMipFeeRate ?? account.feeRate, rule.rate)
}

function mapFeeRuleBasis(
  basis: NonNullable<IlpTemplateFeeRule['basis']>,
): IlpChargeRule['basis'] {
  switch (basis) {
    case 'assurance-sum-at-risk':
    case 'insured-amount-at-issue':
    case 'premium-base-mip-multiplier':
    case 'premium-base-mip-multiplier-capped-account-value':
    case 'cumulative-paid-regular-premium':
    case 'initial-single-premium':
    case 'initial-single-premium-base':
    case 'fixed-annual':
    case 'annual-contribution':
    case 'account-value':
      return basis
    default:
      return 'account-value'
  }
}

function shouldSeedAsInitialSinglePremiumCharge(
  variant: IlpTemplateVariant,
  rule: IlpTemplateFeeRule,
): boolean {
  return !usesInitialSinglePremiumBase(variant)
    && rule.basis === 'annual-contribution'
    && rule.id === 'single-premium-charge'
    && !supportsSeededRecurringContributionRouting(variant)
}

function mapFeeRulesToChargeRules(variant: IlpTemplateVariant): IlpChargeRule[] {
  return variant.feeRules
    .filter((rule) => (
      rule.basis === 'assurance-sum-at-risk'
      || rule.rate != null
      || rule.amount != null
      || (rule.amountSchedule?.length ?? 0) > 0
      || (rule.rateSchedule?.length ?? 0) > 0
    ))
    .filter((rule) => !isCoveredByAccountFee(rule, variant.accounts))
    .map((rule) => {
      if (rule.basis == null) {
        throw new Error(`Fee rule "${rule.id}" is missing a basis`)
      }

      const isAssurance = rule.basis === 'assurance-sum-at-risk'
      const isFixedAnnual = rule.basis === 'fixed-annual'
      const isInitialSinglePremium = rule.basis === 'initial-single-premium'
        || rule.basis === 'initial-single-premium-base'
        || shouldSeedAsInitialSinglePremiumCharge(variant, rule)

      return {
        id: rule.id,
        label: rule.label,
        basis: shouldSeedAsInitialSinglePremiumCharge(variant, rule)
          ? 'initial-single-premium'
          : mapFeeRuleBasis(rule.basis),
        activeWindow: rule.activeWindow,
        yearBasis: rule.yearBasis,
        requiresPremiumsPaidUpToDate: rule.requiresPremiumsPaidUpToDate,
        suspensionRules: rule.suspensionRules?.map((suspensionRule) => ({ ...suspensionRule })),
        startPolicyYear: rule.startPolicyYear,
        endPolicyYear: rule.endPolicyYear,
        appliesTo: [...rule.appliesTo],
        assuranceValueAppliesTo: rule.assuranceValueAppliesTo ? [...rule.assuranceValueAppliesTo] : undefined,
        fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
        rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
        amountSchedule: rule.amountSchedule?.map((tier) => ({ ...tier })),
        rate: isFixedAnnual || isAssurance ? 0 : (rule.rate ?? 0),
        amount: isAssurance ? 0 : (rule.amount ?? 0),
        issueAgeRateTiers: rule.issueAgeRateTiers?.map((tier) => ({ ...tier })),
        assuranceConfig: rule.assuranceConfig
          ? {
              ...rule.assuranceConfig,
              accrual: rule.assuranceConfig.accrual ? { ...rule.assuranceConfig.accrual } : undefined,
              tokioProtectionState: rule.assuranceConfig.tokioProtectionState
                ? {
                    ...rule.assuranceConfig.tokioProtectionState,
                    trackedValueAccountIds: [...rule.assuranceConfig.tokioProtectionState.trackedValueAccountIds],
                    withdrawalReductionAccountIds: [...rule.assuranceConfig.tokioProtectionState.withdrawalReductionAccountIds],
                  }
                : undefined,
            }
          : undefined,
        premiumBaseConfig: rule.premiumBaseConfig
            ? {
              useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing,
              capRate: rule.premiumBaseConfig.capRate,
              multiplierYearBasis: rule.premiumBaseConfig.multiplierYearBasis,
              multiplierSchedule: rule.premiumBaseConfig.multiplierSchedule.map((tier) => ({ ...tier })),
            }
          : undefined,
        cumulativePaidPremiumConfig: rule.cumulativePaidPremiumConfig
          ? {
              annualisedPremiumAtIssue: rule.cumulativePaidPremiumConfig.annualisedPremiumAtIssue,
              countRateSchedule: rule.cumulativePaidPremiumConfig.countRateSchedule?.map((tier) => ({ ...tier })),
            }
          : undefined,
        requiresManualInput: rule.requiresManualInput,
        allocation: isFixedAnnual || isAssurance || isInitialSinglePremium ? 'pro-rata-by-value' : 'equal-split',
        sourceRefs: rule.sourceRefs?.map((ref) => ({ ...ref })),
        notes: rule.notes ? [...rule.notes] : undefined,
      }
    })
}

function mapEventChargeRules(variant: IlpTemplateVariant): NonNullable<IlpPolicyInput['eventChargeRules']> {
  return variant.eventChargeRules
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      trigger: rule.trigger,
      basis: rule.basis,
      activeWindow: rule.activeWindow,
      yearBasis: rule.yearBasis,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      manualWaiverMode: rule.manualWaiverMode,
      manualWaiverGrantGroup: rule.manualWaiverGrantGroup,
      manualWaiverMaxGrantCount: rule.manualWaiverMaxGrantCount,
      manualWaiverMaxOverlapMonths: rule.manualWaiverMaxOverlapMonths,
      freeLifetimeMonths: rule.freeLifetimeMonths,
      freeLifetimeMonthsStartPolicyYear: rule.freeLifetimeMonthsStartPolicyYear,
      freeLifetimeMonthsSchedule: rule.freeLifetimeMonthsSchedule?.map((tier) => ({ ...tier })),
      freeLifetimeMonthsResetOnRepayment: rule.freeLifetimeMonthsResetOnRepayment,
      freeEventCount: rule.freeEventCount,
      freeEventStartPolicyYear: rule.freeEventStartPolicyYear,
      freeEventMaxAmountRate: rule.freeEventMaxAmountRate,
      freeEventMaxAmountBasis: rule.freeEventMaxAmountBasis,
      freeAmountPoolRate: rule.freeAmountPoolRate,
      freeAmountPoolBasis: rule.freeAmountPoolBasis,
      freeAmountPoolReferencePolicyYear: rule.freeAmountPoolReferencePolicyYear,
      rate: rule.rate ?? 0,
      rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
      amount: rule.amount ?? 0,
      sourceChargeRuleId: rule.sourceChargeRuleId,
      sourceBonusId: rule.sourceBonusId,
      requiresManualInput: rule.requiresManualInput,
      exclusiveGroup: rule.exclusiveGroup,
      groupResolution: rule.groupResolution,
      allocation: rule.allocation ?? 'equal-split',
      sourceRefs: rule.sourceRefs?.length ? rule.sourceRefs.map((ref) => ({ ...ref })) : undefined,
      notes: rule.notes?.length ? [...rule.notes] : undefined,
    }))
}

function mapTemplateBonus(
  bonus: IlpTemplateBonus,
  currency: IlpPolicyInput['currency'],
  vitalityStatus: IlpResolvedVitalityStatus,
): IlpPolicyInput['bonuses'][number] {
  const defaultTierRate = bonus.tieredRates.find((tier) => tier.currency === currency)?.rate ?? 0
  const vitalityStatusRateSchedule = bonus.vitalityStatusRateSchedule?.map((tier) => ({ ...tier }))
  const resolvedPolicyYearRateSchedule = vitalityStatusRateSchedule
    ?.filter((tier) => tier.status === vitalityStatus)
    .map(({ startPolicyYear, endPolicyYear, rate }) => ({
      startPolicyYear,
      endPolicyYear,
      rate,
    }))

  return {
    id: bonus.id,
    type: bonus.type,
    label: bonus.label,
    mode: bonus.mode,
    oneTimePayoutBasis: bonus.oneTimePayoutBasis,
    annualPremiumTierBasis: bonus.annualPremiumTierBasis,
    rate: resolvedPolicyYearRateSchedule != null ? 0 : (bonus.rate ?? defaultTierRate),
    amount: bonus.amount ?? 0,
    appliesTo: [...bonus.appliesTo],
    startPolicyYear: bonus.startPolicyYear,
    endPolicyYear: bonus.endPolicyYear,
    yearBasis: bonus.yearBasis,
    cadenceYears: bonus.cadenceYears,
    requiresPremiumsPaidUpToDate: bonus.requiresPremiumsPaidUpToDate,
    requiredRegularPremiumPaymentFrequency: bonus.requiredRegularPremiumPaymentFrequency,
    tieredRates: bonus.tieredRates.map((tier) => ({ ...tier })),
    policyYearRateSchedule: resolvedPolicyYearRateSchedule ?? bonus.policyYearRateSchedule?.map((tier) => ({ ...tier })),
    vitalityStatusRateSchedule,
    stepUpPayoutConfig: bonus.stepUpPayoutConfig
      ? {
          premiumShortfallChargeYears: bonus.stepUpPayoutConfig.premiumShortfallChargeYears,
          partialWithdrawalAccountIds: [...bonus.stepUpPayoutConfig.partialWithdrawalAccountIds],
          countPartialWithdrawalsFromPolicyYear: bonus.stepUpPayoutConfig.countPartialWithdrawalsFromPolicyYear,
        }
      : undefined,
    adjustmentFactorConfig: bonus.adjustmentFactorConfig
      ? {
          formula: bonus.adjustmentFactorConfig.formula,
          withdrawalAccountIds: [...bonus.adjustmentFactorConfig.withdrawalAccountIds],
          includePolicyRepaymentsInPaidRegularPremium: bonus.adjustmentFactorConfig.includePolicyRepaymentsInPaidRegularPremium,
          countFromPolicyYear: bonus.adjustmentFactorConfig.countFromPolicyYear,
          policyRepaymentPriorOffsetRules: bonus.adjustmentFactorConfig.policyRepaymentPriorOffsetRules?.map((rule) => ({
            trigger: rule.trigger,
            accountIds: rule.accountIds ? [...rule.accountIds] : undefined,
          })),
        }
      : undefined,
    qualificationRules: bonus.qualificationRules?.map((rule) => (
      'formula' in rule && rule.formula === 'cumulative-effective-account-value-ratio'
        ? {
            ...rule,
            includeReinvestedDividendWithdrawals: rule.includeReinvestedDividendWithdrawals === true
              ? true
              : undefined,
          }
        : { ...rule }
    )),
    suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })) ?? (
      bonus.qualificationRules?.length
        ? []
        : [
            ...(bonus.adjustmentFactorConfig?.formula === 'cumulative-withdrawal-factor-product-over-account-value'
              ? []
              : bonus.notes.some((note) => note.toLowerCase().includes('partial withdrawal'))
              ? [{ trigger: 'partial-withdrawal' as const, suspensionMonths: 12 }]
              : []),
            ...(bonus.notes.some((note) => note.toLowerCase().includes('premium holiday'))
              ? [{ trigger: 'premium-holiday' as const, suspensionMonths: 12 }]
              : []),
            ...(bonus.notes.some((note) => note.toLowerCase().includes('regular premium reduction'))
              ? [{ trigger: 'regular-premium-reduction' as const, suspensionMonths: 12 }]
              : []),
          ]
    ),
    restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
    excludedValueRules: bonus.excludedValueRules?.map((rule) => ({ ...rule })),
    preservedValueRules: bonus.preservedValueRules?.map((rule) => ({ ...rule })),
    sourceRefs: bonus.sourceRefs?.length ? bonus.sourceRefs.map((ref) => ({ ...ref })) : undefined,
    notes: bonus.notes?.length ? [...bonus.notes] : undefined,
  }
}

function deriveSeedRegularPremiumPaymentFrequency(
  variant: IlpTemplateVariant,
): NonNullable<IlpPolicyInput['regularPremiumPaymentFrequency']> {
  return variant.bonuses.some((bonus) => bonus.requiredRegularPremiumPaymentFrequency === 'annual')
    ? 'annual'
    : 'monthly'
}

export function templateVariantToPolicySeed(
  product: IlpCatalogProduct,
  variant: IlpTemplateVariant,
  manifest: IlpCatalogManifest,
): IlpPolicySeed {
  const chargeRules = mapFeeRulesToChargeRules(variant)
  const eventChargeRules = mapEventChargeRules(variant)
  const accountsWithoutRegularRules = variant.accounts.filter((account) => account.contributionRules.length === 0)
  const defaultContributionShare = accountsWithoutRegularRules.length > 0 ? (1 / accountsWithoutRegularRules.length) : 0
  const vitalityStatus: IlpResolvedVitalityStatus | undefined = variant.bonuses.some((bonus) => (
    (bonus.vitalityStatusRateSchedule?.length ?? 0) > 0
  ))
    ? 'silver'
    : undefined

  return ilpPolicySeedSchema.parse({
    name: `${product.productName} (${formatCatalogVariantLabel(variant)})`,
    insurer: product.insurer,
    currency: variant.currency,
    monthlyContribution: deriveSeedMonthlyContribution(product, variant),
    regularPremiumPaymentFrequency: deriveSeedRegularPremiumPaymentFrequency(variant),
    initialSinglePremium: seedsInitialSinglePremiumRouting(variant) ? 0 : undefined,
    monthsAlreadyPaid: 0,
    currentPolicyYear: 1,
    vitalityStatus,
    icpMonths: variant.icpMonths,
    mipBasis: variant.mipBasis,
    exitChargeBasis: variant.exitChargeBasis,
    assuranceProfile: undefined,
    policyStateSupport: variant.policyStateSupport
      ? {
        automaticLapseOnAccountValueDepletion: variant.policyStateSupport.automaticLapseOnAccountValueDepletion,
        ...(variant.policyStateSupport.minimumRegularPremiumVariationStartPolicyMonth != null
          ? {
              minimumRegularPremiumVariationStartPolicyMonth: variant.policyStateSupport.minimumRegularPremiumVariationStartPolicyMonth,
            }
          : {}),
        ...(variant.policyStateSupport.minimumRegularPremiumAmountByFrequency
          ? {
              minimumRegularPremiumAmountByFrequency: {
                ...variant.policyStateSupport.minimumRegularPremiumAmountByFrequency,
              },
            }
          : {}),
        ...(variant.policyStateSupport.blockRegularPremiumVariationDuringPremiumHoliday != null
          ? {
              blockRegularPremiumVariationDuringPremiumHoliday: variant.policyStateSupport.blockRegularPremiumVariationDuringPremiumHoliday,
            }
          : {}),
        ...(variant.policyStateSupport.blockTopUpsDuringPremiumHoliday != null
          ? {
              blockTopUpsDuringPremiumHoliday: variant.policyStateSupport.blockTopUpsDuringPremiumHoliday,
            }
          : {}),
        ...(variant.policyStateSupport.blockTopUpsWhenPremiumsNotPaidUpToDate != null
          ? {
              blockTopUpsWhenPremiumsNotPaidUpToDate: variant.policyStateSupport.blockTopUpsWhenPremiumsNotPaidUpToDate,
            }
          : {}),
        ...(variant.policyStateSupport.requiresCommencementPremiumForRecurringSinglePremiumResumption != null
          ? {
              requiresCommencementPremiumForRecurringSinglePremiumResumption: variant.policyStateSupport.requiresCommencementPremiumForRecurringSinglePremiumResumption,
            }
          : {}),
        ...(variant.policyStateSupport.minimumPremiumHolidayStartPolicyMonth != null
          ? {
              minimumPremiumHolidayStartPolicyMonth: variant.policyStateSupport.minimumPremiumHolidayStartPolicyMonth,
            }
          : {}),
        ...(variant.policyStateSupport.minimumPartialWithdrawalStartPolicyMonthByAccount
          ? {
              minimumPartialWithdrawalStartPolicyMonthByAccount: variant.policyStateSupport.minimumPartialWithdrawalStartPolicyMonthByAccount.map((rule) => ({
                accountId: rule.accountId,
                startPolicyMonth: rule.startPolicyMonth,
              })),
            }
          : {}),
        ...(variant.policyStateSupport.minimumPartialWithdrawalAmount != null
          ? {
              minimumPartialWithdrawalAmount: variant.policyStateSupport.minimumPartialWithdrawalAmount,
            }
          : {}),
        ...(variant.policyStateSupport.partialWithdrawalAmountIncrement != null
          ? {
              partialWithdrawalAmountIncrement: variant.policyStateSupport.partialWithdrawalAmountIncrement,
            }
          : {}),
        ...(variant.policyStateSupport.partialWithdrawalMaximumAmountRules
          ? {
              partialWithdrawalMaximumAmountRules: variant.policyStateSupport.partialWithdrawalMaximumAmountRules.map((rule) => ({
                activeWindow: rule.activeWindow,
                accountId: rule.accountId,
                basis: rule.basis,
                startPolicyYear: rule.startPolicyYear,
                endPolicyYear: rule.endPolicyYear,
                maximumValueRate: rule.maximumValueRate,
              })),
            }
          : {}),
        ...(variant.policyStateSupport.partialWithdrawalMinimumRemainingValueRules
          ? {
              partialWithdrawalMinimumRemainingValueRules: variant.policyStateSupport.partialWithdrawalMinimumRemainingValueRules.map((rule) => ({
                activeWindow: rule.activeWindow,
                basis: rule.basis,
                ...(rule.accountId ? { accountId: rule.accountId } : {}),
                ...(rule.minimumValue != null ? { minimumValue: rule.minimumValue } : {}),
                ...(rule.minimumValueRate != null ? { minimumValueRate: rule.minimumValueRate } : {}),
              })),
            }
          : {}),
        ...(variant.policyStateSupport.minimumTopUpStartPolicyMonth != null
          ? {
              minimumTopUpStartPolicyMonth: variant.policyStateSupport.minimumTopUpStartPolicyMonth,
            }
          : {}),
        ...(variant.policyStateSupport.minimumTopUpAmount != null
          ? {
              minimumTopUpAmount: variant.policyStateSupport.minimumTopUpAmount,
            }
          : {}),
        ...(variant.policyStateSupport.topUpAmountIncrement != null
          ? {
              topUpAmountIncrement: variant.policyStateSupport.topUpAmountIncrement,
            }
          : {}),
        ...(variant.policyStateSupport.minimumRecurringSinglePremiumMonthlyAmount != null
          ? {
              minimumRecurringSinglePremiumMonthlyAmount: variant.policyStateSupport.minimumRecurringSinglePremiumMonthlyAmount,
            }
          : {}),
        ...(variant.policyStateSupport.minimumRecurringSinglePremiumStartPolicyMonth != null
          ? {
              minimumRecurringSinglePremiumStartPolicyMonth: variant.policyStateSupport.minimumRecurringSinglePremiumStartPolicyMonth,
            }
          : {}),
        ...(variant.policyStateSupport.topUpRepaymentClearance
          ? {
              topUpRepaymentClearance: {
                includeMissedPremiums: variant.policyStateSupport.topUpRepaymentClearance.includeMissedPremiums,
                ...(variant.policyStateSupport.topUpRepaymentClearance.priorOffsetRules
                  ? {
                      priorOffsetRules: variant.policyStateSupport.topUpRepaymentClearance.priorOffsetRules.map((rule) => ({
                        trigger: rule.trigger,
                        ...(rule.accountIds ? { accountIds: [...rule.accountIds] } : {}),
                      })),
                    }
                  : {}),
              },
            }
          : {}),
      }
    : undefined,
    scheduledPayoutSupport: variant.scheduledPayoutSupport
      ? {
          mode: variant.scheduledPayoutSupport.mode,
          accountId: variant.scheduledPayoutSupport.accountId,
          ...(variant.scheduledPayoutSupport.fallbackAccountIds
            ? { fallbackAccountIds: [...variant.scheduledPayoutSupport.fallbackAccountIds] }
            : {}),
          ...(variant.scheduledPayoutSupport.minimumStartPolicyYear != null
            ? { minimumStartPolicyYear: variant.scheduledPayoutSupport.minimumStartPolicyYear }
            : {}),
          ...(variant.scheduledPayoutSupport.allowedFrequencies
            ? { allowedFrequencies: [...variant.scheduledPayoutSupport.allowedFrequencies] }
            : {}),
          ...(variant.scheduledPayoutSupport.requiresTargetRetirementAgeStart === true
            ? { requiresTargetRetirementAgeStart: true }
            : {}),
          ...(variant.scheduledPayoutSupport.minimumAnnualWithdrawalAmount != null
            ? { minimumAnnualWithdrawalAmount: variant.scheduledPayoutSupport.minimumAnnualWithdrawalAmount }
            : {}),
          ...(variant.scheduledPayoutSupport.minimumWithdrawalAmountPerOccurrence != null
            ? { minimumWithdrawalAmountPerOccurrence: variant.scheduledPayoutSupport.minimumWithdrawalAmountPerOccurrence }
            : {}),
          ...(variant.scheduledPayoutSupport.minimumRemainingPolicyValue != null
            ? { minimumRemainingPolicyValue: variant.scheduledPayoutSupport.minimumRemainingPolicyValue }
            : {}),
          source: variant.scheduledPayoutSupport.source,
          ...(variant.scheduledPayoutSupport.payoutStateSupport
            ? {
                payoutStateSupport: {
                  defaultState: variant.scheduledPayoutSupport.payoutStateSupport.defaultState,
                  suppressWhileLapsed: variant.scheduledPayoutSupport.payoutStateSupport.suppressWhileLapsed,
                  stateAfterPremiumHolidayActivation: variant.scheduledPayoutSupport.payoutStateSupport.stateAfterPremiumHolidayActivation,
                  stateAfterReinstatement: variant.scheduledPayoutSupport.payoutStateSupport.stateAfterReinstatement,
                },
              }
            : {}),
        }
      : undefined,
    scheduledPayoutAssumption: undefined,
    distributionSupport: variant.distributionSupport
      ? {
          mode: variant.distributionSupport.mode,
          accountIds: [...variant.distributionSupport.accountIds],
          ...(variant.distributionSupport.minimumAnnualPayoutAmount != null
            ? { minimumAnnualPayoutAmount: variant.distributionSupport.minimumAnnualPayoutAmount }
            : {}),
          ...(variant.distributionSupport.minimumAnnualPayoutCurrency
            ? { minimumAnnualPayoutCurrency: variant.distributionSupport.minimumAnnualPayoutCurrency }
            : {}),
          ...(variant.distributionSupport.recordDateInstructionLeadDays != null
            ? { recordDateInstructionLeadDays: variant.distributionSupport.recordDateInstructionLeadDays }
            : {}),
          ...(variant.distributionSupport.cashPayoutWindows
            ? {
                cashPayoutWindows: variant.distributionSupport.cashPayoutWindows.map((window) => ({
                  startPolicyYear: window.startPolicyYear,
                  endPolicyYear: window.endPolicyYear ?? null,
                  accountIds: [...window.accountIds],
                })),
              }
            : {}),
          defaultMode: variant.distributionSupport.defaultMode,
          cashPayoutAllowedDuringMip: variant.distributionSupport.cashPayoutAllowedDuringMip,
          cashPayoutAllowedAfterMip: variant.distributionSupport.cashPayoutAllowedAfterMip,
          source: variant.distributionSupport.source,
        }
      : undefined,
    distributionAssumption: variant.distributionSupport
      ? {
          mode: variant.distributionSupport.defaultMode,
          source: 'catalog-default',
        }
      : undefined,
    policyEvents: [],
    accounts: variant.accounts.map((account) => ({
      id: account.id,
      label: account.label,
      feeRate: deriveAccountFeeRate(account, variant.feeRules),
      currentValue: 0,
      contributionShare: account.contributionRules.length > 0 ? 0 : defaultContributionShare,
      subjectToEec: account.subjectToEec,
      postMipFeeRate: account.postMipFeeRate,
      contributionRules: account.contributionRules
        .filter((rule) => rule.targetAccountId === account.id)
        .map((rule) => ({
          phase: rule.phase,
          contributionShare: rule.contributionShare,
        })),
    })),
    mipLength: variant.mipLength,
    postMipYears: deriveSeedPostMipYears(variant),
    eecTable: [...variant.eecTable],
    eecYearBasis: variant.eecYearBasis,
    funds: [{ ...DEFAULT_TEMPLATE_FUND }],
    bonuses: variant.bonuses.map((bonus) => mapTemplateBonus(bonus, variant.currency, vitalityStatus ?? 'silver')),
    chargeRules,
    eventChargeRules,
    catalogSource: {
      productId: product.id,
      productName: product.productName,
      variantId: variant.id,
      variantLabel: formatCatalogVariantLabel(variant),
      catalogVersion: manifest.catalogVersion,
      generatedAt: manifest.generatedAt,
      supportStatus: product.supportStatus,
      economicsStatus: product.economicsStatus,
      structureStatus: product.structureStatus,
      modeledEconomics: [...product.modeledEconomics],
      coveredElsewhereBehaviors: [...(product.coveredElsewhereBehaviors ?? [])],
      metadataOnlyBehaviors: [...product.metadataOnlyBehaviors],
    },
    catalogWarnings: [
      ...product.warnings,
      ...variant.warnings,
      ...(variant.mipBasis === 'open-ended'
        ? ['Open-ended products use a default 20-year review horizon in V1; adjust the horizon if you want a different analysis window.']
        : []),
      ...(variant.scheduledPayoutSupport
        ? ['This product supports scheduled payout-state, but V1 requires a manual payout assumption. No payout schedule is seeded by default.']
        : []),
      ...(variant.distributionSupport
        ? [
            variant.distributionSupport.minimumAnnualPayoutAmount != null
              ? (variant.distributionSupport.minimumAnnualPayoutCurrency != null
                  && variant.distributionSupport.minimumAnnualPayoutCurrency !== variant.currency)
                  ? `This product supports distribution-paying fund elections. V1 seeds reinvest by default; cash payout requires a manual annual distribution-yield assumption, and the published minimum annual cash-payout amount of ${formatExplicitCurrencyAmount(
                      variant.distributionSupport.minimumAnnualPayoutCurrency,
                      variant.distributionSupport.minimumAnnualPayoutAmount,
                    )} remains informational for this policy currency.`
                  : `This product supports distribution-paying fund elections. V1 seeds reinvest by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published minimum annual cash-payout amount of ${
                      variant.distributionSupport.minimumAnnualPayoutCurrency != null
                        ? formatExplicitCurrencyAmount(
                            variant.distributionSupport.minimumAnnualPayoutCurrency,
                            variant.distributionSupport.minimumAnnualPayoutAmount,
                          )
                        : formatCurrencyAmount(variant.currency, variant.distributionSupport.minimumAnnualPayoutAmount)
                    } remain reinvested.`
              : 'This product supports distribution-paying fund elections. V1 seeds reinvest by default; cash payout requires a manual annual distribution-yield assumption and the published minimum-payout threshold remains informational only.',
            ...(variant.distributionSupport.recordDateInstructionLeadDays != null
              ? [`Cash payout elections for dividend-paying funds should be submitted at least ${variant.distributionSupport.recordDateInstructionLeadDays} days before the record date.`]
              : []),
          ]
        : []),
      ...(variant.bonuses.some((bonus) => bonus.requiredRegularPremiumPaymentFrequency === 'annual')
        ? ['This seed assumes the regular premium is paid on the annual frequency option so the published annual-premium bonus path can execute. Change Regular Premium Payment Frequency in Policy Details if the policy uses a non-annual mode.']
        : []),
      ...(usesOriginalSinglePremiumBase(variant)
        ? ['Enter the one-time gross initial single premium lump sum in Policy Details if you want the starting policy value, original-base establishment charges, and surrender penalties to be modeled honestly.']
        : []),
      ...(seedsInitialSinglePremiumRouting(variant) && !usesOriginalSinglePremiumBase(variant)
        ? ['Enter the one-time gross initial single premium lump sum in Policy Details if you want the upfront single-premium deduction to seed the starting policy value honestly.']
        : []),
      ...(variant.feeRules.some((rule) => rule.assuranceConfig?.tokioProtectionState?.mode === 'locked-in-policy-value-with-adjusted-single-premium')
        ? ['Tokio secure-product protection-state mechanics use annualized approximations of the published monthiversary locked-in-value and adjusted-single-premium updates. Enter the current locked-in value and adjusted single premium manually if you are starting mid-policy.']
        : []),
      ...(variant.feeRules.some((rule) => rule.assuranceConfig?.tokioProtectionState?.mode === 'locked-in-policy-value')
        ? ['Tokio secure-product protection-state mechanics use annualized approximations of the published monthiversary locked-in-value updates. Enter the current locked-in value manually if you are starting mid-policy.']
        : []),
      ...(variant.unsupportedItems ?? []),
    ],
    discountRate: DEFAULT_DISCOUNT_RATE,
    inflationRate: DEFAULT_INFLATION_RATE,
    alternativeReturn: DEFAULT_ALTERNATIVE_RETURN,
  })
}
