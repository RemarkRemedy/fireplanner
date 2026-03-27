import { describe, it, expect } from 'vitest'
import { buildGoalCalcProjectionParams, deflateProjection } from './goal-calc-adapter'
import type { GoalStoryBasics } from '@/hooks/useGoalStoryData'
import type { GoalCalcGoal } from '@/lib/calculations/goal-calculator'
import { FIRE_MULTIPLIER } from '@/lib/calculations/goal-calculator'
import { lookupCpfLifeEstimate } from '@/lib/calculations/goal-calculator-sg'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import type { ProjectionRow } from '@/lib/types'

// ============================================================
// Fixtures
// ============================================================

function makeSoloBasics(overrides: Partial<GoalStoryBasics> = {}): GoalStoryBasics {
  return {
    age: 30,
    monthlyIncome: 5000,
    monthlyExpenses: 3000,
    existingSavings: 50000,
    ...overrides,
  }
}

function makeCoupleBasics(overrides: Partial<GoalStoryBasics> = {}): GoalStoryBasics {
  return {
    age: 30,
    monthlyIncome: 5000,
    monthlyExpenses: 4000,
    existingSavings: 80000,
    coupleMode: true,
    partnerAge: 28,
    partnerMonthlyIncome: 4000,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<GoalCalcGoal> = {}): GoalCalcGoal {
  return {
    id: 'goal-1',
    category: 'wedding',
    label: 'Wedding',
    targetAge: 32,
    totalCostToday: 30000,
    breakdown: { items: [{ label: 'Total', amount: 30000 }], total: 30000 },
    monthlySavingsNeeded: 1200,
    feasible: true,
    shortfallPerMonth: 0,
    ...overrides,
  }
}

function makeEcGoal(): GoalCalcGoal {
  return {
    id: 'goal-ec',
    category: 'housing',
    label: 'EC Purchase',
    targetAge: 35,
    totalCostToday: 200000,
    breakdown: { items: [{ label: 'Down payment', amount: 200000 }], total: 200000 },
    monthlySavingsNeeded: 3000,
    feasible: true,
    shortfallPerMonth: 0,
    smartInputs: { kind: 'ec', price: 1200000, flatType: '4-room' },
  }
}

/** Minimal ProjectionRow stub with only the fields deflateProjection reads. */
function makeProjectionRow(age: number, liquidNW: number): ProjectionRow {
  return {
    age,
    year: 0,
    isRetired: false,
    totalIncome: 0,
    annualExpenses: 0,
    savingsOrWithdrawal: 0,
    portfolioReturnDollar: 0,
    portfolioReturnPct: 0,
    liquidNW,
    cpfTotal: 0,
    totalNW: 0,
    fireProgress: 0,
    salary: 0,
    rentalIncome: 0,
    investmentIncome: 0,
    businessIncome: 0,
    governmentIncome: 0,
    srsWithdrawal: 0,
    totalGross: 0,
    sgTax: 0,
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
    totalNWIncProperty: 0,
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
    allocationWeights: [],
    targetAllocationWeights: [],
    insurancePremiumExpense: 0,
    debtPaymentExpense: 0,
    expenseAdjustmentAmount: 0,
    lifeEventExpenseImpact: 0,
    cumulativeSavings: 0,
    activeLifeEvents: [],
  } as ProjectionRow
}

// ============================================================
// Tests
// ============================================================

describe('buildGoalCalcProjectionParams', () => {
  describe('solo basic', () => {
    it('should populate all required ProjectionParams fields', () => {
      const basics = makeSoloBasics()
      const goals = [makeGoal()]
      const params = buildGoalCalcProjectionParams(basics, goals)

      // Core fields
      expect(params.currentAge).toBe(30)
      expect(params.lifeExpectancy).toBe(85)
      expect(params.swr).toBe(0.035)
      expect(params.expectedReturn).toBe(0.05)
      expect(params.inflation).toBe(0.025)
      expect(params.expenseRatio).toBe(0.005)
      expect(params.usePortfolioReturn).toBe(true)
      expect(params.retirementSpendingAdjustment).toBe(1.0)
      expect(params.annualExpenses).toBe(3000 * 12)

      // Income projection is non-empty
      expect(params.incomeProjection.length).toBeGreaterThan(0)

      // Weights are 8 elements
      expect(params.currentWeights).toHaveLength(8)
      expect(params.targetWeights).toHaveLength(8)
      expect(params.assetReturns).toHaveLength(8)

      // Property fields zeroed
      expect(params.propertyEquity).toBe(0)
      expect(params.annualMortgagePayment).toBe(0)
      expect(params.existingPropertyValue).toBe(0)
      expect(params.downsizing).toBeNull()

      // Withdrawal
      expect(params.withdrawalStrategy).toBe('constant_dollar')
      expect(params.withdrawalBasis).toBe('expenses')

      // Glide path disabled
      expect(params.glidePathConfig.enabled).toBe(false)

      // CPF LIFE
      expect(params.cpfLifeStartAge).toBe(65)
      expect(params.cpfLifePlan).toBe('standard')

      // Healthcare
      expect(params.healthcareConfig).toBeNull()

      // Parent support
      expect(params.parentSupport).toEqual([])
      expect(params.parentSupportEnabled).toBe(false)
    })

    it('should map financial goals correctly', () => {
      const basics = makeSoloBasics()
      const goal = makeGoal()
      const params = buildGoalCalcProjectionParams(basics, [goal])

      expect(params.financialGoals).toHaveLength(1)
      const fg = params.financialGoals![0]
      expect(fg.id).toBe('goal-1')
      expect(fg.label).toBe('Wedding')
      expect(fg.amount).toBe(30000)
      expect(fg.targetAge).toBe(32)
      expect(fg.durationYears).toBe(1)
      expect(fg.priority).toBe('important')
      expect(fg.inflationAdjusted).toBe(true)
      expect(fg.category).toBe('wedding')
    })
  })

  describe('retirement age and FIRE number', () => {
    it('should use fixed income-stop age of 65 (not Freedom Age)', () => {
      const basics = makeSoloBasics()
      const goals = [makeGoal()]
      const params = buildGoalCalcProjectionParams(basics, goals)

      // retirementAge = fixed at 65 for the projection (income stops here)
      // Freedom Age is a separate marker on the chart, not used for income cutoff
      expect(params.retirementAge).toBe(65)
    })

    it('should use age+1 when current age is 65 or older', () => {
      const basics = makeSoloBasics({ age: 67 })
      const goals: GoalCalcGoal[] = []
      const params = buildGoalCalcProjectionParams(basics, goals)

      expect(params.retirementAge).toBe(68)
    })

    it('should compute fireNumber as annualExpenses * FIRE_MULTIPLIER minus CPF LIFE offset', () => {
      const basics = makeSoloBasics()
      const goals: GoalCalcGoal[] = []
      const params = buildGoalCalcProjectionParams(basics, goals)

      const grossIncome = grossUpFromTakeHome(basics.monthlyIncome, basics.age)
      const cpfLifeMonthly = lookupCpfLifeEstimate(grossIncome)
      const cpfLifeOffset = cpfLifeMonthly * 12 * FIRE_MULTIPLIER
      const expectedFireNumber = Math.max(0, basics.monthlyExpenses * 12 * FIRE_MULTIPLIER - cpfLifeOffset)

      expect(params.fireNumber).toBeCloseTo(expectedFireNumber, 0)
    })

    it('should have inflation of 0.025', () => {
      const basics = makeSoloBasics()
      const params = buildGoalCalcProjectionParams(basics, [])
      expect(params.inflation).toBe(0.025)
    })
  })

  describe('couple mode', () => {
    it('should merge two income projections when couple mode is active', () => {
      const basics = makeCoupleBasics()
      const goals = [makeGoal()]
      const params = buildGoalCalcProjectionParams(basics, goals)

      // Income projection should be non-empty
      expect(params.incomeProjection.length).toBeGreaterThan(0)

      // The first row's salary should include both adults' income
      // (two separate income projections merged)
      const firstRow = params.incomeProjection[0]
      expect(firstRow.salary).toBeGreaterThan(0)
    })

    it('couple mode annualSavings deducts expenses once, not twice', () => {
      // Each adult earns $5000/mo (couple) and $4000/mo expenses
      // With double-deduction bug, each adult would have expenses subtracted,
      // then merged savings = (A.net - expenses) + (B.net - expenses) — too low.
      // After fix: merged savings = (A.net + B.net) - expenses — expenses once.
      const basics = makeCoupleBasics()
      const params = buildGoalCalcProjectionParams(basics, [])
      const firstRow = params.incomeProjection[0]

      // Compute what solo would look like for each adult
      const soloA = buildGoalCalcProjectionParams(
        makeSoloBasics({ monthlyIncome: 5000, monthlyExpenses: 4000 }),
        [],
      )
      const soloB = buildGoalCalcProjectionParams(
        makeSoloBasics({ age: 28, monthlyIncome: 4000, monthlyExpenses: 4000 }),
        [],
      )

      // If expenses were deducted twice, couple savings would be:
      // soloA.savings + soloB.savings (each already has expenses deducted)
      // minus another expenses deduction — clearly too low.
      // Correct couple savings: (A.totalNet + B.totalNet) - expenses(once)
      const doubleDeductedSavings =
        soloA.incomeProjection[0].annualSavings + soloB.incomeProjection[0].annualSavings

      // Couple savings should be HIGHER than double-deducted (one fewer expense subtraction)
      // because double-deducted has expenses removed from each adult separately
      expect(firstRow.annualSavings).toBeGreaterThan(doubleDeductedSavings)

      // Verify savings = combined totalNet - household expenses (at year 0, no inflation)
      const expectedSavings = firstRow.totalNet - basics.monthlyExpenses * 12
      expect(firstRow.annualSavings).toBeCloseTo(expectedSavings, -1)
    })

    it('should detect couple mode from partnerAge even without explicit coupleMode flag', () => {
      const basics = makeSoloBasics({ partnerAge: 28, partnerMonthlyIncome: 3000 })
      const params = buildGoalCalcProjectionParams(basics, [])

      // Should produce merged income projections (higher total salary)
      const soloParams = buildGoalCalcProjectionParams(makeSoloBasics(), [])

      // Couple should have higher salary in first row
      expect(params.incomeProjection[0].salary).toBeGreaterThan(
        soloParams.incomeProjection[0].salary,
      )
    })
  })

  describe('multi-goal', () => {
    it('should map all goals to financialGoals array', () => {
      const basics = makeSoloBasics()
      const goals = [
        makeGoal({ id: 'g1', label: 'Wedding', targetAge: 32 }),
        makeGoal({ id: 'g2', label: 'Car', category: 'vehicle', targetAge: 35, totalCostToday: 80000 }),
        makeGoal({ id: 'g3', label: 'Travel', category: 'travel', targetAge: 33, totalCostToday: 10000 }),
      ]
      const params = buildGoalCalcProjectionParams(basics, goals)

      expect(params.financialGoals).toHaveLength(3)
      expect(params.financialGoals!.map((g) => g.id)).toEqual(['g1', 'g2', 'g3'])
    })
  })

  describe('EC goal', () => {
    it('should map EC goal to FinancialGoal correctly', () => {
      const basics = makeSoloBasics()
      const ecGoal = makeEcGoal()
      const params = buildGoalCalcProjectionParams(basics, [ecGoal])

      expect(params.financialGoals).toHaveLength(1)
      const fg = params.financialGoals![0]
      expect(fg.id).toBe('goal-ec')
      expect(fg.label).toBe('EC Purchase')
      expect(fg.amount).toBe(200000)
      expect(fg.targetAge).toBe(35)
      expect(fg.category).toBe('housing')
      expect(fg.inflationAdjusted).toBe(true)
    })
  })

  describe('gross income derivation', () => {
    it('should use grossIncome when provided', () => {
      const basics = makeSoloBasics({ grossIncome: 8000 })
      const params = buildGoalCalcProjectionParams(basics, [])

      // First row salary should be based on gross income * 12
      // (with CPF deductions applied, it won't equal 8000*12 exactly)
      expect(params.incomeProjection[0].salary).toBeGreaterThan(0)
    })

    it('should gross up from take-home when grossIncome is not provided', () => {
      const basics = makeSoloBasics({ monthlyIncome: 5000 })
      const params = buildGoalCalcProjectionParams(basics, [])

      const expectedGross = grossUpFromTakeHome(5000, 30)
      // The income projection should use the grossed-up salary
      expect(params.incomeProjection[0].salary).toBeCloseTo(expectedGross * 12, -1)
    })
  })
})

describe('deflateProjection', () => {
  it('should return same value at startAge (year 0)', () => {
    const rows = [makeProjectionRow(30, 100000)]
    const result = deflateProjection(rows, 0.025, 30)
    expect(result).toHaveLength(1)
    expect(result[0].age).toBe(30)
    expect(result[0].netWorth).toBeCloseTo(100000, 2)
  })

  it('should deflate correctly at year 10 with 2.5% inflation', () => {
    const nominalValue = 100000
    const rows = [makeProjectionRow(40, nominalValue)]
    const result = deflateProjection(rows, 0.025, 30)

    const expectedReal = nominalValue / Math.pow(1.025, 10)
    expect(result[0].age).toBe(40)
    expect(result[0].netWorth).toBeCloseTo(expectedReal, 2)
  })

  it('should handle multiple rows correctly', () => {
    const rows = [
      makeProjectionRow(30, 100000),
      makeProjectionRow(31, 110000),
      makeProjectionRow(32, 121000),
    ]
    const result = deflateProjection(rows, 0.025, 30)

    expect(result).toHaveLength(3)
    expect(result[0].netWorth).toBeCloseTo(100000, 2) // year 0 deflator = 1
    expect(result[1].netWorth).toBeCloseTo(110000 / 1.025, 2) // year 1
    expect(result[2].netWorth).toBeCloseTo(121000 / Math.pow(1.025, 2), 2) // year 2
  })

  it('should handle 0% inflation as no-op', () => {
    const rows = [
      makeProjectionRow(30, 100000),
      makeProjectionRow(50, 500000),
    ]
    const result = deflateProjection(rows, 0, 30)

    expect(result[0].netWorth).toBeCloseTo(100000, 2)
    expect(result[1].netWorth).toBeCloseTo(500000, 2)
  })

  it('should handle empty rows', () => {
    const result = deflateProjection([], 0.025, 30)
    expect(result).toHaveLength(0)
  })
})
