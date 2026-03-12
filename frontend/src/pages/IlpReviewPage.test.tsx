import { act, render, screen, within } from '@testing-library/react'
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
    expect(screen.getByText('Support boundary')).toBeInTheDocument()
  }, 10_000)

  it('adds a second policy and shows the comparison table', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /add policy/i }))

    expect(screen.getByText('Policy Comparison')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/rename new ilp policy/i)).toHaveLength(2)
  })

  it('seeds a policy from the catalog picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Accelerate')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i }))

    expect(screen.getAllByText('Wealth Accelerate (SGD / MIP 25)').length).toBeGreaterThan(0)
    expect(screen.getByText('Seeded from catalog template')).toBeInTheDocument()
    expect(screen.getByText('Supported template')).toBeInTheDocument()
    expect(screen.getByText(/metadata-only behaviors still outside the calculator: premium holiday delayed or partial repayment/i)).toBeInTheDocument()
  })

  it('seeds a partial catalog product with explicit warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prosper')

    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i }))

    expect(screen.getAllByText('PRUVantage Prosper (SGD / MIP 25)').length).toBeGreaterThan(0)
    expect(screen.getByText('Seeded from catalog template')).toBeInTheDocument()
    expect(screen.getByText('Partial template')).toBeInTheDocument()
    expect(screen.getByText(/assurance charges are still outside the current ilp engine/i)).toBeInTheDocument()
    expect(screen.getByText(/metadata-only behaviors still outside the calculator: assurance charge, insured life dependent fees/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Manual Assurance Charge Placeholder')).toBeInTheDocument()
    expect(screen.getByText(/manual assurance charge placeholder is still zero/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded policy to be selected')

      state.updatePolicy(policy.id, {
        chargeRules: (policy.chargeRules ?? []).map((rule) => (
          rule.id === 'manual-assurance-charge'
            ? { ...rule, amount: 240 }
            : rule
        )),
      })
    })

    expect(screen.queryByText(/manual assurance charge placeholder is still zero/i)).not.toBeInTheDocument()
  }, 10_000)

  it('shows PRUVantage Assure II as a partial catalog product that can be seeded', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure II')

    expect(within(dialog).getByText('PRUVantage Assure II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i })).toBeEnabled()
  }, 10_000)

  it('renames the active policy from the input form and updates the policy tab', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    const nameInput = screen.getByLabelText('Policy Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'AIA Pro Achiever')

    expect(screen.getByText('AIA Pro Achiever')).toBeInTheDocument()
  }, 10_000)

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
