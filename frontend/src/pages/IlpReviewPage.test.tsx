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
    expect(screen.getByText(/metadata-only behaviors still outside the calculator: premium pass wealth share secondary life options/i)).toBeInTheDocument()
    expect(screen.getByText(/growth account dividend payout is only allowed after 10 years/i)).toBeInTheDocument()
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

  it('shows Invest smart flex II as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'smart flex II')

    expect(within(dialog).getByText('Invest smart flex II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest flex wealth II as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'flex wealth II')

    expect(within(dialog).getByText('Invest flex wealth II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest Wealth Purpose as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Purpose')

    expect(within(dialog).getByText('Invest Wealth Purpose')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest Flex Vantage as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')

    expect(within(dialog).getByText('Invest Flex Vantage')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest Flex TriVantage as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')

    expect(within(dialog).getByText('Invest Flex TriVantage')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest Flex as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex')

    const title = within(dialog).getByText(/^Invest Flex$/)
    expect(title).toBeInTheDocument()
    const card = title.closest('.space-y-4')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest vista as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'vista')

    const title = within(dialog).getByText(/^Invest vista$/)
    expect(title).toBeInTheDocument()
    const card = title.closest('.space-y-4')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 10 \(flexi 3\)/i })).toBeEnabled()
    expect(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 10 \(flexi 5\)/i })).toBeEnabled()
    expect(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 20/i })).toBeEnabled()
  }, 10_000)

  it('shows Goal Builder II as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')

    expect(within(dialog).getByText('Goal Builder II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Wealth Focus (Flexi 3) as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')

    expect(within(dialog).getByText('Wealth Focus (Flexi 3)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /usd \/ mip 10/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest flex prime II with distinct Flexi term variants in the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex prime II')

    expect(within(dialog).getByText('Invest flex prime II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(flexi 3\)/i })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(flexi 5\)/i })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i })).toBeEnabled()
  }, 10_000)

  it('shows Invest flex pro as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex pro')

    expect(within(dialog).getByText('Invest flex pro')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(flexi 3\)/i })).toBeEnabled()
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
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Pro')

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

  it('seeds Tokio Marine Wealth Flexi as a partial catalog product with split performance-bonus entries', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi')

    const wealthFlexiCard = within(dialog).getByText('Wealth Flexi').closest('.rounded-lg') as HTMLElement | null
    expect(wealthFlexiCard).not.toBeNull()
    await user.click(within(wealthFlexiCard!).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Wealth Flexi (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Recurring single premium stays blocked after a premium-holiday event')
    expect(screen.getByDisplayValue('Performance Investment Bonus (Policy Years 4-6)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus (Policy Years 7-10)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Non-payment)')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Wealth Flexi-Link 5.10 as a partial catalog product with accumulation-account policy charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi-Link 5.10')

    expect(within(dialog).getByText('Wealth Flexi-Link 5.10')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Wealth Flexi-Link 5.10 (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('paid-up and no-withdrawal eligibility gates')
    expect(screen.getByDisplayValue('Policy Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus (Policy Year 10)')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Wealth Flexi-Link 3.12 as a partial catalog product with split policy-charge windows and loyalty bonus', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi-Link 3.12')

    expect(within(dialog).getByText('Wealth Flexi-Link 3.12')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 12/i }))

    expect(screen.getAllByText('Wealth Flexi-Link 3.12 (SGD / MIP 12)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('2.45% policy charge during the minimum investment period and a 0.60% policy charge thereafter')
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Premium Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus (Policy Year 12)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Wealth Builder@Future as a partial catalog product with split premium-bonus windows', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Builder@Future')

    expect(within(dialog).getByText('Wealth Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Wealth Builder@Future (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('2.50% policy charge during the minimum investment period and a 0.60% policy charge thereafter')
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Premium Bonus (Policy Years 6-20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Bonus (After Policy Year 20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Harvest Builder@Future as a partial catalog product with the same charge frame and lower initial bonus bands', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Builder@Future')

    expect(within(dialog).getByText('Harvest Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Harvest Builder@Future (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('2.50% policy charge during the minimum investment period and a 0.60% policy charge thereafter')
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Premium Bonus (Policy Years 6-20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine #goLuxe as a partial catalog product with modeled account fees and premium-holiday shortfall rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goLuxe')

    expect(within(dialog).getByText('#goLuxe')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15/i }))

    expect(screen.getAllByText('#goLuxe (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('SGD / minimum-contribution-period-15 corridor only')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Premium Holiday)')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine #goAffluence as a partial catalog product with modeled initial and policy charge rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAffluence')

    expect(within(dialog).getByText('#goAffluence')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15/i }))

    expect(screen.getAllByText('#goAffluence (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('SGD / premium-payment-term-15 corridor only')
    expect(screen.getByDisplayValue('Initial Charge')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Policy Charge')).toHaveLength(2)
  }, 10_000)

  it('seeds Tokio Marine Affluence@Future as a partial catalog product with capped initial and deferred policy charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Affluence@Future')

    expect(within(dialog).getByText('Affluence@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15/i }))

    expect(screen.getAllByText('Affluence@Future (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('SGD / premium-payment-term-15 corridor only')
    expect(screen.getByDisplayValue('Initial Charge')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine #goClassic as a partial catalog product with combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic')

    const goClassicCard = within(dialog).getByText('#goClassic').closest('.rounded-lg') as HTMLElement | null
    expect(goClassicCard).not.toBeNull()
    await user.click(within(goClassicCard!).getByRole('button', { name: /sgd \/ mip 25/i }))

    expect(screen.getAllByText('#goClassic (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('one honest SGD / premium-payment-term-25 corridor')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine #goClassic Secure as a partial catalog product with combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic Secure')

    expect(within(dialog).getByText('#goClassic Secure')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i }))

    expect(screen.getAllByText('#goClassic Secure (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('one honest SGD / premium-payment-term-25 corridor')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds HSBC Life Flexi Protector as a partial catalog product with premium charges and a fixed admin fee', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Flexi Protector')

    expect(within(dialog).getByText('HSBC Life Flexi Protector')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd/i }))

    expect(screen.getAllByText(/HSBC Life Flexi Protector \(SGD \/ Open-ended \(Regular Pay\)\)/).length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('102% regular-premium allocation uplift')
    expect(screen.getByDisplayValue('Administration Fee')).toBeInTheDocument()
  }, 10_000)

  it('seeds Singlife Legacy Invest as a partial catalog product with welcome, loyalty, and shortfall charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Legacy Invest')

    expect(within(dialog).getByText('Singlife Legacy Invest')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(term 15\)/i }))

    expect(screen.getAllByText('Singlife Legacy Invest (SGD / MIP 10 (Term 15))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('policy-term-15-years corridor only')
    expect(screen.getByDisplayValue('Administrative Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Welcome Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge')).toBeInTheDocument()
  }, 10_000)

  it('seeds Singlife Savvy Invest II as a partial catalog product with fixed-10 allocation uplift and loyalty windows', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Savvy Invest II')

    expect(within(dialog).getByText('Singlife Savvy Invest II')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(fixed\)/i }))

    expect(screen.getAllByText('Singlife Savvy Invest II (SGD / MIP 10 (Fixed))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('10 years (Fixed) corridor only')
    expect(screen.getByDisplayValue('Administrative Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Supplementary Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Regular Premium Allocation Uplift (Policy Years 11-20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus (Payments 1-10)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge')).toBeInTheDocument()
  }, 10_000)

  it('seeds FWD Invest First Max as a partial catalog product with executable initial and accumulation account charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest First Max')

    expect(within(dialog).getByText('FWD Invest First Max')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('FWD Invest First Max (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('SGD 10-year base-layer corridor')
    expect(screen.getByDisplayValue('Initial Account Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Accumulation Account Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Recurring Single Premium Charge')).toBeInTheDocument()
  }, 10_000)

  it('seeds FWD Invest First Summit as a partial catalog product with shortfall and reduction charge rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest First Summit')

    expect(within(dialog).getByText('FWD Invest First Summit')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('FWD Invest First Summit (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('accumulation-account charge remains informational only')
    expect(screen.getByDisplayValue('Initial Account Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Reduction Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine TM Atlas Wealth as a partial catalog product with 12-month routing and combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Atlas Wealth')

    expect(within(dialog).getByText('TM Atlas Wealth')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i }))

    expect(screen.getAllByText('TM Atlas Wealth (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('one honest SGD / premium-payment-term-25 corridor')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Harvest Flexi as a partial catalog product with executable charge surfaces', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Flexi')

    expect(within(dialog).getByText('Harvest Flexi')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Harvest Flexi (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Performance investment bonus is modeled as three published policy-year windows')
    expect(screen.getByDisplayValue('Policy Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, 10_000)

  it('seeds Tokio Marine Harvest Max as a partial catalog product with executable initial, policy, and admin charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Max')

    expect(within(dialog).getByText('Harvest Max')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15/i }))

    expect(screen.getAllByText('Harvest Max (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('102% performance-growth-measure gate')
    expect(screen.getByDisplayValue('Initial Setup Charge')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Admin Charge')).toBeInTheDocument()
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
    invalidPolicy.currentPolicyYear = invalidPolicy.mipLength ?? 1

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
