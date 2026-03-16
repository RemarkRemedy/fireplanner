import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { IlpReviewPage } from './IlpReviewPage'
import { createDefaultPolicy, useIlpStore } from '@/stores/useIlpStore'

const ILP_REVIEW_PAGE_TEST_TIMEOUT_MS = 40_000

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('adds a second policy and shows the comparison table', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /add policy/i }))

    expect(screen.getByText('Policy Comparison')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/rename new ilp policy/i)).toHaveLength(2)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds a policy from the catalog picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Accelerate')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.getAllByText('Wealth Accelerate (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('premium holiday delayed or partial repayment')
    expect(seededAlert?.textContent).toContain('hsbc accelerate dividend payout threshold')
    expect(seededAlert?.textContent).toContain('hsbc accelerate dividend bank routing')
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
    expect(seededAlert?.textContent).toContain('reinvestment as the default')
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Start-up Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds HSBC Wealth Abundance as a supported catalog product with free-withdrawal and tiered-BRC mechanics', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Abundance')
    const wealthAbundanceSgdButton = within(dialog)
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith('SGD / MIP 10'))
    expect(wealthAbundanceSgdButton).toBeDefined()
    await user.click(wealthAbundanceSgdButton!)

    expect(screen.getAllByText('Wealth Abundance (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('hsbc abundance dividend payout threshold')
    expect(seededAlert?.textContent).toContain('reinvestment as the default')
    expect(screen.getAllByDisplayValue('Account Maintenance Fee')).toHaveLength(2)
    expect(screen.getByDisplayValue('Bonus Recovery Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds a supported catalog product with explicit metadata-only warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prosper')

    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Assure II as a partial catalog product that can be seeded', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure II')

    expect(within(dialog).getByText('PRUVantage Assure II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Assure (SP) as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure (SP)')

    expect(within(dialog).getByText('PRUVantage Assure (SP)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 8/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Etiqa Invest starter as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest starter')

    expect(within(dialog).getByText('Invest starter')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 5/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest smart flex II as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'smart flex II')

    expect(within(dialog).getByText('Invest smart flex II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest flex wealth II as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'flex wealth II')

    expect(within(dialog).getByText('Invest flex wealth II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Wealth Purpose as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Purpose')

    expect(within(dialog).getByText('Invest Wealth Purpose')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex Vantage as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')

    expect(within(dialog).getByText('Invest Flex Vantage')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex TriVantage as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')

    expect(within(dialog).getByText('Invest Flex TriVantage')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')

    expect(within(dialog).getByText('Goal Builder II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Goal Builder II usd mip-15 as a partial catalog product with loyalty and recovery warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')

    expect(within(dialog).getByText('Goal Builder II')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use partial template$/i }))

    expect(screen.getAllByText('Goal Builder II (USD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Premium-Year-based Product Administration Fee')
    expect(seededAlert?.textContent).toContain('Loyalty Bonus cadence')
    expect(seededAlert?.textContent).toContain('manual regular-withdrawal payout support')
    expect(seededAlert?.textContent).toContain('reinvest-default dividend-distribution support')
    expect(screen.getByDisplayValue('Product Administration Fee')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Recurrent Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Welcome Bonus Recovery Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Focus (Flexi 3) as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')

    expect(within(dialog).getByText('Wealth Focus (Flexi 3)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /usd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest flex pro as a partial catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex pro')

    expect(within(dialog).getByText('Invest flex pro')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(flexi 3\)/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Max (II) as a partial catalog product with recurring-premium warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Max')

    expect(within(dialog).getByText('Wealth Max (II)')).toBeInTheDocument()
    const basicVariantButton = within(dialog)
      .getAllByRole('button')
      .find((button) => (
        button.textContent?.includes('SGD / MIP 15')
        && !button.textContent.includes('Advanced Death')
      ))
    expect(basicVariantButton).toBeDefined()
    await user.click(basicVariantButton!)

    expect(screen.getAllByText('Wealth Max (II) (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).not.toContain('tokio post mip regular premium routing back to initial account')
    expect(seededAlert?.textContent).toContain('Wealth Max (II) is modeled with the published initial setup charge, policy investment charge, and admin charge tied to the commencement-date premium commitment.')
    expect(screen.getByDisplayValue('Recurring Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Non-payment)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Max (II) advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Max')

    expect(within(dialog).getByText('Wealth Max (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death\)/i }))

    expect(screen.getAllByText('Wealth Max (II) (SGD / MIP 15 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Pro (II) as a partial catalog product with waiver and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Pro')

    expect(within(dialog).getByText('Wealth Pro (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^SGD \/ MIP 10Use partial template$/i }))

    expect(screen.getAllByText('Wealth Pro (II) (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).not.toContain('tokio involuntary unemployment and hospitalisation waiver')
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Regular Premium Reduction)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add event$/i }))
    expect(screen.getByText('Insurer-approved charge waiver applies')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Pro (II) advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Pro')

    expect(within(dialog).getByText('Wealth Pro (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Wealth Pro (II) (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi as a partial catalog product with split performance-bonus entries', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi')

    const wealthFlexiCard = within(dialog).getByText('Wealth Flexi').closest('.rounded-lg') as HTMLElement | null
    expect(wealthFlexiCard).not.toBeNull()
    await user.click(within(wealthFlexiCard!).getAllByRole('button', { name: /sgd \/ mip 10/i })[0]!)

    expect(screen.getAllByText('Wealth Flexi (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('split SGD / MIP 10 death-benefit-option variants')
    expect(seededAlert?.textContent).toContain('tokio wealth flexi benefit payout handling')
    expect(screen.getByDisplayValue('Initial Setup Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Policy Investment Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Admin Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus (Policy Years 4-6)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Performance Investment Bonus (Policy Years 7-10)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge (Non-payment)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 5.10 as a partial catalog product with accumulation-account policy charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi-Link 5.10')

    expect(within(dialog).getByText('Wealth Flexi-Link 5.10')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('button', { name: /sgd \/ mip 10/i })[0]!)

    expect(screen.getAllByText('Wealth Flexi-Link 5.10 (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('split SGD / MIP 10 death-benefit-option variants')
    expect(seededAlert?.textContent).toContain('tokio wealth flexi link 5 10 dividend payout threshold and record date instructions')
    expect(screen.getByDisplayValue('Policy Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus (Policy Year 10)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 5.10 advanced-death as a partial catalog product with Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi-Link 5.10')

    expect(within(dialog).getByText('Wealth Flexi-Link 5.10')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Wealth Flexi-Link 5.10 (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 3.12 as a partial catalog product with split policy-charge windows and loyalty bonus', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi-Link 3.12')

    expect(within(dialog).getByText('Wealth Flexi-Link 3.12')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('button', { name: /sgd \/ mip 12/i })[0]!)

    expect(screen.getAllByText('Wealth Flexi-Link 3.12 (SGD / MIP 12)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('2.45% policy charge during the minimum investment period and a 0.60% policy charge thereafter')
    expect(seededAlert?.textContent).toContain('tokio wealth flexi link 3 12 dividend payout threshold and record date instructions')
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Premium Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus (Policy Year 12)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 3.12 advanced-death as a partial catalog product with Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi-Link 3.12')

    const wealthFlexiLinkCard = within(dialog).getByText('Wealth Flexi-Link 3.12').closest('.rounded-lg') as HTMLElement | null
    expect(wealthFlexiLinkCard).not.toBeNull()
    await user.click(within(wealthFlexiLinkCard!).getByRole('button', { name: /sgd \/ mip 12 \(advanced death\)/i }))

    expect(screen.getAllByText('Wealth Flexi-Link 3.12 (SGD / MIP 12 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Builder@Future as a partial catalog product with split premium-bonus windows', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Builder@Future')

    expect(within(dialog).getByText('Wealth Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use partial template$/i }))

    expect(screen.getAllByText('Wealth Builder@Future (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(seededAlert?.textContent).toContain('2.50% policy charge during the minimum investment period and a 0.60% policy charge thereafter')
    expect(seededAlert?.textContent).toContain('tokio wealth builder atfuture dividend payout threshold and record date instructions')
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Premium Bonus (Policy Years 6-20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Bonus (After Policy Year 20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Builder@Future advanced-death as a partial catalog product with Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Builder@Future')

    expect(within(dialog).getByText('Wealth Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Wealth Builder@Future (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Builder@Future basic-death as a partial catalog product with the same charge frame and lower initial bonus bands', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Builder@Future')

    expect(within(dialog).getByText('Harvest Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('button', { name: /sgd \/ mip 10/i })[0]!)

    expect(screen.getAllByText('Harvest Builder@Future (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('2.50% policy charge during the minimum investment period and a 0.60% policy charge thereafter')
    expect(seededAlert?.textContent).toContain('tokio harvest builder atfuture dividend payout threshold and record date instructions')
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Premium Bonus (Policy Years 6-20)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Power-up Bonus')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Builder@Future advanced-death as a partial catalog product with Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Builder@Future')

    expect(within(dialog).getByText('Harvest Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Harvest Builder@Future (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi advanced-death as a partial catalog product with Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi')

    const wealthFlexiCard = within(dialog).getByText('Wealth Flexi').closest('.rounded-lg') as HTMLElement | null
    expect(wealthFlexiCard).not.toBeNull()
    await user.click(within(wealthFlexiCard!).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Wealth Flexi (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goLuxe advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goLuxe')

    expect(within(dialog).getByText('#goLuxe')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death\)/i }))

    expect(screen.getAllByText('#goLuxe (SGD / MIP 15 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('split SGD / minimum-contribution-period-15 death-benefit-option corridors only')
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goLuxe basic-death as a partial catalog product with metadata-only protection charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goLuxe')

    expect(within(dialog).getByText('#goLuxe')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15use partial template$/i }))

    expect(screen.getAllByText('#goLuxe (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('split SGD / minimum-contribution-period-15 death-benefit-option corridors only')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(seededAlert?.textContent).toContain('manual distribution-mode assumption surface')
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Recurring Single Premium Charge')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Monthly Protection Charge')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAffluence as a partial catalog product with modeled initial and policy charge rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAffluence')

    expect(within(dialog).getByText('#goAffluence')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15use partial template$/i }))

    expect(screen.getAllByText('#goAffluence (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('split SGD / premium-payment-term-15 death-benefit-option corridors only')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(screen.getByDisplayValue('Initial Charge')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Policy Charge')).toHaveLength(2)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAffluence advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAffluence')

    expect(within(dialog).getByText('#goAffluence')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death\)/i }))

    expect(screen.getAllByText('#goAffluence (SGD / MIP 15 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Affluence@Future as a partial catalog product with capped initial and deferred policy charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Affluence@Future')

    expect(within(dialog).getByText('Affluence@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15use partial template$/i }))

    expect(screen.getAllByText('Affluence@Future (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('split SGD / premium-payment-term-15 death-benefit-option corridors only')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(screen.getByDisplayValue('Initial Charge')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Affluence@Future advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Affluence@Future')

    expect(within(dialog).getByText('Affluence@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death\)/i }))

    expect(screen.getAllByText('Affluence@Future (SGD / MIP 15 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAssure as a partial catalog product with modeled charge surfaces and metadata-only MPC', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAssure')

    expect(within(dialog).getByText('#goAssure')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use partial template$/i }))

    expect(screen.getAllByText('#goAssure (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(seededAlert?.textContent).toContain('Guaranteed Extra Protection')
    expect(seededAlert?.textContent).toContain('distribution-yield assumption')
    expect(screen.getByDisplayValue('Initial Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Policy Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('#goWealth Enrich cash seeds modeled establishment and withdrawal charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goWealth Enrich')

    expect(within(dialog).getByText('#goWealth Enrich')).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use partial template$/i }),
    )

    expect(screen.getAllByText('#goWealth Enrich (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('establishment charge')
    expect(seededAlert?.textContent).toContain('first-three-policy-years single-premium partial-withdrawal charge schedule')
    expect(seededAlert?.textContent).toContain('Loyalty bonus and protection benefits remain outside the current engine')
    expect(screen.getByDisplayValue('Establishment Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('#goElite cash seeds modeled establishment charges with metadata-only protection benefits', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goElite')

    const goEliteCard = within(dialog).getByText('#goElite').closest('.rounded-lg') as HTMLElement | null
    expect(goEliteCard).not.toBeNull()
    await user.click(
      within(goEliteCard!).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use partial template$/i }),
    )

    expect(screen.getAllByText('#goElite (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('protection benefits remain outside the current engine')
    expect(seededAlert?.textContent).toContain('Recurring single premium and top-up availability only after one policy year')
    expect(seededAlert?.textContent).toContain('nil partial-withdrawal charge')
    expect(screen.getByDisplayValue('Establishment Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('#goElite Secure cash seeds locked-in-value and adjusted-single-premium MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goElite Secure')

    expect(within(dialog).getByText('#goElite Secure')).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use partial template$/i }),
    )

    expect(screen.getAllByText('#goElite Secure (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('death-benefit floor logic')
    expect(seededAlert?.textContent).toContain('Adjusted Single Premium')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/current locked-in policy value/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current adjusted single premium/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds TM Wealth Enhancer (CPFIS) as a partial catalog product with zero-charge CPF top-up routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Enhancer')

    expect(within(dialog).getByText('TM Wealth Enhancer (CPFIS)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use partial template$/i }))

    expect(screen.getAllByText('TM Wealth Enhancer (CPFIS)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('zero-charge single-premium, ad-hoc top-up, and regular top-up allocation path')
    expect(seededAlert?.textContent).toContain('withdrawal administration')
    expect(screen.getByDisplayValue('Single Premium Charge (CPF)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ad-Hoc Top-up Premium Charge (CPF)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Regular Top-up Premium Charge (CPF)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds WealthLink (GL3) as a supported catalog product with open-ended single-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'WealthLink')

    expect(within(dialog).getByText('WealthLink (GL3)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))

    expect(screen.getAllByText('WealthLink (GL3) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published 3.5% upfront single-premium charge')
    expect(seededAlert?.textContent).toContain('no policy fee and no insurance cover charge')
    expect(seededAlert?.textContent).toContain('no-MIP basis')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage (SP) as a supported catalog product with open-ended single-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (SP)')

    expect(within(dialog).getByText('GREAT Invest Advantage (SP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))

    expect(screen.getAllByText('GREAT Invest Advantage (SP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('upfront initial single-premium charge')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByDisplayValue('Initial Single Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage (RSP) as a supported catalog product with open-ended recurrent-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (RSP)')

    expect(within(dialog).getByText('GREAT Invest Advantage (RSP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))

    expect(screen.getAllByText('GREAT Invest Advantage (RSP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published recurrent-premium charge path')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByDisplayValue('Recurring Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRULink InvestGrowth (SP) cash as a supported catalog product with direct-income support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRULink InvestGrowth (SP)')

    expect(within(dialog).getByText('PRULink InvestGrowth (SP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))

    expect(screen.getAllByText('PRULink InvestGrowth (SP) (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published initial single-premium charge')
    expect(seededAlert?.textContent).toContain('Direct Income support through the manual distribution-mode kernel')
    expect(seededAlert?.textContent).toContain('Direct Income option is modeled through manual distribution-mode support')
    expect(screen.getByDisplayValue('Initial Single Premium Charge (Cash)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRULink InvestGrowth cash as a supported catalog product with premium-based assurance charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRULink InvestGrowth')

    const investGrowthCard = within(dialog).getByText('PRULink InvestGrowth').closest('.rounded-lg') as HTMLElement | null
    expect(investGrowthCard).not.toBeNull()
    await user.click(within(investGrowthCard!).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))

    expect(screen.getAllByText('PRULink InvestGrowth (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published recurring-premium charge')
    expect(seededAlert?.textContent).toContain('premium-event assurance-charge path')
    expect(seededAlert?.textContent).toContain('minimum-premium schedule enforcement remain outside the current engine')
    expect(screen.getByDisplayValue('Recurring Premium Charge (Cash)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Invest Easy (Cash/SRS) as a partial catalog product with recurring top-up charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Invest Easy (Cash/SRS)')

    expect(within(dialog).getByText('AIA Invest Easy (Cash/SRS)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash srs\)use partial template$/i }))

    expect(screen.getAllByText('AIA Invest Easy (Cash/SRS) (SGD / Open-ended (Cash Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('published 3% single-premium, ad-hoc top-up, and regular top-up premium charges')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Regular Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Invest Easy (CPF) as a partial catalog product with zero-charge recurring top-up routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Invest Easy (CPF)')

    expect(within(dialog).getByText('AIA Invest Easy (CPF)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use partial template$/i }))

    expect(screen.getAllByText('AIA Invest Easy (CPF) (SGD / Open-ended (Cpf))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('published zero-charge single-premium, ad-hoc top-up, and regular top-up allocation path')
    expect(seededAlert?.textContent).toContain('Fund access is limited to CPFIS-eligible ILP sub-funds')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Regular Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds SNACK-Investment as a partial catalog product with reinvest-only distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'SNACK-Investment')

    expect(within(dialog).getByText('SNACK-Investment')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse partial template$/i }))

    expect(screen.getAllByText('SNACK-Investment (SGD / Open-ended)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('does not support cash payouts')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tiq Invest as a partial catalog product with zero-charge recurring top-up routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Tiq Invest')

    expect(within(dialog).getByText('Tiq Invest')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse partial template$/i }))

    expect(screen.getAllByText('Tiq Invest (SGD / Open-ended)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('0.75% annual management charge')
    expect(seededAlert?.textContent).toContain('There is no insurance charge imposed on this policy')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Management Charge Fee')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Recurring Top-up Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Dash PET Plus as a partial rider product with reinvest-default distribution support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Dash PET Plus')

    expect(within(dialog).getByText('Dash PET Plus')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(rider\)use partial template$/i }))

    expect(screen.getAllByText('Dash PET Plus (SGD / Open-ended (Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('zero-charge rider subscription')
    expect(seededAlert?.textContent).toContain('open-ended rider product uses the no-MIP basis')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Management Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest Goal 1 SGD as a partial catalog product with original-base plan charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest Goal 1')

    expect(within(dialog).getByText('FWD Invest Goal 1')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse partial template$/i }))

    expect(screen.getAllByText('FWD Invest Goal 1 (SGD / Open-ended)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(seededAlert?.textContent).toContain('gross commencement lump sum before trusting the seeded starting value')
    expect(seededAlert?.textContent).toContain('minimum residual account-value rules remain informational only')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Initial Account Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Plan Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulink Investor (II) cash as a partial catalog product with reinvest-default distribution support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulink Investor (II)')

    expect(within(dialog).getByText('Manulink Investor (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use partial template$/i }))

    expect(screen.getAllByText('Manulink Investor (II) (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('published 3% single-premium and top-up charge path')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getByDisplayValue('Single Premium Charge (Cash)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge (Cash)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest plus SP as a partial catalog product with initial single-premium corridor warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest plus SP')

    expect(within(dialog).getByText('Invest plus SP')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(single premium initial only\)use partial template$/i }))

    expect(screen.getAllByText('Invest plus SP (SGD / Open-ended (Single Premium Initial Only))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('initial single-premium corridor only')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getByDisplayValue('Single Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Policy Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulife SmartRetire (V) - Income as a partial catalog product with payout-state and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Income')

    expect(within(dialog).getByText('Manulife SmartRetire (V) - Income')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use partial template$/i }))

    expect(screen.getAllByText('Manulife SmartRetire (V) - Income (SGD / MIP 8 (Flexi 3))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('scheduled retirement-income capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('premium-shortfall charge before Flexi Start')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulife SmartRetire (V) - Sum as a partial catalog product with withdrawal and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Sum')

    expect(within(dialog).getByText('Manulife SmartRetire (V) - Sum')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use partial template$/i }))

    expect(screen.getAllByText('Manulife SmartRetire (V) - Sum (SGD / MIP 8 (Flexi 3))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('premium-shortfall charge before Flexi Start')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(seededAlert?.textContent).toContain('Target Retirement Sum withdrawal, optional regular-income drawdown elections')
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest Flexi VII as a partial catalog product with premium-pause and protection warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest Flexi VII')

    expect(within(dialog).getByText('FWD Invest Flexi VII')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use partial template$/i }))

    expect(screen.getAllByText('FWD Invest Flexi VII (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('published fixed-premium-base initial account charge')
    expect(seededAlert?.textContent).toContain('Premium Pause Waiver')
    expect(seededAlert?.textContent).toContain('bonuses, insurance charge, repayment waterfalls')
    expect(screen.getByDisplayValue('Initial Account Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Initial Account Redemption Fee')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Elite Secure Income - Single Premium as a partial catalog product with manual payout-state warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - Single Premium')

    expect(within(dialog).getByText('AIA Elite Secure Income - Single Premium')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use partial template$/i }))

    expect(screen.getAllByText(/AIA Elite Secure Income - Single Premium/i).length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('published 3% top-up premium charge')
    expect(seededAlert?.textContent).toContain('scheduled payout capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('initial single-premium charge and payout amount remain manual or informational inputs')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getByDisplayValue('Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Elite Secure Income - 5 Pay as a partial catalog product with premium-history and payout warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')

    expect(within(dialog).getByText('AIA Elite Secure Income - 5 Pay')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use partial template$/i }))

    expect(screen.getAllByText('AIA Elite Secure Income - 5 Pay (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('premium-year regular premium charge schedule')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule')
    expect(seededAlert?.textContent).toContain('scheduled payout capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('Secure Monthly Income eligibility depends on no premium holiday')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Retirement Elite as a partial catalog product with payout-state and supplementary-charge warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Retirement Elite')

    expect(within(dialog).getByText('AIA Platinum Retirement Elite')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use partial template$/i }))

    expect(screen.getAllByText('AIA Platinum Retirement Elite (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('regular-pay 5-year corridor')
    expect(seededAlert?.textContent).toContain('2.50% p.a. regular-premium supplementary charge')
    expect(seededAlert?.textContent).toContain('scheduled payout capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('Target Monthly Retirement Income amount')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Supplementary Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Wealth Elite 2.0 as a partial catalog product with premium-term extension warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Elite 2.0')

    expect(within(dialog).getByText('AIA Platinum Wealth Elite 2.0')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use partial template$/i }))

    expect(screen.getAllByText('AIA Platinum Wealth Elite 2.0 (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('premium-year regular premium charges')
    expect(seededAlert?.textContent).toContain('3% top-up premium charge')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule')
    expect(seededAlert?.textContent).toContain('optional extension of the regular premium term beyond five years')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Wealth Legacy as a partial catalog product with informational withdrawal-table warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Legacy')

    expect(within(dialog).getByText('AIA Platinum Wealth Legacy')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use partial template$/i }))

    expect(screen.getAllByText(/AIA Platinum Wealth Legacy/i).length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('cash regular-pay 5-year corridor')
    expect(seededAlert?.textContent).toContain('3% top-up premium charge')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule')
    expect(seededAlert?.textContent).toContain('partial-withdrawal / surrender table is left informational only')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Wealth Venture as a partial catalog product with supplementary-charge and distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Wealth Venture')

    expect(within(dialog).getByText('AIA Wealth Venture')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8use partial template$/i }))

    expect(screen.getAllByText('AIA Wealth Venture (SGD / MIP 8)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('regular-pay 8-year corridor')
    expect(seededAlert?.textContent).toContain('3.60% p.a. regular-premium supplementary charge')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('published S$50 dividend cash-out threshold')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Supplementary Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Pro Achiever 3.0 as a partial catalog product with IIP distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Pro Achiever 3.0')

    expect(within(dialog).getByText('AIA Pro Achiever 3.0')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use partial template$/i }))

    expect(screen.getAllByText('AIA Pro Achiever 3.0 (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('10-year IIP corridor')
    expect(seededAlert?.textContent).toContain('5% top-up premium charge')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(seededAlert?.textContent).toContain('Benefit Charge')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Pro Lifetime Protector (II) as a partial catalog product with policy-fee and bonus warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Pro Lifetime Protector (II)')

    expect(within(dialog).getByText('AIA Pro Lifetime Protector (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(regular pay\)use partial template$/i }))

    expect(screen.getAllByText('AIA Pro Lifetime Protector (II) (SGD / Open-ended (Regular Pay))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('2% Special Bonus from premium year 10 onward')
    expect(seededAlert?.textContent).toContain('fixed S$5 monthly policy fee')
    expect(seededAlert?.textContent).toContain('nil policy-level partial-withdrawal charge path')
    expect(seededAlert?.textContent).toContain('fixed S$50 monthly premium-holiday charge')
    expect(screen.getByDisplayValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Policy Fee')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Special Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage 2 (SP) as a supported catalog product with open-ended single-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage 2 (SP)')

    expect(within(dialog).getByText('GREAT Invest Advantage 2 (SP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))

    expect(screen.getAllByText('GREAT Invest Advantage 2 (SP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('upfront initial single-premium charge')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByDisplayValue('Initial Single Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage 2 (RSP) as a supported catalog product with open-ended recurrent-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage 2 (RSP)')

    expect(within(dialog).getByText('GREAT Invest Advantage 2 (RSP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))

    expect(screen.getAllByText('GREAT Invest Advantage 2 (RSP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published recurrent-premium charge path')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByDisplayValue('Recurring Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic basic-death as a partial catalog product with combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic')

    const goClassicCard = within(dialog).getByText('#goClassic').closest('.rounded-lg') as HTMLElement | null
    expect(goClassicCard).not.toBeNull()
    await user.click(within(goClassicCard!).getByRole('button', { name: /^sgd \/ mip 25use partial template$/i }))

    expect(screen.getAllByText('#goClassic (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic advanced-death as a partial catalog product with disable-on-failure Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic')

    const goClassicCard = within(dialog).getByText('#goClassic').closest('.rounded-lg') as HTMLElement | null
    expect(goClassicCard).not.toBeNull()
    await user.click(within(goClassicCard!).getByRole('button', { name: /sgd \/ mip 25 \(advanced death\)/i }))

    expect(screen.getAllByText('#goClassic (SGD / MIP 25 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(seededAlert?.textContent).toContain('irreversible downgrade after failed deduction')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic Secure as a partial catalog product with combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic Secure')

    expect(within(dialog).getByText('#goClassic Secure')).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^sgd \/ mip 25use partial template$/i }),
    )

    expect(screen.getAllByText('#goClassic Secure (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic Secure advanced death with locked-in-value MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic Secure')

    expect(within(dialog).getByText('#goClassic Secure')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /advanced death/i }))

    expect(screen.getAllByText(/#goClassic Secure .*Advanced Death/i).length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Locked-in Policy Value floor')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/current locked-in policy value/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine TM Atlas Wealth basic-death as a partial catalog product with 12-month routing and combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Atlas Wealth')

    expect(within(dialog).getByText('TM Atlas Wealth')).toBeInTheDocument()
    const basicVariantButton = within(dialog)
      .getAllByRole('button')
      .find((button) => (
        button.textContent?.includes('SGD / MIP 25')
        && !button.textContent.includes('Advanced Death')
      ))
    expect(basicVariantButton).toBeDefined()
    await user.click(basicVariantButton!)

    expect(screen.getAllByText('TM Atlas Wealth (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine TM Atlas Wealth advanced-death as a partial catalog product with disable-on-failure Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Atlas Wealth')

    expect(within(dialog).getByText('TM Atlas Wealth')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 25 \(advanced death\)/i }))

    expect(screen.getAllByText('TM Atlas Wealth (SGD / MIP 25 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(seededAlert?.textContent).toContain('policy-year-2 settlement')
    expect(seededAlert?.textContent).toContain('irreversible downgrade after failed deduction')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Flexi as a partial catalog product with executable charge surfaces', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Flexi')

    expect(within(dialog).getByText('Harvest Flexi')).toBeInTheDocument()
    const basicVariantButton = within(dialog)
      .getAllByRole('button')
      .find((button) => (
        button.textContent?.includes('SGD / MIP 10')
        && !button.textContent.includes('Advanced Death')
      ))
    expect(basicVariantButton).toBeDefined()
    await user.click(basicVariantButton!)

    expect(screen.getAllByText('Harvest Flexi (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Performance investment bonus is modeled as three published policy-year windows')
    expect(seededAlert?.textContent).toContain('tokio harvest flexi benefit payout handling')
    expect(screen.getByDisplayValue('Policy Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Admin Charge')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Initial Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Flexi advanced-death as a partial catalog product with Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Flexi')

    expect(within(dialog).getByText('Harvest Flexi')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Harvest Flexi (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Pro as a partial catalog product with dividend-mode support on all three accounts', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Pro')

    expect(within(dialog).getByText('Harvest Pro')).toBeInTheDocument()
    const basicVariantButton = within(dialog)
      .getAllByRole('button')
      .find((button) => (
        button.textContent?.includes('SGD / MIP 10')
        && !button.textContent.includes('Advanced Death')
      ))
    expect(basicVariantButton).toBeDefined()
    await user.click(basicVariantButton!)

    expect(screen.getAllByText('Harvest Pro (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('tokio dividend payout threshold and record date instructions')
    expect(screen.getByDisplayValue('Performance Investment Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Pro advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Pro')

    expect(within(dialog).getByText('Harvest Pro')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death\)/i }))

    expect(screen.getAllByText('Harvest Pro (SGD / MIP 10 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Max as a partial catalog product with executable initial, policy, and admin charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Max')

    expect(within(dialog).getByText('Harvest Max')).toBeInTheDocument()
    const basicVariantButton = within(dialog)
      .getAllByRole('button')
      .find((button) => (
        button.textContent?.includes('SGD / MIP 15')
        && !button.textContent.includes('Advanced Death')
      ))
    expect(basicVariantButton).toBeDefined()
    await user.click(basicVariantButton!)

    expect(screen.getAllByText('Harvest Max (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('102% performance-growth-measure gate')
    expect(seededAlert?.textContent).toContain('tokio harvest max dividend payout threshold and record date instructions')
    expect(screen.getByDisplayValue('Initial Setup Charge')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Policy Charge').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Admin Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Max advanced-death as a partial catalog product with accrued Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Max')

    expect(within(dialog).getByText('Harvest Max')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death\)/i }))

    expect(screen.getAllByText('Harvest Max (SGD / MIP 15 (Advanced Death))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Partial template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getByDisplayValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('renames the active policy from the input form and updates the policy tab', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    const nameInput = screen.getByLabelText('Policy Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'AIA Pro Achiever')

    expect(screen.getByText('AIA Pro Achiever')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

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
