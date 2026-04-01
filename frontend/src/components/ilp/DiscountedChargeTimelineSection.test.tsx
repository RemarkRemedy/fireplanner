import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { DiscountedChargeTimelineSection } from './DiscountedChargeTimelineSection'

describe('DiscountedChargeTimelineSection', () => {
  it('renders the detailed real-dollar chart and fact-check table', () => {
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    render(
      <DiscountedChargeTimelineSection
        policy={policy}
        analysis={analysis}
      />,
    )

    expect(screen.getByText('Total Out-of-Pocket Fees by Exit Year')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /total out-of-pocket ilp fees by exit year/i })).toBeInTheDocument()
    expect(screen.getByText('Exit Year')).toBeInTheDocument()
    expect(screen.queryByText('Policy Year')).not.toBeInTheDocument()
    expect(screen.getByText('Cumu. policy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show 11 more exit years/i })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('6')).not.toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('S$5,341')).not.toBeInTheDocument()
  })

  it('lets the user exclude fund fees from the detailed view', async () => {
    const user = userEvent.setup()
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    render(
      <DiscountedChargeTimelineSection
        policy={policy}
        analysis={analysis}
      />,
    )

    await user.click(screen.getByRole('button', { name: /show 11 more exit years/i }))
    expect(screen.getByText('S$5,341')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Exclude fund fees (OCF) from this view'))

    expect(screen.getByText('S$1,646')).toBeInTheDocument()
    expect(screen.queryByText('Cum. fund')).not.toBeInTheDocument()
  })

  it('expands the table after the first five rows', async () => {
    const user = userEvent.setup()
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    render(
      <DiscountedChargeTimelineSection
        policy={policy}
        analysis={analysis}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).queryByText('6')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show 11 more exit years/i }))

    expect(within(table).getByText('6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show fewer rows/i })).toBeInTheDocument()
  })
})
