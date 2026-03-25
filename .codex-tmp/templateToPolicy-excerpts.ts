## templateToPolicy.ts excerpt: initial-single-premium helpers
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

function usesInitialSinglePremiumBase(variant: IlpTemplateVariant): boolean {
  return variant.feeRules.some((rule) => (
    rule.basis === 'initial-single-premium'
    || rule.basis === 'initial-single-premium-base'
  )) || variant.exitChargeBasis === 'initial-single-premium-base'
}

function usesOriginalSinglePremiumBase(variant: IlpTemplateVariant): boolean {
  return variant.feeRules.some((rule) => rule.basis === 'initial-single-premium-base')
    || variant.exitChargeBasis === 'initial-single-premium-base'
}

function deriveSeedMonthlyContribution(product: IlpCatalogProduct, variant: IlpTemplateVariant): number {
  if (usesInitialSinglePremiumBase(variant)) {
    return 0
  }

  return product.metadataOnlyBehaviors.some((behavior) => (
    behavior.endsWith('single-premium-principal-tracking')
    && !behavior.endsWith('recurrent-single-premium-principal-tracking')
  ))
    ? 0
    : 350
}


## templateToPolicy.ts excerpt: basis mapping

  return sameRate(account.feeRate, rule.rate) && sameRate(account.postMipFeeRate ?? account.feeRate, rule.rate)
}

function mapFeeRuleBasis(
  basis: NonNullable<IlpTemplateFeeRule['basis']>,
): IlpChargeRule['basis'] {
  switch (basis) {
    case 'assurance-sum-at-risk':
    case 'premium-base-mip-multiplier':
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
      const isInitialSinglePremium = rule.basis === 'initial-single-premium' || rule.basis === 'initial-single-premium-base'

      return {
        id: rule.id,
        label: rule.label,
        basis: mapFeeRuleBasis(rule.basis),
        activeWindow: rule.activeWindow,
        yearBasis: rule.yearBasis,
        startPolicyYear: rule.startPolicyYear,
        endPolicyYear: rule.endPolicyYear,
        appliesTo: [...rule.appliesTo],
        fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,

## templateToPolicy.ts excerpt: seed initialSinglePremium + warnings
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
    monthlyContribution: deriveSeedMonthlyContribution(product, variant),
    initialSinglePremium: usesInitialSinglePremiumBase(variant) ? 0 : undefined,
    monthsAlreadyPaid: 0,
    currentPolicyYear: 1,
    icpMonths: variant.icpMonths,
    mipBasis: variant.mipBasis,
    exitChargeBasis: variant.exitChargeBasis,
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
      ...(usesOriginalSinglePremiumBase(variant)
        ? ['Enter the one-time gross initial single premium lump sum in Policy Details if you want the starting policy value, original-base establishment charges, and surrender penalties to be modeled honestly.']
        : []),
      ...(variant.feeRules.some((rule) => rule.basis === 'initial-single-premium') && !usesOriginalSinglePremiumBase(variant)
        ? ['Enter the one-time gross initial single premium lump sum in Policy Details if you want the upfront single-premium deduction to seed the starting policy value honestly.']
        : []),
      ...(variant.unsupportedItems ?? []),
