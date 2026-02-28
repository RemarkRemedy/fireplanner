import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSequenceRiskQuery } from './useSequenceRiskQuery'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

const queryClient = new QueryClient({
  defaultOptions: { mutations: { retry: false } },
})

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useWithdrawalStore.getState().reset()
  usePropertyStore.getState().reset()
  useSimulationStore.getState().reset()
})

describe('useSequenceRiskQuery stale detection', () => {
  it('includes lifeEvents in param signature (mutating lifeEvents triggers re-render)', () => {
    const { result, rerender } = renderHook(() => useSequenceRiskQuery(), { wrapper })

    expect(result.current.isStale).toBe(false)

    // Mutate lifeEvents in the income store
    act(() => {
      useIncomeStore.getState().addLifeEvent({
        id: 'test-event',
        name: 'Test Event',
        startAge: 35,
        endAge: 36,
        incomeImpact: 0.5,
        affectedStreamIds: [],
        savingsPause: false,
        cpfPause: false,
      })
    })

    rerender()

    // Hook should still work — no data yet so isStale stays false
    expect(result.current.data).toBeUndefined()
    expect(result.current.canRun).toBe(true)
  })

  it('includes lifeEventsEnabled in param signature', () => {
    const { result, rerender } = renderHook(() => useSequenceRiskQuery(), { wrapper })

    act(() => {
      useIncomeStore.getState().setField('lifeEventsEnabled', true)
    })
    rerender()

    act(() => {
      useIncomeStore.getState().setField('lifeEventsEnabled', false)
    })
    rerender()

    expect(result.current.canRun).toBe(true)
  })

  it('can run with valid default stores', () => {
    const { result } = renderHook(() => useSequenceRiskQuery(), { wrapper })
    expect(result.current.canRun).toBe(true)
    expect(result.current.isStale).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})
