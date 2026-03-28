import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { StartPage } from './StartPage'
import { useUIStore } from '@/stores/useUIStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderStartPage() {
  return render(
    <MemoryRouter>
      <StartPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
  localStorage.removeItem('fireplanner-profile')
  localStorage.removeItem('fireplanner-household-plan-v1')
  useUIStore.setState({
    sectionOrder: 'goal-first',
    setupCompleted: false,
    setupPopulatedSections: [],
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

  it('navigates to /setup with planType when clicking a pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I know when I want to retire'))
    expect(mockNavigate).toHaveBeenCalledWith('/setup?planType=individual')
  })

  it('sets sectionOrder in UIStore when selecting pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText("Show me what's possible"))
    expect(useUIStore.getState().sectionOrder).toBe('story-first')
  })

  it('sets sectionOrder to already-fire when selecting third pathway', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I already have enough'))
    expect(useUIStore.getState().sectionOrder).toBe('already-fire')
  })

  it('shows returning user link only when localStorage has profile', () => {
    // No profile — links should not appear
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

  it('shows continue/redo options when setup is completed and user is returning', () => {
    localStorage.setItem('fireplanner-profile', '{}')
    useUIStore.setState({ setupCompleted: true })
    renderStartPage()

    expect(screen.getByText('Check your financial health')).toBeInTheDocument()
    expect(screen.getByText('Redo setup')).toBeInTheDocument()
    localStorage.removeItem('fireplanner-profile')
  })

  it('navigates to /setup?redo=true when clicking redo', async () => {
    const user = userEvent.setup()
    localStorage.setItem('fireplanner-profile', '{}')
    useUIStore.setState({ setupCompleted: true })
    renderStartPage()

    await user.click(screen.getByText('Redo setup'))
    expect(mockNavigate).toHaveBeenCalledWith('/setup?planType=individual&redo=true')
    localStorage.removeItem('fireplanner-profile')
  })

  it('does not show inline forms after pathway selection', async () => {
    const user = userEvent.setup()
    renderStartPage()
    await user.click(screen.getByText('I know when I want to retire'))

    // Old inline forms should not exist
    expect(screen.queryByText('Desired Retirement Age')).not.toBeInTheDocument()
    expect(screen.queryByText('Build my full plan')).not.toBeInTheDocument()
    expect(screen.queryByText('What should we include?')).not.toBeInTheDocument()
  })
})
