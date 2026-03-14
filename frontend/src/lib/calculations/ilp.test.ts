import { describe, expect, it } from 'vitest'
import {
  analyzeAllPolicies,
  analyzeIlpPolicy,
  buildComparisonTable,
  computeBlendedReturn,
  computeNpvAnalysis,
  computeOpportunityCost,
  computeSummaryMetrics,
  computeTotalProjectionYears,
  projectIlpPolicy,
  type IlpAccount,
  type IlpAccountYearRow,
  type IlpBonusRule,
  type IlpChargeRule,
  type IlpFund,
  type IlpPolicyInput,
} from './ilp'
import {
  DEFAULT_AUA_FEE_RATE,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_IUA_FEE_RATE,
  EEC_PRESET_MIP_30,
} from '@/lib/data/ilpDefaults'
import { ilpPolicySchema } from '@/lib/validation/ilpSchema'

const FUNDSMITH: IlpFund = {
  name: 'Fundsmith Equity Fund Feeder EUR',
  allocation: 0.7,
  ocf: 0.0156,
  grossReturnLow: 0.085,
  grossReturnMid: 0.11,
  grossReturnHigh: 0.135,
}

const GS_EM: IlpFund = {
  name: 'Goldman Sachs EM Core Equity USD',
  allocation: 0.15,
  ocf: 0.0154,
  grossReturnLow: 0.11,
  grossReturnMid: 0.135,
  grossReturnHigh: 0.16,
}

const PICTET_DEBT: IlpFund = {
  name: 'Pictet Global Emerging Debt USD',
  allocation: 0.15,
  ocf: 0.0137,
  grossReturnLow: 0.045,
  grossReturnMid: 0.05,
  grossReturnHigh: 0.06,
}

const ZERO_RETURN_FUND: IlpFund = {
  name: 'Zero Return Test Fund',
  allocation: 1,
  ocf: 0,
  grossReturnLow: 0,
  grossReturnMid: 0,
  grossReturnHigh: 0,
}

const IUA_ACCOUNT: IlpAccount = {
  id: 'iua',
  label: 'Initial Unit Account',
  feeRate: DEFAULT_IUA_FEE_RATE,
  currentValue: 29_000,
  contributionShare: 0,
  subjectToEec: true,
  postMipFeeRate: DEFAULT_AUA_FEE_RATE,
}

const AUA_ACCOUNT: IlpAccount = {
  id: 'aua',
  label: 'Accumulation Unit Account',
  feeRate: DEFAULT_AUA_FEE_RATE,
  currentValue: 0,
  contributionShare: 1,
  subjectToEec: false,
  postMipFeeRate: null,
}

const POWER_UP: IlpBonusRule = {
  id: 'power-up-bonus',
  type: 'power-up',
  label: 'Power-up Bonus',
  mode: 'annual-rate',
  rate: 0.0125,
  amount: 0,
  appliesTo: ['aua'],
  startPolicyYear: 15,
  endPolicyYear: 25,
}

const LOYALTY: IlpBonusRule = {
  id: 'loyalty-bonus',
  type: 'loyalty',
  label: 'Loyalty Bonus',
  mode: 'annual-rate',
  rate: 0.011,
  amount: 0,
  appliesTo: [],
  startPolicyYear: 30,
  endPolicyYear: null,
}

const POLICY_CHARGE_RULES: IlpChargeRule[] = [
  {
    id: 'platform-fee',
    label: 'Platform Fee',
    basis: 'fixed-annual',
    activeWindow: 'during-mip',
    appliesTo: ['iua', 'aua'],
    rate: 0,
    amount: 120,
    allocation: 'pro-rata-by-value',
  },
  {
    id: 'premium-charge',
    label: 'Premium Charge',
    basis: 'annual-contribution',
    activeWindow: 'during-mip',
    appliesTo: ['aua'],
    rate: 0.05,
    amount: 0,
    allocation: 'equal-split',
  },
]

const PRUDENTIAL_PROSPER_ACCOUNTS: IlpAccount[] = [
  {
    id: 'growth',
    label: 'Growth Account',
    feeRate: 0,
    currentValue: 50_000,
    contributionShare: 0.5,
    subjectToEec: false,
    postMipFeeRate: null,
  },
  {
    id: 'flex',
    label: 'Flex Account',
    feeRate: 0,
    currentValue: 50_000,
    contributionShare: 0.5,
    subjectToEec: false,
    postMipFeeRate: null,
  },
  {
    id: 'additional',
    label: 'Additional Investment Account',
    feeRate: 0,
    currentValue: 50_000,
    contributionShare: 0,
    subjectToEec: false,
    postMipFeeRate: null,
  },
]

function makeDefaultPolicy(overrides: Partial<IlpPolicyInput> = {}): IlpPolicyInput {
  return {
    id: 'policy-1',
    name: 'Test Policy',
    insurer: 'Test Insurer',
    currency: 'USD',
    monthlyContribution: 350,
    monthsAlreadyPaid: 60,
    currentPolicyYear: 5,
    accounts: [IUA_ACCOUNT, AUA_ACCOUNT],
    mipLength: 30,
    postMipYears: 0,
    eecTable: [...EEC_PRESET_MIP_30],
    funds: [FUNDSMITH, GS_EM, PICTET_DEBT],
    bonuses: [POWER_UP, LOYALTY],
    discountRate: DEFAULT_DISCOUNT_RATE,
    inflationRate: DEFAULT_INFLATION_RATE,
    alternativeReturn: 0.07,
    ...overrides,
  }
}

function accountRow(
  row: { accounts: IlpAccountYearRow[] },
  accountId: string,
) {
  const match = row.accounts.find((account) => account.accountId === accountId)
  expect(match).toBeDefined()
  return match!
}

describe('computeBlendedReturn', () => {
  it('computes weighted average net return for mid scenario', () => {
    expect(computeBlendedReturn([FUNDSMITH, GS_EM, PICTET_DEBT], 'mid')).toBeCloseTo(0.089465, 5)
  })

  it('computes weighted average net return for low scenario', () => {
    expect(computeBlendedReturn([FUNDSMITH, GS_EM, PICTET_DEBT], 'low')).toBeCloseTo(0.067465, 5)
  })
})

describe('projectIlpPolicy', () => {
  it('projects to MIP end by default', () => {
    const policy = makeDefaultPolicy()
    const result = projectIlpPolicy(policy, 'mid')

    expect(computeTotalProjectionYears(policy)).toBe(25)
    expect(result.rows).toHaveLength(25)
    expect(result.rows[0].policyYear).toBe(6)
  })

  it('uses current balances as year-one opens and routes contributions by contributionShare', () => {
    const policy = makeDefaultPolicy()
    const result = projectIlpPolicy(policy, 'mid')
    const firstRow = result.rows[0]

    expect(accountRow(firstRow, 'iua').open).toBe(29_000)
    expect(accountRow(firstRow, 'aua').open).toBe(0)
    expect(firstRow.annualContribution).toBe(4_200)
    expect(accountRow(firstRow, 'aua').close).toBeCloseTo(4_200, 2)
  })

  it('computes gross fee, bonuses, and close value using workbook semantics', () => {
    const policy = makeDefaultPolicy()
    const result = projectIlpPolicy(policy, 'mid')
    const iua = accountRow(result.rows[0], 'iua')

    expect(iua.grossFee).toBeCloseTo(1_015, 2)
    expect(iua.bonusCredit).toBe(0)
    expect(iua.netFee).toBeCloseTo(1_015, 2)
    expect(iua.close).toBeCloseTo((29_000 - 1_015) * (1 + result.blendedNetReturn), 2)
  })

  it('applies power-up and loyalty bonuses, including negative net fees', () => {
    const policy = makeDefaultPolicy({ postMipYears: 1 })
    const result = projectIlpPolicy(policy, 'mid')
    const powerUpRow = result.rows[9]
    const loyaltyRow = result.rows[24]

    expect(powerUpRow.policyYear).toBe(15)
    expect(accountRow(powerUpRow, 'aua').netFee).toBeLessThan(0)
    expect(loyaltyRow.policyYear).toBe(30)
    expect(accountRow(loyaltyRow, 'iua').netFee).toBeCloseTo(accountRow(loyaltyRow, 'iua').open * 0.024, 2)
  })

  it('applies annual-rate tiered bonuses using account-value bands', () => {
    const policy = makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      accounts: [{
        id: 'core',
        label: 'Core Account',
        feeRate: 0,
        currentValue: 120_000,
        contributionShare: 0,
        subjectToEec: false,
        postMipFeeRate: null,
      }],
      funds: [{
        name: 'Cash Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [{
        id: 'additional-bonus-units',
        type: 'loyalty',
        label: 'Additional Bonus Units',
        mode: 'annual-rate',
        rate: 0,
        amount: 0,
        appliesTo: ['core'],
        startPolicyYear: 1,
        endPolicyYear: null,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 0, maxAccountValue: 29_999, rate: 0 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 30_000, maxAccountValue: 99_999, rate: 0.001 },
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 100_000, maxAccountValue: 499_999, rate: 0.002 },
        ],
      }],
    })

    const result = projectIlpPolicy(policy, 'mid')
    const row = result.rows[0]

    expect(accountRow(row, 'core').bonusCredit).toBeCloseTo(240, 2)
    expect(accountRow(row, 'core').close).toBeCloseTo(120_240, 2)
  })

  it('splits premium-allocation and one-time bonuses evenly across target accounts', () => {
    const accounts: IlpAccount[] = [
      IUA_ACCOUNT,
      { ...AUA_ACCOUNT, id: 'aua1', label: 'AUA 1', contributionShare: 0.5 },
      { ...AUA_ACCOUNT, id: 'aua2', label: 'AUA 2', contributionShare: 0.5 },
    ]
    const allocationBonus: IlpBonusRule = {
      id: 'premium-bonus',
      type: 'allocation',
      label: 'Premium Bonus',
      mode: 'premium-allocation',
      rate: 0.05,
      amount: 0,
      appliesTo: ['aua1', 'aua2'],
      startPolicyYear: 1,
      endPolicyYear: null,
    }
    const oneTimeBonus: IlpBonusRule = {
      id: 'sign-up-bonus',
      type: 'sign-up',
      label: 'Sign-up Bonus',
      mode: 'one-time',
      rate: 0,
      amount: 600,
      appliesTo: ['aua1', 'aua2'],
      startPolicyYear: 6,
      endPolicyYear: null,
    }
    const policy = makeDefaultPolicy({
      accounts,
      bonuses: [allocationBonus, oneTimeBonus],
      currentPolicyYear: 5,
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'aua1').bonusCredit).toBeCloseTo(405, 2)
    expect(accountRow(result.rows[0], 'aua2').bonusCredit).toBeCloseTo(405, 2)
    expect(accountRow(result.rows[1], 'aua1').bonusCredit).toBeCloseTo(105, 2)
  })

  it('stops contributions post-MIP and uses postMipFeeRate when provided', () => {
    const policy = makeDefaultPolicy({ postMipYears: 2 })
    const result = projectIlpPolicy(policy, 'mid')
    const postMipRow = result.rows[25]

    expect(postMipRow.policyYear).toBe(31)
    expect(postMipRow.annualContribution).toBe(0)
    expect(accountRow(postMipRow, 'iua').netFee).toBeCloseTo(accountRow(postMipRow, 'iua').open * (0.01 - 0.011), 2)
  })

  it('routes contributions by phase when contributionRules are present', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 1,
      monthsAlreadyPaid: 6,
      icpMonths: 12,
      accounts: [
        {
          ...IUA_ACCOUNT,
          currentValue: 10_000,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
          ],
        },
        {
          ...AUA_ACCOUNT,
          currentValue: 1_000,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 0 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')
    const firstRow = result.rows[0]

    expect(accountRow(firstRow, 'iua').close).toBeCloseTo((10_000 - 350) * (1 + result.blendedNetReturn) + 2_100, 2)
    expect(accountRow(firstRow, 'aua').close).toBeCloseTo((1_000 - 10) * (1 + result.blendedNetReturn) + 2_100, 2)
  })

  it('continues regular premiums after MIP when after-mip contributionRules are defined', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 29,
      mipLength: 30,
      postMipYears: 2,
      accounts: [
        {
          ...IUA_ACCOUNT,
          currentValue: 10_000,
          contributionShare: 0,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 0 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          ...AUA_ACCOUNT,
          currentValue: 20_000,
          contributionShare: 1,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
            { phase: 'after-mip', contributionShare: 0 },
          ],
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')
    const mipRow = result.rows[0]
    const postMipRow = result.rows[1]

    expect(mipRow.policyYear).toBe(30)
    expect(accountRow(mipRow, 'iua').contributionAmount).toBeCloseTo(4_200, 2)
    expect(postMipRow.policyYear).toBe(31)
    expect(postMipRow.annualContribution).toBeCloseTo(4_200, 2)
    expect(accountRow(postMipRow, 'iua').contributionAmount).toBeCloseTo(4_200, 2)
    expect(accountRow(postMipRow, 'aua').contributionAmount).toBeCloseTo(0, 2)
  })

  it('routes top-up events through explicit top-up contribution rules', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 1,
      monthsAlreadyPaid: 0,
      accounts: [
        {
          ...IUA_ACCOUNT,
          currentValue: 10_000,
          contributionShare: 0.5,
          contributionRules: [{ phase: 'during-icp', contributionShare: 0.5 }],
        },
        {
          ...AUA_ACCOUNT,
          currentValue: 5_000,
          contributionShare: 0.5,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 0.5 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 3,
          durationMonths: 1,
          amount: 2_000,
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(6_200)
    expect(result.rows[0].cumulativePremiums).toBe(6_200)
    expect(accountRow(result.rows[0], 'iua').close).toBeCloseTo((10_000 - 350) * (1 + result.blendedNetReturn) + 2_100, 2)
    expect(accountRow(result.rows[0], 'aua').close).toBeCloseTo((5_000 - 50) * (1 + result.blendedNetReturn) + 4_100, 2)
  })

  it('allows a top-up event to target a specific account directly', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 10_000, contributionShare: 0 },
        { ...AUA_ACCOUNT, currentValue: 5_000, contributionShare: 1 },
      ],
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 2,
          durationMonths: 1,
          amount: 1_500,
          accountId: 'iua',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(5_700)
    expect(accountRow(result.rows[0], 'iua').close).toBeCloseTo((10_000 - 350) * (1 + result.blendedNetReturn) + 1_500, 2)
    expect(accountRow(result.rows[0], 'aua').close).toBeCloseTo((5_000 - 50) * (1 + result.blendedNetReturn) + 4_200, 2)
  })

  it('applies event-triggered premium charges on top-up contributions', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 10_000, contributionShare: 0 },
        {
          ...AUA_ACCOUNT,
          id: 'additional',
          label: 'Additional',
          currentValue: 5_000,
          contributionShare: 0,
          contributionRules: [{ phase: 'top-up', contributionShare: 1 }],
        },
      ],
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 2,
          durationMonths: 1,
          amount: 1_500,
        },
      ],
      eventChargeRules: [
        {
          id: 'top-up-premium-charge',
          label: 'Top-up Charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['additional'],
          rate: 0.03,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(1_500)
    expect(accountRow(result.rows[0], 'additional').grossFee).toBeCloseTo(95, 2)
  })

  it('routes recurring single premiums across overlapping months and applies the published premium charge', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, contributionShare: 0, feeRate: 0 },
        {
          ...AUA_ACCOUNT,
          id: 'topup',
          label: 'Top-up Units Account',
          currentValue: 0,
          feeRate: 0,
          contributionShare: 0,
          contributionRules: [{ phase: 'top-up', contributionShare: 1 }],
        },
      ],
      policyEvents: [
        {
          id: 'rsp-1',
          type: 'recurring-single-premium',
          startPolicyMonth: 10,
          durationMonths: 6,
          amount: 100,
        },
      ],
      eventChargeRules: [
        {
          id: 'rsp-charge',
          label: 'Recurring Single Premium Charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          appliesTo: ['topup'],
          rate: 0.05,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(300)
    expect(result.rows[0].cumulativePremiums).toBe(300)
    expect(accountRow(result.rows[0], 'topup').contributionAmount).toBe(300)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBeCloseTo(15, 2)
    expect(result.rows[1].annualContribution).toBe(300)
    expect(result.rows[1].cumulativePremiums).toBe(600)
    expect(accountRow(result.rows[1], 'topup').contributionAmount).toBe(300)
    expect(accountRow(result.rows[1], 'topup').grossFee).toBeCloseTo(15, 2)
  })

  it('stops a recurring single premium stream after a premium holiday until an explicit resumption event exists', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, contributionShare: 0, feeRate: 0 },
        {
          ...AUA_ACCOUNT,
          id: 'topup',
          label: 'Top-up Units Account',
          currentValue: 0,
          feeRate: 0,
          contributionShare: 0,
          contributionRules: [{ phase: 'top-up', contributionShare: 1 }],
        },
      ],
      policyEvents: [
        {
          id: 'rsp-1',
          type: 'recurring-single-premium',
          startPolicyMonth: 1,
          durationMonths: 12,
          amount: 100,
        },
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 4,
          durationMonths: 2,
        },
      ],
      eventChargeRules: [
        {
          id: 'rsp-charge',
          label: 'Recurring Single Premium Charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          appliesTo: ['topup'],
          rate: 0.05,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(300)
    expect(accountRow(result.rows[0], 'topup').contributionAmount).toBe(300)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBeCloseTo(15, 2)
  })

  it('resumes a recurring single premium stream only from the explicit resumption month onward', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, contributionShare: 0, feeRate: 0 },
        {
          ...AUA_ACCOUNT,
          id: 'topup',
          label: 'Top-up Units Account',
          currentValue: 0,
          feeRate: 0,
          contributionShare: 0,
          contributionRules: [{ phase: 'top-up', contributionShare: 1 }],
        },
      ],
      policyEvents: [
        {
          id: 'rsp-1',
          type: 'recurring-single-premium',
          startPolicyMonth: 1,
          durationMonths: 12,
          amount: 100,
        },
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 4,
          durationMonths: 2,
        },
        {
          id: 'rsp-resume-1',
          type: 'recurring-single-premium-resumption',
          startPolicyMonth: 8,
          durationMonths: 1,
        },
      ],
      eventChargeRules: [
        {
          id: 'rsp-charge',
          label: 'Recurring Single Premium Charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          appliesTo: ['topup'],
          rate: 0.05,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(800)
    expect(accountRow(result.rows[0], 'topup').contributionAmount).toBe(800)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBeCloseTo(40, 2)
  })

  it('reduces recurring single premium first before reducing the regular premium path', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, contributionShare: 0 },
        {
          ...AUA_ACCOUNT,
          id: 'topup',
          label: 'Top-up Units Account',
          currentValue: 0,
          contributionShare: 0,
          contributionRules: [{ phase: 'top-up', contributionShare: 1 }],
        },
        { ...AUA_ACCOUNT, id: 'accumulation', currentValue: 0, contributionShare: 1, feeRate: 0 },
      ],
      policyEvents: [
        {
          id: 'rsp-1',
          type: 'recurring-single-premium',
          startPolicyMonth: 1,
          durationMonths: 12,
          amount: 100,
        },
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 1,
          durationMonths: 1,
          amount: 600,
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(4_800)
    expect(accountRow(result.rows[0], 'topup').contributionAmount).toBe(600)
    expect(accountRow(result.rows[0], 'accumulation').contributionAmount).toBe(4_200)
  })

  it('applies reduction-based shortfall charges across active months after a regular premium reduction', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      accounts: [
        { ...IUA_ACCOUNT, id: 'initial', currentValue: 0, contributionShare: 0, feeRate: 0, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'accumulation', currentValue: 0, feeRate: 0, contributionShare: 1 },
      ],
      policyEvents: [
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 10,
          durationMonths: 1,
          amount: 1_200,
        },
      ],
      eventChargeRules: [
        {
          id: 'shortfall-charge',
          label: 'Shortfall Charge',
          trigger: 'regular-premium-reduction',
          basis: 'annual-reduction-with-active-months',
          appliesTo: ['accumulation'],
          rate: 0.5,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(150, 2)
    expect(accountRow(result.rows[1], 'accumulation').grossFee).toBeCloseTo(600, 2)
  })

  it('restores reduced regular premiums and stops reduction-based shortfall charges after a premium increase', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      accounts: [
        { ...IUA_ACCOUNT, id: 'initial', currentValue: 0, contributionShare: 0, feeRate: 0, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'accumulation', currentValue: 0, feeRate: 0, contributionShare: 1 },
      ],
      policyEvents: [
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 10,
          durationMonths: 1,
          amount: 1_200,
        },
        {
          id: 'increase-1',
          type: 'regular-premium-increase',
          startPolicyMonth: 13,
          durationMonths: 1,
          amount: 1_200,
        },
      ],
      eventChargeRules: [
        {
          id: 'shortfall-charge',
          label: 'Shortfall Charge',
          trigger: 'regular-premium-reduction',
          basis: 'annual-reduction-with-active-months',
          appliesTo: ['accumulation'],
          rate: 0.5,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(3_900)
    expect(result.rows[1].annualContribution).toBe(4_200)
    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(150, 2)
    expect(accountRow(result.rows[1], 'accumulation').grossFee).toBeCloseTo(0, 2)
  })

  it('allows regular premium increases to raise the scheduled annual premium above the original base', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, id: 'initial', currentValue: 0, contributionShare: 0, feeRate: 0, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'accumulation', currentValue: 0, feeRate: 0, contributionShare: 1 },
      ],
      policyEvents: [
        {
          id: 'increase-1',
          type: 'regular-premium-increase',
          startPolicyMonth: 3,
          durationMonths: 1,
          amount: 600,
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(1_700)
    expect(accountRow(result.rows[0], 'accumulation').contributionAmount).toBe(1_700)
  })

  it('bases non-payment shortfall charges on the committed premium even after a regular premium reduction', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 3,
      monthsAlreadyPaid: 36,
      accounts: [
        { ...IUA_ACCOUNT, id: 'initial', currentValue: 0, contributionShare: 0, feeRate: 0, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'accumulation', currentValue: 10_000, feeRate: 0, contributionShare: 1 },
        { ...AUA_ACCOUNT, id: 'topup', currentValue: 0, feeRate: 0, contributionShare: 0, subjectToEec: false },
      ],
      policyEvents: [
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 37,
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
      eventChargeRules: [
        {
          id: 'shortfall-non-payment',
          label: 'Shortfall Non-payment',
          trigger: 'premium-holiday',
          basis: 'committed-annual-premium-with-overlap-months',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0.7,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(735, 2)
  })

  it('applies only the higher Tokio shortfall charge when non-payment and reduction overlap', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 3,
      monthsAlreadyPaid: 36,
      accounts: [
        { ...IUA_ACCOUNT, id: 'initial', currentValue: 0, contributionShare: 0, feeRate: 0, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'accumulation', currentValue: 10_000, feeRate: 0, contributionShare: 1 },
        { ...AUA_ACCOUNT, id: 'topup', currentValue: 0, feeRate: 0, contributionShare: 0, subjectToEec: false },
      ],
      policyEvents: [
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 37,
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
      eventChargeRules: [
        {
          id: 'shortfall-non-payment',
          label: 'Shortfall Non-payment',
          trigger: 'premium-holiday',
          basis: 'committed-annual-premium-with-overlap-months',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0.7,
          amount: 0,
          exclusiveGroup: 'tokio-premium-shortfall',
          groupResolution: 'max-total-charge',
          allocation: 'equal-split',
        },
        {
          id: 'shortfall-reduction',
          label: 'Shortfall Reduction',
          trigger: 'regular-premium-reduction',
          basis: 'annual-reduction-with-active-months',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0.7,
          amount: 0,
          exclusiveGroup: 'tokio-premium-shortfall',
          groupResolution: 'max-total-charge',
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(840, 2)
  })

  it('adds generalized charge rules on top of base account fee rates', () => {
    const policy = makeDefaultPolicy({
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 29_000 },
        { ...AUA_ACCOUNT, currentValue: 1_000 },
      ],
      bonuses: [],
      chargeRules: POLICY_CHARGE_RULES,
    })
    const result = projectIlpPolicy(policy, 'mid')
    const firstRow = result.rows[0]

    expect(accountRow(firstRow, 'iua').grossFee).toBeCloseTo(1_131, 2)
    expect(accountRow(firstRow, 'aua').grossFee).toBeCloseTo(224, 2)
  })

  it('uses recurring charge rate tiers by policy year for dynamic charge rules', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 5,
      monthsAlreadyPaid: 0,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 0 },
        { ...AUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 1 },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'policy-charge',
          label: 'Policy Charge',
          basis: 'annual-contribution',
          activeWindow: 'policy-term',
          appliesTo: ['aua'],
          rateSchedule: [
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.02 },
            { startPolicyYear: 7, endPolicyYear: null, rate: 0.05 },
          ],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].policyYear).toBe(6)
    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(24, 2)
    expect(result.rows[1].policyYear).toBe(7)
    expect(accountRow(result.rows[1], 'aua').grossFee).toBeCloseTo(60, 2)
  })

  it('uses fixed-annual amount tiers and falls back to secondary accounts when primary balances are exhausted', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 4,
      monthsAlreadyPaid: 48,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, id: 'growth', label: 'Growth', currentValue: 50, feeRate: 0, postMipFeeRate: 0, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'flex', label: 'Flex', currentValue: 50, feeRate: 0, postMipFeeRate: 0, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'additional', label: 'Additional', currentValue: 500, feeRate: 0, postMipFeeRate: 0, contributionShare: 0, subjectToEec: false },
      ],
      bonuses: [],
      chargeRules: [
        {
          id: 'assurance-charge',
          label: 'Assurance Charge',
          basis: 'fixed-annual',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: 5, amount: 240 },
            { startPolicyYear: 6, endPolicyYear: null, amount: 120 },
          ],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(50, 2)
    expect(accountRow(result.rows[0], 'flex').grossFee).toBeCloseTo(50, 2)
    expect(accountRow(result.rows[0], 'additional').grossFee).toBeCloseTo(140, 2)
    expect(accountRow(result.rows[1], 'additional').grossFee).toBeCloseTo(120, 2)
  })

  it('annualizes Prudential Prosper assurance charges from the worked example inputs', () => {
    const policy = makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 10,
      accounts: PRUDENTIAL_PROSPER_ACCOUNTS,
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      chargeRules: [
        {
          id: 'prosper-death',
          label: 'Assurance Charge (Death)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-prosper-death',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        },
        {
          id: 'prosper-accidental-death',
          label: 'Assurance Charge (Accidental Death)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-prosper-accidental-death',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 50,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
      },
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(2.071656, 6)
    expect(accountRow(result.rows[0], 'flex').grossFee).toBeCloseTo(2.071656, 6)
    expect(accountRow(result.rows[0], 'additional').grossFee).toBe(0)
  })

  it('annualizes HSBC Flexi Choice and Max death/TI charges from the published yearly rate table', () => {
    const basePolicy = makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 10,
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
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      assuranceProfile: {
        currentAgeNextBirthday: 30,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentBasicSumAssured: 100_000,
        currentNetSupplementaryPremiumBase: 20_000,
      },
    })

    const choiceResult = projectIlpPolicy({
      ...basePolicy,
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
    }, 'mid')

    const maxResult = projectIlpPolicy({
      ...basePolicy,
      chargeRules: [
        {
          id: 'flexi-max-death-ti',
          label: 'Death / TI COI',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy-value'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'hsbc-flexi-max-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }, 'mid')

    expect(accountRow(choiceResult.rows[0], 'policy-value').grossFee).toBeCloseTo(77.4, 6)
    expect(accountRow(maxResult.rows[0], 'policy-value').grossFee).toBeCloseTo(86, 6)
  })

  it('does not reduce supplementary premium base for withdrawals outside the supplementary account scope', () => {
    const basePolicy = makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 10,
      accounts: [
        {
          id: 'regular',
          label: 'Regular Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
        },
        {
          id: 'topup',
          label: 'Supplementary Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [{ phase: 'top-up', contributionShare: 1 }],
        },
      ],
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      assuranceProfile: {
        currentAgeNextBirthday: 30,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentBasicSumAssured: 100_000,
        currentNetSupplementaryPremiumBase: 20_000,
      },
      chargeRules: [
        {
          id: 'flexi-choice-death-ti',
          label: 'Death / TI COI',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['topup'],
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
    })

    const noWithdrawal = projectIlpPolicy(basePolicy, 'mid')
    const regularWithdrawal = projectIlpPolicy({
      ...basePolicy,
      policyEvents: [
        {
          id: 'withdrawal-1',
          type: 'partial-withdrawal',
          startPolicyMonth: 121,
          durationMonths: 1,
          amount: 500,
          accountId: 'regular',
        },
      ],
    }, 'mid')

    expect(accountRow(regularWithdrawal.rows[0], 'topup').grossFee).toBeCloseTo(accountRow(noWithdrawal.rows[0], 'topup').grossFee, 6)
  })

  it('projects the next-year Prudential Assure II combined assurance charge from the current worked-example state', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 10,
      accounts: PRUDENTIAL_PROSPER_ACCOUNTS,
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      chargeRules: [
        {
          id: 'assure-ii-combined',
          label: 'Assurance Charge (Appendix A total charge curve)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 50,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
        currentSumAssured: 103_000,
        currentWealthAssureValue: 101_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(6.620292, 6)
    expect(accountRow(result.rows[0], 'flex').grossFee).toBeCloseTo(6.620292, 6)
    expect(accountRow(result.rows[0], 'additional').grossFee).toBe(0)
  })

  it('continues the Assure II assurance charge after age 70 using the published Appendix A curve', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 300,
      currentPolicyYear: 25,
      accounts: PRUDENTIAL_PROSPER_ACCOUNTS,
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      chargeRules: [
        {
          id: 'assure-ii-combined',
          label: 'Assurance Charge (Appendix A total charge curve)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 70,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
        currentSumAssured: 103_000,
        currentWealthAssureValue: 101_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(42.423912, 6)
    expect(accountRow(result.rows[0], 'flex').grossFee).toBeCloseTo(42.423912, 6)
    expect(accountRow(result.rows[0], 'additional').grossFee).toBe(0)
  })

  it('applies a user-entered Assure II reduction event as a resulting-state override', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 300,
      currentPolicyYear: 25,
      postMipYears: 0,
      accounts: PRUDENTIAL_PROSPER_ACCOUNTS,
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      chargeRules: [
        {
          id: 'assure-ii-combined',
          label: 'Assurance Charge (Appendix A total charge curve)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
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
          startPolicyMonth: 301,
          durationMonths: 1,
          resultingSumAssured: 110_000,
          resultingWealthAssureValue: 105_000,
        },
      ],
    }), 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(235.6884, 4)
    expect(accountRow(result.rows[0], 'flex').grossFee).toBeCloseTo(235.6884, 4)
  })

  it('keeps the reduced Assure II state frozen until a later resumption event, then resumes a higher charge path', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 300,
      currentPolicyYear: 25,
      postMipYears: 3,
      accounts: PRUDENTIAL_PROSPER_ACCOUNTS,
      funds: [{
        name: 'Stable Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      bonuses: [],
      chargeRules: [
        {
          id: 'assure-ii-combined',
          label: 'Assurance Charge (Appendix A total charge curve)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
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
          startPolicyMonth: 301,
          durationMonths: 1,
          resultingSumAssured: 110_000,
          resultingWealthAssureValue: 105_000,
        },
        {
          id: 'resume-1',
          type: 'assurance-benefit-resumption',
          startPolicyMonth: 325,
          durationMonths: 1,
          resultingSumAssured: 140_000,
        },
      ],
    }), 'mid')

    const reductionYearFee = accountRow(result.rows[0], 'growth').grossFee
    const frozenYearFee = accountRow(result.rows[1], 'growth').grossFee
    const resumedYearFee = accountRow(result.rows[2], 'growth').grossFee

    expect(reductionYearFee).toBeGreaterThan(frozenYearFee)
    expect(frozenYearFee).toBeCloseTo(120.726765, 4)
    expect(resumedYearFee).toBeGreaterThan(frozenYearFee)
  })

  it('reduces annual contributions during premium-holiday months', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 1,
      monthsAlreadyPaid: 0,
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 4,
          durationMonths: 3,
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBeCloseTo(3_150, 2)
    expect(accountRow(result.rows[0], 'aua').close).toBeCloseTo(3_150, 2)
  })

  it('suspends bonus credit for 12 policy months after a partial withdrawal event', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 14,
      monthsAlreadyPaid: 168,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0 },
        { ...AUA_ACCOUNT, currentValue: 10_000 },
      ],
      policyEvents: [
        {
          id: 'withdrawal-1',
          type: 'partial-withdrawal',
          startPolicyMonth: 169,
          durationMonths: 1,
          amount: 1_000,
          accountId: 'aua',
        },
      ],
      bonuses: [
        {
          ...POWER_UP,
          rate: 0.12,
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'aua').bonusCredit).toBeCloseTo(0, 2)
    expect(accountRow(result.rows[1], 'aua').bonusCredit).toBeGreaterThan(0)
  })

  it('applies event-triggered charges when a partial withdrawal happens in the projection year', () => {
    const policy = makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 60,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 10_000 },
        { ...AUA_ACCOUNT, currentValue: 5_000 },
      ],
      policyEvents: [
        {
          id: 'withdrawal-1',
          type: 'partial-withdrawal',
          startPolicyMonth: 61,
          durationMonths: 1,
          amount: 2_000,
          accountId: 'aua',
        },
      ],
      eventChargeRules: [
        {
          id: 'pwc',
          label: 'Partial Withdrawal Charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['iua', 'aua'],
          rate: 0.1,
          amount: 50,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'iua').grossFee).toBeCloseTo(350, 2)
    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(300, 2)
    expect(accountRow(result.rows[0], 'aua').withdrawalAmount).toBe(2_000)
    expect(accountRow(result.rows[0], 'aua').close).toBeCloseTo((5_000 - 300) * (1 + result.blendedNetReturn) - 2_000, 2)
  })

  it('reduces future contributions and applies BRC on regular premium reduction events', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 5,
      monthsAlreadyPaid: 60,
      monthlyContribution: 350,
      policyEvents: [
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 67,
          durationMonths: 1,
          amount: 1_200,
        },
      ],
      eventChargeRules: [
        {
          id: 'brc',
          label: 'Bonus Recovery Charge',
          trigger: 'regular-premium-reduction',
          basis: 'premium-reduction-with-startup-recovery',
          appliesTo: ['iua'],
          rate: 1.45,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBeCloseTo(3_600, 2)
    expect(accountRow(result.rows[0], 'iua').grossFee).toBeCloseTo(2_436, 2)
    expect(result.rows[1].annualContribution).toBeCloseTo(3_000, 2)
  })

  it('applies tier-aware startup recovery charges on regular premium reduction events', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 5,
      monthsAlreadyPaid: 60,
      monthlyContribution: 2_000,
      policyEvents: [
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 67,
          durationMonths: 1,
          amount: 3_000,
        },
      ],
      eventChargeRules: [
        {
          id: 'brc-tiered',
          label: 'Bonus Recovery Charge',
          trigger: 'regular-premium-reduction',
          basis: 'premium-reduction-tiered-startup-recovery',
          appliesTo: ['iua'],
          rate: 0,
          amount: 0,
          sourceBonusId: 'startup-bonus',
          allocation: 'equal-split',
        },
      ],
      bonuses: [
        {
          id: 'startup-bonus',
          type: 'allocation',
          label: 'Start-up Bonus',
          appliesTo: ['iua'],
          startPolicyYear: 1,
          endPolicyYear: 1,
          mode: 'premium-allocation',
          rate: 0,
          amount: 0,
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 23_999.99, rate: 0.08 },
            { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 41_999.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.12 },
          ],
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBeCloseTo(22_500, 2)
    expect(accountRow(result.rows[0], 'iua').grossFee).toBeCloseTo(1_015, 2)
  })

  it('applies premium-base AMF multipliers during and after MIP', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 19,
      monthsAlreadyPaid: 228,
      currency: 'SGD',
      monthlyContribution: 1_000,
      mipLength: 20,
      postMipYears: 2,
      accounts: [
        {
          ...IUA_ACCOUNT,
          id: 'regular',
          label: 'Regular Premium Account',
          currentValue: 20_000,
          feeRate: 0,
          postMipFeeRate: 0,
          contributionShare: 1,
        },
      ],
      bonuses: [],
      chargeRules: [
        {
          id: 'voyage-amf-during',
          label: 'Account Maintenance Fee',
          basis: 'premium-base-mip-multiplier',
          activeWindow: 'during-mip',
          appliesTo: ['regular'],
          rate: 0.0215,
          amount: 0,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 16, mode: 'policy-year' },
              { startPolicyYear: 17, endPolicyYear: 20, mode: 'fixed', multiplier: 16 },
            ],
          },
          allocation: 'equal-split',
        },
        {
          id: 'voyage-amf-after',
          label: 'Account Maintenance Fee',
          basis: 'premium-base-mip-multiplier',
          activeWindow: 'after-mip',
          appliesTo: ['regular'],
          rate: 0.01,
          amount: 0,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierSchedule: [
              { startPolicyYear: 21, endPolicyYear: null, mode: 'fixed', multiplier: 20 },
            ],
          },
          allocation: 'equal-split',
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].policyYear).toBe(20)
    expect(accountRow(result.rows[0], 'regular').grossFee).toBeCloseTo(4_128, 2)
    expect(result.rows[1].policyYear).toBe(21)
    expect(accountRow(result.rows[1], 'regular').grossFee).toBeCloseTo(2_400, 2)
  })

  it('applies cumulative-paid premium charges against actual regular premiums paid', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      monthlyContribution: 1_000,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 0,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 10_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      chargeRules: [
        {
          id: 'policy-charge',
          label: 'Policy Charge',
          basis: 'cumulative-paid-regular-premium',
          activeWindow: 'policy-term',
          appliesTo: ['regular'],
          rate: 0.12,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(12_000)
    expect(accountRow(result.rows[0], 'regular').grossFee).toBeCloseTo(3_660, 2)
  })

  it('freezes cumulative-paid premium charges during premium holidays and resumes after payment restart', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      monthlyContribution: 1_000,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 1,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 10_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 25,
          durationMonths: 12,
        },
      ],
      chargeRules: [
        {
          id: 'policy-charge',
          label: 'Policy Charge',
          basis: 'cumulative-paid-regular-premium',
          activeWindow: 'policy-term',
          appliesTo: ['regular'],
          rate: 0.12,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(0)
    expect(accountRow(result.rows[0], 'regular').grossFee).toBeCloseTo(2_880, 2)
    expect(result.rows[1].annualContribution).toBe(12_000)
    expect(accountRow(result.rows[1], 'regular').grossFee).toBeCloseTo(3_660, 2)
  })

  it('switches cumulative-paid premium charge rates by annualised premiums paid after the premium term', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 9,
      monthsAlreadyPaid: 108,
      monthlyContribution: 1_000,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 2,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 61,
          durationMonths: 36,
        },
      ],
      chargeRules: [
        {
          id: 'policy-charge-post-term',
          label: 'Policy Charge',
          basis: 'cumulative-paid-regular-premium',
          activeWindow: 'policy-term',
          startPolicyYear: 11,
          endPolicyYear: null,
          appliesTo: ['regular'],
          rate: 0,
          amount: 0,
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 12_000,
            countRateSchedule: [
              { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 6, rate: 0.012 },
              { minAnnualisedPremiumsPaid: 7, maxAnnualisedPremiumsPaid: 7, rate: 0.0086 },
              { minAnnualisedPremiumsPaid: 8, maxAnnualisedPremiumsPaid: null, rate: 0.0075 },
            ],
          },
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].policyYear).toBe(10)
    expect(result.rows[0].annualContribution).toBe(12_000)
    expect(result.rows[1].policyYear).toBe(11)
    expect(result.rows[1].annualContribution).toBe(0)
    expect(accountRow(result.rows[1], 'regular').grossFee).toBeCloseTo(722.4, 2)
  })

  it('uses premium-year rate bands with policy-year multipliers for premium-base charges', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 4,
      monthsAlreadyPaid: 48,
      monthlyContribution: 500,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 2,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      chargeRules: [
        {
          id: 'paf',
          label: 'Product Administration Fee',
          basis: 'premium-base-mip-multiplier',
          yearBasis: 'premium-year',
          activeWindow: 'policy-term',
          appliesTo: ['regular'],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 8, rate: 0.025 },
            { startPolicyYear: 9, endPolicyYear: 24, rate: 0.006 },
          ],
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
              { startPolicyYear: 11, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
            ],
          },
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].policyYear).toBe(5)
    expect(accountRow(result.rows[0], 'regular').grossFee).toBeCloseTo(750, 2)
    expect(result.rows[4].policyYear).toBe(9)
    expect(accountRow(result.rows[4], 'regular').grossFee).toBeCloseTo(324, 2)
  })

  it('freezes premium-year charge bands during premium holidays and resumes when premiums restart', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 5,
      monthsAlreadyPaid: 60,
      monthlyContribution: 500,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 4,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 61,
          durationMonths: 36,
        },
      ],
      chargeRules: [
        {
          id: 'paf',
          label: 'Product Administration Fee',
          basis: 'premium-base-mip-multiplier',
          yearBasis: 'premium-year',
          activeWindow: 'policy-term',
          appliesTo: ['regular'],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 8, rate: 0.025 },
            { startPolicyYear: 9, endPolicyYear: 24, rate: 0.006 },
          ],
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
              { startPolicyYear: 11, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
            ],
          },
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(0)
    expect(accountRow(result.rows[0], 'regular').grossFee).toBeCloseTo(900, 2)
    expect(accountRow(result.rows[2], 'regular').grossFee).toBeCloseTo(1_200, 2)
    expect(result.rows[3].annualContribution).toBe(6_000)
    expect(accountRow(result.rows[3], 'regular').grossFee).toBeCloseTo(1_350, 2)
  })

  it('extends EEC by premium year when holidays stall payment progress', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 5,
      monthsAlreadyPaid: 60,
      monthlyContribution: 500,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 2,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 10_000,
          contributionShare: 1,
          subjectToEec: true,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      eecTable: [1, 0.9, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05],
      eecYearBasis: 'premium-year',
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 61,
          durationMonths: 24,
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].eecRate).toBe(0.5)
    expect(result.rows[1].eecRate).toBe(0.5)
    expect(result.rows[2].eecRate).toBe(0.4)
  })

  it('gates bonus eligibility on premiums being paid up to date and uses premium-year cadence', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 9,
      monthsAlreadyPaid: 108,
      monthlyContribution: 500,
      currency: 'SGD',
      mipLength: 20,
      postMipYears: 2,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 10_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 109,
          durationMonths: 12,
          repayMissedPremiums: true,
        },
      ],
      bonuses: [
        {
          id: 'payment-history-bonus',
          type: 'loyalty',
          label: 'Payment History Bonus',
          mode: 'annual-rate',
          rate: 0.01,
          amount: 0,
          appliesTo: ['regular'],
          startPolicyYear: 10,
          endPolicyYear: null,
          yearBasis: 'premium-year',
          requiresPremiumsPaidUpToDate: true,
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'regular').bonusCredit).toBe(0)
    expect(accountRow(result.rows[1], 'regular').bonusCredit).toBeGreaterThan(0)
  })

  it('applies cadence-based premium-year bonuses only on the published premium-year intervals', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 9,
      monthsAlreadyPaid: 108,
      monthlyContribution: 500,
      currency: 'SGD',
      mipLength: 20,
      postMipYears: 4,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 10_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [
        {
          id: 'every-two-premium-years',
          type: 'loyalty',
          label: 'Every 2 Premium Years',
          mode: 'annual-rate',
          rate: 0.01,
          amount: 0,
          appliesTo: ['regular'],
          startPolicyYear: 10,
          endPolicyYear: 24,
          yearBasis: 'premium-year',
          cadenceYears: 2,
          requiresPremiumsPaidUpToDate: true,
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'regular').bonusCredit).toBeGreaterThan(0)
    expect(accountRow(result.rows[1], 'regular').bonusCredit).toBe(0)
    expect(accountRow(result.rows[2], 'regular').bonusCredit).toBeGreaterThan(0)
    expect(accountRow(result.rows[3], 'regular').bonusCredit).toBe(0)
  })

  it('keeps policy-year based charge schedules unchanged during premium holidays', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 5,
      monthsAlreadyPaid: 60,
      monthlyContribution: 500,
      currency: 'SGD',
      mipLength: 10,
      postMipYears: 2,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'regular',
          label: 'Regular Premium Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 61,
          durationMonths: 24,
        },
      ],
      chargeRules: [
        {
          id: 'policy-year-charge',
          label: 'Policy-Year Charge',
          basis: 'fixed-annual',
          yearBasis: 'policy-year',
          activeWindow: 'policy-term',
          appliesTo: ['regular'],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: 6, amount: 100 },
            { startPolicyYear: 7, endPolicyYear: null, amount: 50 },
          ],
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'regular').grossFee).toBe(100)
    expect(accountRow(result.rows[1], 'regular').grossFee).toBe(50)
  })

  it('restores missed premiums and bonus credits after a premium holiday back-pay', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 14,
      monthsAlreadyPaid: 168,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0 },
        { ...AUA_ACCOUNT, currentValue: 10_000 },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 169,
          durationMonths: 3,
          repayMissedPremiums: true,
          repaymentAccountId: 'aua',
        },
      ],
      eventChargeRules: [
        {
          id: 'missed-imf',
          label: 'Missed IMF',
          trigger: 'premium-holiday-repayment',
          basis: 'repaid-premium-with-missed-months',
          appliesTo: ['aua'],
          rate: 0.02,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [
        {
          ...POWER_UP,
          rate: 0.12,
          suspensionRules: [{ trigger: 'premium-holiday', suspensionMonths: 12 }],
          restorationRules: [{ trigger: 'premium-holiday-repayment', basis: 'account-value-plus-repaid-premium-with-missed-months' }],
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBeCloseTo(4_200, 2)
    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(105.25, 2)
    expect(accountRow(result.rows[0], 'aua').bonusCredit).toBeCloseTo(331.5, 2)
  })

  it('skips premium-holiday charges until the free lifetime holiday duration is exhausted', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      currency: 'SGD',
      monthlyContribution: 1_000,
      accounts: [
        {
          ...IUA_ACCOUNT,
          id: 'regular',
          label: 'Regular Premium Account',
          currentValue: 15_000,
          feeRate: 0,
          postMipFeeRate: 0,
          contributionShare: 1,
        },
      ],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 25,
          durationMonths: 30,
        },
      ],
      eventChargeRules: [
        {
          id: 'phc',
          label: 'Premium Holiday Charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['regular'],
          freeLifetimeMonths: 24,
          rate: 0.5,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(0)
    expect(accountRow(result.rows[0], 'regular').grossFee).toBeCloseTo(0, 2)
    expect(accountRow(result.rows[1], 'regular').grossFee).toBeCloseTo(0, 2)
    expect(accountRow(result.rows[2], 'regular').grossFee).toBeCloseTo(3_000, 2)
  })

  it('accrues premium-holiday charges and refunds a configured share after full repayment', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 4,
      monthsAlreadyPaid: 36,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0 },
        { ...AUA_ACCOUNT, currentValue: 1_000, feeRate: 0, postMipFeeRate: 0 },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 37,
          durationMonths: 3,
          repayMissedPremiums: true,
          repaymentAccountId: 'aua',
        },
      ],
      eventChargeRules: [
        {
          id: 'holiday-charge',
          label: 'Premium Holiday Charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['aua'],
          rate: 0,
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.2 },
          ],
          amount: 0,
          allocation: 'equal-split',
        },
        {
          id: 'holiday-charge-refund',
          label: 'Premium Holiday Charge Refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
          appliesTo: ['aua'],
          rate: 0.7,
          amount: 0,
          sourceChargeRuleId: 'holiday-charge',
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBeCloseTo(1_200, 2)
    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(45, 2)
  })

  it('falls back to a secondary account when premium-holiday charges exhaust the primary accounts', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 4,
      monthsAlreadyPaid: 36,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, id: 'growth', label: 'Growth', currentValue: 10, feeRate: 0.01, postMipFeeRate: 0.01, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'flex', label: 'Flex', currentValue: 10, feeRate: 0.01, postMipFeeRate: 0.01, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'additional', label: 'Additional', currentValue: 500, feeRate: 0, postMipFeeRate: 0, contributionShare: 0, subjectToEec: false },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 37,
          durationMonths: 12,
        },
      ],
      eventChargeRules: [
        {
          id: 'holiday-charge',
          label: 'Premium Holiday Charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0.5,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(10.1, 2)
    expect(accountRow(result.rows[0], 'flex').grossFee).toBeCloseTo(10.1, 2)
    expect(accountRow(result.rows[0], 'additional').grossFee).toBeCloseTo(500, 2)
    expect(accountRow(result.rows[0], 'additional').close).toBeCloseTo(0, 2)
  })

  it('does not let fallback charge allocation overdraw a secondarily charged account', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 4,
      monthsAlreadyPaid: 36,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, id: 'growth', label: 'Growth', currentValue: 5, feeRate: 0, postMipFeeRate: 0, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'flex', label: 'Flex', currentValue: 5, feeRate: 0, postMipFeeRate: 0, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'additional', label: 'Additional', currentValue: 50, feeRate: 0, postMipFeeRate: 0, contributionShare: 0, subjectToEec: false },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 37,
          durationMonths: 12,
        },
      ],
      eventChargeRules: [
        {
          id: 'holiday-charge',
          label: 'Premium Holiday Charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          rate: 0.5,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
      bonuses: [],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'additional').grossFee).toBeCloseTo(50, 2)
    expect(accountRow(result.rows[0], 'additional').close).toBeCloseTo(0, 2)
  })

  it('waives the first eligible partial withdrawal charge up to the configured free limit', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 10,
      monthsAlreadyPaid: 120,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, id: 'growth', label: 'Growth', currentValue: 800, feeRate: 0, postMipFeeRate: 0, contributionShare: 0.5, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'flex', label: 'Flex', currentValue: 200, feeRate: 0, postMipFeeRate: 0, contributionShare: 0.5, subjectToEec: true },
      ],
      policyEvents: [
        {
          id: 'withdrawal-1',
          type: 'partial-withdrawal',
          startPolicyMonth: 121,
          durationMonths: 1,
          amount: 150,
          accountId: 'growth',
        },
      ],
      eventChargeRules: [
        {
          id: 'partial-withdrawal-charge',
          label: 'Partial Withdrawal Charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['growth', 'flex'],
          freeEventCount: 1,
          freeEventStartPolicyYear: 11,
          freeEventMaxAmountRate: 0.1,
          rate: 0.25,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'growth').grossFee).toBeCloseTo(12.5, 2)
    expect(accountRow(result.rows[0], 'growth').withdrawalAmount).toBe(150)
  })

  it('suppresses a partial-withdrawal charge when the event is explicitly marked as waived', () => {
    const basePolicy = makeDefaultPolicy({
      currentPolicyYear: 10,
      monthsAlreadyPaid: 120,
      monthlyContribution: 0,
      accounts: [
        { ...IUA_ACCOUNT, id: 'growth', label: 'Growth', currentValue: 800, feeRate: 0, postMipFeeRate: 0, contributionShare: 1, subjectToEec: true },
      ],
      policyEvents: [
        {
          id: 'withdrawal-1',
          type: 'partial-withdrawal',
          startPolicyMonth: 121,
          durationMonths: 1,
          amount: 150,
          accountId: 'growth',
        },
      ],
      eventChargeRules: [
        {
          id: 'partial-withdrawal-charge',
          label: 'Partial Withdrawal Charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['growth'],
          rate: 0.25,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const charged = projectIlpPolicy(basePolicy, 'mid')
    const waived = projectIlpPolicy({
      ...basePolicy,
      policyEvents: [
        {
          ...basePolicy.policyEvents![0],
          chargeWaived: true,
        },
      ],
    }, 'mid')

    expect(accountRow(charged.rows[0], 'growth').grossFee).toBeCloseTo(37.5, 2)
    expect(accountRow(waived.rows[0], 'growth').grossFee).toBeCloseTo(0, 2)
    expect(accountRow(waived.rows[0], 'growth').withdrawalAmount).toBe(150)
  })

  it('suppresses premium-shortfall charges when holiday and reduction events are explicitly waived', () => {
    const basePolicy = makeDefaultPolicy({
      currentPolicyYear: 4,
      monthsAlreadyPaid: 36,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, id: 'initial', label: 'Initial', currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 0, subjectToEec: true },
        { ...AUA_ACCOUNT, id: 'accumulation', label: 'Accumulation', currentValue: 1_000, feeRate: 0, postMipFeeRate: 0, contributionShare: 1, subjectToEec: true },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 37,
          durationMonths: 2,
        },
        {
          id: 'reduction-1',
          type: 'regular-premium-reduction',
          startPolicyMonth: 39,
          durationMonths: 1,
          amount: 600,
        },
      ],
      eventChargeRules: [
        {
          id: 'shortfall-non-payment',
          label: 'Premium Shortfall Charge (Non-payment)',
          trigger: 'premium-holiday',
          basis: 'committed-annual-premium-with-overlap-months',
          appliesTo: ['accumulation'],
          rate: 0.6,
          amount: 0,
          allocation: 'equal-split',
        },
        {
          id: 'shortfall-reduction',
          label: 'Premium Shortfall Charge (Regular Premium Reduction)',
          trigger: 'regular-premium-reduction',
          basis: 'annual-reduction-with-active-months',
          appliesTo: ['accumulation'],
          rate: 0.6,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })

    const charged = projectIlpPolicy(basePolicy, 'mid')
    const waived = projectIlpPolicy({
      ...basePolicy,
      policyEvents: [
        {
          ...basePolicy.policyEvents![0],
          chargeWaived: true,
        },
        {
          ...basePolicy.policyEvents![1],
          chargeWaived: true,
        },
      ],
    }, 'mid')

    expect(accountRow(charged.rows[0], 'accumulation').grossFee).toBeCloseTo(420, 2)
    expect(accountRow(waived.rows[0], 'accumulation').grossFee).toBeCloseTo(0, 2)
    expect(charged.rows[1].annualContribution).toBeCloseTo(600, 2)
    expect(waived.rows[1].annualContribution).toBeCloseTo(600, 2)
  })

  it('throws for mature policies instead of silently projecting', () => {
    expect(() => projectIlpPolicy(makeDefaultPolicy({ currentPolicyYear: 30 }), 'mid')).toThrow(/at or past MIP/)
  })

  it('floors negative close values at zero before EEC is applied', () => {
    const policy = makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      accounts: [
        {
          id: 'core',
          label: 'Core',
          feeRate: 0,
          currentValue: 100,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'wipeout-charge',
          label: 'Wipeout Charge',
          basis: 'fixed-annual',
          activeWindow: 'policy-term',
          appliesTo: ['core'],
          rate: 0,
          amount: 500,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'core').close).toBe(0)
    expect(result.rows[0].eecCharge).toBe(0)
    expect(result.rows[0].surrenderValue).toBe(0)
  })
})

describe('computeNpvAnalysis', () => {
  it('calculates surrender now EEC on subject accounts only', () => {
    const policy = makeDefaultPolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)

    expect(npv.surrenderNow.eecRate).toBe(0.96)
    expect(npv.surrenderNow.eecCharge).toBeCloseTo(29_000 * 0.96, 2)
    expect(npv.surrenderNow.netSurrenderValue).toBeCloseTo(29_000 - 29_000 * 0.96, 2)
  })

  it('keeps future exit options for post-MIP rows but caps bestExitYear to pre-MIP rows', () => {
    const policy = makeDefaultPolicy({ postMipYears: 5 })
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)

    expect(npv.futureExitOptions).toHaveLength(30)
    expect(npv.bestExitYear).toBeLessThanOrEqual(25)
    const minPreMip = Math.min(...npv.futureExitOptions.slice(0, 25).map((option) => option.totalNpvFees))
    expect(npv.bestExitNpvFees).toBeCloseTo(minPreMip, 2)
  })

  it('anchors hold-to-MIP metrics to the MIP end row, not the last projected row', () => {
    const policy = makeDefaultPolicy({ postMipYears: 10 })
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)

    expect(npv.holdToMip.finalValue).toBeCloseTo(projection.rows[24].combinedValue, 2)
    expect(npv.holdToMip.totalContributions).toBe(projection.rows[24].cumulativePremiums)
    expect(npv.holdToMip.totalNpvFees).toBeCloseTo(npv.futureExitOptions[24].totalNpvFees, 2)
    expect(npv.holdToMip.totalNpvFees).toBeGreaterThan(npv.holdToMip.npvGrossFees - npv.holdToMip.npvBonuses)
  })

  it('rejects assurance ages above the supported table ceiling', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      assuranceProfile: {
        currentAgeNextBirthday: 100,
        sex: 'male',
        smokerStatus: 'non-smoker',
      },
    }))).toThrow(/99/)
  })
})

describe('computeOpportunityCost', () => {
  it('compares surrender-and-invest alternatives at the common MIP-end horizon', () => {
    const policy = makeDefaultPolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)
    const opportunityCost = computeOpportunityCost(policy, projection, npv)
    const remainingMip = 25
    const annualContribution = policy.monthlyContribution * 12

    let expected = npv.surrenderNow.netSurrenderValue * Math.pow(1 + policy.alternativeReturn, remainingMip)
    for (let year = 1; year <= remainingMip; year += 1) {
      expected += annualContribution * Math.pow(1 + policy.alternativeReturn, remainingMip - year)
    }

    expect(opportunityCost.alternativePortfolioValue).toBeCloseTo(expected, 0)
    expect(opportunityCost.ilpValueAtHorizon).toBeCloseTo(projection.rows[24].combinedValue, 2)
    expect(opportunityCost.atBestExit.ilpValueAtHorizon).toBeCloseTo(opportunityCost.ilpValueAtHorizon, 2)
  })

  it('uses the modeled contribution stream instead of a flat annual premium', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 10,
      monthsAlreadyPaid: 120,
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 121,
          durationMonths: 3,
          repayMissedPremiums: false,
        },
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 128,
          durationMonths: 1,
          amount: 2_000,
        },
      ],
      bonuses: [],
    })
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)
    const opportunityCost = computeOpportunityCost(policy, projection, npv)
    const mipEndIndex = 19

    let expected = npv.surrenderNow.netSurrenderValue * Math.pow(1 + policy.alternativeReturn, 20)
    for (const row of projection.rows.slice(0, mipEndIndex + 1)) {
      expected += row.annualContribution * Math.pow(1 + policy.alternativeReturn, 20 - row.year)
    }

    expect(opportunityCost.alternativePortfolioValue).toBeCloseTo(expected, 0)
  })
})

describe('computeSummaryMetrics', () => {
  it('anchors summary totals to MIP end and ignores postMipYears', () => {
    const withPostMip = computeSummaryMetrics(
      makeDefaultPolicy({ postMipYears: 10 }),
      projectIlpPolicy(makeDefaultPolicy({ postMipYears: 10 }), 'mid'),
    )
    const withoutPostMip = computeSummaryMetrics(
      makeDefaultPolicy(),
      projectIlpPolicy(makeDefaultPolicy(), 'mid'),
    )

    expect(withPostMip.totalPremiumsPaid).toBe(withoutPostMip.totalPremiumsPaid)
    expect(withPostMip.totalFeesCharged).toBeCloseTo(withoutPostMip.totalFeesCharged, 2)
    expect(withPostMip.totalBonusesReceived).toBeCloseTo(withoutPostMip.totalBonusesReceived, 2)
  })

  it('uses current balances for surrender value and cancel-now penalty', () => {
    const policy = makeDefaultPolicy({
      accounts: [IUA_ACCOUNT, { ...AUA_ACCOUNT, currentValue: 5_000 }],
    })
    const summary = computeSummaryMetrics(policy, projectIlpPolicy(policy, 'mid'))

    expect(summary.cancelNowPenalty).toBeCloseTo(29_000 * 0.96, 2)
    expect(summary.currentSurrenderValue).toBeCloseTo(29_000 + 5_000 - (29_000 * 0.96), 2)
  })
})

describe('full ILP analysis', () => {
  it('returns projections, npv analysis, and summary for a policy', () => {
    const analysis = analyzeIlpPolicy(makeDefaultPolicy())

    expect(analysis.projections.low.rows.length).toBeGreaterThan(0)
    expect(analysis.projections.mid.rows.length).toBeGreaterThan(0)
    expect(analysis.projections.high.rows.length).toBeGreaterThan(0)
    expect(analysis.summary.netFeeDrag).toBeCloseTo(
      analysis.summary.totalFeesCharged - analysis.summary.totalBonusesReceived,
      2,
    )
  })

  it('builds a comparison table and disables currency-row highlighting for mixed currencies', () => {
    const policyUsd = makeDefaultPolicy()
    const policySgd = makeDefaultPolicy({
      id: 'policy-2',
      name: 'Competitor Policy',
      insurer: 'Other Insurer',
      currency: 'SGD',
      accounts: [
        { ...IUA_ACCOUNT, feeRate: 0.025 },
        { ...AUA_ACCOUNT, feeRate: 0.015 },
      ],
    })
    const result = analyzeAllPolicies([policyUsd, policySgd])
    const currencyRow = result.comparison.find((row) => row.metric === 'Net Fee Drag (to MIP)')
    const percentRow = result.comparison.find((row) => row.metric === 'Fee Drag % of Premiums')

    expect(result.policies).toHaveLength(2)
    expect(currencyRow?.lowerIsBetter).toBeNull()
    expect(percentRow?.lowerIsBetter).toBe(true)
  })

  it('returns no comparison rows for a single policy', () => {
    expect(analyzeAllPolicies([makeDefaultPolicy()]).comparison).toHaveLength(0)
  })

  it('can build a same-currency comparison table with highlighting metadata', () => {
    const analyses = [
      analyzeIlpPolicy(makeDefaultPolicy()),
      analyzeIlpPolicy(makeDefaultPolicy({
        id: 'policy-2',
        name: 'Lower Fee Policy',
        accounts: [
          { ...IUA_ACCOUNT, feeRate: 0.025 },
          { ...AUA_ACCOUNT, feeRate: 0.008 },
        ],
      })),
    ]
    const comparison = buildComparisonTable(analyses, {
      'policy-1': 'USD',
      'policy-2': 'USD',
    })

    expect(comparison.find((row) => row.metric === 'Net Fee Drag (to MIP)')?.lowerIsBetter).toBe(true)
  })
})
