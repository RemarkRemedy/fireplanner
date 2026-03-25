import { describe, expect, it } from 'vitest'
import {
  projectIlpPolicy,
  type IlpAccount,
  type IlpBonusRule,
  type IlpChargeRule,
  type IlpFund,
  type IlpPolicyInput,
} from './ilp'
import { buildFeeBreakdown } from './ilpFeeBreakdown'
import {
  DEFAULT_AUA_FEE_RATE,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_IUA_FEE_RATE,
  EEC_PRESET_MIP_30,
} from '@/lib/data/ilpDefaults'

const ZERO_RETURN_FUND: IlpFund = {
  name: 'Zero Return Test Fund',
  allocation: 1,
  ocf: 0,
  grossReturnLow: 0,
  grossReturnMid: 0,
  grossReturnHigh: 0,
}

const IUA: IlpAccount = {
  id: 'iua',
  label: 'IUA',
  feeRate: DEFAULT_IUA_FEE_RATE,
  currentValue: 10_000,
  contributionShare: 0,
  subjectToEec: true,
  postMipFeeRate: DEFAULT_AUA_FEE_RATE,
}

const AUA: IlpAccount = {
  id: 'aua',
  label: 'AUA',
  feeRate: DEFAULT_AUA_FEE_RATE,
  currentValue: 0,
  contributionShare: 1,
  subjectToEec: false,
  postMipFeeRate: null,
}

const BONUS: IlpBonusRule = {
  id: 'loyalty',
  type: 'loyalty',
  label: 'Loyalty Bonus',
  mode: 'annual-rate',
  rate: 0.01,
  amount: 0,
  appliesTo: [],
  startPolicyYear: 1,
  endPolicyYear: null,
}

function makePolicy(overrides: Partial<IlpPolicyInput> = {}): IlpPolicyInput {
  return {
    id: 'test-fee-breakdown',
    name: 'Fee Breakdown Test',
    insurer: 'Test',
    currency: 'SGD',
    monthlyContribution: 100,
    monthsAlreadyPaid: 0,
    currentPolicyYear: 1,
    accounts: [IUA, AUA],
    mipLength: 5,
    postMipYears: 0,
    eecTable: [...EEC_PRESET_MIP_30],
    funds: [ZERO_RETURN_FUND],
    bonuses: [BONUS],
    chargeRules: [],
    eventChargeRules: [],
    discountRate: DEFAULT_DISCOUNT_RATE,
    inflationRate: DEFAULT_INFLATION_RATE,
    alternativeReturn: 0.07,
    ...overrides,
  }
}

describe('buildFeeBreakdown', () => {
  it('produces one row per projection year', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    expect(breakdown.rows.length).toBe(projection.rows.length)
  })

  it('grossFee equals sum of four sub-categories per row', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    for (const row of breakdown.rows) {
      const sumOfParts = row.accountFee + row.additionalCharges + row.assuranceCharges + row.eventCharges
      expect(row.grossFee).toBeCloseTo(sumOfParts, 6)
    }
  })

  it('totals match sum of all rows', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    const sumAccountFee = breakdown.rows.reduce((s, r) => s + r.accountFee, 0)
    const sumAdditional = breakdown.rows.reduce((s, r) => s + r.additionalCharges, 0)
    const sumAssurance = breakdown.rows.reduce((s, r) => s + r.assuranceCharges, 0)
    const sumEvent = breakdown.rows.reduce((s, r) => s + r.eventCharges, 0)
    const sumGross = breakdown.rows.reduce((s, r) => s + r.grossFee, 0)
    const sumBonuses = breakdown.rows.reduce((s, r) => s + r.bonusCredits, 0)

    expect(breakdown.totals.accountFee).toBeCloseTo(sumAccountFee, 6)
    expect(breakdown.totals.additionalCharges).toBeCloseTo(sumAdditional, 6)
    expect(breakdown.totals.assuranceCharges).toBeCloseTo(sumAssurance, 6)
    expect(breakdown.totals.eventCharges).toBeCloseTo(sumEvent, 6)
    expect(breakdown.totals.grossFee).toBeCloseTo(sumGross, 6)
    expect(breakdown.totals.bonusCredits).toBeCloseTo(sumBonuses, 6)
  })

  it('cumulative net fees equals cumulative gross minus cumulative bonuses', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    for (const row of breakdown.rows) {
      expect(row.cumulativeNetFees).toBeCloseTo(row.cumulativeGrossFees - row.cumulativeBonuses, 6)
    }
  })

  it('account fees are non-zero when IUA has a fee rate and current value', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    // IUA has currentValue 10_000 and DEFAULT_IUA_FEE_RATE, so year 1 should have account fees
    expect(breakdown.rows[0].accountFee).toBeGreaterThan(0)
  })

  it('additional charges appear when charge rules are present', () => {
    const chargeRules: IlpChargeRule[] = [
      {
        id: 'fixed-fee',
        label: 'Fixed Annual Fee',
        basis: 'fixed-annual',
        activeWindow: 'during-mip',
        appliesTo: ['iua', 'aua'],
        rate: 0,
        amount: 240,
        allocation: 'pro-rata-by-value',
      },
    ]
    const policy = makePolicy({ chargeRules })
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    expect(breakdown.rows[0].additionalCharges).toBeGreaterThan(0)
    expect(breakdown.totals.additionalCharges).toBeGreaterThan(0)
  })

  it('bonus credits are captured in the breakdown', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    // Loyalty bonus at 1% on all accounts from year 1
    const totalBonuses = breakdown.rows.reduce((s, r) => s + r.bonusCredits, 0)
    expect(totalBonuses).toBeGreaterThan(0)
  })

  it('event charges are zero when no events are scheduled', () => {
    const policy = makePolicy({ policyEvents: [] })
    const projection = projectIlpPolicy(policy, 'mid')
    const breakdown = buildFeeBreakdown(projection)

    for (const row of breakdown.rows) {
      expect(row.eventCharges).toBe(0)
    }
    expect(breakdown.totals.eventCharges).toBe(0)
  })
})

describe('fee attribution seam on IlpAccountYearRow', () => {
  it('exposes accountFee, additionalCharges, assuranceCharges, eventCharges on each account row', () => {
    const policy = makePolicy()
    const projection = projectIlpPolicy(policy, 'mid')

    for (const yearRow of projection.rows) {
      for (const accountRow of yearRow.accounts) {
        expect(accountRow).toHaveProperty('accountFee')
        expect(accountRow).toHaveProperty('additionalCharges')
        expect(accountRow).toHaveProperty('assuranceCharges')
        expect(accountRow).toHaveProperty('eventCharges')
        expect(typeof accountRow.accountFee).toBe('number')
        expect(typeof accountRow.additionalCharges).toBe('number')
        expect(typeof accountRow.assuranceCharges).toBe('number')
        expect(typeof accountRow.eventCharges).toBe('number')
      }
    }
  })

  it('sub-fields sum to grossFee on each account row', () => {
    const chargeRules: IlpChargeRule[] = [
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
    const policy = makePolicy({ chargeRules })
    const projection = projectIlpPolicy(policy, 'mid')

    for (const yearRow of projection.rows) {
      for (const accountRow of yearRow.accounts) {
        const sum = accountRow.accountFee + accountRow.additionalCharges + accountRow.assuranceCharges + accountRow.eventCharges
        expect(accountRow.grossFee).toBeCloseTo(sum, 6)
      }
    }
  })
})
