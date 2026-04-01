import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { createDefaultPolicy } from '@/stores/useIlpStore'
import { mergePolicySeed } from '@/stores/useIlpStore'

describe('IlpFeeStory', () => {
  async function advanceStory(user: ReturnType<typeof userEvent.setup>) {
    await user.keyboard('{ArrowRight}')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
    })
  }

  it('adds a rotating everyday-yardsticks lens to the headline cost card', async () => {
    const user = userEvent.setup()
    const policy = createDefaultPolicy()
    const analysis = analyzeIlpPolicy(policy)

    render(<IlpFeeStory policy={policy} analysis={analysis} onClose={vi.fn()} />)

    expect(screen.getByText('Everyday yardsticks')).toBeInTheDocument()
    expect(screen.getByText(/in today's dollars, that is/i)).toBeInTheDocument()
    expect(screen.getByText('1 of 20')).toBeInTheDocument()
    const firstExample = screen.getByText(/in today's dollars, that is/i).textContent

    await user.click(screen.getByRole('button', { name: 'Show another example' }))

    await waitFor(() => expect(screen.getByText(/2 of 20/i)).toBeInTheDocument())
    expect(screen.getByText(/in today's dollars, that is/i).textContent).not.toBe(firstExample)
  })

  it('shows first penalty-free exit separately from horizon-end value for finite-MIP story seeds', async () => {
    const user = userEvent.setup()
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()
    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)

    render(<IlpFeeStory policy={policy} analysis={analysis} onClose={vi.fn()} />)

    await advanceStory(user)
    expect(await screen.findByText('Where the cost comes from')).toBeInTheDocument()
    await advanceStory(user)
    expect(await screen.findByText('How much bonuses really help')).toBeInTheDocument()
    await advanceStory(user)
    expect(await screen.findByText('What happens if you stop early')).toBeInTheDocument()
    expect(await screen.findByText('First penalty-free exit')).toBeInTheDocument()
    expect(screen.getByText('Lowest fee-burden exit')).toBeInTheDocument()
    expect(screen.getByText('If you keep the policy')).toBeInTheDocument()
    expect(screen.getByText('Year 6')).toBeInTheDocument()
    expect(screen.getByText('Projected value after 15 years')).toBeInTheDocument()
    expect(screen.getByText('S$39,992')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('Value available') && content.includes('S$21,938'))).toBeInTheDocument()

    await advanceStory(user)
    expect(await screen.findByText('Total out-of-pocket fees by exit year')).toBeInTheDocument()
  })

  it('lets the user exclude fund fees from the discounted charge story card', async () => {
    const user = userEvent.setup()
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()
    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)

    render(<IlpFeeStory policy={policy} analysis={analysis} onClose={vi.fn()} />)

    await advanceStory(user)
    await advanceStory(user)
    await advanceStory(user)
    await advanceStory(user)
    expect(await screen.findByText('Total out-of-pocket fees by exit year')).toBeInTheDocument()

    expect(screen.getByText(/including fund fees/i)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Exclude fund fees (OCF) from this view' }))

    expect(screen.getByText(/excluding fund fees/i)).toBeInTheDocument()
  })
})
