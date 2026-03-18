import { describe, expect, it } from 'vitest'
import {
  MANULIFE_TEMPORARY_LAPSE_REINSTATEMENT_RULE,
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

  it('throws for mature policies instead of silently projecting', () => {
    expect(() => projectIlpPolicy(makeDefaultPolicy({ currentPolicyYear: 30 }), 'mid')).toThrow(/at or past MIP/)
  })

  it('freezes Manulife policies after lapse until the reinstatement window ends', () => {
    const policy = makeDefaultPolicy({
      insurer: 'Manulife',
      monthlyContribution: 0,
      currentPolicyYear: 1,
      mipLength: 5,
      postMipYears: 0,
      accounts: [
        {
          id: 'core',
          label: 'Core Account',
          feeRate: 2,
          currentValue: 100,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      funds: [{
        name: 'Cash',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      lapseReinstatementRule: {
        ...MANULIFE_TEMPORARY_LAPSE_REINSTATEMENT_RULE,
        reinstatementWindowMonths: 24,
      },
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].policyStatus).toBe('lapsed-reinstatable')
    expect(result.rows[0].reinstatementWindowYearsRemaining).toBe(2)
    expect(result.rows[0].combinedValue).toBe(0)
    expect(accountRow(result.rows[0], 'core').close).toBe(0)

    expect(result.rows[1].policyStatus).toBe('lapsed-reinstatable')
    expect(result.rows[1].annualContribution).toBe(0)
    expect(result.rows[1].eecRate).toBe(0)
    expect(accountRow(result.rows[1], 'core').grossFee).toBe(0)
    expect(accountRow(result.rows[1], 'core').close).toBe(0)

    expect(result.rows[2].policyStatus).toBe('lapsed-ended')
    expect(result.rows[2].reinstatementWindowYearsRemaining).toBe(0)
    expect(accountRow(result.rows[2], 'core').grossFee).toBe(0)
    expect(accountRow(result.rows[2], 'core').close).toBe(0)
  })

  it('does not apply the temporary lapse kernel to non-Manulife products', () => {
    const policy = makeDefaultPolicy({
      insurer: 'Other Insurer',
      monthlyContribution: 0,
      currentPolicyYear: 1,
      mipLength: 3,
      postMipYears: 0,
      accounts: [
        {
          id: 'core',
          label: 'Core Account',
          feeRate: 2,
          currentValue: 100,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
      funds: [{
        name: 'Cash',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0,
        grossReturnMid: 0,
        grossReturnHigh: 0,
      }],
      lapseReinstatementRule: {
        ...MANULIFE_TEMPORARY_LAPSE_REINSTATEMENT_RULE,
        reinstatementWindowMonths: 24,
      },
    })

    const result = projectIlpPolicy(policy, 'mid')

    expect(result.rows[0].policyStatus).toBe('in-force')
    expect(result.rows[0].reinstatementWindowYearsRemaining).toBe(0)
    expect(accountRow(result.rows[0], 'core').grossFee).toBe(200)
    expect(accountRow(result.rows[0], 'core').close).toBe(-100)
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
