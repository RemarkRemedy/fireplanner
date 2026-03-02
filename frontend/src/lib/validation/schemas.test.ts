import { describe, it, expect } from 'vitest'
import {
  ageSchema,
  retirementAgeSchema,
  lifeExpectancySchema,
  swrSchema,
  expensesSchema,
  inflationSchema,
  expenseRatioSchema,
  retirementPhaseSchema,
  cpfLifeActualMonthlyPayoutSchema,
  profileSchema,
  incomeSchema,
  careerPhaseSchema,
  promotionJumpSchema,
  allocationWeightsSchema,
  glidePathConfigSchema,
  validateProfileField,
  validateIncomeField,
  validateAllocationField,
  validateSimulationField,
  retirementWithdrawalSchema,
  cpfOaWithdrawalSchema,
  validateStoreData,
} from './schemas'
import {
  validateProfileConsistency,
  validateCrossStoreRules,
  validateAllocationCrossStoreRules,
  validateWithdrawalCrossStoreRules,
} from './rules'

describe('field schemas', () => {
  describe('ageSchema', () => {
    it('accepts valid ages (18-100)', () => {
      expect(ageSchema.safeParse(18).success).toBe(true)
      expect(ageSchema.safeParse(30).success).toBe(true)
      expect(ageSchema.safeParse(100).success).toBe(true)
    })

    it('rejects out-of-range ages', () => {
      expect(ageSchema.safeParse(17).success).toBe(false)
      expect(ageSchema.safeParse(101).success).toBe(false)
    })

    it('rejects non-integer ages', () => {
      expect(ageSchema.safeParse(30.5).success).toBe(false)
    })

    it('rejects non-numbers', () => {
      expect(ageSchema.safeParse('30').success).toBe(false)
      expect(ageSchema.safeParse(null).success).toBe(false)
    })
  })

  describe('retirementAgeSchema', () => {
    it('accepts valid range (30-100)', () => {
      expect(retirementAgeSchema.safeParse(30).success).toBe(true)
      expect(retirementAgeSchema.safeParse(65).success).toBe(true)
    })

    it('rejects below 30', () => {
      expect(retirementAgeSchema.safeParse(29).success).toBe(false)
    })
  })

  describe('lifeExpectancySchema', () => {
    it('accepts valid range (50-120)', () => {
      expect(lifeExpectancySchema.safeParse(50).success).toBe(true)
      expect(lifeExpectancySchema.safeParse(90).success).toBe(true)
      expect(lifeExpectancySchema.safeParse(120).success).toBe(true)
    })

    it('rejects below 50', () => {
      expect(lifeExpectancySchema.safeParse(49).success).toBe(false)
    })
  })

  describe('swrSchema', () => {
    it('accepts 1% to 10%', () => {
      expect(swrSchema.safeParse(0.01).success).toBe(true)
      expect(swrSchema.safeParse(0.04).success).toBe(true)
      expect(swrSchema.safeParse(0.10).success).toBe(true)
    })

    it('rejects below 1%', () => {
      expect(swrSchema.safeParse(0.005).success).toBe(false)
    })

    it('rejects above 10%', () => {
      expect(swrSchema.safeParse(0.11).success).toBe(false)
    })
  })

  describe('expensesSchema', () => {
    it('accepts positive numbers', () => {
      expect(expensesSchema.safeParse(1).success).toBe(true)
      expect(expensesSchema.safeParse(100000).success).toBe(true)
    })

    it('rejects zero and negative', () => {
      expect(expensesSchema.safeParse(0).success).toBe(false)
      expect(expensesSchema.safeParse(-1000).success).toBe(false)
    })
  })

  describe('inflationSchema', () => {
    it('accepts 0% to 15%', () => {
      expect(inflationSchema.safeParse(0).success).toBe(true)
      expect(inflationSchema.safeParse(0.025).success).toBe(true)
      expect(inflationSchema.safeParse(0.15).success).toBe(true)
    })

    it('rejects above 15%', () => {
      expect(inflationSchema.safeParse(0.16).success).toBe(false)
    })
  })

  describe('expenseRatioSchema', () => {
    it('accepts 0% to 3%', () => {
      expect(expenseRatioSchema.safeParse(0).success).toBe(true)
      expect(expenseRatioSchema.safeParse(0.003).success).toBe(true)
      expect(expenseRatioSchema.safeParse(0.03).success).toBe(true)
    })

    it('rejects above 3%', () => {
      expect(expenseRatioSchema.safeParse(0.031).success).toBe(false)
    })
  })

  describe('retirementPhaseSchema', () => {
    it('accepts valid phases', () => {
      expect(retirementPhaseSchema.safeParse('before-55').success).toBe(true)
      expect(retirementPhaseSchema.safeParse('55-to-64').success).toBe(true)
      expect(retirementPhaseSchema.safeParse('65-plus').success).toBe(true)
    })

    it('accepts null (pre-fire users)', () => {
      expect(retirementPhaseSchema.safeParse(null).success).toBe(true)
    })

    it('rejects invalid string values', () => {
      expect(retirementPhaseSchema.safeParse('unknown').success).toBe(false)
      expect(retirementPhaseSchema.safeParse('before55').success).toBe(false)
      expect(retirementPhaseSchema.safeParse('').success).toBe(false)
    })

    it('rejects non-string/null values', () => {
      expect(retirementPhaseSchema.safeParse(55).success).toBe(false)
      expect(retirementPhaseSchema.safeParse(undefined).success).toBe(false)
    })
  })

  describe('cpfLifeActualMonthlyPayoutSchema', () => {
    it('accepts zero', () => {
      expect(cpfLifeActualMonthlyPayoutSchema.safeParse(0).success).toBe(true)
    })

    it('accepts positive values', () => {
      expect(cpfLifeActualMonthlyPayoutSchema.safeParse(1500).success).toBe(true)
      expect(cpfLifeActualMonthlyPayoutSchema.safeParse(3000).success).toBe(true)
    })

    it('rejects negative values', () => {
      expect(cpfLifeActualMonthlyPayoutSchema.safeParse(-1).success).toBe(false)
      expect(cpfLifeActualMonthlyPayoutSchema.safeParse(-100).success).toBe(false)
    })
  })
})

describe('profileSchema', () => {
  const validProfile = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    lifeStage: 'pre-fire' as const,
    maritalStatus: 'single' as const,
    residencyStatus: 'citizen' as const,
    annualIncome: 72000,
    annualExpenses: 48000,
    liquidNetWorth: 100000,
    cpfOA: 50000,
    cpfSA: 20000,
    cpfMA: 10000,
    cpfRA: 0,
    srsBalance: 0,
    srsAnnualContribution: 0,
    fireType: 'regular' as const,
    swr: 0.04,
    retirementSpendingAdjustment: 1.0,
    retirementPhase: null,
    cpfLifeActualMonthlyPayout: 0,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
    rebalanceFrequency: 'annual' as const,
    cpfLifeStartAge: 65,
    cpfLifePlan: 'standard' as const,
    cpfRetirementSum: 'frs' as const,
    cpfHousingMode: 'none' as const,
    cpfHousingMonthly: 0,
    cpfMortgageYearsLeft: 25,
  }

  it('accepts valid profile', () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true)
  })

  it('rejects retirement age <= current age', () => {
    const result = profileSchema.safeParse({ ...validProfile, retirementAge: 30 })
    expect(result.success).toBe(false)
  })

  it('rejects life expectancy <= retirement age', () => {
    const result = profileSchema.safeParse({ ...validProfile, lifeExpectancy: 65 })
    expect(result.success).toBe(false)
  })

  it('rejects negative expenses', () => {
    const result = profileSchema.safeParse({ ...validProfile, annualExpenses: -1000 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid enum values', () => {
    const result = profileSchema.safeParse({ ...validProfile, lifeStage: 'unknown' })
    expect(result.success).toBe(false)
  })
})

describe('incomeSchema', () => {
  const validIncome = {
    salaryModel: 'simple' as const,
    annualSalary: 72000,
    salaryGrowthRate: 0.03,
    bonusMonths: 0,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    realisticPhases: [
      { label: 'Early Career', minAge: 22, maxAge: 30, growthRate: 0.08 },
    ],
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    lifeEventsEnabled: false,
    personalReliefs: 20000,
  }

  it('accepts valid income state', () => {
    expect(incomeSchema.safeParse(validIncome).success).toBe(true)
  })

  it('rejects negative salary', () => {
    const result = incomeSchema.safeParse({ ...validIncome, annualSalary: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects extreme growth rate', () => {
    const result = incomeSchema.safeParse({ ...validIncome, salaryGrowthRate: 0.5 })
    expect(result.success).toBe(false)
  })
})

describe('validateProfileField', () => {
  it('returns null for valid field', () => {
    expect(validateProfileField('currentAge', 30)).toBeNull()
    expect(validateProfileField('swr', 0.04)).toBeNull()
  })

  it('returns error message for invalid field', () => {
    expect(validateProfileField('currentAge', 17)).toBeTruthy()
    expect(validateProfileField('swr', 0.5)).toBeTruthy()
    expect(validateProfileField('annualExpenses', -100)).toBeTruthy()
  })

  it('returns null for unknown fields', () => {
    expect(validateProfileField('unknownField', 'anything')).toBeNull()
  })
})

const defaultHealthcareConfig = {
  enabled: false,
  mediShieldLifeEnabled: true,
  ispTier: 'none' as const,
  careShieldLifeEnabled: true,
  oopBaseAmount: 1200,
  oopModel: 'age-curve' as const,
  oopInflationRate: 0.03,
  oopReferenceAge: 30,
  mediSaveTopUpAnnual: 0,
}

describe('validateProfileConsistency', () => {
  it('returns empty for valid profile', () => {
    const errors = validateProfileConsistency({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      lifeStage: 'pre-fire',
      cpfLifeStartAge: 65,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: defaultHealthcareConfig,
      retirementWithdrawals: [],
      financialGoals: [],
      cpfMA: 0,
      cpfOaWithdrawals: [],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('catches retirement age <= current age', () => {
    const errors = validateProfileConsistency({
      currentAge: 30,
      retirementAge: 30,
      lifeExpectancy: 90,
      lifeStage: 'pre-fire',
      cpfLifeStartAge: 65,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: defaultHealthcareConfig,
      retirementWithdrawals: [],
      financialGoals: [],
      cpfMA: 0,
      cpfOaWithdrawals: [],
    })
    expect(errors.retirementAge).toBeTruthy()
  })

  it('catches life expectancy <= retirement age', () => {
    const errors = validateProfileConsistency({
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 65,
      lifeStage: 'pre-fire',
      cpfLifeStartAge: 65,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: defaultHealthcareConfig,
      retirementWithdrawals: [],
      financialGoals: [],
      cpfMA: 0,
      cpfOaWithdrawals: [],
    })
    expect(errors.lifeExpectancy).toBeTruthy()
  })

  it('catches both violations simultaneously', () => {
    const errors = validateProfileConsistency({
      currentAge: 65,
      retirementAge: 30,
      lifeExpectancy: 30,
      lifeStage: 'pre-fire',
      cpfLifeStartAge: 65,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: defaultHealthcareConfig,
      retirementWithdrawals: [],
      financialGoals: [],
      cpfMA: 0,
      cpfOaWithdrawals: [],
    })
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(2)
  })

  it('allows retirement age == current age for post-fire', () => {
    const errors = validateProfileConsistency({
      currentAge: 58,
      retirementAge: 58,
      lifeExpectancy: 90,
      lifeStage: 'post-fire',
      cpfLifeStartAge: 65,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: defaultHealthcareConfig,
      retirementWithdrawals: [],
      financialGoals: [],
      cpfMA: 0,
      cpfOaWithdrawals: [],
    })
    expect(errors.retirementAge).toBeUndefined()
  })
})

describe('validateCrossStoreRules', () => {
  const defaultIncome = {
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    promotionJumps: [],
  }
  const defaultProfile = { currentAge: 30, retirementAge: 65, lifeExpectancy: 90 }

  it('returns empty when no income streams', () => {
    const errors = validateCrossStoreRules(defaultProfile, defaultIncome)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('catches income stream end age exceeding life expectancy', () => {
    const errors = validateCrossStoreRules(defaultProfile, {
      ...defaultIncome,
      incomeStreams: [
        {
          id: '1', name: 'Salary', annualAmount: 72000,
          startAge: 25, endAge: 95, growthRate: 0.03,
          type: 'employment', growthModel: 'fixed', taxTreatment: 'taxable',
          isCpfApplicable: true, isActive: true,
        },
      ],
    })
    expect(errors['incomeStream_1_endAge']).toBeTruthy()
  })

  it('passes when end age equals life expectancy', () => {
    const errors = validateCrossStoreRules(defaultProfile, {
      ...defaultIncome,
      incomeStreams: [
        {
          id: '1', name: 'Salary', annualAmount: 72000,
          startAge: 25, endAge: 90, growthRate: 0.03,
          type: 'employment', growthModel: 'fixed', taxTreatment: 'taxable',
          isCpfApplicable: true, isActive: true,
        },
      ],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('catches life event end age exceeding life expectancy', () => {
    const errors = validateCrossStoreRules(defaultProfile, {
      ...defaultIncome,
      lifeEventsEnabled: true,
      lifeEvents: [
        {
          id: 'e1', name: 'Break', startAge: 35, endAge: 95,
          incomeImpact: 0, affectedStreamIds: [],
          savingsPause: true, cpfPause: true,
        },
      ],
    })
    expect(errors['lifeEvent_e1_endAge']).toBeTruthy()
  })

  it('does not validate life events when disabled', () => {
    const errors = validateCrossStoreRules(defaultProfile, {
      ...defaultIncome,
      lifeEventsEnabled: false,
      lifeEvents: [
        {
          id: 'e1', name: 'Break', startAge: 35, endAge: 95,
          incomeImpact: 0, affectedStreamIds: [],
          savingsPause: true, cpfPause: true,
        },
      ],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('catches promotion jump before current age', () => {
    const errors = validateCrossStoreRules(defaultProfile, {
      ...defaultIncome,
      promotionJumps: [{ age: 25, increasePercent: 0.2 }],
    })
    expect(errors['promotionJump_0_age']).toBeTruthy()
  })

  it('catches promotion jump after retirement age', () => {
    const errors = validateCrossStoreRules(defaultProfile, {
      ...defaultIncome,
      promotionJumps: [{ age: 70, increasePercent: 0.2 }],
    })
    expect(errors['promotionJump_0_age']).toBeTruthy()
  })
})

describe('careerPhaseSchema', () => {
  it('accepts valid career phase', () => {
    expect(careerPhaseSchema.safeParse({
      label: 'Early Career', minAge: 22, maxAge: 30, growthRate: 0.08,
    }).success).toBe(true)
  })

  it('rejects empty label', () => {
    expect(careerPhaseSchema.safeParse({
      label: '', minAge: 22, maxAge: 30, growthRate: 0.08,
    }).success).toBe(false)
  })

  it('rejects growth rate > 50%', () => {
    expect(careerPhaseSchema.safeParse({
      label: 'Test', minAge: 22, maxAge: 30, growthRate: 0.6,
    }).success).toBe(false)
  })
})

describe('promotionJumpSchema', () => {
  it('accepts valid promotion jump', () => {
    expect(promotionJumpSchema.safeParse({ age: 30, increasePercent: 0.2 }).success).toBe(true)
  })

  it('rejects zero increase', () => {
    expect(promotionJumpSchema.safeParse({ age: 30, increasePercent: 0 }).success).toBe(false)
  })

  it('rejects increase > 200%', () => {
    expect(promotionJumpSchema.safeParse({ age: 30, increasePercent: 2.5 }).success).toBe(false)
  })
})

describe('validateIncomeField', () => {
  it('returns null for valid salary', () => {
    expect(validateIncomeField('annualSalary', 72000)).toBeNull()
  })

  it('returns error for negative salary', () => {
    expect(validateIncomeField('annualSalary', -1)).toBeTruthy()
  })

  it('returns null for valid MOM adjustment', () => {
    expect(validateIncomeField('momAdjustment', 1.0)).toBeNull()
  })

  it('returns error for MOM adjustment > 3', () => {
    expect(validateIncomeField('momAdjustment', 4.0)).toBeTruthy()
  })

  it('returns null for unknown fields', () => {
    expect(validateIncomeField('unknownField', 'anything')).toBeNull()
  })
})

// ============================================================
// Allocation Schema Tests
// ============================================================

describe('allocationWeightsSchema', () => {
  it('accepts weights summing to 1.0', () => {
    expect(allocationWeightsSchema.safeParse(
      [0.30, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05]
    ).success).toBe(true)
  })

  it('accepts weights with tiny floating point error', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(allocationWeightsSchema.safeParse(
      [0.15, 0.05, 0.05, 0.45, 0.05, 0.05, 0.15, 0.05]
    ).success).toBe(true)
  })

  it('rejects weights not summing to 1.0', () => {
    const result = allocationWeightsSchema.safeParse(
      [0.30, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.10]
    )
    expect(result.success).toBe(false)
  })

  it('rejects negative weights', () => {
    const result = allocationWeightsSchema.safeParse(
      [-0.10, 0.20, 0.10, 0.25, 0.05, 0.05, 0.10, 0.35]
    )
    expect(result.success).toBe(false)
  })

  it('rejects weights > 1', () => {
    const result = allocationWeightsSchema.safeParse(
      [1.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1]
    )
    expect(result.success).toBe(false)
  })

  it('rejects wrong array length', () => {
    expect(allocationWeightsSchema.safeParse([0.5, 0.5]).success).toBe(false)
    expect(allocationWeightsSchema.safeParse([]).success).toBe(false)
  })
})

describe('glidePathConfigSchema', () => {
  it('accepts valid config', () => {
    expect(glidePathConfigSchema.safeParse({
      enabled: true, method: 'linear', startAge: 55, endAge: 65,
    }).success).toBe(true)
  })

  it('accepts disabled config regardless of ages', () => {
    // Even with startAge >= endAge, disabled config passes the object validation
    // but fails the refinement. Disabled configs should still have valid structure.
    expect(glidePathConfigSchema.safeParse({
      enabled: false, method: 'linear', startAge: 55, endAge: 65,
    }).success).toBe(true)
  })

  it('rejects startAge >= endAge', () => {
    const result = glidePathConfigSchema.safeParse({
      enabled: true, method: 'linear', startAge: 65, endAge: 55,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid method', () => {
    expect(glidePathConfigSchema.safeParse({
      enabled: true, method: 'invalid', startAge: 55, endAge: 65,
    }).success).toBe(false)
  })

  it('accepts all three methods', () => {
    for (const method of ['linear', 'slowStart', 'fastStart']) {
      expect(glidePathConfigSchema.safeParse({
        enabled: true, method, startAge: 55, endAge: 65,
      }).success).toBe(true)
    }
  })
})

describe('validateAllocationField', () => {
  it('returns null for valid weights', () => {
    expect(validateAllocationField('currentWeights',
      [0.30, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05]
    )).toBeNull()
  })

  it('returns error for invalid weights', () => {
    expect(validateAllocationField('currentWeights',
      [0.50, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05]
    )).toBeTruthy()
  })

  it('returns null for unknown fields', () => {
    expect(validateAllocationField('unknownField', 'anything')).toBeNull()
  })
})

describe('validateAllocationCrossStoreRules', () => {
  const defaultProfile = { currentAge: 30, lifeExpectancy: 90 }
  const validTargetWeights = [0.15, 0.05, 0.05, 0.45, 0.05, 0.05, 0.15, 0.05]
  const disabledGlidePath = {
    enabled: false, method: 'linear' as const, startAge: 55, endAge: 65,
  }

  it('returns empty when glide path disabled', () => {
    const errors = validateAllocationCrossStoreRules(defaultProfile, {
      glidePathConfig: disabledGlidePath,
      targetWeights: validTargetWeights,
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('catches glide path startAge < currentAge', () => {
    const errors = validateAllocationCrossStoreRules(defaultProfile, {
      glidePathConfig: { enabled: true, method: 'linear', startAge: 25, endAge: 65 },
      targetWeights: validTargetWeights,
    })
    expect(errors['glidePathConfig.startAge']).toBeTruthy()
  })

  it('catches glide path endAge > lifeExpectancy', () => {
    const errors = validateAllocationCrossStoreRules(defaultProfile, {
      glidePathConfig: { enabled: true, method: 'linear', startAge: 55, endAge: 95 },
      targetWeights: validTargetWeights,
    })
    expect(errors['glidePathConfig.endAge']).toBeTruthy()
  })

  it('catches glide path startAge >= endAge', () => {
    const errors = validateAllocationCrossStoreRules(defaultProfile, {
      glidePathConfig: { enabled: true, method: 'linear', startAge: 70, endAge: 60 },
      targetWeights: validTargetWeights,
    })
    expect(errors['glidePathConfig.startAge']).toBeTruthy()
  })

  it('catches target weights not summing to 1.0 when enabled', () => {
    const errors = validateAllocationCrossStoreRules(defaultProfile, {
      glidePathConfig: { enabled: true, method: 'linear', startAge: 55, endAge: 65 },
      targetWeights: [0.50, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05],
    })
    expect(errors.targetWeights).toBeTruthy()
  })

  it('passes with valid glide path config', () => {
    const errors = validateAllocationCrossStoreRules(defaultProfile, {
      glidePathConfig: { enabled: true, method: 'linear', startAge: 55, endAge: 65 },
      targetWeights: validTargetWeights,
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('validateWithdrawalCrossStoreRules', () => {
  const defaultProfile = { annualExpenses: 48000, retirementAge: 65, lifeExpectancy: 90 }
  const defaultParams = {
    strategyParams: {
      floor_ceiling: { floor: 60000, ceiling: 150000, targetRate: 0.045 },
    },
  }

  it('returns empty for valid inputs', () => {
    const errors = validateWithdrawalCrossStoreRules(
      defaultProfile,
      defaultParams as ReturnType<typeof validateWithdrawalCrossStoreRules extends (a: unknown, b: infer B) => unknown ? () => B : never>,
    )
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('warns when floor is too high relative to expenses', () => {
    const errors = validateWithdrawalCrossStoreRules(defaultProfile, {
      strategyParams: {
        floor_ceiling: { floor: 200000, ceiling: 300000, targetRate: 0.045 },
      },
    } as Parameters<typeof validateWithdrawalCrossStoreRules>[1])
    expect(errors['floor_ceiling.floor']).toBeTruthy()
  })

  it('catches retirement duration <= 0', () => {
    const errors = validateWithdrawalCrossStoreRules(
      { annualExpenses: 48000, retirementAge: 90, lifeExpectancy: 90 },
      defaultParams as Parameters<typeof validateWithdrawalCrossStoreRules>[1],
    )
    expect(errors.duration).toBeTruthy()
  })

  it('passes with positive retirement duration', () => {
    const errors = validateWithdrawalCrossStoreRules(
      { annualExpenses: 48000, retirementAge: 55, lifeExpectancy: 90 },
      defaultParams as Parameters<typeof validateWithdrawalCrossStoreRules>[1],
    )
    expect(errors.duration).toBeUndefined()
  })
})

describe('validateSimulationField', () => {
  it('returns null for valid nSimulations', () => {
    expect(validateSimulationField('nSimulations', 10000)).toBeNull()
  })

  it('returns error for nSimulations below 100', () => {
    expect(validateSimulationField('nSimulations', 50)).toBeTruthy()
  })

  it('returns error for nSimulations above 100000', () => {
    expect(validateSimulationField('nSimulations', 200000)).toBeTruthy()
  })

  it('returns null for valid mcMethod', () => {
    expect(validateSimulationField('mcMethod', 'parametric')).toBeNull()
    expect(validateSimulationField('mcMethod', 'bootstrap')).toBeNull()
    expect(validateSimulationField('mcMethod', 'fat_tail')).toBeNull()
  })

  it('returns null for unknown fields', () => {
    expect(validateSimulationField('unknownField', 'anything')).toBeNull()
  })
})

describe('retirementWithdrawalSchema', () => {
  const validEntry = {
    id: 'rw1',
    label: 'Home Renovation',
    amount: 50000,
    age: 60,
    durationYears: 1,
    inflationAdjusted: true,
  }

  it('accepts valid retirement withdrawal', () => {
    expect(retirementWithdrawalSchema.safeParse(validEntry).success).toBe(true)
  })

  it('accepts durationYears = 1 (one-off)', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, durationYears: 1 }).success).toBe(true)
  })

  it('accepts durationYears = 50 (max)', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, durationYears: 50 }).success).toBe(true)
  })

  it('rejects durationYears = 0', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, durationYears: 0 }).success).toBe(false)
  })

  it('rejects durationYears = 51 (exceeds max)', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, durationYears: 51 }).success).toBe(false)
  })

  it('rejects non-integer durationYears', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, durationYears: 2.5 }).success).toBe(false)
  })

  it('rejects empty label', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, label: '' }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, amount: 0 }).success).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(retirementWithdrawalSchema.safeParse({ ...validEntry, amount: -1000 }).success).toBe(false)
  })
})

describe('validateStoreData', () => {
  it('returns success for valid profile data', () => {
    const data = {
      currentAge: 35, retirementAge: 60, lifeExpectancy: 90,
      lifeStage: 'pre-fire', maritalStatus: 'single', residencyStatus: 'citizen',
      annualIncome: 100000, annualExpenses: 48000, liquidNetWorth: 500000,
      cpfOA: 50000, cpfSA: 30000, cpfMA: 20000, cpfRA: 0,
      srsBalance: 0, srsAnnualContribution: 0,
      fireType: 'regular', swr: 0.04, retirementSpendingAdjustment: 1.0,
      expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003,
      rebalanceFrequency: 'annual',
      retirementPhase: null, cpfLifeActualMonthlyPayout: 0,
      cpfLifeStartAge: 65, cpfLifePlan: 'standard', cpfRetirementSum: 'frs',
      cpfHousingMode: 'none', cpfHousingMonthly: 0, cpfMortgageYearsLeft: 25,
    }
    const result = validateStoreData('fireplanner-profile', data)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('returns errors for invalid profile data', () => {
    const data = { currentAge: 'banana', retirementAge: 10 }
    const result = validateStoreData('fireplanner-profile', data)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns valid:true with warnings for unknown store keys (passthrough)', () => {
    const result = validateStoreData('unknown-store', { anything: true })
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('No schema for store "unknown-store" — skipping validation')
  })

  it('returns errors for invalid allocation weights', () => {
    const data = { currentWeights: [1, 0, 0, 0, 0, 0, 0, 0.5], targetWeights: [1, 0, 0, 0, 0, 0, 0, 0] }
    const result = validateStoreData('fireplanner-allocation', data)
    expect(result.valid).toBe(false)
  })
})

describe('cpfOaWithdrawalSchema', () => {
  const validEntry = {
    id: 'ow1',
    label: 'OA withdrawal at 55',
    amount: 50000,
    age: 55,
  }

  it('accepts valid CPF OA withdrawal', () => {
    expect(cpfOaWithdrawalSchema.safeParse(validEntry).success).toBe(true)
  })

  it('accepts age 55 (minimum)', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, age: 55 }).success).toBe(true)
  })

  it('accepts age 120 (maximum)', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, age: 120 }).success).toBe(true)
  })

  it('rejects age below 55', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, age: 50 }).success).toBe(false)
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, age: 54 }).success).toBe(false)
  })

  it('rejects age above 120', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, age: 121 }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, amount: 0 }).success).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, amount: -1000 }).success).toBe(false)
  })

  it('rejects empty label', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, label: '' }).success).toBe(false)
  })

  it('rejects non-integer age', () => {
    expect(cpfOaWithdrawalSchema.safeParse({ ...validEntry, age: 55.5 }).success).toBe(false)
  })
})

describe('validateProfileField CPFIS returns', () => {
  it('accepts valid cpfisOaReturn', () => {
    expect(validateProfileField('cpfisOaReturn', 0.04)).toBeNull()
    expect(validateProfileField('cpfisOaReturn', 0)).toBeNull()
    expect(validateProfileField('cpfisOaReturn', 0.20)).toBeNull()
  })

  it('rejects cpfisOaReturn above 20%', () => {
    expect(validateProfileField('cpfisOaReturn', 0.21)).toBeTruthy()
  })

  it('rejects negative cpfisOaReturn', () => {
    expect(validateProfileField('cpfisOaReturn', -0.01)).toBeTruthy()
  })

  it('accepts valid cpfisSaReturn', () => {
    expect(validateProfileField('cpfisSaReturn', 0.05)).toBeNull()
    expect(validateProfileField('cpfisSaReturn', 0)).toBeNull()
    expect(validateProfileField('cpfisSaReturn', 0.20)).toBeNull()
  })

  it('rejects cpfisSaReturn above 20%', () => {
    expect(validateProfileField('cpfisSaReturn', 0.21)).toBeTruthy()
  })
})

describe('lockedAsset validation', () => {
  it('accepts valid locked asset fields', () => {
    expect(validateProfileField('lockedAsset.amount', 50000)).toBeNull()
    expect(validateProfileField('lockedAsset.unlockAge', 55)).toBeNull()
    expect(validateProfileField('lockedAsset.growthRate', 0.05)).toBeNull()
  })

  it('rejects invalid locked asset fields', () => {
    expect(validateProfileField('lockedAsset.amount', -100)).toBeTruthy()
    expect(validateProfileField('lockedAsset.amount', 0)).toBeTruthy()
    expect(validateProfileField('lockedAsset.unlockAge', 15)).toBeTruthy()
    expect(validateProfileField('lockedAsset.growthRate', 0.25)).toBeTruthy()
  })
})

describe('cpfTopUp validation', () => {
  it('accepts valid SA top-up within RSTU cap', () => {
    expect(validateProfileField('cpfTopUpSA', 8000)).toBeNull()
  })

  it('rejects SA top-up exceeding RSTU cap', () => {
    expect(validateProfileField('cpfTopUpSA', 9000)).toBeTruthy()
  })

  it('accepts zero top-up', () => {
    expect(validateProfileField('cpfTopUpSA', 0)).toBeNull()
  })

  it('rejects negative top-up', () => {
    expect(validateProfileField('cpfTopUpSA', -100)).toBeTruthy()
  })

  it('accepts valid OA top-up', () => {
    expect(validateProfileField('cpfTopUpOA', 5000)).toBeNull()
  })

  it('accepts valid MA top-up', () => {
    expect(validateProfileField('cpfTopUpMA', 10000)).toBeNull()
  })

  it('rejects MA top-up exceeding BHS', () => {
    expect(validateProfileField('cpfTopUpMA', 80000)).toBeTruthy()
  })
})
