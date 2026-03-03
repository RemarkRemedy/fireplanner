import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateCpfContribution,
  calculateCpfExtraInterest,
  calculateCpfExtraInterestWithAge,
  calculateCpfisInterest,
  projectCpfBalances,
  calculateBrsFrsErs,
  estimateCpfLifePayout,
  calculateCpfLifePayoutAtAge,
  getRetirementSumAmount,
  autoDetectRetirementSum,
  performAge55Transfer,
  allocatePostAge55Contribution,
  capMaAtBhs,
  getBhsAtAge,
  getFrsForYear,
  estimateCpfBalancesFromAge,
} from './cpf'
import {
  OA_INTEREST_RATE,
  SA_INTEREST_RATE,
  CPFIS_OA_RETENTION,
  CPFIS_SA_RETENTION,
  FRS_BASE,
  BRS_GROWTH_RATE,
  RETIREMENT_SUM_BASE_YEAR,
  getCpfRatesForAge,
} from '@/lib/data/cpfRates'
import { MEDISAVE_BHS, BHS_GROWTH_RATE, BHS_BASE_YEAR } from '@/lib/data/healthcarePremiums'

describe('calculateCpfContribution', () => {
  it('age 30, $72K salary → 37% total rate', () => {
    const result = calculateCpfContribution(72000, 30)
    expect(result.total).toBeCloseTo(72000 * 0.37, 0)
    expect(result.employee).toBeCloseTo(72000 * 0.20, 0)
    expect(result.employer).toBeCloseTo(72000 * 0.17, 0)
  })

  it('OA/SA/MA allocation for age 30', () => {
    const result = calculateCpfContribution(72000, 30)
    expect(result.oaAllocation).toBeCloseTo(72000 * 0.23, 0)
    expect(result.saAllocation).toBeCloseTo(72000 * 0.06, 0)
    expect(result.maAllocation).toBeCloseTo(72000 * 0.08, 0)
  })

  it('age 57 uses 55-60 bracket (34% total)', () => {
    const result = calculateCpfContribution(72000, 57)
    expect(result.total).toBeCloseTo(72000 * 0.34, 0)
    expect(result.employee).toBeCloseTo(72000 * 0.18, 0)
    expect(result.employer).toBeCloseTo(72000 * 0.16, 0)
  })

  it('OW ceiling: salary above $96,000 is capped', () => {
    const result = calculateCpfContribution(120000, 30)
    // Only $96,000 subject to CPF (OW ceiling $8,000/month from 2026, no bonus)
    expect(result.total).toBeCloseTo(96000 * 0.37, 0)
  })

  it('AW ceiling: bonus capped at $102K - OW', () => {
    const result = calculateCpfContribution(96000, 30, 30000)
    // OW: $96,000 (at ceiling), AW ceiling: $102,000 - $96,000 = $6,000
    // Total subject: $96,000 + $6,000 = $102,000
    expect(result.total).toBeCloseTo(102000 * 0.37, 0)
  })

  it('returns zero for zero salary', () => {
    const result = calculateCpfContribution(0, 30)
    expect(result.total).toBe(0)
    expect(result.employee).toBe(0)
  })

  it('age 62 uses 60-65 bracket (25%)', () => {
    const result = calculateCpfContribution(60000, 62)
    expect(result.total).toBeCloseTo(60000 * 0.25, 0)
  })

  it('age 67 uses 65-70 bracket (16.5%)', () => {
    const result = calculateCpfContribution(60000, 67)
    expect(result.total).toBeCloseTo(60000 * 0.165, 0)
  })

  it('age 72 uses above 70 bracket (12.5%)', () => {
    const result = calculateCpfContribution(60000, 72)
    expect(result.total).toBeCloseTo(60000 * 0.125, 0)
  })

  // Age boundary tests: exact cutoff ages
  it('age 55 is still in "55 and below" bracket (37%)', () => {
    const result = calculateCpfContribution(72000, 55)
    expect(result.total).toBeCloseTo(72000 * 0.37, 0)
  })

  it('age 56 switches to "55-60" bracket (34%)', () => {
    const result = calculateCpfContribution(72000, 56)
    expect(result.total).toBeCloseTo(72000 * 0.34, 0)
  })

  it('age 60 is still in "55-60" bracket (34%)', () => {
    const result = calculateCpfContribution(72000, 60)
    expect(result.total).toBeCloseTo(72000 * 0.34, 0)
  })

  it('age 61 switches to "60-65" bracket (25%)', () => {
    const result = calculateCpfContribution(72000, 61)
    expect(result.total).toBeCloseTo(72000 * 0.25, 0)
  })

  it('age 65 is still in "60-65" bracket (25%)', () => {
    const result = calculateCpfContribution(72000, 65)
    expect(result.total).toBeCloseTo(72000 * 0.25, 0)
  })

  it('age 66 switches to "65-70" bracket (16.5%)', () => {
    const result = calculateCpfContribution(72000, 66)
    expect(result.total).toBeCloseTo(72000 * 0.165, 0)
  })

  it('age 70 is still in "65-70" bracket (16.5%)', () => {
    const result = calculateCpfContribution(72000, 70)
    expect(result.total).toBeCloseTo(72000 * 0.165, 0)
  })

  it('age 71 switches to "above 70" bracket (12.5%)', () => {
    const result = calculateCpfContribution(72000, 71)
    expect(result.total).toBeCloseTo(72000 * 0.125, 0)
  })

  it('rate drops from 37% to 34% at the 55/56 boundary', () => {
    const at55 = calculateCpfContribution(72000, 55)
    const at56 = calculateCpfContribution(72000, 56)
    expect(at55.total).toBeGreaterThan(at56.total)
    expect(at55.total - at56.total).toBeCloseTo(72000 * (0.37 - 0.34), 0)
  })

  // Property-based: CPF <= salary * max_total_rate (37%)
  it('CPF contribution never exceeds salary × 37%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500000, noNaN: true }),
        fc.integer({ min: 18, max: 80 }),
        (salary, age) => {
          const result = calculateCpfContribution(salary, age)
          // Total can't exceed OW ceiling * max rate
          return result.total <= 102000 * 0.37 + 1 // small epsilon
        }
      )
    )
  })
})

describe('calculateCpfExtraInterest', () => {
  it('max extra interest on $60K combined', () => {
    // $20K OA + $30K SA + $10K MA = $60K → $600 extra interest
    const extra = calculateCpfExtraInterest(20000, 30000, 10000, 30)
    expect(extra).toBeCloseTo(600, 0)
  })

  it('OA capped at $20K for extra interest', () => {
    // $50K OA → only $20K qualifies, $40K SA → $40K qualifies (remaining $40K cap)
    const extra = calculateCpfExtraInterest(50000, 40000, 0, 30)
    // $20K OA + $40K SA = $60K → $600
    expect(extra).toBeCloseTo(600, 0)
  })

  it('small balances get proportional extra interest', () => {
    // $10K OA + $5K SA + $3K MA = $18K → $180 extra interest
    const extra = calculateCpfExtraInterest(10000, 5000, 3000, 30)
    expect(extra).toBeCloseTo(180, 0)
  })

  it('zero balances → zero extra interest', () => {
    expect(calculateCpfExtraInterest(0, 0, 0, 30)).toBe(0)
  })
})

describe('projectCpfBalances', () => {
  it('produces correct number of years', () => {
    const projections = projectCpfBalances(30, 35, 10000, 5000, 3000, 72000, 0.03)
    expect(projections).toHaveLength(6) // ages 30, 31, 32, 33, 34, 35
  })

  it('balances grow over time', () => {
    const projections = projectCpfBalances(30, 40, 10000, 5000, 3000, 72000, 0.03)
    for (let i = 1; i < projections.length; i++) {
      expect(projections[i].totalBalance).toBeGreaterThan(projections[i - 1].totalBalance)
    }
  })

  it('first year includes contributions and interest', () => {
    const projections = projectCpfBalances(30, 30, 10000, 5000, 3000, 72000, 0)
    expect(projections[0].annualContribution).toBeGreaterThan(0)
    expect(projections[0].annualInterest).toBeGreaterThan(0)
    expect(projections[0].totalBalance).toBeGreaterThan(10000 + 5000 + 3000)
  })
})

describe('calculateBrsFrsErs', () => {
  // Pin currentYear to 2026 so tests don't drift with calendar time
  const YEAR = 2026

  it('age 55 in base year → no growth needed', () => {
    const result = calculateBrsFrsErs(55, YEAR)
    expect(result.brs).toBeCloseTo(110200, 0)
    expect(result.frs).toBeCloseTo(220400, 0)
    expect(result.ers).toBeCloseTo(440800, 0)
  })

  it('age 46 in 2026 → 9 years growth (matching financial planner feedback)', () => {
    const result = calculateBrsFrsErs(46, YEAR)
    const growthFactor = Math.pow(1.035, 9)
    expect(result.frs).toBeCloseTo(220400 * growthFactor, 0)
    // Should be ~$300K, not ~$290K
    expect(result.frs).toBeGreaterThan(295000)
    expect(result.frs).toBeLessThan(305000)
  })

  it('age 30 in 2026 → 25 years growth', () => {
    const result = calculateBrsFrsErs(30, YEAR)
    const growthFactor = Math.pow(1.035, 25)
    expect(result.brs).toBeCloseTo(110200 * growthFactor, 0)
    expect(result.frs).toBeCloseTo(220400 * growthFactor, 0)
  })

  it('age >= 55 → no further growth (already past)', () => {
    const result = calculateBrsFrsErs(60, YEAR)
    // Still applies yearsSinceBase: 2026 - 2026 = 0, yearsUntil55 = 0
    expect(result.brs).toBeCloseTo(110200, 0)
  })

  it('future year adds offset: age 46 in 2027 → 10 years growth', () => {
    const result = calculateBrsFrsErs(46, 2027)
    const growthFactor = Math.pow(1.035, 10) // 9 years to 55 + 1 year offset
    expect(result.frs).toBeCloseTo(220400 * growthFactor, 0)
  })

  it('ERS = 2x FRS, BRS = 0.5x FRS at any age', () => {
    const result = calculateBrsFrsErs(40, YEAR)
    expect(result.ers).toBeCloseTo(result.frs * 2, 0)
    expect(result.brs).toBeCloseTo(result.frs / 2, 0)
  })
})

describe('estimateCpfLifePayout', () => {
  it('Standard plan: FRS $213K → ~$13,419/yr', () => {
    const payout = estimateCpfLifePayout(213000, 'standard')
    expect(payout).toBeCloseTo(13419, 0)
  })

  it('Basic plan: FRS $213K → ~$11,502/yr', () => {
    const payout = estimateCpfLifePayout(213000, 'basic')
    expect(payout).toBeCloseTo(11502, 0)
  })

  // Pre-Retiree integration test: CPF LIFE ~$13,400/yr
  it('Pre-Retiree: ~$13,400/yr CPF LIFE', () => {
    const payout = estimateCpfLifePayout(213000, 'standard')
    // $213,000 * 6.3% = $13,419 (CLAUDE.md says ~$13,400)
    expect(payout).toBeCloseTo(13419, 0)
    expect(Math.abs(payout - 13400)).toBeLessThan(100)
  })
})

describe('calculateCpfLifePayoutAtAge', () => {
  it('returns 0 before start age', () => {
    expect(calculateCpfLifePayoutAtAge(213000, 'standard', 65, 60)).toBe(0)
    expect(calculateCpfLifePayoutAtAge(213000, 'standard', 65, 64)).toBe(0)
  })

  it('returns payout at start age', () => {
    const payout = calculateCpfLifePayoutAtAge(213000, 'standard', 65, 65)
    expect(payout).toBeCloseTo(13419, 0)
  })

  it('standard plan payout is flat regardless of age past start', () => {
    const at65 = calculateCpfLifePayoutAtAge(213000, 'standard', 65, 65)
    const at75 = calculateCpfLifePayoutAtAge(213000, 'standard', 65, 75)
    expect(at65).toBe(at75)
  })

  it('basic plan payout is flat regardless of age past start', () => {
    const at65 = calculateCpfLifePayoutAtAge(213000, 'basic', 65, 65)
    const at75 = calculateCpfLifePayoutAtAge(213000, 'basic', 65, 75)
    expect(at65).toBe(at75)
  })

  it('escalating plan compounds 2%/yr from start', () => {
    const at65 = calculateCpfLifePayoutAtAge(213000, 'escalating', 65, 65)
    const at66 = calculateCpfLifePayoutAtAge(213000, 'escalating', 65, 66)
    const at75 = calculateCpfLifePayoutAtAge(213000, 'escalating', 65, 75)

    // Year 0 = base payout
    expect(at65).toBeCloseTo(213000 * 0.048, 0)
    // Year 1 = base * 1.02
    expect(at66).toBeCloseTo(213000 * 0.048 * 1.02, 0)
    // Year 10 = base * 1.02^10
    expect(at75).toBeCloseTo(213000 * 0.048 * Math.pow(1.02, 10), 0)
  })

  it('matches estimateCpfLifePayout for standard plan at age 65', () => {
    const fromOld = estimateCpfLifePayout(213000, 'standard')
    const fromNew = calculateCpfLifePayoutAtAge(213000, 'standard', 65, 65)
    expect(fromNew).toBe(fromOld)
  })

  it('matches estimateCpfLifePayout for basic plan at age 65', () => {
    const fromOld = estimateCpfLifePayout(213000, 'basic')
    const fromNew = calculateCpfLifePayoutAtAge(213000, 'basic', 65, 65)
    expect(fromNew).toBe(fromOld)
  })

  it('returns 0 for zero retirement sum', () => {
    expect(calculateCpfLifePayoutAtAge(0, 'standard', 65, 65)).toBe(0)
  })

  it('handles configurable start age (e.g., 70)', () => {
    expect(calculateCpfLifePayoutAtAge(213000, 'standard', 70, 65)).toBe(0)
    expect(calculateCpfLifePayoutAtAge(213000, 'standard', 70, 70)).toBeCloseTo(13419, 0)
  })
})

describe('getRetirementSumAmount', () => {
  it('returns projected BRS/FRS/ERS (uses current year internally)', () => {
    const brs = getRetirementSumAmount('brs', 55)
    const frs = getRetirementSumAmount('frs', 55)
    const ers = getRetirementSumAmount('ers', 55)
    // At age 55, only yearsSinceBase matters. In 2026 with base 2026, that's 0.
    // These will shift if run in a different year, so check ratios instead.
    expect(ers).toBeCloseTo(frs * 2, 0)
    expect(brs).toBeCloseTo(frs / 2, 0)
    expect(frs).toBeGreaterThan(200000)
  })

  it('returns grown values for younger ages', () => {
    const frs30 = getRetirementSumAmount('frs', 30)
    const frs55 = getRetirementSumAmount('frs', 55)
    expect(frs30).toBeGreaterThan(frs55) // younger = more growth years
  })

  it('ERS = 2x FRS, BRS = 0.5x FRS at any age', () => {
    const brs = getRetirementSumAmount('brs', 40)
    const frs = getRetirementSumAmount('frs', 40)
    const ers = getRetirementSumAmount('ers', 40)
    expect(ers).toBeCloseTo(frs * 2, 0)
    expect(brs).toBeCloseTo(frs / 2, 0)
  })
})

describe('calculateCpfLifePayoutAtAge (integration)', () => {
  it('full projection: payout at 65, escalating grows, matches at start', () => {
    const frs = 213000
    const startAge = 65

    // Standard plan: same payout every year
    const std65 = calculateCpfLifePayoutAtAge(frs, 'standard', startAge, 65)
    const std75 = calculateCpfLifePayoutAtAge(frs, 'standard', startAge, 75)
    expect(std65).toBe(std75) // flat

    // Escalating plan: grows 2%/yr
    const esc65 = calculateCpfLifePayoutAtAge(frs, 'escalating', startAge, 65)
    const esc75 = calculateCpfLifePayoutAtAge(frs, 'escalating', startAge, 75)
    expect(esc75).toBeGreaterThan(esc65)
    expect(esc75 / esc65).toBeCloseTo(Math.pow(1.02, 10), 2)

    // Standard always matches estimateCpfLifePayout at start age
    expect(std65).toBe(estimateCpfLifePayout(frs, 'standard'))

    // Deferred start (age 70): still returns 0 before 70
    expect(calculateCpfLifePayoutAtAge(frs, 'standard', 70, 68)).toBe(0)
    expect(calculateCpfLifePayoutAtAge(frs, 'standard', 70, 70)).toBeGreaterThan(0)
  })
})

describe('autoDetectRetirementSum', () => {
  const frsAt55 = 213000

  it('returns ERS when SA exceeds 2x FRS', () => {
    expect(autoDetectRetirementSum(500000, frsAt55, false)).toBe('ers')
  })

  it('returns FRS when SA meets FRS but not ERS', () => {
    expect(autoDetectRetirementSum(250000, frsAt55, false)).toBe('frs')
  })

  it('returns BRS when SA meets BRS with property', () => {
    expect(autoDetectRetirementSum(110000, frsAt55, true)).toBe('brs')
  })

  it('returns FRS when SA meets BRS but no property', () => {
    expect(autoDetectRetirementSum(110000, frsAt55, false)).toBe('frs')
  })

  it('returns FRS when SA is below BRS even with property', () => {
    expect(autoDetectRetirementSum(50000, frsAt55, true)).toBe('frs')
  })
})

describe('performAge55Transfer', () => {
  it('SA covers full target → RA = target, SA excess goes to OA', () => {
    const result = performAge55Transfer(100000, 250000, 213000)
    expect(result.newRA).toBe(213000)
    // Excess SA = 250K - 213K = 37K → added to OA
    expect(result.newOA).toBe(100000 + 37000) // 137K
    expect(result.newSA).toBe(0) // SA always closed
  })

  it('SA partial + OA fills gap → RA = target', () => {
    const result = performAge55Transfer(100000, 150000, 213000)
    expect(result.newRA).toBe(213000) // 150K from SA + 63K from OA
    expect(result.newOA).toBe(100000 - 63000) // 37K remaining
    expect(result.newSA).toBe(0)
  })

  it('SA + OA < target → RA = SA + OA', () => {
    const result = performAge55Transfer(50000, 100000, 213000)
    expect(result.newRA).toBe(150000) // all of SA + all of OA
    expect(result.newOA).toBe(0)
    expect(result.newSA).toBe(0)
  })

  it('SA = 0 edge case → only OA transfers', () => {
    const result = performAge55Transfer(300000, 0, 213000)
    expect(result.newRA).toBe(213000) // 213K from OA
    expect(result.newOA).toBe(87000) // 300K - 213K
    expect(result.newSA).toBe(0)
  })

  it('both balances 0 → RA = 0', () => {
    const result = performAge55Transfer(0, 0, 213000)
    expect(result.newRA).toBe(0)
    expect(result.newOA).toBe(0)
    expect(result.newSA).toBe(0)
  })
})

describe('allocatePostAge55Contribution', () => {
  const makeCpfContribution = (oa: number, sa: number, ma: number) => ({
    employee: 0, employer: 0, total: 0,
    oaAllocation: oa, saAllocation: sa, maAllocation: ma,
  })

  it('RA has room → SA portion goes to RA', () => {
    const cpf = makeCpfContribution(5000, 2000, 3000)
    const result = allocatePostAge55Contribution(cpf, 200000, 213000)
    expect(result.raAllocation).toBe(2000) // full SA portion → RA
    expect(result.oaAllocation).toBe(5000) // OA unchanged
    expect(result.maAllocation).toBe(3000)
  })

  it('RA at cap → SA overflow goes to OA', () => {
    const cpf = makeCpfContribution(5000, 2000, 3000)
    const result = allocatePostAge55Contribution(cpf, 213000, 213000)
    expect(result.raAllocation).toBe(0) // no room
    expect(result.oaAllocation).toBe(7000) // 5K OA + 2K overflow
    expect(result.maAllocation).toBe(3000)
  })

  it('partial room → split SA between RA and OA', () => {
    const cpf = makeCpfContribution(5000, 2000, 3000)
    const result = allocatePostAge55Contribution(cpf, 212000, 213000)
    expect(result.raAllocation).toBe(1000) // only 1K room
    expect(result.oaAllocation).toBe(6000) // 5K OA + 1K overflow
    expect(result.maAllocation).toBe(3000)
  })
})

describe('calculateCpfExtraInterestWithAge', () => {
  it('under 55 matches old calculateCpfExtraInterest behavior', () => {
    const old = calculateCpfExtraInterest(20000, 30000, 10000, 30)
    const withAge = calculateCpfExtraInterestWithAge(20000, 30000, 10000, 0, 30)
    expect(withAge).toBe(old)
  })

  it('age 55 uses under-55 rules (boundary)', () => {
    const old = calculateCpfExtraInterest(20000, 30000, 10000, 55)
    const withAge = calculateCpfExtraInterestWithAge(20000, 30000, 10000, 0, 55)
    expect(withAge).toBe(old)
  })

  it('age 56: OA cap raised to $30K', () => {
    // $30K OA qualifies (not $20K), $30K remaining from SA/RA
    const result = calculateCpfExtraInterestWithAge(50000, 0, 0, 100000, 56)
    // OA: $30K × 1% = $300
    // RA additional: min(100K, 30K) × 1% = $300
    // Remaining combined cap: $60K - $30K = $30K, from RA: $30K
    // Total base extra: ($30K + $30K) × 1% = $600
    // Total = $600 + $300 = $900
    expect(result).toBeCloseTo(900, 0)
  })

  it('age 56: RA gets additional 2% total extra on first $30K', () => {
    // RA only, $50K balance, age 56
    const result = calculateCpfExtraInterestWithAge(0, 0, 0, 50000, 56)
    // OA: $0 qualifying
    // RA additional: min(50K, 30K) × 1% = $300
    // Remaining combined cap: $60K - $0 = $60K, from RA: min(50K, 60K) = $50K
    // Total base extra: ($0 + $50K) × 1% = $500
    // Total = $500 + $300 = $800
    expect(result).toBeCloseTo(800, 0)
  })

  it('age 56: small balances get proportional extra', () => {
    const result = calculateCpfExtraInterestWithAge(10000, 0, 5000, 20000, 56)
    // OA: $10K qualifying (under $30K cap)
    // RA additional: min(20K, 30K) × 1% = $200
    // Remaining combined cap: $60K - $10K = $50K, from RA: $20K, from MA: $5K
    // Total base extra: ($10K + $20K + $5K) × 1% = $350
    // Total = $350 + $200 = $550
    expect(result).toBeCloseTo(550, 0)
  })

  it('age 56: zero balances → zero extra', () => {
    expect(calculateCpfExtraInterestWithAge(0, 0, 0, 0, 56)).toBe(0)
  })
})

// ============================================================
// CPFIS Interest
// ============================================================

describe('calculateCpfisInterest', () => {
  it('OA below retention: all at standard 2.5%', () => {
    const result = calculateCpfisInterest(15000, 30000, 0.06, 0.07)
    // OA: $15K all at 2.5% = $375
    expect(result.oaInterest).toBeCloseTo(15000 * OA_INTEREST_RATE, 2)
    // SA: $30K all at 4% = $1,200
    expect(result.saInterest).toBeCloseTo(30000 * SA_INTEREST_RATE, 2)
  })

  it('SA below retention: all at standard 4%', () => {
    const result = calculateCpfisInterest(50000, 35000, 0.06, 0.07)
    // SA: $35K all at 4% = $1,400
    expect(result.saInterest).toBeCloseTo(35000 * SA_INTEREST_RATE, 2)
  })

  it('OA above retention: split rate calculation', () => {
    const result = calculateCpfisInterest(50000, 10000, 0.06, 0.07)
    // OA: $20K at 2.5% + $30K at 6% = $500 + $1,800 = $2,300
    const expectedOa = CPFIS_OA_RETENTION * OA_INTEREST_RATE + 30000 * 0.06
    expect(result.oaInterest).toBeCloseTo(expectedOa, 2)
    // SA: $10K all at 4% = $400
    expect(result.saInterest).toBeCloseTo(10000 * SA_INTEREST_RATE, 2)
  })

  it('SA above retention: split rate calculation', () => {
    const result = calculateCpfisInterest(10000, 100000, 0.06, 0.07)
    // OA: $10K at 2.5% = $250
    expect(result.oaInterest).toBeCloseTo(10000 * OA_INTEREST_RATE, 2)
    // SA: $40K at 4% + $60K at 7% = $1,600 + $4,200 = $5,800
    const expectedSa = CPFIS_SA_RETENTION * SA_INTEREST_RATE + 60000 * 0.07
    expect(result.saInterest).toBeCloseTo(expectedSa, 2)
  })

  it('both above retention', () => {
    const result = calculateCpfisInterest(80000, 100000, 0.08, 0.10)
    // OA: $20K at 2.5% + $60K at 8% = $500 + $4,800 = $5,300
    const expectedOa = CPFIS_OA_RETENTION * OA_INTEREST_RATE + 60000 * 0.08
    expect(result.oaInterest).toBeCloseTo(expectedOa, 2)
    // SA: $40K at 4% + $60K at 10% = $1,600 + $6,000 = $7,600
    const expectedSa = CPFIS_SA_RETENTION * SA_INTEREST_RATE + 60000 * 0.10
    expect(result.saInterest).toBeCloseTo(expectedSa, 2)
  })

  it('zero balances', () => {
    const result = calculateCpfisInterest(0, 0, 0.06, 0.07)
    expect(result.oaInterest).toBe(0)
    expect(result.saInterest).toBe(0)
  })

  it('exactly at retention limit', () => {
    const result = calculateCpfisInterest(CPFIS_OA_RETENTION, CPFIS_SA_RETENTION, 0.06, 0.07)
    // All at standard rates since balance equals retention (nothing above)
    expect(result.oaInterest).toBeCloseTo(CPFIS_OA_RETENTION * OA_INTEREST_RATE, 2)
    expect(result.saInterest).toBeCloseTo(CPFIS_SA_RETENTION * SA_INTEREST_RATE, 2)
  })

  it('negative CPFIS return still applies to invested portion', () => {
    const result = calculateCpfisInterest(50000, 80000, -0.05, -0.10)
    // OA: $20K at 2.5% + $30K at -5% = $500 - $1,500 = -$1,000
    const expectedOa = CPFIS_OA_RETENTION * OA_INTEREST_RATE + 30000 * (-0.05)
    expect(result.oaInterest).toBeCloseTo(expectedOa, 2)
    // SA: $40K at 4% + $40K at -10% = $1,600 - $4,000 = -$2,400
    const expectedSa = CPFIS_SA_RETENTION * SA_INTEREST_RATE + 40000 * (-0.10)
    expect(result.saInterest).toBeCloseTo(expectedSa, 2)
  })
})

// ============================================================
// capMaAtBhs — Medisave BHS overflow routing
// ============================================================

describe('capMaAtBhs', () => {
  const BHS = MEDISAVE_BHS // 79,000

  it('MA + allocation below BHS → no overflow', () => {
    const result = capMaAtBhs(5000, 70000, BHS, false, 0, 0, false)
    expect(result.maAllocation).toBe(5000)
    expect(result.overflowToSA).toBe(0)
    expect(result.overflowToRA).toBe(0)
    expect(result.overflowToOA).toBe(0)
  })

  it('MA exactly at BHS, allocation > 0 → full allocation overflows', () => {
    const result = capMaAtBhs(5000, BHS, BHS, false, 0, 0, false)
    expect(result.maAllocation).toBe(0)
    expect(result.overflowToSA).toBe(5000)
  })

  it('MA below BHS, allocation partially fits → split between MA and overflow', () => {
    // Room = 79000 - 76000 = 3000, allocation = 5000
    const result = capMaAtBhs(5000, 76000, BHS, false, 0, 0, false)
    expect(result.maAllocation).toBe(3000)
    expect(result.overflowToSA).toBe(2000)
  })

  it('pre-55: overflow goes to SA', () => {
    const result = capMaAtBhs(10000, BHS, BHS, false, 0, 0, false)
    expect(result.maAllocation).toBe(0)
    expect(result.overflowToSA).toBe(10000)
    expect(result.overflowToRA).toBe(0)
    expect(result.overflowToOA).toBe(0)
  })

  it('post-55 pre-LIFE, RA has room → overflow to RA', () => {
    const result = capMaAtBhs(5000, BHS, BHS, true, 200000, 213000, false)
    expect(result.maAllocation).toBe(0)
    expect(result.overflowToSA).toBe(0)
    expect(result.overflowToRA).toBe(5000) // 13K room in RA, only 5K overflow
    expect(result.overflowToOA).toBe(0)
  })

  it('post-55 pre-LIFE, RA full → overflow to OA', () => {
    const result = capMaAtBhs(5000, BHS, BHS, true, 213000, 213000, false)
    expect(result.maAllocation).toBe(0)
    expect(result.overflowToSA).toBe(0)
    expect(result.overflowToRA).toBe(0)
    expect(result.overflowToOA).toBe(5000)
  })

  it('post-55 pre-LIFE, partial RA room → split RA + OA', () => {
    // RA room = 213000 - 211000 = 2000, excess = 5000
    const result = capMaAtBhs(5000, BHS, BHS, true, 211000, 213000, false)
    expect(result.maAllocation).toBe(0)
    expect(result.overflowToSA).toBe(0)
    expect(result.overflowToRA).toBe(2000)
    expect(result.overflowToOA).toBe(3000)
  })

  it('post-LIFE: overflow always to OA (even if RA=0 < retirementSumTarget)', () => {
    // postLife=true means RA is annuitized; must not receive overflow
    const result = capMaAtBhs(5000, BHS, BHS, true, 0, 213000, true)
    expect(result.maAllocation).toBe(0)
    expect(result.overflowToSA).toBe(0)
    expect(result.overflowToRA).toBe(0)
    expect(result.overflowToOA).toBe(5000)
  })

  it('conservation of money: total always equals original maAllocation', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 20000 }),   // maAllocation
        fc.nat({ max: 100000 }),  // currentMaBalance
        fc.boolean(),             // saClosed
        fc.nat({ max: 300000 }),  // raBalance
        fc.nat({ max: 300000 }),  // retirementSumTarget
        fc.boolean(),             // postLife
        (maAlloc, maBalance, saClosed, raBalance, retirementSumTarget, postLife) => {
          const result = capMaAtBhs(maAlloc, maBalance, BHS, saClosed, raBalance, retirementSumTarget, postLife)
          const total = result.maAllocation + result.overflowToSA + result.overflowToRA + result.overflowToOA
          return Math.abs(total - maAlloc) < 0.01
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ============================================================
// getBhsAtAge — BHS projection with H65 freeze
// ============================================================

describe('getBhsAtAge', () => {
  const BASE_YEAR = BHS_BASE_YEAR // 2026
  const BASE_BHS = MEDISAVE_BHS   // 79,000
  const RATE = BHS_GROWTH_RATE     // 0.045

  it('returns base BHS for current age in the base year', () => {
    const result = getBhsAtAge(30, 30, BASE_YEAR)
    expect(result).toBe(BASE_BHS)
  })

  it('grows at 4.5% per year before age 65', () => {
    // User age 30, projecting to age 31 → 1 year of growth
    const at31 = getBhsAtAge(31, 30, BASE_YEAR)
    expect(at31).toBe(Math.round(BASE_BHS * Math.pow(1 + RATE, 1)))

    // User age 30, projecting to age 40 → 10 years of growth
    const at40 = getBhsAtAge(40, 30, BASE_YEAR)
    expect(at40).toBe(Math.round(BASE_BHS * Math.pow(1 + RATE, 10)))
  })

  it('freezes BHS at age 65', () => {
    // User age 30 in 2026 → turns 65 in 2061 → 35 years of growth
    const expectedBhsAt65 = Math.round(BASE_BHS * Math.pow(1 + RATE, 35))
    const at65 = getBhsAtAge(65, 30, BASE_YEAR)
    expect(at65).toBe(expectedBhsAt65)

    // At 66, 70, 80: same frozen value as at 65
    expect(getBhsAtAge(66, 30, BASE_YEAR)).toBe(expectedBhsAt65)
    expect(getBhsAtAge(70, 30, BASE_YEAR)).toBe(expectedBhsAt65)
    expect(getBhsAtAge(80, 30, BASE_YEAR)).toBe(expectedBhsAt65)
  })

  it('user already 65+: BHS frozen at their cohort value', () => {
    // User age 70 in 2026 → turned 65 in 2021 → BHS grew from base year backwards
    // yearsFromBase = (2026 + (65 - 70)) - 2026 = -5
    const expectedBhs = Math.round(BASE_BHS * Math.pow(1 + RATE, -5))
    const result = getBhsAtAge(70, 70, BASE_YEAR)
    expect(result).toBe(expectedBhs)
    // Should be ~$63,396 — close to historical $63,000
    expect(result).toBeGreaterThan(60000)
    expect(result).toBeLessThan(66000)
  })

  it('user exactly 65: gets current year BHS', () => {
    // Turns 65 in the base year → freeze year = base year
    const result = getBhsAtAge(65, 65, BASE_YEAR)
    expect(result).toBe(BASE_BHS)
  })

  it('accounts for calendar year offset from base year', () => {
    // Same age 30, but it's 2028 (2 years after base year)
    // Projecting to age 30 (same year): BHS has grown 2 years from base
    const result = getBhsAtAge(30, 30, BASE_YEAR + 2)
    expect(result).toBe(Math.round(BASE_BHS * Math.pow(1 + RATE, 2)))
  })

  it('result is always a rounded integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 100 }),  // age
        fc.integer({ min: 18, max: 100 }),  // currentAge
        fc.integer({ min: 2020, max: 2060 }), // currentYear
        (age, currentAge, currentYear) => {
          if (age < currentAge) return true // skip invalid
          const result = getBhsAtAge(age, currentAge, currentYear)
          return Number.isInteger(result) && result > 0
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================================
// getFrsForYear — FRS projection for voluntary SA top-up cap
// ============================================================

describe('getFrsForYear', () => {
  it('returns FRS_BASE for the base year', () => {
    expect(getFrsForYear(RETIREMENT_SUM_BASE_YEAR)).toBe(FRS_BASE)
  })

  it('grows at 3.5% per year into the future', () => {
    const frs2030 = getFrsForYear(RETIREMENT_SUM_BASE_YEAR + 4)
    expect(frs2030).toBeCloseTo(FRS_BASE * Math.pow(1 + BRS_GROWTH_RATE, 4), 0)
  })

  it('returns FRS_BASE for years before the base year (clamped at 0 growth)', () => {
    expect(getFrsForYear(RETIREMENT_SUM_BASE_YEAR - 5)).toBe(FRS_BASE)
  })

  it('is consistent with calculateBrsFrsErs for age 55 in the same year', () => {
    const fromHelper = getFrsForYear(2030)
    const fromProjection = calculateBrsFrsErs(55, 2030)
    // calculateBrsFrsErs: yearsSinceBase = max(0, 2030-2026) = 4, yearsUntil55 = 0
    expect(fromHelper).toBeCloseTo(fromProjection.frs, 0)
  })
})

// ============================================================
// estimateCpfBalancesFromAge — rough CPF balance estimator
// ============================================================

describe('estimateCpfBalancesFromAge', () => {
  it('returns zero for career start age = current age (no working years)', () => {
    const result = estimateCpfBalancesFromAge(22, 72000, 22)
    expect(result.oa).toBe(0)
    expect(result.sa).toBe(0)
    expect(result.ma).toBe(0)
  })

  it('returns positive balances for age 30 with $72K salary in reasonable ranges', () => {
    const result = estimateCpfBalancesFromAge(30, 72000, 22, 0.03)
    // 8-year career with ~$72K current salary (23% OA rate + interest compounding)
    expect(result.oa).toBeGreaterThan(30000)
    expect(result.oa).toBeLessThan(200000)
    expect(result.sa).toBeGreaterThan(0)
    expect(result.ma).toBeGreaterThan(0)
    // OA should be largest (23% allocation vs 6% SA and 8% MA)
    expect(result.oa).toBeGreaterThan(result.sa)
  })

  it('returns higher balances for higher salary (same age)', () => {
    const low = estimateCpfBalancesFromAge(30, 72000, 22, 0.03)
    const high = estimateCpfBalancesFromAge(30, 120000, 22, 0.03)
    expect(high.oa).toBeGreaterThan(low.oa)
    expect(high.sa).toBeGreaterThan(low.sa)
    expect(high.ma).toBeGreaterThan(low.ma)
  })

  it('returns higher balances for older age (same salary)', () => {
    const young = estimateCpfBalancesFromAge(30, 72000, 22, 0.03)
    const older = estimateCpfBalancesFromAge(40, 72000, 22, 0.03)
    expect(older.oa).toBeGreaterThan(young.oa)
    expect(older.sa).toBeGreaterThan(young.sa)
    expect(older.ma).toBeGreaterThan(young.ma)
  })

  it('handles edge case: salary = 0 (should return all zeros)', () => {
    const result = estimateCpfBalancesFromAge(30, 0, 22, 0.03)
    expect(result.oa).toBe(0)
    expect(result.sa).toBe(0)
    expect(result.ma).toBe(0)
  })

  it('PR backward graduation: very recent PR (6 months) at age 30 has zero historical CPF', () => {
    // 6 months as PR at age 30 → the earliest completed historical year is age 29
    // At age 29: effectivePrMonths = 6 - (30-29)*12 = -6 → foreigner (zero rates)
    // All historical years 22-29 are foreigner, so zero contributions accumulated
    const result = estimateCpfBalancesFromAge(30, 72000, 22, 0.03, 'pr', 6)
    expect(result.oa).toBe(0)
    expect(result.sa).toBe(0)
    expect(result.ma).toBe(0)
  })

  it('PR backward graduation: 18-month PR has one year at Year 1 rates', () => {
    // 18 months as PR at age 30 → at age 29: 18-12=6 → PR Year 1 (9% total)
    // All earlier ages: foreigner (zero rates)
    const result = estimateCpfBalancesFromAge(30, 72000, 22, 0.03, 'pr', 18)
    // Should have contributions from just age 29 at Year 1 rates (9% total vs 37%)
    expect(result.oa + result.sa + result.ma).toBeGreaterThan(0)
    const citizenResult = estimateCpfBalancesFromAge(30, 72000, 22, 0.03)
    // Much less than citizen (1 year at 9% vs 8 years at 37%)
    expect(result.oa + result.sa + result.ma).toBeLessThan(
      (citizenResult.oa + citizenResult.sa + citizenResult.ma) * 0.15
    )
  })

  it('PR Year 3+ (prMonths >= 24) matches citizen result', () => {
    const pr = estimateCpfBalancesFromAge(30, 72000, 22, 0.03, 'pr', 120)
    const citizen = estimateCpfBalancesFromAge(30, 72000, 22, 0.03)
    // PR with 120 months (10 years) was PR from before career start
    // prMonths - (30-23)*12 = 120 - 84 = 36 (still >= 24 at age 23)
    expect(pr.oa).toBeCloseTo(citizen.oa, 0)
    expect(pr.sa).toBeCloseTo(citizen.sa, 0)
    expect(pr.ma).toBeCloseTo(citizen.ma, 0)
  })

  it('foreigner gets zero balances', () => {
    const result = estimateCpfBalancesFromAge(30, 72000, 22, 0.03, 'foreigner')
    expect(result.oa).toBe(0)
    expect(result.sa).toBe(0)
    expect(result.ma).toBe(0)
  })
})

// ============================================================
// getCpfRatesForAge — Residency-based rate lookup
// ============================================================

describe('getCpfRatesForAge', () => {
  describe('citizen rates (default)', () => {
    it('returns 37% for age 30 (default params = citizen)', () => {
      const rates = getCpfRatesForAge(30)
      expect(rates.totalRate).toBe(0.37)
      expect(rates.employeeRate).toBe(0.20)
      expect(rates.employerRate).toBe(0.17)
    })

    it('explicit citizen status matches default', () => {
      const def = getCpfRatesForAge(30)
      const explicit = getCpfRatesForAge(30, 'citizen', 24)
      expect(def).toEqual(explicit)
    })
  })

  describe('foreigner rates', () => {
    it('returns zero for all age brackets', () => {
      for (const age of [25, 35, 45, 55, 60, 65, 70, 75]) {
        const rates = getCpfRatesForAge(age, 'foreigner')
        expect(rates.totalRate).toBe(0)
        expect(rates.employeeRate).toBe(0)
        expect(rates.employerRate).toBe(0)
        expect(rates.oaRate).toBe(0)
        expect(rates.saRate).toBe(0)
        expect(rates.maRate).toBe(0)
      }
    })
  })

  describe('PR Year 1 rates (prMonths < 12)', () => {
    it('age 30, PR Year 1: 9% total (5% + 4%)', () => {
      const rates = getCpfRatesForAge(30, 'pr', 6)
      expect(rates.totalRate).toBe(0.09)
      expect(rates.employeeRate).toBe(0.05)
      expect(rates.employerRate).toBe(0.04)
    })

    it('age 30, PR Year 1: OA/SA/MA scaled from citizen ratios', () => {
      const rates = getCpfRatesForAge(30, 'pr', 6)
      const citizen = getCpfRatesForAge(30)
      const scale = 0.09 / citizen.totalRate
      expect(rates.oaRate).toBeCloseTo(citizen.oaRate * scale, 6)
      expect(rates.saRate).toBeCloseTo(citizen.saRate * scale, 6)
      expect(rates.maRate).toBeCloseTo(citizen.maRate * scale, 6)
    })

    it('age 62, PR Year 1: 8.5% total (5% + 3.5%)', () => {
      const rates = getCpfRatesForAge(62, 'pr', 3)
      expect(rates.totalRate).toBe(0.085)
      expect(rates.employeeRate).toBe(0.05)
      expect(rates.employerRate).toBe(0.035)
    })

    it('prMonths = 0 uses Year 1 rates', () => {
      const rates = getCpfRatesForAge(30, 'pr', 0)
      expect(rates.totalRate).toBe(0.09)
    })

    it('prMonths = 11 still uses Year 1 rates', () => {
      const rates = getCpfRatesForAge(30, 'pr', 11)
      expect(rates.totalRate).toBe(0.09)
    })
  })

  describe('PR Year 2 rates (12 <= prMonths < 24)', () => {
    it('age 30, PR Year 2: 24% total (15% + 9%)', () => {
      const rates = getCpfRatesForAge(30, 'pr', 12)
      expect(rates.totalRate).toBe(0.24)
      expect(rates.employeeRate).toBe(0.15)
      expect(rates.employerRate).toBe(0.09)
    })

    it('age 30, PR Year 2: OA/SA/MA scaled from citizen ratios', () => {
      const rates = getCpfRatesForAge(30, 'pr', 18)
      const citizen = getCpfRatesForAge(30)
      const scale = 0.24 / citizen.totalRate
      expect(rates.oaRate).toBeCloseTo(citizen.oaRate * scale, 6)
      expect(rates.saRate).toBeCloseTo(citizen.saRate * scale, 6)
      expect(rates.maRate).toBeCloseTo(citizen.maRate * scale, 6)
    })

    it('age 57, PR Year 2: 18.5% total (12.5% + 6%)', () => {
      const rates = getCpfRatesForAge(57, 'pr', 18)
      expect(rates.totalRate).toBe(0.185)
      expect(rates.employeeRate).toBe(0.125)
      expect(rates.employerRate).toBe(0.06)
    })

    it('age 63, PR Year 2: 11% total (7.5% + 3.5%)', () => {
      const rates = getCpfRatesForAge(63, 'pr', 15)
      expect(rates.totalRate).toBe(0.11)
      expect(rates.employeeRate).toBe(0.075)
      expect(rates.employerRate).toBe(0.035)
    })

    it('age 68, PR Year 2: 8.5% total (5% + 3.5%)', () => {
      const rates = getCpfRatesForAge(68, 'pr', 20)
      expect(rates.totalRate).toBe(0.085)
      expect(rates.employeeRate).toBe(0.05)
      expect(rates.employerRate).toBe(0.035)
    })

    it('prMonths = 12 uses Year 2 rates', () => {
      const rates = getCpfRatesForAge(30, 'pr', 12)
      expect(rates.totalRate).toBe(0.24)
    })

    it('prMonths = 23 still uses Year 2 rates', () => {
      const rates = getCpfRatesForAge(30, 'pr', 23)
      expect(rates.totalRate).toBe(0.24)
    })
  })

  describe('PR Year 3+ (prMonths >= 24)', () => {
    it('prMonths = 24 returns full citizen rates', () => {
      const pr = getCpfRatesForAge(30, 'pr', 24)
      const citizen = getCpfRatesForAge(30)
      expect(pr).toEqual(citizen)
    })

    it('prMonths = 120 returns full citizen rates', () => {
      const pr = getCpfRatesForAge(45, 'pr', 120)
      const citizen = getCpfRatesForAge(45)
      expect(pr).toEqual(citizen)
    })
  })

  describe('allocation ratio invariants', () => {
    it('PR allocation OA+SA+MA sums to total rate', () => {
      const rates = getCpfRatesForAge(30, 'pr', 6)
      expect(rates.oaRate + rates.saRate + rates.maRate).toBeCloseTo(rates.totalRate, 6)
    })

    it('PR Year 2 allocation OA+SA+MA sums to total rate', () => {
      const rates = getCpfRatesForAge(30, 'pr', 18)
      expect(rates.oaRate + rates.saRate + rates.maRate).toBeCloseTo(rates.totalRate, 6)
    })

    it('preserves citizen OA:SA:MA proportion for PR', () => {
      const citizen = getCpfRatesForAge(30)
      const pr = getCpfRatesForAge(30, 'pr', 6)
      // OA/SA ratio should be preserved
      const citizenOaSa = citizen.oaRate / citizen.saRate
      const prOaSa = pr.oaRate / pr.saRate
      expect(prOaSa).toBeCloseTo(citizenOaSa, 4)
    })
  })
})

// ============================================================
// calculateCpfContribution — Residency variants
// ============================================================

describe('calculateCpfContribution (residency)', () => {
  it('foreigner: zero contribution regardless of salary/age', () => {
    const result = calculateCpfContribution(120000, 30, 0, 'foreigner')
    expect(result.total).toBe(0)
    expect(result.employee).toBe(0)
    expect(result.employer).toBe(0)
    expect(result.oaAllocation).toBe(0)
    expect(result.saAllocation).toBe(0)
    expect(result.maAllocation).toBe(0)
  })

  it('PR Year 1 (age 30): 9% of salary (OW-capped)', () => {
    const result = calculateCpfContribution(72000, 30, 0, 'pr', 6)
    expect(result.total).toBeCloseTo(72000 * 0.09, 0)
    expect(result.employee).toBeCloseTo(72000 * 0.05, 0)
    expect(result.employer).toBeCloseTo(72000 * 0.04, 0)
  })

  it('PR Year 2 (age 30): 24% of salary (OW-capped)', () => {
    const result = calculateCpfContribution(72000, 30, 0, 'pr', 18)
    expect(result.total).toBeCloseTo(72000 * 0.24, 0)
    expect(result.employee).toBeCloseTo(72000 * 0.15, 0)
    expect(result.employer).toBeCloseTo(72000 * 0.09, 0)
  })

  it('PR Year 3+: matches citizen contribution', () => {
    const pr = calculateCpfContribution(72000, 30, 0, 'pr', 36)
    const citizen = calculateCpfContribution(72000, 30)
    expect(pr.total).toBe(citizen.total)
    expect(pr.oaAllocation).toBe(citizen.oaAllocation)
  })

  it('default params (no residency) produce citizen rates', () => {
    const explicit = calculateCpfContribution(72000, 30, 0, 'citizen', 24)
    const defaultCall = calculateCpfContribution(72000, 30)
    expect(explicit.total).toBe(defaultCall.total)
  })
})
