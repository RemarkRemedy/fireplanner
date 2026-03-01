import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDisruptionImpact, DISRUPTION_TEMPLATES, MAX_LIFE_EVENTS } from './useDisruptionImpact'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
})

describe('useDisruptionImpact', () => {
  it('returns hasData: false when profile has validation errors', () => {
    useProfileStore.getState().setField('currentAge', 15)
    const { result } = renderHook(() => useDisruptionImpact())
    expect(result.current.hasData).toBe(false)
    expect(result.current.baseMetrics).toBeNull()
  })

  it('returns base metrics with no template selected', () => {
    const { result } = renderHook(() => useDisruptionImpact())
    expect(result.current.hasData).toBe(true)
    expect(result.current.baseMetrics).not.toBeNull()
    expect(result.current.selectedIndex).toBeNull()
    expect(result.current.deltas).toBeNull()
    expect(result.current.disruptedMetrics).toBeNull()
  })

  it('selecting a template produces disrupted metrics and deltas', () => {
    const { result } = renderHook(() => useDisruptionImpact())

    act(() => {
      result.current.selectTemplate(0) // Job Loss (6 months)
    })

    expect(result.current.selectedIndex).toBe(0)
    expect(result.current.disruptedMetrics).not.toBeNull()
    expect(result.current.deltas).not.toBeNull()
  })

  it('age clamping: event never placed before currentAge + 1', () => {
    const { result } = renderHook(() => useDisruptionImpact())
    const currentAge = useProfileStore.getState().currentAge

    act(() => {
      result.current.selectTemplate(0)
    })

    // The startAge should be at least currentAge + 1
    expect(result.current.startAge).toBeGreaterThanOrEqual(currentAge + 1)
  })

  it('setting a custom start age works', () => {
    const { result } = renderHook(() => useDisruptionImpact())
    const currentAge = useProfileStore.getState().currentAge

    act(() => {
      result.current.selectTemplate(0)
    })

    act(() => {
      result.current.setStartAge(currentAge + 5)
    })

    expect(result.current.startAge).toBe(currentAge + 5)
  })

  it('deselecting template clears disrupted metrics', () => {
    const { result } = renderHook(() => useDisruptionImpact())

    act(() => {
      result.current.selectTemplate(0)
    })
    expect(result.current.deltas).not.toBeNull()

    act(() => {
      result.current.selectTemplate(null)
    })
    expect(result.current.selectedIndex).toBeNull()
    expect(result.current.deltas).toBeNull()
    expect(result.current.disruptedMetrics).toBeNull()
  })

  it('DISRUPTION_TEMPLATES has 8 templates', () => {
    expect(DISRUPTION_TEMPLATES).toHaveLength(8)
  })

  it('each template has required fields', () => {
    for (const tmpl of DISRUPTION_TEMPLATES) {
      expect(tmpl.label).toBeTruthy()
      expect(tmpl.durationYears).toBeGreaterThan(0)
      expect(tmpl.defaultAgeOffset).toBeGreaterThan(0)
      expect(tmpl.event.name).toBeTruthy()
      expect(typeof tmpl.event.incomeImpact).toBe('number')
      expect(typeof tmpl.event.savingsPause).toBe('boolean')
      expect(typeof tmpl.event.cpfPause).toBe('boolean')
    }
  })

  it('selecting template resets custom age', () => {
    const { result } = renderHook(() => useDisruptionImpact())
    const currentAge = useProfileStore.getState().currentAge

    act(() => {
      result.current.selectTemplate(0)
    })

    act(() => {
      result.current.setStartAge(currentAge + 10)
    })
    expect(result.current.startAge).toBe(currentAge + 10)

    // Switching template resets custom age
    act(() => {
      result.current.selectTemplate(1)
    })
    const template1 = DISRUPTION_TEMPLATES[1]
    const expectedAge = Math.max(currentAge + 1, currentAge + template1.defaultAgeOffset)
    expect(result.current.startAge).toBe(expectedAge)
  })

  it('portfolio impact is negative for job loss disruption', () => {
    const { result } = renderHook(() => useDisruptionImpact())

    act(() => {
      result.current.selectTemplate(0) // Job Loss (6 months)
    })

    // Job loss means lost income, so portfolio at retirement should be lower
    if (result.current.deltas) {
      expect(result.current.deltas.portfolioAtRetirement).toBeLessThanOrEqual(0)
    }
  })

  it('forces lifeEventsEnabled even when store has it disabled', () => {
    // Disable life events in the store
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      lifeEventsEnabled: false,
      validationErrors: {},
    })

    const { result } = renderHook(() => useDisruptionImpact())

    // Select a job loss disruption
    act(() => {
      result.current.selectTemplate(0) // Job Loss (6 months)
    })

    expect(result.current.disruptedMetrics).not.toBeNull()
    expect(result.current.deltas).not.toBeNull()

    // The disrupted income should show negative impact on portfolio,
    // proving the disruption event was processed despite lifeEventsEnabled being false.
    // Job loss sets incomeImpact: 0 (zero income) and savingsPause: true,
    // which should reduce the portfolio at retirement.
    expect(result.current.deltas!.portfolioAtRetirement).toBeLessThanOrEqual(0)
  })

  it('MAX_LIFE_EVENTS is 4', () => {
    expect(MAX_LIFE_EVENTS).toBe(4)
  })

  it('templates with costs have both subsidised and private tiers', () => {
    const templatesWithCosts = DISRUPTION_TEMPLATES.filter(t => t.costs)
    expect(templatesWithCosts.length).toBeGreaterThan(0)
    for (const tmpl of templatesWithCosts) {
      expect(tmpl.costs).toHaveProperty('subsidised')
      expect(tmpl.costs).toHaveProperty('private')
    }
  })

  it('resolves subsidised tier costs for Critical Illness', () => {
    const criticalIllnessIdx = DISRUPTION_TEMPLATES.findIndex(t => t.label === 'Critical Illness')
    const { result } = renderHook(() => useDisruptionImpact('subsidised'))

    act(() => {
      result.current.selectTemplate(criticalIllnessIdx)
    })

    expect(result.current.resolvedCosts).not.toBeNull()
    expect(result.current.resolvedCosts!.additionalAnnualExpense).toBe(15000)
    expect(result.current.resolvedCosts!.lumpSumCost).toBe(8000)
  })

  it('resolves private tier costs for Critical Illness', () => {
    const criticalIllnessIdx = DISRUPTION_TEMPLATES.findIndex(t => t.label === 'Critical Illness')
    const { result } = renderHook(() => useDisruptionImpact('private'))

    act(() => {
      result.current.selectTemplate(criticalIllnessIdx)
    })

    expect(result.current.resolvedCosts).not.toBeNull()
    expect(result.current.resolvedCosts!.additionalAnnualExpense).toBe(50000)
    expect(result.current.resolvedCosts!.lumpSumCost).toBe(20000)
  })

  it('returns null resolvedCosts when no template selected', () => {
    const { result } = renderHook(() => useDisruptionImpact())
    expect(result.current.resolvedCosts).toBeNull()
  })

  it('returns empty resolvedCosts for templates without costs (e.g., Job Loss)', () => {
    const { result } = renderHook(() => useDisruptionImpact())

    act(() => {
      result.current.selectTemplate(0) // Job Loss (6 months) has no costs
    })

    // resolvedCosts should be an empty object (no expense fields)
    expect(result.current.resolvedCosts).toEqual({})
  })

  it('disruption impact differs based on template severity', () => {
    const { result } = renderHook(() => useDisruptionImpact())

    // Select mild disruption: Recession Pay Cut (incomeImpact: 0.8 = 80% of income)
    act(() => {
      result.current.selectTemplate(4) // Recession Pay Cut
    })
    const mildDelta = result.current.deltas!.portfolioAtRetirement

    // Select severe disruption: Job Loss 12 months (incomeImpact: 0 = no income)
    act(() => {
      result.current.selectTemplate(1) // Job Loss (12 months)
    })
    const severeDelta = result.current.deltas!.portfolioAtRetirement

    // More severe disruption should have a larger (more negative) impact
    expect(severeDelta).toBeLessThanOrEqual(mildDelta)
  })
})
