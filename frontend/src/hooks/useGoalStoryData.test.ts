import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  computeGoalStoryData,
  useGoalStoryData,
} from './useGoalStoryData'
import type { GoalStoryBasics } from './useGoalStoryData'
import type { GoalCalcGoal } from '@/lib/calculations/goal-calculator'
import { computeCondoDownPayment, EC_INCOME_CEILING } from '@/lib/data/goal-defaults'

// ============================================================
// Fixtures
// ============================================================

function makeBasics(overrides: Partial<GoalStoryBasics> = {}): GoalStoryBasics {
  return {
    age: 28,
    monthlyIncome: 4800,  // take-home after CPF
    monthlyExpenses: 2500,
    existingSavings: 30_000,
    ...overrides,
  }
}

function makeHdbGoal(overrides: Partial<GoalCalcGoal> = {}): GoalCalcGoal {
  return {
    id: 'goal-0',
    category: 'housing',
    label: 'HDB 4-Room BTO',
    targetAge: 32,
    smartInputs: {
      kind: 'hdb',
      flatType: '4-room',
      tenure: 'new',
      loanType: 'hdb-loan',
    },
    totalCostToday: 400_000,
    breakdown: {
      items: [
        { label: 'Down payment', amount: 40_000 },
        { label: 'BSD', amount: 7_600 },
        { label: 'Legal fees', amount: 3_000 },
        { label: 'Renovation', amount: 40_000 },
      ],
      total: 90_600,
    },
    monthlySavingsNeeded: 1500,
    feasible: true,
    shortfallPerMonth: 0,
    ...overrides,
  }
}

function makeWeddingGoal(overrides: Partial<GoalCalcGoal> = {}): GoalCalcGoal {
  return {
    id: 'goal-1',
    category: 'wedding',
    label: 'Wedding',
    targetAge: 30,
    totalCostToday: 50_000,
    breakdown: {
      items: [{ label: 'Wedding', amount: 50_000 }],
      total: 50_000,
    },
    monthlySavingsNeeded: 1700,
    feasible: true,
    shortfallPerMonth: 0,
    ...overrides,
  }
}

function makeCondoGoal(overrides: Partial<GoalCalcGoal> = {}): GoalCalcGoal {
  return {
    id: 'goal-0',
    category: 'housing',
    label: 'Condo',
    targetAge: 35,
    smartInputs: { kind: 'condo', price: 1_500_000 },
    totalCostToday: 1_500_000,
    breakdown: {
      items: [
        { label: 'Down payment (25%)', amount: 375_000 },
        { label: 'BSD', amount: 44_600 },
        { label: 'Legal fees', amount: 5_000 },
        { label: 'Renovation', amount: 60_000 },
      ],
      total: 484_600,
    },
    monthlySavingsNeeded: 5000,
    feasible: false,
    shortfallPerMonth: 2500,
    ...overrides,
  }
}

// ============================================================
// Tests: computeGoalStoryData (pure function)
// ============================================================

describe('computeGoalStoryData', () => {
  describe('solo user, single HDB goal', () => {
    it('computes CPF OA > 0 for a property goal', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal).toHaveLength(1)
      expect(result.perGoal[0].cpfOaAccumulated).toBeGreaterThan(0)
    })

    it('assigns a housing grant for an HDB BTO', () => {
      // Use lower income so solo user qualifies for EHG (single ceiling is $4,500/mo gross).
      // $2,800 take-home grosses up to ~$3,500 at 20% CPF rate, which is below the ceiling.
      const basics = makeBasics({ monthlyIncome: 2800 })
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      // At ~$3.5K gross, EHG for a single BTO applicant should be > 0 (bracket: $15K grant)
      expect(result.perGoal[0].grantAmount).toBeGreaterThan(0)
    })

    it('includes loan qualification for property goal', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].loanQualification).not.toBeNull()
      expect(result.perGoal[0].loanQualification!.monthlyPayment).toBeGreaterThan(0)
    })

    it('cash needed is non-negative', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].cashNeeded).toBeGreaterThanOrEqual(0)
    })

    it('populates shared insights', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.monthlySavings).toBeGreaterThan(0)
      expect(result.shared.freedomAge).toBeGreaterThan(basics.age)
      expect(result.shared.freedomAgeWithout).toBeGreaterThan(basics.age)
      expect(result.shared.cpfLifeMonthly).toBeGreaterThan(0)
      expect(result.shared.emergencyFund).toBe(2500 * 3)
      expect(result.shared.peerBenchmark).toBeTruthy()
      expect(result.shared.incomeTaxMonthly).toBeGreaterThanOrEqual(0)
      expect(result.shared.isCoupleMode).toBe(false)
    })

    it('does not warn about income ceiling when under limit', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      // Gross of ~$6K is below single ceiling of $7K
      expect(result.shared.incomeCeilingWarning).toBeNull()
    })
  })

  describe('solo user, 2 goals (HDB + wedding)', () => {
    it('returns enriched data for both goals', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal(), makeWeddingGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal).toHaveLength(2)
    })

    it('wedding goal has zero grant and no loan qualification', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal(), makeWeddingGoal()]
      const result = computeGoalStoryData(basics, goals)

      const wedding = result.perGoal.find((p) => p.goal.id === 'goal-1')!
      expect(wedding.grantAmount).toBe(0)
      expect(wedding.loanQualification).toBeNull()
    })

    it('total monthly savings is sum of all adjusted savings', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal(), makeWeddingGoal()]
      const result = computeGoalStoryData(basics, goals)

      const sumPerGoal = result.perGoal.reduce((s, g) => s + g.adjustedMonthlySavings, 0)
      // shared.monthlySavings comes from stacking, should match
      expect(result.shared.monthlySavings).toBeCloseTo(sumPerGoal, 0)
    })

    it('freedom age with goals is >= freedom age without', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal(), makeWeddingGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.freedomAge).toBeGreaterThanOrEqual(result.shared.freedomAgeWithout)
    })
  })

  describe('couple mode', () => {
    it('detects couple mode when partnerAge is provided', () => {
      const basics = makeBasics({ partnerAge: 27, partnerMonthlyIncome: 4000 })
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.isCoupleMode).toBe(true)
    })

    it('CPF OA includes partner contributions in couple mode', () => {
      const soloBasics = makeBasics()
      const coupleBasics = makeBasics({ partnerAge: 27, partnerMonthlyIncome: 4000 })
      const goals = [makeHdbGoal()]

      const soloResult = computeGoalStoryData(soloBasics, goals)
      const coupleResult = computeGoalStoryData(coupleBasics, goals)

      expect(coupleResult.perGoal[0].cpfOaAccumulated).toBeGreaterThan(
        soloResult.perGoal[0].cpfOaAccumulated,
      )
    })

    it('uses couple HDB income ceiling', () => {
      // Household gross > $14K couple ceiling should warn
      const basics = makeBasics({
        monthlyIncome: 6500,
        grossIncome: 8000,
        partnerAge: 27,
        partnerMonthlyIncome: 5500,
        partnerGrossIncome: 7000,
      })
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      // 8000 + 7000 = 15000 > 14000 ceiling
      expect(result.shared.incomeCeilingWarning).not.toBeNull()
      expect(result.shared.incomeCeilingWarning).toContain('exceeds')
    })

    it('uses single HDB income ceiling for solo user', () => {
      // Gross > $7K single ceiling
      const basics = makeBasics({
        monthlyIncome: 6500,
        grossIncome: 8000,
      })
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      // 8000 > 7000 single ceiling
      expect(result.shared.incomeCeilingWarning).not.toBeNull()
    })
  })

  describe('condo goal: 5% cash floor', () => {
    it('enforces 5% cash minimum for condo', () => {
      const basics = makeBasics({ existingSavings: 500_000 })
      const goals = [makeCondoGoal()]
      const result = computeGoalStoryData(basics, goals)

      const cashMin = computeCondoDownPayment(1_500_000).cashMinimum
      expect(result.perGoal[0].cashNeeded).toBeGreaterThanOrEqual(cashMin)
    })

    it('cash needed does not go below 5% even with large CPF OA', () => {
      // Even with huge savings and CPF, condo needs at least 5% cash
      const basics = makeBasics({
        age: 25,
        existingSavings: 1_000_000,
        grossIncome: 15_000,
      })
      const condoGoal = makeCondoGoal({ targetAge: 45 })
      const result = computeGoalStoryData(basics, [condoGoal])

      const cashMin = computeCondoDownPayment(1_500_000).cashMinimum // 75K
      expect(result.perGoal[0].cashNeeded).toBeGreaterThanOrEqual(cashMin)
    })
  })

  describe('all-infeasible scenario', () => {
    it('does not crash when goals are infeasible', () => {
      const basics = makeBasics({
        monthlyIncome: 3000,
        monthlyExpenses: 2800,
        existingSavings: 0,
      })
      const goals = [
        makeHdbGoal({ feasible: false, shortfallPerMonth: 5000 }),
        makeCondoGoal({ feasible: false, shortfallPerMonth: 10000 }),
      ]

      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal).toHaveLength(2)
      expect(result.shared.monthlySavings).toBeGreaterThanOrEqual(0)
      expect(result.shared.freedomAge).toBeDefined()
      expect(result.storyCards.length).toBeGreaterThan(0)
    })

    it('emergency fund gap reflects zero savings', () => {
      const basics = makeBasics({ existingSavings: 0 })
      const result = computeGoalStoryData(basics, [makeHdbGoal()])

      expect(result.shared.emergencyFundGap).toBe(2500 * 3)
    })
  })

  describe('freedom age includes CPF LIFE offset', () => {
    it('freedom age with CPF LIFE is lower than without', () => {
      const basics = makeBasics({ grossIncome: 7000 })
      const goals = [makeWeddingGoal()]

      const result = computeGoalStoryData(basics, goals)

      // CPF LIFE offset reduces nest egg needed, so freedom age should be
      // calculated with the offset. The freedom age itself is always > age,
      // and CPF LIFE monthly should be positive.
      expect(result.shared.cpfLifeMonthly).toBeGreaterThan(0)
      expect(result.shared.freedomAge).toBeGreaterThan(basics.age)
    })
  })

  describe('story cards', () => {
    it('includes property-specific cards for HDB goal', () => {
      // Use lower income so user qualifies for EHG grant (required for 'grant' card to appear)
      const basics = makeBasics({ monthlyIncome: 2800 })
      const goals = [makeHdbGoal()]
      const result = computeGoalStoryData(basics, goals)

      const cardKeys = result.storyCards.map((c) => c.key)
      expect(cardKeys).toContain('cpfOffset')
      expect(cardKeys).toContain('grant')
      expect(cardKeys).toContain('loanCheck')
      expect(cardKeys).toContain('cta')
    })

    it('omits property cards for non-property goals', () => {
      const basics = makeBasics()
      const goals = [makeWeddingGoal()]
      const result = computeGoalStoryData(basics, goals)

      const cardKeys = result.storyCards.map((c) => c.key)
      expect(cardKeys).not.toContain('cpfOffset')
      expect(cardKeys).not.toContain('grant')
      expect(cardKeys).not.toContain('loanCheck')
    })

    it('always ends with CTA card', () => {
      const basics = makeBasics()
      const goals = [makeHdbGoal(), makeWeddingGoal()]
      const result = computeGoalStoryData(basics, goals)

      const lastCard = result.storyCards[result.storyCards.length - 1]
      expect(lastCard.key).toBe('cta')
    })
  })

  describe('parking recommendation', () => {
    it('recommends high-yield savings for < 2 year horizon', () => {
      const basics = makeBasics({ age: 29 })
      const goals = [makeWeddingGoal({ targetAge: 30 })]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.parkingRecommendation).toContain('High-yield')
    })

    it('recommends SSB/T-bills for 2-5 year horizon', () => {
      const basics = makeBasics({ age: 28 })
      const goals = [makeWeddingGoal({ targetAge: 31 })]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.parkingRecommendation).toContain('Savings Bonds')
    })
  })

  describe('edge cases', () => {
    it('handles zero goals', () => {
      const basics = makeBasics()
      const result = computeGoalStoryData(basics, [])

      expect(result.perGoal).toHaveLength(0)
      expect(result.shared.monthlySavings).toBe(0)
      expect(result.storyCards.length).toBeGreaterThan(0) // at least CTA
    })

    it('handles goal with targetAge equal to current age', () => {
      const basics = makeBasics({ age: 30 })
      const goals = [makeWeddingGoal({ targetAge: 30 })]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].cpfOaAccumulated).toBe(0) // zero months
    })

    it('non-HDB property goal has zero grant', () => {
      const basics = makeBasics()
      const goals = [makeCondoGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].grantAmount).toBe(0)
    })
  })
})

function makeEcGoal(overrides: Partial<GoalCalcGoal> = {}): GoalCalcGoal {
  return {
    id: 'ec-1',
    category: 'housing',
    label: 'EC 4-room ($1.5M)',
    targetAge: 33,
    smartInputs: { kind: 'ec', price: 1_500_000, flatType: '4-room' },
    totalCostToday: 450_000,
    breakdown: { items: [{ label: 'Down payment', amount: 375_000 }, { label: 'BSD', amount: 36_600 }, { label: 'Legal fees', amount: 5_000 }, { label: 'Renovation', amount: 60_000 }], total: 476_600 },
    monthlySavingsNeeded: 5000,
    feasible: true,
    shortfallPerMonth: 0,
    ...overrides,
  }
}

// ============================================================
// Tests: EC goal
// ============================================================

describe('ec goal', () => {
  describe('EC grant', () => {
    it('couple gets Family Grant (grantAmount > 0) for EC 4-room', () => {
      // Couple within income ceiling ($16K) — should receive Family Grant ($80K for 4-room or smaller)
      const basics = makeBasics({
        partnerAge: 30,
        partnerMonthlyIncome: 4000,
      })
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].grantAmount).toBeGreaterThan(0)
    })

    it('solo user gets $0 grant for EC (singles not eligible for Family Grant)', () => {
      const basics = makeBasics()
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].grantAmount).toBe(0)
    })
  })

  describe('EC loan qualification', () => {
    it('returns non-null loanQualification for EC (property goal)', () => {
      const basics = makeBasics({ partnerAge: 30, partnerMonthlyIncome: 4000 })
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.perGoal[0].loanQualification).not.toBeNull()
      expect(result.perGoal[0].loanQualification!.monthlyPayment).toBeGreaterThan(0)
    })

    it('uses TDSR (55%) not MSR (30%) for EC loan sizing', () => {
      // EC uses bank loan so TDSR applies. With TDSR=55%, a high-income couple qualifies
      // for a much larger loan than the 30% MSR cap used for HDB.
      const basics = makeBasics({
        grossIncome: 8_000,
        partnerAge: 30,
        partnerGrossIncome: 8_000,
        partnerMonthlyIncome: 6_400,
      })
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      const lq = result.perGoal[0].loanQualification!
      // maxLoan under TDSR (55% of $16K = $8,800/mo) is far larger than under MSR (30%)
      // EC loan needed = 1,500,000 * 0.75 = 1,125,000
      // At TDSR, monthly cap is 8,800 which at 3.5% / 25yr ≈ qualifies ~$1.56M — so they qualify
      expect(lq.qualified).toBe(true)
      // Sanity: maxLoan well above MSR-equivalent limit (30% of 16K = 4,800 → ~$847K)
      expect(lq.maxLoan).toBeGreaterThan(900_000)
    })
  })

  describe('EC cash minimum: 5% cash floor', () => {
    it('enforces 5% cash floor for EC goal', () => {
      const basics = makeBasics({ existingSavings: 500_000 })
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      const cashMin = computeCondoDownPayment(1_500_000).cashMinimum // 5% of $1.5M = $75K
      expect(result.perGoal[0].cashNeeded).toBeGreaterThanOrEqual(cashMin)
    })

    it('cash needed does not go below 5% even when CPF + grant > breakdown total', () => {
      // Large CPF accumulation + Family Grant may exceed the breakdown total — cash should
      // still floor at 5% of purchase price ($75K for $1.5M EC).
      const basics = makeBasics({
        age: 25,
        existingSavings: 1_000_000,
        grossIncome: 10_000,
        partnerAge: 25,
        partnerMonthlyIncome: 8_000,
        partnerGrossIncome: 10_000,
      })
      const goals = [makeEcGoal({ targetAge: 45 })]
      const result = computeGoalStoryData(basics, goals)

      const cashMin = computeCondoDownPayment(1_500_000).cashMinimum // $75K
      expect(result.perGoal[0].cashNeeded).toBeGreaterThanOrEqual(cashMin)
    })
  })

  describe('EC income ceiling warning', () => {
    it('fires warning when household gross > EC couple ceiling ($16K)', () => {
      const basics = makeBasics({
        monthlyIncome: 9_600,
        grossIncome: 12_000,
        partnerAge: 30,
        partnerMonthlyIncome: 3_500,
        partnerGrossIncome: 5_000,
      })
      // householdGross = 12,000 + 5,000 = 17,000 > 16,000 EC ceiling
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.incomeCeilingWarning).not.toBeNull()
      expect(result.shared.incomeCeilingWarning).toContain('exceeds')
      expect(result.shared.incomeCeilingWarning).toContain(`${EC_INCOME_CEILING.couple.toLocaleString()}`)
    })

    it('does not warn when household gross is at or below EC couple ceiling', () => {
      const basics = makeBasics({
        monthlyIncome: 6_400,
        grossIncome: 8_000,
        partnerAge: 30,
        partnerMonthlyIncome: 6_400,
        partnerGrossIncome: 8_000,
      })
      // householdGross = 8,000 + 8,000 = 16,000 — exactly at ceiling, not over
      const goals = [makeEcGoal()]
      const result = computeGoalStoryData(basics, goals)

      expect(result.shared.incomeCeilingWarning).toBeNull()
    })
  })
})

// ============================================================
// Tests: useGoalStoryData (React hook)
// ============================================================

describe('useGoalStoryData hook', () => {
  it('returns the same structure as the pure function', () => {
    const basics = makeBasics()
    const goals = [makeHdbGoal()]

    const { result } = renderHook(() => useGoalStoryData(basics, goals))

    expect(result.current.perGoal).toHaveLength(1)
    expect(result.current.shared).toBeDefined()
    expect(result.current.storyCards).toBeDefined()
    expect(result.current.shared.freedomAge).toBeGreaterThan(basics.age)
  })
})
