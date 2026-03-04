import { describe, it, expect, vi } from 'vitest'
import {
  buildProofCsv,
  buildProofCyclesFromHistoricalBlended,
  calibrateSgProxy,
  getSgProxyDiagnostics,
} from './proofData'
import { HISTORICAL_RETURNS } from '@/lib/data/historicalReturnsFull.ts'
import type { ProjectionParams } from '@/lib/calculations/projection'
import type { ProjectionRow } from '@/lib/types'

vi.mock('@/lib/calculations/projection', () => {
  return {
    generateProjection: vi.fn((params: { yearlyReturns?: number[]; currentAge: number }) => {
      const years = params.yearlyReturns ?? []
      const rows = years.map((ret, idx) => ({
        age: params.currentAge + idx,
        year: 2000 + idx,
        isRetired: true,
        totalIncome: 0,
        annualExpenses: 1000,
        savingsOrWithdrawal: 0,
        portfolioReturnDollar: 0,
        portfolioReturnPct: ret,
        liquidNW: 100000 - idx * 1000,
        cpfTotal: 50000,
        totalNW: 150000,
        fireProgress: 0,
        salary: 0,
        rentalIncome: 0,
        investmentIncome: 0,
        businessIncome: 0,
        governmentIncome: 0,
        srsWithdrawal: 0,
        totalGross: 0,
        sgTax: 100,
        cpfEmployee: 0,
        cpfEmployer: 0,
        totalNet: 0,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        cpfInterest: 0,
        cpfOaHousingDeduction: 0,
        cpfOaShortfall: 0,
        cpfOaWithdrawal: 0,
        cpfAutoOaWithdrawal: 0,
        cpfAutoSaWithdrawal: 0,
        cpfCountedAsBonds: 0,
        cpfisOA: 0,
        cpfisSA: 0,
        cpfisReturn: 0,
        cpfLifePayout: 0,
        cpfBequest: 0,
        cpfMilestone: null,
        withdrawalAmount: 0,
        maxPermittedWithdrawal: 0,
        withdrawalExcess: 0,
        propertyValue: 0,
        mortgageBalance: 0,
        propertyEquity: 0,
        totalNWIncProperty: 150000,
        baseInflatedExpenses: 0,
        parentSupportExpense: 0,
        healthcareCashOutlay: 0,
        mortgageCashPayment: 0,
        downsizingRentExpense: 0,
        goalExpense: 0,
        goalShortfall: 0,
        retirementWithdrawalExpense: 0,
        retirementWithdrawalShortfall: 0,
        srsBalance: 0,
        srsContribution: 0,
        srsTaxableWithdrawal: 0,
        lockedAssetUnlock: 0,
        mediShieldLifePremium: 0,
        ispAdditionalPremium: 0,
        careShieldLifePremium: 0,
        oopExpense: 0,
        mediSaveDeductible: 0,
        allocationWeights: [1, 0, 0, 0, 0, 0, 0, 0],
        targetAllocationWeights: [1, 0, 0, 0, 0, 0, 0, 0],
        cumulativeSavings: 0,
        activeLifeEvents: [],
      }))
      return { rows, summary: {} }
    }),
  }
})

describe('calibrateSgProxy', () => {
  it('returns finite alpha/beta and non-empty residual series', () => {
    const model = calibrateSgProxy(HISTORICAL_RETURNS)
    expect(Number.isFinite(model.alpha)).toBe(true)
    expect(Number.isFinite(model.beta)).toBe(true)
    expect(model.residuals.length).toBeGreaterThan(0)
  })

  it('produces diagnostics with overlap/missing counts and residual spread', () => {
    const d = getSgProxyDiagnostics(HISTORICAL_RETURNS)
    expect(d.overlapYears).toBeGreaterThan(0)
    expect(d.missingYears).toBeGreaterThan(0)
    expect(Number.isFinite(d.alpha)).toBe(true)
    expect(Number.isFinite(d.beta)).toBe(true)
    expect(Number.isFinite(d.residualMean)).toBe(true)
    expect(Number.isFinite(d.residualStdDev)).toBe(true)
    expect(d.residualP10).toBeLessThanOrEqual(d.residualP90)
  })
})

describe('buildProofCyclesFromHistoricalBlended', () => {
  it('builds cycles with deterministic mixed provenance on early missing-SG years', () => {
    const cycles = buildProofCyclesFromHistoricalBlended(
      { currentAge: 40, lifeExpectancy: 43 } as unknown as ProjectionParams,
      [0.6, 0.1, 0.1, 0.2, 0, 0, 0, 0],
      0.7,
    )

    expect(cycles.length).toBeGreaterThan(0)

    const first = cycles[0]
    expect(first.startYear).toBe(1928)
    expect(first.provenance).toHaveLength(3)
    expect(first.provenance.every((p) => p === 'mixed')).toBe(true)
    expect(first.yearlyReturns.every((v) => Number.isFinite(v))).toBe(true)
  })
})

describe('buildProofCsv', () => {
  it('includes provenance and SG-only tax columns', () => {
    const csv = buildProofCsv([
      {
        id: 'c1',
        label: 'Cycle 1',
        startYear: 1932,
        yearlyReturns: [0.1, -0.05],
        provenance: ['actual', 'proxy'],
        endingPortfolio: 500,
        meanSpending: 100,
        meanReturnPct: 0.02,
        rows: [
          { age: 65, year: 2030, liquidNW: 1000, annualExpenses: 200, portfolioReturnPct: 0.1, sgTax: 10 } as unknown as ProjectionRow,
          { age: 66, year: 2031, liquidNW: 900, annualExpenses: 210, portfolioReturnPct: -0.05, sgTax: 20 } as unknown as ProjectionRow,
        ],
      },
    ], 'historical_blended')

    expect(csv).toContain('provenance')
    expect(csv).toContain('income_tax')
    expect(csv).toContain('total_taxes_paid')
    expect(csv).toContain('actual')
    expect(csv).toContain('proxy')
    expect(csv.includes('ltcg')).toBe(false)
    expect(csv.includes('LTCG')).toBe(false)
  })
})
