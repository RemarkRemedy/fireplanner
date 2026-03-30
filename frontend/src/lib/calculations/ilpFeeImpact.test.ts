import { describe, expect, it } from 'vitest'
import { computeAnnualFeeDragPct } from './ilpFeeImpact'
import type { IlpPolicyAnalysis } from '@/lib/calculations/ilp'

function makeProjectedAnalysis({
  combinedValues,
  realWrapperFees,
  realFundCharges,
  inceptionCharges,
  realBonuses,
}: {
  combinedValues: number[]
  realWrapperFees: number
  realFundCharges: number
  inceptionCharges: number
  realBonuses: number
}): IlpPolicyAnalysis {
  return {
    mode: 'projected',
    projections: {
      low: { scenario: 'low', rows: [], totals: { contributions: 0, withdrawals: 0, finalValue: 0, surrenderValue: 0 } },
      mid: {
        scenario: 'mid',
        rows: combinedValues.map((combinedValue, index) => ({
          year: index + 1,
          policyYear: index + 1,
          policyState: 'in-force',
          scheduledPayoutState: 'inactive',
          annualContribution: 0,
          annualWithdrawals: 0,
          accounts: [],
          combinedValue,
          eecRate: 0,
          eecCharge: 0,
          surrenderValue: combinedValue,
          cumulativePremiums: 0,
          cumulativeGrossFees: 0,
          cumulativeBonuses: 0,
        })),
        totals: { contributions: 0, withdrawals: 0, finalValue: combinedValues.at(-1) ?? 0, surrenderValue: combinedValues.at(-1) ?? 0 },
      },
      high: { scenario: 'high', rows: [], totals: { contributions: 0, withdrawals: 0, finalValue: 0, surrenderValue: 0 } },
    },
    current: undefined,
    npv: {
      low: { contributions: 0, withdrawals: 0, finalValue: 0, surrenderValue: 0, eecCharge: 0 },
      mid: { contributions: 0, withdrawals: 0, finalValue: 0, surrenderValue: 0, eecCharge: 0 },
      high: { contributions: 0, withdrawals: 0, finalValue: 0, surrenderValue: 0, eecCharge: 0 },
    },
    summary: {
      totalPremiumsPaid: 0,
      totalFeesCharged: 0,
      totalBonusesReceived: 0,
      netFeeDrag: 0,
      realWrapperFees,
      realFundCharges,
      realBonuses,
      inceptionCharges,
      opportunityCostVsAlternative: 0,
    },
  }
}

describe('computeAnnualFeeDragPct', () => {
  it('uses charge load without letting bonuses invert the fee drag', () => {
    const analysis = makeProjectedAnalysis({
      combinedValues: [10_000, 10_000],
      realWrapperFees: 100,
      realFundCharges: 20,
      inceptionCharges: 30,
      realBonuses: 500,
    })

    expect(computeAnnualFeeDragPct(analysis)).toBeCloseTo(0.0075, 6)
  })

  it('returns zero when there is no projected portfolio base', () => {
    const analysis = makeProjectedAnalysis({
      combinedValues: [0, 0],
      realWrapperFees: 100,
      realFundCharges: 20,
      inceptionCharges: 30,
      realBonuses: 0,
    })

    expect(computeAnnualFeeDragPct(analysis)).toBe(0)
  })
})
