import { describe, expect, it } from 'vitest'
import { computeFeeOpportunityValue, computeReceiptData, computeIndexFundValue } from './ilpReceiptData'
import { INDEX_FUND_NET_RETURN } from '@/lib/data/ilpReceiptConstants'
import type { IlpPolicyInput } from '@/lib/calculations/ilp'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'
import {
  DEFAULT_AUA_FEE_RATE,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_IUA_FEE_RATE,
  EEC_PRESET_MIP_30,
} from '@/lib/data/ilpDefaults'

const ZERO_RETURN_FUND = {
  name: 'Zero Return Fund',
  allocation: 1,
  ocf: 0.015,
  grossReturnLow: 0,
  grossReturnMid: 0,
  grossReturnHigh: 0,
}

function makePolicy(overrides: Partial<IlpPolicyInput> = {}): IlpPolicyInput {
  return {
    id: 'test-receipt',
    name: 'Test ILP',
    insurer: 'Prudential',
    currency: 'SGD',
    monthlyContribution: 500,
    monthsAlreadyPaid: 0,
    currentPolicyYear: 1,
    accounts: [
      {
        id: 'iua',
        label: 'IUA',
        feeRate: DEFAULT_IUA_FEE_RATE,
        currentValue: 0,
        contributionShare: 0,
        subjectToEec: true,
        postMipFeeRate: DEFAULT_AUA_FEE_RATE,
      },
      {
        id: 'aua',
        label: 'AUA',
        feeRate: DEFAULT_AUA_FEE_RATE,
        currentValue: 0,
        contributionShare: 1,
        subjectToEec: false,
        postMipFeeRate: null,
      },
    ],
    mipLength: 25,
    postMipYears: 0,
    eecTable: [...EEC_PRESET_MIP_30],
    funds: [ZERO_RETURN_FUND],
    bonuses: [
      {
        id: 'loyalty',
        type: 'loyalty',
        label: 'Loyalty Bonus',
        mode: 'annual-rate',
        rate: 0.01,
        amount: 0,
        appliesTo: [],
        startPolicyYear: 1,
        endPolicyYear: null,
      },
    ],
    chargeRules: [],
    eventChargeRules: [],
    discountRate: DEFAULT_DISCOUNT_RATE,
    inflationRate: DEFAULT_INFLATION_RATE,
    alternativeReturn: 0.07,
    ...overrides,
  } as IlpPolicyInput
}

describe('computeIndexFundValue', () => {
  it('computes DCA value for regular premium over 25 years', () => {
    const monthly = 500
    const years = 25
    const monthlyRate = Math.pow(1 + INDEX_FUND_NET_RETURN, 1 / 12) - 1
    const months = years * 12
    const expected = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)

    const result = computeIndexFundValue(monthly, 0, years)
    expect(result).toBeCloseTo(expected, 2)
    expect(result).toBeGreaterThan(monthly * months)
  })

  it('computes lump sum value for single premium', () => {
    const lumpSum = 50_000
    const years = 10
    const expected = lumpSum * Math.pow(1 + INDEX_FUND_NET_RETURN, years)

    const result = computeIndexFundValue(0, lumpSum, years)
    expect(result).toBeCloseTo(expected, 2)
  })

  it('computes hybrid value for both monthly and single premium', () => {
    const monthly = 300
    const lumpSum = 20_000
    const years = 15
    const monthlyRate = Math.pow(1 + INDEX_FUND_NET_RETURN, 1 / 12) - 1
    const months = years * 12
    const dcaPart = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    const lumpSumPart = lumpSum * Math.pow(1 + INDEX_FUND_NET_RETURN, years)

    const result = computeIndexFundValue(monthly, lumpSum, years)
    expect(result).toBeCloseTo(dcaPart + lumpSumPart, 2)
  })

  it('returns 0 when no contributions', () => {
    expect(computeIndexFundValue(0, 0, 25)).toBe(0)
  })
})

describe('computeReceiptData', () => {
  it('anonymizes product label with MIP length', () => {
    const policy = makePolicy({ mipLength: 25 })
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.productLabel).toBe('Major Insurer, 25-Year ILP')
    expect(receipt.productLabel).not.toContain('Prudential')
  })

  it('uses single premium label when no monthly contribution', () => {
    const policy = makePolicy({
      monthlyContribution: 0,
      initialSinglePremium: 50_000,
      accounts: [
        {
          id: 'iua',
          label: 'IUA',
          feeRate: DEFAULT_IUA_FEE_RATE,
          currentValue: 50_000,
          contributionShare: 0,
          subjectToEec: true,
          postMipFeeRate: DEFAULT_AUA_FEE_RATE,
        },
      ],
    })
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.productLabel).toBe('Major Insurer, Single Premium ILP')
  })

  it('includes OCF in gross fees when includeOcf is true', () => {
    const policy = makePolicy()
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const withOcf = computeReceiptData(policy, analysis, breakdown, true, true)
    const withoutOcf = computeReceiptData(policy, analysis, breakdown, false, true)

    expect(withOcf.grossFees).toBeGreaterThan(withoutOcf.grossFees)
    expect(withOcf.includesOcf).toBe(true)
    expect(withoutOcf.includesOcf).toBe(false)
  })

  it('whatTheyKeep equals grossFees minus bonuses (clamped to zero)', () => {
    const policy = makePolicy()
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.whatTheyKeep).toBeCloseTo(
      Math.max(0, receipt.grossFees - receipt.bonusesReceived), 2,
    )
  })

  it('feeDragPercent equals whatTheyKeep / youPay', () => {
    const policy = makePolicy()
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.feeDragPercent).toBeCloseTo(receipt.whatTheyKeep / receipt.youPay, 6)
  })

  it('uses the same low-cost benchmark assumption in nominal mode as the fee story chart', () => {
    const policy = makePolicy()
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, false)
    const expectedIndexFundValue = computeIndexFundValue(
      policy.monthlyContribution,
      policy.initialSinglePremium ?? 0,
      projection.rows.length,
    )

    expect(receipt.indexFundValue).toBeCloseTo(expectedIndexFundValue, 2)
    expect(receipt.basisLabel).toBe('nominal')
  })

  it("discounts the benchmark and fee opportunity value in today's-dollar mode", () => {
    const policy = makePolicy()
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const nominalReceipt = computeReceiptData(policy, analysis, breakdown, true, false)
    const realReceipt = computeReceiptData(policy, analysis, breakdown, true, true)
    const inflationFactor = Math.pow(1 + policy.inflationRate, projection.rows.length)

    expect(realReceipt.indexFundValue).toBeCloseTo(nominalReceipt.indexFundValue / inflationFactor, 2)
    expect(realReceipt.feeOpportunityValue).toBeCloseTo(
      computeFeeOpportunityValue(breakdown, projection.rows.length, true) / inflationFactor,
      2,
    )
    expect(realReceipt.basisLabel).toBe("today's dollars")
  })

  it('preserves currency from policy', () => {
    const policy = makePolicy({ currency: 'USD' })
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.currency).toBe('USD')
  })

  it('clamps whatTheyKeep to zero when bonuses exceed fees', () => {
    const policy = makePolicy({
      bonuses: [
        {
          id: 'generous',
          type: 'loyalty',
          label: 'Generous Bonus',
          mode: 'annual-rate',
          rate: 0.50,
          amount: 0,
          appliesTo: [],
          startPolicyYear: 1,
          endPolicyYear: null,
        },
      ],
    })
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.whatTheyKeep).toBeGreaterThanOrEqual(0)
  })

  it('feeOpportunityValue remains non-negative even when the ILP outperforms the index fund', () => {
    const policy = makePolicy({
      funds: [{
        name: 'High Return Fund',
        allocation: 1,
        ocf: 0,
        grossReturnLow: 0.15,
        grossReturnMid: 0.15,
        grossReturnHigh: 0.15,
      }],
      accounts: [
        {
          id: 'aua',
          label: 'AUA',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 1,
          subjectToEec: false,
          postMipFeeRate: null,
        },
      ],
      bonuses: [],
    })
    const analysis = analyzeIlpPolicy(policy)
    const projection = analysis.projections.mid
    const breakdown = buildFeeBreakdown(projection, policy.funds, policy)

    const receipt = computeReceiptData(policy, analysis, breakdown, true, true)
    expect(receipt.feeOpportunityValue).toBeGreaterThanOrEqual(0)
  })
})
