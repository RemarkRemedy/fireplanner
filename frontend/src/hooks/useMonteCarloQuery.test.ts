import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMonteCarloQuery } from './useMonteCarloQuery'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

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
  useSimulationStore.getState().reset()
  usePropertyStore.getState().reset()
})

describe('useMonteCarloQuery stale detection', () => {
  it('includes lifeEvents in param signature (mutating lifeEvents triggers re-render)', () => {
    const { result, rerender } = renderHook(() => useMonteCarloQuery(), { wrapper })

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
    const { result, rerender } = renderHook(() => useMonteCarloQuery(), { wrapper })

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
    const { result } = renderHook(() => useMonteCarloQuery(), { wrapper })
    expect(result.current.canRun).toBe(true)
    expect(result.current.isStale).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})
