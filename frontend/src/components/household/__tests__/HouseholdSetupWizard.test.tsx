import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { StartPage } from '@/pages/StartPage'
import { Sidebar } from '@/components/layout/Sidebar'
import { deriveHouseholdSectionToggles } from '@/lib/household/sectionVisibility'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useUIStore } from '@/stores/useUIStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'

vi.mock('@/lib/household/featureFlag', () => ({
  HOUSEHOLD_PLANNER_V1_FLAG_KEY: 'fireplanner-feature-householdPlannerV1',
  isHouseholdPlannerV1Enabled: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

vi.mock('@/hooks/useSectionCompletion', () => ({
  useSectionCompletion: () => ({ sections: {} }),
}))

vi.mock('@/hooks/useActiveSection', () => ({
  useActiveSection: () => ({ activeSection: null, isInputsPage: false }),
}))

vi.mock('@/components/layout/ScenarioManager', () => ({
  ScenarioManager: () => <div>Scenario manager</div>,
}))

vi.mock('@/components/shared/ShareButton', () => ({
  ShareButton: () => <button type="button">Share</button>,
}))

vi.mock('@/components/layout/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}))

vi.mock('@/lib/companion/isCompanionMode', () => ({
  COMPANION_SECTION_SCROLL_KEY: 'fireplanner-companion-section-scroll',
  isCompanionMode: () => false,
}))

const mockIsHouseholdPlannerV1Enabled = vi.mocked(isHouseholdPlannerV1Enabled)

function renderStartPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <StartPage />
    </MemoryRouter>,
  )
}

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Sidebar />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.removeItem('fireplanner-profile')
  localStorage.removeItem('fireplanner-income')
  localStorage.removeItem('fireplanner-property')
  localStorage.removeItem('fireplanner-ui')
  localStorage.removeItem('fireplanner-household-plan-v1')

  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useHouseholdPlanStore.getState().reset()
  useUIStore.setState({
    sectionOrder: 'goal-first',
    statsPosition: 'bottom',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    sectionOverrides: {},
    dismissedNudges: [],
    helpPanelOpen: true,
    dollarBasis: 'nominal',
    lastSeenChangelogDate: null,
    lastSeenDataVintage: null,
    showNewPurchase: false,
    collapsedSections: [],
    quickModeActive: false,
    contextualNudgeActive: false,
  })
  mockIsHouseholdPlannerV1Enabled.mockReturnValue(false)
})

describe('Household setup flow', () => {
  it('keeps the legacy individual quick-start path unchanged when the flag is off', () => {
    renderStartPage()

    expect(screen.queryByText('Plan setup')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Couple/i })).not.toBeInTheDocument()
    expect(screen.getByText('I know when I want to retire')).toBeInTheDocument()
    expect(screen.getByText("Show me what's possible")).toBeInTheDocument()
    expect(screen.getByText('I already have enough')).toBeInTheDocument()
  })

  it('shows the setup entry in the sidebar only when the feature flag is on', () => {
    const { unmount } = renderSidebar()
    expect(screen.getByText('Start Here')).toBeInTheDocument()
    expect(screen.queryByText('Plan Setup')).not.toBeInTheDocument()

    unmount()
    mockIsHouseholdPlannerV1Enabled.mockReturnValue(true)
    renderSidebar()

    expect(screen.getByText('Plan Setup')).toBeInTheDocument()
    expect(screen.queryByText('Start Here')).not.toBeInTheDocument()
  })

  it('creates a couple plan from the setup wizard (no dependents section)', async () => {
    mockIsHouseholdPlannerV1Enabled.mockReturnValue(true)
    const user = userEvent.setup()

    renderStartPage()

    await user.click(screen.getByRole('button', { name: /Couple/i }))
    // Pathway cards now shown for all plan types — select one to reveal the wizard
    await user.click(screen.getByText('I know when I want to retire'))
    expect(screen.getByText('Couple setup')).toBeInTheDocument()

    // Couple mode should not show the dependents section
    expect(screen.queryByText('Dependents')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add dependent' })).not.toBeInTheDocument()

    // Fill in partner name (required for couple plan's Create plan button)
    await user.type(screen.getByLabelText('Partner name'), 'Pat')
    await user.click(screen.getAllByRole('switch')[0]!)

    await user.click(screen.getByRole('button', { name: 'Create plan' }))

    const state = useHouseholdPlanStore.getState()
    expect(state.plan.planType).toBe('couple')
    expect(state.plan.adults).toHaveLength(2)
    expect(state.plan.adults[1]?.annualIncome).toBe(0)
    expect(state.plan.dependents).toHaveLength(0)
    expect(state.provenance.source).toBe('manual')
    expect(useUIStore.getState().cpfEnabled).toBe(false)
  })

  it('forces household toggles on when migrated data already exists', () => {
    useUIStore.setState({
      cpfEnabled: false,
      propertyEnabled: false,
      healthcareEnabled: false,
    })

    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    plan.adults[0].cpf.lifeActualMonthlyPayout = 1200
    plan.adults[0].healthcare.enabled = true
    plan.properties[0].existingMortgageBalance = 250000

    expect(deriveHouseholdSectionToggles(plan)).toEqual({
      cpfEnabled: true,
      propertyEnabled: true,
      healthcareEnabled: true,
    })

    useUIStore.getState().ensureHouseholdDataVisible(deriveHouseholdSectionToggles(plan))

    const state = useUIStore.getState()
    expect(state.cpfEnabled).toBe(true)
    expect(state.propertyEnabled).toBe(true)
    expect(state.healthcareEnabled).toBe(true)
  })

  it('does not force CPF visibility on for a fresh citizen household with no CPF data', () => {
    useUIStore.setState({
      cpfEnabled: false,
      propertyEnabled: false,
      healthcareEnabled: false,
    })

    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    plan.planType = 'couple'

    expect(deriveHouseholdSectionToggles(plan)).toEqual({
      cpfEnabled: false,
      propertyEnabled: false,
      healthcareEnabled: false,
    })

    useUIStore.getState().ensureHouseholdDataVisible(deriveHouseholdSectionToggles(plan))
    expect(useUIStore.getState().cpfEnabled).toBe(false)
  })
})
