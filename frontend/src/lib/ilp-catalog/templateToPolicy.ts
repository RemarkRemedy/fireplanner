import type { IlpChargeRule, IlpPolicyInput } from '@/lib/calculations/ilp'
import { DEFAULT_ALTERNATIVE_RETURN, DEFAULT_DISCOUNT_RATE, DEFAULT_INFLATION_RATE } from '@/lib/data/ilpDefaults'
import { formatCatalogVariantLabel } from '@/lib/ilp-catalog/labels'
import type { IlpCatalogManifest, IlpCatalogProduct, IlpTemplateAccount, IlpTemplateBonus, IlpTemplateFeeRule, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { ilpPolicySeedSchema, type IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'

const DEFAULT_TEMPLATE_FUND: IlpPolicyInput['funds'][number] = {
  name: 'Default ILP Fund',
  allocation: 1,
  ocf: 0.015,
  grossReturnLow: 0.06,
  grossReturnMid: 0.08,
  grossReturnHigh: 0.1,
}

function deriveSeedMonthlyContribution(product: IlpCatalogProduct): number {
  return product.metadataOnlyBehaviors.some((behavior) => (
    behavior.endsWith('single-premium-principal-tracking')
    && !behavior.endsWith('recurrent-single-premium-principal-tracking')
  ))
    ? 0
    : 350
}

function deriveSeedPostMipYears(variant: IlpTemplateVariant): number {
  return variant.mipBasis === 'open-ended' ? 20 : 0
}

function sameRate(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return false
  return Math.abs(left - right) < 0.000001
}

function deriveAccountFeeRate(account: IlpTemplateAccount, feeRules: IlpTemplateFeeRule[]): number {
  if (account.feeRate != null) {
    return account.feeRate
  }

  const matchingRule = feeRules.find((rule) => rule.rate != null && rule.appliesTo.length === 1 && rule.appliesTo[0] === account.id)
  return matchingRule?.rate ?? 0
}

function isCoveredByAccountFee(rule: IlpTemplateFeeRule, accounts: IlpTemplateAccount[]): boolean {
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
      const isAssurance = rule.basis === 'assurance-sum-at-risk'
      const isPremiumBase = rule.basis === 'premium-base-mip-multiplier'
      const isCumulativePaidPremium = rule.basis === 'cumulative-paid-regular-premium'
      const isFixedAnnual = rule.basis === 'fixed-annual'
      const isAnnualContribution = rule.basis === 'annual-contribution'

      return {
        id: rule.id,
        label: rule.label,
        basis: isAssurance
          ? 'assurance-sum-at-risk'
          : isPremiumBase
            ? 'premium-base-mip-multiplier'
            : isCumulativePaidPremium
              ? 'cumulative-paid-regular-premium'
            : isFixedAnnual
              ? 'fixed-annual'
              : isAnnualContribution
                ? 'annual-contribution'
                : 'account-value',
        activeWindow: rule.activeWindow,
        yearBasis: rule.yearBasis,
        startPolicyYear: rule.startPolicyYear,
        endPolicyYear: rule.endPolicyYear,
        appliesTo: [...rule.appliesTo],
        fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
        rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
        amountSchedule: rule.amountSchedule?.map((tier) => ({ ...tier })),
        rate: isFixedAnnual || isAssurance ? 0 : (rule.rate ?? 0),
        amount: isAssurance ? 0 : (rule.amount ?? 0),
        assuranceConfig: rule.assuranceConfig ? { ...rule.assuranceConfig } : undefined,
        premiumBaseConfig: rule.premiumBaseConfig
            ? {
              useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing,
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
        allocation: isFixedAnnual || isAssurance ? 'pro-rata-by-value' : 'equal-split',
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
      freeLifetimeMonths: rule.freeLifetimeMonths,
      freeEventCount: rule.freeEventCount,
      freeEventStartPolicyYear: rule.freeEventStartPolicyYear,
      freeEventMaxAmountRate: rule.freeEventMaxAmountRate,
      rate: rule.rate ?? 0,
      rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
      amount: rule.amount ?? 0,
      sourceChargeRuleId: rule.sourceChargeRuleId,
      sourceBonusId: rule.sourceBonusId,
      requiresManualInput: rule.requiresManualInput,
      exclusiveGroup: rule.exclusiveGroup,
      groupResolution: rule.groupResolution,
      allocation: rule.allocation ?? 'equal-split',
    }))
}

function mapTemplateBonus(
  bonus: IlpTemplateBonus,
  currency: IlpPolicyInput['currency'],
): IlpPolicyInput['bonuses'][number] {
  const defaultTierRate = bonus.tieredRates.find((tier) => tier.currency === currency)?.rate ?? 0

  return {
    id: bonus.id,
    type: bonus.type,
    label: bonus.label,
    mode: bonus.mode,
    rate: bonus.rate ?? defaultTierRate,
    amount: bonus.amount ?? 0,
    appliesTo: [...bonus.appliesTo],
    startPolicyYear: bonus.startPolicyYear,
    endPolicyYear: bonus.endPolicyYear,
    yearBasis: bonus.yearBasis,
    cadenceYears: bonus.cadenceYears,
    requiresPremiumsPaidUpToDate: bonus.requiresPremiumsPaidUpToDate,
    tieredRates: bonus.tieredRates.map((tier) => ({ ...tier })),
    suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })) ?? [
      ...(bonus.notes.some((note) => note.toLowerCase().includes('partial withdrawal'))
        ? [{ trigger: 'partial-withdrawal' as const, suspensionMonths: 12 }]
        : []),
      ...(bonus.notes.some((note) => note.toLowerCase().includes('premium holiday'))
        ? [{ trigger: 'premium-holiday' as const, suspensionMonths: 12 }]
        : []),
      ...(bonus.notes.some((note) => note.toLowerCase().includes('regular premium reduction'))
        ? [{ trigger: 'regular-premium-reduction' as const, suspensionMonths: 12 }]
        : []),
    ],
    restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
  }
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

  return ilpPolicySeedSchema.parse({
    name: `${product.productName} (${formatCatalogVariantLabel(variant)})`,
    insurer: product.insurer,
    currency: variant.currency,
    monthlyContribution: deriveSeedMonthlyContribution(product),
    monthsAlreadyPaid: 0,
    currentPolicyYear: 1,
    icpMonths: variant.icpMonths,
    mipBasis: variant.mipBasis,
    assuranceProfile: undefined,
    scheduledPayoutSupport: variant.scheduledPayoutSupport
      ? {
          mode: variant.scheduledPayoutSupport.mode,
          accountId: variant.scheduledPayoutSupport.accountId,
          source: variant.scheduledPayoutSupport.source,
        }
      : undefined,
    scheduledPayoutAssumption: undefined,
    distributionSupport: variant.distributionSupport
      ? {
          mode: variant.distributionSupport.mode,
          accountIds: [...variant.distributionSupport.accountIds],
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
    bonuses: variant.bonuses.map((bonus) => mapTemplateBonus(bonus, variant.currency)),
    chargeRules,
    eventChargeRules,
    catalogSource: {
      productId: product.id,
      productName: product.productName,
      variantId: variant.id,
      variantLabel: formatCatalogVariantLabel(variant),
      catalogVersion: manifest.catalogVersion,
      supportStatus: product.supportStatus,
      economicsStatus: product.economicsStatus,
      structureStatus: product.structureStatus,
      modeledEconomics: [...product.modeledEconomics],
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
        ? ['This product supports distribution-paying fund elections. V1 seeds reinvest by default; cash payout requires a manual annual distribution-yield assumption and the published minimum-payout threshold remains informational only.']
        : []),
      ...(variant.unsupportedItems ?? []),
    ],
    discountRate: DEFAULT_DISCOUNT_RATE,
    inflationRate: DEFAULT_INFLATION_RATE,
    alternativeReturn: DEFAULT_ALTERNATIVE_RETURN,
  })
}
