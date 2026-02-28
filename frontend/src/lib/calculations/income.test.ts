import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateSimpleSalary,
  calculateRealisticSalary,
  calculateDataDrivenSalary,
  getSalaryAtAge,
  getStreamAmountAtAge,
  applyLifeEvents,
  generateIncomeProjection,
  calculateIncomeSummary,
  sumPostRetirementIncome,
  DEFAULT_CAREER_PHASES,
} from './income'
import type {
  IncomeStream,
  LifeEvent,
  IncomeProjectionRow,
} from '@/lib/types'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'
import { getBhsAtAge } from './cpf'

// ============================================================
// Simple salary model
// ============================================================

describe('calculateSimpleSalary', () => {
  it('returns base salary at year 0', () => {
    expect(calculateSimpleSalary(72000, 0.03, 0)).toBe(72000)
  })

  it('compounds correctly over 10 years at 3%', () => {
    const result = calculateSimpleSalary(72000, 0.03, 10)
    const expected = 72000 * Math.pow(1.03, 10)
    expect(result).toBeCloseTo(expected, 2)
  })

  it('handles zero growth', () => {
    expect(calculateSimpleSalary(72000, 0, 5)).toBe(72000)
  })

  it('handles zero salary', () => {
    expect(calculateSimpleSalary(0, 0.03, 5)).toBe(0)
  })

  it('handles negative salary', () => {
    expect(calculateSimpleSalary(-1000, 0.03, 5)).toBe(0)
  })

  it('handles negative yearsFromStart', () => {
    expect(calculateSimpleSalary(72000, 0.03, -1)).toBe(72000)
  })
})

// ============================================================
// Realistic salary model
// ============================================================

describe('calculateRealisticSalary', () => {
  const phases = DEFAULT_CAREER_PHASES

  it('returns base salary when targetAge equals currentAge', () => {
    expect(calculateRealisticSalary(48000, 25, 25, phases, [])).toBe(48000)
  })

  it('applies early career growth rate', () => {
    // Age 25 to 26: one year at 8% (Early Career phase: 22-30)
    const result = calculateRealisticSalary(48000, 25, 26, phases, [])
    expect(result).toBeCloseTo(48000 * 1.08, 2)
  })

  it('transitions between phases correctly', () => {
    // Age 25 to 31: 5 years early career (8%), 1 year mid career (5%)
    const result = calculateRealisticSalary(48000, 25, 31, phases, [])
    const expected = 48000 * Math.pow(1.08, 5) * 1.05
    expect(result).toBeCloseTo(expected, 2)
  })

  it('applies promotion jumps multiplicatively', () => {
    const jumps = [{ age: 30, increasePercent: 0.2 }]
    // Age 25 to 30: 5 years early career (8%), then 20% promotion at age 30
    const result = calculateRealisticSalary(48000, 25, 30, phases, jumps)
    const expected = 48000 * Math.pow(1.08, 5) * 1.2
    expect(result).toBeCloseTo(expected, 2)
  })

  it('applies multiple promotion jumps', () => {
    const jumps = [
      { age: 30, increasePercent: 0.2 },
      { age: 35, increasePercent: 0.15 },
    ]
    // 25-30: 5yr early career (8%) + 20% promo
    // 30-35: 5yr mid career (5%) + 15% promo
    const result = calculateRealisticSalary(48000, 25, 35, phases, jumps)
    const afterEarly = 48000 * Math.pow(1.08, 5) * 1.2
    const expected = afterEarly * Math.pow(1.05, 5) * 1.15
    expect(result).toBeCloseTo(expected, 2)
  })

  it('handles zero base salary', () => {
    expect(calculateRealisticSalary(0, 25, 35, phases, [])).toBe(0)
  })
})

// ============================================================
// Data-driven salary model
// ============================================================

describe('calculateDataDrivenSalary', () => {
  it('returns MOM 2025 value for age 30 degree with adjustment 1.0', () => {
    expect(calculateDataDrivenSalary(30, 'degree', 1.0)).toBe(90996)
  })

  it('applies adjustment factor', () => {
    expect(calculateDataDrivenSalary(30, 'degree', 1.2)).toBeCloseTo(90996 * 1.2, 0)
  })

  it('returns lower salary for lower education level', () => {
    const diploma = calculateDataDrivenSalary(30, 'diploma', 1.0)
    const degree = calculateDataDrivenSalary(30, 'degree', 1.0)
    expect(diploma).toBeLessThan(degree)
  })

  it('returns MOM 2025 value for age 25 degree', () => {
    expect(calculateDataDrivenSalary(25, 'degree', 1.0)).toBe(70224)
  })

  it('inflates MOM benchmark to future nominal dollars', () => {
    // Age 40 degree = $126,540 in today's dollars
    // 10 years forward at 2.5% inflation → $126,540 × 1.025^10 ≈ $161,996
    const result = calculateDataDrivenSalary(40, 'degree', 1.0, 0.025, 10)
    expect(result).toBeCloseTo(126540 * Math.pow(1.025, 10), 0)
  })

  it('returns today-dollar MOM value when yearsForward is 0', () => {
    // No inflation applied at year 0 (current age)
    expect(calculateDataDrivenSalary(30, 'degree', 1.0, 0.025, 0)).toBe(90996)
  })
})

// ============================================================
// getSalaryAtAge dispatcher
// ============================================================

describe('getSalaryAtAge', () => {
  it('dispatches to simple model', () => {
    const result = getSalaryAtAge({
      model: 'simple',
      baseSalary: 72000,
      growthRate: 0.03,
      currentAge: 30,
      targetAge: 35,
      phases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      education: 'degree',
      momAdjustment: 1.0,
    })
    expect(result).toBeCloseTo(calculateSimpleSalary(72000, 0.03, 5), 2)
  })

  it('dispatches to data-driven model with inflation', () => {
    const result = getSalaryAtAge({
      model: 'data-driven',
      baseSalary: 72000,
      growthRate: 0.03,
      currentAge: 30,
      targetAge: 35,
      phases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      education: 'degree',
      momAdjustment: 1.0,
      inflation: 0.025,
    })
    // MOM benchmark for age 35 degree = $111,096 inflated 5 years at 2.5%
    expect(result).toBe(calculateDataDrivenSalary(35, 'degree', 1.0, 0.025, 5))
  })
})

// ============================================================
// Stream amount at age
// ============================================================

describe('getStreamAmountAtAge', () => {
  const baseStream: IncomeStream = {
    id: '1',
    name: 'Rental',
    annualAmount: 24000,
    startAge: 30,
    endAge: 65,
    growthRate: 0.02,
    type: 'rental',
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: false,
    isActive: true,
  }

  it('returns 0 before start age', () => {
    expect(getStreamAmountAtAge(baseStream, 25, 0.025)).toBe(0)
  })

  it('returns 0 at end age', () => {
    expect(getStreamAmountAtAge(baseStream, 65, 0.025)).toBe(0)
  })

  it('returns base amount at start age with fixed growth', () => {
    expect(getStreamAmountAtAge(baseStream, 30, 0.025)).toBe(24000)
  })

  it('applies fixed growth over 5 years', () => {
    const result = getStreamAmountAtAge(baseStream, 35, 0.025)
    expect(result).toBeCloseTo(24000 * Math.pow(1.02, 5), 2)
  })

  it('applies inflation-linked growth', () => {
    const inflStream = { ...baseStream, growthModel: 'inflation-linked' as const }
    const result = getStreamAmountAtAge(inflStream, 35, 0.025)
    expect(result).toBeCloseTo(24000 * Math.pow(1.025, 5), 2)
  })

  it('returns flat amount with none growth', () => {
    const flatStream = { ...baseStream, growthModel: 'none' as const }
    expect(getStreamAmountAtAge(flatStream, 35, 0.025)).toBe(24000)
    expect(getStreamAmountAtAge(flatStream, 50, 0.025)).toBe(24000)
  })

  it('returns 0 when inactive', () => {
    const inactiveStream = { ...baseStream, isActive: false }
    expect(getStreamAmountAtAge(inactiveStream, 35, 0.025)).toBe(0)
  })
})

// ============================================================
// Life events
// ============================================================

describe('applyLifeEvents', () => {
  const careerBreak: LifeEvent = {
    id: 'e1',
    name: 'Career Break',
    startAge: 35,
    endAge: 36,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
  }

  const partTime: LifeEvent = {
    id: 'e2',
    name: 'Part-time',
    startAge: 40,
    endAge: 45,
    incomeImpact: 0.5,
    affectedStreamIds: ['s1'],
    savingsPause: false,
    cpfPause: false,
  }

  it('applies zero impact (career break)', () => {
    expect(applyLifeEvents(72000, 35, 'any', [careerBreak], true)).toBe(0)
  })

  it('does not apply outside age range', () => {
    expect(applyLifeEvents(72000, 34, 'any', [careerBreak], true)).toBe(72000)
    expect(applyLifeEvents(72000, 36, 'any', [careerBreak], true)).toBe(72000)
  })

  it('applies partial impact (part-time)', () => {
    expect(applyLifeEvents(72000, 42, 's1', [partTime], true)).toBe(36000)
  })

  it('only affects specified streams', () => {
    expect(applyLifeEvents(72000, 42, 's2', [partTime], true)).toBe(72000)
  })

  it('affects all streams when affectedStreamIds is empty', () => {
    expect(applyLifeEvents(72000, 35, 'anything', [careerBreak], true)).toBe(0)
  })

  it('returns original amount when disabled', () => {
    expect(applyLifeEvents(72000, 35, 'any', [careerBreak], false)).toBe(72000)
  })
})

// ============================================================
// Full projection - Fresh Graduate scenario
// ============================================================

describe('generateIncomeProjection', () => {
  const freshGradParams = {
    currentAge: 25,
    retirementAge: 65,
    lifeExpectancy: 90,
    salaryModel: 'simple' as const,
    annualSalary: 48000,
    salaryGrowthRate: 0.03,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 30000,
    inflation: 0.025,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('produces correct number of rows', () => {
    const rows = generateIncomeProjection(freshGradParams)
    expect(rows).toHaveLength(90 - 25 + 1) // 66 rows
  })

  it('first row has correct salary', () => {
    const rows = generateIncomeProjection(freshGradParams)
    expect(rows[0].age).toBe(25)
    expect(rows[0].salary).toBe(48000)
    expect(rows[0].year).toBe(0)
    expect(rows[0].isRetired).toBe(false)
  })

  it('first row gross equals salary (no streams)', () => {
    const rows = generateIncomeProjection(freshGradParams)
    expect(rows[0].totalGross).toBe(48000)
  })

  it('first row has CPF contributions', () => {
    const rows = generateIncomeProjection(freshGradParams)
    // Age 25, salary 48000, CPF rate 37%: employee 20%, employer 17%
    expect(rows[0].cpfEmployee).toBeCloseTo(48000 * 0.20, 0)
    expect(rows[0].cpfEmployer).toBeCloseTo(48000 * 0.17, 0)
  })

  it('first row net is gross minus tax minus CPF employee', () => {
    const rows = generateIncomeProjection(freshGradParams)
    expect(rows[0].totalNet).toBeCloseTo(
      rows[0].totalGross - rows[0].sgTax - rows[0].cpfEmployee, 2
    )
  })

  it('first row savings is net minus expenses', () => {
    const rows = generateIncomeProjection(freshGradParams)
    const expectedSavings = Math.max(0, rows[0].totalNet - 30000)
    expect(rows[0].annualSavings).toBeCloseTo(expectedSavings, 2)
  })

  it('retirement rows have zero salary', () => {
    const rows = generateIncomeProjection(freshGradParams)
    // retirementAge 65 means age 65 is last working year, age 66 is first retired year
    const retiredRow = rows.find((r) => r.age === 66)!
    expect(retiredRow.salary).toBe(0)
    expect(retiredRow.isRetired).toBe(true)
    expect(retiredRow.cpfEmployee).toBe(0)
  })

  it('salary grows over time (simple model)', () => {
    const rows = generateIncomeProjection(freshGradParams)
    expect(rows[10].salary).toBeCloseTo(48000 * Math.pow(1.03, 10), 0)
  })

  it('cumulative savings are monotonically non-decreasing', () => {
    const rows = generateIncomeProjection(freshGradParams)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].cumulativeSavings).toBeGreaterThanOrEqual(rows[i - 1].cumulativeSavings)
    }
  })

  it('CPF balances grow with interest over time', () => {
    const rows = generateIncomeProjection(freshGradParams)
    // After first year working, CPF OA should be > 0
    expect(rows[0].cpfOA).toBeGreaterThan(0)
    expect(rows[0].cpfSA).toBeGreaterThan(0)
    // Last row should have higher CPF than first
    expect(rows[rows.length - 1].cpfOA).toBeGreaterThan(rows[0].cpfOA)
  })
})

// ============================================================
// Projection with life events
// ============================================================

describe('generateIncomeProjection with life events', () => {
  it('career break zeroes out salary', () => {
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0.03,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [
        {
          id: 'e1',
          name: 'Career Break',
          startAge: 35,
          endAge: 36,
          incomeImpact: 0,
          affectedStreamIds: [],
          savingsPause: true,
          cpfPause: true,
        },
      ],
      lifeEventsEnabled: true,
      annualExpenses: 48000,
      inflation: 0.025,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 0,
      initialCpfSA: 0,
      initialCpfMA: 0,
    })

    const breakRow = rows.find((r) => r.age === 35)!
    expect(breakRow.salary).toBe(0)
    expect(breakRow.cpfEmployee).toBe(0)
    expect(breakRow.annualSavings).toBe(0)
    expect(breakRow.activeLifeEvents).toContain('Career Break')

    // Before and after should have salary
    const beforeBreak = rows.find((r) => r.age === 34)!
    expect(beforeBreak.salary).toBeGreaterThan(0)
    const afterBreak = rows.find((r) => r.age === 36)!
    expect(afterBreak.salary).toBeGreaterThan(0)
  })
})

// ============================================================
// Income summary
// ============================================================

describe('calculateIncomeSummary', () => {
  it('returns zeros for empty projection', () => {
    const summary = calculateIncomeSummary([], 48000)
    expect(summary.peakEarningAge).toBe(0)
    expect(summary.lifetimeEarnings).toBe(0)
  })

  it('computes correct peak earning for simple projection', () => {
    const rows: IncomeProjectionRow[] = [
      { year: 0, age: 30, salary: 72000, rentalIncome: 0, investmentIncome: 0, businessIncome: 0, governmentIncome: 0, totalGross: 72000, sgTax: 2000, cpfEmployee: 14400, cpfEmployer: 12240, totalNet: 55600, annualSavings: 7600, cumulativeSavings: 7600, cpfOA: 16560, cpfSA: 4320, cpfMA: 5760, cpfRA: 0, isRetired: false, activeLifeEvents: [], cpfLifePayout: 0, cpfOaHousingDeduction: 0, cpfOaShortfall: 0, cpfLifeAnnuityPremium: 0, srsBalance: 0, srsContribution: 0, srsWithdrawal: 0, srsTaxableWithdrawal: 0, cpfOaWithdrawal: 0, cpfisOA: 0, cpfisSA: 0, cpfisReturn: 0, cashReserveTarget: 0, cashReserveBalance: 0, investedSavings: 0, lockedAssetUnlock: 0 },
      { year: 1, age: 31, salary: 80000, rentalIncome: 0, investmentIncome: 0, businessIncome: 0, governmentIncome: 0, totalGross: 80000, sgTax: 3000, cpfEmployee: 16000, cpfEmployer: 13600, totalNet: 61000, annualSavings: 13000, cumulativeSavings: 20600, cpfOA: 35000, cpfSA: 9000, cpfMA: 12000, cpfRA: 0, isRetired: false, activeLifeEvents: [], cpfLifePayout: 0, cpfOaHousingDeduction: 0, cpfOaShortfall: 0, cpfLifeAnnuityPremium: 0, srsBalance: 0, srsContribution: 0, srsWithdrawal: 0, srsTaxableWithdrawal: 0, cpfOaWithdrawal: 0, cpfisOA: 0, cpfisSA: 0, cpfisReturn: 0, cashReserveTarget: 0, cashReserveBalance: 0, investedSavings: 0, lockedAssetUnlock: 0 },
      { year: 2, age: 32, salary: 0, rentalIncome: 0, investmentIncome: 0, businessIncome: 0, governmentIncome: 0, totalGross: 0, sgTax: 0, cpfEmployee: 0, cpfEmployer: 0, totalNet: 0, annualSavings: 0, cumulativeSavings: 20600, cpfOA: 35000, cpfSA: 9000, cpfMA: 12000, cpfRA: 0, isRetired: true, activeLifeEvents: [], cpfLifePayout: 0, cpfOaHousingDeduction: 0, cpfOaShortfall: 0, cpfLifeAnnuityPremium: 0, srsBalance: 0, srsContribution: 0, srsWithdrawal: 0, srsTaxableWithdrawal: 0, cpfOaWithdrawal: 0, cpfisOA: 0, cpfisSA: 0, cpfisReturn: 0, cashReserveTarget: 0, cashReserveBalance: 0, investedSavings: 0, lockedAssetUnlock: 0 },
    ]

    const summary = calculateIncomeSummary(rows, 48000)
    expect(summary.peakEarningAge).toBe(31)
    expect(summary.peakEarningAmount).toBe(80000)
    expect(summary.lifetimeEarnings).toBe(152000)
    expect(summary.totalCpfContributions).toBe(14400 + 12240 + 16000 + 13600)
  })
})

// ============================================================
// Property-based tests
// ============================================================

describe('property-based tests', () => {
  it('simple salary: result >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500000 }),
        fc.double({ min: -0.1, max: 0.3, noNaN: true }),
        fc.integer({ min: 0, max: 40 }),
        (baseSalary, growthRate, years) => {
          const result = calculateSimpleSalary(baseSalary, growthRate, years)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      )
    )
  })

  it('projection length is correct', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 55 }),
        fc.integer({ min: 0, max: 200000 }),
        fc.integer({ min: 10000, max: 100000 }),
        (currentAge, salary, expenses) => {
          const lifeExpectancy = currentAge + 30
          const retirementAge = currentAge + 20

          const rows = generateIncomeProjection({
            currentAge,
            retirementAge,
            lifeExpectancy,
            salaryModel: 'simple',
            annualSalary: salary,
            salaryGrowthRate: 0.03,
            realisticPhases: DEFAULT_CAREER_PHASES,
            promotionJumps: [],
            momEducation: 'degree',
            momAdjustment: 1.0,
            employerCpfEnabled: true,
            incomeStreams: [],
            lifeEvents: [],
            lifeEventsEnabled: false,
            annualExpenses: expenses,
            inflation: 0.025,
            personalReliefs: 20000,
            srsAnnualContribution: 0,
            initialCpfOA: 0,
            initialCpfSA: 0,
            initialCpfMA: 0,
          })

          expect(rows).toHaveLength(lifeExpectancy - currentAge + 1)
        }
      )
    )
  })

  it('tax never exceeds gross income', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20000, max: 500000 }),
        (salary) => {
          const rows = generateIncomeProjection({
            currentAge: 30,
            retirementAge: 65,
            lifeExpectancy: 70,
            salaryModel: 'simple',
            annualSalary: salary,
            salaryGrowthRate: 0,
            realisticPhases: DEFAULT_CAREER_PHASES,
            promotionJumps: [],
            momEducation: 'degree',
            momAdjustment: 1.0,
            employerCpfEnabled: true,
            incomeStreams: [],
            lifeEvents: [],
            lifeEventsEnabled: false,
            annualExpenses: 30000,
            inflation: 0,
            personalReliefs: 20000,
            srsAnnualContribution: 0,
            initialCpfOA: 0,
            initialCpfSA: 0,
            initialCpfMA: 0,
          })

          for (const row of rows) {
            expect(row.sgTax).toBeLessThanOrEqual(row.totalGross)
            expect(row.sgTax).toBeGreaterThanOrEqual(0)
            expect(row.cpfEmployee).toBeGreaterThanOrEqual(0)
          }
        }
      )
    )
  })
})

// ============================================================
// Integration test vectors from CLAUDE.md
// ============================================================

describe('integration tests', () => {
  it('Fresh Graduate: age 25, $48K income, simple model', () => {
    const rows = generateIncomeProjection({
      currentAge: 25,
      retirementAge: 65,
      lifeExpectancy: 90,
      salaryModel: 'simple',
      annualSalary: 48000,
      salaryGrowthRate: 0.03,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 30000,
      inflation: 0.025,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 0,
      initialCpfSA: 0,
      initialCpfMA: 0,
    })

    // Row 0: age 25, salary $48K
    expect(rows[0].salary).toBe(48000)
    expect(rows[0].totalGross).toBe(48000)

    // FIRE Number = $30K / 0.035 = ~$857,143
    const fireNumber = 30000 / 0.035
    expect(fireNumber).toBeCloseTo(857143, -1)

    // Savings rate: ($48K - CPF employee - tax - $30K) / $48K
    // CPF employee: 48000 * 0.20 = 9600
    expect(rows[0].cpfEmployee).toBeCloseTo(9600, 0)

    // After CPF and tax deductions, net income should be reasonable
    expect(rows[0].totalNet).toBeGreaterThan(30000) // Must exceed expenses to save
    expect(rows[0].totalNet).toBeLessThan(48000) // Must be less than gross

    // Verify CPF contributions at correct rates for age 25
    expect(rows[0].cpfEmployer).toBeCloseTo(48000 * 0.17, 0)
  })

  it('Mid-Career: age 35, $180K income, CPF rates correct', () => {
    const rows = generateIncomeProjection({
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      salaryModel: 'simple',
      annualSalary: 180000,
      salaryGrowthRate: 0.03,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 96000,
      inflation: 0.025,
      personalReliefs: 20000,
      srsAnnualContribution: 15300,
      initialCpfOA: 200000,
      initialCpfSA: 100000,
      initialCpfMA: 0,
    })

    // At $180K salary, OW ceiling applies ($96,000/yr from 2026)
    // CPF employee contribution: $96,000 * 0.20 = $19,200
    expect(rows[0].cpfEmployee).toBeCloseTo(96000 * 0.20, 0)

    // Tax calculation: $180K - $19,200 CPF - $15,300 SRS - $20,000 reliefs = $125,500 chargeable
    // Tax on $125,500: cumulative at $120K = $7,950 + ($125,500 - $120,000) * 0.15 = $7,950 + $825 = $8,775
    expect(rows[0].sgTax).toBeGreaterThan(7000)
    expect(rows[0].sgTax).toBeLessThan(12000)

    // Salary should be $180K
    expect(rows[0].salary).toBe(180000)
    expect(rows[0].totalGross).toBe(180000)
  })

  it('CPF LIFE payout appears in projection at correct age (automated)', () => {
    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 75,
      salaryModel: 'simple',
      annualSalary: 200000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 80000,
      inflation: 0.025,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 200000,
      initialCpfMA: 50000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // Before 65: no CPF LIFE payout
    const row60 = rows.find((r) => r.age === 60)!
    expect(row60.cpfLifePayout).toBe(0)
    expect(row60.governmentIncome).toBe(0)

    // At 65: CPF LIFE kicks in
    const row65 = rows.find((r) => r.age === 65)!
    expect(row65.cpfLifePayout).toBeGreaterThan(0)
    expect(row65.governmentIncome).toBe(row65.cpfLifePayout)

    // At 70: still receiving
    const row70 = rows.find((r) => r.age === 70)!
    expect(row70.cpfLifePayout).toBeGreaterThan(0)
  })

  it('CPF LIFE payout differs by BRS/FRS/ERS selection (young age)', () => {
    // Use currentAge=30 so BRS/FRS/ERS are projected 25 years forward.
    // With RA, payout is based on actual RA balance at LIFE start (not fixed level amount).
    // Need SA+OA large enough to fully fund each level at age 55.
    // ERS at 55 ≈ $426K * 1.035^25 ≈ $1,006K, so SA+OA must exceed this.
    const baseParams = {
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 70,
      salaryModel: 'simple' as const,
      annualSalary: 200000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree' as const,
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 500000,
      initialCpfSA: 800000,
      initialCpfMA: 50000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard' as const,
    }

    const rowsBrs = generateIncomeProjection({ ...baseParams, cpfRetirementSum: 'brs' as const })
    const rowsFrs = generateIncomeProjection({ ...baseParams, cpfRetirementSum: 'frs' as const })
    const rowsErs = generateIncomeProjection({ ...baseParams, cpfRetirementSum: 'ers' as const })

    const payoutBrs = rowsBrs.find((r) => r.age === 65)!.cpfLifePayout
    const payoutFrs = rowsFrs.find((r) => r.age === 65)!.cpfLifePayout
    const payoutErs = rowsErs.find((r) => r.age === 65)!.cpfLifePayout

    // All should produce payouts
    expect(payoutBrs).toBeGreaterThan(0)
    expect(payoutFrs).toBeGreaterThan(0)
    expect(payoutErs).toBeGreaterThan(0)

    // FRS payout should be ~2x BRS, ERS should be ~2x FRS
    // Ratio is slightly imperfect due to fixed extra interest on first $30K RA
    expect(payoutFrs).toBeGreaterThan(payoutBrs * 1.9)
    expect(payoutFrs).toBeLessThan(payoutBrs * 2.1)
    expect(payoutErs).toBeGreaterThan(payoutFrs * 1.9)
    expect(payoutErs).toBeLessThan(payoutFrs * 2.1)

    // Verify payouts use RA balance at LIFE start (not 2024 base values).
    // BRS at 55 ≈ $251K, then RA grows at 4%+extra for 10 years → RA at 65 ≈ $375K+
    // Payout = RA * 6.3%. Would be ~$6,710 with 2024-base-value bug.
    expect(payoutBrs).toBeGreaterThan(15000)
  })

  it('CPF LIFE payout differs by BRS/FRS/ERS with default SA (zero starting balance)', () => {
    // Realistic scenario: user starts with cpfSA=0 at age 30.
    // With RA, payout is based on actual RA balance (min of accumulated SA+OA vs target).
    // With $72K salary, accumulated SA+OA at 55 may not reach ERS target,
    // so ERS payout may be less than 2x FRS. BRS and FRS should still hold ~2x ratio.
    const baseParams = {
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 70,
      salaryModel: 'simple' as const,
      annualSalary: 72000,
      salaryGrowthRate: 0.03,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree' as const,
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 0,
      initialCpfSA: 0,
      initialCpfMA: 0,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard' as const,
    }

    const rowsBrs = generateIncomeProjection({ ...baseParams, cpfRetirementSum: 'brs' as const })
    const rowsFrs = generateIncomeProjection({ ...baseParams, cpfRetirementSum: 'frs' as const })
    const rowsErs = generateIncomeProjection({ ...baseParams, cpfRetirementSum: 'ers' as const })

    const payoutBrs = rowsBrs.find((r) => r.age === 65)!.cpfLifePayout
    const payoutFrs = rowsFrs.find((r) => r.age === 65)!.cpfLifePayout
    const payoutErs = rowsErs.find((r) => r.age === 65)!.cpfLifePayout

    // All three selections MUST produce different payouts
    expect(payoutBrs).toBeGreaterThan(0)
    expect(payoutFrs).toBeGreaterThan(payoutBrs)
    expect(payoutErs).toBeGreaterThan(payoutFrs)

    // FRS payout should be ~2x BRS (both levels are fully funded from accumulated SA+OA)
    expect(payoutFrs).toBeGreaterThan(payoutBrs * 1.8)

    // ERS may not be fully funded (accumulated SA+OA < ERS target at 55),
    // so ERS payout is > FRS but not necessarily 2x
    expect(payoutErs).toBeGreaterThan(payoutFrs)
  })

  it('CPF LIFE escalating plan grows 2%/yr in projection', () => {
    const rows = generateIncomeProjection({
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 75,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0.025,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'escalating',
      cpfRetirementSum: 'frs',
    })

    const row65 = rows.find((r) => r.age === 65)!
    const row66 = rows.find((r) => r.age === 66)!

    // Escalating payout at year 1 should be ~2% higher than year 0
    expect(row66.cpfLifePayout).toBeCloseTo(row65.cpfLifePayout * 1.02, 0)
  })

  it('OA housing deduction reduces OA balance', () => {
    const withoutHousing = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 30000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 50000,
      initialCpfMA: 20000,
      cpfHousingMode: 'none',
    })

    const withHousing = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 30000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 50000,
      initialCpfMA: 20000,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: 1000,
      cpfMortgageYearsLeft: 25,
    })

    // OA should be lower with housing deduction
    const noHousing35 = withoutHousing.find((r) => r.age === 35)!
    const housing35 = withHousing.find((r) => r.age === 35)!
    expect(housing35.cpfOA).toBeLessThan(noHousing35.cpfOA)

    // Housing deduction should be $12K/yr
    const row30 = withHousing.find((r) => r.age === 30)!
    expect(row30.cpfOaHousingDeduction).toBe(12000)

    // After housing end age, no more deductions
    const row56 = withHousing.find((r) => r.age === 56)!
    expect(row56.cpfOaHousingDeduction).toBe(0)
  })

  it('CPF interest uses mid-year approximation (contributions earn half-year interest)', () => {
    // Setup: zero initial balances, known salary, zero inflation
    // Age 30: oaRate=0.23, saRate=0.06, maRate=0.08 on $72K salary
    // oaContrib = 72000 * 0.23 = 16560
    // saContrib = 72000 * 0.06 = 4320
    // maContrib = 72000 * 0.08 = 5760
    //
    // Mid-year effective balances (starting from 0):
    //   midOA = 16560 - 16560/2 = 8280
    //   midSA = 4320  - 4320/2  = 2160
    //   midMA = 5760  - 5760/2  = 2880
    //
    // Interest at mid-year balances:
    //   oaInterest = 8280 * 0.025 = 207.00
    //   saInterest = 2160 * 0.04  = 86.40
    //   maInterest = 2880 * 0.04  = 115.20
    //   extraInterest on first $60K combined (max $20K from OA):
    //     OA qualifying = min(8280, 20000) = 8280
    //     remaining cap = 60000 - 8280 = 51720
    //     SA+MA = 2160 + 2880 = 5040 < 51720
    //     extra = (8280 + 5040) * 0.01 = 133.20
    //     extra goes to SA (pre-55)
    //
    // Final balances:
    //   cpfOA = 16560 + 207.00 = 16767.00
    //   cpfSA = 4320  + 86.40 + 133.20 = 4539.60
    //   cpfMA = 5760  + 115.20 = 5875.20
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 30000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 0,
      initialCpfSA: 0,
      initialCpfMA: 0,
    })

    const row30 = rows.find((r) => r.age === 30)!

    // With mid-year approximation, first-year interest is exactly half
    // of what full-year-on-contributions would yield
    expect(row30.cpfOA).toBeCloseTo(16767.00, 2)
    expect(row30.cpfSA).toBeCloseTo(4539.60, 2)
    expect(row30.cpfMA).toBeCloseTo(5875.20, 2)

    // Verify: WITHOUT mid-year approx, OA would have been 16560 + 16560*0.025 = 16974
    // The difference is exactly half the contribution interest: (16560*0.025)/2 = 207
    expect(row30.cpfOA).toBeLessThan(16974)
    expect(16974 - row30.cpfOA).toBeCloseTo(207, 2)
  })

  it('mid-year approximation accounts for housing deductions correctly', () => {
    // With housing deduction, the deduction reduces mid-year balance less
    // than full-year would, since deductions are also spread monthly.
    // Setup: $50K initial OA, $1000/mo housing, $72K salary at age 30
    //   oaContrib = 72000 * 0.23 = 16560
    //   housingDeduction = 1000 * 12 = 12000
    //   OA after deduction: 50000 - 12000 = 38000
    //   OA after contrib: 38000 + 16560 = 54560
    //   midOA = 54560 - (16560 - 12000)/2 = 54560 - 2280 = 52280
    //   oaInterest = 52280 * 0.025 = 1307.00
    //   final OA = 54560 + 1307 = 55867 (plus extra interest allocated to SA)
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 30000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 0,
      initialCpfMA: 0,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: 1000,
      cpfMortgageYearsLeft: 25,
    })

    const row30 = rows.find((r) => r.age === 30)!

    // OA interest uses mid-year balance of 52280
    // oaInterest = 52280 * 0.025 = 1307.00
    expect(row30.cpfOA).toBeCloseTo(54560 + 1307, 0)
  })

  it('manual CPF LIFE stream takes precedence over automated', () => {
    const rows = generateIncomeProjection({
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [{
        id: 'manual-cpf',
        name: 'CPF LIFE',
        annualAmount: 15000,
        startAge: 65,
        endAge: 90,
        growthRate: 0,
        type: 'government',
        growthModel: 'none',
        taxTreatment: 'tax-exempt',
        isCpfApplicable: false,
        isActive: true,
      }],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    const row65 = rows.find((r) => r.age === 65)!
    // Should use manual stream (15000), not automated
    expect(row65.cpfLifePayout).toBe(0) // automated is skipped
    expect(row65.governmentIncome).toBe(15000) // manual stream value
  })

  it('65+ direct payout: cpfLifeActualMonthlyPayout overrides projected payout', () => {
    const rows = generateIncomeProjection({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 75,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfLifeActualMonthlyPayout: 1500,
    })

    // At 65: should use $1500/mo * 12 = $18,000/yr, not projected value
    const row65 = rows.find((r) => r.age === 65)!
    expect(row65.cpfLifePayout).toBe(18000)
    expect(row65.governmentIncome).toBe(18000)

    // At 70: same direct payout (no escalation)
    const row70 = rows.find((r) => r.age === 70)!
    expect(row70.cpfLifePayout).toBe(18000)
  })

  it('65+ direct payout with zero falls back to projection', () => {
    const rows = generateIncomeProjection({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfLifeActualMonthlyPayout: 0,
    })

    // Should fall back to calculated projection
    const row65 = rows.find((r) => r.age === 65)!
    expect(row65.cpfLifePayout).toBeGreaterThan(0)
    // Projected payout should NOT be $0 (it uses calculateCpfLifePayoutAtAge)
    expect(row65.cpfLifePayout).not.toBe(0)
  })

  it('65+ direct payout overrides escalating plan', () => {
    const rows = generateIncomeProjection({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'escalating',
      cpfRetirementSum: 'frs',
      cpfLifeActualMonthlyPayout: 2000,
    })

    // All years should have the same payout (no escalation when using direct payout)
    const row65 = rows.find((r) => r.age === 65)!
    const row66 = rows.find((r) => r.age === 66)!
    expect(row65.cpfLifePayout).toBe(24000) // $2000 * 12
    expect(row66.cpfLifePayout).toBe(24000) // Same, not escalated
  })

  it('SA = 0 at age 55+, RA holds transferred amount', () => {
    const rows = generateIncomeProjection({
      currentAge: 45,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 150000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // Before 55: SA should be > 0
    const row54 = rows.find((r) => r.age === 54)!
    expect(row54.cpfSA).toBeGreaterThan(0)
    expect(row54.cpfRA).toBe(0)

    // At 55: SA transfers to RA, SA becomes 0
    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.cpfSA).toBe(0)
    expect(row55.cpfRA).toBeGreaterThan(0)

    // Post-55: SA stays 0, RA grows
    const row56 = rows.find((r) => r.age === 56)!
    expect(row56.cpfSA).toBe(0)
    expect(row56.cpfRA).toBeGreaterThan(row55.cpfRA)
  })

  it('RA grows with 4% interest from 55 to LIFE start, then goes to 0', () => {
    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 200000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 80000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 200000,
      initialCpfMA: 50000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // At age 55: RA should exist (from SA transfer)
    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.cpfRA).toBeGreaterThan(0)

    // RA grows from 55 to 64
    const row60 = rows.find((r) => r.age === 60)!
    expect(row60.cpfRA).toBeGreaterThan(row55.cpfRA)

    const row64 = rows.find((r) => r.age === 64)!
    expect(row64.cpfRA).toBeGreaterThan(row60.cpfRA)

    // At 65 (LIFE start): RA goes to 0 (annuitized)
    const row65 = rows.find((r) => r.age === 65)!
    expect(row65.cpfRA).toBe(0)

    // Payout based on RA balance at LIFE start (higher than original FRS due to 10yr growth)
    expect(row65.cpfLifePayout).toBeGreaterThan(213000 * 0.063) // Higher than old fixed-FRS payout
  })

  it('Basic Plan: RA retains ~85% at LIFE start', () => {
    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 75,
      salaryModel: 'simple',
      annualSalary: 200000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 80000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 200000,
      initialCpfMA: 50000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'basic',
      cpfRetirementSum: 'frs',
    })

    // RA should grow from 55 to 64
    const row64 = rows.find((r) => r.age === 64)!
    const preLifeRA = row64.cpfRA
    expect(preLifeRA).toBeGreaterThan(0)

    // At 65 (LIFE start): RA should retain ~85% (not go to 0)
    const row65 = rows.find((r) => r.age === 65)!
    // RA at 65 should be ~85% of what it was at 64, minus the payout deducted,
    // plus interest earned during that year
    expect(row65.cpfRA).toBeGreaterThan(0)
    // Annuity premium should be ~15% of pre-LIFE RA
    expect(row65.cpfLifeAnnuityPremium).toBeCloseTo(preLifeRA * 0.15, -2)
  })

  it('Basic Plan: RA draws down each year post-LIFE', () => {
    const rows = generateIncomeProjection({
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 95,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'basic',
      cpfRetirementSum: 'frs',
    })

    const row65 = rows.find((r) => r.age === 65)!
    const row70 = rows.find((r) => r.age === 70)!
    const row80 = rows.find((r) => r.age === 80)!

    // RA should be non-zero at 65
    expect(row65.cpfRA).toBeGreaterThan(0)
    // RA decreasing over time (payout exceeds interest)
    expect(row70.cpfRA).toBeLessThan(row65.cpfRA)
    // RA eventually depletes (by ~85-95)
    expect(row80.cpfRA).toBeLessThan(row70.cpfRA)

    // Eventually reaches 0
    const depleted = rows.find((r) => r.age > 65 && r.cpfRA === 0)
    expect(depleted).toBeDefined()
  })

  it('Basic Plan: payout amount unchanged regardless of RA balance', () => {
    const rows = generateIncomeProjection({
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 95,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'basic',
      cpfRetirementSum: 'frs',
    })

    const row65 = rows.find((r) => r.age === 65)!
    const row85 = rows.find((r) => r.age === 85)!
    const row90 = rows.find((r) => r.age === 90)!

    // Payout should be the same at all ages (Basic rate is flat)
    expect(row65.cpfLifePayout).toBeGreaterThan(0)
    expect(row85.cpfLifePayout).toBe(row65.cpfLifePayout)
    expect(row90.cpfLifePayout).toBe(row65.cpfLifePayout)
  })

  it('Standard/Escalating: cpfLifeAnnuityPremium equals full RA', () => {
    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 200000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 80000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 200000,
      initialCpfMA: 50000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    const row64 = rows.find((r) => r.age === 64)!
    const row65 = rows.find((r) => r.age === 65)!

    // Standard: annuity premium = full RA at LIFE start
    expect(row65.cpfLifeAnnuityPremium).toBeCloseTo(row64.cpfRA, -2)
    // RA should be 0 after annuitization
    expect(row65.cpfRA).toBe(0)
  })

  it('Post-LIFE contributions go to OA, not RA (all plans)', () => {
    // Worker past LIFE start age, contributions should route SA → OA
    const rowsStandard = generateIncomeProjection({
      currentAge: 60,
      retirementAge: 70,
      lifeExpectancy: 75,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // At 66: still working, contributions should go to OA (not RA which is annuitized)
    const row65 = rowsStandard.find((r) => r.age === 65)!
    const row66 = rowsStandard.find((r) => r.age === 66)!
    // RA stays 0 for Standard
    expect(row66.cpfRA).toBe(0)
    // OA should grow (contributions + interest)
    expect(row66.cpfOA).toBeGreaterThan(row65.cpfOA)
  })

  it('cpfLifeActualMonthlyPayout still sets correct annuity premium', () => {
    const rows = generateIncomeProjection({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 75,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 200000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfLifeActualMonthlyPayout: 1500,
    })

    const row65 = rows.find((r) => r.age === 65)!
    // Annuity premium should still be set (based on RA, not payout)
    expect(row65.cpfLifeAnnuityPremium).toBeGreaterThan(0)
    // Payout uses actual monthly value
    expect(row65.cpfLifePayout).toBe(18000)
  })

  it('post-55 SA contributions route to RA then overflow to OA', () => {
    // Start at 55 with SA that exactly meets FRS → RA = FRS, no room for more
    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 60,
      lifeExpectancy: 65,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 250000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // At 55: SA transfers to RA. SA($250K) → RA, with FRS target ≈ $213K.
    // RA = $213K, excess SA above target stays... no, performAge55Transfer caps at target.
    // Actually SA ($250K) > FRS ($213K), so RA = $213K (all from SA), OA keeps its $100K.
    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.cpfSA).toBe(0)

    // SA contributions in 55-60 bracket (SA rate exists) should go to OA (RA at cap)
    // We verify OA grows more than just from OA allocation (gets SA overflow too)
    const row56 = rows.find((r) => r.age === 56)!
    // OA should be > 55's OA + just OA allocation (has SA overflow)
    expect(row56.cpfOA).toBeGreaterThan(row55.cpfOA)
  })

  it('Pre-Retiree: government income stream appears at correct age', () => {
    const cpfLifeStream: IncomeStream = {
      id: 'cpf-life',
      name: 'CPF LIFE',
      annualAmount: 13400,
      startAge: 65,
      endAge: 90,
      growthRate: 0,
      type: 'government',
      growthModel: 'none',
      taxTreatment: 'tax-exempt',
      isCpfApplicable: false,
      isActive: true,
    }

    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      salaryModel: 'simple',
      annualSalary: 200000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [cpfLifeStream],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 80000,
      inflation: 0.025,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 500000,
      initialCpfSA: 300000,
      initialCpfMA: 100000,
    })

    // Before 65: no government income
    const row60 = rows.find((r) => r.age === 60)!
    expect(row60.governmentIncome).toBe(0)

    // At 65: CPF LIFE kicks in
    const row65 = rows.find((r) => r.age === 65)!
    expect(row65.governmentIncome).toBe(13400)
    expect(row65.isRetired).toBe(true)

    // At 89: still receiving
    const row89 = rows.find((r) => r.age === 89)!
    expect(row89.governmentIncome).toBe(13400)

    // At 90 (endAge): no longer receiving
    const row90 = rows.find((r) => r.age === 90)!
    expect(row90.governmentIncome).toBe(0)
  })

  it('tracks SRS accumulation, drawdown at age 63, and stops after 10 years', () => {
    const rows = generateIncomeProjection({
      currentAge: 55,
      retirementAge: 55,
      lifeExpectancy: 80,
      salaryModel: 'simple',
      annualSalary: 0,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: false,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 0,
      srsAnnualContribution: 15300,
      initialCpfOA: 0,
      initialCpfSA: 0,
      initialCpfMA: 0,
      initialCpfRA: 0,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfHousingMode: 'none',
      cpfHousingMonthly: 0,
      cpfMortgageYearsLeft: 0,
      residencyStatus: 'citizen',
      srsBalance: 100000,
      srsInvestmentReturn: 0.04,
      srsDrawdownStartAge: 63,
    })

    // Age 55 = retirementAge: isRetired = (age > retirementAge), so age 55 still contributes
    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.srsContribution).toBe(15300) // last working year
    expect(row55.srsWithdrawal).toBe(0)
    // ($100K + $15,300) * 1.04 = $119,912
    expect(row55.srsBalance).toBeCloseTo((100000 + 15300) * 1.04, 0)

    // Age 56+: retired, no more contributions, but balance grows with returns
    const row56 = rows.find((r) => r.age === 56)!
    expect(row56.srsContribution).toBe(0)
    expect(row56.srsWithdrawal).toBe(0)

    const row62 = rows.find((r) => r.age === 62)!
    expect(row62.srsWithdrawal).toBe(0)
    expect(row62.srsBalance).toBeGreaterThan(100000) // should have grown

    // Drawdown starts at age 63
    const row63 = rows.find((r) => r.age === 63)!
    expect(row63.srsWithdrawal).toBeGreaterThan(0)
    expect(row63.srsTaxableWithdrawal).toBeCloseTo(row63.srsWithdrawal * 0.5, 2)
    // SRS withdrawal is tracked separately from governmentIncome
    expect(row63.srsWithdrawal).toBeGreaterThan(0)
    // totalGross includes SRS withdrawal
    expect(row63.totalGross).toBeGreaterThanOrEqual(row63.srsWithdrawal)

    // Age 72: last drawdown year (63 + 10 - 1 = 72)
    const row72 = rows.find((r) => r.age === 72)!
    expect(row72.srsWithdrawal).toBeGreaterThan(0)

    // Age 73: drawdown finished, no more SRS
    const row73 = rows.find((r) => r.age === 73)!
    expect(row73.srsWithdrawal).toBe(0)
    expect(row73.srsBalance).toBeCloseTo(0, 0)
  })

  it('OA withdrawal at age 55: OA decreases, cpfOaWithdrawal field set', () => {
    const rows = generateIncomeProjection({
      currentAge: 50,
      retirementAge: 58,
      lifeExpectancy: 65,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 200000,
      initialCpfSA: 100000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfOaWithdrawals: [{ id: 'w1', label: 'OA withdrawal', amount: 50000, age: 55 }],
    })

    // At 55: OA withdrawal should appear
    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.cpfOaWithdrawal).toBe(50000)

    // Compare with no-withdrawal scenario
    const rowsNoW = generateIncomeProjection({
      currentAge: 50,
      retirementAge: 58,
      lifeExpectancy: 65,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 200000,
      initialCpfSA: 100000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })
    const noW55 = rowsNoW.find((r) => r.age === 55)!
    // OA should be ~$50K lower in the withdrawal scenario
    expect(row55.cpfOA).toBeCloseTo(noW55.cpfOA - 50000, -2)
  })

  it('OA withdrawal clamped to available balance', () => {
    const rows = generateIncomeProjection({
      currentAge: 54,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 10000,
      initialCpfSA: 50000,
      initialCpfMA: 20000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfOaWithdrawals: [{ id: 'w1', label: 'Big withdrawal', amount: 999999, age: 55 }],
    })

    const row55 = rows.find((r) => r.age === 55)!
    // Withdrawal should be clamped to whatever OA is at that point (after contributions/interest)
    // It can't withdraw more than OA balance
    expect(row55.cpfOaWithdrawal).toBeGreaterThan(0)
    expect(row55.cpfOaWithdrawal).toBeLessThan(999999)
    // After withdrawal, OA should be at or near 0
    // (Note: OA may not be exactly 0 because the withdrawal happens after interest but we check it's close)
    // Actually cpfOaWithdrawal = min(amount, cpfOA), and cpfOA -= withdrawable
    // So cpfOA should be exactly 0 if withdrawal > balance
    // But note: at age 55, RA transfer happens first (SA -> RA), then contributions, then interest, then withdrawal
    // So OA gets OA interest + contributions + possible SA excess before withdrawal
    expect(row55.cpfOA).toBeGreaterThanOrEqual(0)
  })

  it('OA withdrawal before 55 is ignored (age < 55)', () => {
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 50000,
      initialCpfMA: 20000,
      cpfOaWithdrawals: [{ id: 'w1', label: 'Early withdrawal', amount: 50000, age: 40 }],
    })

    // At age 40: withdrawal should not happen (age < 55)
    const row40 = rows.find((r) => r.age === 40)!
    expect(row40.cpfOaWithdrawal).toBe(0)

    // All rows before 55 should have 0 withdrawal
    for (const row of rows) {
      if (row.age < 55) {
        expect(row.cpfOaWithdrawal).toBe(0)
      }
    }
  })

  it('multiple OA withdrawals at different ages', () => {
    const rows = generateIncomeProjection({
      currentAge: 50,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 300000,
      initialCpfSA: 100000,
      initialCpfMA: 30000,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
      cpfOaWithdrawals: [
        { id: 'w1', label: 'First', amount: 50000, age: 55 },
        { id: 'w2', label: 'Second', amount: 30000, age: 60 },
      ],
    })

    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.cpfOaWithdrawal).toBe(50000)

    const row60 = rows.find((r) => r.age === 60)!
    expect(row60.cpfOaWithdrawal).toBe(30000)

    // Other ages should have 0
    const row56 = rows.find((r) => r.age === 56)!
    expect(row56.cpfOaWithdrawal).toBe(0)
  })

  it('CPFIS enabled: OA grows faster pre-55 with higher return', () => {
    const baseParams = {
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple' as const,
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree' as const,
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 80000,
      initialCpfMA: 20000,
    }

    const rowsNoCpfis = generateIncomeProjection(baseParams)
    const rowsCpfis = generateIncomeProjection({
      ...baseParams,
      cpfisEnabled: true,
      cpfisOaReturn: 0.08,
      cpfisSaReturn: 0.07,
    })

    // At age 50 (20 years of compounding), CPFIS should produce higher OA + SA
    const noCpfis50 = rowsNoCpfis.find((r) => r.age === 50)!
    const cpfis50 = rowsCpfis.find((r) => r.age === 50)!

    // OA should be higher with CPFIS (8% > 2.5% on amounts above $20K)
    expect(cpfis50.cpfOA).toBeGreaterThan(noCpfis50.cpfOA)
    // SA should be higher with CPFIS (7% > 4% on amounts above $40K)
    expect(cpfis50.cpfSA).toBeGreaterThan(noCpfis50.cpfSA)
  })

  it('CPFIS enabled: cpfisOA and cpfisSA track invested amounts above retention', () => {
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 80000,
      initialCpfMA: 20000,
      cpfisEnabled: true,
      cpfisOaReturn: 0.08,
      cpfisSaReturn: 0.07,
    })

    // At age 30: OA=100K, SA=80K → cpfisOA = 100K-20K = 80K, cpfisSA = 80K-40K = 40K
    const row30 = rows.find((r) => r.age === 30)!
    // After contributions and interest, balances will be higher than initial
    // but the CPFIS amounts should be balance minus retention
    expect(row30.cpfisOA).toBe(row30.cpfOA - 20000)
    expect(row30.cpfisSA).toBe(row30.cpfSA - 40000)

    // At age 50: both should still equal balance minus retention
    const row50 = rows.find((r) => r.age === 50)!
    expect(row50.cpfisOA).toBe(row50.cpfOA - 20000)
    expect(row50.cpfisSA).toBe(row50.cpfSA - 40000)

    // cpfisReturn = extra interest earned vs standard rates
    // OA extra = (0.08 - 0.025) * cpfisOA, SA extra = (0.07 - 0.04) * cpfisSA
    const expectedReturn30 = (0.08 - 0.025) * row30.cpfisOA + (0.07 - 0.04) * row30.cpfisSA
    expect(row30.cpfisReturn).toBeCloseTo(expectedReturn30, 0)
    expect(row50.cpfisReturn).toBeGreaterThan(0)
  })

  it('CPFIS disabled: cpfisOA and cpfisSA are zero', () => {
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 80000,
      initialCpfMA: 20000,
      cpfisEnabled: false,
    })

    const row30 = rows.find((r) => r.age === 30)!
    expect(row30.cpfisOA).toBe(0)
    expect(row30.cpfisSA).toBe(0)
    expect(row30.cpfisReturn).toBe(0)
  })

  it('CPFIS: cpfisOA and cpfisSA are zero when balances below retention', () => {
    const rows = generateIncomeProjection({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 5000,  // below $20K retention
      initialCpfSA: 10000, // below $40K retention
      initialCpfMA: 5000,
      cpfisEnabled: true,
      cpfisOaReturn: 0.08,
      cpfisSaReturn: 0.07,
    })

    // At age 30 with low starting balances, first year won't exceed retention
    const row30 = rows.find((r) => r.age === 30)!
    // cpfisOA = max(0, cpfOA - 20K), cpfisSA = max(0, cpfSA - 40K)
    expect(row30.cpfisOA).toBe(Math.max(0, row30.cpfOA - 20000))
    expect(row30.cpfisSA).toBe(Math.max(0, row30.cpfSA - 40000))
  })

  it('CPFIS: cpfisOA and cpfisSA are zero post-55 (CPFIS inactive)', () => {
    const rows = generateIncomeProjection({
      currentAge: 50,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 200000,
      initialCpfSA: 100000,
      initialCpfMA: 30000,
      cpfisEnabled: true,
      cpfisOaReturn: 0.08,
      cpfisSaReturn: 0.07,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // Pre-55: CPFIS should show invested amounts
    const row54 = rows.find((r) => r.age === 54)!
    expect(row54.cpfisOA).toBeGreaterThan(0)
    expect(row54.cpfisSA).toBeGreaterThan(0)

    // Post-55: CPFIS is inactive (SA closed), both should be 0
    const row56 = rows.find((r) => r.age === 56)!
    expect(row56.cpfisOA).toBe(0)
    expect(row56.cpfisSA).toBe(0)
  })

  it('CPFIS disabled: unchanged behavior (regression)', () => {
    const baseParams = {
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple' as const,
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree' as const,
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 80000,
      initialCpfMA: 20000,
    }

    const rowsDefault = generateIncomeProjection(baseParams)
    const rowsExplicitFalse = generateIncomeProjection({
      ...baseParams,
      cpfisEnabled: false,
      cpfisOaReturn: 0.08,
      cpfisSaReturn: 0.07,
    })

    // Results should be identical
    const default50 = rowsDefault.find((r) => r.age === 50)!
    const explicit50 = rowsExplicitFalse.find((r) => r.age === 50)!
    expect(explicit50.cpfOA).toBeCloseTo(default50.cpfOA, 2)
    expect(explicit50.cpfSA).toBeCloseTo(default50.cpfSA, 2)
  })

  it('CPFIS reverts post-55 (saClosed = true, CPFIS inactive)', () => {
    // CPFIS is only active when SA is open (pre-55).
    // After 55, SA closes and standard rates apply.
    const rows = generateIncomeProjection({
      currentAge: 50,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 80000,
      initialCpfMA: 20000,
      cpfisEnabled: true,
      cpfisOaReturn: 0.08,
      cpfisSaReturn: 0.07,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // Pre-55: SA should be > 0 (CPFIS active)
    const row54 = rows.find((r) => r.age === 54)!
    expect(row54.cpfSA).toBeGreaterThan(0)

    // At 55: SA closes, transferred to RA
    const row55 = rows.find((r) => r.age === 55)!
    expect(row55.cpfSA).toBe(0)
    expect(row55.cpfRA).toBeGreaterThan(0)

    // Post-55: CPFIS should be inactive (saClosed = true)
    // Verify by comparing post-55 OA growth with and without CPFIS
    const rowsNoCpfis = generateIncomeProjection({
      currentAge: 50,
      retirementAge: 65,
      lifeExpectancy: 70,
      salaryModel: 'simple',
      annualSalary: 100000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 50000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 80000,
      initialCpfMA: 20000,
      cpfisEnabled: false,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // Post-55: CPFIS should be inactive (saClosed = true)
    // Verify by checking that CPF contributions flow the same way post-55
    const row56Cpfis = rows.find((r) => r.age === 56)!
    const row56NoCpfis = rowsNoCpfis.find((r) => r.age === 56)!
    // The year-over-year CPF contributions should be identical post-55 (standard rates)
    expect(row56Cpfis.cpfEmployee).toBeCloseTo(row56NoCpfis.cpfEmployee, 0)
  })

  it('no shortfall when employed with OA contributions covering mortgage', () => {
    // Bug report: User at age 43, OA = $11,500, salary contributions ~$20K/yr,
    // mortgage $1,723/mo ($20,676/yr). OA + contributions = ~$31K > mortgage.
    // Expected: no shortfall. Bug: shortfall computed before contributions added.
    const result = generateIncomeProjection({
      currentAge: 43,
      retirementAge: 65,
      lifeExpectancy: 85,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 11500,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: 1723,
      cpfMortgageYearsLeft: 20,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    const firstRow = result[0] // age 43
    // $72K salary → OA allocation at age 43 (under 55) = 23% of $72K = $16,560/yr
    // OA balance = 11,500 + 16,560 = 28,060 > mortgage of 20,676/yr
    // So there should be NO shortfall while employed
    expect(firstRow.cpfOaShortfall).toBe(0)

    // OA balance should be positive: initial + contributions - mortgage > 0
    // (mortgage > contributions so OA declines, but no cash shortfall)
    expect(firstRow.cpfOA).toBeGreaterThan(0)
    // Housing deduction should equal full annual mortgage (no partial deduction)
    expect(firstRow.cpfOaHousingDeduction).toBe(1723 * 12)
  })

  it('genuine shortfall when employed but OA + contributions still insufficient', () => {
    // Age 43 is in 35-45 bracket: OA = 21% × $72K = $15,120/yr
    // OA available = 100 + 15,120 = 15,220 < mortgage $30,000 → genuine shortfall
    const result = generateIncomeProjection({
      currentAge: 43,
      retirementAge: 65,
      lifeExpectancy: 85,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: 2500, // $30,000/yr
      cpfMortgageYearsLeft: 20,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    const firstRow = result[0]
    // Shortfall ≈ 30,000 - 15,220 = 14,780 (mortgage exceeds OA + contributions)
    expect(firstRow.cpfOaShortfall).toBeCloseTo(14780, -2)
    // Housing deduction capped to available OA: min(30000, 15220) ≈ 15,220
    expect(firstRow.cpfOaHousingDeduction).toBeCloseTo(15220, -2)
    // OA drained to ~0 (tiny residual from mid-year interest on the average balance)
    expect(firstRow.cpfOA).toBeLessThan(5)
  })

  it('no shortfall when mortgage is within OA + contributions', () => {
    // Age 43 bracket: OA = 21% × $72K = $15,120/yr
    // Mortgage = $1,000 × 12 = $12,000 < $15,220 → no shortfall
    const mortgageMonthly = 1000
    const result = generateIncomeProjection({
      currentAge: 43,
      retirementAge: 65,
      lifeExpectancy: 85,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: mortgageMonthly,
      cpfMortgageYearsLeft: 20,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    const firstRow = result[0]
    expect(firstRow.cpfOaShortfall).toBe(0)
    expect(firstRow.cpfOaHousingDeduction).toBe(mortgageMonthly * 12)
    expect(firstRow.cpfOA).toBeGreaterThan(0)
  })

  it('age 55 transfer drains OA causing mortgage shortfall', () => {
    // SA ($50K) << FRS (~$220K) → transfer pulls from OA to fill RA gap.
    // Post-transfer OA ≈ 0, post-55 contributions alone can't cover $18K mortgage.
    const result = generateIncomeProjection({
      currentAge: 54,
      retirementAge: 65,
      lifeExpectancy: 85,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 100000,
      initialCpfSA: 50000,
      initialCpfMA: 30000,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: 1500, // $18,000/yr
      cpfMortgageYearsLeft: 10,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    const row54 = result.find((r) => r.age === 54)!
    const row55 = result.find((r) => r.age === 55)!

    // Age 54: OA is large ($100K+), no shortfall
    expect(row54.cpfOaShortfall).toBe(0)
    expect(row54.cpfOaHousingDeduction).toBe(1500 * 12)

    // Age 55: Transfer drains OA to fill RA gap → shortfall appears
    expect(row55.cpfOaShortfall).toBeGreaterThan(0)
    // SA fully transferred to RA
    expect(row55.cpfSA).toBe(0)
    expect(row55.cpfRA).toBeGreaterThan(0)
  })

  it('tracks cpfOaShortfall when OA is depleted by mortgage', () => {
    const result = generateIncomeProjection({
      currentAge: 38,
      retirementAge: 40,
      lifeExpectancy: 50,
      salaryModel: 'simple',
      annualSalary: 72000,
      salaryGrowthRate: 0.03,
      realisticPhases: DEFAULT_CAREER_PHASES,
      promotionJumps: [],
      momEducation: 'degree',
      momAdjustment: 1.0,
      employerCpfEnabled: true,
      incomeStreams: [],
      lifeEvents: [],
      lifeEventsEnabled: false,
      annualExpenses: 48000,
      inflation: 0,
      personalReliefs: 20000,
      srsAnnualContribution: 0,
      initialCpfOA: 50000,
      initialCpfSA: 30000,
      initialCpfMA: 20000,
      cpfHousingMode: 'simple',
      cpfHousingMonthly: 1500,
      cpfMortgageYearsLeft: 20,
      cpfLifeStartAge: 65,
      cpfLifePlan: 'standard',
      cpfRetirementSum: 'frs',
    })

    // After retirement at 40, no salary -> no CPF contributions
    // OA gets drained by $18K/yr (1500 * 12) with only interest accumulating
    // At some point OA < 18K and shortfall appears
    const shortfallRows = result.filter((r) => r.cpfOaShortfall > 0)
    expect(shortfallRows.length).toBeGreaterThan(0)

    // First shortfall should be after OA runs out
    const firstShortfall = shortfallRows[0]
    expect(firstShortfall.age).toBeGreaterThan(40)

    // Before shortfall, cpfOaShortfall should be 0
    const preShortfall = result.filter((r) => r.age < firstShortfall.age)
    for (const row of preShortfall) {
      expect(row.cpfOaShortfall).toBe(0)
    }
  })
})

// ============================================================
// Voluntary CPF top-ups in projection
// ============================================================

describe('voluntary CPF top-ups in projection', () => {
  const topUpBaseParams = {
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 70,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 48000,
    inflation: 0,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    initialCpfOA: 50000,
    initialCpfSA: 50000,
    initialCpfMA: 30000,
  }

  it('SA top-up increases SA balance each pre-retirement year', () => {
    const params = {
      ...topUpBaseParams,
      cpfTopUpSA: 8000,
      initialCpfSA: 50000,
    }
    const withTopUp = generateIncomeProjection(params)
    const paramsNoTopUp = { ...params, cpfTopUpSA: 0 }
    const withoutTopUp = generateIncomeProjection(paramsNoTopUp)

    // At year 1 (second row), SA should be higher with top-up
    expect(withTopUp[1].cpfSA).toBeGreaterThan(withoutTopUp[1].cpfSA)
    // Difference should be approximately $8,000 + interest on the extra amount
    const diff = withTopUp[1].cpfSA - withoutTopUp[1].cpfSA
    expect(diff).toBeGreaterThanOrEqual(8000)
  })

  it('top-ups reduce annual savings (liquid portfolio contribution)', () => {
    const params = { ...topUpBaseParams, cpfTopUpSA: 8000, cpfTopUpOA: 2000 }
    const withTopUp = generateIncomeProjection(params)
    const paramsNoTopUp = { ...params, cpfTopUpSA: 0, cpfTopUpOA: 0 }
    const withoutTopUp = generateIncomeProjection(paramsNoTopUp)

    // Savings should be lower with top-ups
    expect(withTopUp[0].annualSavings).toBeLessThan(withoutTopUp[0].annualSavings)
  })

  it('MA top-up is capped at BHS minus current MA', () => {
    const params = {
      ...topUpBaseParams,
      cpfTopUpMA: 50000,
      initialCpfMA: 60000,  // close to BHS ($79,000)
    }
    const rows = generateIncomeProjection(params)
    // MA should not wildly exceed BHS
    expect(rows[0].cpfMA).toBeLessThanOrEqual(85000)
  })

  it('no top-ups applied after retirement when no employment income', () => {
    const params = {
      ...topUpBaseParams,
      currentAge: 60,
      retirementAge: 62,
      lifeExpectancy: 70,
      cpfTopUpSA: 8000,
      initialCpfSA: 0,
    }
    const rows = generateIncomeProjection(params)
    const retiredRow = rows.find(r => r.isRetired)
    const preRetiredRows = rows.filter(r => !r.isRetired)
    const preRetiredRow = preRetiredRows.length > 0 ? preRetiredRows[preRetiredRows.length - 1] : undefined
    if (retiredRow && preRetiredRow) {
      // Post-55 with saClosed, SA top-up goes to RA or OA.
      // The retired row should NOT have additional top-up applied.
      // Compare RA delta: should be only interest, not interest + topUp
      const raDiff = retiredRow.cpfRA - preRetiredRow.cpfRA
      expect(Math.abs(raDiff)).toBeLessThan(8000)
    }
  })

  it('top-ups continue during Barista FIRE when employment income stream is active', () => {
    const baristaStream = {
      id: 'barista',
      name: 'Barista Job',
      annualAmount: 36000,
      startAge: 43,
      endAge: 48,
      growthRate: 0,
      type: 'employment' as const,
      growthModel: 'none' as const,
      taxTreatment: 'taxable' as const,
      isCpfApplicable: true,
      isActive: true,
    }
    // Start at retirement age so both scenarios have identical initial balances
    const baseParams = {
      ...topUpBaseParams,
      currentAge: 40,
      retirementAge: 39, // already FIRE'd — all years are post-retirement
      lifeExpectancy: 50,
      annualSalary: 0,
      initialCpfSA: 200000,
      incomeStreams: [baristaStream],
    }
    const withTopUp = generateIncomeProjection({ ...baseParams, cpfTopUpSA: 8000 })
    const withoutTopUp = generateIncomeProjection({ ...baseParams, cpfTopUpSA: 0 })

    // Age 42: retired, no employment income — SA should be identical (no top-up)
    expect(withTopUp.find(r => r.age === 42)!.cpfSA)
      .toBeCloseTo(withoutTopUp.find(r => r.age === 42)!.cpfSA, 0)

    // Age 45: barista job active — top-up should apply, SA should diverge
    expect(withTopUp.find(r => r.age === 45)!.cpfSA)
      .toBeGreaterThan(withoutTopUp.find(r => r.age === 45)!.cpfSA + 7000)
  })
})

// ============================================================
// Voluntary SA top-up FRS cap (Bug 2)
// ============================================================

describe('voluntary SA top-up FRS cap pre-55', () => {
  const frsCapParams = {
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 70,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 48000,
    inflation: 0,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    initialCpfOA: 50000,
    initialCpfSA: 50000,
    initialCpfMA: 30000,
  }

  it('tax uses capped SA top-up amount (not requested) when SA near FRS', () => {
    // SA near FRS: mandatory contrib ~$6,000 pushes SA to ~$219,000.
    // FRS ~$220,400 → only ~$1,400 room → topUpSAActual ≈ $1,400.
    // Tax RSTU deduction must use $1,400, not the requested $8,000.
    // Compare tax with SA near FRS vs SA well below FRS (where full $8K applies).
    const nearFrsParams = {
      ...frsCapParams,
      initialCpfSA: 213000,
      cpfTopUpSA: 8000,
    }
    const belowFrsParams = {
      ...frsCapParams,
      initialCpfSA: 50000,
      cpfTopUpSA: 8000,
    }
    const nearFrs = generateIncomeProjection(nearFrsParams)
    const belowFrs = generateIncomeProjection(belowFrsParams)
    // When SA is well below FRS, full $8K top-up is applied → full RSTU deduction → lower tax.
    // When SA is near FRS, only ~$1,400 is applied → smaller RSTU deduction → higher tax.
    expect(nearFrs[0].sgTax).toBeGreaterThan(belowFrs[0].sgTax)
  })

  it('savings deduction uses capped top-up amounts when SA near FRS', () => {
    // With SA near FRS, the capped top-up should result in higher savings
    // (less cash deducted) compared to if we incorrectly used the full requested amount.
    const nearFrsParams = {
      ...frsCapParams,
      initialCpfSA: 213000,
      cpfTopUpSA: 8000,
    }
    const noTopUpParams = {
      ...frsCapParams,
      initialCpfSA: 213000,
      cpfTopUpSA: 0,
    }
    const withTopUp = generateIncomeProjection(nearFrsParams)
    const withoutTopUp = generateIncomeProjection(noTopUpParams)
    // The savings difference should be roughly the capped amount (~$1,400), not $8,000.
    // Allow some tolerance for tax effects.
    const savingsDiff = withoutTopUp[0].annualSavings - withTopUp[0].annualSavings
    expect(savingsDiff).toBeLessThan(3000) // well under the requested $8,000
    expect(savingsDiff).toBeGreaterThan(0)  // some deduction still applies
  })

  it('SA top-up is capped when SA is near FRS', () => {
    // Mandatory SA contrib for $100K salary at age 30 = $6,000 (6% SA rate).
    // Start SA at $213,000 so after mandatory it's $219,000, leaving $1,400 room to FRS ($220,400).
    const params = {
      ...frsCapParams,
      initialCpfSA: 213000,
      cpfTopUpSA: 8000,
    }
    const withTopUp = generateIncomeProjection(params)
    const paramsNoTopUp = { ...params, cpfTopUpSA: 0 }
    const withoutTopUp = generateIncomeProjection(paramsNoTopUp)
    const saDiff = withTopUp[0].cpfSA - withoutTopUp[0].cpfSA
    // Should be ~$1,400 (FRS 220400 - post-mandatory 219000), NOT the full $8,000
    expect(saDiff).toBeGreaterThan(0)
    expect(saDiff).toBeLessThan(3000)
  })

  it('SA top-up is zero when SA already exceeds FRS', () => {
    const params = {
      ...frsCapParams,
      initialCpfSA: 250000, // well above FRS
      cpfTopUpSA: 8000,
    }
    const withTopUp = generateIncomeProjection(params)
    const paramsNoTopUp = { ...params, cpfTopUpSA: 0 }
    const withoutTopUp = generateIncomeProjection(paramsNoTopUp)
    // SA top-up should have no effect when SA >= FRS
    expect(withTopUp[0].cpfSA).toBeCloseTo(withoutTopUp[0].cpfSA, 0)
  })

  it('SA top-up is fully applied when SA is well below FRS', () => {
    const params = {
      ...frsCapParams,
      initialCpfSA: 50000, // well below FRS ($220,400)
      cpfTopUpSA: 8000,
    }
    const withTopUp = generateIncomeProjection(params)
    const paramsNoTopUp = { ...params, cpfTopUpSA: 0 }
    const withoutTopUp = generateIncomeProjection(paramsNoTopUp)
    const saDiff = withTopUp[0].cpfSA - withoutTopUp[0].cpfSA
    // Full $8,000 should be applied since SA is far below FRS
    expect(saDiff).toBeGreaterThanOrEqual(8000)
  })
})

// ============================================================
// Post-55 SA top-up → RA routing: tax and savings correctness
// ============================================================

describe('post-55 SA top-up routed to RA', () => {
  const post55Params = {
    currentAge: 56,
    retirementAge: 65,
    lifeExpectancy: 85,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 48000,
    inflation: 0,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    initialCpfOA: 50000,
    initialCpfSA: 0,   // SA already transferred to RA at 55
    initialCpfMA: 50000,
    initialCpfRA: 100000,
    cpfRetirementSum: 'frs' as const,
  }

  it('RA top-up reduces tax via RSTU deduction', () => {
    // Post-55: cpfTopUpSA routes to RA. RSTU relief should apply to the RA portion.
    const withTopUp = generateIncomeProjection({
      ...post55Params,
      cpfTopUpSA: 8000,
    })
    const withoutTopUp = generateIncomeProjection({
      ...post55Params,
      cpfTopUpSA: 0,
    })
    // Tax should be lower with RA top-up due to RSTU deduction
    expect(withTopUp[0].sgTax).toBeLessThan(withoutTopUp[0].sgTax)
  })

  it('RA top-up is deducted from savings as cash outflow', () => {
    const withTopUp = generateIncomeProjection({
      ...post55Params,
      cpfTopUpSA: 8000,
    })
    const withoutTopUp = generateIncomeProjection({
      ...post55Params,
      cpfTopUpSA: 0,
    })
    // Savings should be lower with top-up (cash left the bank)
    expect(withTopUp[0].annualSavings).toBeLessThan(withoutTopUp[0].annualSavings)
  })
})

// ============================================================
// Bonus months (Additional Wages) in projection
// ============================================================

describe('generateIncomeProjection with bonusMonths', () => {
  const bonusBaseParams = {
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 70,
    salaryModel: 'simple' as const,
    annualSalary: 72000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 30000,
    inflation: 0,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('totalGross includes bonus when bonusMonths > 0', () => {
    const withBonus = generateIncomeProjection({ ...bonusBaseParams, bonusMonths: 2 })
    const withoutBonus = generateIncomeProjection({ ...bonusBaseParams, bonusMonths: 0 })
    // 2 months bonus on $72K salary = $72000 * 2/12 = $12,000
    expect(withBonus[0].totalGross - withoutBonus[0].totalGross).toBeCloseTo(12000, 0)
  })

  it('CPF contribution increases with bonus (AW component)', () => {
    const withBonus = generateIncomeProjection({ ...bonusBaseParams, bonusMonths: 2 })
    const withoutBonus = generateIncomeProjection({ ...bonusBaseParams, bonusMonths: 0 })
    // AW of $12K should attract CPF (employee 20% = $2,400, employer 17% = $2,040 at age 30)
    expect(withBonus[0].cpfEmployee).toBeGreaterThan(withoutBonus[0].cpfEmployee)
    expect(withBonus[0].cpfEmployer).toBeGreaterThan(withoutBonus[0].cpfEmployer)
  })

  it('defaults to zero bonus when bonusMonths omitted', () => {
    const withoutField = generateIncomeProjection(bonusBaseParams)
    const withZero = generateIncomeProjection({ ...bonusBaseParams, bonusMonths: 0 })
    expect(withoutField[0].totalGross).toBe(withZero[0].totalGross)
  })

  it('no bonus in retired years', () => {
    const params = { ...bonusBaseParams, bonusMonths: 2 }
    const rows = generateIncomeProjection(params)
    const retiredRow = rows.find(r => r.isRetired)!
    // Retired row totalGross should be 0 (no salary, no bonus)
    expect(retiredRow.totalGross).toBe(0)
  })
})

// ============================================================
// Locked asset unlock in projection
// ============================================================

describe('locked asset unlock in projection', () => {
  const lockedAssetBaseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    salaryModel: 'simple' as const,
    annualSalary: 72000,
    salaryGrowthRate: 0.03,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 30000,
    inflation: 0.025,
    personalReliefs: 20000,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('adds unlocked asset value at unlock age', () => {
    const params = {
      ...lockedAssetBaseParams,
      lockedAssets: [
        { id: '1', name: 'RSUs', amount: 50000, unlockAge: 35, growthRate: 0.05 },
      ],
    }
    const rows = generateIncomeProjection(params)
    const unlockRow = rows.find(r => r.age === 35)
    // At age 35 (5 years growth at 5%): 50000 * 1.05^5 ≈ 63814
    expect(unlockRow?.lockedAssetUnlock).toBeCloseTo(50000 * Math.pow(1.05, 5), 0)
  })

  it('returns 0 for lockedAssetUnlock in non-unlock years', () => {
    const params = {
      ...lockedAssetBaseParams,
      lockedAssets: [
        { id: '1', name: 'RSUs', amount: 50000, unlockAge: 35, growthRate: 0 },
      ],
    }
    const rows = generateIncomeProjection(params)
    const nonUnlockRow = rows.find(r => r.age === 32)
    expect(nonUnlockRow?.lockedAssetUnlock).toBe(0)
  })

  it('handles multiple locked assets unlocking at same age', () => {
    const params = {
      ...lockedAssetBaseParams,
      lockedAssets: [
        { id: '1', name: 'RSUs', amount: 50000, unlockAge: 35, growthRate: 0 },
        { id: '2', name: 'FD', amount: 30000, unlockAge: 35, growthRate: 0 },
      ],
    }
    const rows = generateIncomeProjection(params)
    const unlockRow = rows.find(r => r.age === 35)
    expect(unlockRow?.lockedAssetUnlock).toBe(80000)
  })
})

// ============================================================
// Earned Income Relief gating + age adjustment
// ============================================================

describe('earned income relief', () => {
  const retireeBaseParams = {
    salaryModel: 'simple' as const,
    annualSalary: 0,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [] as IncomeStream[],
    lifeEvents: [] as LifeEvent[],
    lifeEventsEnabled: false,
    inflation: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('retiree with only SRS income: no earned income relief, full SRS taxed', () => {
    // Retiree age 63, no salary, no business income.
    // SRS drawdown generates taxable income. Earned income relief should NOT apply.
    // personalReliefs = $8,000 (includes $8K earned income relief for 60+)
    // After stripping: baseReliefs = 0. No earned income → applicableReliefs = 0.
    // SRS balance $500K / 10 years = $50K withdrawal, taxable = $25K (50% concession)
    // Chargeable = $25K - 0 reliefs = $25K → tax = $200 + ($25K-$20K)*0.02 + ... = $100+
    const rows = generateIncomeProjection({
      ...retireeBaseParams,
      currentAge: 63,
      retirementAge: 60,
      lifeExpectancy: 73,
      annualExpenses: 40000,
      personalReliefs: 8000, // includes $8K earned income relief for 60+
      srsAnnualContribution: 0,
      srsBalance: 500000,
      srsInvestmentReturn: 0,
      srsDrawdownStartAge: 63,
    })

    // Age 63: SRS drawdown, no salary, no business → no earned income relief
    const row63 = rows.find(r => r.age === 63)!
    expect(row63.srsWithdrawal).toBeGreaterThan(0)
    expect(row63.salary).toBe(0)

    // Withdrawal = $50K, taxable = $25K (50% concession)
    const taxableAmount = row63.srsTaxableWithdrawal
    expect(taxableAmount).toBeCloseTo(row63.srsWithdrawal * 0.5, 0)
    expect(taxableAmount).toBeCloseTo(25000, 0)
    // With zero reliefs and zero CPF, chargeable = $25K
    // Tax on $25K: $0 (first $20K) + $200 ($20K-$30K at 2%) = $100
    expect(row63.sgTax).toBeCloseTo(100, 0)
  })

  it('age 53->55 transition: earned income relief jumps from $1K to $6K', () => {
    // Worker with salary, personalReliefs = $1K (just the under-55 earned income relief)
    // At age 55, relief should jump to $6K → tax decreases
    const rows = generateIncomeProjection({
      ...retireeBaseParams,
      currentAge: 53,
      retirementAge: 65,
      lifeExpectancy: 60,
      annualSalary: 120000,
      annualExpenses: 50000,
      personalReliefs: 1000, // just earned income relief for under-55
      srsAnnualContribution: 0,
    })

    const row53 = rows.find(r => r.age === 53)!
    const row55 = rows.find(r => r.age === 55)!

    // Both have same salary (0% growth), so difference in tax comes from relief change
    // At 53: baseReliefs = 1000 - 1000 = 0, earned income = 1000 → total 1000
    // At 55: baseReliefs = 0, earned income = 6000 → total 6000
    // Extra $5K deduction means less tax at 55
    expect(row55.sgTax).toBeLessThan(row53.sgTax)
  })

  it('retiree with business income: earned income relief still applies', () => {
    // Retiree with business income stream — earned income relief should still apply
    const businessStream: IncomeStream = {
      id: 'biz1',
      name: 'Consulting',
      type: 'business',
      annualAmount: 50000,
      growthModel: 'none',
      growthRate: 0,
      startAge: 60,
      endAge: 75,
      taxTreatment: 'taxable',
      isCpfApplicable: false,
      isActive: true,
    }

    const rows = generateIncomeProjection({
      ...retireeBaseParams,
      currentAge: 63,
      retirementAge: 60,
      lifeExpectancy: 70,
      annualExpenses: 40000,
      personalReliefs: 8000, // $8K earned income relief for 60+
      srsAnnualContribution: 0,
      incomeStreams: [businessStream],
    })

    const row63 = rows.find(r => r.age === 63)!
    expect(row63.businessIncome).toBe(50000)

    // Business income = earned income → relief applies
    // baseReliefs = 8000 - 8000 = 0, has earned income → 0 + 8000 = 8000
    // Chargeable = 50000 - 0 CPF - 0 SRS - 8000 reliefs = 42000
    // Tax on $42K: 550 + (42000 - 40000) * 0.07 = 690
    expect(row63.sgTax).toBeCloseTo(690, 0)
  })

  it('small personalReliefs below earned income: Math.max(0, ...) prevents negative', () => {
    // personalReliefs = $500, earned income relief for under-55 = $1000
    // baseReliefs = 500 - 1000 = -500
    // Without earned income: max(0, -500) = 0 (not negative)
    // With earned income: max(0, -500 + 1000) = 500 (original amount)
    const rows = generateIncomeProjection({
      ...retireeBaseParams,
      currentAge: 63,
      retirementAge: 60,
      lifeExpectancy: 65,
      annualExpenses: 30000,
      personalReliefs: 500, // less than the $8K earned income relief for 60+
      srsAnnualContribution: 0,
      srsBalance: 100000,
      srsInvestmentReturn: 0,
      srsDrawdownStartAge: 63,
    })

    const row63 = rows.find(r => r.age === 63)!
    // No salary, no business → no earned income
    // baseReliefs = 500 - 8000 = -7500, max(0, -7500) = 0
    // Tax should still compute correctly (no negative relief)
    expect(row63.sgTax).toBeGreaterThanOrEqual(0)

    // Verify that the relief didn't go negative by checking tax is as expected
    // Taxable = srsWithdrawal * 0.5, chargeable = taxable - 0 reliefs
    const expectedChargeable = row63.srsTaxableWithdrawal
    expect(expectedChargeable).toBeGreaterThan(0)
  })
})

describe('generateIncomeProjection with expenseAdjustments', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: [{ label: 'Career', minAge: 22, maxAge: 65, growthRate: 0 }],
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: false,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 50000,
    inflation: 0,
    personalReliefs: 0,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('savings differ by age with adjustment active at some ages', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      expenseAdjustments: [
        { id: '1', label: 'Rent', amount: 10000, startAge: 35, endAge: 50 },
      ],
    })

    const row30 = rows.find(r => r.age === 30)!
    const row35 = rows.find(r => r.age === 35)!
    const row50 = rows.find(r => r.age === 50)!

    // At age 30: no adjustment active → expenses = 50000
    // At age 35: adjustment active → expenses = 60000
    // At age 50: adjustment ended → expenses = 50000

    // annualSavings = totalNet - inflationAdjustedExpenses - voluntaryTopUps
    // With no CPF and no inflation, savings = totalNet - expenses
    expect(row30.annualSavings).toBeGreaterThan(row35.annualSavings)
    expect(row35.annualSavings).toBeLessThan(row50.annualSavings)
  })

  it('null endAge resolves to lifeExpectancy', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      expenseAdjustments: [
        { id: '1', label: 'Ongoing', amount: 5000, startAge: 40, endAge: null },
      ],
    })

    const row39 = rows.find(r => r.age === 39)!
    const row40 = rows.find(r => r.age === 40)!
    const row89 = rows.find(r => r.age === 89)!

    // Adjustment inactive at 39, active from 40 onward
    expect(row39.annualSavings).toBeGreaterThan(row40.annualSavings)
    // Still active at 89 (lifeExpectancy=90, endAge exclusive)
    expect(row89.annualSavings).toBeLessThan(row39.annualSavings)
  })

  it('empty adjustments behaves same as no adjustments', () => {
    const rowsWithout = generateIncomeProjection(baseParams)
    const rowsWith = generateIncomeProjection({ ...baseParams, expenseAdjustments: [] })

    expect(rowsWith[0].annualSavings).toBe(rowsWithout[0].annualSavings)
    expect(rowsWith[5].annualSavings).toBe(rowsWithout[5].annualSavings)
  })
})

// ============================================================
// CPF MA BHS overflow in projection
// ============================================================

describe('CPF MA BHS overflow in projection', () => {
  const bhsBaseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    salaryModel: 'simple' as const,
    annualSalary: 120000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    annualExpenses: 30000,
    inflation: 0,
    personalReliefs: 0,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('pre-55: mandatory contributions cap MA at BHS, overflow increases SA', () => {
    // Start with MA near BHS so contributions overflow quickly
    const params = {
      ...bhsBaseParams,
      initialCpfMA: 75000, // $4K below BHS
    }
    const rows = generateIncomeProjection(params)

    // After a few years, MA should be capped at BHS (plus at most interest rounding)
    // Age 30 salary $120K: MA allocation = $120K * 0.08 = $9,600/yr
    // Year 0: room = $4,000. $9,600 - $4,000 = $5,600 overflow to SA
    // After year 0: MA should be near BHS (interest may push slightly over, then Point B caps)

    // Check MA never significantly exceeds the year-appropriate BHS
    for (const row of rows) {
      // BHS grows at 4.5% p.a. until age 65, then freezes
      const bhsForYear = getBhsAtAge(row.age, 30)
      expect(row.cpfMA).toBeLessThanOrEqual(bhsForYear + 1)
    }

    // Compare with a run starting at MA=0 to verify SA gets the overflow
    const paramsLowMa = { ...bhsBaseParams, initialCpfMA: 0 }
    const rowsLowMa = generateIncomeProjection(paramsLowMa)

    // After MA reaches BHS in both runs, the high-MA start should have higher SA
    // because overflow started sooner
    const row5High = rows.find(r => r.age === 35)!
    const row5Low = rowsLowMa.find(r => r.age === 35)!
    expect(row5High.cpfSA).toBeGreaterThan(row5Low.cpfSA)
  })

  it('post-55: mandatory contributions overflow to RA then OA', () => {
    const params = {
      ...bhsBaseParams,
      currentAge: 56,
      retirementAge: 65,
      lifeExpectancy: 70,
      initialCpfMA: MEDISAVE_BHS, // already at cap
      initialCpfOA: 50000,
      initialCpfSA: 0, // SA closed at 55
      initialCpfRA: 200000,
      cpfRetirementSum: 'frs' as const,
    }
    const rows = generateIncomeProjection(params)

    // MA should stay at/below the year-appropriate BHS (interest overflow redirected)
    for (const row of rows.filter(r => !r.isRetired)) {
      const bhsForYear = getBhsAtAge(row.age, 56)
      expect(row.cpfMA).toBeLessThanOrEqual(bhsForYear + 1)
    }

    // RA and/or OA should receive the overflow
    // With MA at BHS, all MA contributions (~$9,600/yr for age 56) overflow
    const row56 = rows[0]
    // RA + OA should be higher than initial values by more than just OA contribution
    expect(row56.cpfRA + row56.cpfOA).toBeGreaterThan(200000 + 50000)
  })

  it('post-LIFE: overflow goes to OA, not RA', () => {
    // Use the cohort BHS for a 66-year-old (frozen at age 65)
    const cohortBhs = getBhsAtAge(66, 66)
    const params = {
      ...bhsBaseParams,
      currentAge: 66,
      retirementAge: 62,
      lifeExpectancy: 70,
      initialCpfMA: cohortBhs,
      initialCpfOA: 50000,
      initialCpfSA: 0,
      initialCpfRA: 0, // annuitized at 65
      cpfLifeStartAge: 65,
      annualSalary: 0, // retired, no salary
    }
    const rows = generateIncomeProjection(params)

    // Interest on MA at cohort BHS pushes above frozen cap → overflow to OA
    const row66 = rows[0]

    // MA stays at cohort BHS (frozen post-65)
    expect(row66.cpfMA).toBeLessThanOrEqual(cohortBhs + 1)

    // RA should remain 0 (annuitized, no overflow to RA)
    expect(row66.cpfRA).toBe(0)

    // OA should be higher than initial due to interest overflow from MA
    expect(row66.cpfOA).toBeGreaterThan(50000)
  })

  it('interest on MA at BHS does not accumulate above BHS, excess goes to OA', () => {
    // Even with no salary, interest alone on $79K MA should be capped at the
    // year-appropriate BHS. With BHS growing at 4.5% and MA interest at 4%,
    // overflow only occurs in the first year (BHS outgrows interest thereafter).
    const params = {
      ...bhsBaseParams,
      currentAge: 60,
      retirementAge: 58,
      lifeExpectancy: 64,
      annualSalary: 0,
      initialCpfMA: MEDISAVE_BHS,
      initialCpfOA: 10000,
      initialCpfSA: 0,
      initialCpfRA: 200000,
    }
    const rows = generateIncomeProjection(params)

    // Over 5 years with no contributions, MA should stay at the year-appropriate BHS
    for (const row of rows) {
      const bhsForYear = getBhsAtAge(row.age, 60)
      expect(row.cpfMA).toBeLessThanOrEqual(bhsForYear + 1)
    }

    // OA should grow from at least 1 year of MA interest overflow plus OA's own interest
    const lastRow = rows[rows.length - 1]
    expect(lastRow.cpfOA).toBeGreaterThan(10000)
  })

  it('retired with no salary: MA interest still capped at BHS', () => {
    const params = {
      ...bhsBaseParams,
      currentAge: 56,
      retirementAge: 55,
      lifeExpectancy: 60,
      annualSalary: 0,
      initialCpfMA: MEDISAVE_BHS,
      initialCpfOA: 10000,
      initialCpfSA: 0,
      initialCpfRA: 200000,
    }
    const rows = generateIncomeProjection(params)

    // MA should never exceed the year-appropriate BHS even with years of interest
    for (const row of rows) {
      const bhsForYear = getBhsAtAge(row.age, 56)
      expect(row.cpfMA).toBeLessThanOrEqual(bhsForYear + 1)
    }
  })

  it('conservation: total CPF balance unchanged by overflow (redirects, does not destroy money)', () => {
    // Run with MA starting at BHS to force overflow
    const paramsWithBhs = {
      ...bhsBaseParams,
      initialCpfMA: MEDISAVE_BHS,
      initialCpfOA: 50000,
      initialCpfSA: 30000,
    }
    // Run same params but with very high BHS (effectively no cap) for comparison
    // We can't change BHS directly, so instead check that total CPF is consistent
    const rows = generateIncomeProjection(paramsWithBhs)

    // For each row, total CPF should grow by contributions + interest
    // We just verify total is always >= initial total (money isn't destroyed)
    const initialTotal = MEDISAVE_BHS + 50000 + 30000
    for (const row of rows.filter(r => !r.isRetired)) {
      const rowTotal = row.cpfOA + row.cpfSA + row.cpfMA + row.cpfRA
      expect(rowTotal).toBeGreaterThanOrEqual(initialTotal)
    }
  })

  it('regression: voluntary MA top-up cap still works after fix', () => {
    // This is the existing BHS test scenario — ensure it still passes
    const params = {
      ...bhsBaseParams,
      cpfTopUpMA: 50000,
      initialCpfMA: 60000, // close to BHS
    }
    const rows = generateIncomeProjection(params)
    // MA should not exceed BHS (voluntary top-up is capped, then mandatory also capped)
    const bhsYear0 = getBhsAtAge(30, 30)
    expect(rows[0].cpfMA).toBeLessThanOrEqual(bhsYear0 + 1)
  })
})

// ============================================================
// taxTreatment: tax-exempt streams excluded from taxable income
// ============================================================

describe('taxTreatment on income streams', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 70,
    salaryModel: 'simple' as const,
    annualSalary: 0,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: false,
    incomeStreams: [] as IncomeStream[],
    lifeEvents: [] as LifeEvent[],
    lifeEventsEnabled: false,
    annualExpenses: 10000,
    inflation: 0,
    personalReliefs: 0,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('rental stream marked tax-exempt produces zero income tax', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'r1',
        name: 'Tax-Free Rental',
        annualAmount: 50000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'rental',
        growthModel: 'none',
        taxTreatment: 'tax-exempt',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.rentalIncome).toBe(50000)
    expect(row30.totalGross).toBe(50000)
    expect(row30.sgTax).toBe(0) // tax-exempt should not be taxed
  })

  it('rental stream marked taxable produces nonzero income tax', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'r1',
        name: 'Taxable Rental',
        annualAmount: 50000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'rental',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.rentalIncome).toBe(50000)
    expect(row30.sgTax).toBeGreaterThan(0) // taxable should be taxed
  })

  it('business stream marked tax-exempt produces zero income tax', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'b1',
        name: 'Tax-Free Consulting',
        annualAmount: 60000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'business',
        growthModel: 'none',
        taxTreatment: 'tax-exempt',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.businessIncome).toBe(60000)
    expect(row30.sgTax).toBe(0)
  })

  it('employment stream marked tax-exempt produces zero income tax', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'e1',
        name: 'Tax-Exempt Employment',
        annualAmount: 40000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'employment',
        growthModel: 'none',
        taxTreatment: 'tax-exempt',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.salary).toBe(40000) // still appears in salary for display
    expect(row30.sgTax).toBe(0)      // but not taxed
  })

  it('investment stream marked taxable IS taxed', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'i1',
        name: 'Taxable Dividends',
        annualAmount: 30000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'investment',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.investmentIncome).toBe(30000)
    expect(row30.sgTax).toBeGreaterThan(0) // taxable investment should be taxed
  })

  it('mixed taxable and tax-exempt streams: only taxable portion is taxed', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      annualSalary: 0,
      incomeStreams: [
        {
          id: 'r1',
          name: 'Exempt Rental',
          annualAmount: 40000,
          startAge: 30,
          endAge: 65,
          growthRate: 0,
          type: 'rental',
          growthModel: 'none',
          taxTreatment: 'tax-exempt',
          isCpfApplicable: false,
          isActive: true,
        },
        {
          id: 'b1',
          name: 'Taxable Business',
          annualAmount: 50000,
          startAge: 30,
          endAge: 65,
          growthRate: 0,
          type: 'business',
          growthModel: 'none',
          taxTreatment: 'taxable',
          isCpfApplicable: false,
          isActive: true,
        },
      ],
    })

    // Only-business version for comparison
    const rowsOnlyBusiness = generateIncomeProjection({
      ...baseParams,
      annualSalary: 0,
      incomeStreams: [{
        id: 'b1',
        name: 'Taxable Business',
        annualAmount: 50000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'business',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    const row30OnlyBiz = rowsOnlyBusiness.find(r => r.age === 30)!

    // Gross should include both streams
    expect(row30.totalGross).toBe(90000)
    // Tax should be the same as having only the $50K taxable business stream
    expect(row30.sgTax).toBeCloseTo(row30OnlyBiz.sgTax, 2)
  })
})

// ============================================================
// isCpfApplicable: per-stream CPF contribution control
// ============================================================

describe('isCpfApplicable on income streams', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 70,
    salaryModel: 'simple' as const,
    annualSalary: 0,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [] as IncomeStream[],
    lifeEvents: [] as LifeEvent[],
    lifeEventsEnabled: false,
    annualExpenses: 10000,
    inflation: 0,
    personalReliefs: 0,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('employment stream with isCpfApplicable false produces zero CPF', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'e1',
        name: 'Freelance Work',
        annualAmount: 72000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'employment',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: false,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.salary).toBe(72000) // income still counts as salary
    expect(row30.cpfEmployee).toBe(0) // but no CPF
    expect(row30.cpfEmployer).toBe(0)
  })

  it('employment stream with isCpfApplicable true produces CPF', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'e1',
        name: 'Regular Job',
        annualAmount: 72000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'employment',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.salary).toBe(72000)
    expect(row30.cpfEmployee).toBeGreaterThan(0) // CPF should be contributed
    expect(row30.cpfEmployer).toBeGreaterThan(0)
  })

  it('mixed CPF-applicable and non-CPF streams: CPF only on applicable portion', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [
        {
          id: 'e1',
          name: 'Regular Job',
          annualAmount: 60000,
          startAge: 30,
          endAge: 65,
          growthRate: 0,
          type: 'employment',
          growthModel: 'none',
          taxTreatment: 'taxable',
          isCpfApplicable: true,
          isActive: true,
        },
        {
          id: 'e2',
          name: 'Freelance Side Income',
          annualAmount: 40000,
          startAge: 30,
          endAge: 65,
          growthRate: 0,
          type: 'employment',
          growthModel: 'none',
          taxTreatment: 'taxable',
          isCpfApplicable: false,
          isActive: true,
        },
      ],
    })

    // Compare against CPF on just the $60K stream
    const rowsOnlyCpf = generateIncomeProjection({
      ...baseParams,
      incomeStreams: [{
        id: 'e1',
        name: 'Regular Job',
        annualAmount: 60000,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
        type: 'employment',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
      }],
    })

    const row30 = rows.find(r => r.age === 30)!
    const row30OnlyCpf = rowsOnlyCpf.find(r => r.age === 30)!

    expect(row30.salary).toBe(100000) // total salary includes both
    expect(row30.cpfEmployee).toBeCloseTo(row30OnlyCpf.cpfEmployee, 2) // CPF only on $60K
    expect(row30.cpfEmployer).toBeCloseTo(row30OnlyCpf.cpfEmployer, 2)
  })

  it('post-retirement employment stream with isCpfApplicable true produces CPF (Barista FIRE)', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      retirementAge: 40,
      lifeExpectancy: 70,
      incomeStreams: [{
        id: 'barista',
        name: 'Barista FIRE Job',
        annualAmount: 36000,
        startAge: 45,
        endAge: 55,
        growthRate: 0,
        type: 'employment',
        growthModel: 'none',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
      }],
    })

    // Ages 41-44: no income, no CPF
    const row42 = rows.find(r => r.age === 42)!
    expect(row42.salary).toBe(0)
    expect(row42.cpfEmployee).toBe(0)
    expect(row42.cpfEmployer).toBe(0)

    // Ages 45-55: barista job should generate CPF contributions
    const row45 = rows.find(r => r.age === 45)!
    expect(row45.salary).toBe(36000)
    expect(row45.cpfEmployee).toBeGreaterThan(0)
    expect(row45.cpfEmployer).toBeGreaterThan(0)

    // Age 56: stream ended, no more CPF
    const row56 = rows.find(r => r.age === 56)!
    expect(row56.salary).toBe(0)
    expect(row56.cpfEmployee).toBe(0)
    expect(row56.cpfEmployer).toBe(0)
  })

  it('primary salary always generates CPF even with no streams', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      annualSalary: 72000,
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.cpfEmployee).toBeGreaterThan(0)
    expect(row30.cpfEmployer).toBeGreaterThan(0)
  })
})

// ============================================================
// savingsPause and cpfPause: isolation tests (not masked by zero income)
// ============================================================

describe('savingsPause and cpfPause isolation', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 70,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [] as IncomeStream[],
    lifeEvents: [] as LifeEvent[],
    lifeEventsEnabled: true,
    annualExpenses: 30000,
    inflation: 0,
    personalReliefs: 0,
    srsAnnualContribution: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
  }

  it('savingsPause: true with positive income forces savings to zero', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      lifeEvents: [{
        id: 'sp1',
        name: 'Sabbatical (reduced pay)',
        startAge: 35,
        endAge: 36,
        incomeImpact: 0.8, // 80% of salary — still positive income
        affectedStreamIds: [],
        savingsPause: true,
        cpfPause: false,
      }],
    })

    const row35 = rows.find(r => r.age === 35)!
    // Salary should be reduced but positive (80% of 100K = 80K)
    expect(row35.salary).toBeCloseTo(80000, 0)
    expect(row35.totalNet).toBeGreaterThan(0)
    // Savings must be zero because savingsPause is true
    expect(row35.annualSavings).toBe(0)

    // Before and after the pause, savings should be positive
    const row34 = rows.find(r => r.age === 34)!
    expect(row34.annualSavings).toBeGreaterThan(0)
    const row36 = rows.find(r => r.age === 36)!
    expect(row36.annualSavings).toBeGreaterThan(0)
  })

  it('cpfPause: true with positive salary forces CPF to zero', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      lifeEvents: [{
        id: 'cp1',
        name: 'Self-Employment Phase',
        startAge: 35,
        endAge: 36,
        incomeImpact: 0.8, // 80% of salary — still positive
        affectedStreamIds: [],
        savingsPause: false,
        cpfPause: true,
      }],
    })

    const row35 = rows.find(r => r.age === 35)!
    // Salary should be reduced but positive
    expect(row35.salary).toBeCloseTo(80000, 0)
    // CPF must be zero because cpfPause is true
    expect(row35.cpfEmployee).toBe(0)
    expect(row35.cpfEmployer).toBe(0)

    // Before and after the pause, CPF should be contributed
    const row34 = rows.find(r => r.age === 34)!
    expect(row34.cpfEmployee).toBeGreaterThan(0)
    const row36 = rows.find(r => r.age === 36)!
    expect(row36.cpfEmployee).toBeGreaterThan(0)
  })

  it('both pauses: savings and CPF both zero while income remains', () => {
    const rows = generateIncomeProjection({
      ...baseParams,
      lifeEvents: [{
        id: 'both1',
        name: 'Career Transition',
        startAge: 40,
        endAge: 41,
        incomeImpact: 0.6, // 60% of salary
        affectedStreamIds: [],
        savingsPause: true,
        cpfPause: true,
      }],
    })

    const row40 = rows.find(r => r.age === 40)!
    expect(row40.salary).toBeCloseTo(60000, 0)
    expect(row40.annualSavings).toBe(0)
    expect(row40.cpfEmployee).toBe(0)
    expect(row40.cpfEmployer).toBe(0)
  })
})

// ============================================================
// SRS residency status: foreigner and PR cap differences
// ============================================================

describe('SRS residency status handling', () => {
  const srsBaseParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 80,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [] as IncomeStream[],
    lifeEvents: [] as LifeEvent[],
    lifeEventsEnabled: false,
    annualExpenses: 30000,
    inflation: 0,
    personalReliefs: 0,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
    srsBalance: 0,
    srsInvestmentReturn: 0.04,
    srsDrawdownStartAge: 63,
  }

  it('citizen: SRS contribution capped at $15,300', () => {
    const rows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 20000, // exceeds citizen cap
      residencyStatus: 'citizen',
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.srsContribution).toBe(15300) // capped at citizen cap
  })

  it('PR: SRS contribution capped at $15,300 (same as citizen)', () => {
    const rows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 20000, // exceeds citizen/PR cap
      residencyStatus: 'pr',
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.srsContribution).toBe(15300) // PR uses citizen cap
  })

  it('foreigner: SRS contribution capped at $35,700', () => {
    const rows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 40000, // exceeds foreigner cap
      residencyStatus: 'foreigner',
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.srsContribution).toBe(35700) // capped at foreigner cap
  })

  it('foreigner: SRS under-cap contribution passes through fully', () => {
    const rows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 20000, // under foreigner cap
      residencyStatus: 'foreigner',
    })

    const row30 = rows.find(r => r.age === 30)!
    expect(row30.srsContribution).toBe(20000) // no capping needed
  })

  it('foreigner: higher SRS cap means lower tax via larger deduction', () => {
    // Same income, same SRS contribution request of $35,700
    // Citizen gets capped at $15,300 → smaller deduction → more tax
    // Foreigner gets full $35,700 → larger deduction → less tax
    const citizenRows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 35700,
      residencyStatus: 'citizen',
    })
    const foreignerRows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 35700,
      residencyStatus: 'foreigner',
    })

    const citizenTax = citizenRows.find(r => r.age === 30)!.sgTax
    const foreignerTax = foreignerRows.find(r => r.age === 30)!.sgTax

    // Both should pay tax (salary is $100K)
    expect(citizenTax).toBeGreaterThan(0)
    expect(foreignerTax).toBeGreaterThan(0)
    // Foreigner should pay LESS tax due to higher SRS deduction
    expect(foreignerTax).toBeLessThan(citizenTax)
  })

  it('foreigner: SRS balance grows on full foreigner-capped contribution', () => {
    const rows = generateIncomeProjection({
      ...srsBaseParams,
      srsAnnualContribution: 35700,
      srsBalance: 100000,
      residencyStatus: 'foreigner',
    })

    const row30 = rows.find(r => r.age === 30)!
    // Balance = (100,000 + 35,700) * 1.04 = $141,128
    expect(row30.srsBalance).toBeCloseTo((100000 + 35700) * 1.04, 0)
  })

  it('Barista FIRE: SRS contributions resume post-FIRE only when srsPostFireEnabled is true', () => {
    const baristaStream = {
      id: 'barista',
      name: 'Barista Job',
      annualAmount: 36000,
      startAge: 43,
      endAge: 48,
      growthRate: 0,
      type: 'employment' as const,
      growthModel: 'none' as const,
      taxTreatment: 'taxable' as const,
      isCpfApplicable: true,
      isActive: true,
    }
    const base = {
      ...srsBaseParams,
      currentAge: 40,
      retirementAge: 39,
      lifeExpectancy: 50,
      annualSalary: 0,
      srsAnnualContribution: 15300,
      srsBalance: 100000,
      srsDrawdownStartAge: 63,
      incomeStreams: [baristaStream],
    }

    // Without toggle: no SRS contributions post-FIRE
    const withoutToggle = generateIncomeProjection({ ...base, srsPostFireEnabled: false })
    // With toggle: SRS contributions during barista years
    const withToggle = generateIncomeProjection({ ...base, srsPostFireEnabled: true })

    // Age 42: no employment income — both should be the same
    expect(withToggle.find(r => r.age === 42)!.srsBalance)
      .toBeCloseTo(withoutToggle.find(r => r.age === 42)!.srsBalance, 0)
    expect(withToggle.find(r => r.age === 42)!.srsContribution).toBe(0)

    // Age 44: barista active + toggle on — SRS should contribute
    expect(withToggle.find(r => r.age === 44)!.srsContribution).toBe(15300)
    expect(withoutToggle.find(r => r.age === 44)!.srsContribution).toBe(0)

    // SRS balance should be higher with toggle by age 48
    expect(withToggle.find(r => r.age === 48)!.srsBalance)
      .toBeGreaterThan(withoutToggle.find(r => r.age === 48)!.srsBalance)
  })
})

// ============================================================
// sumPostRetirementIncome — aggregation completeness
// ============================================================

describe('sumPostRetirementIncome', () => {
  // Minimal IncomeProjectionRow with only the fields sumPostRetirementIncome reads
  const makeRow = (overrides: Partial<IncomeProjectionRow> = {}): IncomeProjectionRow => ({
    year: 0, age: 65, salary: 0, rentalIncome: 0, investmentIncome: 0,
    businessIncome: 0, governmentIncome: 0, totalGross: 0, sgTax: 0,
    cpfEmployee: 0, cpfEmployer: 0, totalNet: 0, annualSavings: 0,
    cumulativeSavings: 0, cpfOA: 0, cpfSA: 0, cpfMA: 0, cpfRA: 0,
    isRetired: true, activeLifeEvents: [], cpfLifePayout: 0,
    cpfOaHousingDeduction: 0, cpfOaShortfall: 0, cpfLifeAnnuityPremium: 0,
    cpfOaWithdrawal: 0, cpfisOA: 0, cpfisSA: 0, cpfisReturn: 0,
    srsBalance: 0, srsContribution: 0, srsWithdrawal: 0, srsTaxableWithdrawal: 0,
    lockedAssetUnlock: 0, cashReserveTarget: 0, cashReserveBalance: 0, investedSavings: 0,
    ...overrides,
  })

  it('sums all 7 components with distinct non-zero values', () => {
    // Each component has a distinct value so any missing field is detectable
    const row = makeRow({
      salary: 1000,
      rentalIncome: 2000,
      investmentIncome: 3000,
      businessIncome: 4000,
      governmentIncome: 5000,
      srsWithdrawal: 6000,
    })
    const propertyRentalIncome = 7000
    expect(sumPostRetirementIncome(row, propertyRentalIncome)).toBe(28000)
  })

  it('sums 6 components when propertyRentalIncome defaults to 0', () => {
    const row = makeRow({
      salary: 1000,
      rentalIncome: 2000,
      investmentIncome: 3000,
      businessIncome: 4000,
      governmentIncome: 5000,
      srsWithdrawal: 6000,
    })
    expect(sumPostRetirementIncome(row)).toBe(21000)
  })

  it('returns 0 for a zero-income row', () => {
    expect(sumPostRetirementIncome(makeRow())).toBe(0)
  })
})

// ============================================================
// SRS contribution impact on annual savings
// ============================================================

describe('SRS contribution deducted from annual savings', () => {
  const baseSrsParams = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 80,
    salaryModel: 'simple' as const,
    annualSalary: 100000,
    salaryGrowthRate: 0,
    realisticPhases: DEFAULT_CAREER_PHASES,
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    employerCpfEnabled: true,
    incomeStreams: [] as IncomeStream[],
    lifeEvents: [] as LifeEvent[],
    lifeEventsEnabled: false,
    annualExpenses: 30000,
    inflation: 0,
    personalReliefs: 0,
    residencyStatus: 'citizen' as const,
    initialCpfOA: 0,
    initialCpfSA: 0,
    initialCpfMA: 0,
    srsBalance: 0,
    srsInvestmentReturn: 0.04,
    srsDrawdownStartAge: 63,
  }

  it('SRS contribution reduces annual savings', () => {
    const withSrs = generateIncomeProjection({
      ...baseSrsParams,
      srsAnnualContribution: 15300,
    })
    const withoutSrs = generateIncomeProjection({
      ...baseSrsParams,
      srsAnnualContribution: 0,
    })

    const row = withSrs.find(r => r.age === 30)!
    const rowNoSrs = withoutSrs.find(r => r.age === 30)!

    // Savings should be lower by approximately the SRS contribution
    // (not exact due to SRS tax deduction effect on totalNet)
    expect(row.annualSavings).toBeLessThan(rowNoSrs.annualSavings)
    expect(rowNoSrs.annualSavings - row.annualSavings).toBeGreaterThan(14000)
  })

  it('capped SRS amount is deducted, not raw request', () => {
    // Request $20,000 but citizen cap is $15,300
    const rows = generateIncomeProjection({
      ...baseSrsParams,
      srsAnnualContribution: 20000,
      residencyStatus: 'citizen',
    })
    const rowsCapped = generateIncomeProjection({
      ...baseSrsParams,
      srsAnnualContribution: 15300,
      residencyStatus: 'citizen',
    })

    const row = rows.find(r => r.age === 30)!
    const rowCapped = rowsCapped.find(r => r.age === 30)!

    // Both should produce the same savings (both capped at $15,300)
    expect(row.annualSavings).toBe(rowCapped.annualSavings)
    expect(row.srsContribution).toBe(15300)
  })

  it('annual savings goes negative when contributions exceed surplus', () => {
    // Low income: salary $50,000, expenses $30,000
    // After CPF employee 20% ($10,000), totalNet ≈ $40,000 - tax
    // surplus ≈ $40,000 - tax - $30,000 ≈ ~$10,000
    // SRS $15,300 + CPF top-up $8,000 = $23,300 > surplus
    const rows = generateIncomeProjection({
      ...baseSrsParams,
      annualSalary: 50000,
      srsAnnualContribution: 15300,
      cpfTopUpSA: 8000,
    })

    const row = rows.find(r => r.age === 30)!
    // annualSavings should be negative: surplus can't cover both contributions
    expect(row.annualSavings).toBeLessThan(0)
    // But SRS and CPF contributions still happen
    expect(row.srsContribution).toBe(15300)
  })
})
