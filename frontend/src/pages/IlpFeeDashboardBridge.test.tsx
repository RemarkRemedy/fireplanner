import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { createDefaultPolicy, useIlpStore } from '@/stores/useIlpStore'
import { IlpLandingPage } from './IlpLandingPage'
import { IlpReviewPage } from './IlpReviewPage'

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
})
