import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FeeBreakdownSection, getVisibleAnnualFeeCategoryKeys } from '@/components/ilp/FeeBreakdownSection'
import { ProductPickerDialog } from '@/components/ilp/catalog/ProductPickerDialog'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { createDefaultPolicy, useIlpStore } from '@/stores/useIlpStore'
import { IlpLandingPage } from './IlpLandingPage'
import { IlpExitCalculatorPage } from './IlpExitCalculatorPage'
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

  it('keeps catalog model notes collapsed by default in the product picker', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={() => {}} />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/aia elite secure income - 5 pay is cataloged as supported in v1/i)).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /show model notes/i })[0]!)

    expect(screen.getByText(/aia elite secure income - 5 pay is cataloged as supported in v1/i)).toBeInTheDocument()
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

  it('shows the actual low-mid-high return assumptions in the fee breakdown header', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    expect(screen.getByText('Estimated return')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '6.0%' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '8.0%' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '10.0%' })).toBeInTheDocument()
  })

  it('shows a surrender-fee column in the detailed fee table', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    expect(screen.getByText('Surrender Fee')).toBeInTheDocument()
    expect(screen.getByText('n/a')).toBeInTheDocument()
  })

  it('hides fee-explanation cards for zero-only categories', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    expect(screen.queryByText('Assurance/COI')).not.toBeInTheDocument()
    expect(screen.queryByText(/cost-of-insurance charges for death, terminal illness, tpd, and accidental death coverage/i)).not.toBeInTheDocument()
  })

  it('omits zero-only annual fee categories from the chart series', () => {
    const visibleKeys = getVisibleAnnualFeeCategoryKeys([
      {
        policyYear: 1,
        accountFee: 120,
        additionalCharges: 840,
        assuranceCharges: 0,
        eventCharges: 0,
        implicitFundFee: 0,
        bonusCredits: 0,
      },
      {
        policyYear: 2,
        accountFee: 180,
        additionalCharges: 420,
        assuranceCharges: 0,
        eventCharges: 0,
        implicitFundFee: 55,
        bonusCredits: -40,
      },
    ], true)

    expect(visibleKeys).toEqual(['accountFee', 'additionalCharges', 'implicitFundFee'])
    expect(visibleKeys).not.toContain('assuranceCharges')
    expect(visibleKeys).not.toContain('eventCharges')
  })

  it('shows only five policy-year rows in the detailed fee table until expanded', async () => {
    const user = userEvent.setup()
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    const expandButton = screen.getByRole('button', { name: /show \d+ more rows/i })
    expect(expandButton).toBeInTheDocument()
    expect(screen.getByText(/showing the first 5 policy years by default/i)).toBeInTheDocument()
    expect(screen.queryByText(/^6$/)).not.toBeInTheDocument()

    await user.click(expandButton)

    expect(screen.getByRole('button', { name: /show first 5 rows/i })).toBeInTheDocument()
    expect(screen.getByText(/^6$/)).toBeInTheDocument()
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

  it('shows the compare-page ranked fee report summary strip', () => {
    render(
      <MemoryRouter>
        <IlpLeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/ranked fee report/i)).toBeInTheDocument()
    expect(screen.getByText(/strongest bonus support/i)).toBeInTheDocument()
    expect(screen.getByText(/filtered set/i)).toBeInTheDocument()
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

  it('shows the detailed fee breakdown section in exit analysis results', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <IlpExitCalculatorPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /choose product/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/search insurer or product name/i), 'Wealth Voyage')
    await user.click(within(dialog).getByRole('button', { name: /^USD \/ MIP 15Use template$/i }))
    await user.click(await screen.findByRole('button', { name: /calculate exit options/i }))

    expect(await screen.findByText('Fee Breakdown')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /annual fees by category/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /detailed fee table/i })).toBeInTheDocument()
  })

  it('shows guidance that the story detail page is an estimate to confirm with an adviser', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/confirm your details/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show me the fees/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    expect(await screen.findByText(/use this as a guide, not a quote/i)).toBeInTheDocument()
    expect(screen.getByText(/past performance does not guarantee future performance/i)).toBeInTheDocument()
    expect(screen.getByText(/confirm the actual numbers with your adviser/i)).toBeInTheDocument()
  })
})
