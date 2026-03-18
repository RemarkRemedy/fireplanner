import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { IlpReviewPage } from './IlpReviewPage'
import { createDefaultPolicy, useIlpStore } from '@/stores/useIlpStore'

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Container,
    LineChart: Container,
    BarChart: Container,
    Line: () => null,
    Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Cell: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    ReferenceDot: () => null,
  }
})

function renderIlpReviewPage() {
  return render(
    <MemoryRouter>
      <IlpReviewPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  act(() => {
    useIlpStore.getState().reset()
  })
})

describe('IlpReviewPage', () => {
  it('renders the default ILP analysis experience', () => {
    renderIlpReviewPage()

    expect(screen.getByText('ILP Review')).toBeInTheDocument()
    expect(screen.getByText('Policy Details')).toBeInTheDocument()
    expect(screen.getByText('Decision Panel')).toBeInTheDocument()
    expect(screen.getByText('Opportunity Cost')).toBeInTheDocument()
    expect(screen.getByText('Total Premiums Paid')).toBeInTheDocument()
  })

  it('adds a second policy and shows the comparison table', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /add policy/i }))

    expect(screen.getByText('Policy Comparison')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/rename new ilp policy/i)).toHaveLength(2)
  })

  it('renames the active policy from the input form and updates the policy tab', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    const nameInput = screen.getByLabelText('Policy Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'AIA Pro Achiever')

    expect(screen.getByText('AIA Pro Achiever')).toBeInTheDocument()
  })

  it('keeps analysis visible from another valid policy when the selected policy is invalid', () => {
    const validPolicy = createDefaultPolicy()
    validPolicy.id = 'valid-policy'
    validPolicy.name = 'Valid Policy'
    validPolicy.insurer = 'Insurer A'

    const invalidPolicy = createDefaultPolicy()
    invalidPolicy.id = 'invalid-policy'
    invalidPolicy.name = 'Broken Policy'
    invalidPolicy.insurer = 'Insurer B'
    invalidPolicy.currentPolicyYear = invalidPolicy.mipLength

    act(() => {
      useIlpStore.setState({
        policies: [validPolicy, invalidPolicy],
        selectedPolicyId: invalidPolicy.id,
      })
    })

    renderIlpReviewPage()

    expect(screen.getByText('1 policy excluded from comparison')).toBeInTheDocument()
    expect(screen.getByText('Policy needs attention before analysis updates')).toBeInTheDocument()
    expect(screen.getByText('Showing analysis for another valid policy')).toBeInTheDocument()
    expect(screen.getByText('Decision Panel')).toBeInTheDocument()
    expect(screen.getByText('Total Premiums Paid')).toBeInTheDocument()
    expect(screen.getByText('Valid Policy')).toBeInTheDocument()
  })
})
