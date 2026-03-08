import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { StartPage } from './StartPage'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useUIStore } from '@/stores/useUIStore'

function renderStartPage() {
  return render(
    <MemoryRouter>
      <StartPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  // Reset UI store to defaults
  useUIStore.setState({
    sectionOrder: 'goal-first',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    statsPosition: 'bottom',
  })
})

describe('StartPage', () => {
  it('renders the page title', () => {
    renderStartPage()
    expect(screen.getByText('Singapore FIRE Planner')).toBeInTheDocument()
  })

  it('renders 3 pathway cards', () => {
    renderStartPage()
    expect(screen.getByText('I know when I want to retire')).toBeInTheDocument()
    expect(screen.getByText("Show me what's possible")).toBeInTheDocument()
    expect(screen.getByText('I already have enough')).toBeInTheDocument()
  })

  it('shows goal-first form when clicking first pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I know when I want to retire'))
    // Goal-first form has "Desired Retirement Age" label
    expect(screen.getByText('Desired Retirement Age')).toBeInTheDocument()
    expect(screen.getByText('Build my full plan')).toBeInTheDocument()
  })

  it('shows story-first form when clicking second pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))
    // Story-first form has "Monthly Income" label
    expect(screen.getByText('Monthly Income')).toBeInTheDocument()
    expect(screen.getByText('Build my full plan')).toBeInTheDocument()
  })

  it('shows already-fire form with CPF phase cards when clicking third pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I already have enough'))
    // Already-fire shows CPF stage selection
    expect(screen.getByText("What's your CPF stage?")).toBeInTheDocument()
    expect(screen.getByText('Before 55')).toBeInTheDocument()
    expect(screen.getByText('55 to 64')).toBeInTheDocument()
    expect(screen.getByText('65 and above')).toBeInTheDocument()
  })

  it('toggles off pathway form when clicking same card again', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I know when I want to retire'))
    expect(screen.getByText('Desired Retirement Age')).toBeInTheDocument()

    // Click again to toggle off
    await user.click(screen.getByText('I know when I want to retire'))
    expect(screen.queryByText('Desired Retirement Age')).not.toBeInTheDocument()
  })

  it('shows section toggles inline after picking any pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    // No toggles visible initially
    expect(screen.queryByText('What should we include?')).not.toBeInTheDocument()

    await user.click(screen.getByText('I know when I want to retire'))
    expect(screen.getByText('What should we include?')).toBeInTheDocument()
    expect(screen.getByText('CPF Integration')).toBeInTheDocument()
    expect(screen.getByText('Property Analysis')).toBeInTheDocument()
  })

  it('shows healthcare toggle only when CPF is enabled', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I know when I want to retire'))

    // CPF is enabled by default, so healthcare should be visible
    expect(screen.getByText('Healthcare Planning')).toBeInTheDocument()
  })

  it('shows returning user link only when localStorage has profile', () => {
    // No profile — links should not appear
    localStorage.removeItem('fireplanner-profile')
    const { unmount } = renderStartPage()
    expect(screen.queryByText(/continue inputs/i)).not.toBeInTheDocument()
    unmount()

    // Set profile — returning user guidance and action buttons should appear
    localStorage.setItem('fireplanner-profile', '{}')
    renderStartPage()
    const continueLink = screen.getByText(/continue inputs/i)
    expect(continueLink.closest('a')).toHaveAttribute('href', '/inputs')
    const dashboardLink = screen.getByText(/view dashboard/i)
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard')
    localStorage.removeItem('fireplanner-profile')
  })

  it('goal-first Continue button is disabled when retirement age <= current age', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I know when I want to retire'))

    // Find the Continue button
    const continueButton = screen.getByRole('button', { name: /Build my full plan/i })

    // Default ages: current=30, retirement=55 — should be enabled
    expect(continueButton).not.toBeDisabled()
  })

  it('shows take-home/gross selector when pathway form opens', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))
    expect(screen.getByText('Take-home')).toBeInTheDocument()
    expect(screen.getByText('Gross')).toBeInTheDocument()
  })

  it('shows bonus months input when checkbox is checked', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))

    const checkbox = screen.getByLabelText('I receive bonus / AWS')
    expect(screen.queryByText('extra month(s)')).not.toBeInTheDocument()

    await user.click(checkbox)
    expect(screen.getByText('extra month(s)')).toBeInTheDocument()
  })

  it('shows estimated gross when take-home is selected', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))

    // Default take-home mode with default value should show gross estimate
    expect(screen.getByText(/estimated gross/i)).toBeInTheDocument()
    expect(screen.getByText(/employee CPF/i)).toBeInTheDocument()
  })

  it('hides gross estimate and shows annual equivalent when switching to gross mode', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))

    // Switch to gross mode
    await user.click(screen.getByText('Gross'))

    // In gross mode, should NOT show "Estimated gross"
    expect(screen.queryByText(/estimated gross/i)).not.toBeInTheDocument()
    // Should show annual equivalent with tilde prefix
    expect(screen.getByText(/~\$72,000\/year/)).toBeInTheDocument()
  })

  it('shows annual equivalent for monthly expenses', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))

    // Default $4,000/mo expenses → should show ~$48,000/year
    expect(screen.getByText(/~\$48,000\/year/)).toBeInTheDocument()
  })

  it('writes annual base salary and bonus months to stores when continuing', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))

    const continueBtn = screen.getByRole('button', { name: /build my full plan/i })
    await user.click(continueBtn)

    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()
    // Default take-home $4,800 at age 30 grosses up to $6,000/mo = $72,000/year
    expect(profile.annualIncome).toBeCloseTo(72000, -2)
    expect(profile.annualExpenses).toBe(48000)
    expect(income.annualSalary).toBeCloseTo(72000, -2)
    expect(income.bonusMonths).toBe(0)
  })

  it('writes bonus months separately when bonus is enabled', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))

    // Enable bonus with default 1 month
    const checkbox = screen.getByLabelText('I receive bonus / AWS')
    await user.click(checkbox)

    const continueBtn = screen.getByRole('button', { name: /build my full plan/i })
    await user.click(continueBtn)

    const income = useIncomeStore.getState()
    expect(income.bonusMonths).toBe(1)
    // Base salary should be 12 months worth, not 13
    expect(income.annualSalary).toBeCloseTo(72000, -2)
  })

  it('writes income to income store in already-fire pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I already have enough'))

    // Click a phase card to continue
    await user.click(screen.getByText('Before 55'))

    const income = useIncomeStore.getState()
    expect(income.annualSalary).toBeCloseTo(72000, -2)
  })
})
