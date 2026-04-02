import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { IlpLandingPage } from './IlpLandingPage'
import { IlpStoryModePage } from './IlpStoryModePage'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

describe('ILP guided entry flow', () => {
  it('routes the understand-product card into story mode with explore intent', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<IlpLandingPage />} />
          <Route path="/ilp-fees/story/:productId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /understand one ilp/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /^USD \/ MIP 15Use template$/i }))

    expect(screen.getByTestId('location')).toHaveTextContent('/ilp-fees/story/hsbc-life-wealth-voyage?variantId=usd-mip-15&intent=explore')
  })

  it('routes the current-policy card into story mode with review intent', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<IlpLandingPage />} />
          <Route path="/ilp-fees/story/:productId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /review my current ilp/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /^USD \/ MIP 15Use template$/i }))

    expect(screen.getByTestId('location')).toHaveTextContent('/ilp-fees/story/hsbc-life-wealth-voyage?variantId=usd-mip-15&intent=review')
  })

  it('defaults the selected-product shell to current-policy review when the review intent is set', () => {
    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay?variantId=sgd-mip-5&intent=review']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: /review my current ilp/i })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText(/review what you already own/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review my current policy/i })).toHaveAttribute(
      'href',
      '/ilp-fees/exit?productId=aia-elite-secure-income-5-pay&variantId=sgd-mip-5',
    )
  })
})
