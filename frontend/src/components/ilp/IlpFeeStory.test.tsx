import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { createDefaultPolicy } from '@/stores/useIlpStore'

describe('IlpFeeStory', () => {
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
})
