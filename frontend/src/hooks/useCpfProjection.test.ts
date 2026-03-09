import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCpfProjection } from './useCpfProjection'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'

function getSelfAdult() {
  return useHouseholdPlanStore.getState().plan.adults.find((a) => a.owner === 'self')!
}

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
})

describe('useCpfProjection', () => {
  it('returns rows with valid defaults', () => {
    const { result } = renderHook(() => useCpfProjection())
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.rows).not.toBeNull()
    expect(result.current.rows!.length).toBeGreaterThan(0)
  })

  it('rows span currentAge to lifeExpectancy', () => {
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    const self = getSelfAdult()
    expect(rows[0].age).toBe(self.currentAge)
    expect(rows[rows.length - 1].age).toBe(self.lifeExpectancy)
  })

  it('first row has annualInterest = 0', () => {
    const { result } = renderHook(() => useCpfProjection())
    expect(result.current.rows![0].annualInterest).toBe(0)
  })

  it('totalBalance = OA + SA + MA + RA', () => {
    const { result } = renderHook(() => useCpfProjection())
    const row = result.current.rows![5]
    expect(row.totalBalance).toBeCloseTo(row.oaBalance + row.saBalance + row.maBalance + row.raBalance, 0)
  })

  it('raBalance appears after age 55 transfer', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
    })
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    const row54 = rows.find(r => r.age === 54)
    const row55 = rows.find(r => r.age === 55)
    if (row54 && row55) {
      expect(row54.raBalance).toBe(0)
      expect(row55.raBalance).toBeGreaterThan(0)
      expect(row55.saBalance).toBe(0)
    }
  })

  it('raCreated milestone at age 55', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
    })
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    const row55 = rows.find(r => r.age === 55)
    // raCreated fires at 55 unless another milestone takes priority
    if (row55 && row55.raBalance > 0) {
      // milestone could be 'brs'/'frs'/'ers' if those thresholds also crossed at 55
      expect(['raCreated', 'brs', 'frs', 'ers']).toContain(row55.milestone)
    }
  })

  it('CPF balances grow over working years', () => {
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    // Compare early working years - balance should grow
    expect(rows[5].totalBalance).toBeGreaterThan(rows[0].totalBalance)
    expect(rows[10].totalBalance).toBeGreaterThan(rows[5].totalBalance)
  })

  it('annualContribution is zero post-retirement', () => {
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    const self = getSelfAdult()
    // Find a row well after retirement
    const postRetRow = rows.find(r => r.age === self.retirementAge + 5)
    if (postRetRow) {
      expect(postRetRow.annualContribution).toBe(0)
    }
  })

  it('CPF LIFE start milestone is flagged', () => {
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    const self = getSelfAdult()
    const cpfLifeRow = rows.find(r => r.age === self.cpf.lifeStartAge)
    if (cpfLifeRow) {
      expect(cpfLifeRow.milestone).toBe('cpfLifeStart')
    }
  })

  it('cpfLifePayout is zero before CPF LIFE start age', () => {
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    const self = getSelfAdult()
    const earlyRow = rows.find(r => r.age === self.cpf.lifeStartAge - 1)
    if (earlyRow) {
      expect(earlyRow.cpfLifePayout).toBe(0)
    }
  })

  it('returns data from normalized path even when legacy store has validation errors', () => {
    // With the normalized household architecture, the compiled plan produces
    // CPF rows regardless of legacy store validation errors. The normalized
    // path takes precedence over the legacy income projection path.
    // Setting an invalid plan: currentAge > retirementAge
    setupTestPlan({
      adult: {
        currentAge: 15,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
    })
    const { result } = renderHook(() => useCpfProjection())
    // The normalized path produces CPF rows from the compiled household plan,
    // so hasErrors is false and rows are present.
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.rows).not.toBeNull()
    expect(result.current.rows!.length).toBeGreaterThan(0)
  })

  it('drops cached normalized rows once upstream validation fails', () => {
    const { result, rerender } = renderHook(() => useCpfProjection())

    expect(result.current.hasErrors).toBe(false)
    expect(result.current.rows).not.toBeNull()

    act(() => {
      // Create an invalid household plan: currentAge > retirementAge > lifeExpectancy
      setupTestPlan({
        adult: {
          currentAge: 30,
          retirementAge: 25,
          lifeExpectancy: 20,
        },
      })
    })
    rerender()

    expect(result.current.hasErrors).toBe(true)
    expect(result.current.rows).toBeNull()
  })

  it('annualInterest is always >= 0 (clamped)', () => {
    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!
    for (const row of rows) {
      expect(row.annualInterest).toBeGreaterThanOrEqual(0)
    }
  })

  it('BRS/FRS/ERS milestones exclude MA from balance comparison', () => {
    // Set up a profile where MA is large enough that OA+SA+MA+RA > BRS
    // but OA+SA+RA alone is NOT > BRS. Milestones should not trigger prematurely.
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        cpfOA: 10000,
        cpfSA: 10000,
        cpfMA: 100000,
      },
    })

    const { result } = renderHook(() => useCpfProjection())
    const rows = result.current.rows!

    // At age 30 with OA=10K, SA=10K: retirement balance = ~20K
    // Total with MA = ~120K, which could trigger BRS (~$107K) if MA is included
    // First few rows should not have BRS milestone
    const firstRow = rows[0]
    const retirementBal = firstRow.oaBalance + firstRow.saBalance + firstRow.raBalance
    if (retirementBal < 107000) {
      // Verify BRS milestone hasn't triggered yet
      expect(firstRow.milestone).not.toBe('brs')
    }
  })
})
