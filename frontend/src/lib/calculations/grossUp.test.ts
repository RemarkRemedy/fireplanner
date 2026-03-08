import { describe, it, expect } from 'vitest'
import { grossUpFromTakeHome, netDownFromGross, getCpfEmployeeRateLabel, isAboveOwCeiling } from './grossUp'

describe('grossUpFromTakeHome', () => {
  it('grosses up take-home for age 30 (20% CPF)', () => {
    expect(grossUpFromTakeHome(4800, 30)).toBeCloseTo(6000, 0)
  })

  it('grosses up take-home for age 50 (20% CPF)', () => {
    expect(grossUpFromTakeHome(4800, 50)).toBeCloseTo(6000, 0)
  })

  it('grosses up take-home for age 55 (20% CPF)', () => {
    expect(grossUpFromTakeHome(4800, 55)).toBeCloseTo(6000, 0)
  })

  it('grosses up take-home for age 58 (18% CPF)', () => {
    expect(grossUpFromTakeHome(4100, 58)).toBeCloseTo(5000, 0)
  })

  it('grosses up take-home for age 63 (12.5% CPF)', () => {
    expect(grossUpFromTakeHome(4375, 63)).toBeCloseTo(5000, 0)
  })

  it('grosses up take-home for age 68 (7.5% CPF)', () => {
    expect(grossUpFromTakeHome(4625, 68)).toBeCloseTo(5000, 0)
  })

  it('grosses up take-home for age 75 (5% CPF)', () => {
    expect(grossUpFromTakeHome(4750, 75)).toBeCloseTo(5000, 0)
  })

  it('applies OW ceiling for high earners under 55', () => {
    expect(grossUpFromTakeHome(7000, 30)).toBeCloseTo(8600, 0)
  })

  it('handles take-home exactly at OW ceiling boundary', () => {
    expect(grossUpFromTakeHome(6400, 30)).toBeCloseTo(8000, 0)
  })

  it('returns 0 for zero take-home', () => {
    expect(grossUpFromTakeHome(0, 30)).toBe(0)
  })
})

describe('netDownFromGross', () => {
  it('nets down gross for age 30 (20% CPF)', () => {
    expect(netDownFromGross(6000, 30)).toBeCloseTo(4800, 0)
  })

  it('nets down gross for age 58 (18% CPF)', () => {
    expect(netDownFromGross(5000, 58)).toBeCloseTo(4100, 0)
  })

  it('applies OW ceiling for high earners', () => {
    expect(netDownFromGross(10000, 30)).toBeCloseTo(8400, 0)
  })

  it('returns 0 for zero gross', () => {
    expect(netDownFromGross(0, 30)).toBe(0)
  })
})

describe('grossUp ↔ netDown round-trip', () => {
  const testCases = [
    { takeHome: 4800, age: 30 },
    { takeHome: 4100, age: 58 },
    { takeHome: 4375, age: 63 },
    { takeHome: 7000, age: 30 },
    { takeHome: 6400, age: 30 },
  ]

  for (const { takeHome, age } of testCases) {
    it(`round-trips take-home $${takeHome} at age ${age}`, () => {
      const gross = grossUpFromTakeHome(takeHome, age)
      const backToTakeHome = netDownFromGross(gross, age)
      expect(backToTakeHome).toBeCloseTo(takeHome, 0)
    })
  }
})

describe('getCpfEmployeeRateLabel', () => {
  it('returns "20%" for age 30', () => {
    expect(getCpfEmployeeRateLabel(30)).toBe('20%')
  })

  it('returns "18%" for age 58', () => {
    expect(getCpfEmployeeRateLabel(58)).toBe('18%')
  })

  it('returns "5%" for age 75', () => {
    expect(getCpfEmployeeRateLabel(75)).toBe('5%')
  })
})

describe('isAboveOwCeiling', () => {
  it('returns false for $4,800 take-home at age 30', () => {
    expect(isAboveOwCeiling(4800, 30)).toBe(false)
  })

  it('returns true for $7,000 take-home at age 30', () => {
    expect(isAboveOwCeiling(7000, 30)).toBe(true)
  })

  it('returns false at exactly the ceiling boundary', () => {
    expect(isAboveOwCeiling(6400, 30)).toBe(false)
  })
})
