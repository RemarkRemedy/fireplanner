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
    expect(screen.getByText('Available Templates')).toBeInTheDocument()
    expect(screen.getByText('Supported templates')).toBeInTheDocument()
    expect(screen.getByText('Partial templates')).toBeInTheDocument()
    expect(screen.getByText('Wealth Accelerate')).toBeInTheDocument()
    expect(screen.getByText('PRUVantage Wealth II')).toBeInTheDocument()
    expect(screen.getByText('Wealth Abundance')).toBeInTheDocument()
    expect(screen.getByText('Wealth Pro (II)')).toBeInTheDocument()
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

  it('seeds HSBC Wealth Harvest as a supported catalog product with explicit reinvestment-default boundaries', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Harvest')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 11/i }))

    expect(screen.getAllByText('Wealth Harvest (SGD / MIP 11)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('hsbc harvest regular withdrawal facility')
    expect(seededAlert?.textContent).toContain('reinvest by default')
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Start-up Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds HSBC Wealth Abundance as a supported catalog product with free-withdrawal and tiered-BRC mechanics', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Abundance')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Wealth Abundance (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('hsbc abundance dividend distribution option')
    expect(seededAlert?.textContent).toContain('reinvest by default')
    expect(screen.getAllByDisplayValue('Account Maintenance Fee')).toHaveLength(2)
    expect(screen.getByDisplayValue('Bonus Recovery Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds HSBC Wealth Voyage as a partial catalog product with premium-base AMF and split startup recovery rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i }))

    expect(screen.getAllByText('Wealth Voyage (SGD / MIP 20)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('hsbc voyage premium holiday charge after free duration')
    expect(screen.getAllByDisplayValue('Account Maintenance Fee')).toHaveLength(2)
    expect(screen.getByDisplayValue('Bonus Recovery Charge (Policy Year 1 Start-up Bonus)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bonus Recovery Charge (Policy Year 2 Start-up Bonus)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
  }, 10_000)

  it('seeds a supported catalog product with explicit metadata-only warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prosper')

    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i }))

    expect(screen.getAllByText('PRUVantage Prosper (SGD / MIP 25)').length).toBeGreaterThan(0)
    expect(screen.getByText('Seeded from catalog template')).toBeInTheDocument()
    expect(screen.getByText('Supported template')).toBeInTheDocument()
    expect(screen.getByText(/prudential prosper assurance charges after you enter the insured-life details and current net regular premium base/i)).toBeInTheDocument()
    expect(screen.getByText(/metadata-only behaviors still outside the calculator: growth account distribution election, premium pass wealth share secondary life options/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Assurance Charge (Death)')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
        },
      })
    })

    expect(screen.queryByText(/assurance-charge modeling still needs life-assured inputs/i)).not.toBeInTheDocument()
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

  it('shows PRUVantage Assure (SP) as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure (SP)')

    expect(within(dialog).getByText('PRUVantage Assure (SP)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 8/i })).toBeEnabled()
  }, 10_000)

  it('shows Etiqa Invest starter as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest starter')

    expect(within(dialog).getByText('Invest starter')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 5/i })).toBeEnabled()
  }, 10_000)

  it('seeds Tokio Marine Wealth Max (II) as a partial catalog product with recurring-premium warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Max')

    expect(within(dialog).getByText('Wealth Max (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15/i }))

    expect(screen.getAllByText('Wealth Max (II) (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).not.toContain('tokio post mip regular premium routing back to initial account')
    expect(seededAlert?.textContent).toContain('Recurring single premium stays blocked after a premium-holiday event until you enter an explicit recurring-single-premium-resumption event')
    expect(screen.getByDisplayValue('Recurring Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Non-payment)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Wealth Pro (II) as a partial catalog product with waiver and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Tokio')

    expect(within(dialog).getByText('Wealth Pro (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Wealth Pro (II) (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).not.toContain('tokio involuntary unemployment and hospitalisation waiver')
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Regular Premium Reduction)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add event$/i }))
    expect(screen.getByText('Insurer-approved charge waiver applies')).toBeInTheDocument()
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
