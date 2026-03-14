import { describe, expect, it } from 'vitest'
import {
  CPF_RATES,
  OW_CEILING_MONTHLY,
  OW_CEILING_ANNUAL,
  BRS_BASE,
  FRS_BASE,
  ERS_BASE,
  getCpfRatesForAge,
} from '@/lib/data/cpfRates'
import {
  TAX_BRACKETS,
  SRS_ANNUAL_CAP,
  SRS_ANNUAL_CAP_FOREIGNER,
  RELIEF_AMOUNTS,
  earnedIncomeReliefForAge,
} from '@/lib/data/taxBrackets'
import { BSD_BRACKETS, ABSD_RATES } from '@/lib/data/stampDutyRates'
import { BALA_TABLE_RAW, getBalaFactor } from '@/lib/data/balaTable'

describe('CPF rates — data invariants', () => {
  it('age brackets are contiguous with no gaps', () => {
    for (let i = 0; i < CPF_RATES.length - 1; i++) {
      expect(CPF_RATES[i].maxAge).toBe(CPF_RATES[i + 1].minAge)
    }
  })

  it('last bracket extends to Infinity', () => {
    expect(CPF_RATES[CPF_RATES.length - 1].maxAge).toBe(Infinity)
  })

  it('employee + employer = total rate for each bracket', () => {
    for (const bracket of CPF_RATES) {
      expect(bracket.employeeRate + bracket.employerRate).toBeCloseTo(bracket.totalRate, 10)
    }
  })

  it('OA + SA + MA = total rate for each bracket', () => {
    for (const bracket of CPF_RATES) {
      expect(bracket.oaRate + bracket.saRate + bracket.maRate).toBeCloseTo(bracket.totalRate, 10)
    }
  })

  it('all rates are in [0, 1]', () => {
    for (const bracket of CPF_RATES) {
      expect(bracket.totalRate).toBeGreaterThanOrEqual(0)
      expect(bracket.totalRate).toBeLessThanOrEqual(1)
      expect(bracket.employeeRate).toBeGreaterThanOrEqual(0)
      expect(bracket.employerRate).toBeGreaterThanOrEqual(0)
    }
  })

  it('total rate is non-increasing with age', () => {
    for (let i = 0; i < CPF_RATES.length - 1; i++) {
      expect(CPF_RATES[i].totalRate).toBeGreaterThanOrEqual(CPF_RATES[i + 1].totalRate)
    }
  })

  it('OW ceiling annual = monthly * 12', () => {
    expect(OW_CEILING_ANNUAL).toBe(OW_CEILING_MONTHLY * 12)
  })

  it('retirement sums are related: FRS = 2*BRS, ERS = 4*BRS', () => {
    expect(FRS_BASE).toBe(2 * BRS_BASE)
    expect(ERS_BASE).toBe(4 * BRS_BASE)
  })

  it('getCpfRatesForAge returns zero for foreigners', () => {
    const rates = getCpfRatesForAge(35, 'foreigner', 24)
    expect(rates.totalRate).toBe(0)
    expect(rates.employeeRate).toBe(0)
    expect(rates.employerRate).toBe(0)
  })

  it('getCpfRatesForAge returns 0.37 total for citizen under 55', () => {
    // prMonths irrelevant for citizens (short-circuits before checking)
    const rates = getCpfRatesForAge(35, 'citizen', 24)
    expect(rates.totalRate).toBeCloseTo(0.37, 2)
  })
})

describe('tax brackets — data invariants', () => {
  it('brackets are contiguous with no gaps', () => {
    for (let i = 0; i < TAX_BRACKETS.length - 1; i++) {
      expect(TAX_BRACKETS[i].to).toBe(TAX_BRACKETS[i + 1].from)
    }
  })

  it('first bracket starts at 0, last ends at Infinity', () => {
    expect(TAX_BRACKETS[0].from).toBe(0)
    expect(TAX_BRACKETS[TAX_BRACKETS.length - 1].to).toBe(Infinity)
  })

  it('all marginal rates are in [0, 1]', () => {
    for (const bracket of TAX_BRACKETS) {
      expect(bracket.rate).toBeGreaterThanOrEqual(0)
      expect(bracket.rate).toBeLessThanOrEqual(1)
    }
  })

  it('cumulativeTax values are consistent with brackets', () => {
    for (let i = 1; i < TAX_BRACKETS.length; i++) {
      const prev = TAX_BRACKETS[i - 1]
      // Skip the last bracket (Infinity width) — the loop skips it naturally
      // since prev.to - prev.from would be Infinity
      if (prev.to === Infinity) continue
      const expected = prev.cumulativeTax + (prev.to - prev.from) * prev.rate
      expect(TAX_BRACKETS[i].cumulativeTax).toBeCloseTo(expected, 2)
    }
  })

  it('SRS foreigner cap > citizen cap', () => {
    expect(SRS_ANNUAL_CAP_FOREIGNER).toBeGreaterThan(SRS_ANNUAL_CAP)
  })

  it('relief cap is 80,000', () => {
    expect(RELIEF_AMOUNTS.reliefCap).toBe(80_000)
  })

  it('earned income relief tiers are correct', () => {
    expect(earnedIncomeReliefForAge(30)).toBe(1_000)
    expect(earnedIncomeReliefForAge(55)).toBe(6_000)
    expect(earnedIncomeReliefForAge(65)).toBe(8_000)
  })
})

describe('stamp duty rates — data invariants', () => {
  it('BSD rates are strictly increasing', () => {
    for (let i = 0; i < BSD_BRACKETS.length - 1; i++) {
      expect(BSD_BRACKETS[i][1]).toBeLessThan(BSD_BRACKETS[i + 1][1])
    }
  })

  it('last BSD bracket has Infinity size', () => {
    expect(BSD_BRACKETS[BSD_BRACKETS.length - 1][0]).toBe(Infinity)
  })

  it('all BSD rates are in [0, 1]', () => {
    for (const [, rate] of BSD_BRACKETS) {
      expect(rate).toBeGreaterThanOrEqual(0)
      expect(rate).toBeLessThanOrEqual(1)
    }
  })

  it('ABSD for citizen first property is 0', () => {
    expect(ABSD_RATES.citizen[0]).toBe(0)
  })

  it('ABSD rates are non-decreasing within each residency', () => {
    for (const key of Object.keys(ABSD_RATES) as Array<keyof typeof ABSD_RATES>) {
      const rates = ABSD_RATES[key]
      for (let i = 0; i < rates.length - 1; i++) {
        expect(rates[i]).toBeLessThanOrEqual(rates[i + 1])
      }
    }
  })

  it('all ABSD rates are in [0, 1]', () => {
    for (const key of Object.keys(ABSD_RATES) as Array<keyof typeof ABSD_RATES>) {
      for (const rate of ABSD_RATES[key]) {
        expect(rate).toBeGreaterThanOrEqual(0)
        expect(rate).toBeLessThanOrEqual(1)
      }
    }
  })

  it('spot-check: BSD on $1M property is $24,600', () => {
    // Walk the brackets manually:
    // $180K @ 1% = $1,800
    // $180K @ 2% = $3,600
    // $640K @ 3% = $19,200
    // Total = $24,600
    let remaining = 1_000_000
    let bsd = 0
    for (const [size, rate] of BSD_BRACKETS) {
      const taxable = Math.min(remaining, size)
      bsd += taxable * rate
      remaining -= taxable
      if (remaining <= 0) break
    }
    expect(bsd).toBe(24_600)
  })
})

describe("Bala's Table — data invariants", () => {
  it('factors are strictly decreasing with remaining lease', () => {
    for (let i = 0; i < BALA_TABLE_RAW.length - 1; i++) {
      const [lease1, factor1] = BALA_TABLE_RAW[i]
      const [lease2, factor2] = BALA_TABLE_RAW[i + 1]
      // Table is ordered descending by lease years
      expect(lease1).toBeGreaterThan(lease2)
      expect(factor1).toBeGreaterThan(factor2)
    }
  })

  it('all factors are in [0, 1]', () => {
    for (const [, factor] of BALA_TABLE_RAW) {
      expect(factor).toBeGreaterThanOrEqual(0)
      expect(factor).toBeLessThanOrEqual(1)
    }
  })

  it('factor at 99 years is 0.99, at 0 years is 0', () => {
    expect(getBalaFactor(99)).toBeCloseTo(0.99, 2)
    expect(getBalaFactor(0)).toBe(0)
  })

  it('interpolates correctly between table entries', () => {
    // Between 99yr (0.99) and 95yr (0.98): at 97yr should be ~0.985
    const factor = getBalaFactor(97)
    expect(factor).toBeGreaterThan(0.98)
    expect(factor).toBeLessThan(0.99)
  })

  it('clamps at table maximum for leases > 99', () => {
    expect(getBalaFactor(150)).toBe(getBalaFactor(99))
  })

  it('returns 0 for negative lease values', () => {
    expect(getBalaFactor(-5)).toBe(0)
  })
})
