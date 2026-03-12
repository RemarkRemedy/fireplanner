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
  | 'branch:pru-holiday-refund'
  | 'branch:pru-holiday-fallback'
  | 'branch:pru-top-up-charge'
  | 'branch:pru-free-withdrawal'
  | 'branch:pru-charged-withdrawal'

export interface GoldenFixtureCoverageTarget {
  productId: string
  variantId: string
  scenarioId: string
  fixtureClass: GoldenIlpFixtureClass
  coverageTags: GoldenCoverageTag[]
}

export interface GoldenIlpFixtureInput extends GoldenFixtureCoverageTarget {
  id: string
  fileName: `${string}.json`
  description: string
  policy: IlpPolicyInput
  integrityChecks?: Array<{
    description: string
    test: (fixture: GoldenIlpFixtureInput, artifact: GoldenFixtureArtifact) => boolean
  }>
}

interface GoldenFixtureDefinition extends GoldenFixtureCoverageTarget {
  description: string
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

function cloneFunds(funds: IlpFund[]): IlpFund[] {
  return funds.map((fund) => ({ ...fund }))
}

function clonePolicySeedIntoInput(seed: ReturnType<typeof templateVariantToPolicySeed>, id: string): IlpPolicyInput {
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
      tieredRates: bonus.tieredRates?.map((tier) => ({ ...tier })),
      suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })),
      restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
    })),
    chargeRules: seed.chargeRules?.map((rule) => ({
      ...rule,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      amountSchedule: rule.amountSchedule?.map((tier) => ({ ...tier })),
    })) ?? [],
    eventChargeRules: seed.eventChargeRules?.map((rule) => ({
      ...rule,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
    })) ?? [],
    catalogSource: seed.catalogSource ? { ...seed.catalogSource } : undefined,
    catalogWarnings: seed.catalogWarnings ? [...seed.catalogWarnings] : undefined,
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
): IlpPolicyInput {
  const product = requireProduct(snapshot, productId)
  const variant = requireVariant(product, variantId)
  return clonePolicySeedIntoInput(templateVariantToPolicySeed(product, variant, snapshot.manifest), fixtureId)
}

function withFunds(policy: IlpPolicyInput, funds: IlpFund[]): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    funds: cloneFunds(funds),
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

function pruBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)

  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Wealth II (${variantId.toUpperCase()})`,
        monthlyContribution: 1_400,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
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
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 20 scenario.',
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
      integrityChecks: definition.integrityChecks,
    }
  })
}
