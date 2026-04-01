import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HTMLAttributes, ReactNode } from 'react'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { formatIlpCurrency } from './formatters'
import { ExitReinvestmentBenchmarkSection } from './ExitReinvestmentBenchmarkSection'
import { buildExitReinvestmentBenchmark, buildIlpScenarioAnalyses } from './exitReinvestmentBenchmark'

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
  it('renders the switch-out benchmark charts and updates both ILP and outside return assumptions', async () => {
    const user = userEvent.setup()
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    const scenarioAnalyses = buildIlpScenarioAnalyses(policy)
    const benchmark = buildExitReinvestmentBenchmark(policy, scenarioAnalyses['8'])
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
    expect(screen.getByText(formatIlpCurrency(firstPenaltyFree!.horizonValues['4'], policy.currency))).toBeInTheDocument()

    const ilpTabs = screen.getByRole('tablist', { name: /ilp gross return assumption/i })
    const outsideTabs = screen.getByRole('tablist', { name: /outside return assumption/i })

    await user.click(within(outsideTabs).getByRole('tab', { name: '7%' }))

    expect(screen.getByText(formatIlpCurrency(firstPenaltyFree!.horizonValues['7'], policy.currency))).toBeInTheDocument()

    const keepAt10 = scenarioAnalyses['10'].projections.mid.rows.at(-1)?.combinedValue ?? 0
    await user.click(within(ilpTabs).getByRole('tab', { name: '10%' }))

    expect(screen.getByText(formatIlpCurrency(keepAt10, policy.currency))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /adjust ocf \/ ter/i }))
    await user.clear(screen.getByRole('spinbutton', { name: /External TER/i }))
    await user.type(screen.getByRole('spinbutton', { name: /External TER/i }), '0.5')
    await user.tab()
    await user.clear(screen.getByRole('spinbutton', { name: /ILP blended OCF/i }))
    await user.type(screen.getByRole('spinbutton', { name: /ILP blended OCF/i }), '1.0')
    await user.tab()

    expect(screen.getAllByText(/6\.5% net after TER/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/9\.0% net before other policy effects/i)).toBeInTheDocument()
  })
})
