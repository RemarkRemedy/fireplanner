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
import { TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER } from '@/lib/data/ilpAssuranceConfig'
import { AIA_PLP2_DEATH_RATE_TABLE, FWD_FLEXI_ELITE_DEATH_RATE_TABLE, INCOME_LEGACY_FLEX_SOLITAIRE_DEATH_TI_RATE_TABLE, TOKIO_MPC_UNZO_DEATH_RATE_TABLE } from '@/lib/data/ilpAssuranceTables'
import { ilpPolicySeedSchema } from '@/lib/ilp-catalog/policySeedSchema'
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

const TEN_PERCENT_RETURN_FUND: IlpFund = {
  name: 'Ten Percent Return Test Fund',
  allocation: 1,
  ocf: 0,
  grossReturnLow: 0.1,
  grossReturnMid: 0.1,
  grossReturnHigh: 0.1,
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

function makeOpenEndedPolicy(overrides: Partial<IlpPolicyInput> = {}): IlpPolicyInput {
  return {
    id: 'open-ended-policy',
    name: 'Open-ended Policy',
    insurer: 'Test Insurer',
    currency: 'SGD',
    monthlyContribution: 100,
    monthsAlreadyPaid: 12,
    currentPolicyYear: 1,
    mipBasis: 'open-ended',
    mipLength: null,
    postMipYears: 3,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        currentValue: 0,
        contributionShare: 0,
        subjectToEec: false,
        postMipFeeRate: null,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      },
    ],
    eecTable: [],
    funds: [ZERO_RETURN_FUND],
    bonuses: [],
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

  it('supports uninterrupted open-ended premium flow without a finite MIP', () => {
    const policy = makeOpenEndedPolicy()
    const result = projectIlpPolicy(policy, 'mid')

    expect(computeTotalProjectionYears(policy)).toBe(3)
    expect(result.rows).toHaveLength(3)
    expect(result.rows.map((row) => row.annualContribution)).toEqual([1_200, 1_200, 1_200])
    expect(result.rows.every((row) => row.eecRate === 0)).toBe(true)
  })

  it('freezes open-ended premium flow during a missed-premium / premium-free-period event', () => {
    const policy = makeOpenEndedPolicy({
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(0)
    expect(result.rows[1].annualContribution).toBe(1_200)
  })

  it('resumes open-ended premium flow after premium restart', () => {
    const policy = makeOpenEndedPolicy({
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
      postMipYears: 4,
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.slice(0, 4).map((row) => row.annualContribution)).toEqual([0, 1_200, 1_200, 1_200])
  })

  it('keeps payout-capable open-ended policies on the uninterrupted baseline until a manual payout assumption is supplied', () => {
    const policy = makeOpenEndedPolicy({
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
      scheduledPayoutAssumption: {
        mode: 'disabled',
      },
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.map((row) => row.annualContribution)).toEqual([1_200, 1_200, 1_200])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 0, 0])
  })

  it('freezes payout-capable premium flow during a missed-premium / premium-free-period event', () => {
    const policy = makeOpenEndedPolicy({
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: 3,
        durationYears: 2,
        annualPayoutAmount: 600,
      },
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4])
    expect(result.rows.map((row) => row.annualContribution)).toEqual([0, 1_200, 1_200])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 600, 600])
    expect(accountRow(result.rows[1], 'policy').withdrawalAmount).toBe(600)
  })

  it('resumes payout-capable premium flow after premium restart and stops scheduled payout after its configured duration', () => {
    const policy = makeOpenEndedPolicy({
      postMipYears: 4,
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: 3,
        durationYears: 2,
        annualPayoutAmount: 500,
      },
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4, 5])
    expect(result.rows.map((row) => row.annualContribution)).toEqual([0, 1_200, 1_200, 1_200])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 500, 500, 0])
    expect(accountRow(result.rows[3], 'policy').withdrawalAmount).toBe(0)
  })

  it('keeps scheduled payout redemptions out of partial-withdrawal event charges', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 1,
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: 2,
        durationYears: 1,
        annualPayoutAmount: 150,
      },
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      eventChargeRules: [
        {
          id: 'partial-withdrawal-charge',
          label: 'Partial Withdrawal Charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['policy'],
          rate: 0.25,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      bonuses: [],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualWithdrawals).toBe(150)
    expect(accountRow(result.rows[0], 'policy').withdrawalAmount).toBe(150)
    expect(accountRow(result.rows[0], 'policy').grossFee).toBe(0)
  })


  it('keeps reinvest-default distribution support on the uninterrupted baseline', () => {
    const basePolicy = makeOpenEndedPolicy()
    const distributionPolicy = makeOpenEndedPolicy({
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'reinvest',
        source: 'catalog-default',
      },
    })

    const baseResult = projectIlpPolicy(basePolicy, 'mid')
    const distributionResult = projectIlpPolicy(distributionPolicy, 'mid')

    expect(distributionResult.rows).toEqual(baseResult.rows)
  })

  it('keeps reinvest-default distribution support stable during a missed-premium / premium-free-period year', () => {
    const policy = makeOpenEndedPolicy({
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'reinvest',
        source: 'catalog-default',
      },
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.map((row) => row.annualContribution)).toEqual([0, 1_200, 1_200])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 0, 0])
  })

  it('keeps reinvest-default distribution support stable after premium restart', () => {
    const policy = makeOpenEndedPolicy({
      postMipYears: 4,
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'reinvest',
        source: 'catalog-default',
      },
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.slice(0, 4).map((row) => row.annualContribution)).toEqual([0, 1_200, 1_200, 1_200])
    expect(result.rows.slice(0, 4).map((row) => row.annualWithdrawals)).toEqual([0, 0, 0, 0])
  })

  it('reduces policy value only after MIP when a cash-payout distribution assumption is supplied', () => {
    const policy = makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 24,
      currentPolicyYear: 1,
      mipLength: 2,
      postMipYears: 2,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: false,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.1,
      },
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 100, 90])
    expect(result.rows.map((row) => accountRow(row, 'policy').close)).toEqual([1_000, 900, 810])
  })

  it('deducts cash-payout distributions after growth when the fund has a positive return', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 24,
      currentPolicyYear: 1,
      mipLength: 2,
      postMipYears: 2,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [TEN_PERCENT_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: false,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.1,
      },
    }), 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 110, 110])
    expect(result.rows.map((row) => accountRow(row, 'policy').close)).toEqual([1_100, 1_100, 1_100])
  })

  it('switches payout-eligible accounts when authored distribution windows cross the MIP boundary', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 24,
      currentPolicyYear: 1,
      mipLength: 2,
      postMipYears: 2,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 500,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['initial', 'accumulation'],
        cashPayoutWindows: [
          { startPolicyYear: 1, endPolicyYear: 2, accountIds: ['accumulation'] },
          { startPolicyYear: 3, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
        ],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.1,
      },
    }), 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([50, 145, 130.5])
    expect(result.rows.map((row) => accountRow(row, 'initial').close)).toEqual([1_000, 900, 810])
    expect(result.rows.map((row) => accountRow(row, 'accumulation').close)).toEqual([450, 405, 364.5])
  })

  it('forces reinvestment when no authored distribution window is active for the current policy year', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 24,
      currentPolicyYear: 1,
      mipLength: 2,
      postMipYears: 2,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        cashPayoutWindows: [
          { startPolicyYear: 4, endPolicyYear: null, accountIds: ['policy'] },
        ],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.1,
      },
    }), 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 0, 100])
    expect(result.rows.map((row) => accountRow(row, 'policy').close)).toEqual([1_000, 1_000, 900])
  })

  it('forces reinvestment for a gap between authored distribution windows before cash payouts resume', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 24,
      currentPolicyYear: 1,
      mipLength: 2,
      postMipYears: 3,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 500,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['initial', 'accumulation'],
        cashPayoutWindows: [
          { startPolicyYear: 1, endPolicyYear: 2, accountIds: ['accumulation'] },
          { startPolicyYear: 4, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
        ],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.1,
      },
    }), 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([2, 3, 4, 5])
    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([50, 0, 145, 130.5])
    expect(result.rows.map((row) => accountRow(row, 'initial').close)).toEqual([1_000, 1_000, 900, 810])
    expect(result.rows.map((row) => accountRow(row, 'accumulation').close)).toEqual([450, 450, 405, 364.5])
  })

  it('does not regress scheduled payout support when distribution support is also present', () => {
    const policy = makeOpenEndedPolicy({
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: 3,
        durationYears: 2,
        annualPayoutAmount: 600,
      },
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'reinvest',
        source: 'catalog-default',
      },
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.map((row) => row.annualWithdrawals)).toEqual([0, 600, 600])
  })

  it('caps scheduled payouts at the available account balance', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      accounts: [{
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        currentValue: 50,
        contributionShare: 0,
        subjectToEec: false,
        postMipFeeRate: null,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      }],
      scheduledPayoutSupport: {
        mode: 'manual-assumption',
        accountId: 'policy',
        source: 'policy-redemption',
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: 2,
        durationYears: 1,
        annualPayoutAmount: 600,
      },
    }), 'mid')

    expect(result.rows[0].annualWithdrawals).toBe(50)
    expect(accountRow(result.rows[0], 'policy').withdrawalAmount).toBe(50)
    expect(accountRow(result.rows[0], 'policy').close).toBe(0)
  })

  it('does not erode the protected premium base when cash distributions are paid from an assured account', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      postMipYears: 4,
      assuranceProfile: {
        currentAgeNextBirthday: 24,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
        currentNetSupplementaryPremiumBase: 0,
      },
      chargeRules: [
        {
          id: 'investready-protection-charge',
          label: 'Cost of Insurance',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'manulife-investready-iii-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['policy'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.1,
      },
    }), 'mid')

    const yearThreeOpen = accountRow(result.rows[1], 'policy').close
    const yearThreeDistribution = yearThreeOpen * 0.1
    const yearThreeMidpointApplicableValue = (
      yearThreeOpen + (yearThreeOpen + 1_200 - yearThreeDistribution)
    ) / 2
    const expectedYearThreeGrossFee = (((3_600 + 600) * 1.01) - yearThreeMidpointApplicableValue) * 0.64 / 1000

    expect(accountRow(result.rows[2], 'policy').grossFee).toBeCloseTo(expectedYearThreeGrossFee, 9)
  })

  it('clamps provisional closes before protected-base assurance sum-at-risk math', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      accounts: [{
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        currentValue: 100,
        contributionShare: 0,
        subjectToEec: false,
        postMipFeeRate: null,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      }],
      assuranceProfile: {
        currentAgeNextBirthday: 98,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 200,
        currentNetSupplementaryPremiumBase: 0,
      },
      chargeRules: [
        {
          id: 'startup-charge',
          label: 'Startup Charge',
          basis: 'fixed-annual',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 400,
          allocation: 'equal-split',
        },
        {
          id: 'investready-protection-charge',
          label: 'Cost of Insurance',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'manulife-investready-iii-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 120,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(449.551696, 5)
    expect(accountRow(result.rows[0], 'policy').close).toBe(0)
  })

  it('grows protected-base assurance charges under uninterrupted paid-premium flow', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      postMipYears: 4,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
        currentNetSupplementaryPremiumBase: 0,
      },
      chargeRules: [
        {
          id: 'investready-protection-charge',
          label: 'Cost of Insurance',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'manulife-investready-iii-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    const yearOneFee = accountRow(result.rows[0], 'policy').grossFee
    const yearTwoFee = accountRow(result.rows[1], 'policy').grossFee

    expect(yearOneFee).toBeGreaterThan(0)
    expect(yearTwoFee).toBeGreaterThan(yearOneFee)
  })

  it('freezes protected-base assurance growth during a missed-premium / premium-free-period year', () => {
    const buildPolicy = (policyEvents?: IlpPolicyInput['policyEvents']) => makeOpenEndedPolicy({
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
        currentNetSupplementaryPremiumBase: 0,
      },
      chargeRules: [
        {
          id: 'investready-protection-charge',
          label: 'Cost of Insurance',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'manulife-investready-iii-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      policyEvents,
    })

    const baseline = projectIlpPolicy(buildPolicy(), 'mid')
    const frozen = projectIlpPolicy(buildPolicy([
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 13,
        durationMonths: 12,
        repayMissedPremiums: false,
      },
    ]), 'mid')

    expect(frozen.rows[0].annualContribution).toBe(0)
    expect(accountRow(frozen.rows[0], 'policy').grossFee).toBeLessThan(accountRow(baseline.rows[0], 'policy').grossFee)
  })

  it('resumes protected-base assurance growth after premium restart', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      postMipYears: 4,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
        currentNetSupplementaryPremiumBase: 0,
      },
      chargeRules: [
        {
          id: 'investready-protection-charge',
          label: 'Cost of Insurance',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'manulife-investready-iii-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 13,
          durationMonths: 12,
          repayMissedPremiums: false,
        },
      ],
    }), 'mid')

    const frozenYearFee = accountRow(result.rows[0], 'policy').grossFee
    const resumedYearFee = accountRow(result.rows[1], 'policy').grossFee

    expect(result.rows[0].annualContribution).toBe(0)
    expect(result.rows[1].annualContribution).toBe(1_200)
    expect(resumedYearFee).toBeGreaterThan(frozenYearFee)
  })

  it('annualizes GREAT Wealth Advantage 4 assurance charges from the published appendix table', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 108,
      currentPolicyYear: 10,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 30,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
        currentNetSupplementaryPremiumBase: 20_000,
      },
      chargeRules: [
        {
          id: 'great-eastern-wa4-insurance-charge',
          label: 'Death / TI Insurance Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'great-eastern-wa4-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(88.2816, 4)
  })

  it('annualizes FWD Invest Flexi Elite assurance charges from the published appendix table', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      currentPolicyYear: 10,
      postMipYears: 1,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 5_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
        currentNetSupplementaryPremiumBase: 20_000,
      },
      chargeRules: [
        {
          id: 'fwd-flexi-elite-insurance-charge',
          label: 'Insurance Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['initial', 'accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'fwd-invest-flexi-elite-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    const rate = FWD_FLEXI_ELITE_DEATH_RATE_TABLE['male-non-smoker'][39] ?? 0
    const openValue = 35_000
    const provisionalClose = openValue
    const midpointValue = (openValue + provisionalClose) / 2
    const sumAtRisk = Math.max(0, ((100_000 + 20_000) * 1.01) - midpointValue)
    const expectedAnnualCharge = sumAtRisk * rate / 1000

    const initialFee = accountRow(result.rows[0], 'initial').grossFee
    const accumulationFee = accountRow(result.rows[0], 'accumulation').grossFee

    expect(initialFee + accumulationFee).toBeCloseTo(expectedAnnualCharge, 6)
    expect(initialFee).toBeCloseTo(expectedAnnualCharge * (30_000 / 35_000), 6)
    expect(accumulationFee).toBeCloseTo(expectedAnnualCharge * (5_000 / 35_000), 6)
  })

  it('annualizes Legacy Flex Solitaire insurance charges from the published Appendix 1 table using current adjusted sum assured', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      currentPolicyYear: 7,
      postMipYears: 1,
      accounts: [
        {
          id: 'premium',
          label: 'Premium Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Account',
          feeRate: 0,
          currentValue: 10_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 45,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentSumAssured: 150_000,
      },
      chargeRules: [
        {
          id: 'legacy-flex-insurance-charge',
          label: 'Insurance Cover Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['premium'],
          assuranceValueAppliesTo: ['premium', 'topup'],
          fallbackAppliesTo: ['topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'income-legacy-flex-solitaire-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 120,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    const rate = INCOME_LEGACY_FLEX_SOLITAIRE_DEATH_TI_RATE_TABLE['male-non-smoker'][44] ?? 0
    const openValue = 40_000
    const provisionalClose = openValue
    const midpointValue = (openValue + provisionalClose) / 2
    const sumAtRisk = Math.max(0, 150_000 - midpointValue)
    const expectedAnnualCharge = sumAtRisk * rate / 1000

    const premiumFee = accountRow(result.rows[0], 'premium').grossFee
    const topupFee = accountRow(result.rows[0], 'topup').grossFee

    expect(premiumFee + topupFee).toBeCloseTo(expectedAnnualCharge, 6)
    expect(premiumFee).toBeCloseTo(expectedAnnualCharge, 6)
    expect(topupFee).toBe(0)
  })

  it('reduces FWD Invest Flexi Elite assurance charges when a partial withdrawal reduces the protected base', () => {
    const buildPolicy = (policyEvents?: IlpPolicyInput['policyEvents']) => makeOpenEndedPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 108,
      currentPolicyYear: 10,
      postMipYears: 1,
      funds: [ZERO_RETURN_FUND],
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 5_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
        currentNetSupplementaryPremiumBase: 20_000,
      },
      chargeRules: [
        {
          id: 'fwd-flexi-elite-insurance-charge',
          label: 'Insurance Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['initial', 'accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'fwd-invest-flexi-elite-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      policyEvents,
    })

    const baseline = projectIlpPolicy(buildPolicy(), 'mid')
    const withdrawn = projectIlpPolicy(buildPolicy([
      {
        id: 'partial-withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 109,
        durationMonths: 1,
        amount: 10_000,
        accountId: 'initial',
      },
    ]), 'mid')

    const baselineCharge = accountRow(baseline.rows[0], 'initial').grossFee + accountRow(baseline.rows[0], 'accumulation').grossFee
    const withdrawnCharge = accountRow(withdrawn.rows[0], 'initial').grossFee + accountRow(withdrawn.rows[0], 'accumulation').grossFee

    expect(withdrawnCharge).toBeLessThan(baselineCharge)
  })

  it('supports sum-assured protected-base assurance formulas without regressing existing assurance families', () => {
    const greatLifeResult = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 15_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentBasicSumAssured: 120_000,
        currentNetSupplementaryPremiumBase: 10_000,
      },
      chargeRules: [
        {
          id: 'great-life-protection-charge',
          label: 'Insurance Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'great-eastern-gla4-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    expect(accountRow(greatLifeResult.rows[0], 'policy').grossFee).toBeCloseTo(149.155, 4)

    const duoResult = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentSumAssured: 10_000,
      },
      chargeRules: [
        {
          id: 'manuinvest-duo-protection-charge',
          label: 'Cost of Insurance',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'manulife-manuinvest-duo-death-ti-tpd',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
          allocation: 'pro-rata-by-value',
        },
      ],
    }), 'mid')

    expect(accountRow(duoResult.rows[0], 'policy').grossFee).toBeCloseTo(10.2924, 4)

    const prudentialResult = projectIlpPolicy(makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 10,
      accounts: PRUDENTIAL_PROSPER_ACCOUNTS,
      funds: [ZERO_RETURN_FUND],
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
    }), 'mid')

    const hsbcResult = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 120,
      currentPolicyYear: 10,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Value',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
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
          appliesTo: ['policy'],
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
    }), 'mid')

    expect(accountRow(prudentialResult.rows[0], 'growth').grossFee).toBeCloseTo(2.071656, 6)
    expect(accountRow(hsbcResult.rows[0], 'policy').grossFee).toBeCloseTo(77.4, 6)
  })

  it('does not regress finite-MIP contribution cutoff behavior', () => {
    const policy = makeDefaultPolicy({ postMipYears: 2 })
    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[24].policyYear).toBe(30)
    expect(result.rows[25].policyYear).toBe(31)
    expect(result.rows[24].annualContribution).toBeGreaterThan(0)
    expect(result.rows[25].annualContribution).toBe(0)
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

  it('does not let top-ups inflate premium-allocation bonuses', () => {
    const bonusAccount: IlpAccount = {
      id: 'bonus',
      label: 'Bonus Account',
      feeRate: 0,
      currentValue: 0,
      contributionShare: 1,
      subjectToEec: false,
      postMipFeeRate: null,
    }
    const allocationBonus: IlpBonusRule = {
      id: 'regular-premium-bonus',
      type: 'allocation',
      label: 'Regular Premium Bonus',
      mode: 'premium-allocation',
      rate: 0.1,
      amount: 0,
      appliesTo: ['bonus'],
      startPolicyYear: 6,
      endPolicyYear: null,
    }
    const policy = makeDefaultPolicy({
      monthlyContribution: 100,
      accounts: [bonusAccount],
      funds: [ZERO_RETURN_FUND],
      bonuses: [allocationBonus],
      chargeRules: [],
      policyEvents: [{
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 61,
        durationMonths: 1,
        amount: 1_000,
        accountId: 'bonus',
      }],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'bonus').contributionAmount).toBe(2_200)
    expect(accountRow(result.rows[0], 'bonus').bonusCredit).toBeCloseTo(120, 2)
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

  it('gates premium-year recurring charges on premiums being paid up to date and extends them after premium holiday', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      monthlyContribution: 100,
      postMipYears: 3,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 0 },
        { ...AUA_ACCOUNT, currentValue: 10_000, feeRate: 0, postMipFeeRate: 0, contributionShare: 1 },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 25,
          durationMonths: 12,
          repayMissedPremiums: true,
          repaymentAccountId: 'aua',
        },
      ],
      chargeRules: [
        {
          id: 'supplementary-charge',
          label: 'Supplementary Charge',
          basis: 'account-value',
          activeWindow: 'policy-term',
          yearBasis: 'premium-year',
          requiresPremiumsPaidUpToDate: true,
          appliesTo: ['aua'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 2, rate: 0.1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.05 },
            { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
          ],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows.slice(0, 3).map((row) => row.policyYear)).toEqual([3, 4, 5])
    expect(accountRow(result.rows[0], 'aua').grossFee).toBe(0)
    expect(accountRow(result.rows[1], 'aua').grossFee).toBeCloseTo(500, 6)
    expect(accountRow(result.rows[2], 'aua').grossFee).toBe(0)
  })

  it('keeps premium-year recurring charges active when premiums remain current', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      monthlyContribution: 100,
      postMipYears: 2,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 0 },
        { ...AUA_ACCOUNT, currentValue: 10_000, feeRate: 0, postMipFeeRate: 0, contributionShare: 1 },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'supplementary-charge',
          label: 'Supplementary Charge',
          basis: 'account-value',
          activeWindow: 'policy-term',
          yearBasis: 'premium-year',
          requiresPremiumsPaidUpToDate: true,
          appliesTo: ['aua'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 2, rate: 0.1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.05 },
            { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
          ],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(500, 6)
    expect(accountRow(result.rows[1], 'aua').grossFee).toBe(0)
  })

  it('does not change existing recurring charges when the payment-history gate is absent', () => {
    const policy = makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      monthlyContribution: 100,
      postMipYears: 2,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 0 },
        { ...AUA_ACCOUNT, currentValue: 10_000, feeRate: 0, postMipFeeRate: 0, contributionShare: 1 },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      policyEvents: [
        {
          id: 'holiday-1',
          type: 'premium-holiday',
          startPolicyMonth: 25,
          durationMonths: 12,
          repayMissedPremiums: true,
          repaymentAccountId: 'aua',
        },
      ],
      chargeRules: [
        {
          id: 'supplementary-charge',
          label: 'Supplementary Charge',
          basis: 'account-value',
          activeWindow: 'policy-term',
          yearBasis: 'premium-year',
          appliesTo: ['aua'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 2, rate: 0.1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.05 },
            { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
          ],
          rate: 0,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(1_000, 6)
    expect(accountRow(result.rows[1], 'aua').grossFee).toBeCloseTo(450, 6)
  })

  it('excludes top-up flows from annual-contribution charge rules', () => {
    const policy = makeDefaultPolicy({
      monthsAlreadyPaid: 0,
      monthlyContribution: 100,
      accounts: [
        { ...IUA_ACCOUNT, currentValue: 0, feeRate: 0, postMipFeeRate: 0, contributionShare: 0 },
        {
          ...AUA_ACCOUNT,
          currentValue: 0,
          feeRate: 0,
          postMipFeeRate: 0,
          contributionShare: 1,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
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
          rate: 0.05,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 3,
          durationMonths: 1,
          amount: 1_500,
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].annualContribution).toBe(2_700)
    expect(accountRow(result.rows[0], 'aua').contributionAmount).toBe(2_700)
    expect(accountRow(result.rows[0], 'aua').grossFee).toBeCloseTo(60, 2)
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

  it('computes Tokio MPC from net premium less 101% of the accumulation-account midpoint value', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 100,
      monthsAlreadyPaid: 12,
      currentPolicyYear: 2,
      mipLength: 10,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 500,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }), 'mid')

    const midpointNetPremiumBase = 1_200 + (1_200 / 2)
    const midpointAccumulationValue = (1_000 + 2_200) / 2
    const expectedTokioCharge = Math.max(0, midpointNetPremiumBase - (midpointAccumulationValue * 1.01)) * 0.0655 / 1000 * 12

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(expectedTokioCharge, 9)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBe(0)
  })

  it('floors Tokio MPC at zero when 101% of accumulation value reaches net premium', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 12,
      currentPolicyYear: 2,
      mipLength: 10,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBe(0)
  })

  it('falls back Tokio MPC from accumulation to topup when the primary account is insufficient', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 48,
      currentPolicyYear: 5,
      mipLength: 10,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 800,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 99,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 30_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBe(1)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBe(800)
  })

  it('values Tokio MPC from initial plus accumulation while still deducting from accumulation first', () => {
    const policy = makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 48,
      currentPolicyYear: 5,
      mipLength: 10,
      postMipYears: 0,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 800,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 100,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc-valued-across-initial-and-accumulation',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['initial', 'topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 200_000,
      },
    })
    const result = projectIlpPolicy(policy, 'mid')
    const baseline = projectIlpPolicy(makeDefaultPolicy({
      ...policy,
      chargeRules: policy.chargeRules?.map((rule) => ({
        ...rule,
        assuranceValueAppliesTo: undefined,
      })),
    }), 'mid')

    const row = result.rows[0]
    const baselineRow = baseline.rows[0]
    const totalCharge = ['initial', 'accumulation', 'topup']
      .reduce((sum, accountId) => sum + accountRow(row, accountId).grossFee, 0)
    const baselineTotalCharge = ['initial', 'accumulation', 'topup']
      .reduce((sum, accountId) => sum + accountRow(baselineRow, accountId).grossFee, 0)

    expect(totalCharge).toBeLessThan(baselineTotalCharge)
    expect(accountRow(row, 'accumulation').grossFee).toBe(100)
    expect(accountRow(row, 'initial').grossFee).toBeGreaterThan(0)
    expect(accountRow(row, 'topup').grossFee).toBeGreaterThan(0)
  })

  it('defaults assurance valuation accounts to appliesTo when assuranceValueAppliesTo is omitted', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 12,
      currentPolicyYear: 2,
      mipLength: 10,
      postMipYears: 0,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 5_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc-default-valuation-scope',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }), 'mid')

    const midpointAccumulationValue = 1_000
    const expectedCharge = Math.max(0, 1_200 - (midpointAccumulationValue * TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER))
      * 0.0655 / 1000 * 12

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(expectedCharge, 9)
    expect(accountRow(result.rows[0], 'initial').grossFee).toBe(0)
    expect(accountRow(result.rows[0], 'topup').grossFee).toBe(0)
  })

  it('accrues Tokio MPC for policy years 1 to 3 and settles the carried balance in policy year 4', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 5,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 5_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 5_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc-accrued',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }), 'mid')

    const tokioRates = TOKIO_MPC_UNZO_DEATH_RATE_TABLE['male-non-smoker']
    const expectedSettlementCharge = [40, 41, 42, 43]
      .map((age) => (tokioRates[age - 1] ?? 0) * 1_200 / 1000 * 12)
      .reduce((sum, value) => sum + value, 0)
    const expectedYearFiveCharge = (tokioRates[43] ?? 0) * 1_200 / 1000 * 12

    expect(result.rows.map((row) => row.policyYear)).toEqual([1, 2, 3, 4, 5])
    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[1], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[2], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[3], 'topup').grossFee).toBeCloseTo(expectedSettlementCharge / 2, 9)
    expect(accountRow(result.rows[3], 'initial').grossFee).toBeCloseTo(expectedSettlementCharge / 2, 9)
    expect(accountRow(result.rows[4], 'topup').grossFee).toBeCloseTo(expectedYearFiveCharge / 2, 9)
    expect(accountRow(result.rows[4], 'initial').grossFee).toBeCloseTo(expectedYearFiveCharge / 2, 9)
  })

  it('accrues Tokio MPC using separate valuation accounts before settling through the published deduction accounts', () => {
    const policy = makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 4,
      postMipYears: 0,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 300,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 50,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 500,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc-accrued-valued-across-initial-and-accumulation',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['initial', 'topup'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 50_000,
      },
    })
    const result = projectIlpPolicy(policy, 'mid')
    const baseline = projectIlpPolicy(makeDefaultPolicy({
      ...policy,
      chargeRules: policy.chargeRules?.map((rule) => ({
        ...rule,
        assuranceValueAppliesTo: undefined,
      })),
    }), 'mid')

    const settlementRow = result.rows[3]
    const baselineSettlementRow = baseline.rows[3]
    const settlementTotalCharge = ['initial', 'accumulation', 'topup']
      .reduce((sum, accountId) => sum + accountRow(settlementRow, accountId).grossFee, 0)
    const baselineSettlementTotalCharge = ['initial', 'accumulation', 'topup']
      .reduce((sum, accountId) => sum + accountRow(baselineSettlementRow, accountId).grossFee, 0)

    expect(result.rows.map((row) => row.policyYear)).toEqual([1, 2, 3, 4])
    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[1], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[2], 'accumulation').grossFee).toBe(0)
    expect(settlementTotalCharge).toBeLessThan(baselineSettlementTotalCharge)
    expect(accountRow(settlementRow, 'accumulation').grossFee).toBe(50)
    expect(accountRow(settlementRow, 'initial').grossFee).toBeGreaterThan(0)
    expect(accountRow(settlementRow, 'topup').grossFee).toBeGreaterThan(0)
  })

  it('settles accrued Tokio MPC through accumulation, then topup, then initial', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 4,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 1,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 10,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc-accrued',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }), 'mid')

    const settlementRow = result.rows[3]
    const tokioRates = TOKIO_MPC_UNZO_DEATH_RATE_TABLE['male-non-smoker']
    const midpointSumAtRisk = Math.max(0, 1_200 - (1 * TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER))
    const expectedSettlementCharge = [40, 41, 42, 43]
      .map((age) => (tokioRates[age - 1] ?? 0) * midpointSumAtRisk / 1000 * 12)
      .reduce((sum, value) => sum + value, 0)

    expect(accountRow(settlementRow, 'accumulation').grossFee).toBe(1)
    expect(accountRow(settlementRow, 'topup').grossFee).toBe(1)
    expect(accountRow(settlementRow, 'initial').grossFee).toBeCloseTo(expectedSettlementCharge - 2, 9)
  })

  it('carries unpaid accrued Tokio MPC forward after the settlement year until balances recover', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 100,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 5,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      policyEvents: [
        {
          id: 'tokio-accrual-holiday',
          type: 'premium-holiday',
          startPolicyMonth: 1,
          durationMonths: 36,
        },
      ],
      chargeRules: [
        {
          id: 'tokio-mpc-accrued',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 70_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[3], 'accumulation').grossFee).toBe(1)
    expect(accountRow(result.rows[4], 'accumulation').grossFee).toBeGreaterThan(300)
    expect(accountRow(result.rows[4], 'accumulation').grossFee).toBeLessThan(400)
  })

  it('disables future Tokio MPC after a failed deduction while still collecting the carried balance later', () => {
    const policy = makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 5,
      postMipYears: 0,
      policyEvents: [
        {
          id: 'tokio-recovery-top-up',
          type: 'top-up',
          startPolicyMonth: 25,
          durationMonths: 1,
          amount: 1_000,
          accountId: 'accumulation',
        },
      ],
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 5_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-mpc-disable-after-failed-deduction',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
            disableFutureChargesOnInsufficientDeduction: true,
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 70_000,
      },
    })

    const result = projectIlpPolicy(policy, 'mid')
    const baseline = projectIlpPolicy(makeDefaultPolicy({
      ...policy,
      chargeRules: policy.chargeRules?.map((rule) => ({
        ...rule,
        assuranceConfig: rule.assuranceConfig
          ? {
              ...rule.assuranceConfig,
              disableFutureChargesOnInsufficientDeduction: false,
            }
          : undefined,
      })),
    }), 'mid')

    expect(result.rows.map((row) => row.policyYear)).toEqual([1, 2, 3, 4, 5])
    expect(accountRow(result.rows[2], 'accumulation').grossFee).toBe(1)
    expect(accountRow(result.rows[3], 'accumulation').grossFee).toBeGreaterThan(100)
    expect(accountRow(result.rows[3], 'accumulation').grossFee).toBeLessThan(accountRow(baseline.rows[3], 'accumulation').grossFee)
    expect(accountRow(result.rows[4], 'accumulation').grossFee).toBe(0)
    expect(accountRow(result.rows[4], 'accumulation').grossFee).toBeLessThan(accountRow(baseline.rows[4], 'accumulation').grossFee)
  })

  it('does not carry unpaid balances forward for non-accrued Tokio MPC rules', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 100,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 2,
      postMipYears: 0,
      accounts: [
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 1,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
        {
          id: 'topup',
          label: 'Top-up Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      policyEvents: [
        {
          id: 'tokio-immediate-holiday',
          type: 'premium-holiday',
          startPolicyMonth: 1,
          durationMonths: 12,
        },
      ],
      chargeRules: [
        {
          id: 'tokio-mpc-immediate',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
          requiresManualInput: true,
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 70_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBe(1)
    expect(accountRow(result.rows[1], 'accumulation').grossFee).toBe(0)
  })

  it('charges Tokio secure MPC against the locked-in policy value floor when it exceeds tracked policy value', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 2,
      postMipYears: 0,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 40_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-secure-mpc',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-locked-in-policy-value',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            tokioProtectionState: {
              mode: 'locked-in-policy-value',
              trackedValueAccountIds: ['initial', 'accumulation'],
              withdrawalReductionAccountIds: ['initial', 'accumulation'],
            },
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentLockedInPolicyValue: 100_000,
      },
    }), 'mid')

    const yearOneRate = TOKIO_MPC_UNZO_DEATH_RATE_TABLE['male-non-smoker'][39] ?? 0
    const expectedYearOneCharge = yearOneRate * 30_000 / 1000 * 12

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBeCloseTo(expectedYearOneCharge, 6)
  })

  it('floors Tokio secure MPC at zero when tracked policy value is already above the locked-in floor', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 2,
      postMipYears: 0,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 40_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-secure-mpc-zero',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-locked-in-policy-value',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            tokioProtectionState: {
              mode: 'locked-in-policy-value',
              trackedValueAccountIds: ['initial', 'accumulation'],
              withdrawalReductionAccountIds: ['initial', 'accumulation'],
            },
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentLockedInPolicyValue: 60_000,
      },
    }), 'mid')

    expect(accountRow(result.rows[0], 'accumulation').grossFee).toBe(0)
  })

  it('reduces Tokio secure locked-in policy value proportionally after a partial withdrawal', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipLength: 2,
      postMipYears: 0,
      accounts: [
        {
          id: 'initial',
          label: 'Initial Units Account',
          feeRate: 0,
          currentValue: 100_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
        {
          id: 'accumulation',
          label: 'Accumulation Units Account',
          feeRate: 0,
          currentValue: 100_000,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'after-mip', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      policyEvents: [
        {
          id: 'tokio-secure-withdrawal',
          type: 'partial-withdrawal',
          startPolicyMonth: 1,
          durationMonths: 1,
          amount: 50_000,
          accountId: 'accumulation',
        },
      ],
      chargeRules: [
        {
          id: 'tokio-secure-mpc-withdrawal',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-locked-in-policy-value',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            tokioProtectionState: {
              mode: 'locked-in-policy-value',
              trackedValueAccountIds: ['initial', 'accumulation'],
              withdrawalReductionAccountIds: ['initial', 'accumulation'],
            },
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentLockedInPolicyValue: 240_000,
      },
    }), 'mid')

    // Year two uses the withdrawal-reduced locked-in floor after year-one MPC has
    // already reduced the tracked policy-value close, so the modeled risk is
    // slightly above a naive 30,000 remainder.
    const expectedYearTwoCharge = 26.772527916000012

    expect(accountRow(result.rows[1], 'accumulation').grossFee).toBeCloseTo(expectedYearTwoCharge, 6)
  })

  it('charges Tokio secure MPC against the higher adjusted-single-premium floor on open-ended secure products', () => {
    const result = projectIlpPolicy(makeDefaultPolicy({
      currency: 'SGD',
      monthlyContribution: 0,
      initialSinglePremium: 100_000,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 0,
      mipBasis: 'open-ended',
      mipLength: null,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Single Premium Units Account',
          feeRate: 0,
          currentValue: 30_000,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'tokio-goelite-secure-mpc',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          assuranceValueAppliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            tokioProtectionState: {
              mode: 'locked-in-policy-value-with-adjusted-single-premium',
              trackedValueAccountIds: ['policy'],
              withdrawalReductionAccountIds: ['policy'],
            },
          },
          requiresManualInput: true,
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentLockedInPolicyValue: 70_000,
        currentAdjustedSinglePremium: 100_000,
      },
    }), 'mid')

    const yearOneRate = TOKIO_MPC_UNZO_DEATH_RATE_TABLE['male-non-smoker'][39] ?? 0
    const expectedYearOneCharge = yearOneRate * 70_000 / 1000 * 12

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(expectedYearOneCharge, 6)
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

  it('projects the AIA PLP II Plus benefit charge with the first-policy-year and insured-amount discounts', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      currentPolicyYear: 0,
      monthsAlreadyPaid: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 50_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      chargeRules: [
        {
          id: 'benefit-charge',
          label: 'Benefit Charge (Plus)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'aia-plp2-plus-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
            policyYearRateMultiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 1, multiplier: 0.5 },
            ],
            sumAssuredRateMultiplierTiers: [
              { minSumAssured: 0, maxSumAssured: 119_999.99, multiplier: 1 },
              { minSumAssured: 120_000, maxSumAssured: 249_999.99, multiplier: 0.95 },
              { minSumAssured: 250_000, maxSumAssured: null, multiplier: 0.92 },
            ],
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentSumAssured: 150_000,
      },
      bonuses: [],
    }), 'mid')

    const age40Rate = AIA_PLP2_DEATH_RATE_TABLE['male-non-smoker'][39] ?? 0
    const expectedCharge = age40Rate / 1000 * 150_000 * 0.5 * 0.95

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(expectedCharge, 6)
  })

  it('projects the AIA PLP II Plus benefit charge without the first-policy-year discount from policy year 2 onward', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      currentPolicyYear: 1,
      monthsAlreadyPaid: 12,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 50_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      chargeRules: [
        {
          id: 'benefit-charge',
          label: 'Benefit Charge (Plus)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'aia-plp2-plus-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
            policyYearRateMultiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 1, multiplier: 0.5 },
            ],
            sumAssuredRateMultiplierTiers: [
              { minSumAssured: 0, maxSumAssured: 119_999.99, multiplier: 1 },
              { minSumAssured: 120_000, maxSumAssured: 249_999.99, multiplier: 0.95 },
              { minSumAssured: 250_000, maxSumAssured: null, multiplier: 0.92 },
            ],
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentSumAssured: 150_000,
      },
      bonuses: [],
    }), 'mid')

    const age40Rate = AIA_PLP2_DEATH_RATE_TABLE['male-non-smoker'][39] ?? 0
    const expectedCharge = age40Rate / 1000 * 150_000 * 0.95

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(expectedCharge, 6)
  })

  it('projects the AIA PLP II Max benefit charge on the insured amount plus net top-up base less policy value', () => {
    const result = projectIlpPolicy(makeOpenEndedPolicy({
      monthlyContribution: 0,
      currentPolicyYear: 7,
      monthsAlreadyPaid: 72,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 80_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      chargeRules: [
        {
          id: 'benefit-charge',
          label: 'Benefit Charge (Max)',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'aia-plp2-max-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
            policyYearRateMultiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 1, multiplier: 0.5 },
            ],
            sumAssuredRateMultiplierTiers: [
              { minSumAssured: 0, maxSumAssured: 119_999.99, multiplier: 1 },
              { minSumAssured: 120_000, maxSumAssured: 249_999.99, multiplier: 0.95 },
              { minSumAssured: 250_000, maxSumAssured: null, multiplier: 0.92 },
            ],
          },
          allocation: 'pro-rata-by-value',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentSumAssured: 260_000,
        currentNetSupplementaryPremiumBase: 24_000,
      },
      bonuses: [],
    }), 'mid')

    const age40Rate = AIA_PLP2_DEATH_RATE_TABLE['male-non-smoker'][39] ?? 0
    const expectedCharge = age40Rate / 1000 * (260_000 + 24_000 - 80_000) * 0.92

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(expectedCharge, 6)
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

  it('keeps bonus credit active when a partial withdrawal is explicitly ignored for bonus suspension', () => {
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
          bonusSuspensionWaived: true,
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

    expect(accountRow(result.rows[0], 'aua').bonusCredit).toBeGreaterThan(0)
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

  it('keeps charge-waived partial withdrawals inside bonus suspension unless the bonus override is also set', () => {
    const basePolicy = makeDefaultPolicy({
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
          chargeWaived: true,
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

    const chargedOnlyWaiver = projectIlpPolicy(basePolicy, 'mid')
    const fullWaiver = projectIlpPolicy({
      ...basePolicy,
      policyEvents: [
        {
          ...basePolicy.policyEvents![0],
          bonusSuspensionWaived: true,
        },
      ],
    }, 'mid')

    expect(accountRow(chargedOnlyWaiver.rows[0], 'aua').bonusCredit).toBeCloseTo(0, 2)
    expect(accountRow(fullWaiver.rows[0], 'aua').bonusCredit).toBeGreaterThan(0)
  })

  it('keeps bonus credit active when a premium holiday is explicitly ignored for bonus suspension', () => {
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
          bonusSuspensionWaived: true,
        },
      ],
      bonuses: [
        {
          ...POWER_UP,
          rate: 0.12,
          suspensionRules: [{ trigger: 'premium-holiday', suspensionMonths: 12 }],
        },
      ],
    })
    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'aua').bonusCredit).toBeGreaterThan(0)
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

  it('applies an upfront initial-single-premium deduction once at inception before growth continues', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      postMipYears: 2,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      funds: [TEN_PERCENT_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'initial-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.03,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')
    const summary = computeSummaryMetrics(policy, result)

    expect(accountRow(result.rows[0], 'policy').open).toBeCloseTo(970, 6)
    expect(accountRow(result.rows[0], 'policy').close).toBeCloseTo(1_067, 6)
    expect(result.rows[0].annualContribution).toBe(0)
    expect(result.rows[0].cumulativePremiums).toBe(1_000)
    expect(result.rows[0].cumulativeGrossFees).toBeCloseTo(30, 6)
    expect(summary.currentSurrenderValue).toBeCloseTo(970, 6)
  })

  it('keeps zero-rate initial-single-premium corridors unchanged while still seeding the starting policy value', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      funds: [TEN_PERCENT_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'initial-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'policy').open).toBeCloseTo(1_000, 6)
    expect(accountRow(result.rows[0], 'policy').close).toBeCloseTo(1_100, 6)
    expect(result.rows[0].cumulativePremiums).toBe(1_000)
    expect(result.rows[0].cumulativeGrossFees).toBe(0)
  })

  it('does not regress annual-contribution charge rules when an initial single premium is also present', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 100,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'initial-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.05,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
        {
          id: 'regular-premium-charge',
          label: 'Regular Premium Charge',
          basis: 'annual-contribution',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.1,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'policy').open).toBeCloseTo(950, 6)
    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(120, 6)
    expect(result.rows[0].annualContribution).toBe(1_200)
    expect(result.rows[0].cumulativeGrossFees).toBeCloseTo(170, 6)
  })

  it('does not regress top-up event charges when the policy also seeds an initial single premium', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
            { phase: 'top-up', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'initial-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.03,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
      eventChargeRules: [
        {
          id: 'top-up-premium-charge',
          label: 'Top-up Premium Charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['policy'],
          rate: 0.05,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 1,
          durationMonths: 1,
          amount: 200,
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'policy').open).toBeCloseTo(970, 6)
    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(10, 6)
    expect(accountRow(result.rows[0], 'policy').contributionAmount).toBe(200)
    expect(accountRow(result.rows[0], 'policy').close).toBeCloseTo(1_160, 6)
    expect(result.rows[0].cumulativeGrossFees).toBeCloseTo(40, 6)
  })

  it('allocates multi-account initial-single-premium deductions against routed inception balances', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      postMipYears: 1,
      accounts: [
        {
          id: 'core',
          label: 'Core Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 0.75 },
            { phase: 'after-icp', contributionShare: 0.75 },
          ],
        },
        {
          id: 'satellite',
          label: 'Satellite Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 0.25 },
            { phase: 'after-icp', contributionShare: 0.25 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'initial-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['core', 'satellite'],
          rate: 0.1,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(accountRow(result.rows[0], 'core').open).toBeCloseTo(675, 6)
    expect(accountRow(result.rows[0], 'satellite').open).toBeCloseTo(225, 6)
    expect(result.rows[0].combinedValue).toBeCloseTo(900, 6)
    expect(result.rows[0].cumulativePremiums).toBe(1_000)
    expect(result.rows[0].cumulativeGrossFees).toBeCloseTo(100, 6)
  })

  it('does not apply initial-single-premium deductions when the projection does not start at honest inception', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 1,
      postMipYears: 1,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 400,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 1 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [
        {
          id: 'initial-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.03,
          amount: 0,
          allocation: 'pro-rata-by-value',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')
    const summary = computeSummaryMetrics(policy, result)

    expect(accountRow(result.rows[0], 'policy').open).toBeCloseTo(400, 6)
    expect(result.rows[0].cumulativePremiums).toBe(0)
    expect(result.rows[0].cumulativeGrossFees).toBe(0)
    expect(summary.currentSurrenderValue).toBeCloseTo(400, 6)
  })

  it('applies recurring original-single-premium-base charges for authored years only on open-ended single-premium policies', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      postMipYears: 6,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      exitChargeBasis: 'initial-single-premium-base',
      eecTable: [0.07, 0.056, 0.042, 0.028, 0.014, 0],
      chargeRules: [
        {
          id: 'establishment-charge',
          label: 'Establishment Charge',
          basis: 'initial-single-premium-base',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 5, rate: 0.014 },
          ],
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')
    const summary = computeSummaryMetrics(policy, result)

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(14, 6)
    expect(accountRow(result.rows[3], 'policy').grossFee).toBeCloseTo(14, 6)
    expect(accountRow(result.rows[4], 'policy').grossFee).toBeCloseTo(0, 6)
    expect(result.rows[3].cumulativeGrossFees).toBeCloseTo(70, 6)
    expect(result.rows[4].cumulativeGrossFees).toBeCloseTo(70, 6)
    expect(summary.currentSurrenderValue).toBeCloseTo(916, 6)
  })

  it('uses original initial single premium as the surrender base for open-ended exit charges', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      postMipYears: 6,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
          ],
        },
      ],
      eecTable: [0.07, 0.056, 0.042, 0.028, 0.014, 0],
      exitChargeBasis: 'initial-single-premium-base',
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
    })

    const projection = projectIlpPolicy(policy, 'mid')
    const summary = computeSummaryMetrics(policy, projection)
    const npv = computeNpvAnalysis(policy, projection)

    expect(summary.cancelNowPenalty).toBeCloseTo(70, 6)
    expect(summary.currentSurrenderValue).toBeCloseTo(930, 6)
    expect(projection.rows[0].eecRate).toBeCloseTo(0.056, 6)
    expect(projection.rows[0].eecCharge).toBeCloseTo(56, 6)
    expect(projection.rows[0].surrenderValue).toBeCloseTo(944, 6)
    expect(projection.rows[4].eecRate).toBeCloseTo(0, 6)
    expect(projection.rows[4].eecCharge).toBeCloseTo(0, 6)
    expect(npv.surrenderNow.eecCharge).toBeCloseTo(70, 6)
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

  it('rejects impossible cash-payout distribution assumptions at seed-schema time', () => {
    expect(() => ilpPolicySeedSchema.parse(makeDefaultPolicy({
      distributionSupport: {
        mode: 'manual-assumption',
        accountIds: ['aua'],
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: false,
        cashPayoutAllowedAfterMip: false,
        source: 'distribution-paying-funds',
      },
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.4,
      },
    }))).toThrow(/payout-eligible phase/)
  })

  it('rejects assurance ages above the supported table ceiling', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      assuranceProfile: {
        currentAgeNextBirthday: 121,
        sex: 'male',
        smokerStatus: 'non-smoker',
      },
    }))).toThrow(/120/)
  })

  it('rejects invalid assurance accrual windows where settlement does not immediately follow the accrual period', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      chargeRules: [
        {
          id: 'tokio-mpc-accrual-invalid',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['aua'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 5,
            },
          },
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }))).toThrow(/exactly one policy year after/)
  })

  it('rejects invalid assurance accrual windows where the end year precedes the start year', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      chargeRules: [
        {
          id: 'tokio-mpc-accrual-window-invalid',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['aua'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            accrual: {
              startPolicyYear: 3,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
          },
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }))).toThrow(/greater than or equal to startPolicyYear/)
  })

  it('rejects during-MIP assurance accrual settlement years beyond mipLength', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      currentPolicyYear: 1,
      monthsAlreadyPaid: 0,
      mipLength: 4,
      chargeRules: [
        {
          id: 'tokio-mpc-accrual-outside-mip',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['aua'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 4,
              settlementPolicyYear: 5,
            },
          },
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }))).toThrow(/within the policy mipLength/)
  })

  it('rejects assurance accrual on non-Tokio assurance formulas', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      chargeRules: [
        {
          id: 'prudential-accrual-invalid',
          label: 'Death Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['aua'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'prudential-prosper-death',
            monthlyModalFactor: 1,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentSumAssured: 50_000,
      },
    }))).toThrow(/only supported for Tokio MPC assurance rules/)
  })

  it('rejects mid-policy accrued assurance entry before the settlement year', () => {
    expect(() => projectIlpPolicy(makeDefaultPolicy({
      currentPolicyYear: 2,
      monthsAlreadyPaid: 24,
      chargeRules: [
        {
          id: 'tokio-mpc-accrual-mid-policy',
          label: 'Monthly Protection Charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'during-mip',
          appliesTo: ['aua'],
          rate: 0,
          amount: 0,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
          allocation: 'equal-split',
        },
      ],
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 1_200,
      },
    }), 'mid')).toThrow(/mid-policy entry before settlement is not supported/)
  })

  it('rejects open-ended policies without a positive postMipYears horizon', () => {
    expect(() => ilpPolicySchema.parse(makeOpenEndedPolicy({
      postMipYears: 0,
    }))).toThrow(/positive review horizon/)
  })

  it('accepts zero-monthly-contribution policies with initial-single-premium inception routing', () => {
    expect(() => ilpPolicySchema.parse(makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 100_000,
      chargeRules: [
        {
          id: 'initial-single-premium-charge',
          label: 'Initial Single Premium Charge',
          basis: 'initial-single-premium',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.03,
          amount: 0,
          allocation: 'equal-split',
        },
      ],
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
          ],
        },
      ],
    }))).not.toThrow()
  })

  it('rejects overlapping cumulative-paid premium count tiers', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      bonuses: [],
      chargeRules: [{
        id: 'policy-charge',
        label: 'Policy Charge',
        basis: 'cumulative-paid-regular-premium',
        activeWindow: 'policy-term',
        appliesTo: ['aua'],
        rate: 0.12,
        amount: 0,
        allocation: 'equal-split',
        cumulativePaidPremiumConfig: {
          countRateSchedule: [
            { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 2, rate: 0.12 },
            { minAnnualisedPremiumsPaid: 2, maxAnnualisedPremiumsPaid: 4, rate: 0.1 },
          ],
        },
      }],
    }))).toThrow(/no overlaps/)
  })

  it('rejects bonus-suspension waiver on unsupported event types', () => {
    expect(() => ilpPolicySchema.parse(makeDefaultPolicy({
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 2,
          durationMonths: 1,
          amount: 1_000,
          bonusSuspensionWaived: true,
        },
      ],
    }))).toThrow(/Bonus-suspension waiver can only be applied/)
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
    const currencyRow = result.comparison.find((row) => row.metric === 'Net Fee Drag (to horizon)')
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

    expect(comparison.find((row) => row.metric === 'Net Fee Drag (to horizon)')?.lowerIsBetter).toBe(true)
  })
})
