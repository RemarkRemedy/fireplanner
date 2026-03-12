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

  it('splits premium-allocation and one-time bonuses evenly across target accounts', () => {
    const accounts: IlpAccount[] = [
      IUA_ACCOUNT,
      { ...AUA_ACCOUNT, id: 'aua1', label: 'AUA 1', contributionShare: 0.5 },
      { ...AUA_ACCOUNT, id: 'aua2', label: 'AUA 2', contributionShare: 0.5 },
    ]
    const allocationBonus: IlpBonusRule = {
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
    expect(accountRow(result.rows[0], 'additional').grossFee).toBeCloseTo(580, 2)
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

  it('throws for mature policies instead of silently projecting', () => {
    expect(() => projectIlpPolicy(makeDefaultPolicy({ currentPolicyYear: 30 }), 'mid')).toThrow(/at or past MIP/)
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
    expect(npv.holdToMip.totalNpvFees).toBeCloseTo(npv.holdToMip.npvGrossFees - npv.holdToMip.npvBonuses, 2)
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
