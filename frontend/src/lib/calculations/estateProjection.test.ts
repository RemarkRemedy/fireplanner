import { describe, it, expect } from 'vitest'
import {
  projectNetEstate,
  type EstateProjectionInput,
  type EstateAdultInput,
  type EstateProjectionAtDeath,
} from './estateProjection'
import { DEFAULT_FUNERAL_COSTS, DEFAULT_LEGAL_ADMIN_COSTS } from '@/lib/data/estateCosts'

function makeAtDeath(overrides?: Partial<EstateProjectionAtDeath>): EstateProjectionAtDeath {
  return {
    liquidNW: 500_000,
    cpfOA: 50_000,
    cpfSA: 80_000,
    cpfMA: 30_000,
    cpfRA: 200_000,
    propertyValue: 800_000,
    mortgageBalance: 0,
    srsBalance: 100_000,
    ...overrides,
  }
}

function makeAdult(overrides?: Partial<EstateAdultInput>): EstateAdultInput {
  return {
    funeralCosts: 15_000,
    insuranceDeathCoverage: 500_000,
    nonMortgageDebtTotal: 0,
    ...overrides,
  }
}

describe('projectNetEstate', () => {
  it('computes correct breakdown for a simple single-adult case', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath(),
      adults: [makeAdult()],
    }
    const result = projectNetEstate(input)

    expect(result.portfolio).toBe(500_000)
    expect(result.cpfTotal).toBe(360_000) // 50k+80k+30k+200k
    expect(result.propertyValue).toBe(800_000)
    expect(result.srsBalance).toBe(100_000)
    expect(result.insurancePayouts).toBe(500_000)
    expect(result.grossEstate).toBe(2_260_000) // 500k+360k+800k+100k+500k

    expect(result.mortgageBalance).toBe(0)
    expect(result.nonMortgageDebts).toBe(0)
    expect(result.funeralCosts).toBe(15_000)
    expect(result.legalAdminCosts).toBe(DEFAULT_LEGAL_ADMIN_COSTS)
    expect(result.totalDeductions).toBe(20_000)

    expect(result.netEstate).toBe(2_240_000)
  })

  it('subtracts mortgage balance from estate', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath({ mortgageBalance: 200_000 }),
      adults: [makeAdult()],
    }
    const result = projectNetEstate(input)
    expect(result.mortgageBalance).toBe(200_000)
    expect(result.totalDeductions).toBe(220_000) // 200k mortgage + 15k funeral + 5k legal
    expect(result.netEstate).toBe(2_260_000 - 220_000)
  })

  it('subtracts non-mortgage debts from estate', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath(),
      adults: [makeAdult({ nonMortgageDebtTotal: 50_000 })],
    }
    const result = projectNetEstate(input)
    expect(result.nonMortgageDebts).toBe(50_000)
    expect(result.totalDeductions).toBe(70_000) // 50k debt + 15k funeral + 5k legal
  })

  it('falls back to DEFAULT_FUNERAL_COSTS when adult has 0', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath(),
      adults: [makeAdult({ funeralCosts: 0 })],
    }
    const result = projectNetEstate(input)
    expect(result.funeralCosts).toBe(DEFAULT_FUNERAL_COSTS)
  })

  it('uses adult-specified funeral costs when non-zero', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath(),
      adults: [makeAdult({ funeralCosts: 25_000 })],
    }
    const result = projectNetEstate(input)
    expect(result.funeralCosts).toBe(25_000)
  })

  it('accepts legal admin cost override', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath(),
      adults: [makeAdult()],
      legalAdminCosts: 10_000,
    }
    const result = projectNetEstate(input)
    expect(result.legalAdminCosts).toBe(10_000)
  })

  it('sums across multiple adults for household plans', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath(),
      adults: [
        makeAdult({ insuranceDeathCoverage: 300_000, funeralCosts: 15_000, nonMortgageDebtTotal: 10_000 }),
        makeAdult({ insuranceDeathCoverage: 200_000, funeralCosts: 20_000, nonMortgageDebtTotal: 5_000 }),
      ],
    }
    const result = projectNetEstate(input)
    expect(result.insurancePayouts).toBe(500_000)
    expect(result.funeralCosts).toBe(35_000) // 15k + 20k
    expect(result.nonMortgageDebts).toBe(15_000)
  })

  it('handles zero portfolio and zero property gracefully', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath({ liquidNW: 0, propertyValue: 0, srsBalance: 0 }),
      adults: [makeAdult({ insuranceDeathCoverage: 0 })],
    }
    const result = projectNetEstate(input)
    expect(result.grossEstate).toBe(360_000) // only CPF
    expect(result.netEstate).toBe(340_000) // 360k - 15k funeral - 5k legal
  })

  it('can produce a negative net estate when debts exceed assets', () => {
    const input: EstateProjectionInput = {
      atDeath: makeAtDeath({
        liquidNW: 0,
        propertyValue: 0,
        srsBalance: 0,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        mortgageBalance: 500_000,
      }),
      adults: [makeAdult({ insuranceDeathCoverage: 0, nonMortgageDebtTotal: 100_000 })],
    }
    const result = projectNetEstate(input)
    expect(result.grossEstate).toBe(0)
    expect(result.totalDeductions).toBe(620_000) // 500k mortgage + 100k debt + 15k funeral + 5k legal
    expect(result.netEstate).toBe(-620_000)
  })
})
