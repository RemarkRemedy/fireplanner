import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HTMLAttributes, ReactNode } from 'react'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { formatIlpCurrency } from './formatters'
import { ExitReinvestmentBenchmarkSection } from './ExitReinvestmentBenchmarkSection'
import { buildExitReinvestmentBenchmark } from './exitReinvestmentBenchmark'

vi.mock('recharts', () => {
  const Container = ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return {
    ResponsiveContainer: Container,
    LineChart: Container,
    BarChart: Container,
    Line: () => null,
    Bar: () => null,
    Cell: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
  }
})

describe('ExitReinvestmentBenchmarkSection', () => {
  it('renders the switch-out benchmark charts and updates the benchmark return assumption', async () => {
    const user = userEvent.setup()
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    const benchmark = buildExitReinvestmentBenchmark(policy, analysis)
    const firstPenaltyFree = benchmark.options.find((option) => option.exitYear > 0 && option.isPenaltyFree)
    expect(firstPenaltyFree).toBeTruthy()

    render(
      <ExitReinvestmentBenchmarkSection
        policy={policy}
        analysis={analysis}
      />,
    )

    expect(screen.getByText('If you exit and invest outside instead')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /line chart showing ilp hold value and selected exit-and-invest-outside path/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /bar chart showing horizon value for each exit year/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Year 6')
    expect(screen.getByText(formatIlpCurrency(firstPenaltyFree!.horizonValueAt4, policy.currency))).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '7% nominal' }))

    expect(screen.getByText(formatIlpCurrency(firstPenaltyFree!.horizonValueAt7, policy.currency))).toBeInTheDocument()
  })
})
