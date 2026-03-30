import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeeDashboardLayout } from './FeeDashboardLayout'

describe('FeeDashboardLayout', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
  })

  it('renders fee-route chrome without the planner sidebar or expense tracker CTA', () => {
    render(
      <MemoryRouter initialEntries={['/ilp-fees/compare']}>
        <Routes>
          <Route element={<FeeDashboardLayout />}>
            <Route path="/ilp-fees" element={<div>Overview screen</div>} />
            <Route path="/ilp-fees/compare" element={<div>Compare screen</div>} />
            <Route path="/ilp-review" element={<div>Review screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('ILP Fee Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /compare/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Compare screen')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to fire planner/i })).toHaveAttribute('href', '/')
    expect(screen.queryByText('Plan Setup')).not.toBeInTheDocument()
    expect(screen.queryByText(/want a companion expense tracker/i)).not.toBeInTheDocument()
  })
})
