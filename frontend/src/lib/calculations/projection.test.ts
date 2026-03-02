import { describe, it, expect } from 'vitest'
import type { IncomeProjectionRow, StrategyParamsMap, GlidePathConfig, HealthcareConfig } from '@/lib/types'
import { generateProjection, type ProjectionParams } from './projection'

// ============================================================
// Test Helpers
// ============================================================

const DEFAULT_STRATEGY_PARAMS: StrategyParamsMap = {
  constant_dollar: { swr: 0.04 },
  vpw: { expectedRealReturn: 0.03, targetEndValue: 0 },
  guardrails: { initialRate: 0.05, ceilingTrigger: 1.20, floorTrigger: 0.80, adjustmentSize: 0.10 },
  vanguard_dynamic: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
  cape_based: { baseRate: 0.04, capeWeight: 0.50, currentCape: 30 },
  floor_ceiling: { floor: 60000, ceiling: 150000, targetRate: 0.045 },
  percent_of_portfolio: { rate: 0.04 },
  one_over_n: {},
  sensible_withdrawals: { baseRate: 0.03, extrasRate: 0.10 },
  ninety_five_percent: { swr: 0.04 },
  endowment: { swr: 0.04, smoothingWeight: 0.70 },
  hebeler_autopilot: { expectedRealReturn: 0.03 },
}

const GLIDE_PATH_DISABLED: GlidePathConfig = {
  enabled: false,
  method: 'linear',
  startAge: 60,
  endAge: 75,
}

function mockIncomeRow(overrides: Partial<IncomeProjectionRow> = {}): IncomeProjectionRow {
  return {
    year: 0,
    age: 30,
    salary: 72000,
    rentalIncome: 0,
    investmentIncome: 0,
    businessIncome: 0,
    governmentIncome: 0,
    totalGross: 72000,
    sgTax: 3000,
    cpfEmployee: 14400,
    cpfEmployer: 12240,
    totalNet: 54600,
    annualSavings: 20000,
    cumulativeSavings: 20000,
    cpfOA: 0,
    cpfSA: 0,
    cpfMA: 0,
    cpfRA: 0,
    isRetired: false,
    activeLifeEvents: [],
    cpfLifePayout: 0,
    cpfOaHousingDeduction: 0,
    cpfOaShortfall: 0,
    cpfLifeAnnuityPremium: 0,
    cpfOaWithdrawal: 0,
    cpfisOA: 0,
    cpfisSA: 0,
    cpfisReturn: 0,
    srsBalance: 0,
    srsContribution: 0,
    srsWithdrawal: 0,
    srsTaxableWithdrawal: 0,
    cashReserveTarget: 0,
    cashReserveBalance: 0,
    investedSavings: 0,
    lockedAssetUnlock: 0,
    ...overrides,
  }
}

/**
 * Generate a sequence of income rows for testing.
 * Pre-retirement rows have salary and savings; post-retirement rows have none.
 */
function generateMockIncomeProjection(params: {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualSavings?: number
  salary?: number
  cpfOA?: number
  cpfSA?: number
  cpfMA?: number
  rentalIncome?: number
}): IncomeProjectionRow[] {
  const {
    currentAge, retirementAge, lifeExpectancy,
    annualSavings = 20000, salary = 72000,
    cpfOA = 0, cpfSA = 0, cpfMA = 0,
    rentalIncome = 0,
  } = params
  const rows: IncomeProjectionRow[] = []

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    const year = age - currentAge
    const isRetired = age > retirementAge

    rows.push(mockIncomeRow({
      year,
      age,
      salary: isRetired ? 0 : salary,
      rentalIncome,
      totalGross: isRetired ? rentalIncome : salary + rentalIncome,
      sgTax: isRetired ? 0 : 3000,
      cpfEmployee: isRetired ? 0 : 14400,
      cpfEmployer: isRetired ? 0 : 12240,
      totalNet: isRetired ? rentalIncome : salary - 3000 - 14400 + rentalIncome,
      annualSavings: isRetired ? 0 : annualSavings,
      cumulativeSavings: isRetired ? annualSavings * (retirementAge - currentAge) : annualSavings * (year + 1),
      cpfOA,
      cpfSA,
      cpfMA,
      isRetired,
    }))
  }

  return rows
}

function makeParams(overrides: Partial<ProjectionParams> = {}): ProjectionParams {
  const currentAge = (overrides.currentAge ?? 30) as number
  const retirementAge = (overrides.retirementAge ?? 33) as number
  const lifeExpectancy = (overrides.lifeExpectancy ?? 34) as number

  return {
    incomeProjection: generateMockIncomeProjection({
      currentAge,
      retirementAge,
      lifeExpectancy,
      annualSavings: 20000,
    }),
    currentAge,
    retirementAge,
    lifeExpectancy,
    initialLiquidNW: 100000,
    swr: 0.04,
    expectedReturn: 0,
    usePortfolioReturn: false,
    inflation: 0,
    expenseRatio: 0,
    annualExpenses: 50000,
    retirementSpendingAdjustment: 1.0,
    fireNumber: 1250000, // 50000 / 0.04
    currentWeights: [0.60, 0.40],
    targetWeights: [0.30, 0.70],
    assetReturns: [0.10, 0.04],
    glidePathConfig: GLIDE_PATH_DISABLED,
    withdrawalStrategy: 'constant_dollar',
    strategyParams: DEFAULT_STRATEGY_PARAMS,
    propertyEquity: 0,
    existingPropertyValue: 0,
    propertyAppreciationRate: 0.03,
    propertyLeaseYears: 99,
    applyBalaDecay: true,
    annualMortgagePayment: 0,
    annualRentalIncome: 0,
    downsizing: null,
    existingMortgageBalance: 0,
    existingMortgageRate: 0.035,
    existingMonthlyPayment: 0,
    existingMortgageRemainingYears: 25,
    residencyForAbsd: 'citizen',
    parentSupport: [],
    parentSupportEnabled: false,
    healthcareConfig: null,
    cpfLifeStartAge: 65,
    cpfLifePlan: 'standard' as const,
    withdrawalBasis: 'expenses' as const,
    ...overrides,
  }
}

// ============================================================
// Tests
// ============================================================

describe('generateProjection', () => {
  describe('row count', () => {
    it('produces lifeExpectancy - currentAge + 1 rows', () => {
      const result = generateProjection(makeParams({
        currentAge: 30, lifeExpectancy: 34,
      }))
      expect(result.rows).toHaveLength(5) // ages 30,31,32,33,34
    })

    it('produces 1 row when currentAge === lifeExpectancy', () => {
      const params = makeParams({
        currentAge: 60, retirementAge: 60, lifeExpectancy: 60,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 60, lifeExpectancy: 60,
      })
      const result = generateProjection(params)
      expect(result.rows).toHaveLength(1)
    })
  })

  describe('totalNW = liquidNW + cpfTotal for all rows', () => {
    it('holds for mixed pre/post-retirement rows', () => {
      const result = generateProjection(makeParams())
      for (const row of result.rows) {
        expect(row.totalNW).toBeCloseTo(row.liquidNW + row.cpfTotal, 2)
      }
    })
  })

  describe('normal accumulation', () => {
    it('NW grows with returns + savings when return rate = 0%', () => {
      // 0% return, 20K savings per year, starting at 100K
      const result = generateProjection(makeParams({
        expectedReturn: 0, expenseRatio: 0, initialLiquidNW: 100000,
      }))

      // Year 0 (age 30): 100K * 1.0 + 20K = 120K
      expect(result.rows[0].liquidNW).toBeCloseTo(120000, 2)
      // Year 1 (age 31): 120K + 20K = 140K
      expect(result.rows[1].liquidNW).toBeCloseTo(140000, 2)
      // Year 2 (age 32): 140K + 20K = 160K
      expect(result.rows[2].liquidNW).toBeCloseTo(160000, 2)
    })

    it('NW grows with 5% return + savings', () => {
      const result = generateProjection(makeParams({
        expectedReturn: 0.05, expenseRatio: 0, initialLiquidNW: 100000,
      }))

      // Year 0: 100K * 1.05 + 20K = 125K
      expect(result.rows[0].liquidNW).toBeCloseTo(125000, 0)
      // Year 1: 125K * 1.05 + 20K = 151.25K
      expect(result.rows[1].liquidNW).toBeCloseTo(151250, 0)
    })

    it('portfolioReturnDollar reflects return on start-of-year balance', () => {
      const result = generateProjection(makeParams({
        expectedReturn: 0.05, expenseRatio: 0, initialLiquidNW: 100000,
      }))

      // Year 0: return = 100K * 0.05 = 5K
      expect(result.rows[0].portfolioReturnDollar).toBeCloseTo(5000, 2)
      // Year 1: return = 125K * 0.05 = 6.25K
      expect(result.rows[1].portfolioReturnDollar).toBeCloseTo(6250, 2)
    })
  })

  describe('transition to decumulation at retirement age', () => {
    it('switches from savings to withdrawal at retirementAge', () => {
      const result = generateProjection(makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 35,
        expectedReturn: 0, initialLiquidNW: 100000,
      }))

      // Pre-retirement rows (ages 30-33): savingsOrWithdrawal > 0
      expect(result.rows[0].savingsOrWithdrawal).toBe(20000) // age 30
      expect(result.rows[1].savingsOrWithdrawal).toBe(20000) // age 31
      expect(result.rows[2].savingsOrWithdrawal).toBe(20000) // age 32
      expect(result.rows[3].savingsOrWithdrawal).toBe(20000) // age 33 (last working year)

      // Post-retirement (ages 34+): savingsOrWithdrawal <= 0
      expect(result.rows[4].savingsOrWithdrawal).toBeLessThanOrEqual(0)
      expect(result.rows[5].savingsOrWithdrawal).toBeLessThanOrEqual(0)
    })

    it('withdrawalAmount is 0 pre-retirement and > 0 post-retirement', () => {
      const result = generateProjection(makeParams({
        expectedReturn: 0, initialLiquidNW: 100000,
      }))

      for (const row of result.rows) {
        if (!row.isRetired) {
          expect(row.withdrawalAmount).toBe(0)
        } else if (row.liquidNW > 0 || result.rows[result.rows.indexOf(row) - 1]?.liquidNW > 0) {
          // Post-retirement with portfolio funds: withdrawal > 0
          // (first retired year always has funds from accumulation)
          if (row === result.rows[3]) {
            expect(row.withdrawalAmount).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  describe('post-retirement income offsets withdrawal', () => {
    it('rental income reduces actual portfolio draw when gap < strategy', () => {
      // expenses = $10K, passive = $5K, strategy = $8K (200K * 0.04)
      // expenseGap = $10K - $5K = $5K, actualDraw = min($5K, $8K) = $5K
      const rentalIncome = 5000
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        expectedReturn: 0, initialLiquidNW: 200000,
        annualExpenses: 10000,
        swr: 0.04,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        annualSavings: 0, rentalIncome,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.04 },
      }

      const result = generateProjection(params)

      // maxPermitted = 8K, actualDraw = 5K, excess = 3K
      expect(result.rows[0].maxPermittedWithdrawal).toBeCloseTo(8000, 2)
      expect(result.rows[0].withdrawalAmount).toBeCloseTo(5000, 2)
      expect(result.rows[0].withdrawalExcess).toBeCloseTo(3000, 2)
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(-5000, 2)
      expect(result.rows[0].liquidNW).toBeCloseTo(195000, 2) // 200K - 5K
    })

    it('surplus passive income is reinvested when exceeding expenses', () => {
      // expenses = $10K, passive = $20K → surplus $10K reinvested, no draw
      const rentalIncome = 20000
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        expectedReturn: 0, initialLiquidNW: 200000,
        annualExpenses: 10000,
        swr: 0.04,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        annualSavings: 0, rentalIncome,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.04 },
      }

      const result = generateProjection(params)

      // expenseGap = 0, actualDraw = 0, surplus = $10K reinvested
      expect(result.rows[0].withdrawalAmount).toBe(0)
      expect(result.rows[0].maxPermittedWithdrawal).toBeCloseTo(8000, 2)
      expect(result.rows[0].withdrawalExcess).toBeCloseTo(8000, 2)
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(10000, 2) // positive = surplus reinvested
      expect(result.rows[0].liquidNW).toBeCloseTo(210000, 2) // 200K + 10K surplus
    })

    it('draw is capped at expenses when strategy exceeds expenses', () => {
      // expenses = $5K, passive = $0, strategy = $20K (500K * 0.04)
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 5000,
        swr: 0.04,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        annualSavings: 0,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.04 },
      }

      const result = generateProjection(params)

      // maxPermitted = 20K, but only need $5K for expenses
      expect(result.rows[0].maxPermittedWithdrawal).toBeCloseTo(20000, 2)
      expect(result.rows[0].withdrawalAmount).toBeCloseTo(5000, 2)
      expect(result.rows[0].withdrawalExcess).toBeCloseTo(15000, 2)
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(-5000, 2)
      expect(result.rows[0].liquidNW).toBeCloseTo(495000, 2) // 500K - 5K
    })
  })

  describe('portfolio depletion', () => {
    it('clamps liquidNW to 0 when depleted', () => {
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 64,
        expectedReturn: 0, initialLiquidNW: 10000,
        swr: 0.50,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 64,
        annualSavings: 0,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.50 },
      }
      params.fireNumber = 20000

      const result = generateProjection(params)

      // initialWithdrawal = 10K * 0.50 = $5K (portfolio-based)
      // But actualDraw = min(expenseGap $50K, portfolio $10K) = $10K (capped at portfolio)
      // Year 0: liquidNW = 0 (depleted immediately — expenses exceed portfolio)
      expect(result.rows[0].liquidNW).toBeCloseTo(0, 2)
      // Year 1+: liquidNW stays at 0, withdrawal = 0
      expect(result.rows[1].liquidNW).toBe(0)
      expect(result.rows[2].liquidNW).toBe(0)
      expect(result.rows[2].withdrawalAmount).toBe(0)
      expect(result.rows[3].liquidNW).toBe(0)
    })

    it('reports portfolioDepletedAge in summary', () => {
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 64,
        expectedReturn: 0, initialLiquidNW: 10000,
        swr: 0.50,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 64,
        annualSavings: 0,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.50 },
      }
      params.fireNumber = 20000

      const result = generateProjection(params)

      // Portfolio depletes at year 0 (age 60) — expenses ($50K) exceed portfolio ($10K)
      expect(result.summary.portfolioDepletedAge).toBe(60)
    })
  })

  describe('glide path changes return rate', () => {
    it('uses portfolio return with interpolated weights during glide path', () => {
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        usePortfolioReturn: true,
        expectedReturn: 0.07,
        expenseRatio: 0,
        initialLiquidNW: 1000000,
        swr: 0.04,
        // 2 asset classes: 10% and 4%
        currentWeights: [0.80, 0.20], // portfolio return: 0.8*0.10 + 0.2*0.04 = 8.8%
        targetWeights: [0.20, 0.80], // portfolio return: 0.2*0.10 + 0.8*0.04 = 5.2%
        assetReturns: [0.10, 0.04],
        glidePathConfig: {
          enabled: true,
          method: 'linear',
          startAge: 60,
          endAge: 62,
        },
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        annualSavings: 0,
      })

      const result = generateProjection(params)

      // Age 60: progress = 0/2 = 0, weights = currentWeights → return = 8.8%
      expect(result.rows[0].portfolioReturnPct).toBeCloseTo(0.088, 4)
      // Age 61: progress = 1/2 = 0.5, weights = [0.50, 0.50] → return = 7.0%
      expect(result.rows[1].portfolioReturnPct).toBeCloseTo(0.07, 4)
      // Age 62: progress = 2/2 = 1.0, weights = targetWeights → return = 5.2%
      expect(result.rows[2].portfolioReturnPct).toBeCloseTo(0.052, 4)
    })
  })

  describe('already retired (currentAge >= retirementAge)', () => {
    it('starts with withdrawal immediately', () => {
      const params = makeParams({
        currentAge: 65, retirementAge: 60, lifeExpectancy: 67,
        expectedReturn: 0, initialLiquidNW: 500000,
        swr: 0.04,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 65, retirementAge: 60, lifeExpectancy: 67,
        annualSavings: 0,
      })

      const result = generateProjection(params)

      // All rows are retired
      expect(result.rows[0].isRetired).toBe(true)
      // First row has withdrawal
      expect(result.rows[0].withdrawalAmount).toBeGreaterThan(0)
      // actualDraw = expenseGap = $50K (expenses fully funded from portfolio)
      expect(result.rows[0].withdrawalAmount).toBeCloseTo(50000, 2)
      // liquidNW = 500K - 50K = 450K
      expect(result.rows[0].liquidNW).toBeCloseTo(450000, 2)
    })
  })

  describe('FIRE progress', () => {
    it('reaches 100% at correct age', () => {
      // 0% return, 100K savings/year, starting at 200K, fireNumber = 500K
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 35,
        expectedReturn: 0, initialLiquidNW: 200000,
        fireNumber: 500000,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 35,
        annualSavings: 100000,
      })

      const result = generateProjection(params)

      // Year 0: liquidNW = 200K + 100K = 300K, fire% = 300K/500K = 60%
      expect(result.rows[0].fireProgress).toBeCloseTo(0.60, 2)
      // Year 1: liquidNW = 400K, fire% = 80%
      expect(result.rows[1].fireProgress).toBeCloseTo(0.80, 2)
      // Year 2: liquidNW = 500K, fire% = 100%
      expect(result.rows[2].fireProgress).toBeCloseTo(1.00, 2)

      expect(result.summary.fireAchievedAge).toBe(32)
    })

    it('clamps to 0 when fireNumber is 0 (avoid division by zero)', () => {
      const params = makeParams({
        currentAge: 30, lifeExpectancy: 30, retirementAge: 65,
        fireNumber: 0,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
      })

      const result = generateProjection(params)
      expect(result.rows[0].fireProgress).toBe(0)
    })
  })

  describe('summary', () => {
    it('computes peak NW and terminal NW correctly', () => {
      // NW grows during accumulation, then declines in decumulation
      const params = makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 35,
        expectedReturn: 0, initialLiquidNW: 100000,
        swr: 0.10,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 35,
        annualSavings: 20000,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.10 },
      }

      const result = generateProjection(params)

      // Pre-ret: 100K→120K→140K→160K→180K (age 33 is last working year)
      // Retirement (age 34): initialWithdrawal = 180K * 0.10 = $18K (portfolio-based)
      // But actualDraw = expenseGap = $50K (full expenses)
      // Year 4: liquidNW = 180K - 50K = 130K
      // Year 5: withdrawal = 50K, liquidNW = 130K - 50K = 80K

      // Peak is at retirement transition
      expect(result.summary.peakTotalNW).toBeCloseTo(180000, 0)
      expect(result.summary.peakTotalNWAge).toBe(33)

      // Terminal (age 35)
      expect(result.summary.terminalLiquidNW).toBeCloseTo(80000, 0)
    })

    it('reports fireAchievedAge as null when never reached', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 35, lifeExpectancy: 34,
        expectedReturn: 0, initialLiquidNW: 1000,
        fireNumber: 999999999, // unreachable
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 35, lifeExpectancy: 34,
        annualSavings: 100,
      })

      const result = generateProjection(params)
      expect(result.summary.fireAchievedAge).toBeNull()
    })

    it('reports portfolioDepletedAge as null when portfolio survives', () => {
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        expectedReturn: 0.10, initialLiquidNW: 1000000,
        swr: 0.02,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        annualSavings: 0,
      })
      params.strategyParams = {
        ...DEFAULT_STRATEGY_PARAMS,
        constant_dollar: { swr: 0.02 },
      }

      const result = generateProjection(params)
      expect(result.summary.portfolioDepletedAge).toBeNull()
    })
  })

  describe('expense ratio applied', () => {
    it('reduces return rate by expense ratio', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
        expectedReturn: 0.07, expenseRatio: 0.003,
        initialLiquidNW: 100000,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
      })

      const result = generateProjection(params)

      // Net rate = 0.07 - 0.003 = 0.067
      expect(result.rows[0].portfolioReturnPct).toBeCloseTo(0.067, 4)
      expect(result.rows[0].portfolioReturnDollar).toBeCloseTo(100000 * 0.067, 0)
    })
  })

  describe('inflation-adjusted expenses', () => {
    it('expenses increase with inflation each year', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 32,
        annualExpenses: 50000, inflation: 0.03,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 32,
      })

      const result = generateProjection(params)

      expect(result.rows[0].annualExpenses).toBeCloseTo(50000, 0) // year 0
      expect(result.rows[1].annualExpenses).toBeCloseTo(51500, 0) // year 1: 50K * 1.03
      expect(result.rows[2].annualExpenses).toBeCloseTo(53045, 0) // year 2: 50K * 1.03^2
    })
  })

  describe('parent support adds to expenses', () => {
    it('parent support increases expenses during active period', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 32,
        annualExpenses: 50000, inflation: 0,
        parentSupportEnabled: true,
        parentSupport: [
          { id: 'p1', label: 'Mom', monthlyAmount: 500, startAge: 30, endAge: 70, growthRate: 0 },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 32,
      })

      const result = generateProjection(params)

      // Expenses should be 50000 + 500*12 = 56000
      expect(result.rows[0].annualExpenses).toBeCloseTo(56000, 0)
      expect(result.rows[0].parentSupportExpense).toBeCloseTo(6000, 0)
    })

    it('disabled parent support does not add to expenses', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
        annualExpenses: 50000, inflation: 0,
        parentSupportEnabled: false,
        parentSupport: [
          { id: 'p1', label: 'Mom', monthlyAmount: 500, startAge: 30, endAge: 70, growthRate: 0 },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
      })

      const result = generateProjection(params)
      expect(result.rows[0].annualExpenses).toBeCloseTo(50000, 0)
      expect(result.rows[0].parentSupportExpense).toBe(0)
    })
  })

  describe('downsizing injects equity at sell age', () => {
    it('liquidNW jumps at sell age with sell-and-rent scenario', () => {
      const params = makeParams({
        currentAge: 55, retirementAge: 54, lifeExpectancy: 57,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 50000, inflation: 0,
        downsizing: {
          scenario: 'sell-and-rent',
          sellAge: 56,
          expectedSalePrice: 1500000,
          monthlyRent: 2000,
          rentGrowthRate: 0,
          newPropertyCost: 0,
          newLtv: 0,
          newMortgageRate: 0,
          newMortgageTerm: 0,
        },
        existingMortgageBalance: 0,
        existingMortgageRate: 0.035,
        existingMonthlyPayment: 0,
        existingMortgageRemainingYears: 0,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 54, lifeExpectancy: 57,
        annualSavings: 0,
      })

      const result = generateProjection(params)

      // At age 56 (index 1), downsizing injects $1.5M equity
      // Before injection: liquidNW was ~450K (500K - 50K withdrawal)
      // After injection: ~450K + 1.5M = ~1.95M
      expect(result.rows[1].liquidNW).toBeGreaterThan(result.rows[0].liquidNW + 1000000)
    })
  })

  describe('retirement spending adjustment', () => {
    it('reduces expenses in retirement when adjustment < 1', () => {
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        annualExpenses: 50000, inflation: 0,
        retirementSpendingAdjustment: 0.8,
        initialLiquidNW: 500000,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 62,
        annualSavings: 0,
      })

      const result = generateProjection(params)

      // Post-retirement expenses = 50000 * 0.8 = 40000
      expect(result.rows[0].annualExpenses).toBeCloseTo(40000, 0)
    })
  })

  describe('fallback when usePortfolioReturn is false', () => {
    it('uses expectedReturn instead of portfolio return', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
        usePortfolioReturn: false,
        expectedReturn: 0.07,
        expenseRatio: 0,
        currentWeights: [1.0, 0.0],
        assetReturns: [0.10, 0.04], // portfolio would be 10%
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 30,
      })

      const result = generateProjection(params)

      // Should use 7% (expectedReturn), not 10% (portfolio return)
      expect(result.rows[0].portfolioReturnPct).toBeCloseTo(0.07, 4)
    })
  })

  describe('downsizing sell-and-downsize', () => {
    it('injects net equity at sell age', () => {
      const params = makeParams({
        currentAge: 50, retirementAge: 55, lifeExpectancy: 60,
        initialLiquidNW: 500000,
        propertyEquity: 700000,
        annualMortgagePayment: 30000,
        existingMortgageBalance: 300000,
        existingMortgageRate: 0.035,
        existingMonthlyPayment: 2500,
        existingMortgageRemainingYears: 15,
        downsizing: {
          scenario: 'sell-and-downsize',
          sellAge: 55,
          expectedSalePrice: 1500000,
          newPropertyCost: 800000,
          newLtv: 0.75,
          newMortgageRate: 0.035,
          newMortgageTerm: 20,
          monthlyRent: 0,
          rentGrowthRate: 0.03,
        },
        residencyForAbsd: 'citizen',
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 50, retirementAge: 55, lifeExpectancy: 60,
        annualSavings: 20000,
      })

      const result = generateProjection(params)

      // At sell age 55 (index 5), equity should be injected into portfolio
      const preSell = result.rows[4] // age 54
      const atSell = result.rows[5] // age 55
      // After selling, liquid NW should jump significantly
      expect(atSell.liquidNW).toBeGreaterThan(preSell.liquidNW)
    })
  })

  describe('downsizing sell-and-rent', () => {
    it('injects sale proceeds and adds rent expense', () => {
      const params = makeParams({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 62,
        initialLiquidNW: 500000,
        propertyEquity: 700000,
        annualMortgagePayment: 30000,
        existingMortgageBalance: 300000,
        existingMortgageRate: 0.035,
        existingMonthlyPayment: 2500,
        existingMortgageRemainingYears: 15,
        downsizing: {
          scenario: 'sell-and-rent',
          sellAge: 58,
          expectedSalePrice: 1200000,
          newPropertyCost: 0,
          newLtv: 0,
          newMortgageRate: 0,
          newMortgageTerm: 0,
          monthlyRent: 2500,
          rentGrowthRate: 0.03,
        },
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 62,
        annualSavings: 20000,
      })

      const result = generateProjection(params)

      // After sell age 58, property equity should be 0
      const atSell = result.rows.find((r) => r.age === 58)!
      const afterSell = result.rows.find((r) => r.age === 59)!
      expect(afterSell.propertyEquity).toBe(0)
      // Expenses should include rent after selling
      expect(afterSell.annualExpenses).toBeGreaterThan(atSell.annualExpenses)
    })
  })

  describe('healthcare costs', () => {
    it('adds healthcare cash outlay to expenses when enabled', () => {
      const params = makeParams({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 62,
        healthcareConfig: {
          enabled: true,
          mediShieldLifeEnabled: true,
          ispTier: 'none',
          careShieldLifeEnabled: true,
          oopBaseAmount: 5000,
          oopModel: 'fixed',
          oopInflationRate: 0.03,
          oopReferenceAge: 55,
          mediSaveTopUpAnnual: 0,
        },
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 62,
      })

      const result = generateProjection(params)

      // Healthcare cost should be > 0 for all ages
      expect(result.rows[0].healthcareCashOutlay).toBeGreaterThan(0)
    })
  })

  describe('pre-retirement expense shortfall deducted from portfolio', () => {
    it('deducts full expenses when income is $0 (income shortfall)', () => {
      // Bug: when income < expenses, annualSavings is clamped to max(0, ...),
      // so the shortfall was silently dropped and portfolio not debited.
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 31,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 20000, inflation: 0,
      })
      // $0 income, annualSavings clamped to 0 by income projection
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 31,
        annualSavings: 0, salary: 0,
      })
      // Override totalNet to 0 (matching $0 income)
      params.incomeProjection[0].totalNet = 0

      const result = generateProjection(params)

      // Should deduct $20K expenses from portfolio: 500K - 20K = 480K
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(-20000, 2)
      expect(result.rows[0].liquidNW).toBeCloseTo(480000, 2)
    })

    it('deducts parent support from portfolio during pre-retirement', () => {
      // Bug: parent support was shown in Expenses column but NOT deducted from portfolio.
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 31,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 20000, inflation: 0,
        parentSupportEnabled: true,
        parentSupport: [
          { id: 'p1', label: 'Mom', monthlyAmount: 1000, startAge: 30, endAge: 70, growthRate: 0 },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 31,
        annualSavings: 0, salary: 0,
      })
      params.incomeProjection[0].totalNet = 0

      const result = generateProjection(params)

      // Base expenses $20K + parent support $12K = $32K total
      expect(result.rows[0].annualExpenses).toBeCloseTo(32000, 0)
      // Portfolio should lose the full $32K: 500K - 32K = 468K
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(-32000, 2)
      expect(result.rows[0].liquidNW).toBeCloseTo(468000, 2)
    })

    it('deducts healthcare from portfolio during pre-retirement', () => {
      const params = makeParams({
        currentAge: 55, retirementAge: 65, lifeExpectancy: 56,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 20000, inflation: 0,
        healthcareConfig: {
          enabled: true,
          mediShieldLifeEnabled: false,
          ispTier: 'none',
          careShieldLifeEnabled: false,
          oopBaseAmount: 10000,
          oopModel: 'fixed',
          oopInflationRate: 0,
          oopReferenceAge: 55,
          mediSaveTopUpAnnual: 0,
        },
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 65, lifeExpectancy: 56,
        annualSavings: 0, salary: 0,
      })
      params.incomeProjection[0].totalNet = 0

      const result = generateProjection(params)

      // Expenses include base $20K + healthcare OOP $10K = $30K
      expect(result.rows[0].annualExpenses).toBeCloseTo(30000, 0)
      // Portfolio debited by full $30K
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(-30000, 2)
      expect(result.rows[0].liquidNW).toBeCloseTo(470000, 2)
    })
  })

  describe('post-retirement strategy covers full expenses including extras', () => {
    it('constant dollar withdrawal matches expenses with parent support', () => {
      // Bug: initialWithdrawal was set to base expenses only, ignoring parent support.
      // The strategy withdrawal capped at base expenses, leaving parent support unfunded.
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 20000, inflation: 0,
        parentSupportEnabled: true,
        parentSupport: [
          { id: 'p1', label: 'Mom', monthlyAmount: 1000, startAge: 55, endAge: 80, growthRate: 0 },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        annualSavings: 0,
      })

      const result = generateProjection(params)

      // Total expenses = $20K base + $12K parent support = $32K
      expect(result.rows[0].annualExpenses).toBeCloseTo(32000, 0)
      // actualDraw = expenseGap = $32K (full expenses funded from portfolio)
      expect(result.rows[0].withdrawalAmount).toBeCloseTo(32000, 2)
      expect(result.rows[0].liquidNW).toBeCloseTo(468000, 2) // 500K - 32K
    })
  })

  describe('post-retirement mortgage deducted from portfolio', () => {
    it('mortgage payment reduces portfolio during post-retirement', () => {
      // Bug: mortgage was only deducted in pre-retirement, not post-retirement.
      const params = makeParams({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        expectedReturn: 0, initialLiquidNW: 500000,
        annualExpenses: 20000, inflation: 0,
        annualMortgagePayment: 24000, // $2K/month
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 60, retirementAge: 59, lifeExpectancy: 61,
        annualSavings: 0,
      })

      const result = generateProjection(params)

      // Expense draw $20K + mortgage $24K = $44K total deducted from portfolio
      expect(result.rows[0].withdrawalAmount).toBeCloseTo(20000, 2)
      expect(result.rows[0].savingsOrWithdrawal).toBeCloseTo(-44000, 2) // 20K expenses + 24K mortgage
      expect(result.rows[0].liquidNW).toBeCloseTo(456000, 2) // 500K - 44K
    })
  })

  // ============================================================
  // Financial Goals
  // ============================================================

  describe('financial goals', () => {
    it('pre-retirement goal deducts from savings at correct age', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Wedding', amount: 50000, targetAge: 35,
            durationYears: 1, priority: 'important', inflationAdjusted: false, category: 'wedding',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000,
      })

      const result = generateProjection(params)
      const noGoalParams = { ...params, financialGoals: [] }
      noGoalParams.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000,
      })
      const noGoalResult = generateProjection(noGoalParams)

      // At age 35 (year 5), savings should be reduced by 50,000
      const goalRow = result.rows[5]  // age 35
      const noGoalRow = noGoalResult.rows[5]
      expect(goalRow.age).toBe(35)
      expect(goalRow.savingsOrWithdrawal).toBe(noGoalRow.savingsOrWithdrawal - 50000)
    })

    it('multi-year goal spreads amount equally across years', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Education', amount: 200000, targetAge: 50,
            durationYears: 4, priority: 'essential', inflationAdjusted: false, category: 'education',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 60000,
      })

      const result = generateProjection(params)
      const noGoalParams = { ...params, financialGoals: [] }
      noGoalParams.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 60000,
      })
      const noGoalResult = generateProjection(noGoalParams)

      // Each of the 4 years (ages 50-53) should deduct 50000/yr (200000/4)
      for (let i = 0; i < 4; i++) {
        const yearIdx = 50 - 30 + i
        const goalRow = result.rows[yearIdx]
        const noGoalRow = noGoalResult.rows[yearIdx]
        expect(goalRow.age).toBe(50 + i)
        expect(goalRow.savingsOrWithdrawal).toBeCloseTo(noGoalRow.savingsOrWithdrawal - 50000, 0)
      }

      // Year after goal ends (age 54) should have normal savings
      const afterGoalIdx = 54 - 30
      expect(result.rows[afterGoalIdx].savingsOrWithdrawal).toBe(noGoalResult.rows[afterGoalIdx].savingsOrWithdrawal)
    })

    it('post-retirement goal adds to oneTimeWithdrawalTotal', () => {
      const params = makeParams({
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 70,
        initialLiquidNW: 2000000,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Car', amount: 100000, targetAge: 62,
            durationYears: 1, priority: 'important', inflationAdjusted: false, category: 'vehicle',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 70,
      })

      const result = generateProjection(params)
      const noGoalParams = { ...params, financialGoals: [] }
      noGoalParams.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 70,
      })
      const noGoalResult = generateProjection(noGoalParams)

      // At age 62 (year 7), portfolio should be lower due to the 100K withdrawal
      const goalRow = result.rows[7]
      const noGoalRow = noGoalResult.rows[7]
      expect(goalRow.age).toBe(62)
      expect(goalRow.liquidNW).toBeLessThan(noGoalRow.liquidNW)
      // The difference should be approximately 100000 (goal amount)
      expect(noGoalRow.liquidNW - goalRow.liquidNW).toBeCloseTo(100000, -2)
    })

    it('inflation-adjusted goal compounds correctly', () => {
      const inflation = 0.03
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        inflation,
        financialGoals: [
          {
            id: 'g1', label: 'Reno', amount: 60000, targetAge: 40,
            durationYears: 1, priority: 'important', inflationAdjusted: true, category: 'renovation',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000,
      })

      const noGoalParams = { ...params, financialGoals: [] }
      noGoalParams.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000,
      })

      const result = generateProjection(params)
      const noGoalResult = generateProjection(noGoalParams)

      // At age 40 (year 10), the inflation-adjusted deduction should be 60000 * (1.03^10)
      const expectedDeduction = 60000 * Math.pow(1 + inflation, 10)
      const goalRow = result.rows[10]
      const noGoalRow = noGoalResult.rows[10]
      expect(goalRow.age).toBe(40)
      // savingsOrWithdrawal difference should match the inflation-adjusted amount
      expect(noGoalRow.savingsOrWithdrawal - goalRow.savingsOrWithdrawal).toBeCloseTo(expectedDeduction, 0)
    })

    it('no goals = no change to projection output', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 40,
        lifeExpectancy: 50,
        financialGoals: [],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
      })

      const emptyResult = generateProjection(params)

      const undefinedParams = { ...params }
      delete (undefinedParams as Record<string, unknown>).financialGoals
      const undefinedResult = generateProjection(undefinedParams)

      // Both should produce identical results
      expect(emptyResult.rows.length).toBe(undefinedResult.rows.length)
      for (let i = 0; i < emptyResult.rows.length; i++) {
        expect(emptyResult.rows[i].liquidNW).toBeCloseTo(undefinedResult.rows[i].liquidNW, 2)
      }
    })

    it('goals do not affect wrong years', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Wedding', amount: 50000, targetAge: 35,
            durationYears: 2, priority: 'important', inflationAdjusted: false, category: 'wedding',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 30000,
      })

      const noGoalParams = { ...params, financialGoals: [] }
      noGoalParams.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 30000,
      })
      const noGoalResult = generateProjection(noGoalParams)
      const result = generateProjection(params)

      // Before targetAge (age 34, year 4) — no deduction
      expect(result.rows[4].savingsOrWithdrawal).toBe(noGoalResult.rows[4].savingsOrWithdrawal)

      // During goal (ages 35-36, years 5-6) — deduction present
      expect(result.rows[5].savingsOrWithdrawal).toBeLessThan(noGoalResult.rows[5].savingsOrWithdrawal)
      expect(result.rows[6].savingsOrWithdrawal).toBeLessThan(noGoalResult.rows[6].savingsOrWithdrawal)

      // After goal (age 37, year 7) — no deduction
      expect(result.rows[7].savingsOrWithdrawal).toBe(noGoalResult.rows[7].savingsOrWithdrawal)
    })

    it('goal exceeding annual savings reduces portfolio', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        initialLiquidNW: 200000,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Big Goal', amount: 100000, targetAge: 31,
            durationYears: 1, priority: 'essential', inflationAdjusted: false, category: 'other',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000,
      })

      const result = generateProjection(params)

      // At age 31, savings = 20000 - 100000 = -80000
      // So savings + portfolio growth results in portfolio going down
      const row31 = result.rows[1]
      expect(row31.age).toBe(31)
      expect(row31.savingsOrWithdrawal).toBe(20000 - 100000)
    })

    it('goalExpense field shows goal cost at correct ages', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Wedding', amount: 50000, targetAge: 35,
            durationYears: 1, priority: 'important', inflationAdjusted: false, category: 'wedding',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000,
      })

      const result = generateProjection(params)

      // Age 35 (year 5): goalExpense = 50000
      expect(result.rows[5].age).toBe(35)
      expect(result.rows[5].goalExpense).toBe(50000)

      // Age 34 (year 4): no goal active → 0
      expect(result.rows[4].goalExpense).toBe(0)

      // Age 36 (year 6): goal ended → 0
      expect(result.rows[6].goalExpense).toBe(0)
    })

    it('goalExpense field shows per-year amount for multi-year goals', () => {
      const params = makeParams({
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Education', amount: 200000, targetAge: 50,
            durationYears: 4, priority: 'essential', inflationAdjusted: false, category: 'education',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 60000,
      })

      const result = generateProjection(params)

      // Ages 50-53: 200000 / 4 = 50000 per year
      for (let i = 20; i <= 23; i++) {
        expect(result.rows[i].age).toBe(50 + (i - 20))
        expect(result.rows[i].goalExpense).toBe(50000)
      }

      // Age 54 (year 24): goal ended
      expect(result.rows[24].goalExpense).toBe(0)
    })

    it('goalExpense field works for post-retirement goals', () => {
      const params = makeParams({
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 70,
        initialLiquidNW: 2000000,
        inflation: 0,
        financialGoals: [
          {
            id: 'g1', label: 'Car', amount: 100000, targetAge: 62,
            durationYears: 1, priority: 'important', inflationAdjusted: false, category: 'vehicle',
          },
        ],
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 58, lifeExpectancy: 70,
      })

      const result = generateProjection(params)

      // Age 62 (year 7): goalExpense = 100000
      const row62 = result.rows.find(r => r.age === 62)!
      expect(row62.goalExpense).toBe(100000)

      // Age 63: goal ended
      const row63 = result.rows.find(r => r.age === 63)!
      expect(row63.goalExpense).toBe(0)
    })
  })

  describe('mortgage ends after remaining years', () => {
    it('stops deducting mortgage payment after mortgage term expires', () => {
      // Mortgage remaining = 3 years from age 30, so ends at age 33
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 36,
        initialLiquidNW: 500000,
        annualMortgagePayment: 24000, // $2K/month cash portion
        existingMortgageRemainingYears: 3,
        inflation: 0, expectedReturn: 0, expenseRatio: 0,
        annualExpenses: 30000,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 36,
        annualSavings: 20000,
      })

      const result = generateProjection(params)

      // Ages 30-32 (3 years): mortgage is active, savings reduced by 24K
      // Age 33+: mortgage ended, savings should NOT be reduced by 24K
      const row32 = result.rows.find(r => r.age === 32)! // last year of mortgage
      const row33 = result.rows.find(r => r.age === 33)! // first year after mortgage

      // With mortgage: savingsOrWithdrawal = 20K - 24K = -4K
      // Without mortgage: savingsOrWithdrawal = 20K
      // So row33 should accumulate more than row32
      expect(row33.savingsOrWithdrawal).toBeGreaterThan(row32.savingsOrWithdrawal)
    })

    it('handles fractional remaining years by rounding up', () => {
      // 2 years 6 months = 2.5 years. ceil(2.5) = 3. Mortgage ends at age 33.
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 36,
        initialLiquidNW: 500000,
        annualMortgagePayment: 24000,
        existingMortgageRemainingYears: 2.5, // 2y 6m
        inflation: 0, expectedReturn: 0, expenseRatio: 0,
        annualExpenses: 30000,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 36,
        annualSavings: 20000,
      })

      const result = generateProjection(params)

      // At age 32 (year 2), mortgage still active (ceil(2.5)=3 years total)
      const row32 = result.rows.find(r => r.age === 32)!
      // At age 33 (year 3), mortgage ended
      const row33 = result.rows.find(r => r.age === 33)!

      expect(row33.savingsOrWithdrawal).toBeGreaterThan(row32.savingsOrWithdrawal)
    })
  })

  describe('CPF OA shortfall spills to cash', () => {
    it('increases cash mortgage when OA cannot cover CPF portion', () => {
      // Income rows where OA runs dry partway through
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 34,
        initialLiquidNW: 500000,
        annualMortgagePayment: 12000, // $1K/month cash portion
        existingMortgageRemainingYears: 25,
        inflation: 0, expectedReturn: 0, expenseRatio: 0,
        annualExpenses: 30000,
      })

      // Create income rows where cpfOaShortfall > 0 starting at age 32
      const incomeRows = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 34,
        annualSavings: 20000,
      })
      // Simulate: at age 32, OA is depleted and shortfall kicks in
      incomeRows[2].cpfOaShortfall = 6000 // $500/month CPF portion now unpaid by OA
      incomeRows[3].cpfOaShortfall = 6000
      incomeRows[4].cpfOaShortfall = 6000
      params.incomeProjection = incomeRows

      const result = generateProjection(params)

      // At age 31 (no shortfall): savings reduced by only cash mortgage (12K)
      const row31 = result.rows.find(r => r.age === 31)!
      // At age 32 (6K shortfall): savings should be reduced by 12K + 6K = 18K
      const row32 = result.rows.find(r => r.age === 32)!

      // The savings at age 32 should be lower than age 31 by ~6K (the shortfall)
      expect(row31.savingsOrWithdrawal - row32.savingsOrWithdrawal).toBeCloseTo(6000, -1)
    })
  })

  describe('CPF OA withdrawal to liquid NW', () => {
    it('OA withdrawal adds to liquidNW in pre-retirement', () => {
      const currentAge = 50
      const retirementAge = 60
      const lifeExpectancy = 65

      // Create income rows where age 55 has an OA withdrawal of $50K
      const incomeRows = generateMockIncomeProjection({
        currentAge,
        retirementAge,
        lifeExpectancy,
        annualSavings: 20000,
      })
      // Simulate OA withdrawal at age 55
      const row55Idx = 55 - currentAge
      incomeRows[row55Idx] = mockIncomeRow({
        ...incomeRows[row55Idx],
        cpfOaWithdrawal: 50000,
      })

      const params = makeParams({
        currentAge,
        retirementAge,
        lifeExpectancy,
        incomeProjection: incomeRows,
        initialLiquidNW: 100000,
        expectedReturn: 0,
        inflation: 0,
        expenseRatio: 0,
      })

      const result = generateProjection(params)

      // Row at age 55 should show the OA withdrawal
      const projRow55 = result.rows.find(r => r.age === 55)!
      expect(projRow55.cpfOaWithdrawal).toBe(50000)

      // Compare with no-withdrawal scenario
      const incomeRowsNoW = generateMockIncomeProjection({
        currentAge,
        retirementAge,
        lifeExpectancy,
        annualSavings: 20000,
      })
      const paramsNoW = makeParams({
        currentAge,
        retirementAge,
        lifeExpectancy,
        incomeProjection: incomeRowsNoW,
        initialLiquidNW: 100000,
        expectedReturn: 0,
        inflation: 0,
        expenseRatio: 0,
      })
      const resultNoW = generateProjection(paramsNoW)
      const projRow55NoW = resultNoW.rows.find(r => r.age === 55)!

      // LiquidNW should be $50K higher in the withdrawal scenario
      expect(projRow55.liquidNW).toBeCloseTo(projRow55NoW.liquidNW + 50000, 0)
    })

    it('OA withdrawal adds to liquidNW in post-retirement', () => {
      const currentAge = 50
      const retirementAge = 50
      const lifeExpectancy = 65

      // Create income rows where age 55 has an OA withdrawal of $30K
      const incomeRows = generateMockIncomeProjection({
        currentAge,
        retirementAge,
        lifeExpectancy,
      })
      const row55Idx = 55 - currentAge
      incomeRows[row55Idx] = mockIncomeRow({
        ...incomeRows[row55Idx],
        age: 55,
        year: row55Idx,
        isRetired: true,
        salary: 0,
        totalGross: 0,
        totalNet: 0,
        annualSavings: 0,
        cpfOaWithdrawal: 30000,
      })

      const params = makeParams({
        currentAge,
        retirementAge,
        lifeExpectancy,
        incomeProjection: incomeRows,
        initialLiquidNW: 500000,
        expectedReturn: 0,
        inflation: 0,
        expenseRatio: 0,
        annualExpenses: 50000,
      })

      const result = generateProjection(params)
      const projRow55 = result.rows.find(r => r.age === 55)!
      expect(projRow55.cpfOaWithdrawal).toBe(30000)

      // Compare with no-withdrawal scenario
      const incomeRowsNoW = generateMockIncomeProjection({
        currentAge,
        retirementAge,
        lifeExpectancy,
      })
      const paramsNoW = makeParams({
        currentAge,
        retirementAge,
        lifeExpectancy,
        incomeProjection: incomeRowsNoW,
        initialLiquidNW: 500000,
        expectedReturn: 0,
        inflation: 0,
        expenseRatio: 0,
        annualExpenses: 50000,
      })
      const resultNoW = generateProjection(paramsNoW)
      const projRow55NoW = resultNoW.rows.find(r => r.age === 55)!

      // LiquidNW should be $30K higher in the withdrawal scenario
      expect(projRow55.liquidNW).toBeCloseTo(projRow55NoW.liquidNW + 30000, 0)
    })
  })

  describe('CPF milestone MA exclusion', () => {
    it('BRS milestone does NOT trigger when only MA pushes total above threshold', () => {
      // Set up: OA+SA+RA = 80K (below BRS ~$107K), but MA = 60K → total = 140K > BRS
      // Milestone should NOT fire because MA cannot fund retirement sum
      const params = makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 34,
        expectedReturn: 0, initialLiquidNW: 100000,
      })
      params.incomeProjection = params.incomeProjection.map((row) => ({
        ...row,
        cpfOA: 50000,
        cpfSA: 20000,
        cpfMA: 60000,
        cpfRA: 10000,
      }))

      const result = generateProjection(params)

      // OA+SA+RA = 80K, which is below BRS (~$107K for age 30)
      // Total including MA = 140K would have crossed BRS under the old code
      for (const row of result.rows) {
        expect(row.cpfMilestone).not.toBe('brs')
        expect(row.cpfMilestone).not.toBe('frs')
        expect(row.cpfMilestone).not.toBe('ers')
      }
    })
  })

  describe('property projection', () => {
    it('freehold appreciation: value grows at appreciation rate', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 34,
        existingPropertyValue: 1000000,
        propertyAppreciationRate: 0.03,
        propertyLeaseYears: 999,
        applyBalaDecay: false,
        propertyEquity: 1000000,
      })
      const result = generateProjection(params)
      // Year 0 (age 30): value = 1M
      expect(result.rows[0].propertyValue).toBeCloseTo(1000000, 0)
      // Year 1 (age 31): value = 1M * 1.03
      expect(result.rows[1].propertyValue).toBeCloseTo(1030000, 0)
      // Year 4 (age 34): value = 1M * 1.03^4
      expect(result.rows[4].propertyValue).toBeCloseTo(1000000 * Math.pow(1.03, 4), 0)
    })

    it('leasehold with Bala decay: value decays via Bala ratio', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 34,
        existingPropertyValue: 500000,
        propertyAppreciationRate: 0.03,
        propertyLeaseYears: 60,
        applyBalaDecay: true,
        propertyEquity: 500000,
      })
      const result = generateProjection(params)
      // With Bala decay, value at year 0 should be the base value
      expect(result.rows[0].propertyValue).toBeCloseTo(500000, 0)
      // At year 4, the appreciated value is reduced by Bala ratio
      const appreciated = 500000 * Math.pow(1.03, 4)
      // Value with Bala decay should be less than pure appreciation
      expect(result.rows[4].propertyValue).toBeLessThan(appreciated)
      expect(result.rows[4].propertyValue).toBeGreaterThan(0)
    })

    it('leasehold without Bala decay: pure appreciation rate', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 34,
        existingPropertyValue: 500000,
        propertyAppreciationRate: 0.03,
        propertyLeaseYears: 60,
        applyBalaDecay: false,
        propertyEquity: 500000,
      })
      const result = generateProjection(params)
      // Without Bala decay, value grows at pure appreciation
      expect(result.rows[4].propertyValue).toBeCloseTo(500000 * Math.pow(1.03, 4), 0)
    })

    it('mortgage balance decreases year-over-year', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 34,
        existingPropertyValue: 1000000,
        propertyAppreciationRate: 0.03,
        propertyLeaseYears: 999,
        applyBalaDecay: false,
        propertyEquity: 700000,
        existingMortgageBalance: 300000,
        existingMortgageRate: 0.035,
        existingMonthlyPayment: 1500,
        existingMortgageRemainingYears: 25,
        annualMortgagePayment: 18000,
      })
      const result = generateProjection(params)
      // Mortgage balance should decrease each year
      expect(result.rows[0].mortgageBalance).toBeGreaterThan(0)
      expect(result.rows[1].mortgageBalance).toBeLessThan(result.rows[0].mortgageBalance)
      expect(result.rows[2].mortgageBalance).toBeLessThan(result.rows[1].mortgageBalance)
    })

    it('sell-and-rent: property value zeroes out after sale', () => {
      const params = makeParams({
        currentAge: 55, retirementAge: 54, lifeExpectancy: 60,
        existingPropertyValue: 1000000,
        propertyAppreciationRate: 0.03,
        propertyLeaseYears: 999,
        applyBalaDecay: false,
        propertyEquity: 1000000,
        downsizing: {
          scenario: 'sell-and-rent',
          sellAge: 57,
          expectedSalePrice: 1200000,
          newPropertyCost: 0,
          newMortgageRate: 0,
          newMortgageTerm: 0,
          newLtv: 0,
          monthlyRent: 2500,
          rentGrowthRate: 0.03,
        },
      })
      const result = generateProjection(params)
      const preSaleRow = result.rows.find(r => r.age === 56)!
      const postSaleRow = result.rows.find(r => r.age === 58)!
      expect(preSaleRow.propertyValue).toBeGreaterThan(0)
      expect(postSaleRow.propertyValue).toBe(0)
      expect(postSaleRow.mortgageBalance).toBe(0)
    })

    it('no property: propertyValue and mortgageBalance are 0', () => {
      const params = makeParams({
        existingPropertyValue: 0,
        propertyEquity: 0,
      })
      const result = generateProjection(params)
      for (const row of result.rows) {
        expect(row.propertyValue).toBe(0)
        expect(row.mortgageBalance).toBe(0)
      }
    })
  })

  // ============================================================
  // WS: Projection Gaps
  // ============================================================

  describe('WS: Projection Gaps', () => {
    // Shared healthcare config for tests that need it
    const hcConfig: HealthcareConfig = {
      enabled: true,
      mediShieldLifeEnabled: true,
      ispTier: 'none' as const,
      careShieldLifeEnabled: false,
      oopBaseAmount: 500,
      oopModel: 'fixed' as const,
      oopInflationRate: 0.03,
      oopReferenceAge: 30,
      mediSaveTopUpAnnual: 0,
    }

    it('SRS fields pass through from income rows', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 34,
        expectedReturn: 0, initialLiquidNW: 100000,
      })
      // Set SRS fields on all income rows
      params.incomeProjection = params.incomeProjection.map((row) => ({
        ...row,
        srsBalance: 50000,
        srsContribution: 15300,
        srsTaxableWithdrawal: 5000,
      }))

      const result = generateProjection(params)

      expect(result.rows[0].srsBalance).toBe(50000)
      expect(result.rows[0].srsContribution).toBe(15300)
      expect(result.rows[0].srsTaxableWithdrawal).toBe(5000)
      // Verify all rows, not just the first
      for (const row of result.rows) {
        expect(row.srsBalance).toBe(50000)
        expect(row.srsContribution).toBe(15300)
        expect(row.srsTaxableWithdrawal).toBe(5000)
      }
    })

    it('lockedAssetUnlock increases liquidNW', () => {
      const currentAge = 30
      const retirementAge = 40
      const lifeExpectancy = 40

      // Control run: no locked asset unlock
      const controlParams = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        expectedReturn: 0, initialLiquidNW: 100000, inflation: 0, expenseRatio: 0,
      })
      controlParams.incomeProjection = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy, annualSavings: 20000,
      })
      const controlResult = generateProjection(controlParams)

      // Test run: locked asset unlock of 50000 at year 5 (age 35)
      const testParams = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        expectedReturn: 0, initialLiquidNW: 100000, inflation: 0, expenseRatio: 0,
      })
      testParams.incomeProjection = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy, annualSavings: 20000,
      })
      testParams.incomeProjection[5] = mockIncomeRow({
        ...testParams.incomeProjection[5],
        lockedAssetUnlock: 50000,
      })
      const testResult = generateProjection(testParams)

      // At year 5 (age 35), liquidNW should be at least 50000 higher
      const controlRow5 = controlResult.rows[5]
      const testRow5 = testResult.rows[5]
      expect(testRow5.age).toBe(35)
      expect(testRow5.liquidNW - controlRow5.liquidNW).toBeGreaterThanOrEqual(50000)

      // The lockedAssetUnlock field should be passed through
      expect(testRow5.lockedAssetUnlock).toBe(50000)

      // Other years should not have lockedAssetUnlock
      expect(testResult.rows[0].lockedAssetUnlock).toBe(0)
      expect(testResult.rows[4].lockedAssetUnlock).toBe(0)
    })

    it('healthcare breakdown populated when enabled', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 34,
        expectedReturn: 0, initialLiquidNW: 500000,
        healthcareConfig: hcConfig,
      })

      const result = generateProjection(params)

      // MediShield Life premiums should be > 0 for age 30+
      expect(result.rows[0].mediShieldLifePremium).toBeGreaterThan(0)
      // MediSave deductible should be > 0 (premiums are deducted from MediSave)
      expect(result.rows[0].mediSaveDeductible).toBeGreaterThan(0)
      // ISP disabled → 0
      expect(result.rows[0].ispAdditionalPremium).toBe(0)
      // CareShield disabled → 0
      expect(result.rows[0].careShieldLifePremium).toBe(0)
      // OOP is $500 fixed → should appear
      expect(result.rows[0].oopExpense).toBeGreaterThan(0)
    })

    it('MediSave depletion reduces cpfMA', () => {
      const currentAge = 30
      const retirementAge = 65
      const lifeExpectancy = 34

      // Run WITHOUT healthcare
      const paramsNoHC = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        expectedReturn: 0, initialLiquidNW: 100000,
        healthcareConfig: null,
      })
      paramsNoHC.incomeProjection = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy, annualSavings: 20000, cpfMA: 50000,
      })
      const resultNoHC = generateProjection(paramsNoHC)

      // Run WITH healthcare
      const paramsHC = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        expectedReturn: 0, initialLiquidNW: 100000,
        healthcareConfig: hcConfig,
      })
      paramsHC.incomeProjection = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy, annualSavings: 20000, cpfMA: 50000,
      })
      const resultHC = generateProjection(paramsHC)

      // At least some rows should have lower cpfMA with healthcare enabled
      let anyLower = false
      for (let i = 0; i < resultHC.rows.length; i++) {
        if (resultHC.rows[i].cpfMA < resultNoHC.rows[i].cpfMA) {
          anyLower = true
          break
        }
      }
      expect(anyLower).toBe(true)
    })

    it('mediSaveDepletionAge in summary with low cpfMA', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90,
        expectedReturn: 0, initialLiquidNW: 100000,
        healthcareConfig: hcConfig,
      })
      // Very low cpfMA so it depletes quickly
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualSavings: 20000, cpfMA: 1000,
      })

      const result = generateProjection(params)

      // With only $1000 in MediSave and healthcare premiums, it should deplete
      expect(result.summary.mediSaveDepletionAge).not.toBeNull()
      expect(result.summary.mediSaveDepletionAge).toBeGreaterThanOrEqual(30)
    })

    it('allocation weights stored on each row', () => {
      const currentWeights = [0.60, 0.40]
      const params = makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 34,
        expectedReturn: 0, initialLiquidNW: 100000,
        currentWeights,
        targetWeights: [0.30, 0.70],
        glidePathConfig: GLIDE_PATH_DISABLED,
      })

      const result = generateProjection(params)

      // With glide path disabled, pre-retirement rows use currentWeights,
      // post-retirement rows use targetWeights
      for (const row of result.rows) {
        expect(row.allocationWeights).toBeDefined()
        expect(row.allocationWeights.length).toBe(2)
        if (!row.isRetired) {
          expect(row.allocationWeights[0]).toBeCloseTo(0.60, 5)
          expect(row.allocationWeights[1]).toBeCloseTo(0.40, 5)
        } else {
          expect(row.allocationWeights[0]).toBeCloseTo(0.30, 5)
          expect(row.allocationWeights[1]).toBeCloseTo(0.70, 5)
        }
      }
    })

    it('healthcare disabled: all breakdown fields are 0', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 34,
        expectedReturn: 0, initialLiquidNW: 100000,
        healthcareConfig: null,
      })

      const result = generateProjection(params)

      for (const row of result.rows) {
        expect(row.mediShieldLifePremium).toBe(0)
        expect(row.ispAdditionalPremium).toBe(0)
        expect(row.careShieldLifePremium).toBe(0)
        expect(row.oopExpense).toBe(0)
        expect(row.mediSaveDeductible).toBe(0)
      }
    })
  })

  // ============================================================
  // Task 1: Retirement withdrawals (durationYears + inflationAdjusted)
  // ============================================================

  describe('retirement withdrawals', () => {
    it('single-year withdrawal deducted at specified age', () => {
      const currentAge = 50
      const retirementAge = 50
      const lifeExpectancy = 55

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0, // isolate withdrawal effects
        retirementWithdrawals: [
          { id: 'rw1', label: 'Car', amount: 30000, age: 53, durationYears: 1, inflationAdjusted: false },
        ],
      })

      const result = generateProjection(params)

      // Age 53: withdrawal should be deducted
      const row53 = result.rows.find(r => r.age === 53)!
      expect(row53.retirementWithdrawalExpense).toBe(30000)

      // Ages before and after should have zero retirement withdrawal
      const row52 = result.rows.find(r => r.age === 52)!
      const row54 = result.rows.find(r => r.age === 54)!
      expect(row52.retirementWithdrawalExpense).toBe(0)
      expect(row54.retirementWithdrawalExpense).toBe(0)
    })

    it('multi-year withdrawal spans durationYears', () => {
      const currentAge = 50
      const retirementAge = 50
      const lifeExpectancy = 58

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        retirementWithdrawals: [
          { id: 'rw1', label: 'Hobby', amount: 10000, age: 52, durationYears: 3, inflationAdjusted: false },
        ],
      })

      const result = generateProjection(params)

      // Active at ages 52, 53, 54 (age >= 52 && age < 52+3)
      for (const age of [52, 53, 54]) {
        const row = result.rows.find(r => r.age === age)!
        expect(row.retirementWithdrawalExpense).toBe(10000)
      }

      // Not active outside the range
      for (const age of [51, 55, 56]) {
        const row = result.rows.find(r => r.age === age)!
        expect(row.retirementWithdrawalExpense).toBe(0)
      }
    })

    it('inflation-adjusted withdrawal grows with inflation over years', () => {
      const currentAge = 50
      const retirementAge = 50
      const lifeExpectancy = 55
      const inflation = 0.03

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        initialLiquidNW: 1000000,
        expectedReturn: 0, inflation, expenseRatio: 0,
        annualExpenses: 0,
        retirementWithdrawals: [
          { id: 'rw1', label: 'Care', amount: 20000, age: 51, durationYears: 3, inflationAdjusted: true },
        ],
      })

      const result = generateProjection(params)

      // At age 51, year = 1 (since currentAge=50), so amount = 20000 * (1.03)^1
      const row51 = result.rows.find(r => r.age === 51)!
      expect(row51.retirementWithdrawalExpense).toBeCloseTo(20000 * Math.pow(1.03, 1), 0)

      // At age 52, year = 2, so amount = 20000 * (1.03)^2
      const row52 = result.rows.find(r => r.age === 52)!
      expect(row52.retirementWithdrawalExpense).toBeCloseTo(20000 * Math.pow(1.03, 2), 0)

      // At age 53, year = 3, so amount = 20000 * (1.03)^3
      const row53 = result.rows.find(r => r.age === 53)!
      expect(row53.retirementWithdrawalExpense).toBeCloseTo(20000 * Math.pow(1.03, 3), 0)
    })

    it('overlapping retirement withdrawals are summed correctly', () => {
      const currentAge = 50
      const retirementAge = 50
      const lifeExpectancy = 55

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        retirementWithdrawals: [
          { id: 'rw1', label: 'Travel', amount: 15000, age: 52, durationYears: 2, inflationAdjusted: false },
          { id: 'rw2', label: 'Car', amount: 25000, age: 52, durationYears: 1, inflationAdjusted: false },
        ],
      })

      const result = generateProjection(params)

      // At age 52: both active → 15000 + 25000 = 40000
      const row52 = result.rows.find(r => r.age === 52)!
      expect(row52.retirementWithdrawalExpense).toBe(40000)

      // At age 53: only rw1 active → 15000
      const row53 = result.rows.find(r => r.age === 53)!
      expect(row53.retirementWithdrawalExpense).toBe(15000)

      // At age 54: neither active → 0
      const row54 = result.rows.find(r => r.age === 54)!
      expect(row54.retirementWithdrawalExpense).toBe(0)
    })
  })

  // ============================================================
  // Task 2: CPF LIFE bequest
  // ============================================================

  describe('CPF LIFE bequest', () => {
    it('standard plan: bequest decreases as cumulative payouts increase', () => {
      const currentAge = 63
      const retirementAge = 63
      const lifeExpectancy = 68
      const cpfLifeStartAge = 65

      const incomeRows = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy,
      })

      // Set annuity premium at cpfLifeStartAge row
      const startIdx = cpfLifeStartAge - currentAge
      incomeRows[startIdx] = mockIncomeRow({
        ...incomeRows[startIdx],
        age: cpfLifeStartAge,
        year: startIdx,
        isRetired: true,
        salary: 0, totalGross: 0, totalNet: 0, annualSavings: 0,
        cpfLifeAnnuityPremium: 200000,
        cpfLifePayout: 18000,
        cpfRA: 0,
      })

      // Subsequent rows get payouts but no more premium
      for (let i = startIdx + 1; i < incomeRows.length; i++) {
        incomeRows[i] = mockIncomeRow({
          ...incomeRows[i],
          age: currentAge + i,
          year: i,
          isRetired: true,
          salary: 0, totalGross: 0, totalNet: 0, annualSavings: 0,
          cpfLifePayout: 18000,
          cpfRA: 0,
        })
      }

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        incomeProjection: incomeRows,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        cpfLifeStartAge,
        cpfLifePlan: 'standard',
      })

      const result = generateProjection(params)

      // Standard plan: bequest = max(0, premium - cumulative payouts)
      const row65 = result.rows.find(r => r.age === 65)!
      const row66 = result.rows.find(r => r.age === 66)!
      const row67 = result.rows.find(r => r.age === 67)!

      // Bequest should decrease each year
      expect(row65.cpfBequest).toBeGreaterThan(0)
      expect(row66.cpfBequest).toBeLessThan(row65.cpfBequest)
      expect(row67.cpfBequest).toBeLessThan(row66.cpfBequest)
    })

    it('standard plan: bequest reaches 0 when payouts exceed premium', () => {
      const currentAge = 63
      const retirementAge = 63
      const lifeExpectancy = 80
      const cpfLifeStartAge = 65

      const incomeRows = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy,
      })

      // Premium = 100K, payout = 20K/yr → exhausted in 5 years
      const startIdx = cpfLifeStartAge - currentAge
      incomeRows[startIdx] = mockIncomeRow({
        ...incomeRows[startIdx],
        age: cpfLifeStartAge,
        year: startIdx,
        isRetired: true,
        salary: 0, totalGross: 0, totalNet: 0, annualSavings: 0,
        cpfLifeAnnuityPremium: 100000,
        cpfLifePayout: 20000,
        cpfRA: 0,
      })

      for (let i = startIdx + 1; i < incomeRows.length; i++) {
        incomeRows[i] = mockIncomeRow({
          ...incomeRows[i],
          age: currentAge + i,
          year: i,
          isRetired: true,
          salary: 0, totalGross: 0, totalNet: 0, annualSavings: 0,
          cpfLifePayout: 20000,
          cpfRA: 0,
        })
      }

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        incomeProjection: incomeRows,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        cpfLifeStartAge,
        cpfLifePlan: 'standard',
      })

      const result = generateProjection(params)

      // After 5 years of 20K payouts (100K total), bequest should be 0
      // Age 70 = 5 years after start, cumulative payouts = 6*20K = 120K > 100K
      const row70 = result.rows.find(r => r.age === 70)!
      expect(row70.cpfBequest).toBe(0)

      // Earlier row should still have bequest > 0
      const row66 = result.rows.find(r => r.age === 66)!
      expect(row66.cpfBequest).toBeGreaterThan(0)
    })

    it('basic plan: bequest includes RA balance while RA > 0, then decreases after depletion', () => {
      const currentAge = 63
      const retirementAge = 63
      const lifeExpectancy = 72
      const cpfLifeStartAge = 65

      const incomeRows = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy,
      })

      // At cpfLifeStartAge: premium = 150K, RA = 80K (depletes over time)
      const startIdx = cpfLifeStartAge - currentAge
      incomeRows[startIdx] = mockIncomeRow({
        ...incomeRows[startIdx],
        age: cpfLifeStartAge,
        year: startIdx,
        isRetired: true,
        salary: 0, totalGross: 0, totalNet: 0, annualSavings: 0,
        cpfLifeAnnuityPremium: 150000,
        cpfLifePayout: 15000,
        cpfRA: 60000, // RA still has balance
      })

      // RA depletes gradually
      const raValues = [60000, 40000, 20000, 0, 0, 0, 0]
      for (let i = startIdx; i < incomeRows.length; i++) {
        const raIdx = i - startIdx
        const ra = raValues[raIdx] ?? 0
        incomeRows[i] = mockIncomeRow({
          ...incomeRows[i],
          age: currentAge + i,
          year: i,
          isRetired: true,
          salary: 0, totalGross: 0, totalNet: 0, annualSavings: 0,
          cpfLifeAnnuityPremium: i === startIdx ? 150000 : 0,
          cpfLifePayout: 15000,
          cpfRA: ra,
        })
      }

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        incomeProjection: incomeRows,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        cpfLifeStartAge,
        cpfLifePlan: 'basic',
      })

      const result = generateProjection(params)

      // While RA > 0: bequest = RA + annuityPremium
      const row65 = result.rows.find(r => r.age === 65)!
      expect(row65.cpfBequest).toBe(60000 + 150000) // RA + premium

      const row66 = result.rows.find(r => r.age === 66)!
      expect(row66.cpfBequest).toBe(40000 + 150000)

      const row67 = result.rows.find(r => r.age === 67)!
      expect(row67.cpfBequest).toBe(20000 + 150000)

      // After RA depletes (cpfRA = 0): bequest transitions to max(0, premium - cumPayouts)
      const row68 = result.rows.find(r => r.age === 68)!
      // First year after depletion: payoutsFromAnnuity resets to 0, then adds 15000
      // bequest = max(0, 150000 - 15000) = 135000
      expect(row68.cpfBequest).toBe(135000)

      const row69 = result.rows.find(r => r.age === 69)!
      // payoutsFromAnnuity = 15000 + 15000 = 30000
      // bequest = max(0, 150000 - 30000) = 120000
      expect(row69.cpfBequest).toBe(120000)
    })
  })

  describe('goal shortfall tracking', () => {
    it('goalShortfall is 0 when goal is fully funded', () => {
      // Small goal ($1K) with a large portfolio ($100K) — fully funded
      const params = makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 34,
        initialLiquidNW: 100000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        financialGoals: [{
          id: 'g1', label: 'Vacation', amount: 1000, targetAge: 31,
          durationYears: 1, priority: 'nice-to-have', inflationAdjusted: false,
          category: 'travel',
        }],
      })
      const result = generateProjection(params)

      for (const row of result.rows) {
        expect(row.goalShortfall).toBe(0)
      }
      expect(result.summary.totalGoalShortfall).toBe(0)
    })

    it('goalShortfall tracks unfunded amount for pre-retirement goal', () => {
      // Goal of $500K at age 31, but portfolio starts at $10K with $20K savings
      // After year 0: liquidNW = 10K + 20K = 30K
      // At age 31: 30K + 20K - 500K = -450K → shortfall = min(500K, 450K) = 450K
      const params = makeParams({
        currentAge: 30, retirementAge: 35, lifeExpectancy: 36,
        initialLiquidNW: 10000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        financialGoals: [{
          id: 'g1', label: 'Property', amount: 500000, targetAge: 31,
          durationYears: 1, priority: 'essential', inflationAdjusted: false,
          category: 'housing',
        }],
      })
      const result = generateProjection(params)

      const goalRow = result.rows.find(r => r.age === 31)!
      expect(goalRow.goalShortfall).toBeGreaterThan(0)
      expect(goalRow.goalExpense).toBe(500000)
      expect(goalRow.liquidNW).toBe(0)

      // Non-goal rows should have 0 shortfall
      const otherRows = result.rows.filter(r => r.age !== 31)
      for (const row of otherRows) {
        expect(row.goalShortfall).toBe(0)
      }

      expect(result.summary.totalGoalShortfall).toBe(goalRow.goalShortfall)
    })

    it('goalShortfall tracks unfunded amount for post-retirement goal', () => {
      // Small portfolio ($10K) with a large post-retirement goal ($100K)
      const params = makeParams({
        currentAge: 30, retirementAge: 30, lifeExpectancy: 33,
        initialLiquidNW: 10000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        financialGoals: [{
          id: 'g1', label: 'Gift', amount: 100000, targetAge: 31,
          durationYears: 1, priority: 'essential', inflationAdjusted: false,
          category: 'other',
        }],
      })
      const result = generateProjection(params)

      const goalRow = result.rows.find(r => r.age === 31)!
      expect(goalRow.goalShortfall).toBeGreaterThan(0)
      expect(goalRow.liquidNW).toBe(0)

      expect(result.summary.totalGoalShortfall).toBe(goalRow.goalShortfall)
    })
  })

  describe('pre-retirement depletion tracking', () => {
    it('portfolioDepletedAge is set when pre-retirement goal depletes portfolio', () => {
      // Portfolio starts at $10K, massive goal at age 30 ($1M) depletes immediately
      const params = makeParams({
        currentAge: 30, retirementAge: 35, lifeExpectancy: 36,
        initialLiquidNW: 10000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        financialGoals: [{
          id: 'g1', label: 'Property', amount: 1000000, targetAge: 30,
          durationYears: 1, priority: 'essential', inflationAdjusted: false,
          category: 'housing',
        }],
      })
      const result = generateProjection(params)

      expect(result.summary.portfolioDepletedAge).toBe(30)
      expect(result.rows[0].liquidNW).toBe(0)
    })

    it('portfolioDepletedAge is null when portfolio survives pre-retirement', () => {
      // No goals, positive savings — portfolio should not deplete
      const result = generateProjection(makeParams({
        currentAge: 30, retirementAge: 33, lifeExpectancy: 34,
        initialLiquidNW: 100000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
      }))

      expect(result.summary.portfolioDepletedAge).toBeNull()
      for (const row of result.rows) {
        expect(row.liquidNW).toBeGreaterThan(0)
      }
    })
  })

  describe('retirement withdrawal shortfall tracking', () => {
    it('retirementWithdrawalShortfall is 0 when withdrawal is fully funded', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 30, lifeExpectancy: 33,
        initialLiquidNW: 500000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        retirementWithdrawals: [{
          id: 'rw1', label: 'Renovation', amount: 10000, age: 31,
          durationYears: 1, inflationAdjusted: false,
        }],
      })
      const result = generateProjection(params)

      for (const row of result.rows) {
        expect(row.retirementWithdrawalShortfall).toBe(0)
      }
      expect(result.summary.totalRetirementWithdrawalShortfall).toBe(0)
    })

    it('retirementWithdrawalShortfall tracks unfunded withdrawal amount', () => {
      // Small portfolio ($10K), large withdrawal ($200K) at age 31
      const params = makeParams({
        currentAge: 30, retirementAge: 30, lifeExpectancy: 33,
        initialLiquidNW: 10000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        retirementWithdrawals: [{
          id: 'rw1', label: 'Big Purchase', amount: 200000, age: 31,
          durationYears: 1, inflationAdjusted: false,
        }],
      })
      const result = generateProjection(params)

      const rwRow = result.rows.find(r => r.age === 31)!
      expect(rwRow.retirementWithdrawalShortfall).toBeGreaterThan(0)
      expect(rwRow.retirementWithdrawalExpense).toBe(200000)
      expect(rwRow.liquidNW).toBe(0)

      expect(result.summary.totalRetirementWithdrawalShortfall).toBe(rwRow.retirementWithdrawalShortfall)
    })

    it('proportionally attributes shortfall when both goals and withdrawals deplete portfolio', () => {
      // Portfolio $10K, goal $100K and withdrawal $100K both at age 31
      // Both should get proportional share of the deficit
      const params = makeParams({
        currentAge: 30, retirementAge: 30, lifeExpectancy: 33,
        initialLiquidNW: 10000,
        expectedReturn: 0, inflation: 0, expenseRatio: 0,
        annualExpenses: 0,
        financialGoals: [{
          id: 'g1', label: 'Goal', amount: 100000, targetAge: 31,
          durationYears: 1, priority: 'essential', inflationAdjusted: false,
          category: 'other',
        }],
        retirementWithdrawals: [{
          id: 'rw1', label: 'Withdrawal', amount: 100000, age: 31,
          durationYears: 1, inflationAdjusted: false,
        }],
      })
      const result = generateProjection(params)

      const row31 = result.rows.find(r => r.age === 31)!
      // Both are equal amounts, so shortfall should be split roughly equally
      expect(row31.goalShortfall).toBeGreaterThan(0)
      expect(row31.retirementWithdrawalShortfall).toBeGreaterThan(0)
      expect(row31.goalShortfall).toBeCloseTo(row31.retirementWithdrawalShortfall, 2)
      expect(row31.liquidNW).toBe(0)
    })
  })

  // ============================================================
  // Barista FIRE: post-retirement employment income reduces portfolio withdrawal
  // ============================================================

  describe('Barista FIRE post-retirement employment income', () => {
    it('employment salary in retired years reduces expense gap and portfolio withdrawal', () => {
      const currentAge = 30
      const retirementAge = 32
      const lifeExpectancy = 37
      const baristaStartAge = 34
      const baristaEndAge = 36
      const baristaSalary = 30000
      const annualExpenses = 50000

      // Build income rows: salary=0 for retired years, except barista years get salary
      const incomeRows: IncomeProjectionRow[] = []
      for (let age = currentAge; age <= lifeExpectancy; age++) {
        const year = age - currentAge
        const isRetired = age > retirementAge
        const hasBaristaJob = age >= baristaStartAge && age <= baristaEndAge
        const salary = !isRetired ? 72000 : (hasBaristaJob ? baristaSalary : 0)

        incomeRows.push(mockIncomeRow({
          year,
          age,
          salary,
          totalGross: salary,
          sgTax: !isRetired ? 3000 : 0,
          cpfEmployee: !isRetired ? 14400 : (hasBaristaJob ? 6000 : 0),
          cpfEmployer: !isRetired ? 12240 : (hasBaristaJob ? 5100 : 0),
          totalNet: !isRetired ? 54600 : salary,
          annualSavings: !isRetired ? 20000 : 0,
          cumulativeSavings: !isRetired ? 20000 * (year + 1) : 20000 * (retirementAge - currentAge),
          isRetired,
        }))
      }

      const result = generateProjection(makeParams({
        currentAge,
        retirementAge,
        lifeExpectancy,
        annualExpenses,
        initialLiquidNW: 500000,
        incomeProjection: incomeRows,
        expectedReturn: 0, // zero return to isolate the income effect
        inflation: 0,
      }))

      // During barista years (34-36), the $30K salary should reduce
      // the expense gap from $50K to $20K
      const baristaRow = result.rows.find(r => r.age === 34)!
      const noBaristaRow = result.rows.find(r => r.age === 33)! // no barista income

      // Without barista income, full $50K expenses come from portfolio
      expect(noBaristaRow.withdrawalAmount).toBeCloseTo(50000, 0)

      // With barista income, only $20K gap comes from portfolio
      expect(baristaRow.withdrawalAmount).toBeCloseTo(20000, 0)
    })
  })

  describe('withdrawalBasis', () => {
    it('rate mode: Terminal NW differs from expense mode', () => {
      // retirementAge: 54 → currentAge 55 is already retired (55 > 54)
      // 0% return, $1M portfolio: rate mode draws $40K/yr, expense mode draws $48K/yr
      // After 5 years: rate=$800K remaining, expense=$760K remaining
      const base = makeParams({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 59,  // short enough that neither depletes
        initialLiquidNW: 1_000_000,
        annualExpenses: 48000,
        swr: 0.04,
        withdrawalStrategy: 'constant_dollar',
        inflation: 0,
        expectedReturn: 0,
      })
      base.incomeProjection = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 54, lifeExpectancy: 59,
      })
      base.strategyParams = { ...DEFAULT_STRATEGY_PARAMS, constant_dollar: { swr: 0.04 } }

      const expenseResult = generateProjection({ ...base, withdrawalBasis: 'expenses' })
      const rateResult = generateProjection({ ...base, withdrawalBasis: 'rate' })

      // Rate-driven: $1M × 4% = $40K, Expense-driven: $48K
      // Different withdrawals → different terminal NW
      expect(rateResult.summary.terminalLiquidNW).not.toBeCloseTo(expenseResult.summary.terminalLiquidNW, 0)
      // Rate draws less ($40K vs $48K) → higher terminal NW
      expect(rateResult.summary.terminalLiquidNW).toBeGreaterThan(expenseResult.summary.terminalLiquidNW)
    })

    it('rate mode: high income offsets strategy withdrawal correctly', () => {
      // $60K income, $30K expenses, 5% SWR on $1M = $50K withdrawal
      // Rate mode: net draw = max(0, $50K - $60K) = $0, surplus $10K reinvested
      // Expense mode: expense gap = max(0, $30K - $60K) = $0, surplus $30K reinvested
      // retirementAge: 54 → currentAge 55 is already retired
      const base = makeParams({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 60,
        initialLiquidNW: 1_000_000,
        annualExpenses: 30000,
        swr: 0.05,
        withdrawalStrategy: 'constant_dollar',
        inflation: 0,
        expectedReturn: 0,
      })
      base.strategyParams = { ...DEFAULT_STRATEGY_PARAMS, constant_dollar: { swr: 0.05 } }

      // Override income projection to have post-retirement income of $60K
      const incomeRows = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 54, lifeExpectancy: 60,
        rentalIncome: 60000,
      })

      const expenseResult = generateProjection({ ...base, incomeProjection: incomeRows, withdrawalBasis: 'expenses' })
      const rateResult = generateProjection({ ...base, incomeProjection: incomeRows, withdrawalBasis: 'rate' })

      // In expense mode: surplus = $30K reinvested each year
      // In rate mode: surplus = $10K reinvested each year (income - withdrawal = 60K - 50K)
      // So expense mode has higher terminal NW (more surplus reinvested)
      expect(expenseResult.summary.terminalLiquidNW).toBeGreaterThan(rateResult.summary.terminalLiquidNW)
    })

    it('rate mode: first retirement row withdrawal matches portfolio × swr - income', () => {
      // retirementAge: 54 → age 55 is retired (55 > 54)
      const base = makeParams({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 60,
        initialLiquidNW: 1_000_000,
        annualExpenses: 48000,
        swr: 0.04,
        withdrawalStrategy: 'constant_dollar',
        inflation: 0,
        expectedReturn: 0,
        withdrawalBasis: 'rate',
      })
      base.strategyParams = { ...DEFAULT_STRATEGY_PARAMS, constant_dollar: { swr: 0.04 } }

      // Add some post-retirement income
      const incomeRows = generateMockIncomeProjection({
        currentAge: 55, retirementAge: 54, lifeExpectancy: 60,
        rentalIncome: 10000,
      })

      const result = generateProjection({ ...base, incomeProjection: incomeRows })
      const firstRetiredRow = result.rows.find(r => r.age === 55)!

      // Expected: net draw = max(0, 1M × 0.04 - 10K) = max(0, 40K - 10K) = $30K
      expect(firstRetiredRow.withdrawalAmount).toBeCloseTo(30000, 0)
    })
  })

  describe('yearlyReturns override', () => {
    it('uses provided yearly returns instead of expected return', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
        expectedReturn: 0.05, expenseRatio: 0,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
      })
      const baseResult = generateProjection(params)

      // Create a return sequence that's dramatically different (all 20%)
      const nYears = 50 - 30
      const highReturns = Array(nYears).fill(0.20)

      const overrideResult = generateProjection({
        ...params,
        yearlyReturns: highReturns,
      })

      // With 20% annual returns, the portfolio should be much larger
      const baseRetirement = baseResult.rows.find(r => r.age === 40)!
      const overrideRetirement = overrideResult.rows.find(r => r.age === 40)!
      expect(overrideRetirement.liquidNW).toBeGreaterThan(baseRetirement.liquidNW)
    })

    it('deterministic columns remain identical regardless of yearlyReturns', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
        expenseRatio: 0,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
      })
      const nYears = 50 - 30
      const result1 = generateProjection({ ...params, yearlyReturns: Array(nYears).fill(0.05) })
      const result2 = generateProjection({ ...params, yearlyReturns: Array(nYears).fill(0.15) })

      // Income, CPF contributions, tax should be identical
      for (let i = 0; i < result1.rows.length; i++) {
        expect(result1.rows[i].salary).toBe(result2.rows[i].salary)
        expect(result1.rows[i].cpfEmployee).toBe(result2.rows[i].cpfEmployee)
        expect(result1.rows[i].sgTax).toBe(result2.rows[i].sgTax)
      }
    })

    it('falls back to deterministic return when yearlyReturns is shorter than timeline', () => {
      const params = makeParams({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
        expenseRatio: 0,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge: 30, retirementAge: 40, lifeExpectancy: 50,
      })
      const nYears = 50 - 30
      const shortReturns = Array(nYears).fill(0.10) // exactly nYears, one short of totalYears+1
      const result = generateProjection({ ...params, yearlyReturns: shortReturns })
      // Should not throw, should produce valid rows
      expect(result.rows).toHaveLength(nYears + 1)
    })
  })

  describe('yearlyReturnsOffset alignment', () => {
    it('pre-offset years use deterministic return, offset years use MC returns', () => {
      // Simulate fireTarget mode: MC starts at retirementAge (40),
      // projection starts at currentAge (30). Offset = 10.
      const currentAge = 30
      const retirementAge = 40
      const lifeExpectancy = 50
      const offset = retirementAge - currentAge // 10

      const params = makeParams({
        currentAge, retirementAge, lifeExpectancy,
        expectedReturn: 0.05, expenseRatio: 0,
      })
      params.incomeProjection = generateMockIncomeProjection({
        currentAge, retirementAge, lifeExpectancy,
      })

      const nMCYears = lifeExpectancy - retirementAge // 10
      const mcReturns = Array(nMCYears).fill(0.25) // extremely high to be distinguishable

      const result = generateProjection({
        ...params,
        yearlyReturns: mcReturns,
        yearlyReturnsOffset: offset,
      })

      // Baseline without MC override
      const baseline = generateProjection(params)

      // Pre-retirement rows (age < retirementAge) should match baseline exactly
      // because mcIndex = yearIndex - offset < 0 → falls back to deterministic
      for (let age = currentAge; age < retirementAge; age++) {
        const mcRow = result.rows.find(r => r.age === age)!
        const baseRow = baseline.rows.find(r => r.age === age)!
        expect(mcRow.liquidNW).toBe(baseRow.liquidNW)
      }

      // Post-retirement rows should differ (MC returns of 25% vs 5% deterministic)
      const mcRetired = result.rows.find(r => r.age === retirementAge + 1)!
      const baseRetired = baseline.rows.find(r => r.age === retirementAge + 1)!
      expect(mcRetired.liquidNW).not.toBe(baseRetired.liquidNW)
    })
  })

  describe('CPF auto-fallback withdrawal', () => {
    it('withdraws from CPF OA when liquid NW hits zero', () => {
      const incomeRows = generateMockIncomeProjection({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 65,
        annualSavings: 0,
        salary: 0,
        cpfOA: 300000,
      })
      // One-time retirement withdrawals push netPortfolioDraw above startLiquidNW,
      // making rawPostRetLiquidNW go negative and triggering CPF auto-fallback.
      const result = generateProjection(makeParams({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 65,
        initialLiquidNW: 100000,
        annualExpenses: 50000,
        expectedReturn: 0,
        incomeProjection: incomeRows,
        cpfAutoFallback: true,
        cpfAutoFallbackIncludeSA: false,
        retirementWithdrawals: [
          { id: 'test-rw', label: 'Test', age: 56, amount: 80000, durationYears: 1, inflationAdjusted: false },
        ],
      }))

      const depletedRows = result.rows.filter(r => r.isRetired && r.cpfAutoOaWithdrawal > 0)
      expect(depletedRows.length).toBeGreaterThan(0)

      // At age 56, the $80K one-time withdrawal + $50K expenses exceed portfolio,
      // so CPF OA should supply the shortfall
      const row56 = result.rows.find(r => r.age === 56)!
      expect(row56.cpfAutoOaWithdrawal).toBeGreaterThan(0)
      expect(row56.liquidNW).toBeGreaterThanOrEqual(0)
      // CPF OA should be reduced by the withdrawal amount
      expect(row56.cpfOA).toBeLessThan(300000)
    })

    it('does not withdraw when cpfAutoFallback is disabled', () => {
      const incomeRows = generateMockIncomeProjection({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 65,
        annualSavings: 0,
        salary: 0,
        cpfOA: 300000,
      })
      // Same scenario that triggers fallback when enabled, but with flag off
      const result = generateProjection(makeParams({
        currentAge: 55,
        retirementAge: 54,
        lifeExpectancy: 65,
        initialLiquidNW: 100000,
        annualExpenses: 50000,
        expectedReturn: 0,
        incomeProjection: incomeRows,
        cpfAutoFallback: false,
        cpfAutoFallbackIncludeSA: false,
        retirementWithdrawals: [
          { id: 'test-rw', label: 'Test', age: 56, amount: 80000, durationYears: 1, inflationAdjusted: false },
        ],
      }))

      const autoWithdrawals = result.rows.filter(r => r.cpfAutoOaWithdrawal > 0)
      expect(autoWithdrawals.length).toBe(0)
    })

    it('does not withdraw before age 55', () => {
      const incomeRows = generateMockIncomeProjection({
        currentAge: 50,
        retirementAge: 49,
        lifeExpectancy: 60,
        annualSavings: 0,
        salary: 0,
        cpfOA: 300000,
      })
      // One-time withdrawal at age 52 (before 55) should NOT trigger CPF auto-fallback
      const result = generateProjection(makeParams({
        currentAge: 50,
        retirementAge: 49,
        lifeExpectancy: 60,
        initialLiquidNW: 100000,
        annualExpenses: 50000,
        expectedReturn: 0,
        incomeProjection: incomeRows,
        cpfAutoFallback: true,
        cpfAutoFallbackIncludeSA: false,
        retirementWithdrawals: [
          { id: 'test-rw', label: 'Test', age: 52, amount: 80000, durationYears: 1, inflationAdjusted: false },
        ],
      }))

      const before55 = result.rows.filter(r => r.age < 55 && r.cpfAutoOaWithdrawal > 0)
      expect(before55.length).toBe(0)
    })
  })

  describe('CPF virtual rebalancing', () => {
    it('adjusts allocation weights when CPF counted as bonds', () => {
      const incomeRows = generateMockIncomeProjection({
        currentAge: 55,
        retirementAge: 55,
        lifeExpectancy: 60,
        annualSavings: 0,
        salary: 0,
        cpfOA: 300000,
      })
      const result = generateProjection(makeParams({
        currentAge: 55,
        retirementAge: 55,
        lifeExpectancy: 60,
        initialLiquidNW: 800000,
        annualExpenses: 40000,
        usePortfolioReturn: true,
        assetReturns: [0.10, 0.08, 0.09, 0.04, 0.07, 0.03, 0.02, 0.04],
        currentWeights: [0.30, 0.10, 0.20, 0.20, 0.05, 0.05, 0.05, 0.05],
        targetWeights: [0.30, 0.10, 0.20, 0.20, 0.05, 0.05, 0.05, 0.05],
        incomeProjection: incomeRows,
        cpfVirtualRebalancing: true,
        cpfVirtualRebalancingMode: 'from55',
      }))

      // Check that cpfCountedAsBonds is populated
      const retiredRows = result.rows.filter(r => r.isRetired)
      expect(retiredRows.some(r => r.cpfCountedAsBonds > 0)).toBe(true)

      // Compare: rebalancing should produce higher liquid NW (more equity = higher returns)
      const noRebal = generateProjection(makeParams({
        currentAge: 55,
        retirementAge: 55,
        lifeExpectancy: 60,
        initialLiquidNW: 800000,
        annualExpenses: 40000,
        usePortfolioReturn: true,
        assetReturns: [0.10, 0.08, 0.09, 0.04, 0.07, 0.03, 0.02, 0.04],
        currentWeights: [0.30, 0.10, 0.20, 0.20, 0.05, 0.05, 0.05, 0.05],
        targetWeights: [0.30, 0.10, 0.20, 0.20, 0.05, 0.05, 0.05, 0.05],
        incomeProjection: incomeRows,
        cpfVirtualRebalancing: false,
      }))

      const lastRebal = result.rows[result.rows.length - 1]
      const lastNoRebal = noRebal.rows[noRebal.rows.length - 1]
      expect(lastRebal.liquidNW).toBeGreaterThan(lastNoRebal.liquidNW)
    })

    it('does not rebalance when disabled', () => {
      const incomeRows = generateMockIncomeProjection({
        currentAge: 55,
        retirementAge: 55,
        lifeExpectancy: 60,
        cpfOA: 300000,
      })
      const result = generateProjection(makeParams({
        currentAge: 55,
        retirementAge: 55,
        lifeExpectancy: 60,
        incomeProjection: incomeRows,
        cpfVirtualRebalancing: false,
      }))

      const rows = result.rows.filter(r => r.cpfCountedAsBonds > 0)
      expect(rows.length).toBe(0)
    })
  })
})
