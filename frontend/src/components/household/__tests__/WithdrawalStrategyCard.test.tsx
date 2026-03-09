import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WithdrawalStrategyCard } from '../WithdrawalStrategyCard'
import { useSimulationStore } from '@/stores/useSimulationStore'

function renderCard() {
  return render(
    <MemoryRouter>
      <WithdrawalStrategyCard />
    </MemoryRouter>,
  )
}

describe('WithdrawalStrategyCard', () => {
  beforeEach(() => {
    useSimulationStore.setState({ selectedStrategy: 'constant_dollar' })
  })

  it('renders the strategy label', () => {
    renderCard()
    expect(screen.getByText('Withdrawal Strategy')).toBeInTheDocument()
  })

  it('shows compare link to /withdrawal', () => {
    renderCard()
    const link = screen.getByText('Compare all strategies')
    expect(link.closest('a')).toHaveAttribute('href', '/withdrawal')
  })

  it('shows the current strategy in the trigger', () => {
    renderCard()
    expect(screen.getByRole('combobox')).toHaveTextContent('Constant Dollar (4% Rule)')
  })

  it('setField updates selectedStrategy in store', () => {
    // Radix Select renders options in a portal that jsdom cannot interact with,
    // so we verify the store setter directly rather than simulating user clicks.
    useSimulationStore.getState().setField('selectedStrategy', 'vpw')
    expect(useSimulationStore.getState().selectedStrategy).toBe('vpw')
  })

  it('reflects store change in the trigger', () => {
    useSimulationStore.setState({ selectedStrategy: 'guardrails' })
    renderCard()
    expect(screen.getByRole('combobox')).toHaveTextContent('Guardrails (Guyton-Klinger)')
  })
})
