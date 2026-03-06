import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useExpenseTrackerSignup } from './useExpenseTrackerSignup'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('useExpenseTrackerSignup', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('initializes with idle status when not signed up', () => {
    const { result } = renderHook(() => useExpenseTrackerSignup(), { wrapper })
    expect(result.current.status).toBe('idle')
    expect(result.current.isSignedUp).toBe(false)
  })

  it('initializes with success status when signed up flag exists', () => {
    localStorage.setItem('fireplanner-expense-tracker-signed-up', '1')
    const { result } = renderHook(() => useExpenseTrackerSignup(), { wrapper })
    expect(result.current.status).toBe('success')
    expect(result.current.isSignedUp).toBe(true)
  })

  it('rejects empty email on submit', async () => {
    const { result } = renderHook(() => useExpenseTrackerSignup(), { wrapper })
    await act(async () => {
      await result.current.submit('card', '/projection')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('email')
  })

  it('rejects missing expense tracking status', async () => {
    const { result } = renderHook(() => useExpenseTrackerSignup(), { wrapper })
    act(() => { result.current.setEmail('test@example.com') })
    await act(async () => {
      await result.current.submit('card', '/projection')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('expense tracking')
  })

  it('rejects missing primary device', async () => {
    const { result } = renderHook(() => useExpenseTrackerSignup(), { wrapper })
    act(() => {
      result.current.setEmail('test@example.com')
      result.current.setExpenseTrackingStatus('consistent')
    })
    await act(async () => {
      await result.current.submit('card', '/projection')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('device')
  })

  it('markTouched sets formTouched ref', () => {
    const { result } = renderHook(() => useExpenseTrackerSignup(), { wrapper })
    expect(result.current.formTouched.current).toBe(false)
    act(() => { result.current.markTouched('card', '/projection') })
    expect(result.current.formTouched.current).toBe(true)
  })
})
