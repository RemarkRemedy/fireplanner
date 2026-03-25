import type { IlpPolicyInput } from '@/lib/calculations/ilp'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'

const MISSING_CATALOG_VARIANT_WARNING = 'Catalog refresh unavailable: original catalog variant no longer exists in the current catalog.'

function appendCatalogWarning(
  warnings: string[] | undefined,
  warning: string,
): string[] {
  const nextWarnings = warnings ?? []
  return nextWarnings.includes(warning) ? nextWarnings : [...nextWarnings, warning]
}

function shouldRefreshFromCatalog(policy: IlpPolicyInput): boolean {
  const { manifest } = getIlpCatalog()
  return policy.catalogSource?.generatedAt !== manifest.generatedAt
    || policy.catalogSource?.catalogVersion !== manifest.catalogVersion
}

function preserveAccountCurrentValues(
  stalePolicy: IlpPolicyInput,
  freshPolicy: ReturnType<typeof templateVariantToPolicySeed>,
): IlpPolicyInput['accounts'] {
  const currentValueByAccountId = new Map(
    stalePolicy.accounts.map((account) => [account.id, account.currentValue] as const),
  )

  return freshPolicy.accounts.map((account) => ({
    ...account,
    currentValue: currentValueByAccountId.get(account.id) ?? account.currentValue,
  }))
}

export function refreshPersistedPolicyFromCatalog(policy: IlpPolicyInput): IlpPolicyInput {
  if (!policy.catalogSource || !shouldRefreshFromCatalog(policy)) {
    return policy
  }

  const { manifest, products } = getIlpCatalog()
  const product = products.find((entry) => entry.id === policy.catalogSource?.productId)
  const variant = product?.variants.find((entry) => entry.id === policy.catalogSource?.variantId)

  if (!product || !variant) {
    return {
      ...policy,
      catalogWarnings: appendCatalogWarning(policy.catalogWarnings, MISSING_CATALOG_VARIANT_WARNING),
    }
  }

  const freshSeed = templateVariantToPolicySeed(product, variant, manifest)

  return {
    ...freshSeed,
    id: policy.id,
    name: policy.name,
    monthlyContribution: policy.monthlyContribution,
    regularPremiumPaymentFrequency: policy.regularPremiumPaymentFrequency,
    initialSinglePremium: policy.initialSinglePremium,
    monthsAlreadyPaid: policy.monthsAlreadyPaid,
    currentAcceptedRegularPremiumMonths: policy.currentAcceptedRegularPremiumMonths,
    currentPolicyYear: policy.currentPolicyYear,
    assuranceProfile: policy.assuranceProfile,
    claimProfile: policy.claimProfile,
    scheduledPayoutAssumption: policy.scheduledPayoutAssumption,
    distributionAssumption: policy.distributionAssumption,
    policyEvents: policy.policyEvents,
    funds: policy.funds,
    accounts: preserveAccountCurrentValues(policy, freshSeed),
    discountRate: policy.discountRate,
    inflationRate: policy.inflationRate,
    alternativeReturn: policy.alternativeReturn,
  }
}
