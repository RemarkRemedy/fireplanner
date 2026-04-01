import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { useUIStore } from '@/stores/useUIStore'

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/lib/undo', () => ({
  tryUndo: vi.fn(() => false),
}))

vi.mock('@/lib/companion/isCompanionMode', () => ({
  isCompanionMode: () => false,
}))

vi.mock('./Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}))

vi.mock('./FireStatsStrip', () => ({
  FireStatsStrip: ({ position }: { position: string }) => <div data-testid={`stats-${position}`} />,
}))

vi.mock('./SaveIndicator', () => ({
  SaveIndicator: () => <div data-testid="save-indicator" />,
}))

vi.mock('./HelpPanel', () => ({
  HelpPanel: () => <div data-testid="help-panel">Help panel</div>,
}))

vi.mock('@/components/shared/PlanUrlHandler', () => ({
  PlanUrlHandler: () => null,
}))

vi.mock('@/components/shared/BetaBanner', () => ({
  BetaBanner: () => <div data-testid="beta-banner" />,
}))

vi.mock('@/components/shared/DataUpdateBanner', () => ({
  DataUpdateBanner: () => null,
}))

vi.mock('@/components/shared/MobileShareFab', () => ({
  MobileShareFab: () => null,
}))

vi.mock('@/components/email/ExpenseTrackerProvider', () => ({
  ExpenseTrackerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/email/ExpenseTrackerBanner', () => ({
  ExpenseTrackerBanner: () => <div data-testid="expense-tracker-banner" />,
}))

vi.mock('@/components/email/ExpenseTrackerModal', () => ({
  ExpenseTrackerModal: () => null,
}))

vi.mock('@/hooks/useExpenseTracker', () => ({
  useExpenseTracker: () => ({
    isEligible: false,
    openModal: vi.fn(),
    trackImpression: vi.fn(),
  }),
}))

vi.mock('@/hooks/useExitIntent', () => ({
  useExitIntent: () => undefined,
}))

function renderLayout(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/ilp-fees" element={<div>ILP Fees</div>} />
          <Route path="/ilp-ocf" element={<div>ILP OCF</div>} />
          <Route path="/ilp-returns" element={<div>ILP Returns</div>} />
          <Route path="/compare" element={<div>Compare</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
  useUIStore.setState({
    helpPanelOpen: true,
    statsPosition: 'bottom',
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: '(min-width: 768px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('AppLayout help panel behavior', () => {
  it('closes the persisted help panel when entering ILP fee routes', async () => {
    renderLayout('/ilp-fees')

    await waitFor(() => {
      expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument()
    })

    expect(useUIStore.getState().helpPanelOpen).toBe(false)
  })

  it('closes the persisted help panel when entering ILP OCF routes', async () => {
    renderLayout('/ilp-ocf')

    await waitFor(() => {
      expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument()
    })

    expect(useUIStore.getState().helpPanelOpen).toBe(false)
  })

  it('closes the persisted help panel when entering ILP returns routes', async () => {
    renderLayout('/ilp-returns')

    await waitFor(() => {
      expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument()
    })

    expect(useUIStore.getState().helpPanelOpen).toBe(false)
  })

  it('keeps the help panel visible on non-ILP routes', () => {
    renderLayout('/dashboard')

    expect(screen.getByTestId('help-panel')).toBeInTheDocument()
    expect(useUIStore.getState().helpPanelOpen).toBe(true)
  })

  it('keeps the help panel visible on /compare because it is not part of the ILP route family', () => {
    renderLayout('/compare')

    expect(screen.getByTestId('help-panel')).toBeInTheDocument()
    expect(useUIStore.getState().helpPanelOpen).toBe(true)
  })
})
