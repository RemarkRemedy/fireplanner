import type { IlpCatalogSnapshot } from '../../../scripts/ilp-catalog/catalogSnapshot'
import { createDefaultPolicy } from '../../stores/useIlpStore'
import { templateVariantToPolicySeed } from '../ilp-catalog/templateToPolicy'
import type { IlpCatalogProduct, IlpTemplateVariant } from '../ilp-catalog/types'
import { ilpPolicySchema } from '../validation/ilpSchema'
import { analyzeIlpPolicy, type IlpFund, type IlpPolicyInput } from './ilp'
import type { GoldenFixtureArtifact } from './ilpGoldenHarness'

export type GoldenIlpFixtureClass = 'supported' | 'partial-modeled-subset'

export type GoldenCoverageTag =
  | 'baseline'
  | 'event-heavy'
  | 'ocf-stress'
  | 'branch:hsbc-holiday-repayment'
  | 'branch:hsbc-holiday-no-repayment'
  | 'branch:hsbc-bonus-suspension'
  | 'branch:hsbc-premium-reduction-brc'
  | 'branch:hsbc-top-up-routing'
  | 'branch:hsbc-harvest-holiday-charge'
  | 'branch:hsbc-harvest-pwc'
  | 'branch:hsbc-harvest-brc'
  | 'branch:hsbc-harvest-topup-charge'
  | 'branch:hsbc-abundance-free-withdrawal'
  | 'branch:hsbc-abundance-tiered-brc'
  | 'branch:hsbc-abundance-topup-charge'
  | 'branch:hsbc-abundance-power-up-restoration'
  | 'branch:hsbc-voyage-premium-base-amf'
  | 'branch:hsbc-voyage-tiered-brc'
  | 'branch:hsbc-voyage-topup-charge'
  | 'branch:hsbc-voyage-premium-holiday-suspension'
  | 'branch:pru-holiday-refund'
  | 'branch:pru-holiday-fallback'
  | 'branch:pru-top-up-charge'
  | 'branch:pru-free-withdrawal'
  | 'branch:pru-charged-withdrawal'
  | 'branch:prulink-investgrowth-sp-single-premium-charge'
  | 'branch:prulink-investgrowth-sp-premium-assurance-charge'
  | 'branch:prulink-investgrowth-sp-top-up-charge'
  | 'branch:prulink-investgrowth-sp-top-up-assurance-charge'
  | 'branch:prulink-investgrowth-recurring-premium-charge'
  | 'branch:prulink-investgrowth-premium-assurance-charge'
  | 'branch:prulink-investgrowth-top-up-charge'
  | 'branch:prulink-investgrowth-top-up-assurance-charge'
  | 'branch:income-wealthlink-gl3-single-premium-charge'
  | 'branch:income-wealthlink-gl3-top-up-premium-charge'
  | 'branch:income-wealthlink-gl3-recurring-single-premium-charge'
  | 'branch:income-wealthlink-gl3-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-gia-sp-initial-single-premium-charge'
  | 'branch:great-eastern-gia-sp-top-up-premium-charge'
  | 'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-gia2-sp-initial-single-premium-charge'
  | 'branch:great-eastern-gia2-sp-top-up-premium-charge'
  | 'branch:great-eastern-gia2-sp-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-gia-rsp-recurrent-single-premium-charge'
  | 'branch:great-eastern-gia-rsp-top-up-premium-charge'
  | 'branch:great-eastern-gia-rsp-open-ended-zero-surrender-charge'
  | 'tokio-recurring-single-premium-routing'
  | 'branch:prosper-assurance-charge'
  | 'kernel:distribution-mode-assumption'
  | 'branch:assure-ii-pre-70-assurance'
  | 'branch:assure-ii-post-70-charge-tail'
  | 'branch:assure-ii-manual-reduction-resumption'
  | 'branch:hsbc-flexi-choice-max-assurance'
  | 'branch:tokio-bonus-ladder'
  | 'branch:tokio-post-mip-routing'
  | 'branch:tokio-multi-account-structure'
  | 'branch:tokio-rsp-manual-resumption'
  | 'branch:tokio-shortfall-exclusive'
  | 'branch:tokio-reduction-consumes-rsp-first'
  | 'branch:tokio-charge-waiver'

export interface GoldenFixtureCoverageTarget {
  productId: string
  variantId: string
  scenarioId: string
  fixtureClass: GoldenIlpFixtureClass
  coverageTags: GoldenCoverageTag[]
}

interface GoldenFixtureManualSource {
  supportStatus: 'partial'
  sourceFileName: string
  sourceChecksumSha256: string
}

export interface GoldenIlpFixtureInput extends GoldenFixtureCoverageTarget {
  id: string
  fileName: `${string}.json`
  description: string
  policy: IlpPolicyInput
  manualSource?: GoldenFixtureManualSource
  integrityChecks?: Array<{
    description: string
    test: (fixture: GoldenIlpFixtureInput, artifact: GoldenFixtureArtifact) => boolean
  }>
}

interface GoldenFixtureDefinition extends GoldenFixtureCoverageTarget {
  description: string
  manualSource?: GoldenFixtureManualSource
  integrityChecks?: Array<{
    description: string
    test: (fixture: GoldenIlpFixtureInput, artifact: GoldenFixtureArtifact) => boolean
  }>
}

const HSBC_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Global Equity Blend',
    allocation: 0.6,
    ocf: 0.013,
    grossReturnLow: 0.05,
    grossReturnMid: 0.08,
    grossReturnHigh: 0.11,
  },
  {
    name: 'Asia Income Blend',
    allocation: 0.4,
    ocf: 0.009,
    grossReturnLow: 0.035,
    grossReturnMid: 0.06,
    grossReturnHigh: 0.08,
  },
]

const HSBC_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Emerging Markets Equity',
    allocation: 0.7,
    ocf: 0.022,
    grossReturnLow: 0.04,
    grossReturnMid: 0.082,
    grossReturnHigh: 0.12,
  },
  {
    name: 'High Yield Income',
    allocation: 0.3,
    ocf: 0.018,
    grossReturnLow: 0.03,
    grossReturnMid: 0.055,
    grossReturnHigh: 0.075,
  },
]

const PRU_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Growth Managed Fund',
    allocation: 0.55,
    ocf: 0.014,
    grossReturnLow: 0.05,
    grossReturnMid: 0.078,
    grossReturnHigh: 0.105,
  },
  {
    name: 'Income Managed Fund',
    allocation: 0.45,
    ocf: 0.01,
    grossReturnLow: 0.035,
    grossReturnMid: 0.058,
    grossReturnHigh: 0.075,
  },
]

const PRU_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'High OCF Equity Fund',
    allocation: 0.65,
    ocf: 0.024,
    grossReturnLow: 0.045,
    grossReturnMid: 0.08,
    grossReturnHigh: 0.115,
  },
  {
    name: 'Alternative Income Fund',
    allocation: 0.35,
    ocf: 0.019,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const INCOME_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Income Global Opportunities',
    allocation: 0.6,
    ocf: 0.012,
    grossReturnLow: 0.045,
    grossReturnMid: 0.072,
    grossReturnHigh: 0.098,
  },
  {
    name: 'Income Stable Yield',
    allocation: 0.4,
    ocf: 0.009,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const INCOME_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Income Emerging Equity',
    allocation: 0.65,
    ocf: 0.023,
    grossReturnLow: 0.038,
    grossReturnMid: 0.078,
    grossReturnHigh: 0.115,
  },
  {
    name: 'Income Alternative Income',
    allocation: 0.35,
    ocf: 0.019,
    grossReturnLow: 0.028,
    grossReturnMid: 0.05,
    grossReturnHigh: 0.068,
  },
]

const GREAT_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Great Asia Growth',
    allocation: 0.58,
    ocf: 0.012,
    grossReturnLow: 0.044,
    grossReturnMid: 0.071,
    grossReturnHigh: 0.097,
  },
  {
    name: 'Great Income Opportunities',
    allocation: 0.42,
    ocf: 0.009,
    grossReturnLow: 0.03,
    grossReturnMid: 0.051,
    grossReturnHigh: 0.069,
  },
]

const GREAT_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Great Emerging Leaders',
    allocation: 0.68,
    ocf: 0.024,
    grossReturnLow: 0.037,
    grossReturnMid: 0.079,
    grossReturnHigh: 0.116,
  },
  {
    name: 'Great Alternative Income',
    allocation: 0.32,
    ocf: 0.019,
    grossReturnLow: 0.027,
    grossReturnMid: 0.049,
    grossReturnHigh: 0.067,
  },
]

const TOKIO_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Asia Balanced Growth',
    allocation: 0.6,
    ocf: 0.013,
    grossReturnLow: 0.045,
    grossReturnMid: 0.072,
    grossReturnHigh: 0.098,
  },
  {
    name: 'Global Income Opportunities',
    allocation: 0.4,
    ocf: 0.01,
    grossReturnLow: 0.03,
    grossReturnMid: 0.05,
    grossReturnHigh: 0.068,
  },
]

function cloneFunds(funds: IlpFund[]): IlpFund[] {
  return funds.map((fund) => ({ ...fund }))
}

function clonePolicySeedIntoInput(
  seed: ReturnType<typeof templateVariantToPolicySeed>,
  id: string,
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = createDefaultPolicy()
  return ilpPolicySchema.parse({
    ...base,
    ...seed,
    id,
    eecTable: [...seed.eecTable],
    policyEvents: seed.policyEvents?.map((event) => ({ ...event })) ?? [],
    funds: seed.funds.map((fund) => ({ ...fund })),
    accounts: seed.accounts.map((account) => ({
      ...account,
      contributionRules: account.contributionRules?.map((rule) => ({ ...rule })),
    })),
    bonuses: seed.bonuses.map((bonus) => ({
      ...bonus,
      appliesTo: [...bonus.appliesTo],
      cadenceYears: bonus.cadenceYears,
      tieredRates: bonus.tieredRates?.map((tier) => ({ ...tier })),
      suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })),
      restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
    })),
    chargeRules: seed.chargeRules?.map((rule) => ({
      ...rule,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      premiumBaseConfig: rule.premiumBaseConfig
        ? {
            useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing,
            multiplierSchedule: rule.premiumBaseConfig.multiplierSchedule.map((tier) => ({ ...tier })),
          }
        : undefined,
      amountSchedule: rule.amountSchedule?.map((tier) => ({ ...tier })),
    })) ?? [],
    eventChargeRules: seed.eventChargeRules?.map((rule) => ({
      ...rule,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      freeLifetimeMonths: rule.freeLifetimeMonths,
      rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
    })) ?? [],
    catalogSource: seed.catalogSource ? { ...seed.catalogSource } : undefined,
    catalogWarnings: seed.catalogWarnings ? [...seed.catalogWarnings] : undefined,
    ...overrides,
  })
}

function requireProduct(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, productId: string): IlpCatalogProduct {
  const product = snapshot.products.find((entry) => entry.id === productId)
  if (!product) {
    throw new Error(`Golden fixture source product "${productId}" not found in ILP catalog.`)
  }
  return product
}

function requireVariant(product: IlpCatalogProduct, variantId: string): IlpTemplateVariant {
  const variant = product.variants.find((entry) => entry.id === variantId)
  if (!variant) {
    throw new Error(`Golden fixture source variant "${variantId}" not found for product "${product.id}".`)
  }
  return variant
}

function seedPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: string,
  variantId: string,
  fixtureId: string,
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const product = requireProduct(snapshot, productId)
  const variant = requireVariant(product, variantId)
  return clonePolicySeedIntoInput(templateVariantToPolicySeed(product, variant, snapshot.manifest), fixtureId, overrides)
}

function withFunds(policy: IlpPolicyInput, funds: IlpFund[]): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    funds: cloneFunds(funds),
  })
}

function withResolvedManualInputs(policy: IlpPolicyInput): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    chargeRules: policy.chargeRules?.map((rule) => ({
      ...rule,
      requiresManualInput: false,
    })) ?? [],
    eventChargeRules: policy.eventChargeRules?.map((rule) => ({
      ...rule,
      requiresManualInput: false,
    })) ?? [],
  })
}

function withoutRecurringContribution(policy: IlpPolicyInput): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    monthlyContribution: 0,
    accounts: policy.accounts.map((account) => ({
      ...account,
      contributionShare: 0,
      contributionRules: account.contributionRules?.map((rule) => ({
        ...rule,
        contributionShare: rule.phase === 'top-up' ? rule.contributionShare : 0,
      })),
    })),
  })
}

function withHsbcBalances(policy: IlpPolicyInput, iua: number, aua: number): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => ({
      ...account,
      currentValue: account.id === 'iua' ? iua : aua,
    })),
  })
}

function withHsbcHarvestBalances(policy: IlpPolicyInput, regular: number, topup: number): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => ({
      ...account,
      currentValue: account.id === 'regular' ? regular : topup,
    })),
  })
}

function withPruBalancesAndSplit(
  policy: IlpPolicyInput,
  growth: number,
  flex: number,
  additional: number,
  growthShare: number,
): IlpPolicyInput {
  const flexShare = Number((1 - growthShare).toFixed(6))

  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'growth') {
        return { ...account, currentValue: growth, contributionShare: growthShare }
      }
      if (account.id === 'flex') {
        return { ...account, currentValue: flex, contributionShare: flexShare }
      }
      return { ...account, currentValue: additional, contributionShare: 0 }
    }),
  })
}

function withPruBalancesOnly(
  policy: IlpPolicyInput,
  growth: number,
  flex: number,
  additional: number,
): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'growth') {
        return { ...account, currentValue: growth }
      }
      if (account.id === 'flex') {
        return { ...account, currentValue: flex }
      }
      return { ...account, currentValue: additional }
    }),
  })
}

function withTokioBalances(
  policy: IlpPolicyInput,
  initial: number,
  accumulation: number,
  topup: number,
): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'initial') {
        return { ...account, currentValue: initial }
      }
      if (account.id === 'accumulation') {
        return { ...account, currentValue: accumulation }
      }
      return { ...account, currentValue: topup }
    }),
  })
}

function hsbcFlexiChoiceAssurancePolicy(id: string): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...createDefaultPolicy(),
    id,
    name: 'Golden HSBC Life Flexi Protector (Choice Death / TI COI)',
    insurer: 'HSBC Life',
    currency: 'SGD',
    monthlyContribution: 0,
    monthsAlreadyPaid: 72,
    currentPolicyYear: 7,
    icpMonths: 0,
    mipLength: 20,
    postMipYears: 10,
    eecTable: Array.from({ length: 20 }, () => 0),
    accounts: [
      {
        id: 'policy-value',
        label: 'Policy Value',
        feeRate: 0,
        currentValue: 30_000,
        contributionShare: 0,
        subjectToEec: false,
        postMipFeeRate: null,
      },
    ],
    funds: [
      {
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      },
    ],
    bonuses: [],
    chargeRules: [
      {
        id: 'flexi-choice-death-ti',
        label: 'Death / TI COI',
        basis: 'assurance-sum-at-risk',
        activeWindow: 'policy-term',
        appliesTo: ['policy-value'],
        rate: 0,
        amount: 0,
        assuranceConfig: {
          formula: 'hsbc-flexi-choice-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
        allocation: 'pro-rata-by-value',
      },
    ],
    eventChargeRules: [],
    assuranceProfile: {
      currentAgeNextBirthday: 30,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentBasicSumAssured: 100_000,
      currentNetSupplementaryPremiumBase: 20_000,
    },
    discountRate: 0.03,
    inflationRate: 0.02,
    alternativeReturn: 0.07,
  })
}

function hsbcBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', variantId, id)
  const isUsd = variantId.startsWith('usd')
  const isLongMip = variantId.endsWith('30')

  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Accelerate (${variantId.toUpperCase()})`,
        monthlyContribution: isUsd ? 700 : 1_000,
        currentPolicyYear: isLongMip ? 8 : 6,
        monthsAlreadyPaid: isLongMip ? 84 : 60,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    isUsd ? 12_500 : 15_000,
    isUsd ? 8_400 : 10_500,
  )
}

function hsbcEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', 'sgd-mip-25', id)
  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Accelerate (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_000,
        currentPolicyYear: 14,
        monthsAlreadyPaid: 156,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 169,
            durationMonths: 3,
            repayMissedPremiums: true,
            repaymentAccountId: 'aua',
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 173,
            durationMonths: 1,
            amount: 3_500,
            accountId: 'aua',
          },
          {
            id: 'premium-reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 181,
            durationMonths: 1,
            amount: 4_800,
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 184,
            durationMonths: 1,
            amount: 5_000,
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    18_000,
    32_000,
  )
}

function hsbcHolidayNoRepaymentPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', 'sgd-mip-25', id)
  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Accelerate (SGD / MIP 25 Holiday No Repayment)',
        monthlyContribution: 1_000,
        currentPolicyYear: 14,
        monthsAlreadyPaid: 156,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 169,
            durationMonths: 4,
            repayMissedPremiums: false,
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    16_500,
    28_000,
  )
}

function hsbcStressPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', 'usd-mip-30', id)
  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Accelerate (USD / MIP 30 Stress Mix)',
        monthlyContribution: 750,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    14_000,
    10_200,
  )
}

function hsbcHarvestBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-harvest', 'sgd-mip-11', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Harvest (SGD / MIP 11 Baseline)',
        monthlyContribution: 1_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        postMipYears: 10,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    14_000,
    2_500,
  )
}

function hsbcHarvestEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-harvest', 'sgd-mip-11', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Harvest (SGD / MIP 11 Event Heavy)',
        monthlyContribution: 1_000,
        currentPolicyYear: 10,
        monthsAlreadyPaid: 108,
        postMipYears: 5,
        policyEvents: [
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 109,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 110,
            durationMonths: 2,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 112,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 114,
            durationMonths: 1,
            amount: 500,
            accountId: 'regular',
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    24_000,
    3_000,
  )
}

function hsbcHarvestStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-harvest', 'sgd-mip-11', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Harvest (SGD / MIP 11 Stress Mix)',
        monthlyContribution: 1_000,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        postMipYears: 8,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    17_000,
    3_400,
  )
}

function hsbcAbundanceBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-abundance', variantId, id)
  const isUsd = variantId.startsWith('usd')

  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Abundance (${variantId.toUpperCase()})`,
        monthlyContribution: isUsd ? 2_000 : 2_500,
        currentPolicyYear: 5,
        monthsAlreadyPaid: 48,
        postMipYears: 8,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    isUsd ? 26_000 : 32_000,
    isUsd ? 4_000 : 5_500,
  )
}

function hsbcAbundanceEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-abundance', 'sgd-mip-10', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Abundance (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 2_500,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 5,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 85,
            durationMonths: 2,
            repayMissedPremiums: true,
            repaymentAccountId: 'regular',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 88,
            durationMonths: 1,
            amount: 2_000,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 90,
            durationMonths: 1,
            amount: 3_000,
          },
          {
            id: 'free-withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 92,
            durationMonths: 1,
            amount: 1_500,
            accountId: 'regular',
          },
          {
            id: 'charged-withdrawal-2',
            type: 'partial-withdrawal',
            startPolicyMonth: 94,
            durationMonths: 1,
            amount: 4_000,
            accountId: 'regular',
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    34_000,
    6_000,
  )
}

function hsbcAbundanceStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-abundance', 'usd-mip-10', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Abundance (USD / MIP 10 Stress Mix)',
        monthlyContribution: 2_000,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        postMipYears: 8,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    27_500,
    4_200,
  )
}

function hsbcVoyageBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-voyage', variantId, id)
  const isUsd = variantId.startsWith('usd')
  const mipLength = Number(variantId.slice(variantId.lastIndexOf('-') + 1))
  const currentPolicyYear = Math.max(3, Math.min(mipLength - 2, Math.floor(mipLength / 2)))

  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Voyage (${variantId.toUpperCase()})`,
        monthlyContribution: isUsd ? 1_200 : 1_500,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        postMipYears: 5,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    isUsd ? 18_000 : 24_000,
    isUsd ? 5_500 : 7_500,
  )
}

function hsbcVoyageEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-voyage', 'sgd-mip-20', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Voyage (SGD / MIP 20 Event Heavy)',
        monthlyContribution: 1_500,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        postMipYears: 5,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 97,
            durationMonths: 2,
            repayMissedPremiums: false,
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 100,
            durationMonths: 1,
            amount: 2_000,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 102,
            durationMonths: 1,
            amount: 1_800,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 104,
            durationMonths: 1,
            amount: 3_000,
            accountId: 'regular',
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    28_000,
    5_000,
  )
}

function pruBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Wealth II (${variantId.toUpperCase()})`,
        monthlyContribution: 1_400,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        distributionAssumption,
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    12_000 + term * 500,
    10_000 + term * 450,
    2_500 + term * 80,
    0.55,
  )
}

function pruEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', 'sgd-mip-25', id)
  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Wealth II (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_500,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 121,
            durationMonths: 4,
            repayMissedPremiums: true,
            repaymentAccountId: 'flex',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 129,
            durationMonths: 1,
            amount: 8_000,
          },
          {
            id: 'withdrawal-free-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 133,
            durationMonths: 1,
            amount: 2_500,
            accountId: 'growth',
          },
          {
            id: 'withdrawal-charged-2',
            type: 'partial-withdrawal',
            startPolicyMonth: 145,
            durationMonths: 1,
            amount: 1_800,
            accountId: 'flex',
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    22_000,
    17_000,
    4_000,
    0.6,
  )
}

function pruHolidayFallbackPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', 'sgd-mip-25', id)
  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Wealth II (SGD / MIP 25 Holiday Fallback)',
        monthlyContribution: 1_500,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 133,
            durationMonths: 6,
            repayMissedPremiums: false,
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    200,
    150,
    6_000,
    0.5,
  )
}

function pruStressSplitPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', 'sgd-mip-20', id)
  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Wealth II (SGD / MIP 20 Split Stress)',
        monthlyContribution: 1_350,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        policyEvents: [],
      }),
      PRU_STRESS_FUNDS,
    ),
    7_000,
    24_000,
    5_000,
    0.2,
  )
}

function prosperAssurancePolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 25 Assurance)',
        monthlyContribution: 1_200,
        currentPolicyYear: 10,
        monthsAlreadyPaid: 120,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
        },
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    50_000,
    50_000,
    50_000,
    0.5,
  ))
}

function pruInvestGrowthSpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-prulink-investgrowth-sp', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })
  const distributionAssumption = variantId === 'sgd-open-ended-cash'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden PRULink InvestGrowth (SP) (${variantId.toUpperCase()})`,
      policyEvents: [],
      distributionAssumption,
      ...overrides,
    }),
    funds,
  )
}

function pruInvestGrowthSpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthSpBasePolicy(snapshot, variantId, id, PRU_BALANCED_FUNDS)
}

function pruInvestGrowthSpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthSpBasePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_BALANCED_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SP) (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
    ],
  })
}

function pruInvestGrowthSpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthSpBasePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_STRESS_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SP) (SGD / Open-ended Cash OCF Stress)',
  })
}

function pruInvestGrowthRegularBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
  funds: IlpFund[] = PRU_BALANCED_FUNDS,
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-prulink-investgrowth', variantId, id)

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden PRULink InvestGrowth (${variantId.toUpperCase()})`,
      monthlyContribution: 400,
      currentPolicyYear: 3,
      monthsAlreadyPaid: 24,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function pruInvestGrowthRegularEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthRegularBaselinePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_BALANCED_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 31,
        durationMonths: 1,
        amount: 8_000,
      },
    ],
  })
}

function pruInvestGrowthRegularStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthRegularBaselinePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_STRESS_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SGD / Open-ended Cash OCF Stress)',
  })
}

function incomeWealthLinkGl3BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'income-wealthlink-gl3', 'sgd-open-ended-cash-or-srs', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden WealthLink (GL3) (SGD / Open-ended Cash Or Srs)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function incomeWealthLinkGl3BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeWealthLinkGl3BasePolicy(snapshot, id, INCOME_BALANCED_FUNDS)
}

function incomeWealthLinkGl3EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeWealthLinkGl3BasePolicy(snapshot, id, INCOME_BALANCED_FUNDS, {
    name: 'Golden WealthLink (GL3) (SGD / Open-ended Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function incomeWealthLinkGl3StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeWealthLinkGl3BasePolicy(snapshot, id, INCOME_STRESS_FUNDS, {
    name: 'Golden WealthLink (GL3) (SGD / Open-ended OCF Stress)',
  })
}

function greatEasternGiaSpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-sp', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden GREAT Invest Advantage (SP) (${variantId.toUpperCase()})`,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGiaSpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
): IlpPolicyInput {
  return greatEasternGiaSpBasePolicy(snapshot, variantId, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGiaSpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaSpBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage (SP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 10,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGiaSpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaSpBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage (SP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function greatEasternGia2SpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-2-sp', 'sgd-open-ended-cash-or-srs', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden GREAT Invest Advantage 2 (SP) (SGD / Open-ended Cash Or Srs)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGia2SpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2SpBasePolicy(snapshot, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGia2SpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2SpBasePolicy(snapshot, id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage 2 (SP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 10,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGia2SpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2SpBasePolicy(snapshot, id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage 2 (SP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function greatEasternGiaRspBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-rsp', variantId, id)
  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden GREAT Invest Advantage (RSP) (${variantId.toUpperCase()})`,
      monthlyContribution: 350,
      currentPolicyYear: 3,
      monthsAlreadyPaid: 24,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGiaRspBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
): IlpPolicyInput {
  return greatEasternGiaRspBasePolicy(snapshot, variantId, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGiaRspEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaRspBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage (RSP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 31,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 33,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGiaRspStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaRspBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage (RSP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function prosperBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Prosper (${variantId.toUpperCase()})`,
        monthlyContribution: 1_250,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        distributionAssumption,
        assuranceProfile: {
          currentAgeNextBirthday: 47,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 95_000,
        },
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    10_000 + term * 650,
    9_000 + term * 600,
    2_500 + term * 120,
    0.55,
  ))
}

function prosperEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_350,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        assuranceProfile: {
          currentAgeNextBirthday: 49,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 102_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 121,
            durationMonths: 4,
            repayMissedPremiums: true,
            repaymentAccountId: 'flex',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 129,
            durationMonths: 1,
            amount: 7_500,
          },
          {
            id: 'withdrawal-free-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 133,
            durationMonths: 1,
            amount: 2_500,
            accountId: 'growth',
          },
          {
            id: 'withdrawal-charged-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 145,
            durationMonths: 1,
            amount: 1_800,
            accountId: 'flex',
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    20_000,
    16_000,
    4_500,
    0.58,
  ))
}

function prosperHolidayFallbackPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 25 Holiday Fallback)',
        monthlyContribution: 1_350,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 102_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 133,
            durationMonths: 6,
            repayMissedPremiums: false,
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    200,
    150,
    6_500,
    0.5,
  ))
}

function prosperStressPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-20', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 20 Split Stress)',
        monthlyContribution: 1_200,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        assuranceProfile: {
          currentAgeNextBirthday: 46,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 86_000,
        },
        policyEvents: [],
      }),
      PRU_STRESS_FUNDS,
    ),
    6_500,
    21_000,
    4_800,
    0.22,
  ))
}

function assureIiBoundedAssurancePolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      withoutRecurringContribution(
        ilpPolicySchema.parse({
          ...base,
          name: 'Golden PRUVantage Assure II (SGD / MIP 25 Bounded Assurance)',
          currentPolicyYear: 23,
          monthsAlreadyPaid: 276,
          postMipYears: 3,
          assuranceProfile: {
            currentAgeNextBirthday: 68,
            sex: 'male',
            smokerStatus: 'non-smoker',
            currentNetRegularPremiumBase: 100_000,
            currentSumAssured: 148_000,
            currentWealthAssureValue: 101_000,
          },
          policyEvents: [],
        }),
      ),
      PRU_BALANCED_FUNDS,
    ),
    50_000,
    50_000,
    50_000,
  ))
}

function assureIiStateOverridePolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      withoutRecurringContribution(
        ilpPolicySchema.parse({
          ...base,
          name: 'Golden PRUVantage Assure II (SGD / MIP 25 State Override)',
          currentPolicyYear: 24,
          monthsAlreadyPaid: 288,
          postMipYears: 3,
          assuranceProfile: {
            currentAgeNextBirthday: 70,
            sex: 'male',
            smokerStatus: 'non-smoker',
            currentNetRegularPremiumBase: 100_000,
            currentSumAssured: 140_000,
            currentWealthAssureValue: 135_000,
          },
          policyEvents: [
            {
              id: 'reduce-1',
              type: 'assurance-benefit-reduction',
              startPolicyMonth: 289,
              durationMonths: 1,
              resultingSumAssured: 110_000,
              resultingWealthAssureValue: 105_000,
            },
            {
              id: 'resume-1',
              type: 'assurance-benefit-resumption',
              startPolicyMonth: 313,
              durationMonths: 1,
              resultingSumAssured: 140_000,
            },
          ],
        }),
      ),
      PRU_BALANCED_FUNDS,
    ),
    50_000,
    50_000,
    50_000,
  ))
}

function assureIiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  if (variantId === 'sgd-mip-25') {
    return assureIiBoundedAssurancePolicy(snapshot, id)
  }

  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Assure II (${variantId.toUpperCase()})`,
        monthlyContribution: 1_200,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        distributionAssumption,
        assuranceProfile: {
          currentAgeNextBirthday: 48,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 92_000,
          currentSumAssured: 145_000,
          currentWealthAssureValue: 110_000,
        },
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    11_000 + term * 700,
    10_000 + term * 650,
    3_000 + term * 100,
  ))
}

function assureIiEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Assure II (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_300,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        assuranceProfile: {
          currentAgeNextBirthday: 52,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
          currentSumAssured: 150_000,
          currentWealthAssureValue: 120_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 121,
            durationMonths: 4,
            repayMissedPremiums: true,
            repaymentAccountId: 'flex',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 129,
            durationMonths: 1,
            amount: 7_500,
          },
          {
            id: 'withdrawal-free-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 133,
            durationMonths: 1,
            amount: 2_500,
            accountId: 'growth',
          },
          {
            id: 'withdrawal-charged-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 145,
            durationMonths: 1,
            amount: 1_800,
            accountId: 'flex',
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    20_000,
    16_000,
    4_500,
  ))
}

function assureIiHolidayFallbackPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Assure II (SGD / MIP 25 Holiday Fallback)',
        monthlyContribution: 1_300,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        assuranceProfile: {
          currentAgeNextBirthday: 53,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
          currentSumAssured: 150_000,
          currentWealthAssureValue: 122_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 133,
            durationMonths: 6,
            repayMissedPremiums: false,
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    200,
    150,
    6_500,
  ))
}

function assureIiStressPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-20', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Assure II (SGD / MIP 20 Split Stress)',
        monthlyContribution: 1_150,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        assuranceProfile: {
          currentAgeNextBirthday: 47,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 88_000,
          currentSumAssured: 135_000,
          currentWealthAssureValue: 108_000,
        },
        policyEvents: [],
      }),
      PRU_STRESS_FUNDS,
    ),
    7_000,
    22_000,
    5_000,
  ))
}

function tokioEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-max-ii', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Max (II) (SGD / MIP 15 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 37,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 40,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 45,
            durationMonths: 1,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'tokio-marine-wealth-max-ii' | 'tokio-marine-wealth-pro-ii',
  variantId: 'sgd-mip-15' | 'sgd-mip-10',
  id: string,
  name: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, productId, variantId, id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name,
        monthlyContribution: 2_000,
        currentPolicyYear: 1,
        monthsAlreadyPaid: 0,
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    0,
    0,
  )
}

function tokioWealthProEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 37,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 40,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 45,
            durationMonths: 1,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioWealthProWaivedChargesPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Waived Charges)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
            chargeWaived: true,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 40,
            durationMonths: 3,
            chargeWaived: true,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 44,
            durationMonths: 2,
            amount: 600,
            chargeWaived: true,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioWealthProStructuralProofPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Structural Proof)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 38,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 37,
            durationMonths: 3,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    200,
    50,
    300,
  )
}

const GOLDEN_FIXTURE_MANIFEST: GoldenFixtureDefinition[] = [
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC SGD / MIP 25 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-30',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC SGD / MIP 30 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'usd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC USD / MIP 25 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'usd-mip-30',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC USD / MIP 30 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-holiday-repayment',
      'branch:hsbc-bonus-suspension',
      'branch:hsbc-premium-reduction-brc',
      'branch:hsbc-top-up-routing',
    ],
    description: 'HSBC event-heavy scenario covering repayment, suspension, BRC, and top-up routing.',
    integrityChecks: [
      {
        description: 'suppresses AUA bonus during the suspension window',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 15
          && row.accounts.some((account) => account.accountId === 'aua' && account.bonusCredit === 0)
        )),
      },
      {
        description: 'routes top-up contribution into AUA',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
          && row.accounts.some((account) => account.accountId === 'aua' && account.contributionAmount === row.annualContribution)
        )),
      },
      {
        description: 'applies BRC as a material extra IUA charge',
        test: (_, artifact) => {
          const iua = artifact.policyInput.accounts.find((account) => account.id === 'iua')
          return artifact.expected.projections.mid.rows.some((row) => {
            const account = row.accounts.find((candidate) => candidate.accountId === 'iua')
            if (!account || !iua) return false
            return account.grossFee - (account.open * iua.feeRate) > 1_000
          })
        },
      },
      {
        description: 'records the seeded partial withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'aua' && account.withdrawalAmount >= 3_500)
        )),
      },
      {
        description: 'premium-holiday repayment restores a stronger later AUA bonus path than the same holiday without repayment',
        test: (fixture, artifact) => {
          const withoutRepayment = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.map((event) => (
              event.type === 'premium-holiday' ? { ...event, repayMissedPremiums: false, repaymentAccountId: undefined } : event
            )),
          })
          const withRepaymentBonus = artifact.expected.projections.mid.rows
            .filter((row) => row.policyYear >= 18)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'aua')?.bonusCredit ?? 0), 0)
          const withoutRepaymentBonus = analyzeIlpPolicy(withoutRepayment).projections.mid.rows
            .filter((row) => row.policyYear >= 18)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'aua')?.bonusCredit ?? 0), 0)
          return withRepaymentBonus > withoutRepaymentBonus
        },
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-no-repayment',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:hsbc-holiday-no-repayment'],
    description: 'HSBC holiday edge-case without repayment.',
    integrityChecks: [
      {
        description: 'reduces annual contribution when premiums are not repaid',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'does not create negative refund charges without repayment',
        test: (_, artifact) => artifact.expected.projections.mid.rows.every((row) => (
          row.accounts.every((account) => account.grossFee >= 0)
        )),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'usd-mip-30',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC alternate-fund stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-harvest',
    variantId: 'sgd-mip-11',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Harvest baseline scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-harvest',
    variantId: 'sgd-mip-11',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-harvest-holiday-charge',
      'branch:hsbc-harvest-pwc',
      'branch:hsbc-harvest-brc',
      'branch:hsbc-harvest-topup-charge',
    ],
    description: 'HSBC Wealth Harvest supported event-heavy scenario covering holiday charges, BRC, top-up charge, and regular-account PWC.',
    integrityChecks: [
      {
        description: 'premium holiday materially increases regular-account gross fees beyond the base AMF path',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 1_200
        )),
      },
      {
        description: 'the seeded top-up credits the top-up account after its premium charge',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 1_000
        )),
      },
      {
        description: 'BRC adds a material regular-account charge after the reduction event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 1_250
        )),
      },
      {
        description: 'the regular-account partial withdrawal is recorded',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'regular')?.withdrawalAmount ?? 0) >= 500
        )),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-harvest',
    variantId: 'sgd-mip-11',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Harvest alternate-fund stress scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Abundance SGD baseline scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'usd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Abundance USD baseline scenario without recurring single premium under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-abundance-free-withdrawal',
      'branch:hsbc-abundance-tiered-brc',
      'branch:hsbc-abundance-topup-charge',
      'branch:hsbc-abundance-power-up-restoration',
    ],
    description: 'HSBC Wealth Abundance supported event-heavy scenario covering free and charged withdrawals, top-up charge, premium-holiday repayment, and tiered BRC.',
    integrityChecks: [
      {
        description: 'the top-up charge reduces the top-up account contribution below the gross top-up amount',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 1_900
        )),
      },
      {
        description: 'the free first withdrawal keeps regular-account gross fees materially below the charged second withdrawal year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualWithdrawals >= 5_500
          && (() => {
            const regularGrossFee = row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0
            return regularGrossFee > 900 && regularGrossFee < 1_000
          })()
        )),
      },
      {
        description: 'tiered BRC adds a material regular-account charge after the reduction event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 8
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 800
        )),
      },
      {
        description: 'premium-holiday repayment restores a positive annual contribution after the holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 8 && row.annualContribution > 28_000
        )),
      },
      {
        description: 'removing restoration rules materially weakens the later regular-account bonus path',
        test: (fixture, artifact) => {
          const withoutRestoration = ilpPolicySchema.parse({
            ...fixture.policy,
            bonuses: fixture.policy.bonuses.map((bonus) => ({
              ...bonus,
              restorationRules: [],
            })),
          })
          const withRestorationBonus = artifact.expected.projections.mid.rows
            .filter((row) => row.policyYear >= 11)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'regular')?.bonusCredit ?? 0), 0)
          const withoutRestorationBonus = analyzeIlpPolicy(withoutRestoration).projections.mid.rows
            .filter((row) => row.policyYear >= 11)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'regular')?.bonusCredit ?? 0), 0)
          return withRestorationBonus > withoutRestorationBonus
        },
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'usd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Abundance alternate-fund stress scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage SGD / MIP 15 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage SGD / MIP 20 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'usd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage USD / MIP 25 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-voyage-premium-base-amf',
      'branch:hsbc-voyage-tiered-brc',
      'branch:hsbc-voyage-topup-charge',
      'branch:hsbc-voyage-premium-holiday-suspension',
    ],
    description: 'HSBC Wealth Voyage event-heavy scenario covering premium-base AMF, top-up charge, partial withdrawal charge, regular-premium reduction BRC, and a free-duration premium holiday suspension.',
    integrityChecks: [
      {
        description: 'premium-base AMF remains materially above the old account-value fee scale',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 3_000
        )),
      },
      {
        description: 'the seeded top-up reaches the top-up account after its premium charge',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 1_900
        )),
      },
      {
        description: 'tiered startup recovery adds a visible regular-account charge after the reduction event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 3_500
        )),
      },
      {
        description: 'premium holiday suppresses annual contribution below the full committed premium year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && row.annualContribution < artifact.policyInput.monthlyContribution * 12
        )),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 5 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 10 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 15 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 20 scenario with eligible Growth Account cash-payout distributions.',
    integrityChecks: [
      {
        description: 'pays positive annual distributions once the 10-year Growth Account election is eligible',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 25 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:pru-holiday-refund',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
    ],
    description: 'PRUVantage Wealth II event-heavy scenario covering refund, top-up charge, and withdrawal branches.',
    integrityChecks: [
      {
        description: 'creates a negative holiday-charge refund in Growth or Flex',
        test: (fixture, artifact) => {
          const withoutRefund = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.filter((rule) => rule.id !== 'premium-holiday-charge-refund'),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRefund).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
      {
        description: 'records top-up premium in the projection year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
        )),
      },
      {
        description: 'keeps the free withdrawal materially cheaper than the charged withdrawal',
        test: (_, artifact) => {
          const rows = artifact.expected.projections.mid.rows
          const freeRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'growth' && account.withdrawalAmount > 0))
          const chargedRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'flex' && account.withdrawalAmount > 0))
          const freeGrossFee = freeRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const chargedGrossFee = chargedRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return chargedGrossFee > freeGrossFee
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-fallback',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:pru-holiday-fallback'],
    description: 'PRUVantage Wealth II holiday fallback scenario forcing charges into Additional Investment Account.',
    integrityChecks: [
      {
        description: 'routes holiday charge fallback into Additional Investment Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'additional' && account.grossFee > 0)
        )),
      },
      {
        description: 'suppresses annual contribution during the unrepaid holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress-split',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRUVantage Wealth II alternate-fund high-OCF stress scenario with non-default premium split.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 5 scenario.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 10 scenario.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 15 scenario.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 20 scenario with eligible Growth Account cash-payout distributions.',
    integrityChecks: [
      {
        description: 'pays positive annual distributions once the 10-year Growth Account election is eligible',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-25',
    scenarioId: 'assurance-active',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'PRUVantage Prosper baseline scenario with assurance charges active from explicit insured-life inputs.',
    integrityChecks: [
      {
        description: 'applies non-zero Prosper assurance charges to Growth and Flex',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const growthFee = firstRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const flexFee = firstRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return growthFee > 0 && flexFee > 0
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:pru-holiday-refund',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
    ],
    description: 'PRUVantage Prosper event-heavy scenario covering refund, top-up charge, and withdrawal branches.',
    integrityChecks: [
      {
        description: 'creates a negative holiday-charge refund in Growth or Flex',
        test: (fixture, artifact) => {
          const withoutRefund = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.filter((rule) => rule.id !== 'premium-holiday-charge-refund'),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRefund).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
      {
        description: 'records top-up premium in the projection year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
        )),
      },
      {
        description: 'keeps the free withdrawal materially cheaper than the charged withdrawal',
        test: (_, artifact) => {
          const rows = artifact.expected.projections.mid.rows
          const freeRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'growth' && account.withdrawalAmount > 0))
          const chargedRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'flex' && account.withdrawalAmount > 0))
          const freeGrossFee = freeRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const chargedGrossFee = chargedRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return chargedGrossFee > freeGrossFee
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-fallback',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:pru-holiday-fallback'],
    description: 'PRUVantage Prosper holiday fallback scenario forcing charges into Additional Investment Account.',
    integrityChecks: [
      {
        description: 'routes holiday charge fallback into Additional Investment Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'additional' && account.grossFee > 0)
        )),
      },
      {
        description: 'suppresses annual contribution during the unrepaid holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress-split',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRUVantage Prosper alternate-fund high-OCF stress scenario with non-default premium split.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 5 scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 10 scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 15 scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 20 scenario with eligible Growth Account cash-payout distributions.',
    integrityChecks: [
      {
        description: 'pays positive annual distributions once the 10-year Growth Account election is eligible',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'assurance-tail',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance', 'branch:assure-ii-post-70-charge-tail'],
    description: 'PRUVantage Assure II baseline scenario proving pre-70 assurance and the post-70 charge tail.',
    integrityChecks: [
      {
        description: 'applies non-zero Assure II combined assurance before age 70',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const growthFee = firstRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return growthFee > 0
        },
      },
      {
        description: 'continues non-zero Assure II assurance charges after age 70 from the published rate curve',
        test: (_, artifact) => {
          const laterRow = artifact.expected.projections.mid.rows.find((row) => row.policyYear >= 26)
          const growthFee = laterRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return growthFee > 0
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:pru-holiday-refund',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
    ],
    description: 'PRUVantage Assure II event-heavy scenario covering refund, top-up charge, and withdrawal branches.',
    integrityChecks: [
      {
        description: 'creates a negative holiday-charge refund in Growth or Flex',
        test: (fixture, artifact) => {
          const withoutRefund = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.filter((rule) => rule.id !== 'premium-holiday-charge-refund'),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRefund).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
      {
        description: 'records top-up premium in the projection year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
        )),
      },
      {
        description: 'keeps the free withdrawal materially cheaper than the charged withdrawal',
        test: (_, artifact) => {
          const rows = artifact.expected.projections.mid.rows
          const freeRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'growth' && account.withdrawalAmount > 0))
          const chargedRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'flex' && account.withdrawalAmount > 0))
          const freeGrossFee = freeRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const chargedGrossFee = chargedRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return chargedGrossFee > freeGrossFee
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-fallback',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:pru-holiday-fallback'],
    description: 'PRUVantage Assure II holiday fallback scenario forcing charges into Additional Investment Account.',
    integrityChecks: [
      {
        description: 'routes holiday charge fallback into Additional Investment Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'additional' && account.grossFee > 0)
        )),
      },
      {
        description: 'suppresses annual contribution during the unrepaid holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress-split',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRUVantage Assure II alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'assurance-state-override',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:assure-ii-manual-reduction-resumption'],
    description: 'PRUVantage Assure II scenario proving manual reduction and later resumption of the assurance state.',
    integrityChecks: [
      {
        description: 'reduced assurance state lowers the charge after the reduction year',
        test: (_, artifact) => {
          const reductionYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 25)
          const frozenYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 26)
          const reducedGrowthFee = reductionYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const frozenGrowthFee = frozenYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return reducedGrowthFee > frozenGrowthFee && frozenGrowthFee > 0
        },
      },
      {
        description: 'resumption restores a higher charge path from the next policy year',
        test: (_, artifact) => {
          const frozenYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 26)
          const resumedYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 27)
          const frozenGrowthFee = frozenYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const resumedGrowthFee = resumedYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return resumedGrowthFee > frozenGrowthFee
        },
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth (SP) cash scenario proving the initial single-premium charge and Direct Income cash-payout support.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'pays positive annual distributions under the cash Direct Income assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth (SP) SRS scenario proving the supported initial single-premium corridor without Direct Income payouts.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline PRULink InvestGrowth (SP) CPF scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the initial single-premium corridor fee-free under the published CPF charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:prulink-investgrowth-sp-top-up-charge',
      'branch:prulink-investgrowth-sp-top-up-assurance-charge',
    ],
    description: 'PRULink InvestGrowth (SP) cash event-heavy scenario proving standard top-up premium and assurance charges.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRULink InvestGrowth (SP) cash alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth cash scenario proving the supported recurring-premium corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth SRS scenario proving the supported recurring-premium corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline PRULink InvestGrowth CPF scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the recurring-premium corridor fee-free under the published CPF charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:prulink-investgrowth-top-up-charge',
      'branch:prulink-investgrowth-top-up-assurance-charge',
    ],
    description: 'PRULink InvestGrowth cash event-heavy scenario proving standard top-up premium and assurance charges.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'top-up event increases cumulative fees beyond the recurring-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRULink InvestGrowth cash alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'income-wealthlink-gl3',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-wealthlink-gl3-single-premium-charge',
    ],
    description: 'Baseline WealthLink (GL3) scenario proving the supported upfront single-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'income-wealthlink-gl3',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:income-wealthlink-gl3-top-up-premium-charge',
      'branch:income-wealthlink-gl3-recurring-single-premium-charge',
      'branch:income-wealthlink-gl3-open-ended-zero-surrender-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'WealthLink (GL3) event-heavy scenario proving top-up, recurring single-premium, and zero-charge withdrawal behavior.',
    integrityChecks: [
      {
        description: 'top-up and recurring single-premium events increase cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'income-wealthlink-gl3',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'WealthLink (GL3) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia-sp-initial-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage (SP) cash/SRS scenario proving the supported upfront single-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cpfis',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline GREAT Invest Advantage (SP) CPFIS scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the initial single-premium corridor fee-free under the published CPFIS charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia-sp-top-up-premium-charge',
      'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage (SP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage (SP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia2-sp-initial-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage 2 (SP) scenario proving the supported upfront single-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia2-sp-top-up-premium-charge',
      'branch:great-eastern-gia2-sp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage 2 (SP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage 2 (SP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia-rsp-recurrent-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage (RSP) cash/SRS scenario proving the supported recurrent-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cpfis',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline GREAT Invest Advantage (RSP) CPFIS scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the recurring-premium corridor fee-free under the published CPFIS charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia-rsp-top-up-premium-charge',
      'branch:great-eastern-gia-rsp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage (RSP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the recurring-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage (RSP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-flexi-protector',
    variantId: 'sgd-open-ended-regular-pay',
    scenarioId: 'assurance-choice-vs-max',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['baseline', 'branch:hsbc-flexi-choice-max-assurance'],
    description: 'HSBC Life Flexi Protector bounded manual subset proving the normalized death / TI assurance path distinguishes Choice and Max cover formulas.',
    manualSource: {
      supportStatus: 'partial',
      sourceFileName: 'HSBC Life Flexi Protector Product Summary.pdf',
      sourceChecksumSha256: '3e6a2d15210a993587f2ec37fce0dc90e5e7f9ac2de3ba99bea98588c634df83',
    },
    integrityChecks: [
      {
        description: 'Choice cover applies a non-zero death / TI assurance charge from the normalized path',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const policyValueFee = firstRow?.accounts.find((account) => account.accountId === 'policy-value')?.grossFee ?? 0
          return policyValueFee > 0
        },
      },
      {
        description: 'Max cover produces a higher first-year death / TI assurance charge than Choice from the same balances',
        test: (fixture) => {
          const maxPolicy = ilpPolicySchema.parse({
            ...fixture.policy,
            chargeRules: fixture.policy.chargeRules?.map((rule) => ({
              ...rule,
              id: 'flexi-max-death-ti',
              assuranceConfig: rule.assuranceConfig
                ? {
                    ...rule.assuranceConfig,
                    formula: 'hsbc-flexi-max-death-ti',
                  }
                : undefined,
            })),
          })
          const choiceFee = analyzeIlpPolicy(fixture.policy).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'policy-value')?.grossFee ?? 0
          const maxFee = analyzeIlpPolicy(maxPolicy).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'policy-value')?.grossFee ?? 0
          return maxFee > choiceFee
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-max-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['baseline', 'branch:tokio-bonus-ladder', 'branch:tokio-post-mip-routing'],
    description: 'Tokio Marine Wealth Max (II) modeled-subset baseline proving later performance, loyalty, and power-up bonus credit on top of the seeded bonus ladder.',
    integrityChecks: [
      {
        description: 'performance investment bonus eventually credits the Accumulation Units Account after the ICP routing phase',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 5
            && row.policyYear <= 15
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'loyalty and power-up bonuses both become active in the post-MIP tail',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 16
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
            && (row.accounts.find((account) => account.accountId === 'initial')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'post-MIP regular premiums route back into the Initial Units Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear > 15
          && row.annualContribution > 0
          && (row.accounts.find((account) => account.accountId === 'initial')?.contributionAmount ?? 0) === row.annualContribution
          && (row.accounts.find((account) => account.accountId === 'accumulation')?.contributionAmount ?? 0) === 0
        )),
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-max-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
    ],
    description: 'Tokio Marine Wealth Max (II) modeled-subset scenario covering recurring-single-premium resumption, shortfall exclusivity, and reduction ordering.',
    integrityChecks: [
      {
        description: 'manual recurring-single-premium resumption restores additional top-up contribution after the holiday window',
        test: (fixture, artifact) => {
          const withoutResumption = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'recurring-single-premium-resumption'),
          })
          const withResumptionContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          const withoutResumptionContribution = analyzeIlpPolicy(withoutResumption).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return withResumptionContribution > withoutResumptionContribution
        },
      },
      {
        description: 'reduction consumes recurring single premium first before cutting the regular-premium path',
        test: (_, artifact) => {
          const topupContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return topupContribution > 0 && topupContribution < 700
        },
      },
      {
        description: 'exclusive shortfall grouping avoids charging both Tokio shortfall paths together',
        test: (fixture, artifact) => {
          const withoutExclusivity = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.map((rule) => ({
              ...rule,
              exclusiveGroup: undefined,
              groupResolution: undefined,
            })),
          })
          const withExclusiveFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutExclusiveFees = analyzeIlpPolicy(withoutExclusivity).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withExclusiveFees < withoutExclusiveFees
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['baseline', 'branch:tokio-bonus-ladder', 'branch:tokio-post-mip-routing'],
    description: 'Tokio Marine Wealth Pro (II) modeled-subset baseline proving later performance, loyalty, and power-up bonus credit on top of the seeded bonus ladder.',
    integrityChecks: [
      {
        description: 'performance investment bonus eventually credits the Accumulation Units Account after the ICP routing phase',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 5
            && row.policyYear <= 10
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'loyalty and power-up bonuses both become active in the post-MIP tail',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 11
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
            && (row.accounts.find((account) => account.accountId === 'initial')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'post-MIP regular premiums route back into the Initial Units Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear > 10
          && row.annualContribution > 0
          && (row.accounts.find((account) => account.accountId === 'initial')?.contributionAmount ?? 0) === row.annualContribution
          && (row.accounts.find((account) => account.accountId === 'accumulation')?.contributionAmount ?? 0) === 0
        )),
      },
      {
        description: 'lowering the premium tier weakens the later Tokio accumulation bonus path',
        test: (fixture, artifact) => {
          const lowerTierPolicy = ilpPolicySchema.parse({
            ...fixture.policy,
            monthlyContribution: 1_000,
          })
          const baselineAccumulationBonus = artifact.expected.projections.mid.rows
            .filter((row) => row.policyYear >= 6 && row.policyYear <= 10)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0), 0)
          const lowerTierAccumulationBonus = analyzeIlpPolicy(lowerTierPolicy).projections.mid.rows
            .filter((row) => row.policyYear >= 6 && row.policyYear <= 10)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0), 0)
          return baselineAccumulationBonus > lowerTierAccumulationBonus
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
    ],
    description: 'Tokio Marine Wealth Pro (II) modeled-subset scenario covering recurring-single-premium resumption, shortfall exclusivity, and reduction ordering.',
    integrityChecks: [
      {
        description: 'manual recurring-single-premium resumption restores additional top-up contribution after the holiday window',
        test: (fixture, artifact) => {
          const withoutResumption = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'recurring-single-premium-resumption'),
          })
          const withResumptionContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          const withoutResumptionContribution = analyzeIlpPolicy(withoutResumption).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return withResumptionContribution > withoutResumptionContribution
        },
      },
      {
        description: 'reduction consumes recurring single premium first before cutting the regular-premium path',
        test: (_, artifact) => {
          const topupContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return topupContribution > 0 && topupContribution < 700
        },
      },
      {
        description: 'exclusive shortfall grouping avoids charging both Tokio shortfall paths together',
        test: (fixture, artifact) => {
          const withoutExclusivity = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.map((rule) => ({
              ...rule,
              exclusiveGroup: undefined,
              groupResolution: undefined,
            })),
          })
          const withExclusiveFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutExclusiveFees = analyzeIlpPolicy(withoutExclusivity).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withExclusiveFees < withoutExclusiveFees
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'waived-charges',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['event-heavy', 'branch:tokio-charge-waiver'],
    description: 'Tokio Marine Wealth Pro (II) modeled-subset scenario proving explicit insurer-approved charge waivers for withdrawal and shortfall events.',
    integrityChecks: [
      {
        description: 'waived events materially reduce cumulative gross fees versus the same events without waivers',
        test: (fixture, artifact) => {
          const withoutWaivers = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.map((event) => ({
              ...event,
              chargeWaived: false,
            })),
          })
          const withWaiverFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutWaiverFees = analyzeIlpPolicy(withoutWaivers).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withWaiverFees < withoutWaiverFees
        },
      },
      {
        description: 'the waived partial withdrawal still executes against the accumulation account',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'accumulation')?.withdrawalAmount ?? 0) >= 500,
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'structural-proof',
    fixtureClass: 'partial-modeled-subset',
    coverageTags: ['event-heavy', 'branch:tokio-multi-account-structure'],
    description: 'Tokio Marine Wealth Pro (II) structural proof scenario covering supplementary routing, fallback deduction into non-primary accounts, and accumulation-only withdrawal scope.',
    integrityChecks: [
      {
        description: 'supplementary premium routing keeps the explicit top-up premium in the Top-up Units Account while regular premium stays off the top-up path',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const topupContribution = firstRow?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          const initialContribution = firstRow?.accounts.find((account) => account.accountId === 'initial')?.contributionAmount ?? 0
          return topupContribution >= 1_000 && initialContribution === 0
        },
      },
      {
        description: 'shortfall fallback reaches the Top-up and Initial Units Accounts when the Accumulation Units Account is insufficient',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const topupFee = firstRow?.accounts.find((account) => account.accountId === 'topup')?.grossFee ?? 0
          const initialFee = firstRow?.accounts.find((account) => account.accountId === 'initial')?.grossFee ?? 0
          return topupFee > 50 && initialFee > 0
        },
      },
      {
        description: 'the seeded withdrawal stays on the Accumulation Units Account rather than leaking into Top-up or Initial Units',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const accumulationWithdrawal = firstRow?.accounts.find((account) => account.accountId === 'accumulation')?.withdrawalAmount ?? 0
          const topupWithdrawal = firstRow?.accounts.find((account) => account.accountId === 'topup')?.withdrawalAmount ?? 0
          const initialWithdrawal = firstRow?.accounts.find((account) => account.accountId === 'initial')?.withdrawalAmount ?? 0
          return accumulationWithdrawal >= 500 && topupWithdrawal === 0 && initialWithdrawal === 0
        },
      },
    ],
  },
]

function buildPolicyForDefinition(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  definition: GoldenFixtureDefinition,
): IlpPolicyInput {
  const id = `${definition.productId}-${definition.variantId}-${definition.scenarioId}`

  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'baseline') {
    return hsbcBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'event-heavy') {
    return hsbcEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'holiday-no-repayment') {
    return hsbcHolidayNoRepaymentPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'ocf-stress') {
    return hsbcStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-harvest' && definition.scenarioId === 'baseline') {
    return hsbcHarvestBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-harvest' && definition.scenarioId === 'event-heavy') {
    return hsbcHarvestEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-harvest' && definition.scenarioId === 'ocf-stress') {
    return hsbcHarvestStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-abundance' && definition.scenarioId === 'baseline') {
    return hsbcAbundanceBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'hsbc-life-wealth-abundance' && definition.scenarioId === 'event-heavy') {
    return hsbcAbundanceEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-abundance' && definition.scenarioId === 'ocf-stress') {
    return hsbcAbundanceStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-voyage' && definition.scenarioId === 'baseline') {
    return hsbcVoyageBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'hsbc-life-wealth-voyage' && definition.scenarioId === 'event-heavy') {
    return hsbcVoyageEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'baseline') {
    return pruBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'event-heavy') {
    return pruEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'holiday-fallback') {
    return pruHolidayFallbackPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'ocf-stress-split') {
    return pruStressSplitPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'baseline') {
    return prosperBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'assurance-active') {
    return prosperAssurancePolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth-sp' && definition.scenarioId === 'baseline') {
    return pruInvestGrowthSpBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth-sp' && definition.scenarioId === 'event-heavy') {
    return pruInvestGrowthSpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth-sp' && definition.scenarioId === 'ocf-stress') {
    return pruInvestGrowthSpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth' && definition.scenarioId === 'baseline') {
    return pruInvestGrowthRegularBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth' && definition.scenarioId === 'event-heavy') {
    return pruInvestGrowthRegularEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth' && definition.scenarioId === 'ocf-stress') {
    return pruInvestGrowthRegularStressPolicy(snapshot, id)
  }
  if (definition.productId === 'income-wealthlink-gl3' && definition.scenarioId === 'baseline') {
    return incomeWealthLinkGl3BaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'income-wealthlink-gl3' && definition.scenarioId === 'event-heavy') {
    return incomeWealthLinkGl3EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'income-wealthlink-gl3' && definition.scenarioId === 'ocf-stress') {
    return incomeWealthLinkGl3StressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-sp' && definition.scenarioId === 'baseline') {
    return greatEasternGiaSpBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis', id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-sp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGiaSpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-sp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGiaSpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-sp' && definition.scenarioId === 'baseline') {
    return greatEasternGia2SpBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-sp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGia2SpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-sp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGia2SpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-rsp' && definition.scenarioId === 'baseline') {
    return greatEasternGiaRspBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis', id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-rsp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGiaRspEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-rsp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGiaRspStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'event-heavy') {
    return prosperEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'holiday-fallback') {
    return prosperHolidayFallbackPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'ocf-stress-split') {
    return prosperStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'baseline') {
    return assureIiBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'assurance-tail') {
    return assureIiBoundedAssurancePolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'event-heavy') {
    return assureIiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'holiday-fallback') {
    return assureIiHolidayFallbackPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'ocf-stress-split') {
    return assureIiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'assurance-state-override') {
    return assureIiStateOverridePolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-flexi-protector' && definition.scenarioId === 'assurance-choice-vs-max') {
    return hsbcFlexiChoiceAssurancePolicy(id)
  }
  if (definition.productId === 'tokio-marine-wealth-max-ii' && definition.scenarioId === 'baseline') {
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-max-ii',
      'sgd-mip-15',
      id,
      'Golden Tokio Marine Wealth Max (II) (SGD / MIP 15 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-max-ii' && definition.scenarioId === 'event-heavy') {
    return tokioEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'baseline') {
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-pro-ii',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'event-heavy') {
    return tokioWealthProEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'waived-charges') {
    return tokioWealthProWaivedChargesPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'structural-proof') {
    return tokioWealthProStructuralProofPolicy(snapshot, id)
  }

  throw new Error(`No golden policy builder is defined for ${definition.productId}:${definition.variantId}:${definition.scenarioId}.`)
}

export function listGoldenFixtureCoverageTargets(): GoldenFixtureCoverageTarget[] {
  return GOLDEN_FIXTURE_MANIFEST.map((fixture) => ({
    productId: fixture.productId,
    variantId: fixture.variantId,
    scenarioId: fixture.scenarioId,
    fixtureClass: fixture.fixtureClass,
    coverageTags: [...fixture.coverageTags],
  }))
}

export function buildGoldenIlpFixtureInputs(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
): GoldenIlpFixtureInput[] {
  return GOLDEN_FIXTURE_MANIFEST.map((definition) => {
    const id = `${definition.productId}-${definition.variantId}-${definition.scenarioId}`
    const policy = buildPolicyForDefinition(snapshot, definition)

    return {
      id,
      fileName: `${id}.json`,
      fixtureClass: definition.fixtureClass,
      productId: definition.productId,
      variantId: definition.variantId,
      scenarioId: definition.scenarioId,
      coverageTags: [...definition.coverageTags],
      description: definition.description,
      policy,
      manualSource: definition.manualSource,
      integrityChecks: definition.integrityChecks,
    }
  })
}
