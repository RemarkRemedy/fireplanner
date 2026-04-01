import { render, screen, fireEvent } from '@testing-library/react'
import PaRateVisualizer from '@/components/interactive/PaRateVisualizer'

describe('PaRateVisualizer', () => {
  it('renders with default values (30% PA, $200 premium)', () => {
    render(<PaRateVisualizer />)

    // Slider shows 30%
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.value).toBe('30')

    // Premium input shows 200
    const premiumInput = screen.getByRole('spinbutton') as HTMLInputElement
    expect(premiumInput.value).toBe('200')

    // Summary text: 30% of $200 = $60
    expect(screen.getByTestId('summary-text')).toHaveTextContent(
      'Each month in Year 1, only $60 of your $200 premium is invested.'
    )
  })

  it('at min PA rate (20%): only $40 of $200 invested', () => {
    render(<PaRateVisualizer />)

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '20' } })

    expect(screen.getByTestId('summary-text')).toHaveTextContent(
      'Each month in Year 1, only $40 of your $200 premium is invested.'
    )

    // Legend shows correct amounts
    expect(screen.getByText(/Invested: \$40/)).toBeInTheDocument()
    expect(screen.getByText(/Charges: \$160/)).toBeInTheDocument()
  })

  it('at max PA rate (100%): $0 charges, full $200 invested', () => {
    render(<PaRateVisualizer />)

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '100' } })

    expect(screen.getByTestId('summary-text')).toHaveTextContent(
      'Each month in Year 1, only $200 of your $200 premium is invested.'
    )

    expect(screen.getByText(/Invested: \$200/)).toBeInTheDocument()
    expect(screen.getByText(/Charges: \$0/)).toBeInTheDocument()

    // Charges segment should have 0% width
    const chargesSegment = screen.getByTestId('charges-segment')
    expect(chargesSegment.style.width).toBe('0%')
  })

  it('custom premium input: changing to $500 updates the display', () => {
    render(<PaRateVisualizer />)

    const premiumInput = screen.getByRole('spinbutton')
    fireEvent.change(premiumInput, { target: { value: '500' } })

    // Default 30% of $500 = $150 invested, $350 charges
    expect(screen.getByTestId('summary-text')).toHaveTextContent(
      'Each month in Year 1, only $150 of your $500 premium is invested.'
    )

    expect(screen.getByText(/Invested: \$150/)).toBeInTheDocument()
    expect(screen.getByText(/Charges: \$350/)).toBeInTheDocument()
  })

  it('text matches "Each month in Year 1, only $X of your $Y premium is invested" format', () => {
    render(<PaRateVisualizer />)

    const summary = screen.getByTestId('summary-text')
    expect(summary.textContent).toMatch(
      /^Each month in Year 1, only \$\d+ of your \$\d+ premium is invested\.$/
    )
  })

  it('edge case: $0 premium shows $0/$0', () => {
    render(<PaRateVisualizer />)

    const premiumInput = screen.getByRole('spinbutton')
    fireEvent.change(premiumInput, { target: { value: '0' } })

    expect(screen.getByTestId('summary-text')).toHaveTextContent(
      'Each month in Year 1, only $0 of your $0 premium is invested.'
    )

    expect(screen.getByText(/Invested: \$0/)).toBeInTheDocument()
    expect(screen.getByText(/Charges: \$0/)).toBeInTheDocument()
  })

  it('invested segment width reflects PA rate', () => {
    render(<PaRateVisualizer />)

    // Default 30%
    const investedSegment = screen.getByTestId('invested-segment')
    expect(investedSegment.style.width).toBe('30%')

    // Change to 75%
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '75' } })
    expect(investedSegment.style.width).toBe('75%')
  })

  it('negative premium input is clamped to 0', () => {
    render(<PaRateVisualizer />)

    const premiumInput = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(premiumInput, { target: { value: '-50' } })

    expect(premiumInput.value).toBe('0')
    expect(screen.getByTestId('summary-text')).toHaveTextContent(
      'Each month in Year 1, only $0 of your $0 premium is invested.'
    )
  })
})
