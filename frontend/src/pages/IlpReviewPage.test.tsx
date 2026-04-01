import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { IlpReviewPage } from './IlpReviewPage'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
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

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

function renderIlpReviewPage() {
  return render(
    <MemoryRouter>
      <IlpReviewPage />
    </MemoryRouter>,
  )
}

async function confirmSeededPolicy(user: ReturnType<typeof userEvent.setup>) {
  const confirmButton = await screen.findByRole('button', { name: /load this product/i })

  if (confirmButton.hasAttribute('disabled')) {
    const initialSinglePremiumInput = screen.queryByLabelText(/initial single premium/i)
    if (initialSinglePremiumInput instanceof HTMLInputElement) {
      await user.clear(initialSinglePremiumInput)
      await user.type(initialSinglePremiumInput, '50000')
    }

    const monthlyPremiumInput = screen.queryByLabelText(/monthly premium/i)
    if (monthlyPremiumInput instanceof HTMLInputElement) {
      await user.clear(monthlyPremiumInput)
      await user.type(monthlyPremiumInput, '500')
    }
  }

  await waitFor(() => expect(confirmButton).toBeEnabled())
  await user.click(confirmButton)
}

type CatalogTextMatcher = Parameters<typeof screen.queryAllByText>[0]

function expandCatalogReadOnlySections() {
  for (const button of screen.queryAllByRole('button', { name: /show (details|rates)( \(read-only\))?/i })) {
    act(() => {
      button.click()
    })
  }
}

function getCatalogValues(matcher: CatalogTextMatcher) {
  expandCatalogReadOnlySections()

  const displayValueMatches = screen.queryAllByDisplayValue(matcher)
  if (displayValueMatches.length > 0) {
    return displayValueMatches
  }

  const textMatches = screen.queryAllByText(matcher)
  if (textMatches.length > 0) {
    return textMatches
  }

  throw new Error(`Unable to find seeded catalog label: ${String(matcher)}`)
}

function getCatalogValue(matcher: CatalogTextMatcher) {
  return getCatalogValues(matcher)[0]
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
    expect(screen.queryByText('Available Templates')).not.toBeInTheDocument()
    expect(screen.queryByText('Templates Needing Review')).not.toBeInTheDocument()
    expect(screen.getByText('Selected Policy Workspace')).toBeInTheDocument()
    expect(screen.getByText('Policy Details')).toBeInTheDocument()
    expect(screen.getByText('Policy Configuration')).toBeInTheDocument()
    expect(screen.getByText('Current Snapshot')).toBeInTheDocument()
    expect(screen.getByText('Comparison & Analysis Set')).toBeInTheDocument()
    expect(screen.getByText('Advanced Review')).toBeInTheDocument()
    expect(screen.getByText('Path comparison')).toBeInTheDocument()
    expect(screen.getByText('Illustrative benchmark comparison')).toBeInTheDocument()
    expect(screen.getByText('Total Premiums Paid')).toBeInTheDocument()
    expect(screen.getByText('Support boundary')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('adds a second policy and shows the comparison table', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /add blank policy/i }))

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
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Wealth Accelerate (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Premium-holiday repayment is modeled for full back-pay immediately after the latest holiday period')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate after the first 18 policy months')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot is modeled after the same first-18-month gate')
    expect(seededAlert?.textContent).toContain('admitted-state TI payable amount plus current residual death-benefit snapshot after a TI claim today are supported through manual claim-amount and residual-death inputs')
    expect(seededAlert?.textContent).toContain('Wealth Accelerate keeps reinvestment as the default for dividend-paying funds')
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remaining Aggregate TI Cap (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('applies a chosen product to the selected blank comparison slot instead of adding another policy', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /add blank policy/i }))
    expect(screen.getAllByLabelText(/rename new ilp policy/i)).toHaveLength(2)

    const secondPolicyTab = screen.getAllByRole('button', { name: /select new ilp policy/i })[1]
    await user.click(secondPolicyTab)

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Accelerate')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Wealth Accelerate (SGD / MIP 25)').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /select /i })).toHaveLength(2)
    expect(screen.getAllByLabelText(/rename /i)).toHaveLength(2)
    expect(screen.getAllByLabelText(/rename new ilp policy/i)).toHaveLength(1)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Accelerate TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled after the first 18 policy months', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Accelerate')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Accelerate policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 20_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('Death Benefit After TI Claim Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state TI claim and residual death inputs for Wealth Accelerate', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Accelerate')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Accelerate policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted TI claim benefit amount before the admitted-state TI snapshot can be trusted.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds HSBC Wealth Harvest as a supported catalog product with explicit reinvestment-default boundaries', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Harvest')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 11/i }))

    expect(screen.getAllByText('Wealth Harvest (SGD / MIP 11)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate is modeled as 102% of total account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today are modeled from that same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('reinvestment as the default')
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(getCatalogValue('Start-up Bonus')).toBeInTheDocument()
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
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate is modeled as the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate before age 75 is modeled as the higher of that ordinary death amount or the 200%-of-paid-regular-premiums floor capped at S$2 million plus Top-up Account value after manual current age and current amount owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today are modeled from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('reinvestment as the default')
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValues('Account Maintenance Fee')).toHaveLength(2)
    expect(getCatalogValue('Bonus Recovery Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds HSBC Wealth Voyage as a supported catalog product with premium-base AMF and split startup recovery rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i }))

    expect(screen.getAllByText('Wealth Voyage (SGD / MIP 20)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate before age 75 as the higher of that ordinary death amount or the 200%-of-paid-regular-premiums floor capped at S$2 million plus Top-up Account value after manual current age and current amount owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('hsbc voyage premium holiday charge after free duration')
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValues('Account Maintenance Fee')).toHaveLength(2)
    expect(getCatalogValue('Bonus Recovery Charge (Policy Year 1 Start-up Bonus)')).toBeInTheDocument()
    expect(getCatalogValue('Bonus Recovery Charge (Policy Year 2 Start-up Bonus)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Harvest TI Benefit Today once the remaining aggregate TI cap is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Harvest')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 11/i }))

    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/remaining aggregate ti cap/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Harvest policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 150,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.queryByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for Wealth Harvest and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Harvest')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 11/i }))

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Harvest policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'triggered',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted TI claim benefit amount before the admitted-state TI snapshot can be trusted.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Abundance TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
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

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Abundance policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        monthlyContribution: 500,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 400,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for Wealth Abundance and requires it before the current death snapshot can be trusted', async () => {
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

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Abundance policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'triggered',
        },
      })
    })

    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Abundance Accidental Death Benefit Today once current age and current amount owing are filled', async () => {
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

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Abundance policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        monthlyContribution: 500,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 400,
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Voyage Accidental Death Benefit Today once current age and current amount owing are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i }))

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Voyage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
        monthlyContribution: 500,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 200,
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Voyage TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled before regular-withdrawal assumptions are active', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i }))

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Voyage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
        monthlyContribution: 500,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 200,
        },
        claimProfile: {
          remainingAggregateTiCap: 12_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Voyage current net protected premium base input once regular-withdrawal assumptions are already active', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i }))

    expect(screen.queryByLabelText('Current Net Protected Premium Base (SGD)')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Voyage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
        monthlyContribution: 500,
        scheduledPayoutSupport: {
          mode: 'manual-assumption',
          accountId: 'topup',
          fallbackAccountIds: ['regular'],
          source: 'policy-redemption',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          source: 'manual-assumption',
          accountId: 'topup',
          annualPayoutAmount: 6_000,
          startPolicyYear: 4,
          durationYears: 3,
        },
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 200,
        },
        claimProfile: {
          remainingAggregateTiCap: 12_000,
        },
      })
    })

    expect(screen.getByLabelText('Current Net Protected Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Accidental-Death Regular-Premium Floor (SGD)')).toBeInTheDocument()
    expect(screen.getByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Voyage policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 200,
          currentNetProtectedPremiumBase: 19_000,
          currentAccidentalDeathFloorAmount: 36_000,
        },
      })
    })

    await waitFor(() => {
      expect(screen.queryByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Current Accidental-Death Regular-Premium Floor (SGD)')).toHaveDisplayValue('36,000')
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for Wealth Voyage and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20/i }))

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Voyage policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'triggered',
        },
      })
    })

    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds a supported catalog product with review-needed catalog notes', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prosper')

    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('PRUVantage Prosper (SGD / MIP 25)').length).toBeGreaterThan(0)
    expect(screen.getByText('Seeded from catalog template')).toBeInTheDocument()
    expect(screen.getByText('Supported template')).toBeInTheDocument()
    expect(screen.getByText(/current-state death-benefit estimate as the higher of the 101%-of-paid-regular-premiums floor net growth\/flex withdrawals or current growth\/flex account value plus additional investment account value after manual current amount owing/i)).toBeInTheDocument()
    expect(screen.getByText(/current accidental-death estimate as the higher of the 105%-of-paid-regular-premiums floor net growth\/flex withdrawals or current growth\/flex account value plus additional investment account value after manual current amount owing/i)).toBeInTheDocument()
    expect(screen.getByText(/prudential prosper assurance charges after you enter the insured-life details and current net regular premium base/i)).toBeInTheDocument()
    expect(screen.getByText(/additional catalog notes remain informational only in this dashboard and should be checked against the product summary/i)).toBeInTheDocument()
    expect(screen.getByText(/growth account dividend payout is only allowed after 10 years/i)).toBeInTheDocument()
    expect(getCatalogValue('Assurance Charge (Death)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
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

  it('shows PRUVantage Prosper Accidental Death Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prosper')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 1_500,
        },
      })
    })

    const updatedPolicy = useIlpStore.getState().policies.find((entry) => entry.id === useIlpStore.getState().selectedPolicyId)
    if (!updatedPolicy) throw new Error('Expected updated #goElite policy after current-state edits')

    expect(analyzeIlpPolicy(updatedPolicy).summary.currentAccidentalDeathBenefitEstimate).toBe(137_000)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRUVantage Wealth II as a supported catalog product with current death-benefit support and dividend-mode boundaries', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUVantage Wealth II')

    const wealthIiCard = within(dialog).getByText('PRUVantage Wealth II').closest('.rounded-lg') as HTMLElement | null
    expect(wealthIiCard).not.toBeNull()
    await user.click(within(wealthIiCard!).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.getAllByText('PRUVantage Wealth II (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as the higher of the 101%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value plus Additional Investment Account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate as the higher of the 105%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value plus Additional Investment Account value after manual current amount owing when cash dividend payouts are not active')
    expect(seededAlert?.textContent).toContain('payable-now accidental-disability snapshot')
    expect(seededAlert?.textContent).toContain('Growth Account dividend payout is only allowed after 10 years')
    expect(seededAlert?.textContent).toContain('pruvantage wealth ii accidental death and claim exclusions')
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current Accidental Disability Payout Stage')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Wealth II Accidental Death Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUVantage Wealth II')

    const wealthIiCard = within(dialog).getByText('PRUVantage Wealth II').closest('.rounded-lg') as HTMLElement | null
    expect(wealthIiCard).not.toBeNull()
    await user.click(within(wealthIiCard!).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUVantage Wealth II policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 6,
        monthsAlreadyPaid: 72,
        monthlyContribution: 1_000,
        accounts: policy.accounts.map((account) => {
          if (account.id === 'growth') {
            return { ...account, currentValue: 30_000 }
          }
          if (account.id === 'flex') {
            return { ...account, currentValue: 25_000 }
          }
          if (account.id === 'additional') {
            return { ...account, currentValue: 6_000 }
          }
          return account
        }),
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 1_500,
        },
      })
    })

    const updatedPolicy = useIlpStore.getState().policies.find((entry) => entry.id === useIlpStore.getState().selectedPolicyId)
    if (!updatedPolicy) throw new Error('Expected updated #goElite policy after current-state edits')

    expect(analyzeIlpPolicy(updatedPolicy).summary.currentAccidentalDeathBenefitEstimate).toBe(137_000)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Assure II as a supported catalog product that can be seeded', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure II')

    expect(within(dialog).getByText('PRUVantage Assure II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 25/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRUVantage Assure II as a supported catalog product with current death-benefit support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure II')

    const assureIiCard = within(dialog).getByText('PRUVantage Assure II').closest('.rounded-lg') as HTMLElement | null
    expect(assureIiCard).not.toBeNull()
    await user.click(within(assureIiCard!).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.getAllByText('PRUVantage Assure II (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as the higher of current sum assured, current Wealth Assure Value, or current Growth/Flex account value plus Additional Investment Account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('payable-now accidental-disability snapshot')
    expect(seededAlert?.textContent).toContain('pruvantage assure ii death claim exclusions')
    expect(screen.getByLabelText('Current Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Wealth Assure Value (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current Accidental Disability Payout Stage')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Assure (SP) as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure (SP)')

    expect(within(dialog).getByText('PRUVantage Assure (SP)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 8/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRUVantage Assure (SP) as a supported catalog product with current death-benefit support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure (SP)')

    const assureSpCard = within(dialog).getByText('PRUVantage Assure (SP)').closest('.rounded-lg') as HTMLElement | null
    expect(assureSpCard).not.toBeNull()
    await user.click(within(assureSpCard!).getByRole('button', { name: /^sgd \/ mip 8use template$/i }))

    expect(screen.getAllByText('PRUVantage Assure (SP) (SGD / MIP 8)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('single-premium allocation enhancement tiers on the original initial single premium')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as the higher of current sum assured, current Wealth Assure Value, or Initial Investment Account value plus Additional Investment Account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('payable-now accidental-disability snapshot')
    expect(seededAlert?.textContent).toContain('pruvantage assure sp death claim exclusions')
    expect(getCatalogValue('Single Premium Allocation Enhancement')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Wealth Assure Value (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current Accidental Disability Payout Stage')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Assure (SP) Accidental Disability Benefit Today once the current payout stage is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure (SP)')
    const assureSpCard = within(dialog).getByText('PRUVantage Assure (SP)').closest('.rounded-lg') as HTMLElement | null
    expect(assureSpCard).not.toBeNull()
    await user.click(within(assureSpCard!).getByRole('button', { name: /^sgd \/ mip 8use template$/i }))

    expect(screen.getByText('Current Accidental Disability Payout Stage')).toBeInTheDocument()
    expect(screen.getByText(/current accidental-disability payout stage before the payable-now accidental-disability snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUVantage Assure (SP) policy to be selected')

      state.updatePolicy(policy.id, {
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: account.id === 'iia' ? 120_000 : account.id === 'aia' ? 15_000 : account.currentValue,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 112_000,
          currentWealthAssureValue: 130_000,
          currentAmountOwing: 2_500,
        },
        claimProfile: {
          currentAccidentalDisabilityPayoutStage: 'initial-lump-sum-payable-now',
        },
      })
    })

    expect(screen.queryByText(/current accidental-disability payout stage before the payable-now accidental-disability snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Accidental Disability Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$142,500').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Assure II Accidental Disability Benefit Today once the current payout stage is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Assure II')
    const assureIiCard = within(dialog).getByText('PRUVantage Assure II').closest('.rounded-lg') as HTMLElement | null
    expect(assureIiCard).not.toBeNull()
    await user.click(within(assureIiCard!).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.getByText('Current Accidental Disability Payout Stage')).toBeInTheDocument()
    expect(screen.getByText(/current accidental-disability payout stage before the payable-now accidental-disability snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUVantage Assure II policy to be selected')

      state.updatePolicy(policy.id, {
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: account.id === 'growth' ? 100_000 : account.id === 'additional' ? 50_000 : 0,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 103_000,
          currentWealthAssureValue: 101_000,
          currentAmountOwing: 0,
        },
        claimProfile: {
          currentAccidentalDisabilityPayoutStage: 'initial-lump-sum-payable-now',
        },
      })
    })

    expect(screen.queryByText(/current accidental-disability payout stage before the payable-now accidental-disability snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Accidental Disability Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$153,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUVantage Wealth II Accidental Disability Benefit Today at the later balance stage from claim-history remaining balance', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUVantage Wealth II')
    const wealthIiCard = within(dialog).getByText('PRUVantage Wealth II').closest('.rounded-lg') as HTMLElement | null
    expect(wealthIiCard).not.toBeNull()
    await user.click(within(wealthIiCard!).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.getByText('Current Accidental Disability Payout Stage')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUVantage Wealth II policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentAccidentalDisabilityPayoutStage: 'balance-lump-sum-payable-now',
          currentClaimHistory: {
            family: 'accidental-disability-staged-payout',
            remainingStagedBenefitBalance: 325_000,
          },
        },
      })
    })

    expect(screen.getByLabelText('Current Accidental Disability Remaining Balance (SGD)')).toBeInTheDocument()
    expect(screen.getAllByText('Accidental Disability Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$325,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Etiqa Invest starter as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest starter')

    expect(within(dialog).getByText('Invest starter')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 5/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest smart flex II as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'smart flex II')

    expect(within(dialog).getByText('Invest smart flex II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest flex wealth II as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'flex wealth II')

    expect(within(dialog).getByText('Invest flex wealth II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Wealth Purpose as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Purpose')

    expect(within(dialog).getByText('Invest Wealth Purpose')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Etiqa Invest starter TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest starter')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)
    await screen.findByText('Seeded from catalog template')

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest starter policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest starter current policy-charge refund inputs once a three-year refund cycle has been completed', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest starter')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest starter policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        claimProfile: {
          currentInvestStarterPolicyChargeRefundStatus: 'due-and-uncredited',
        },
      })
    })

    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert?.textContent).toContain('current-due three-year policy-charge refund through manual trailing-36-month average-account-value and refund-status inputs')
    expect(screen.getByText('Current Policy-Charge Refund Status')).toBeInTheDocument()
    expect(screen.getByLabelText(/current trailing 36-month average account value/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted TI claim amount input for Invest starter and does not ask for a residual death amount', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest starter')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest starter policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex Vantage as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')

    expect(within(dialog).getByText('Invest Flex Vantage')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex TriVantage as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')

    expect(within(dialog).getByText('Invest Flex TriVantage')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest Flex Vantage as a supported catalog product with the first-year and post-first-year current death / TI boundary', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Invest Flex Vantage (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount during the first policy year as policy value less a manual current excluded claim bonus value and after the first policy year as the higher of 101% of net premiums paid or policy value')
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Death / TI Insurance Cover Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest Flex TriVantage as a supported catalog product with the first-year and post-first-year current death / TI boundary', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Invest Flex TriVantage (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount during the first policy year as policy value less a manual current excluded claim bonus value and after the first policy year as the higher of 101% of net premiums paid or policy value')
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Death / TI Insurance Cover Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex as a supported catalog product that can be selected from the picker', async () => {
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

  it('seeds Invest Flex as a supported catalog product with the first-year and post-first-year current death / TI boundary', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex')

    const title = within(dialog).getByText(/^Invest Flex$/)
    expect(title).toBeInTheDocument()
    const card = title.closest('.space-y-4')
    expect(card).not.toBeNull()
    await user.click(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 10/i }))

    expect(screen.getAllByText('Invest Flex (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount during the first policy year as policy value less a manual current excluded claim bonus value and after the first policy year as the higher of 101% of net premiums paid or policy value')
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Death / TI Insurance Cover Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex TI Benefit Today once the post-first-year current death corridor is available', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex')

    const title = within(dialog).getByText(/^Invest Flex$/)
    expect(title).toBeInTheDocument()
    const card = title.closest('.space-y-4')
    expect(card).not.toBeNull()
    await user.click(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 2,
        monthsAlreadyPaid: 24,
      })
    })

    expect((await screen.findAllByText('TI Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex admitted TI claim inputs without asking for a residual death amount', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex')

    const title = within(dialog).getByText(/^Invest Flex$/)
    expect(title).toBeInTheDocument()
    const card = title.closest('.space-y-4')
    expect(card).not.toBeNull()
    await user.click(within(card as HTMLElement).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 2,
        monthsAlreadyPaid: 24,
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex Vantage Death Benefit Today during the first policy year once the current excluded claim bonus value is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    expect(screen.getByLabelText('Current Excluded Claim Bonus Value (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current excluded claim bonus value before the first-year current death-benefit estimate can be trusted.')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex Vantage policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentExcludedClaimBonusValue: 150,
        },
      })
    })

    expect(screen.queryByText('This product also needs the current excluded claim bonus value before the first-year current death-benefit estimate can be trusted.')).not.toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex Vantage TI Benefit Today once the post-first-year current death corridor is available', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex Vantage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 2,
        monthsAlreadyPaid: 24,
      })
    })

    expect((await screen.findAllByText('TI Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex Vantage admitted TI claim inputs without asking for a residual death amount', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Flex Vantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex Vantage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 2,
        monthsAlreadyPaid: 24,
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex TriVantage Death Benefit Today after the first policy year without needing the excluded-claim-bonus input', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex TriVantage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 30,
      })
    })

    expect((await screen.findAllByText('Death Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex TriVantage TI Benefit Today once the post-first-year current death corridor is available', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex TriVantage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 30,
      })
    })

    expect((await screen.findAllByText('TI Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Flex TriVantage TI claim-status input and hides TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'TriVantage')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Flex TriVantage policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 30,
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest vista as a supported catalog product that can be selected from the picker', async () => {
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

  it('shows Goal Builder II as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')

    expect(within(dialog).getByText('Goal Builder II')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Goal Builder II usd mip-15 as a supported catalog product with loyalty and recovery warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')

    expect(within(dialog).getByText('Goal Builder II')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Goal Builder II (USD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Premium-Year-based Product Administration Fee')
    expect(seededAlert?.textContent).toContain('Loyalty Bonus cadence')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as the higher of Sum Insured or Net Asset Value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate before age 75 as the higher of the ordinary death amount or the 200%-of-paid-premiums accidental-death sum insured plus top-ups and recurrent single premiums less withdrawals after manual current age and current amount owing')
    expect(seededAlert?.textContent).toContain('manual regular-withdrawal payout support')
    expect(seededAlert?.textContent).toContain('reinvest-default dividend-distribution support')
    expect(screen.getByLabelText('Current Amount Owing (USD)')).toBeInTheDocument()
    expect(getCatalogValue('Product Administration Fee')).toBeInTheDocument()
    expect(getCatalogValue('Recurrent Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Welcome Bonus Recovery Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II historical excluded supplementary-premium cohort inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByRole('button', { name: /add cohort/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add cohort/i }))

    expect(screen.getByLabelText('Excluded Net Supplementary Premium (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Exclusion Runway (Months)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Focus (Flexi 3) as a supported catalog product that can be selected from the picker', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')

    expect(within(dialog).getByText('Wealth Focus (Flexi 3)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /usd \/ mip 10/i })).toBeEnabled()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Focus (Flexi 3) TI Benefit Today and residual death after TI once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current claim-time amount owing \/ outstanding charges/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/remaining aggregate ti cap/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Focus policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          currentAmountOwing: 360,
          sex: 'male',
          smokerStatus: 'non-smoker',
        },
        claimProfile: {
          remainingAggregateTiCap: 12_000,
        },
      })
    })

    expect(screen.queryByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Focus (Flexi 3) Accidental Death Benefit Today once current age and current amount owing are filled before age 75', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Focus policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          currentAmountOwing: 1_000,
          sex: 'male',
          smokerStatus: 'non-smoker',
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Wealth Focus (Flexi 3) manual protected-base inputs once Regular Withdrawal assumptions are already active', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByLabelText('Current Net Protected Premium Base (SGD)')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Focus policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
        monthlyContribution: 1_000,
        scheduledPayoutSupport: {
          mode: 'manual-assumption',
          accountId: 'topup',
          fallbackAccountIds: ['regular'],
          source: 'policy-redemption',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          accountId: 'topup',
          annualPayoutAmount: 3_000,
          startPolicyYear: 5,
          durationYears: 2,
        },
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          currentAmountOwing: 360,
          sex: 'male',
          smokerStatus: 'non-smoker',
        },
      })
    })

    expect(screen.getByLabelText('Current Net Protected Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Accidental-Death Regular-Premium Floor (SGD)')).toBeInTheDocument()
    expect(screen.getByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Focus policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          currentAmountOwing: 360,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 26_000,
          currentAccidentalDeathFloorAmount: 48_000,
        },
      })
    })

    await waitFor(() => {
      expect(screen.queryByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Current Net Protected Premium Base (SGD)')).toHaveDisplayValue('26,000')
    expect(screen.getByLabelText('Current Accidental-Death Regular-Premium Floor (SGD)')).toHaveDisplayValue('48,000')
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted accidental-death claim amount input for #goElite once the Tokio corridor is confirmed', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), '#goElite')
    await user.click(within(dialog).getAllByRole('button', { name: /sgd \/ open-ended \(cash\)/i })[0]!)
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded #goElite policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          currentAmountOwing: 1_000,
        },
        claimProfile: {
          currentTokioAccidentalDeathClaimGateStatus: 'published-corridor-satisfied',
          remainingAggregateAccidentalDeathCap: 1_000_000,
          currentAccidentalDeathClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted Accidental-Death Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted accidental-death claim benefit amount before the admitted-state accidental-death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('hides the admitted accidental-death claim amount input for #goElite until the Tokio corridor is confirmed', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), '#goElite')
    await user.click(within(dialog).getAllByRole('button', { name: /sgd \/ open-ended \(cash\)/i })[0]!)
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded #goElite policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          currentAmountOwing: 1_000,
        },
        claimProfile: {
          currentAccidentalDeathClaimStatus: 'admitted',
          remainingAggregateAccidentalDeathCap: 1_000_000,
        },
      })
    })

    expect(screen.queryByLabelText('Current Admitted Accidental-Death Claim Benefit Amount (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('hides AIA Elite Secure Income - 5 Pay accidental-death snapshot rows after an admitted and settled accidental-death claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 5/i }))

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - 5 Pay policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentAiaAccidentalDeathClaimGateStatus: 'published-corridor-satisfied',
          currentAccidentalDeathClaimStatus: 'admitted-and-settled',
        },
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()
    })
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

  it('shows Invest flex pro as a supported catalog product that can be selected from the picker', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).not.toContain('tokio post mip regular premium routing back to initial account')
    expect(seededAlert?.textContent).toContain('Wealth Max (II) is modeled with the published initial setup charge, policy investment charge, and admin charge tied to the commencement-date premium commitment.')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Recurring Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge (Non-payment)')).toBeInTheDocument()
    expect(getCatalogValue('Performance Investment Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Max (II) advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Max (II) advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Max')

    expect(within(dialog).getByText('Wealth Max (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Wealth Max (II) (SGD / MIP 15 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Pro (II) as a supported catalog product with waiver and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Pro')

    expect(within(dialog).getByText('Wealth Pro (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^SGD \/ MIP 10Use template$/i }))

    expect(screen.getAllByText('Wealth Pro (II) (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).not.toContain('tokio involuntary unemployment and hospitalisation waiver')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Premium Shortfall Charge (Regular Premium Reduction)')).toBeInTheDocument()
    expect(getCatalogValue('Performance Investment Bonus')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add event$/i }))
    expect(screen.getByText('Insurer-approved charge waiver applies')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Pro (II) advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Pro (II) advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Pro')

    expect(within(dialog).getByText('Wealth Pro (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Wealth Pro (II) (SGD / MIP 10 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi as a supported catalog product with split performance-bonus entries', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('split SGD / MIP 10 death-benefit-option variants')
    expect(seededAlert?.textContent).toContain('tokio wealth flexi advanced death payout handling')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Initial Setup Charge')).toBeInTheDocument()
    expect(getCatalogValue('Policy Investment Charge')).toBeInTheDocument()
    expect(getCatalogValue('Admin Charge')).toBeInTheDocument()
    expect(getCatalogValue('Performance Investment Bonus (Policy Years 4-6)')).toBeInTheDocument()
    expect(getCatalogValue('Performance Investment Bonus (Policy Years 7-10)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge (Non-payment)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 5.10 as a supported catalog product with accumulation-account policy charges', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('split SGD / MIP 10 death-benefit-option variants')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate during the first policy year')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Policy Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus (Policy Year 10)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 5.10 advanced-death as a supported catalog product with Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate during the first policy year')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 3.12 as a supported catalog product with split policy-charge windows and loyalty bonus', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('2.45% policy charge during the minimum investment period')
    expect(seededAlert?.textContent).toContain('0.60% policy charge thereafter')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate during the first policy year')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValues('Policy Charge').length).toBeGreaterThan(0)
    expect(getCatalogValue('Premium Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus (Policy Year 12)')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi-Link 3.12 advanced-death as a supported catalog product with Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate during the first policy year')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Builder@Future as a supported catalog product with split premium-bonus windows', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Builder@Future')

    expect(within(dialog).getByText('Wealth Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Wealth Builder@Future (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('split SGD / MIP 10 death-benefit-option corridors')
    expect(seededAlert?.textContent).toContain('2.50% policy charge during the minimum investment period')
    expect(seededAlert?.textContent).toContain('0.60% policy charge thereafter')
    expect(seededAlert?.textContent).toContain('published SGD 50 minimum payout threshold and 30-day record-date lead time')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValues('Policy Charge').length).toBeGreaterThan(0)
    expect(getCatalogValue('Premium Bonus (Policy Years 6-20)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Bonus (After Policy Year 20)')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Builder@Future advanced-death as a supported catalog product with Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Builder@Future advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Builder@Future')

    expect(within(dialog).getByText('Wealth Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Wealth Builder@Future (SGD / MIP 10 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Builder@Future basic-death as a supported catalog product with the same charge frame and lower initial bonus bands', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy-charge schedules')
    expect(seededAlert?.textContent).toContain('published SGD 50 minimum payout threshold and 30-day record-date lead time')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValues('Policy Charge').length).toBeGreaterThan(0)
    expect(getCatalogValue('Premium Bonus (Policy Years 6-20)')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Builder@Future advanced-death as a supported catalog product with Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Builder@Future advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Builder@Future')

    expect(within(dialog).getByText('Harvest Builder@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Harvest Builder@Future (SGD / MIP 10 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi advanced-death as a supported catalog product with Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Wealth Flexi advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Flexi')

    const wealthFlexiCard = within(dialog).getByText('Wealth Flexi').closest('.rounded-lg') as HTMLElement | null
    expect(wealthFlexiCard).not.toBeNull()
    await user.click(within(wealthFlexiCard!).getByRole('button', { name: /sgd \/ mip 10 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Wealth Flexi (SGD / MIP 10 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goLuxe advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('#goLuxe is cataloged as a supported V1 product')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goLuxe basic-death as a supported catalog product with metadata-only protection charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goLuxe')

    expect(within(dialog).getByText('#goLuxe')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('#goLuxe (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('This partial template models the SGD / minimum-contribution-period-15 (Basic Death) corridor only.')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Recurring Single Premium Charge')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Monthly Protection Charge')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAffluence as a supported catalog product with modeled initial and policy charge rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAffluence')

    expect(within(dialog).getByText('#goAffluence')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('#goAffluence (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate before age 75')
    expect(getCatalogValue('Initial Charge')).toBeInTheDocument()
    expect(getCatalogValues('Policy Charge')).toHaveLength(2)
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAffluence advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate before age 75')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAffluence advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAffluence')

    expect(within(dialog).getByText('#goAffluence')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('#goAffluence (SGD / MIP 15 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate before age 75')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows #goAffluence Accidental Death Benefit Today once current age is filled before age 75 on the advanced-death seeded surface', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAffluence')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death\)/i }))

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText(/^Monthly Contribution \([A-Z]{3}\)$/i))
    await user.type(screen.getByLabelText(/^Monthly Contribution \([A-Z]{3}\)$/i), '2500')
    await user.clear(screen.getByLabelText(/^Current Policy Year$/i))
    await user.type(screen.getByLabelText(/^Current Policy Year$/i), '4')
    await user.clear(screen.getByLabelText(/^Months Already Paid$/i))
    await user.type(screen.getByLabelText(/^Months Already Paid$/i), '48')
    await user.clear(screen.getByLabelText(/^Age Next Birthday$/i))
    await user.type(screen.getByLabelText(/^Age Next Birthday$/i), '45')
    await user.clear(screen.getByLabelText(/^Current Net Regular Premium Base \([A-Z]{3}\)$/i))
    await user.type(screen.getByLabelText(/^Current Net Regular Premium Base \([A-Z]{3}\)$/i), '50000')
    const currentValueInputs = screen.getAllByLabelText(/^Current Value \(SGD\)$/i)
    await user.clear(currentValueInputs[0]!)
    await user.type(currentValueInputs[0]!, '20000')
    await user.clear(currentValueInputs[1]!)
    await user.type(currentValueInputs[1]!, '20000')
    await user.clear(currentValueInputs[2]!)
    await user.type(currentValueInputs[2]!, '5000')

    const updatedPolicy = useIlpStore.getState().policies.find((entry) => entry.id === useIlpStore.getState().selectedPolicyId)
    if (!updatedPolicy) throw new Error('Expected updated #goElite policy after current-state edits')

    expect(analyzeIlpPolicy(updatedPolicy).summary.currentAccidentalDeathBenefitEstimate).toBe(137_000)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Affluence@Future as a supported catalog product with capped initial and deferred policy charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Affluence@Future')

    expect(within(dialog).getByText('Affluence@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Affluence@Future (SGD / MIP 15)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(getCatalogValue('Initial Charge')).toBeInTheDocument()
    expect(getCatalogValues('Policy Charge').length).toBeGreaterThan(0)
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Affluence@Future advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
    expect(screen.getByText('Life Assured Mode')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Affluence@Future advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Affluence@Future')

    expect(within(dialog).getByText('Affluence@Future')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Affluence@Future (SGD / MIP 15 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
    expect(screen.getByText('Life Assured Mode')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goAssure as a supported catalog product with modeled charge surfaces and current death / TI / TPD inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAssure')

    expect(within(dialog).getByText('#goAssure')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('#goAssure (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate before and after Protection Age')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap')
    expect(seededAlert?.textContent).toContain('current TPD benefit estimate before Protection Age')
    expect(seededAlert?.textContent).toContain('policy-year-1-to-4 Initial Bonus corridor via manual initial basic sum assured at issue bands')
    expect(seededAlert?.textContent?.toLowerCase()).toContain('guaranteed extra protection')
    expect(seededAlert?.textContent).toContain('distribution-mode assumption support')
    expect(getCatalogValue('Initial Charge')).toBeInTheDocument()
    expect(getCatalogValue('Initial Bonus (Policy Year 1)')).toBeInTheDocument()
    expect(getCatalogValue('Initial Bonus (Policy Year 4)')).toBeInTheDocument()
    expect(getCatalogValue('Policy Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByLabelText('Initial Basic Sum Assured At Issue (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Protection Age')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Basic Sum Assured (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows #goAssure TI Benefit Today once the remaining aggregate TI cap is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAssure')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(await screen.findByText('Seeded from catalog template')).toBeInTheDocument()
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded #goAssure policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          ...policy.assuranceProfile,
          currentAgeNextBirthday: 45,
          sex: policy.assuranceProfile?.sex ?? 'male',
          smokerStatus: policy.assuranceProfile?.smokerStatus ?? 'non-smoker',
          currentProtectionAge: 65,
          currentAmountOwing: 5_000,
        },
        claimProfile: {
          ...policy.claimProfile,
          remainingAggregateTiCap: 60_000,
        },
      })
    })

    expect((await screen.findAllByText('TI Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows #goAssure admitted TI claim inputs including the residual death amount after TI', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAssure')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded #goAssure policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          ...policy.assuranceProfile,
          currentAgeNextBirthday: 45,
          sex: policy.assuranceProfile?.sex ?? 'male',
          smokerStatus: policy.assuranceProfile?.smokerStatus ?? 'non-smoker',
          currentProtectionAge: 65,
          currentAmountOwing: 5_000,
        },
        claimProfile: {
          ...policy.claimProfile,
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows #goAssure TPD Benefit Today once the current TPD acceleration ratio and remaining aggregate TPD cap are filled before Protection Age', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goAssure')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(await screen.findByText('Seeded from catalog template')).toBeInTheDocument()
    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded #goAssure policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          ...policy.assuranceProfile,
          currentAgeNextBirthday: 45,
          sex: policy.assuranceProfile?.sex ?? 'male',
          smokerStatus: policy.assuranceProfile?.smokerStatus ?? 'non-smoker',
          currentProtectionAge: 65,
          currentAmountOwing: 5_000,
          currentTpdAccelerationRatio: 0.5,
        },
        claimProfile: {
          ...policy.claimProfile,
          remainingAggregateTpdCap: 60_000,
        },
      })
    })

    expect((await screen.findAllByText('TPD Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('#goWealth Enrich cash seeds modeled establishment and withdrawal charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goWealth Enrich')

    expect(within(dialog).getByText('#goWealth Enrich')).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }),
    )

    expect(screen.getAllByText('#goWealth Enrich (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('establishment charge')
    expect(seededAlert?.textContent).toContain('first-three-policy-years single-premium partial-withdrawal charge schedule')
    expect(seededAlert?.textContent).toContain('0.22% annual loyalty bonus')
    expect(seededAlert?.textContent).toContain('105% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing')
    expect(seededAlert?.textContent).toContain('120% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing')
    expect(seededAlert?.textContent).toContain('non-resident 101% death-benefit corridor, accidental-death claim gates and cap aggregation, principal-floor handling, and fund-level charges remain informational only')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
    expect(screen.getByText(/current amount owing before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()
    expect(getCatalogValue('Establishment Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows #goWealth Enrich Accidental Death Benefit Today once current age and current amount owing are filled before age 75', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goWealth Enrich')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText(/^Current Policy Year$/i))
    await user.type(screen.getByLabelText(/^Current Policy Year$/i), '4')
    await user.clear(screen.getByLabelText(/^Months Already Paid$/i))
    await user.type(screen.getByLabelText(/^Months Already Paid$/i), '48')
    await user.clear(screen.getByLabelText(/^Age Next Birthday$/i))
    await user.type(screen.getByLabelText(/^Age Next Birthday$/i), '45')
    await user.clear(screen.getByLabelText(/current amount owing/i))
    await user.type(screen.getByLabelText(/current amount owing/i), '3000')
    const currentValueInputs = screen.getAllByLabelText(/^Current Value \(SGD\)$/i)
    await user.clear(currentValueInputs[0]!)
    await user.type(currentValueInputs[0]!, '120000')
    await user.clear(currentValueInputs[1]!)
    await user.type(currentValueInputs[1]!, '8000')

    expect((await screen.findAllByText('Accidental Death Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('#goElite cash seeds modeled establishment charges with current death-benefit support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goElite')

    const goEliteCard = within(dialog).getByText('#goElite').closest('.rounded-lg') as HTMLElement | null
    expect(goEliteCard).not.toBeNull()
    await user.click(
      within(goEliteCard!).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }),
    )
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('#goElite (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('resident-corridor current-state death benefit as 105% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing')
    expect(seededAlert?.textContent).toContain('resident-corridor current accidental-death estimate before age 75 as 110% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing')
    expect(seededAlert?.textContent).toContain('non-resident 101% death-benefit corridor, accidental-death claim gates and cap aggregation, multi-life last-survivor handling, and fund-level charges remain informational only')
    expect(seededAlert?.textContent).toContain('5% recurring-single-premium and top-up charge path')
    expect(seededAlert?.textContent).toContain('nil partial-withdrawal charge')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
    expect(screen.getByText(/current amount owing before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()
    expect(getCatalogValue('Establishment Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows #goElite Accidental Death Benefit Today once current age and current amount owing are filled before age 75', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goElite')

    const goEliteCard = within(dialog).getByText('#goElite').closest('.rounded-lg') as HTMLElement | null
    expect(goEliteCard).not.toBeNull()
    await user.click(
      within(goEliteCard!).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }),
    )
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded #goElite policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: account.id === 'policy'
            ? 120_000
            : account.id === 'topup'
              ? 8_000
              : account.currentValue,
        })),
        assuranceProfile: {
          ...(policy.assuranceProfile ?? {}),
          currentAgeNextBirthday: 45,
          currentAmountOwing: 3_000,
        },
        claimProfile: {
          ...(policy.claimProfile ?? {}),
          currentTokioAccidentalDeathClaimGateStatus: 'published-corridor-satisfied',
          remainingAggregateAccidentalDeathCap: 1_000_000,
        },
      })
    })

    const updatedPolicy = useIlpStore.getState().policies.find((entry) => entry.id === useIlpStore.getState().selectedPolicyId)
    if (!updatedPolicy) throw new Error('Expected updated #goElite policy after current-state edits')

    expect(analyzeIlpPolicy(updatedPolicy).summary.currentAccidentalDeathBenefitEstimate).toBe(137_000)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('#goElite Secure cash seeds locked-in-value and adjusted-single-premium MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goElite Secure')

    expect(within(dialog).getByText('#goElite Secure')).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }),
    )
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('#goElite Secure (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('death-benefit floor logic')
    expect(seededAlert?.textContent).toContain('Adjusted Single Premium')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/current locked-in policy value/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current adjusted single premium/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds TM Wealth Enhancer (CPFIS) as a supported catalog product with zero-charge CPF top-up routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Enhancer')

    expect(within(dialog).getByText('TM Wealth Enhancer (CPFIS)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('TM Wealth Enhancer (CPFIS)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('zero-charge single-premium, ad-hoc top-up, regular top-up, and nil-charge withdrawal path')
    expect(seededAlert?.textContent).toContain('current ordinary death-benefit estimate as 105% of the single premium policy value and 100% of the top-up premium policy value')
    expect(seededAlert?.textContent).toContain('switching administration')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Single Premium Charge (CPF)')).toBeInTheDocument()
    expect(getCatalogValue('Ad-Hoc Top-up Premium Charge (CPF)')).toBeInTheDocument()
    expect(getCatalogValue('Regular Top-up Premium Charge (CPF)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds WealthLink (GL3) as a supported catalog product with open-ended single-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'WealthLink')

    expect(within(dialog).getByText('WealthLink (GL3)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('WealthLink (GL3) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published 3.5% upfront single-premium charge')
    expect(seededAlert?.textContent).toContain('current ordinary death-benefit estimate as 105% or 101% of net premiums paid')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate as the published 105%-of-net-premiums corridor during the age-66-to-74 accident window')
    expect(seededAlert?.textContent).toContain('no policy fee and no insurance cover charge')
    expect(seededAlert?.textContent).toContain('no-MIP basis')
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows WealthLink (GL3) Accidental Death Benefit Today in the age-66-to-74 accident window', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'WealthLink')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded WealthLink (GL3) policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        initialSinglePremium: 100_000,
        assuranceProfile: {
          currentAgeNextBirthday: 66,
          currentDeathBenefitRateTier: 'net-premium-101',
          sex: 'male',
          smokerStatus: 'non-smoker',
        },
      })
    })

    expect((await screen.findAllByText('Accidental Death Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage (SP) as a supported catalog product with open-ended single-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (SP)')

    expect(within(dialog).getByText('GREAT Invest Advantage (SP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('GREAT Invest Advantage (SP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('upfront initial single-premium charge')
    expect(seededAlert?.textContent).toContain('published explicit selected-fund partial-surrender floor')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 110% of single premium plus top-ups less partial surrenders or account value less manual current amount owing')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
    expect(getCatalogValue('Initial Single Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage (RSP) as a supported catalog product with open-ended recurrent-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (RSP)')

    expect(within(dialog).getByText('GREAT Invest Advantage (RSP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('GREAT Invest Advantage (RSP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published recurrent-premium charge path')
    expect(seededAlert?.textContent).toContain('published explicit selected-fund partial-surrender floor')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 110% of recurrent single premiums plus top-ups less partial surrenders or account value less manual current amount owing')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
    expect(getCatalogValue('Recurring Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRULink InvestGrowth (SP) cash as a supported catalog product with direct-income support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRULink InvestGrowth (SP)')

    expect(within(dialog).getByText('PRULink InvestGrowth (SP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('PRULink InvestGrowth (SP) (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published initial single-premium charge')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of policy value or 110% of total premiums plus top-ups less withdrawals')
    expect(seededAlert?.textContent).toContain('Direct Income support through the manual distribution-mode kernel')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Initial Single Premium Charge (Cash)')).toBeInTheDocument()
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
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of policy value or 110% of total premiums plus top-ups less withdrawals')
    expect(seededAlert?.textContent).toContain('minimum-premium schedule enforcement')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Recurring Premium Charge (Cash)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Invest Easy (Cash/SRS) as a supported catalog product with recurring top-up charges', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Invest Easy (Cash/SRS)')

    expect(within(dialog).getByText('AIA Invest Easy (Cash/SRS)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Invest Easy (Cash/SRS) (SGD / Open-ended (Cash Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('AIA Invest Easy (Cash/SRS) is cataloged as a supported V1 product.')
    expect(seededAlert?.textContent).toContain('published 3% single-premium, ad-hoc top-up, and regular top-up premium charges')
    expect(seededAlert?.textContent).toContain('models the current-state death benefit as 100% of policy value plus the current first-year accidental-death estimate')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Regular Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Invest Easy (CPF) as a supported catalog product with zero-charge recurring top-up routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Invest Easy (CPF)')

    expect(within(dialog).getByText('AIA Invest Easy (CPF)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Invest Easy (CPF) (SGD / Open-ended (Cpf))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('AIA Invest Easy (CPF) is cataloged as a supported V1 product.')
    expect(seededAlert?.textContent).toContain('published zero-charge single-premium, ad-hoc top-up, and regular top-up allocation path')
    expect(seededAlert?.textContent).toContain('models the current-state death benefit as 100% of policy value plus the current first-year accidental-death estimate')
    expect(seededAlert?.textContent).toContain('Fund access is limited to CPFIS-eligible ILP sub-funds')
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Regular Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Invest Easy (Cash/SRS) Accidental Death Benefit Today during the first policy year', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Invest Easy (Cash/SRS)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash srs\)use template$/i }))
    await confirmSeededPolicy(user)

    await user.clear(screen.getByLabelText(/^Current Policy Year$/i))
    await user.type(screen.getByLabelText(/^Current Policy Year$/i), '1')
    await user.clear(screen.getByLabelText(/^Months Already Paid$/i))
    await user.type(screen.getByLabelText(/^Months Already Paid$/i), '6')
    await user.clear(screen.getByLabelText(/^Initial Single Premium \(Gross Lump Sum, /i))
    await user.type(screen.getByLabelText(/^Initial Single Premium \(Gross Lump Sum, /i), '50000')
    await user.clear(screen.getByLabelText(/^Current Value \(SGD\)$/i))
    await user.type(screen.getByLabelText(/^Current Value \(SGD\)$/i), '40000')

    expect((await screen.findAllByText('Accidental Death Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Invest Easy (CPF) Accidental Death Benefit Today during the first policy year', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Invest Easy (CPF)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use template$/i }))
    await confirmSeededPolicy(user)

    await user.clear(screen.getByLabelText(/^Current Policy Year$/i))
    await user.type(screen.getByLabelText(/^Current Policy Year$/i), '1')
    await user.clear(screen.getByLabelText(/^Months Already Paid$/i))
    await user.type(screen.getByLabelText(/^Months Already Paid$/i), '6')
    await user.clear(screen.getByLabelText(/^Initial Single Premium \(Gross Lump Sum, /i))
    await user.type(screen.getByLabelText(/^Initial Single Premium \(Gross Lump Sum, /i), '50000')
    await user.clear(screen.getByLabelText(/^Current Value \(SGD\)$/i))
    await user.type(screen.getByLabelText(/^Current Value \(SGD\)$/i), '40000')

    expect((await screen.findAllByText('Accidental Death Benefit Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds SNACK-Investment as a supported catalog product with reinvest-only distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'SNACK-Investment')

    expect(within(dialog).getByText('SNACK-Investment')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('SNACK-Investment (SGD / Open-ended)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state ordinary death benefit as cash-in value')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate before age 75 as the higher of cash-in value or 105% of net premium')
    expect(seededAlert?.textContent).toContain('does not support cash payouts')
    expect(seededAlert?.textContent).toContain('zero-charge initial premium, top-up, and no-penalty withdrawal path')
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows SNACK-Investment Accidental Death Benefit Today before age 75', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'SNACK-Investment')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded SNACK-Investment policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 2,
        monthsAlreadyPaid: 18,
        initialSinglePremium: 100_000,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tiq Invest as a supported catalog product with zero-charge recurring top-up routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Tiq Invest')

    expect(within(dialog).getByText('Tiq Invest')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Tiq Invest (SGD / Open-ended)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('0.75% annual management charge')
    expect(seededAlert?.textContent).toContain('There is no insurance charge imposed on this policy')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of account value or the 105%-of-premiums floor')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('gross initial single premium as an inception seed')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Management Charge Fee')).toBeInTheDocument()
    expect(getCatalogValue('Recurring Top-up Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Tiq Invest TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Tiq Invest')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Tiq Invest policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows admitted-state TI claim amount and residual death inputs for Tiq Invest', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Tiq Invest')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Tiq Invest policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Dash PET Plus as a supported rider product with reinvest-default distribution support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Dash PET Plus')

    expect(within(dialog).getByText('Dash PET Plus')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(rider\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Dash PET Plus (SGD / Open-ended (Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('zero-charge rider subscription')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of rider account value or the 105%-of-paid-premiums floor after rider withdrawals and current amounts owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(seededAlert?.textContent).toContain('open-ended rider product uses the no-MIP basis')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Management Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Dash PET Plus TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Dash PET Plus')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(rider\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Dash PET Plus policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest smart flex II TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'smart flex II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest smart flex II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows admitted-state TI claim amount and residual death inputs for Invest smart flex II', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'smart flex II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest smart flex II policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest smart flex II with Premium-Free-Period shortfall charge and refund support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'smart flex II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Premium-Free-Period-gated premium shortfall charge and full-repayment refund/reset corridor')
    expect(seededAlert?.textContent).toContain('Up to 60 months of Premium-Free Period may be accumulated across the 10-year premium payment term.')
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest flex wealth II TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex wealth II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest flex wealth II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 12_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest flex wealth II with Premium-Free-Period shortfall charge and refund support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex wealth II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Premium-Free-Period-gated premium shortfall charge and full-repayment refund/reset corridor')
    expect(seededAlert?.textContent).toContain('Up to 60 months of Premium-Free Period may be accumulated across the 10-year premium payment term.')
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest Goal 1 SGD as a supported catalog product with original-base plan charges and current death-benefit support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest Goal 1')

    expect(within(dialog).getByText('FWD Invest Goal 1')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-endeduse template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('FWD Invest Goal 1 (SGD / Open-ended)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death benefit as 105% of policy value')
    expect(seededAlert?.textContent).toContain('published SGD 500 per-transaction minimum')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(seededAlert?.textContent).toContain('10%-of-committed-initial-single-premium minimum remaining-value floor')
    expect(seededAlert?.textContent).toContain('multi-life last-survivor handling, principal-tracking, and broader operational mechanics remain outside the current engine')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Plan Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulink Investor (II) cash as a supported catalog product with reinvest-default distribution support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulink Investor (II)')

    expect(within(dialog).getByText('Manulink Investor (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Manulink Investor (II) (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published 3% single-premium and top-up charge path')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of account value or 1% of single premium, top-up premium, and recurring single premium paid less withdrawals')
    expect(seededAlert?.textContent).toContain('current terminal-illness benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TI cap')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Charge (Cash)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (Cash)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulink Investor (II) TI Benefit Today and residual death after TI once the remaining aggregate TI cap is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulink Investor (II)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulink Investor (II) policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          remainingAggregateTiCap: 800_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest plus SP as a supported catalog product with initial single-premium corridor warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest plus SP')

    expect(within(dialog).getByText('Invest plus SP')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(single premium initial only\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Invest plus SP (SGD / Open-ended (Single Premium Initial Only))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('initial single-premium corridor only')
    expect(seededAlert?.textContent).toContain('current ordinary death-benefit estimate as the higher of account value or 101% of net premium')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('current-due Power-up Bonus crediting through manual initial-account and top-up-account amounts plus status')
    expect(seededAlert?.textContent).toContain('future recurring Initial Account Power-up Bonus')
    expect(seededAlert?.textContent).toContain('future recurring Top-up Account Power-up Bonus for new projection-start top-ups')
    expect(seededAlert?.textContent).toContain('gross initial single premium as an inception seed')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Policy Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest plus SP current Power-up Bonus inputs once a three-year bonus cycle has been completed', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest plus SP')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(single premium initial only\)use template$/i }))
    await confirmSeededPolicy(user)
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest plus SP policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        claimProfile: {
          currentInvestPlusSpPowerUpBonusStatus: 'due-and-uncredited',
        },
      })
    })

    expect(screen.getByText('Current Power-up Bonus Status')).toBeInTheDocument()
    expect(screen.getByLabelText(/current due initial-account power-up bonus/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current due top-up-account power-up bonus/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/observed initial-account monthly average in current 3-year power-up bonus block/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/representative management charge \(annual rate for future new top-up power-up bonus qualification\)/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulife SmartRetire (V) - Income as a supported catalog product with payout-state and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Income')

    expect(within(dialog).getByText('Manulife SmartRetire (V) - Income')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Manulife SmartRetire (V) - Income (SGD / MIP 8 (Flexi 3))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('scheduled retirement-income capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('premium-shortfall charge before Flexi Start')
    expect(seededAlert?.textContent).toContain('death-benefit COI table')
    expect(seededAlert?.textContent).toContain('WOP-on-TPD COI table before Flexi Start')
    expect(seededAlert?.textContent).toContain('target-retirement-age COI refund path both before and after target retirement age')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(getCatalogValue('Cost of Insurance (Death Benefit)')).toBeInTheDocument()
    expect(getCatalogValue('Cost of Insurance (WOP on TPD)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulife SmartRetire (V) - Sum as a supported catalog product with withdrawal and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Sum')

    expect(within(dialog).getByText('Manulife SmartRetire (V) - Sum')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Manulife SmartRetire (V) - Sum (SGD / MIP 8 (Flexi 3))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('premium-shortfall charge before Flexi Start')
    expect(seededAlert?.textContent).toContain('death-benefit COI table')
    expect(seededAlert?.textContent).toContain('WOP-on-TPD COI table before Flexi Start')
    expect(seededAlert?.textContent).toContain('target-retirement-age COI refund path both before and after target retirement age')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(seededAlert?.textContent).toContain('retirement-sum withdrawal handling')
    expect(seededAlert?.textContent).toContain('optional drawdown elections')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Cost of Insurance (Death Benefit)')).toBeInTheDocument()
    expect(getCatalogValue('Cost of Insurance (WOP on TPD)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife SmartRetire (V) - Income COI refund inputs once the seeded policy is past MIP and before target retirement age', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Income')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByLabelText(/current refund-eligible death coi collected/i)).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Income policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 9,
        monthsAlreadyPaid: 108,
        assuranceProfile: {
          currentAgeNextBirthday: 55,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 50_000,
          targetRetirementAge: 65,
          currentAmountOwing: 5_000,
        },
      })
    })

    expect(screen.getByLabelText(/current refund-eligible death coi collected/i)).toBeInTheDocument()
    expect(screen.getAllByText(/current smartretire death-coi refund gate/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/current refund-eligible death COI collected before the SmartRetire COI refund handling can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/current SmartRetire refund-gate status before the SmartRetire COI refund handling can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Income policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentRefundEligibleDeathCoiCollected: 1_250,
          currentClaimHistory: {
            refundGateStatus: 'intact',
          },
        },
      })
    })

    expect(screen.queryByText(/current refund-eligible death COI collected before the SmartRetire COI refund handling can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/current SmartRetire refund-gate status before the SmartRetire COI refund handling can be trusted/i)).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife SmartRetire (V) - Sum COI refund inputs once the seeded policy is past MIP and before target retirement age', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Sum')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByLabelText(/current refund-eligible death coi collected/i)).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Sum policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 9,
        monthsAlreadyPaid: 108,
        assuranceProfile: {
          currentAgeNextBirthday: 55,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 50_000,
          targetRetirementAge: 65,
          currentAmountOwing: 5_000,
        },
      })
    })

    expect(screen.getByLabelText(/current refund-eligible death coi collected/i)).toBeInTheDocument()
    expect(screen.getAllByText(/current smartretire death-coi refund gate/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/current refund-eligible death COI collected before the SmartRetire COI refund handling can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/current SmartRetire refund-gate status before the SmartRetire COI refund handling can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Sum policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentRefundEligibleDeathCoiCollected: 1_250,
          currentClaimHistory: {
            refundGateStatus: 'intact',
          },
        },
      })
    })

    expect(screen.queryByText(/current refund-eligible death COI collected before the SmartRetire COI refund handling can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/current SmartRetire refund-gate status before the SmartRetire COI refund handling can be trusted/i)).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife SmartRetire (V) - Income WOP claim-state input before Flexi Start without the later refund inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Income')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Income policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          targetRetirementAge: 65,
        },
      })
    })

    expect(screen.queryByLabelText(/current refund-eligible death coi collected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/current smartretire death-coi refund gate/i)).not.toBeInTheDocument()
    expect(screen.getByText(/current SmartRetire claim family before the broader SmartRetire claim-history handling can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Income policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentClaimHistory: {
            family: 'tpd-waiver',
            admissionStatus: 'admitted',
          },
        },
      })
    })

    expect(screen.getAllByText(/current smartretire claim admission status/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/current remaining wop premium-waiver runway \(months\)/i)).toBeInTheDocument()
    expect(screen.getByText(/current remaining WOP premium-waiver runway before the SmartRetire WOP handling can be trusted/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife SmartRetire (V) - Income past-due COI refund status input once target retirement age has already been reached', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife SmartRetire (V) - Income')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife SmartRetire (V) - Income policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 9,
        monthsAlreadyPaid: 108,
        assuranceProfile: {
          currentAgeNextBirthday: 65,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 50_000,
          targetRetirementAge: 65,
          currentAmountOwing: 5_000,
        },
      })
    })

    expect(screen.getByLabelText(/current refund-eligible death coi collected/i)).toBeInTheDocument()
    expect(screen.getAllByText(/current smartretire death-coi refund gate/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/current death-coi refund status/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/current death-COI refund status once target retirement age has already been reached/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest Flexi VII as a supported catalog product with repayment-base assurance input exposure', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest Flexi VII')

    expect(within(dialog).getByText('FWD Invest Flexi VII')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('FWD Invest Flexi VII (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state ordinary death benefit as the higher of 105% of policy value or the 101% protected premium-and-repayment base')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published S$2 million per-life limit')
    expect(seededAlert?.textContent).toContain('fixed-premium-base initial-account charge')
    expect(seededAlert?.textContent).toContain('Premium Pause Waiver')
    expect(seededAlert?.textContent).toContain('Appendix B insurance charge')
    expect(seededAlert?.textContent).toContain('repayment-allocation waterfalls')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Net Repayment Base (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Redemption Fee')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows FWD Invest Flexi VII TI Benefit Today once the remaining aggregate TI cap is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest Flexi VII')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded FWD Invest Flexi VII policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 46,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 60_000,
          currentNetSupplementaryPremiumBase: 20_000,
          currentNetRepaymentBase: 40_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 100_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest Flexi Elite as a supported catalog product with its manual assurance inputs exposed', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest Flexi Elite')

    expect(within(dialog).getByText('FWD Invest Flexi Elite')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('FWD Invest Flexi Elite (SGD / MIP 10 (Flexi 3))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state ordinary death benefit as the higher of 105% of policy value or 101% of the protected premium base')
    expect(seededAlert?.textContent).toContain('initial-account-value charge')
    expect(seededAlert?.textContent).toContain('charge-waiver and retrospective charge-refund support on premium-holiday events')
    expect(seededAlert?.textContent).toContain('Free Partial Withdrawal Benefit capped charge-waiver support on qualifying partial-withdrawal events')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Net Regular Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Net RSP + Top-up Base (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Redemption Fee')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest First Horizon as a supported catalog product with repayment-base assurance input exposure', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest First Horizon')

    expect(within(dialog).getByText('FWD Invest First Horizon')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 20use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('FWD Invest First Horizon (SGD / MIP 20)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state ordinary death benefit as the higher of 105% of policy value or the 101% protected premium-and-repayment base')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published S$2 million per-life limit')
    expect(seededAlert?.textContent).toContain('Loyalty Bonus including the post-premium-payment-term no-initial-account-withdrawal corridor')
    expect(seededAlert?.textContent).toContain('fixed-premium-base initial-account charge')
    expect(seededAlert?.textContent).toContain('Premium Pause Waiver')
    expect(seededAlert?.textContent).toContain('premium-reduction charge schedule')
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Net Repayment Base (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Reduction Charge')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Redemption Fee')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows FWD Invest First Horizon Death Benefit Today and TI Benefit Today once the current support inputs are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'FWD Invest First Horizon')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 20use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded FWD Invest First Horizon policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 46,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 60_000,
          currentNetSupplementaryPremiumBase: 20_000,
          currentNetRepaymentBase: 40_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 100_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AstraLink (VA2) as a supported catalog product with allocation-uplift and distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AstraLink (VA2)')

    expect(within(dialog).getByText('AstraLink (VA2)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AstraLink (VA2) (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death / terminal-illness / TPD estimates as the higher of current applicable basic benefit or policy value')
    expect(seededAlert?.textContent).toContain('TPD capped by a manual remaining aggregate TPD cap')
    expect(seededAlert?.textContent).toContain('current accidental-death estimate as the current death corridor plus a manual accidental-claim-mode uplift on current applicable basic benefit before age 70')
    expect(seededAlert?.textContent).toContain('current accidental-TPD estimate as the current TPD corridor plus that same manual accidental-claim-mode uplift before age 70')
    expect(seededAlert?.textContent).toContain('105% post-MIP regular-premium allocation uplift')
    expect(seededAlert?.textContent).toContain('reinvest-only distribution mode')
    expect(seededAlert?.textContent).toContain('monthly insurance cover charge')
    expect(seededAlert?.textContent).toContain('No Lapse Guarantee debt carry')
    expect(screen.getByLabelText('Current Basic Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current Accidental Claim Mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TPD Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AstraLink (VA2) Accidental Death Benefit Today once current applicable basic benefit and accidental-claim mode are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AstraLink (VA2)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AstraLink (VA2) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 35_000,
        },
        claimProfile: {
          currentAccidentalDeathMode: 'standard-accident',
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AstraLink (VA2) TI Benefit Today once current applicable basic benefit is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AstraLink (VA2)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AstraLink (VA2) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 35_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AstraLink (VA2) TPD Benefit Today once current applicable basic benefit and remaining aggregate TPD cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AstraLink (VA2)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AstraLink (VA2) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 35_000,
        },
        claimProfile: {
          remainingAggregateTpdCap: 30_000,
        },
      })
    })

    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AstraLink (VA2) Accidental TPD Benefit Today once current applicable basic benefit, accident mode, and remaining aggregate TPD cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AstraLink (VA2)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AstraLink (VA2) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 35_000,
        },
        claimProfile: {
          currentAccidentalDeathMode: 'standard-accident',
          remainingAggregateTpdCap: 80_000,
        },
      })
    })

    expect(screen.getAllByText('Accidental TPD Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Wealth Venture 2.0 as a supported catalog product with supplementary-charge and benefit-charge warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Venture 2.0')

    expect(within(dialog).getByText('AIA Platinum Wealth Venture 2.0')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Platinum Wealth Venture 2.0 (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('AIA Platinum Wealth Venture 2.0 is cataloged as a supported V1 product for the regular-pay 5-year corridor.')
    expect(seededAlert?.textContent).toContain('Welcome Bonus tiers for premium years 1 to 3')
    expect(seededAlert?.textContent).toContain('Investment Bonus milestones at policy years 8 to 11')
    expect(seededAlert?.textContent).toContain('annual Performance Bonus from policy year 8 onward')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of policy value or total regular premiums paid plus top-up premiums less withdrawals')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years')
    expect(seededAlert?.textContent).toContain('3.60% p.a. regular-premium supplementary charge')
    expect(seededAlert?.textContent).toContain('published Appendix A Benefit Charge corridor')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule with full-outstanding-premium repayment resumption')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Supplementary Charge')).toBeInTheDocument()
    expect(getCatalogValue('Benefit Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-Up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Wealth Venture 2.0 Accidental Death Benefit Today once current net protected premium base is filled during the first 2 policy years', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Venture 2.0')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Legacy Flex Solitaire (VA3S / VA3R) as a supported catalog product with premium-holiday and retirement warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Legacy Flex Solitaire')

    expect(within(dialog).getByText('Legacy Flex Solitaire (VA3S / VA3R)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Legacy Flex Solitaire (VA3S / VA3R) (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('premium-year regular premium charge schedule')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit estimate as the higher of adjusted sum assured or policy value via a manual current adjusted sum assured input')
    expect(seededAlert?.textContent).toContain('published Loyalty Bonus rate with the supported partial-withdrawal suspension subset')
    expect(seededAlert?.textContent).toContain('reinvest-only distribution baseline')
    expect(seededAlert?.textContent).toContain('automatic adjusted-sum-assured updates')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Adjusted Sum Assured (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Legacy Flex Solitaire TI Benefit Today once current adjusted sum assured is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Legacy Flex Solitaire')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Legacy Flex Solitaire policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 100_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Legacy Flex Solitaire admitted TI claim inputs without asking for a residual death amount', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Legacy Flex Solitaire')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Legacy Flex Solitaire policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 100_000,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('hides Legacy Flex Solitaire TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Legacy Flex Solitaire')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)
    await screen.findByText('Seeded from catalog template')

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Legacy Flex Solitaire policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 100_000,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulife InvestReady Growth as a supported catalog product with COI and shortfall warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady Growth')

    expect(within(dialog).getByText('Manulife InvestReady Growth')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15 \(flexi 10\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Manulife InvestReady Growth (SGD / MIP 15 (Flexi 10))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published Welcome Bonus tiers')
    expect(seededAlert?.textContent).toContain('published Premium Bonus from Flexi Start with the post-MIP cumulative-withdrawal threshold subset')
    expect(seededAlert?.textContent).toContain('published Loyalty Bonus rate with the partial-withdrawal suspension subset')
    expect(seededAlert?.textContent).toContain('101% paid-premium-floor COI formula')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate net of manually entered current amount owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap')
    expect(seededAlert?.textContent).toContain('premium-shortfall charge before Flexi Start')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(getCatalogValue('Cost of Insurance (Death / TI)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI + CI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI + CI Cap (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Manulife InvestReady (III) as a supported catalog product with administration-charge and COI warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady (III)')

    expect(within(dialog).getAllByText('Manulife InvestReady (III)').length).toBeGreaterThan(0)
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(flexi 4\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Manulife InvestReady (III) (SGD / MIP 5 (Flexi 4))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('2.50% / 1.00% administration-charge path')
    expect(seededAlert?.textContent).toContain('premium-shortfall charge before Flexi Start')
    expect(seededAlert?.textContent).toContain('101% paid-premium-floor COI formula')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate net of manually entered current amount owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap')
    expect(getCatalogValue('Cost of Insurance (Death / TI)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI + CI Cap (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds the long-tenor Manulife InvestReady (III) variant with manual policy-fee support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady (III)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 13 \(flexi 10\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Manulife InvestReady (III) (SGD / MIP 13 (Flexi 10))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('2.50% / 0.70% administration-charge path')
    expect(seededAlert?.textContent).toContain('low-band policy-fee surface through manual annual-fee input')
    expect(seededAlert?.textContent).toContain('Issue-time policy-fee band selection')
    expect(seededAlert?.textContent).toContain('101% paid-premium-floor COI formula')
    expect(getCatalogValue('Cost of Insurance (Death / TI)')).toBeInTheDocument()
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI + CI Cap (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife InvestReady Growth TI Benefit Today and residual death after TI once current amount owing plus both remaining aggregate TI caps are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady Growth')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15 \(flexi 10\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/current claim-time amount owing \/ outstanding charges/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife InvestReady Growth policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 50_000,
          currentNetSupplementaryPremiumBase: 20_000,
          currentAmountOwing: 1_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 60_000,
          remainingAggregateTiCiCap: 80_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for Manulife InvestReady Growth and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady Growth')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 15 \(flexi 10\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife InvestReady Growth policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'triggered',
        },
      })
    })

    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state protected death-cover base input for Wealth Focus (Flexi 3) and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Focus policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'triggered',
        },
      })
    })

    expect(screen.getByLabelText('Current Remaining Protected Death-Cover Base After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
    expect(screen.getByText('This product also needs the current remaining protected death-cover base after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted TI claim amount input for Wealth Focus (Flexi 3) alongside the protected death-cover base input', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Wealth Focus policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 360,
        },
        claimProfile: {
          currentTiClaimStatus: 'triggered',
          remainingAggregateTiCap: 12_000,
          currentTiClaimBenefitAmount: 12_000,
          currentClaimHistory: {
            family: 'ti-advancement',
            remainingProtectedDeathCoverBase: 28_000,
          },
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Remaining Protected Death-Cover Base After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the historical excluded repaid-premium cohort editor for Wealth Focus (Flexi 3)', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 3)')
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current Excluded Repaid-Premium Cohorts')).toBeInTheDocument()
    expect(screen.getByText(/historical repaid-premium balances that should remain excluded from the loyalty bonus base/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add cohort/i })).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife InvestReady (III) TI Benefit Today and residual death after TI once current amount owing plus both remaining aggregate TI caps are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady (III)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(flexi 4\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife InvestReady (III) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 50_000,
          currentNetSupplementaryPremiumBase: 20_000,
          currentAmountOwing: 1_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 60_000,
          remainingAggregateTiCiCap: 80_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Manulife InvestReady (III) Sep-2025 TI Benefit Today and residual death after TI once current amount owing plus both remaining aggregate TI caps are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Manulife InvestReady (III)')

    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(flexi 4 sep 2025\)use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = await screen.findByText('Seeded from catalog template')
    expect(seededAlert.closest('[role="alert"]')?.textContent).toContain('Sep-2025 summary cohort')
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Manulife InvestReady (III) Sep-2025 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 50_000,
          currentNetSupplementaryPremiumBase: 20_000,
          currentAmountOwing: 1_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 60_000,
          remainingAggregateTiCiCap: 80_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Prestige Portfolio as a supported catalog product with manual premium-charge warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prestige Portfolio')

    expect(within(dialog).getByText('Prestige Portfolio')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(single premium cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Prestige Portfolio (SGD / Open-ended (Single Premium Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('quote-driven premium-charge and wrap-fee surfaces through manual input')
    expect(seededAlert?.textContent).toContain('published 0.2% p.a. policy fee')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as total investment value')
    expect(seededAlert?.textContent).toContain('current-state accidental-death estimate as the higher of total investment value or a manual current basic sum assured before age 80 next birthday')
    expect(seededAlert?.textContent).toContain('quote-driven top-up and recurrent-single-premium charge paths through manual input')
    expect(seededAlert?.textContent).toContain('published S$1,000 minimum one-off partial withdrawal amount')
    expect(seededAlert?.textContent).toContain('published S$1,000 selected-fund remaining-value floor')
    expect(getCatalogValue('Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Wrap Fee')).toBeInTheDocument()
    expect(getCatalogValue('Investment Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/Current Basic Sum Assured/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Prestige Portfolio Accidental Death Benefit Today once current basic sum assured is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prestige Portfolio')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(single premium cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    const currentBasicSumAssured = screen.getByLabelText(/Current Basic Sum Assured/i)
    await user.clear(currentBasicSumAssured)
    await user.type(currentBasicSumAssured, '120000')

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Life Advantage 4 as a supported catalog product with premium-holiday refund warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Life Advantage 4')

    expect(within(dialog).getByText('GREAT Life Advantage 4')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(regular pay\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('GREAT Life Advantage 4 (SGD / Open-ended (Regular Pay))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('premium-year regular premium charge schedule')
    expect(seededAlert?.textContent).toContain('premium reward')
    expect(seededAlert?.textContent).toContain('fixed policy fee')
    expect(seededAlert?.textContent).toContain('current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or current basic sum assured plus top-ups less withdrawals including withdrawal charges after current amount owing')
    expect(seededAlert?.textContent).toContain('with TPD capped by a manual remaining aggregate TPD cap')
    expect(seededAlert?.textContent).toContain('first-two-policy-years premium-holiday charge and refund privilege')
    expect(seededAlert?.textContent).toContain('non-lapse guarantee debt carry')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Basic Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Net RSP + Top-up Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TPD Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge Refund')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Top-up Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Life Advantage 4 TI Benefit Today once current basic sum assured and current amount owing are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Life Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(regular pay\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Life Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 20_000,
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Life Advantage 4 TPD Benefit Today once current basic sum assured, current amount owing, and remaining aggregate TPD cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Life Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(regular pay\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Life Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 20_000,
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTpdCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Life Advantage 4 post-TPD continuation benefits once the current Continuation Event status is triggered', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Life Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(regular pay\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Death Benefit After TPD Claim Today')).not.toBeInTheDocument()
    expect(screen.queryByText('TI Benefit After TPD Claim Today')).not.toBeInTheDocument()
    expect(screen.getByText('Current TPD Claim Status')).toBeInTheDocument()
    expect(screen.getByText('Current TPD Continuation Event Status')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Life Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTpdContinuationEventStatus: 'triggered',
        },
      })
    })

    expect((await screen.findAllByText('Death Benefit After TPD Claim Today')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('TI Benefit After TPD Claim Today')).length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state TPD claim amount input for GREAT Life Advantage 4 and requires it before the admitted-state TPD snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Life Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(regular pay\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Current Admitted TPD Claim Benefit Amount (SGD)')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Life Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTpdClaimStatus: 'admitted',
          currentTpdContinuationEventStatus: 'triggered',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TPD Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted TPD claim benefit amount before the admitted-state TPD snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Prestige Legacy Advantage as a supported catalog product with single-premium and non-lapse warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prestige Legacy Advantage')

    expect(within(dialog).getByText('Prestige Legacy Advantage')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(single premium\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Prestige Legacy Advantage (SGD / MIP 5 (Single Premium))').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('initial single-premium charge')
    expect(seededAlert?.textContent).toContain('single-premium top-up charge')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as the higher of current sum assured or account value')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current admitted-state TI payable amount and current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('entry-age-and-basic-sum-assured policy-fee surface through manual input')
    expect(seededAlert?.textContent).toContain('Non-Lapse Privilege')
    expect(screen.getByLabelText('Current Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds ManuInvest Duo as a supported catalog product with protected-base COI warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'ManuInvest Duo')

    expect(within(dialog).getByText('ManuInvest Duo')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('ManuInvest Duo (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('5.00% / 1.00% administration-charge path')
    expect(seededAlert?.textContent).toContain('protected-base death / TI / TPD cost-of-insurance formula')
    expect(seededAlert?.textContent).toContain('current terminal-illness benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TI cap')
    expect(seededAlert?.textContent).toContain('current TPD benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TPD cap')
    expect(seededAlert?.textContent).toContain('current residual death-benefit estimate after a TPD claim today')
    expect(seededAlert?.textContent).toContain('Premium Flexibility Benefit automatically suppressing the first 24 missed months only from policy year 6 onward')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByText('Current TPD Claim Status')).toBeInTheDocument()
    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TPD Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Cost of Insurance (Death / TI / TPD)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows ManuInvest Duo TI Benefit Today once current sum insured and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'ManuInvest Duo')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded ManuInvest Duo policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          ...policy.assuranceProfile,
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 80_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 60_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows ManuInvest Duo TPD Benefit Today once current sum insured and the remaining aggregate TPD cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'ManuInvest Duo')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded ManuInvest Duo policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          ...policy.assuranceProfile,
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 80_000,
        },
        claimProfile: {
          remainingAggregateTpdCap: 50_000,
        },
      })
    })

    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit After TPD Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds PRUActive LinkGuard as a supported catalog product with no-lapse and assurance warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUActive LinkGuard')

    expect(within(dialog).getByText('PRUActive LinkGuard')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('PRUActive LinkGuard (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('fixed S$5 monthly administration charge')
    expect(seededAlert?.textContent).toContain('guaranteed Appendix A Death / TPD / TI assurance charge')
    expect(seededAlert?.textContent).toContain('current-state death / terminal-illness / payable-now TPD estimates')
    expect(seededAlert?.textContent).toContain('3% Investment Booster (Lump Sum) premium charge')
    expect(seededAlert?.textContent).toContain('No Lapse Period debt carry')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current Accelerated TI Payout Mode')).toBeInTheDocument()
    expect(screen.getByText('Current TPD Settlement Mode')).toBeInTheDocument()
    expect(screen.getByText('Current TPD Payout Stage')).toBeInTheDocument()
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Administration Charge')).toBeInTheDocument()
    expect(getCatalogValue('Investment Booster (Lump Sum) Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUActive LinkGuard TI Benefit Today once the current TI payout mode is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUActive LinkGuard')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByLabelText('Current Sum Assured (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current Accelerated TI Payout Mode')).toBeInTheDocument()
    expect(screen.getByText(/current accelerated ti payout mode before the ti snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUActive LinkGuard policy to be selected')

      state.updatePolicy(policy.id, {
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: 20_000,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 50_000,
          currentAmountOwing: 5_000,
          currentAcceleratedTiPayoutMode: 'same-as-death-benefit',
        },
      })
    })

    expect(screen.queryByText(/current accelerated ti payout mode before the ti snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$115,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUActive LinkGuard TPD Benefit Today once the current TPD settlement mode and payout stage are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUActive LinkGuard')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current TPD Settlement Mode')).toBeInTheDocument()
    expect(screen.getByText('Current TPD Payout Stage')).toBeInTheDocument()
    expect(screen.getByText(/current tpd settlement mode before the payable-now tpd snapshot can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/current tpd payout stage before the payable-now tpd snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUActive LinkGuard policy to be selected')

      state.updatePolicy(policy.id, {
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: 20_000,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 50_000,
          currentAmountOwing: 5_000,
        },
        claimProfile: {
          currentTpdSettlementMode: 'same-as-death-benefit',
          currentTpdPayoutStage: 'initial-lump-sum-payable-now',
        },
      })
    })

    expect(screen.queryByText(/current tpd settlement mode before the payable-now tpd snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/current tpd payout stage before the payable-now tpd snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$115,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows PRUActive LinkGuard staged TPD balance snapshots once the current payout stage and claim-history remaining balance are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'PRUActive LinkGuard')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUActive LinkGuard policy to be selected')

      state.updatePolicy(policy.id, {
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: 20_000,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentSumAssured: 50_000,
          currentAmountOwing: 5_000,
        },
        claimProfile: {
          currentTpdSettlementMode: 'same-as-death-benefit',
          currentTpdPayoutStage: 'balance-lump-sum-payable-now',
        },
      })
    })

    expect(screen.getByLabelText(/current tpd remaining balance/i)).toBeInTheDocument()
    expect(screen.getByText(/current tpd remaining balance before the later staged tpd snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded PRUActive LinkGuard policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTpdSettlementMode: 'same-as-death-benefit',
          currentTpdPayoutStage: 'balance-lump-sum-payable-now',
          currentClaimHistory: {
            family: 'tpd-staged-payout',
            remainingStagedBenefitBalance: 325_000,
          },
        },
      })
    })

    expect(screen.queryByText(/current tpd remaining balance before the later staged tpd snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$325,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Investment-linked Insurance Plan 2 as a supported catalog product with premium-holiday refund warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Investment-linked Insurance Plan 2')

    expect(within(dialog).getByText('Investment-linked Insurance Plan 2')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 5\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Investment-linked Insurance Plan 2 (SGD / MIP 10 (Choice 5))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published bonus path')
    expect(seededAlert?.textContent).toContain('policy fee')
    expect(seededAlert?.textContent).toContain('current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals including withdrawal charges and current amount owing')
    expect(seededAlert?.textContent).toContain('TPD capped by a manual remaining aggregate TPD cap')
    expect(seededAlert?.textContent).toContain('premium-holiday charge')
    expect(seededAlert?.textContent).toContain('Choice 10 premium-holiday-charge refund path')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Net Regular Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Net RSP + Top-up Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TPD Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Top-up Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Investment-linked Insurance Plan 2 TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Investment-linked Insurance Plan 2')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 under 6000\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Investment-linked Insurance Plan 2 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted TI claim amount input for Investment-linked Insurance Plan 2 and uses the TI termination-state surface', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Investment-linked Insurance Plan 2')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 under 6000\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Investment-linked Insurance Plan 2 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted TI claim benefit amount before the admitted-state TI snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Investment-linked Insurance Plan 2 TPD Benefit Today once current amount owing and remaining aggregate TPD cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Investment-linked Insurance Plan 2')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 under 6000\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Investment-linked Insurance Plan 2 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTpdCap: 100_000,
        },
      })
    })

    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the TPD claim-status input for Investment-linked Insurance Plan 2 and hides TI / TPD rows after an admitted and settled TPD claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Investment-linked Insurance Plan 2')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 under 6000\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Investment-linked Insurance Plan 2 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTpdCap: 100_000,
        },
      })
    })

    expect(screen.getByText('Current TPD Claim Status')).toBeInTheDocument()
    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Investment-linked Insurance Plan 2 policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          remainingAggregateTpdCap: 100_000,
          currentTpdClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state TPD claim amount input for Investment-linked Insurance Plan 2 and requires it before the admitted-state TPD snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Investment-linked Insurance Plan 2')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 under 6000\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Current Admitted TPD Claim Benefit Amount (SGD)')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Investment-linked Insurance Plan 2 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          currentTpdClaimStatus: 'admitted',
          remainingAggregateTpdCap: 100_000,
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TPD Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted TPD claim benefit amount before the admitted-state TPD snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Wealth Advantage 4 as a supported catalog product with premium-holiday refund warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Wealth Advantage 4')

    expect(within(dialog).getByText('GREAT Wealth Advantage 4')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 6000 and above\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('GREAT Wealth Advantage 4 (SGD / MIP 10 (Choice 10 6000 And Above))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published bonus path')
    expect(seededAlert?.textContent).toContain('policy fee')
    expect(seededAlert?.textContent).toContain('current-state death / terminal-illness / TPD benefit estimate as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals including withdrawal charges and current amount owing')
    expect(seededAlert?.textContent).toContain('with TPD capped by a manual remaining aggregate TPD cap')
    expect(seededAlert?.textContent).toContain('premium-holiday-charge refund path')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Net Regular Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Net RSP + Top-up Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TPD Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge Refund')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Top-up Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Prestige Legacy Advantage TI Benefit Today once current sum assured and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prestige Legacy Advantage')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(single premium\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Prestige Legacy Advantage policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 55_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 40_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Prestige Legacy Advantage death benefit after TI claim today once current sum assured and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prestige Legacy Advantage')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(single premium\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Death Benefit After TI Claim Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Prestige Legacy Advantage policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 55_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 40_000,
        },
      })
    })

    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for Prestige Legacy Advantage and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Prestige Legacy Advantage')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5 \(single premium\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Prestige Legacy Advantage policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Wealth Advantage 4 TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Wealth Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 6000 and above\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Wealth Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Wealth Advantage 4 TPD Benefit Today once current amount owing and remaining aggregate TPD cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Wealth Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 6000 and above\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Wealth Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTpdCap: 15_000,
        },
      })
    })

    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('hides GREAT Wealth Advantage 4 TI rows after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Wealth Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 6000 and above\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Wealth Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Wealth Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryAllByText('TI Benefit Today', { selector: 'p' })).toHaveLength(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the TPD claim-status input for GREAT Wealth Advantage 4 and hides TI / TPD rows after an admitted and settled TPD claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Wealth Advantage 4')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(choice 10 6000 and above\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Wealth Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTpdCap: 15_000,
        },
      })
    })

    expect(screen.getByText('Current TPD Claim Status')).toBeInTheDocument()
    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Wealth Advantage 4 policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          remainingAggregateTpdCap: 15_000,
          currentTpdClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TPD Benefit Today')).not.toBeInTheDocument()
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds HSBC Life Wealth Invest (CPF) as a supported catalog product with zero-charge CPF routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'HSBC Life Wealth Invest (CPF)')

    expect(within(dialog).getByText('HSBC Life Wealth Invest (CPF)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('HSBC Life Wealth Invest (CPF) (SGD / Open-ended (Cpf))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('zero-charge single-premium')
    expect(seededAlert?.textContent).toContain('recurring-single-premium')
    expect(seededAlert?.textContent).toContain('approved top-up')
    expect(seededAlert?.textContent).toContain('nil-redemption-fee withdrawal path')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of policy value or the 101%-of-paid-premiums floor')
    expect(seededAlert?.textContent).toContain('current amount owing before the current death-benefit estimate can be trusted')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Charge (CPF)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (CPF)')).toBeInTheDocument()
    expect(getCatalogValue('Recurring Single Premium Charge (CPF)')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds HSBC Life Wealth Invest (Cash/SRS) cash as a supported catalog product with reinvest-default boundaries', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'HSBC Life Wealth Invest (Cash/SRS)')

    expect(within(dialog).getByText('HSBC Life Wealth Invest (Cash/SRS)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('HSBC Life Wealth Invest (Cash/SRS) (SGD / Open-ended (Cash))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('distributor-selected premium-charge surface through manual input')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('nil-redemption-fee withdrawal path')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of policy value or the 101%-of-paid-premiums floor')
    expect(seededAlert?.textContent).toContain('current amount owing before the current death-benefit estimate can be trusted')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Charge (Cash)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (Cash)')).toBeInTheDocument()
    expect(getCatalogValue('Recurring Single Premium Charge (Cash)')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows HSBC Life Wealth Invest (CPF) TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'HSBC Life Wealth Invest (CPF)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cpf\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Wealth Invest (CPF) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows HSBC Life Wealth Invest (Cash/SRS) TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'HSBC Life Wealth Invest (Cash/SRS)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Wealth Invest (Cash/SRS) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted TI claim amount input for HSBC Life Wealth Invest (CPF) and does not ask for a residual death amount', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'HSBC Life Wealth Invest (CPF)')
    const cpfButton = within(dialog)
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith('SGD / Open-ended (Cpf)'))
    expect(cpfButton).toBeDefined()
    await user.click(cpfButton!)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Wealth Invest (CPF) policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Singlife Legacy Invest TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Singlife Legacy Invest')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(term 15\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Singlife Legacy Invest policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Singlife Legacy Invest TI claim-status input and hides TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Singlife Legacy Invest')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(term 15\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Singlife Legacy Invest policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Singlife Savvy Invest II TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Singlife Savvy Invest II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(fixed\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Singlife Savvy Invest II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Singlife Savvy Invest II TI claim-status input and hides TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Singlife Savvy Invest II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(fixed\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Singlife Savvy Invest II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Invest Advantage (SP) TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (SP)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage (SP) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the TI claim-status input for GREAT Invest Advantage (SP) and hides TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (SP)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage (SP) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage (SP) policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted TI claim amount input for GREAT Invest Advantage (SP) and requires it before the admitted-state TI snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (SP)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage (SP) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current admitted TI claim benefit amount before the admitted-state TI snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Invest Advantage (RSP) TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage (RSP)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage (RSP) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Retirement Elite TI Benefit Today on the seeded supported surface', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Retirement Elite')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the TI claim-status input for AIA Platinum Retirement Elite and hides TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Retirement Elite')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Retirement Elite policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - Single Premium TI Benefit Today once current net protected premium base is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - Single Premium')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - Single Premium policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 120_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - Single Premium TI Benefit Today before payout start without the manual current protected-base input', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - Single Premium')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.getByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - Single Premium policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        initialSinglePremium: 100_000,
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: 90_000,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          source: 'manual-assumption',
          accountId: 'policy',
          startPolicyYear: 8,
          durationYears: 15,
          annualPayoutAmount: 6_000,
          frequency: 'annual',
        },
      })
    })

    expect(screen.queryByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted TI claim amount input for AIA Elite Secure Income - Single Premium and does not ask for a residual death amount', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - Single Premium')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - Single Premium policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - Single Premium Accidental Death Benefit Today once current net protected premium base and initial single premium are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - Single Premium')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - Single Premium policy to be selected')

      state.updatePolicy(policy.id, {
        initialSinglePremium: 100_000,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 120_000,
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - 5 Pay TI Benefit Today once current net protected premium base is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - 5 Pay policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        monthlyContribution: 350,
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: 15_000,
        })),
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 120_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - 5 Pay TI Benefit Today before payout start without the manual current protected-base input', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.getByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - 5 Pay policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          source: 'manual-assumption',
          accountId: 'policy',
          startPolicyYear: 8,
          durationYears: 15,
          annualPayoutAmount: 6_000,
          frequency: 'annual',
        },
      })
    })

    expect(screen.queryByText(/current net protected premium base before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - 5 Pay TI claim-status input and hides TI Benefit Today after an admitted and settled TI claim', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - 5 Pay policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 120_000,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted-and-settled',
        },
      })
    })

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Elite Secure Income - 5 Pay Accidental Death Benefit Today once current net protected premium base is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - 5 Pay policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 3,
        monthsAlreadyPaid: 24,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 120_000,
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest Smart Vista as a supported catalog product with duplicate policy charges and bonus warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Smart Vista')

    expect(within(dialog).getByText('Invest Smart Vista')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Invest Smart Vista (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(seededAlert?.textContent).toContain('regular-premium / top-up account structure')
    expect(seededAlert?.textContent).toContain('cumulative-paid policy charge')
    expect(seededAlert?.textContent).toContain('Start-up / Special / Loyalty Bonuses')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Remaining Aggregate TI Cap (SGD)')).toBeInTheDocument()
    expect(getCatalogValues('Policy Charge')).toHaveLength(2)
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Start-up Bonus Recovery Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest Smart Vista with early-year premium-shortfall charge and refund support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Smart Vista')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Premium-Free-Period-gated premium shortfall charge and full-repayment refund/reset corridor')
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest flex prime II as a supported catalog product with bounded death-benefit support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex prime II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(flexi 5\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Invest flex prime II (SGD / MIP 10 (Flexi 5))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValues('Policy Charge')).toHaveLength(2)
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Start-up Bonus Recovery Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest flex prime II Flexi 3 with Premium-Free-Period shortfall charge and refund support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex prime II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Invest flex prime II (SGD / MIP 10 (Flexi 3))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Premium-Free Period gating, premium-shortfall charge after entitlement exhaustion, full-repayment reset')
    expect(seededAlert?.textContent).toContain('Up to 84 months of Premium-Free Period may be accumulated across the 10-year Flexi 3 premium term.')
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest flex pro as a supported catalog product with bounded death-benefit support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex pro')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 20use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Invest flex pro (SGD / MIP 20)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the sum of the higher of the Regular Premium Account value or the 101%-of-paid-regular-premiums floor plus Top-up Account value after manual current amount owing')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(getCatalogValues('Policy Charge')).toHaveLength(2)
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Wealth Purpose TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Purpose')
    expect(within(dialog).getByText('Invest Wealth Purpose')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Wealth Purpose policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 42,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 12_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Invest Wealth Purpose with Premium-Free-Period shortfall charge and refund support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Purpose')
    expect(within(dialog).getByText('Invest Wealth Purpose')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Premium-Free-Period-gated premium shortfall charge and full-repayment refund/reset corridor')
    expect(seededAlert?.textContent).toContain('Up to 60 months of Premium-Free Period may be accumulated across the 10-year premium payment term.')
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest Smart Vista TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest Smart Vista')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest Smart Vista policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 41,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 700,
        },
        claimProfile: {
          remainingAggregateTiCap: 18_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest vista TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest vista')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(flexi 3\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest vista policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 41,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
        claimProfile: {
          remainingAggregateTiCap: 10_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest flex prime II TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex prime II')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10 \(flexi 5\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest flex prime II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 600,
        },
        claimProfile: {
          remainingAggregateTiCap: 12_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Invest flex pro TI Benefit Today once current amount owing and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest flex pro')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 20use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Invest flex pro policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 800,
        },
        claimProfile: {
          remainingAggregateTiCap: 25_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Elite Secure Income - Single Premium as a supported catalog product with manual payout-state warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - Single Premium')

    expect(within(dialog).getByText('AIA Elite Secure Income - Single Premium')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText(/AIA Elite Secure Income - Single Premium/i).length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('3% top-up premium charge')
    expect(seededAlert?.textContent).toContain('scheduled payout capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('published 5% single-premium charge')
    expect(seededAlert?.textContent).toContain('Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 105% of policy value or the single-premium-paid corridor before Secure Monthly Income starts')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 10% of a manual initial single premium input during the first 5 policy years')
    expect(seededAlert?.textContent).toContain('current net protected premium base before the current death-benefit estimate can be trusted')
    expect(seededAlert?.textContent).toContain('open-ended single-premium product uses the no-MIP basis')
    expect(screen.getByLabelText('Current Net Protected Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Power-up Bonus Adjustment Factor')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Elite Secure Income - 5 Pay as a supported catalog product with premium-history and payout warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')

    expect(within(dialog).getByText('AIA Elite Secure Income - 5 Pay')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Elite Secure Income - 5 Pay (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('premium-year regular premium charge schedule')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule')
    expect(seededAlert?.textContent).toContain('scheduled payout capability through the payout-state kernel')
    expect(seededAlert?.textContent).toContain('Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 105% of policy value or the paid-regular-premium corridor before Secure Monthly Income starts')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 50% of cumulative paid regular premiums during the first 5 policy years')
    expect(seededAlert?.textContent).toContain('current net protected premium base before the current death-benefit estimate can be trusted')
    expect(seededAlert?.textContent).toContain('Secure Monthly Income eligibility depends on no premium holiday')
    expect(screen.getByLabelText('Current Net Protected Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Power-up Bonus Adjustment Factor')).toBeInTheDocument()
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Elite Secure Income - 5 Pay policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
      })
    })

    expect(screen.getByLabelText('Current Accepted Regular Premium Months')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('keeps TI claim status and protected premium base empty until the user explicitly fills them', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('current net protected premium base before the current death-benefit estimate can be trusted')
    expect(seededAlert?.textContent).toContain('current TI claim status before the admitted-state post-TI snapshot can be trusted')

    const protectedBaseInput = screen.getByLabelText('Current Net Protected Premium Base (SGD)')
    expect(protectedBaseInput).toHaveValue('')

    const tiClaimStatusTrigger = screen.getByRole('combobox', { name: /current ti claim status/i })
    expect(tiClaimStatusTrigger).toHaveTextContent('Not keyed yet')
    expect(screen.getByText('2 current inputs left')).toBeInTheDocument()

    await user.click(tiClaimStatusTrigger)
    await user.click(screen.getByRole('option', { name: 'No Admitted TI Claim' }))

    await user.click(protectedBaseInput)
    await user.type(protectedBaseInput, '0')
    await user.tab()

    await waitFor(() => {
      expect(seededAlert?.textContent).not.toContain('current net protected premium base before the current death-benefit estimate can be trusted')
      expect(seededAlert?.textContent).not.toContain('current TI claim status before the admitted-state post-TI snapshot can be trusted')
    })
    expect(screen.getByText('Current inputs complete')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('surfaces required current inputs inside Policy Details instead of navigation jumps', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Elite Secure Income - 5 Pay')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByText('Required now')).toBeInTheDocument()
    expect(screen.getByText('Current fields surfaced first in the form')).toBeInTheDocument()
    expect(screen.getByText('Current Net Protected Premium Base (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Retirement Elite as a supported catalog product with payout-state and supplementary-charge warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Retirement Elite')

    expect(within(dialog).getByText('AIA Platinum Retirement Elite')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Platinum Retirement Elite (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('regular-pay 5-year corridor')
    expect(seededAlert?.textContent).toContain('regular-pay Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward')
    expect(seededAlert?.textContent).toContain('2.50% p.a. regular-premium supplementary charge')
    expect(seededAlert?.textContent).toContain('scheduled payout capability once a manual payout assumption is supplied')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as 105% of policy value')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 50% of cumulative paid regular premiums during the first 5 policy years')
    expect(seededAlert?.textContent).toContain('Target Monthly Retirement Income amount')
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Power-up Bonus Adjustment Factor')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Supplementary Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Retirement Elite single-pay as a supported catalog product with single-premium power-up support', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Retirement Elite')

    expect(within(dialog).getByText('AIA Platinum Retirement Elite')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(sp\)use template$/i }))
    await confirmSeededPolicy(user)

    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('SGD single-pay corridor')
    expect(seededAlert?.textContent).toContain('5% single-premium charge')
    expect(seededAlert?.textContent).toContain('0.50% p.a. single-premium supplementary charge')
    expect(seededAlert?.textContent).toContain('single-premium Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 10% of a manual initial single premium input during the first 5 policy years')
    expect(seededAlert?.textContent).toContain('USD and SRS single-pay selection remain informational only')
    expect(screen.getByLabelText(/^Initial Single Premium \(Gross Lump Sum, /i)).toBeInTheDocument()
    expect(screen.getByLabelText('Current Power-up Bonus Adjustment Factor')).toBeInTheDocument()
    expect(getCatalogValue('Single Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Power-up Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Retirement Elite Accidental Death Benefit Today on the seeded supported surface during the first 5 policy years', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Retirement Elite')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Wealth Elite 2.0 as a supported catalog product with premium-term extension warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Elite 2.0')

    expect(within(dialog).getByText('AIA Platinum Wealth Elite 2.0')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Platinum Wealth Elite 2.0 (SGD / MIP 5)').length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('premium-year regular premium charges')
    expect(seededAlert?.textContent).toContain('3% top-up premium charge')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of current insured amount or policy value via a manual current insured amount input')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('current insured amount before the current death-benefit estimate can be trusted')
    expect(seededAlert?.textContent).toContain('optional extension of the regular premium term beyond five years')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Insured Amount (SGD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Platinum Wealth Legacy as a supported catalog product with informational withdrawal-table warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Legacy')

    expect(within(dialog).getByText('AIA Platinum Wealth Legacy')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText(/AIA Platinum Wealth Legacy/i).length).toBeGreaterThan(0)
    const seededAlert = (await screen.findByText('Seeded from catalog template')).closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('supported V1 product for the regular-pay 5-year corridor')
    expect(seededAlert?.textContent).toContain('3% top-up premium charge')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule')
    expect(seededAlert?.textContent).toContain('published regular-premium partial-withdrawal / surrender charge schedules')
    expect(seededAlert?.textContent).toContain('current-state death benefit corridor via manual current insured amount, current amount owing, and current No Lapse Privilege mode inputs')
    expect(seededAlert?.textContent).toContain('current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied')
    expect(seededAlert?.textContent).toContain('current insured amount before the current death-benefit estimate can be trusted')
    expect(seededAlert?.textContent).toContain('current amount owing before the current death-benefit estimate can be trusted')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Current Insured Amount (SGD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Amount Owing (SGD)')).toBeInTheDocument()
    expect(screen.getByText('Current No Lapse Privilege Mode')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Wealth Elite 2.0 TI Benefit Today once current insured amount and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Elite 2.0')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Wealth Elite 2.0 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 55_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 50_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Wealth Elite 2.0 death benefit after TI claim today once current insured amount and the remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Elite 2.0')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Death Benefit After TI Claim Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Wealth Elite 2.0 policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 55_000,
        },
        claimProfile: {
          remainingAggregateTiCap: 50_000,
        },
      })
    })

    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for AIA Platinum Wealth Elite 2.0 and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Elite 2.0')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Wealth Elite 2.0 policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Wealth Legacy TI Benefit Today once the current death-benefit inputs and remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Legacy')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Wealth Legacy policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 90,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 100_000,
          currentAmountOwing: 5_000,
          currentNoLapsePrivilegeMode: 'expiry-age-100',
        },
        claimProfile: {
          remainingAggregateTiCap: 80_000,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Platinum Wealth Legacy death benefit after TI claim today once the current death-benefit inputs and remaining aggregate TI cap are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Legacy')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Death Benefit After TI Claim Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Wealth Legacy policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 90,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentSumAssured: 100_000,
          currentAmountOwing: 5_000,
          currentNoLapsePrivilegeMode: 'expiry-age-100',
        },
        claimProfile: {
          remainingAggregateTiCap: 80_000,
        },
      })
    })

    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows the admitted-state residual death input for AIA Platinum Wealth Legacy and requires it before the current death snapshot can be trusted', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Legacy')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 5use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Platinum Wealth Legacy policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).toBeInTheDocument()
    expect(screen.getByText('This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Wealth Venture as a supported catalog product with supplementary-charge, benefit-charge, and distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Wealth Venture')

    expect(within(dialog).getByText('AIA Wealth Venture')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Wealth Venture (SGD / MIP 8)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('AIA Wealth Venture is cataloged as a supported V1 product for the regular-pay 8-year corridor.')
    expect(seededAlert?.textContent).toContain('regular-pay 8-year corridor')
    expect(seededAlert?.textContent).toContain('Welcome Bonus tiers for premium years 1 to 5')
    expect(seededAlert?.textContent).toContain('Investment Bonus milestones at policy years 9 to 12')
    expect(seededAlert?.textContent).toContain('annual Performance Bonus from policy year 9 onward')
    expect(seededAlert?.textContent).toContain('current-state death benefit as the higher of policy value or total regular premiums paid plus top-up premiums less withdrawals')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years')
    expect(seededAlert?.textContent).toContain('3.60% p.a. regular-premium supplementary charge')
    expect(seededAlert?.textContent).toContain('published Appendix A Benefit Charge corridor')
    expect(seededAlert?.textContent).toContain('premium-holiday charge schedule with full-outstanding-premium repayment resumption')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution support')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Supplementary Charge')).toBeInTheDocument()
    expect(getCatalogValue('Benefit Charge')).toBeInTheDocument()
    expect(getCatalogValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(getCatalogValue('Premium Holiday Charge')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Wealth Venture policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
      })
    })

    expect(screen.getByLabelText('Current Accepted Regular Premium Months')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Wealth Venture Accidental Death Benefit Today once current net protected premium base is filled during the first 2 policy years', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Wealth Venture')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 8use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Pro Achiever 3.0 as a supported catalog product with IIP distribution warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Pro Achiever 3.0')

    expect(within(dialog).getByText('AIA Pro Achiever 3.0')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Pro Achiever 3.0 (SGD / MIP 10)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('10-year IIP corridor')
    expect(seededAlert?.textContent).toContain('Welcome Bonus tiers for premium years 1 to 3')
    expect(seededAlert?.textContent).toContain('Special Bonus ladder from premium year 10 onward')
    expect(seededAlert?.textContent).toContain('Appendix A Benefit Charge corridor')
    expect(seededAlert?.textContent).toContain('Supplementary Charge corridor including explicit premium-holiday overlap proration')
    expect(seededAlert?.textContent).toContain('5% top-up premium charge')
    expect(seededAlert?.textContent).toContain('current ordinary death-benefit estimate as the higher of policy value or a manual current net protected premium base')
    expect(seededAlert?.textContent).toContain('current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years')
    expect(seededAlert?.textContent).toContain('reinvest-default distribution-mode assumption surface')
    expect(getCatalogValue('Benefit Charge')).toBeInTheDocument()
    expect(getCatalogValue('Supplementary Charge')).toBeInTheDocument()
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/current net protected premium base/i)).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows AIA Pro Achiever 3.0 Accidental Death Benefit Today once current net protected premium base is filled during the first 2 policy years', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Pro Achiever 3.0')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded AIA Pro Achiever 3.0 policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 2,
        monthsAlreadyPaid: 12,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'female',
          smokerStatus: 'non-smoker',
          currentNetProtectedPremiumBase: 120_000,
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds AIA Pro Lifetime Protector (II) as a supported catalog product with policy-fee and bonus warnings', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'AIA Pro Lifetime Protector (II)')

    expect(within(dialog).getByText('AIA Pro Lifetime Protector (II)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(plus\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('AIA Pro Lifetime Protector (II) (SGD / Open-ended (Plus))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('2% Special Bonus from premium year 10 onward')
    expect(seededAlert?.textContent).toContain('fixed S$5 monthly policy fee')
    expect(seededAlert?.textContent).toContain('nil policy-level partial-withdrawal charge path')
    expect(seededAlert?.textContent).toContain('fixed S$50 monthly premium-holiday charge during the first two policy years')
    expect(seededAlert?.textContent).toContain('current-state death benefit via a manual current insured amount input')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Regular Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Policy Fee')).toBeInTheDocument()
    expect(getCatalogValue(/Top-?up Premium Charge/i)).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(getCatalogValue('Special Bonus')).toBeInTheDocument()
    expect(screen.getByLabelText(/Current Insured Amount/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage 2 (SP) as a supported catalog product with open-ended single-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage 2 (SP)')

    expect(within(dialog).getByText('GREAT Invest Advantage 2 (SP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('GREAT Invest Advantage 2 (SP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('upfront initial single-premium charge')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 110% of single premium plus top-ups less partial surrenders or account value less manual current amount owing')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
    expect(getCatalogValue('Initial Single Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds GREAT Invest Advantage 2 (RSP) as a supported catalog product with open-ended recurrent-premium routing', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage 2 (RSP)')

    expect(within(dialog).getByText('GREAT Invest Advantage 2 (RSP)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('GREAT Invest Advantage 2 (RSP) (SGD / Open-ended (Cash Or Srs))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published recurrent-premium charge path')
    expect(seededAlert?.textContent).toContain('published explicit selected-fund partial-surrender floor')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 110% of recurrent single premiums plus top-ups less partial surrenders or account value less manual current amount owing')
    expect(seededAlert?.textContent).toContain('no-surrender-charge structure')
    expect(seededAlert?.textContent).toContain('open-ended no-MIP basis')
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
    expect(getCatalogValue('Recurring Premium Charge (Cash / SRS)')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge (Cash / SRS)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Invest Advantage 2 (SP) Death Benefit Today and TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage 2 (SP)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage 2 (SP) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows GREAT Invest Advantage 2 (RSP) Death Benefit Today and TI Benefit Today once current amount owing is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'GREAT Invest Advantage 2 (RSP)')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(cash or srs\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded GREAT Invest Advantage 2 (RSP) policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 40,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 500,
        },
      })
    })

    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic basic-death as a supported catalog product with combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic')

    const goClassicCard = within(dialog).getByText('#goClassic').closest('.rounded-lg') as HTMLElement | null
    expect(goClassicCard).not.toBeNull()
    await user.click(within(goClassicCard!).getByRole('button', { name: /^sgd \/ mip 25use template$/i }))

    expect(screen.getAllByText('#goClassic (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Basic Death keeps Monthly Protection Charge metadata-only')
    expect(getCatalogValue('Initial Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Additional Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic advanced-death as a supported catalog product with disable-on-failure Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Monthly Protection Charge')
    expect(seededAlert?.textContent).toContain('irreversible downgrade after failed deduction')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic Secure as a supported catalog product with combined account-fee modeling', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'goClassic Secure')

    expect(within(dialog).getByText('#goClassic Secure')).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^sgd \/ mip 25use template$/i }),
    )

    expect(screen.getAllByText('#goClassic Secure (SGD / MIP 25)').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Initial Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus (During Premium Payment Term)')).toBeInTheDocument()
    expect(getCatalogValue('Additional Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine #goClassic Secure advanced death as a supported catalog product with locked-in-value MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Locked-in Policy Value floor')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/current locked-in policy value/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds HSBC Life Flexi Protector as a supported catalog product with premium charges and a fixed admin fee', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Flexi Protector')

    expect(within(dialog).getByText('HSBC Life Flexi Protector')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(choice cover\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText('HSBC Life Flexi Protector (SGD / Open-ended (Choice Cover))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('102% regular-premium allocation uplift')
    expect(seededAlert?.textContent).toContain('fixed S$5 monthly administration fee')
    expect(getCatalogValue('Administration Fee')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows HSBC Life Flexi Protector Death Benefit Today, TI Benefit Today, and TPD Benefit Today once the manual claim state is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Flexi Protector')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(choice cover\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByLabelText(/current basic sum assured/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current net rsp \+ top-up base/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current indebtedness \/ outstanding charges/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/remaining aggregate ti cap/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/remaining aggregate tpd cap \(current claim stage/i)).toBeInTheDocument()
    expect(screen.getByText('Current TPD Payout Stage')).toBeInTheDocument()
    expect(screen.getByText(/current indebtedness \/ outstanding charges before the ti snapshot can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining aggregate tpd cap for the current claim stage before the tpd snapshot can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/current tpd payout stage before the payable-now tpd snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Flexi Protector policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 100_000,
          currentNetSupplementaryPremiumBase: 20_000,
        },
        claimProfile: {
          currentIndebtedness: 10_000,
          remainingAggregateTiCap: 3_000_000,
          remainingAggregateTpdCap: 3_000_000,
          currentTpdPayoutStage: 'full-benefit-payable-now',
        },
      })
    })

    expect(screen.queryByText(/current indebtedness \/ outstanding charges before the ti snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/remaining aggregate tpd cap for the current claim stage before the tpd snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/current tpd payout stage before the payable-now tpd snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$110,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$90,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows HSBC Life Flexi Protector death benefit after TI claim today once the current TI corridor is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Flexi Protector')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(choice cover\)use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Death Benefit After TI Claim Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Flexi Protector policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 100_000,
          currentNetSupplementaryPremiumBase: 20_000,
        },
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: account.id === 'policy' ? 3_500_000 : account.currentValue,
        })),
        claimProfile: {
          currentIndebtedness: 10_000,
          remainingAggregateTiCap: 3_000_000,
        },
      })
    })

    expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$500,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows HSBC Life Flexi Protector staged TPD balance snapshots once the current payout stage and claim-history remaining balance are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Flexi Protector')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(choice cover\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Flexi Protector policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 100_000,
          currentNetSupplementaryPremiumBase: 20_000,
        },
        claimProfile: {
          currentIndebtedness: 10_000,
          remainingAggregateTiCap: 3_000_000,
          remainingAggregateTpdCap: 80_000,
          currentTpdPayoutStage: 'balance-lump-sum-payable-now',
        },
      })
    })

    expect(screen.getByLabelText(/current tpd remaining balance/i)).toBeInTheDocument()
    expect(screen.getByText(/current tpd remaining balance before the later staged tpd snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Flexi Protector policy to be selected')

      state.updatePolicy(policy.id, {
        claimProfile: {
          currentIndebtedness: 10_000,
          remainingAggregateTiCap: 3_000_000,
          remainingAggregateTpdCap: 80_000,
          currentTpdPayoutStage: 'balance-lump-sum-payable-now',
          currentClaimHistory: {
            family: 'tpd-staged-payout',
            remainingStagedBenefitBalance: 65_000,
          },
        },
      })
    })

    expect(screen.queryByText(/current tpd remaining balance before the later staged tpd snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TPD Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$65,000').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows HSBC Life Flexi Protector admitted TI status without asking for manual TI-claim or residual-death inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Flexi Protector')
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ open-ended \(choice cover\)use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded HSBC Life Flexi Protector policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 100_000,
          currentNetSupplementaryPremiumBase: 20_000,
        },
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: account.id === 'policy' ? 3_500_000 : account.currentValue,
        })),
        claimProfile: {
          currentIndebtedness: 10_000,
          remainingAggregateTiCap: 3_000_000,
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Admitted TI Claim Benefit Amount (SGD)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current Residual Death Benefit After TI Claim (SGD)')).not.toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II TI snapshot input and surfaces TI Benefit Today once the remaining cap is filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/remaining aggregate ti cap/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
        },
        claimProfile: {
          remainingAggregateTiCap: 20_000,
        },
      })
    })

    expect(screen.queryByText(/remaining aggregate ti cap before the ti snapshot can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('TI Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II admitted TI claim inputs including the residual death amount after TI', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
        },
        claimProfile: {
          currentTiClaimStatus: 'admitted',
        },
      })
    })

    expect(screen.getByText('Current TI Claim Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Admitted TI Claim Benefit Amount (USD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Residual Death Benefit After TI Claim (USD)')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II current insured amount input once scheduled withdrawals are already active', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByLabelText('Current Insured Amount (USD)')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        monthlyContribution: 500,
        scheduledPayoutSupport: {
          mode: 'manual-assumption',
          accountId: 'policy',
          source: 'policy-redemption',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          source: 'manual-assumption',
          accountId: 'policy',
          annualPayoutAmount: 2_400,
          startPolicyYear: 4,
          durationYears: 5,
        },
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
        },
        claimProfile: {
          remainingAggregateTiCap: 20_000,
        },
      })
    })

    expect(screen.getByLabelText('Current Insured Amount (USD)')).toBeInTheDocument()
    expect(screen.getByText(/current insured amount before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.queryByText('TI Benefit Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
          currentSumAssured: 26_000,
        },
      })
    })

    await waitFor(() => {
      expect(screen.queryByText(/current insured amount before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('keeps Goal Builder II historical scheduled-withdrawal history off the active-year manual current-state inputs once the payout window has ended', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 5,
        monthsAlreadyPaid: 60,
        monthlyContribution: 500,
        scheduledPayoutSupport: {
          mode: 'manual-assumption',
          accountId: 'policy',
          source: 'policy-redemption',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          accountId: 'policy',
          annualPayoutAmount: 2_400,
          startPolicyYear: 3,
          durationYears: 2,
        },
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
        },
        claimProfile: {
          remainingAggregateTiCap: 27_000,
        },
      })
    })

    expect(screen.queryByLabelText('Current Insured Amount (USD)')).not.toBeInTheDocument()
    expect(screen.queryByText(/current insured amount before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current Accidental-Death Sum Insured (USD)')).not.toBeInTheDocument()
    expect(screen.queryByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).not.toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II current accidental-death sum insured input once scheduled withdrawals are already active', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        monthlyContribution: 500,
        scheduledPayoutSupport: {
          mode: 'manual-assumption',
          accountId: 'policy',
          source: 'policy-redemption',
        },
        scheduledPayoutAssumption: {
          mode: 'scheduled-redemption',
          source: 'manual-assumption',
          accountId: 'policy',
          annualPayoutAmount: 2_400,
          startPolicyYear: 4,
          durationYears: 5,
        },
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
          currentSumAssured: 30_000,
        },
      })
    })

    expect(screen.getByLabelText('Current Accidental-Death Sum Insured (USD)')).toBeInTheDocument()
    expect(screen.getByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
          currentSumAssured: 30_000,
          currentAccidentalDeathFloorAmount: 45_000,
        },
      })
    })

    await waitFor(() => {
      expect(screen.queryByText(/current accidental-death floor amount before the current accidental-death estimate can be trusted/i)).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Current Accidental-Death Sum Insured (USD)')).toHaveDisplayValue('45,000')
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('shows Goal Builder II Accidental Death Benefit Today once current age and current amount owing are filled', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Goal Builder II')
    await user.click(within(dialog).getByRole('button', { name: /^usd \/ mip 15use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.queryByText('Accidental Death Benefit Today')).not.toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      const selectedPolicyId = state.selectedPolicyId
      const policy = state.policies.find((entry) => entry.id === selectedPolicyId)
      if (!policy) throw new Error('Expected seeded Goal Builder II policy to be selected')

      state.updatePolicy(policy.id, {
        currentPolicyYear: 4,
        monthsAlreadyPaid: 48,
        monthlyContribution: 500,
        assuranceProfile: {
          currentAgeNextBirthday: 35,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentAmountOwing: 250,
        },
      })
    })

    expect(screen.getAllByText('Accidental Death Benefit Today').length).toBeGreaterThan(0)
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Singlife Legacy Invest as a supported catalog product with modeled booster, loyalty, maturity, and shortfall mechanics', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy-term-15-years corridor only')
    expect(seededAlert?.textContent).toContain('published 2.50% Special Booster on the fully-paid 10-year premium-payment corridor')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Administrative Charge')).toBeInTheDocument()
    expect(getCatalogValue('Welcome Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Special Booster')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Maturity Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Singlife Savvy Invest II fixed-10 as a supported catalog product with allocation uplift and loyalty windows', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('10 years (Fixed) corridor')
    expect(seededAlert?.textContent).toContain('guaranteed cost-of-insurance formula after you enter insured-life details and current premium bases')
    expect(seededAlert?.textContent).toContain('current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Cost of Insurance (Death / TI)')).toBeInTheDocument()
    expect(getCatalogValue('Administrative Charge')).toBeInTheDocument()
    expect(getCatalogValue('Supplementary Charge')).toBeInTheDocument()
    expect(getCatalogValue('Regular Premium Allocation Uplift (Policy Years 11-20)')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus (Payments 1-10)')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Singlife Savvy Invest II flexible-20 as a supported catalog product with the long-tenor schedules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Savvy Invest II')

    expect(within(dialog).getByText('Singlife Savvy Invest II')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 20 \(flexible\)/i }))

    expect(screen.getAllByText('Singlife Savvy Invest II (SGD / MIP 20 (Flexible))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('20 years (Flexible) corridor')
    expect(seededAlert?.textContent).toContain('allowable partial-withdrawal limits from Appendix B remain informational only')
    expect(getCatalogValue('Welcome Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus (Payments 1-10)')).toBeInTheDocument()
    expect(getCatalogValue('Partial Withdrawal Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(screen.getByLabelText(/Current Amount Owing/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest First Max as a supported catalog product with executable initial and accumulation account charges', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('SGD 10-year base-layer corridor')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as 105% of policy value')
    expect(getCatalogValue('Booster Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus (Policy Years 3-10)')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus (Policy Year 11 Onward)')).toBeInTheDocument()
    expect(getCatalogValue('Initial Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Accumulation Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Recurring Single Premium Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds FWD Invest First Summit as a supported catalog product with shortfall and reduction charge rules', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Invest First Summit')

    expect(within(dialog).getByText('FWD Invest First Summit')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^sgd \/ mip 10use template$/i }))
    await confirmSeededPolicy(user)

    expect(screen.getAllByText(/FWD Invest First Summit/i).length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('capped accumulation-account charge')
    expect(seededAlert?.textContent).toContain('current-state death-benefit estimate as 105% of policy value')
    expect(seededAlert?.textContent).toContain('charge-waiver and retrospective charge-refund support on premium-holiday events')
    expect(getCatalogValue('Initial Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Accumulation Account Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Shortfall Charge Refund')).toBeInTheDocument()
    expect(getCatalogValue('Premium Reduction Charge')).toBeInTheDocument()
    expect(getCatalogValue('Premium Reduction Charge Refund')).toBeInTheDocument()
    expect(getCatalogValue('Top-up Premium Charge')).toBeInTheDocument()
    expect(getCatalogValue('Booster Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Loyalty Bonus')).toBeInTheDocument()
    expect(getCatalogValue('Perpetual Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine TM Atlas Wealth basic-death as a supported catalog product with 12-month routing and combined account-fee modeling', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Initial Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine TM Atlas Wealth advanced-death as a supported catalog product with disable-on-failure Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Flexi as a supported catalog product with executable charge surfaces', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published policy investment charge and admin charge')
    expect(seededAlert?.textContent).toContain('tokio harvest flexi advanced death payout handling')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Policy Charge')).toBeInTheDocument()
    expect(getCatalogValue('Admin Charge')).toBeInTheDocument()
    expect(getCatalogValue('Initial Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Flexi advanced-death as a supported catalog product with Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Flexi advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Flexi')

    expect(within(dialog).getByText('Harvest Flexi')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Harvest Flexi (SGD / MIP 10 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Pro as a supported catalog product with dividend-mode support on all three accounts', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Performance investment bonus also models the published 102% performance-growth-measure gate')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Performance Investment Bonus')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Pro advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Pro advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Pro')

    expect(within(dialog).getByText('Harvest Pro')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 10 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Harvest Pro (SGD / MIP 10 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Max as a supported catalog product with executable initial, policy, and admin charges', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('published initial setup charge, policy charge, admin charge, bonuses, and appendix charge tables')
    expect(seededAlert?.textContent).toContain('published SGD 50 minimum payout threshold and 30-day record-date lead time')
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(getCatalogValue('Initial Setup Charge')).toBeInTheDocument()
    expect(getCatalogValues('Policy Charge').length).toBeGreaterThan(0)
    expect(getCatalogValue('Admin Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Max advanced-death as a supported catalog product with accrued Tokio MPC inputs', async () => {
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
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('Assurance-charge modeling still needs life-assured inputs')
    expect(seededAlert?.textContent).toContain('current net regular premium base')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
  }, ILP_REVIEW_PAGE_TEST_TIMEOUT_MS)

  it('seeds Tokio Marine Harvest Max advanced-death-life-benefit-rider as a supported catalog product with policy-term Tokio MPC inputs', async () => {
    const user = userEvent.setup()
    renderIlpReviewPage()

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Harvest Max')

    expect(within(dialog).getByText('Harvest Max')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /sgd \/ mip 15 \(advanced death life benefit rider\)/i }))

    expect(screen.getAllByText('Harvest Max (SGD / MIP 15 (Advanced Death Life Benefit Rider))').length).toBeGreaterThan(0)
    const seededAlert = screen.getByText('Seeded from catalog template').closest('[role="alert"]')
    expect(seededAlert).not.toBeNull()
    expect(seededAlert?.textContent).toContain('Supported template')
    expect(seededAlert?.textContent).toContain('policy anniversary immediately after age 99')
    expect(getCatalogValue('Monthly Protection Charge')).toBeInTheDocument()
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getByText(/assurance-charge modeling still needs life-assured inputs/i)).toBeInTheDocument()
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
    invalidPolicy.funds = [
      {
        ...invalidPolicy.funds[0],
        allocation: 0.5,
      },
    ]

    act(() => {
      useIlpStore.setState({
        policies: [validPolicy, invalidPolicy],
        selectedPolicyId: invalidPolicy.id,
      })
    })

    renderIlpReviewPage()

    expect(screen.getByText('1 policy excluded from analysis')).toBeInTheDocument()
    expect(screen.getByText('Policy needs attention before analysis updates')).toBeInTheDocument()
    expect(screen.getByText('Showing analysis for another valid policy')).toBeInTheDocument()
    expect(screen.getByText('Exit Scenarios')).toBeInTheDocument()
    expect(screen.getByText('Total Premiums Paid')).toBeInTheDocument()
    expect(screen.getByText('Valid Policy')).toBeInTheDocument()
  })

  it('shows a current-only summary surface for mature finite policies', () => {
    const maturePolicy = createDefaultPolicy()
    maturePolicy.id = 'mature-policy'
    maturePolicy.name = 'Mature Policy'
    maturePolicy.insurer = 'Insurer Mature'
    maturePolicy.currentPolicyYear = maturePolicy.mipLength ?? 1
    maturePolicy.monthsAlreadyPaid = (maturePolicy.mipLength ?? 1) * 12
    maturePolicy.accounts = maturePolicy.accounts.map((account, index) => ({
      ...account,
      currentValue: index === 0 ? 18_000 : 12_000,
    }))

    act(() => {
      useIlpStore.setState({
        policies: [maturePolicy],
        selectedPolicyId: maturePolicy.id,
      })
    })

    renderIlpReviewPage()

    expect(screen.getByText('1 policy stays in current-snapshot mode')).toBeInTheDocument()
    expect(screen.getByText('Current snapshot only')).toBeInTheDocument()
    expect(screen.getByText('Surrender Value Today')).toBeInTheDocument()
    expect(screen.getByText('Cancel-Now Penalty')).toBeInTheDocument()
    expect(screen.queryByText('Total Premiums Paid')).not.toBeInTheDocument()
    expect(screen.queryByText('Exit Scenarios')).not.toBeInTheDocument()
    expect(screen.queryByText('Showing analysis for another valid policy')).not.toBeInTheDocument()
    expect(screen.queryByText('Policy needs attention before analysis updates')).not.toBeInTheDocument()
  })

  it('keeps mature finite current-only policies in comparison rows while excluding them from projection panels', () => {
    const projectedPolicy = createDefaultPolicy()
    projectedPolicy.id = 'projected-policy'
    projectedPolicy.name = 'Projected Policy'
    projectedPolicy.insurer = 'Projected Insurer'

    const maturePolicy = createDefaultPolicy()
    maturePolicy.id = 'mature-policy'
    maturePolicy.name = 'Mature Policy'
    maturePolicy.insurer = 'Mature Insurer'
    maturePolicy.currentPolicyYear = maturePolicy.mipLength ?? 1
    maturePolicy.monthsAlreadyPaid = (maturePolicy.mipLength ?? 1) * 12
    maturePolicy.accounts = maturePolicy.accounts.map((account, index) => ({
      ...account,
      currentValue: index === 0 ? 18_000 : 12_000,
    }))

    act(() => {
      useIlpStore.setState({
        policies: [projectedPolicy, maturePolicy],
        selectedPolicyId: maturePolicy.id,
      })
    })

    renderIlpReviewPage()

    expect(screen.getByText('1 policy stays in current-snapshot mode')).toBeInTheDocument()
    expect(screen.getByText('Policy Comparison')).toBeInTheDocument()
    expect(screen.getAllByText('Projected Policy').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mature Policy').length).toBeGreaterThan(0)
    expect(screen.getByText('Projection Horizon')).toBeInTheDocument()
    expect(screen.getByText('Current snapshot only')).toBeInTheDocument()
    expect(screen.queryByText('1 policy excluded from analysis')).not.toBeInTheDocument()
  })

  it('shows SmartRetire later-corridor inputs on the current-only surface and adds Death Benefit Today once the retirement state is filled', () => {
    const maturePolicy = createDefaultPolicy()
    maturePolicy.id = 'smartretire-mature-policy'
    maturePolicy.name = 'SmartRetire Mature Policy'
    maturePolicy.insurer = 'Manulife Singapore'
    maturePolicy.monthlyContribution = 1_000
    maturePolicy.currentPolicyYear = 10
    maturePolicy.monthsAlreadyPaid = 108
    maturePolicy.mipLength = 8
    maturePolicy.accounts = [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        currentValue: 40_000,
        contributionShare: 1,
        subjectToEec: true,
        postMipFeeRate: 0,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      },
    ]
    maturePolicy.bonuses = []
    maturePolicy.chargeRules = []
    maturePolicy.catalogSource = {
      productId: 'manulife-smartretire-v-income',
      productName: 'Manulife SmartRetire (V) - Income',
      variantId: 'sgd-mip-8-flexi-3',
      variantLabel: '8 Years Flexi 3',
      catalogVersion: 'test',
      supportStatus: 'supported',
      economicsStatus: 'supported',
      structureStatus: 'structured',
      modeledEconomics: ['kernel:current-death-benefit-estimate'],
      metadataOnlyBehaviors: ['manulife-smartretire-v-income-claim-handling'],
    }

    act(() => {
      useIlpStore.setState({
        policies: [maturePolicy],
        selectedPolicyId: maturePolicy.id,
      })
    })

    renderIlpReviewPage()

    expect(screen.getByText('Current snapshot only')).toBeInTheDocument()
    expect(screen.getByLabelText(/current basic sum assured/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target retirement age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current amount owing/i)).toBeInTheDocument()
    expect(screen.getByText(/current amount owing before the current death-benefit estimate can be trusted/i)).toBeInTheDocument()
    expect(screen.getByText(/target retirement age before the later smartretire death-benefit corridor can be trusted/i)).toBeInTheDocument()

    act(() => {
      const state = useIlpStore.getState()
      state.updatePolicy(maturePolicy.id, {
        assuranceProfile: {
          currentAgeNextBirthday: 55,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentBasicSumAssured: 50_000,
          targetRetirementAge: 65,
          currentAmountOwing: 5_000,
        },
      })
    })

    expect(screen.queryByText(/current amount owing before the current death-benefit estimate can be trusted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/target retirement age before the later smartretire death-benefit corridor can be trusted/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/current refund-eligible death coi collected/i)).toBeInTheDocument()
    expect(screen.getAllByText(/current smartretire death-coi refund gate/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Death Benefit Today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S$45,000').length).toBeGreaterThan(0)
  })
})
