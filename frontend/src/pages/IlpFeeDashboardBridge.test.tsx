import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { HTMLAttributes, ReactNode } from 'react'
import { ExitTimingExplorer } from '@/components/ilp/ExitTimingExplorer'
import { FeeBreakdownSection, getVisibleAnnualFeeCategoryKeys } from '@/components/ilp/FeeBreakdownSection'
import { FeeImpactChart } from '@/components/ilp/FeeImpactChart'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { ProductPickerDialog } from '@/components/ilp/catalog/ProductPickerDialog'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { createDefaultPolicy, useIlpStore } from '@/stores/useIlpStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { IlpLandingPage } from './IlpLandingPage'
import { IlpExitCalculatorPage } from './IlpExitCalculatorPage'
import { IlpLeaderboardPage } from './IlpLeaderboardPage'
import { IlpReviewPage } from './IlpReviewPage'
import { IlpStoryModePage } from './IlpStoryModePage'

vi.mock('recharts', () => {
  const Container = ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  )
  const MockLineChart = ({
    children,
    data,
    onClick,
    ...props
  }: HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode
    data?: Array<{ exitYear?: number; label?: string }>
    onClick?: (state?: { activePayload?: Array<{ payload?: { exitYear?: number; label?: string } }> }) => void
  }) => (
    <div {...props}>
      {children}
      <div>
        {data?.map((entry, index) => (
          <button
            key={entry.exitYear ?? entry.label ?? `entry-${index}`}
            type="button"
            onClick={() => onClick?.({ activePayload: [{ payload: entry }] })}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  )
  return {
    ResponsiveContainer: Container,
    LineChart: MockLineChart,
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
    useHouseholdPlanStore.getState().reset()
  })
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function getProductCard(productName: string): HTMLElement {
  const card = screen.getByText(productName).closest('div.rounded-lg.border')

  if (card == null) {
    throw new Error(`Unable to locate product card for ${productName}`)
  }

  return card
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

  it('renders disabled corridor rows under supported cards and keeps them non-selectable', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'AIA Platinum Wealth Elite 2.0')

    const card = getProductCard('AIA Platinum Wealth Elite 2.0')

    expect(within(card).getByText('6 published corridors not modeled')).toBeInTheDocument()

    const disabledCorridor = within(card).getByRole('button', { name: /SGD \/ Single Pay/i })
    expect(disabledCorridor).toBeDisabled()

    await user.click(disabledCorridor)
    expect(onSelect).not.toHaveBeenCalled()

    const enabledTemplateButton = within(card).getAllByRole('button', { name: /Use template/i })[0]
    await user.click(enabledTemplateButton)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].id).toBe('aia-platinum-wealth-elite-2')
    expect(onSelect.mock.calls[0]?.[1].id).toBe('sgd-mip-5')
  })

  it('promotes AIA Pro Achiever 3.0 IIP 15-year and 20-year corridors into executable templates', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'AIA Pro Achiever 3.0')

    const card = getProductCard('AIA Pro Achiever 3.0')

    expect(within(card).queryByText(/published corridors not modeled/i)).not.toBeInTheDocument()

    const iip15Template = within(card).getByRole('button', { name: /SGD \/ IIP 15 years/i })
    const iip20Template = within(card).getByRole('button', { name: /SGD \/ IIP 20 years/i })

    expect(iip15Template).toBeEnabled()
    expect(iip20Template).toBeEnabled()

    await user.click(iip15Template)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].id).toBe('aia-pro-achiever-3')
    expect(onSelect.mock.calls[0]?.[1].id).toBe('sgd-iip-15')
  })

  it('promotes FWD Invest First Summit premium-payment-term corridors into executable templates', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'FWD Invest First Summit')

    const card = getProductCard('FWD Invest First Summit')

    expect(within(card).queryByText(/published corridors not modeled/i)).not.toBeInTheDocument()

    const mip11Template = within(card).getByRole('button', { name: /SGD \/ MIP 11/i })
    const mip30Template = within(card).getByRole('button', { name: /SGD \/ MIP 30/i })

    expect(mip11Template).toBeEnabled()
    expect(mip30Template).toBeEnabled()

    await user.click(mip30Template)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].id).toBe('fwd-invest-first-summit')
    expect(onSelect.mock.calls[0]?.[1].id).toBe('sgd-mip-30')
  })

  it('promotes FWD Invest First Max premium-payment-term corridors into executable templates', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'FWD Invest First Max')

    const card = getProductCard('FWD Invest First Max')

    expect(within(card).queryByText(/published corridors not modeled/i)).not.toBeInTheDocument()

    const mip11Template = within(card).getByRole('button', { name: /SGD \/ MIP 11/i })
    const mip30Template = within(card).getByRole('button', { name: /SGD \/ MIP 30/i })

    expect(mip11Template).toBeEnabled()
    expect(mip30Template).toBeEnabled()

    await user.click(mip30Template)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].id).toBe('fwd-invest-first-max')
    expect(onSelect.mock.calls[0]?.[1].id).toBe('sgd-mip-30')
  })

  it('promotes Invest flex wealth II 3-year and 5-year corridors into executable templates', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'Invest flex wealth II')

    const card = getProductCard('Invest flex wealth II')

    expect(within(card).queryByText(/published corridors not modeled/i)).not.toBeInTheDocument()

    const threeYearTemplate = within(card).getByRole('button', { name: /SGD \/ MIP 3/i })
    const fiveYearTemplate = within(card).getByRole('button', { name: /SGD \/ MIP 5/i })

    expect(threeYearTemplate).toBeEnabled()
    expect(fiveYearTemplate).toBeEnabled()

    await user.click(threeYearTemplate)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].id).toBe('etiqa-invest-flex-wealth-ii')
    expect(onSelect.mock.calls[0]?.[1].id).toBe('sgd-mip-3')
  })

  it('promotes Invest Wealth Purpose 3-year and 5-year corridors into executable templates', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'Invest Wealth Purpose')

    const card = getProductCard('Invest Wealth Purpose')

    expect(within(card).queryByText(/published corridors not modeled/i)).not.toBeInTheDocument()

    const threeYearTemplate = within(card).getByRole('button', { name: /SGD \/ MIP 3/i })
    const fiveYearTemplate = within(card).getByRole('button', { name: /SGD \/ MIP 5/i })

    expect(threeYearTemplate).toBeEnabled()
    expect(fiveYearTemplate).toBeEnabled()

    await user.click(threeYearTemplate)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].id).toBe('etiqa-invest-wealth-purpose')
    expect(onSelect.mock.calls[0]?.[1].id).toBe('sgd-mip-3')
  })

  it('renders Wealth Focus flexi gaps as disabled product cards', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={() => {}} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'Wealth Focus (Flexi 4)')

    const card = getProductCard('Wealth Focus (Flexi 4)')

    expect(within(card).getByText('Published only')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Use template/i })).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /SGD \/ MIP 10 years/i })).toBeDisabled()
    expect(within(card).getByRole('button', { name: /USD \/ MIP 10 years/i })).toBeDisabled()
  })

  it('collapses large disabled corridor families until expanded', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ProductPickerDialog open onOpenChange={() => {}} onSelect={() => {}} />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText(/search insurer or product name/i), 'TM Atlas Wealth')

    const card = getProductCard('TM Atlas Wealth')

    expect(within(card).queryByRole('button', { name: /SGD \/ Premium Payment Term 24 years \/ Advanced Death/i })).not.toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: /Show 34 more corridors/i }))

    expect(within(card).getByRole('button', { name: /SGD \/ Premium Payment Term 24 years \/ Advanced Death/i })).toBeDisabled()
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

  it('shows the exit timing calculator with exit-year tradeoff metrics and lets chart clicks update the cards', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<ExitTimingExplorer policy={policy} analysis={analysis} />)

    expect(screen.getByText('Exit Timing Calculator')).toBeInTheDocument()
    expect(screen.getByText('Net gap by exit year')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /bar chart showing net gap by exit year/i })).toBeInTheDocument()
    expect(screen.getByText('Withdrawable value vs added from now vs ETF benchmark')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /line chart showing withdrawable value, added contributions, and etf benchmark by exit year/i })).toBeInTheDocument()
    expect(screen.getByText('Added from now to exit')).toBeInTheDocument()
    expect(screen.getByText(/Contributions avoided vs year/i)).toBeInTheDocument()
    expect(screen.getByText(/includes year 0/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Year 9' }))

    expect(screen.getAllByText('Year 9').length).toBeGreaterThan(0)
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
    expect(screen.getByText('Dollar basis')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nominal' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: "Today's dollars" })).toBeInTheDocument()
  })

  it('shows expand controls for the fee breakdown charts and table', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    expect(screen.getByRole('button', { name: /expand annual fees chart/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand cumulative fees chart/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand fee table/i })).toBeInTheDocument()
  })

  it('shows an expand control for the compound effect chart', () => {
    render(
      <FeeImpactChart
        tiers={[
          { label: 'Low-cost ETF/robo', finalValue: 73372, drag: 0.003 },
          { label: 'This product', finalValue: 65464, drag: 0.017 },
          { label: 'High-cost product', finalValue: 61506, drag: 0.025 },
        ]}
        timeSeries={[
          { year: 0, lowCost: 0, thisProduct: 0, highCost: 0 },
          { year: 15, lowCost: 73372, thisProduct: 65464, highCost: 61506 },
        ]}
        tierDefs={[
          { label: 'Low-cost ETF/robo', key: 'lowCost', drag: 0.003, color: '#22c55e' },
          { label: 'This product', key: 'thisProduct', drag: 0.017, color: '#2563eb' },
          { label: 'High-cost product', key: 'highCost', drag: 0.025, color: '#ef4444' },
        ]}
        horizonYears={15}
        currency="SGD"
        monthlyContribution={350}
        useReal
      />,
    )

    expect(screen.getByRole('button', { name: /expand compound effect chart/i })).toBeInTheDocument()
  })

  it('reframes the wrapped story as a walkthrough with question-led cards', async () => {
    const user = userEvent.setup()
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)
    const waitForStoryAdvance = async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
    }

    render(<IlpFeeStory policy={policy} analysis={analysis} onClose={vi.fn()} />)

    expect(screen.getByText(/what this product may cost/i)).toBeInTheDocument()
    expect(screen.getByText(/estimated total fees over/i)).toBeInTheDocument()

    await user.keyboard(' ')
    await waitForStoryAdvance()
    await waitFor(() => expect(screen.getByText(/where the cost comes from/i)).toBeInTheDocument())

    await user.keyboard(' ')
    await waitForStoryAdvance()
    await waitFor(() => expect(screen.getByText(/how much bonuses really help/i)).toBeInTheDocument())

    await user.keyboard(' ')
    await waitForStoryAdvance()
    await waitFor(() => expect(screen.getByText(/what happens if you stop early/i)).toBeInTheDocument())
    expect(screen.getByText(/projected value after/i)).toBeInTheDocument()
    expect(screen.getByText(/total contributions/i)).toBeInTheDocument()
    expect(screen.getAllByText(/total fee cost/i).length).toBeGreaterThan(0)

    await user.keyboard(' ')
    await waitForStoryAdvance()
    await waitFor(() => expect(screen.getByText(/total out-of-pocket fees by exit year/i)).toBeInTheDocument())
    expect(screen.getByText(/exclude fund fees \(ocf\) from this view/i)).toBeInTheDocument()

    await user.keyboard(' ')
    await waitForStoryAdvance()
    await waitFor(() => expect(screen.getByText(/what to verify before deciding/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /continue walkthrough/i })).toBeInTheDocument()
  })

  it('defaults the wrapped story to nominal values so it matches the detail-view handoff', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    render(<IlpFeeStory policy={policy} analysis={analysis} onClose={vi.fn()} />)

    expect(screen.getByText(/nominal\)\./i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^nominal$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /today'?s \$/i })).not.toBeInTheDocument()
  })

  it('shows surrender-fee and withdrawable-value columns in the detailed fee table', () => {
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    if (analysis.mode !== 'projected') {
      throw new Error('Expected the default policy to produce a projected ILP analysis.')
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />)

    expect(screen.getByText('Surrender Fee')).toBeInTheDocument()
    expect(screen.getByText('Withdrawable Value')).toBeInTheDocument()
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

  it('separates regular-premium and single-premium products into distinct leaderboard tabs', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <IlpLeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: /regular premium/i })).toHaveAttribute('data-state', 'active')
    expect(screen.queryByText(/aia elite secure income - single premium/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /single premium/i }))

    expect(screen.getByRole('tab', { name: /single premium/i })).toHaveAttribute('data-state', 'active')
    expect(screen.getAllByText(/aia elite secure income - single premium/i).length).toBeGreaterThan(0)
  })

  it('supports standardized and custom basis modes for the regular-premium leaderboard only', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <IlpLeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: /standardized/i })).toHaveAttribute('data-state', 'active')
    expect(screen.queryByLabelText(/monthly premium/i)).not.toBeInTheDocument()

    const firstWealthVoyageRow = screen.getAllByText('Wealth Voyage')[0]?.closest('tr')
    const standardizedRowText = firstWealthVoyageRow?.textContent

    await user.click(screen.getByRole('tab', { name: /custom/i }))

    const monthlyPremiumInput = screen.getByLabelText(/monthly premium/i)
    expect(monthlyPremiumInput).toBeInTheDocument()
    expect(screen.getByText(/reranks regular-premium products only/i)).toBeInTheDocument()

    await user.clear(monthlyPremiumInput)
    await user.type(monthlyPremiumInput, '700')

    await waitFor(() => {
      const customWealthVoyageRow = screen.getAllByText('Wealth Voyage')[0]?.closest('tr')
      expect(customWealthVoyageRow?.textContent).not.toEqual(standardizedRowText)
    })

    await user.click(screen.getByRole('tab', { name: /single premium/i }))

    expect(screen.queryByLabelText(/monthly premium/i)).not.toBeInTheDocument()
    expect(screen.getByText(/single-premium products stay standardized here/i)).toBeInTheDocument()
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

  it('shows guidance that the story detail page is an estimate to confirm in policy documents', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/confirm your details/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /load this product/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    expect(await screen.findByText(/use this estimate as a guide/i)).toBeInTheDocument()
    expect(screen.getByText('Dollar basis')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^nominal$/i })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('tab', { name: /walkthrough/i })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('tab', { name: /detailed view/i })).toBeInTheDocument()
    expect(screen.getByText(/it is still a useful guide to help you visualize the fees this product could incur/i)).toBeInTheDocument()
    expect(screen.getByText(/past performance does not guarantee future performance/i)).toBeInTheDocument()
    expect(screen.getByText(/confirm the applicable charges, surrender values, bonuses, and fund details/i)).toBeInTheDocument()
    expect(screen.getByText(/want to compare this against your own cash flow/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/monthly take-home income \(sgd\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/monthly expenses \(sgd\)/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open planner inputs/i })).not.toBeInTheDocument()
    expect(screen.getByText(/the fee picture/i)).toBeInTheDocument()
    expect(screen.getByText(/how much bonuses cover/i)).toBeInTheDocument()
    expect(screen.getByText('S$1,050')).toBeInTheDocument()
    expect(screen.getByText(/lowest-fee exit year \(year 1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/if contributions continue to year 15/i)).toBeInTheDocument()
    expect(screen.getAllByText(/total fee cost/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /generate your ilp receipt/i })).toBeInTheDocument()
    expect(screen.queryByText(/^fee breakdown$/i)).not.toBeInTheDocument()

    const cashFlowHeading = screen.getByText(/how this compares against your own cash flow/i)
    const documentCheckHeading = screen.getByText(/what this estimate does not confirm/i)
    expect(cashFlowHeading.compareDocumentPosition(documentCheckHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: /today's dollars/i }))

    expect(screen.getByRole('tab', { name: /today's dollars/i })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('S$773')).toBeInTheDocument()
    expect(screen.getByText('31.9%')).toBeInTheDocument()
    expect(screen.queryByText('S$1,050')).not.toBeInTheDocument()
    expect(screen.queryByText('41.7%')).not.toBeInTheDocument()
  })

  it('switches the story detail route from walkthrough to detailed view', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /load this product/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    await user.click(screen.getByRole('tab', { name: /detailed view/i }))

    expect(screen.getByRole('tab', { name: /detailed view/i })).toHaveAttribute('data-state', 'active')
    expect(await screen.findByText(/^fee breakdown$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand annual fees chart/i })).toBeInTheDocument()
  })

  it('lets users reopen the wrapped story from the story detail header', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /load this product/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    expect(await screen.findByRole('button', { name: /replay walkthrough/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /replay walkthrough/i }))

    expect(await screen.findByText(/what this product may cost/i)).toBeInTheDocument()
    expect(screen.getByText(/estimated total fees over/i)).toBeInTheDocument()
  })

  it('lets non-planner users add a quick cash-flow entry on the story detail page', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /load this product/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    await user.clear(screen.getByLabelText(/monthly take-home income \(sgd\)/i))
    await user.type(screen.getByLabelText(/monthly take-home income \(sgd\)/i), '5000')
    await user.clear(screen.getByLabelText(/monthly expenses \(sgd\)/i))
    await user.type(screen.getByLabelText(/monthly expenses \(sgd\)/i), '3200')

    expect(screen.getByText(/estimated monthly surplus/i)).toBeInTheDocument()
    expect(screen.getByText('S$1,800')).toBeInTheDocument()
    expect(screen.getByText(/this policy's monthly premium/i)).toBeInTheDocument()
    expect(screen.getByText(/surplus left after premium/i)).toBeInTheDocument()
    expect(screen.getByText(/liquidity lens/i)).toBeInTheDocument()
    expect(screen.getByText(/premium as share of take-home pay/i)).toBeInTheDocument()
    expect(screen.getByText(/liquid cash-flow margin after premium/i)).toBeInTheDocument()
    expect(screen.getByText(/monthly premium uses 19.4% of your entered monthly surplus/i)).toBeInTheDocument()
  })

  it('treats a thin positive liquid margin after premium as caution rather than success', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /load this product/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    await user.clear(screen.getByLabelText(/monthly take-home income \(sgd\)/i))
    await user.type(screen.getByLabelText(/monthly take-home income \(sgd\)/i), '4000')
    await user.clear(screen.getByLabelText(/monthly expenses \(sgd\)/i))
    await user.type(screen.getByLabelText(/monthly expenses \(sgd\)/i), '3300')

    expect(screen.getByText(/thin liquid margin/i)).toBeInTheDocument()
    expect(screen.getByText(/that is still a thin liquid buffer/i)).toBeInTheDocument()
    expect(screen.queryByText(/remaining cash flow still matters because this premium is less liquid/i)).not.toBeInTheDocument()
  })

  it('prefills the story cash-flow check from saved planner values when they exist', async () => {
    const user = userEvent.setup()

    act(() => {
      const householdStore = useHouseholdPlanStore.getState()
      householdStore.initializeManualPlan('individual')

      const selfAdult = useHouseholdPlanStore.getState().plan.adults.find((adult) => adult.owner === 'self')
      if (!selfAdult) {
        throw new Error('Expected a self adult in the household plan.')
      }

      householdStore.updateAdult(selfAdult.id, {
        currentAge: 35,
        annualIncome: 96_000,
        annualExpenses: 36_000,
      })

      const salaryModel = useHouseholdPlanStore.getState().plan.income.find((entry) => (
        entry.kind === 'salary-model'
        && entry.owner === 'self'
        && entry.timing.kind === 'age-range'
      ))
      if (!salaryModel || salaryModel.timing.kind !== 'age-range') {
        throw new Error('Expected a seeded self salary model entry.')
      }
      householdStore.updateIncome(salaryModel.id, {
        annualAmount: 96_000,
      })

      const baseExpense = useHouseholdPlanStore.getState().plan.expenses.find((entry) => (
        entry.kind === 'base-living'
        && entry.owner === 'self'
        && entry.timing.kind === 'age-range'
      ))
      if (!baseExpense || baseExpense.timing.kind !== 'age-range') {
        throw new Error('Expected a seeded self base-living expense entry.')
      }
      householdStore.updateExpense(baseExpense.id, {
        amount: 36_000,
        periodicity: 'annual',
      })
    })

    render(
      <MemoryRouter initialEntries={['/ilp-fees/story/aia-elite-secure-income-5-pay']}>
        <Routes>
          <Route path="/ilp-fees/story/:productId" element={<IlpStoryModePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /load this product/i }))
    await user.click(await screen.findByRole('button', { name: /close/i }))

    const expensesInput = screen.getByLabelText(/monthly expenses \(sgd\)/i) as HTMLInputElement

    expect(screen.getByText(/these fields start with your saved planner income and spending/i)).toBeInTheDocument()
    expect(screen.getByText(/estimated monthly surplus/i)).toBeInTheDocument()
    expect(expensesInput.value).not.toBe('S$0')
    expect(screen.queryByRole('link', { name: /open planner inputs/i })).not.toBeInTheDocument()
  })
})
