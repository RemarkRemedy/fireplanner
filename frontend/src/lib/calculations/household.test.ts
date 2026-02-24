import { describe, it, expect } from 'vitest'
import {
  generateIncomeProjection,
  generateHouseholdIncomeProjection,
  DEFAULT_CAREER_PHASES,
} from './income'
import type { IncomeProjectionRow } from '@/lib/types'

describe('generateHouseholdIncomeProjection', () => {
  const baseParams = {
    salaryModel: 'simple' as const,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 40000,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    cpfHousingMode: 'none' as const,
    cpfHousingMonthly: 0,
    cpfMortgageYearsLeft: 0,
    cpfLifeStartAge: 65,
    cpfLifePlan: 'standard' as const,
    cpfRetirementSum: 'frs' as const,
  }

  it('combines projections from two persons', () => {
    const person1 = generateIncomeProjection({
      ...baseParams,
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      annualSalary: 60000,
      salaryGrowthRate: 0.03,
      inflation: 0.025,
      initialCpfOA: 50000,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
    })

    const person2 = generateIncomeProjection({
      ...baseParams,
      currentAge: 28,
      retirementAge: 65,
      lifeExpectancy: 85,
      annualSalary: 72000,
      salaryGrowthRate: 0.04,
      inflation: 0.025,
      initialCpfOA: 40000,
      initialCpfSA: 25000,
      initialCpfMA: 15000,
    })

    const result = generateHouseholdIncomeProjection({
      persons: [
        { personId: 'p1', projection: person1 },
        { personId: 'p2', projection: person2 },
      ],
      annualExpenses: 50000,
      inflation: 0.025,
    })

    expect(result.length).toBeGreaterThan(0)
    const firstRow = result[0]
    expect(firstRow.personData['p1']).toBeDefined()
    expect(firstRow.personData['p2']).toBeDefined()
    expect(firstRow.totalGross).toBeCloseTo(
      person1[0].totalGross + person2[0].totalGross,
      2
    )
  })

  it('uses provided inflation rate', () => {
    const person = generateIncomeProjection({
      ...baseParams,
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      annualSalary: 100000,
      salaryGrowthRate: 0.03,
      inflation: 0.03,
      initialCpfOA: 50000,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
    })

    const result = generateHouseholdIncomeProjection({
      persons: [{ personId: 'p1', projection: person }],
      annualExpenses: 40000,
      inflation: 0.03,
    })

    const year1 = result[1]
    const expectedExpenses = 40000 * Math.pow(1.03, 1)
    const expectedSavings = year1.totalNet - expectedExpenses
    expect(year1.totalAnnualSavings).toBeCloseTo(expectedSavings, 0)
  })

  it('aggregates CPFIS and CPF LIFE fields', () => {
    const person = generateIncomeProjection({
      ...baseParams,
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      annualSalary: 60000,
      salaryGrowthRate: 0.03,
      inflation: 0.025,
      initialCpfOA: 50000,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
    })

    const result = generateHouseholdIncomeProjection({
      persons: [{ personId: 'p1', projection: person }],
      annualExpenses: 50000,
      inflation: 0.025,
    })

    const firstRow = result[0]
    expect(firstRow.totalCpfisOA).toBeDefined()
    expect(firstRow.totalCpfisSA).toBeDefined()
    expect(firstRow.totalCpfisReturn).toBeDefined()
    expect(firstRow.totalCpfLifePayout).toBeDefined()
    expect(firstRow.totalCpfOaHousingDeduction).toBeDefined()
  })

  it('handles empty persons array', () => {
    const result = generateHouseholdIncomeProjection({
      persons: [],
      annualExpenses: 50000,
      inflation: 0.025,
    })
    expect(result).toEqual([])
  })

  it('extends to longest person lifespan', () => {
    const person1 = generateIncomeProjection({
      ...baseParams,
      currentAge: 30,
      retirementAge: 60,
      lifeExpectancy: 80,
      annualSalary: 60000,
      salaryGrowthRate: 0.03,
      inflation: 0.025,
      initialCpfOA: 50000,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
    })

    const person2 = generateIncomeProjection({
      ...baseParams,
      currentAge: 28,
      retirementAge: 60,
      lifeExpectancy: 90,
      annualSalary: 72000,
      salaryGrowthRate: 0.04,
      inflation: 0.025,
      initialCpfOA: 40000,
      initialCpfSA: 25000,
      initialCpfMA: 15000,
    })

    const result = generateHouseholdIncomeProjection({
      persons: [
        { personId: 'p1', projection: person1 },
        { personId: 'p2', projection: person2 },
      ],
      annualExpenses: 50000,
      inflation: 0.025,
    })

    expect(result.length).toBe(person2.length)
    const lastRow = result[result.length - 1]
    expect(lastRow.personData['p2']).toBeDefined()
  })
})
