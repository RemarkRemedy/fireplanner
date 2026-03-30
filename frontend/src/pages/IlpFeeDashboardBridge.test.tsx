import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { createDefaultPolicy, useIlpStore } from '@/stores/useIlpStore'
import { IlpLandingPage } from './IlpLandingPage'
import { IlpLeaderboardPage } from './IlpLeaderboardPage'
import { IlpReviewPage } from './IlpReviewPage'
import { IlpStoryModePage } from './IlpStoryModePage'

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

beforeEach(() => {
  localStorage.clear()
  act(() => {
    useIlpStore.getState().reset()
  })
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

describe('ILP fee dashboard blog bridge', () => {
  it('shows blog CTA entry points on the ILP fee landing page', () => {
    render(
      <MemoryRouter>
        <IlpLandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /7 questions to ask your fa before signing an ilp/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=landing_hero',
    )
    expect(screen.getByRole('link', { name: /questions to ask before you buy an ilp/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=landing_guide',
    )
    expect(screen.getByRole('link', { name: /interactive comparison/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=landing_compare#2-what-are-the-total-annual-fees-including-fund-level-charges',
    )
    expect(screen.getByRole('link', { name: /when an ilp might actually make sense/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=landing_footer#when-an-ilp-might-actually-make-sense',
    )
  })

  it('shows summary and footer blog CTAs on the ILP review page', () => {
    render(
      <MemoryRouter>
        <IlpReviewPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /are these fees worth it\? a framework to decide/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=fee_summary',
    )
    expect(screen.getByRole('link', { name: /read: when an ilp actually makes sense/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=footer_card#when-ilp-makes-sense',
    )
  })

  it('shows the adviser-question callout inside the fee breakdown section', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    expect(screen.getByRole('link', { name: /read the questions/i })).toHaveAttribute(
      'href',
      '/blog/ilp-questions?utm_source=dashboard&utm_content=chart_callout#questions',
    )
  })

  it('carries the chosen template variant from landing into story mode', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<IlpLandingPage />} />
          <Route path="/ilp-fees/story/:productId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /i'm considering an ilp/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /^USD \/ MIP 15Use template$/i }))

    expect(screen.getByTestId('location')).toHaveTextContent('/ilp-fees/story/hsbc-life-wealth-voyage?variantId=usd-mip-15')
  })

  it('labels the comparison-table bonus column as bonuses instead of bonus offset', () => {
    render(
      <MemoryRouter>
        <IlpLeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /^bonuses$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bonus offset/i })).not.toBeInTheDocument()
  })

  it('threads the leaderboard view link through the exact variant route', () => {
    render(
      <MemoryRouter>
        <IlpLeaderboardPage />
      </MemoryRouter>,
    )

    const wealthVoyageRow = screen.getAllByText('Wealth Voyage')[0]?.closest('tr')
    expect(wealthVoyageRow).not.toBeNull()
    expect(within(wealthVoyageRow!).getByRole('link', { name: /view/i })).toHaveAttribute(
      'href',
      '/ilp-fees/story/hsbc-life-wealth-voyage?variantId=sgd-mip-25',
    )
  })

  it('states that the leaderboard fee percentage is net fees over premiums, not annualized drag', () => {
    render(
      <MemoryRouter>
        <IlpLeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /net fees \/ premiums/i })).toBeInTheDocument()
    expect(screen.getByText(/not an annualized drag rate/i)).toBeInTheDocument()
  })

  it('uses the route variant to skip the story-mode variant picker', () => {
    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/hsbc-life-wealth-voyage?variantId=usd-mip-15']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/confirm your details/i)).toBeInTheDocument()
    expect(screen.queryByText(/select one to continue/i)).not.toBeInTheDocument()
  })
})
