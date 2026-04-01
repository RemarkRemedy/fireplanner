import { render, screen, fireEvent } from '@testing-library/react'
import FeeComparisonSlider, {
  calculateFees,
} from '@/components/interactive/FeeComparisonSlider'
import {
  ILP_FEE_RATE,
  ETF_EXPENSE_RATIO,
  TERM_LIFE_MONTHLY,
  EXPECTED_ANNUAL_RETURN,
  DEFAULT_MONTHLY_PREMIUM,
  DEFAULT_POLICY_TERM,
  FEE_DISCLAIMER,
  CALCULATOR_PATH,
} from '@/lib/ilp-constants'

// ─── Pure function tests ────────────────────────────────────────────────────

describe('calculateFees (pure function)', () => {
  it('returns zero fees when premium is $0 and no term life cost', () => {
    const result = calculateFees(0, 25, ILP_FEE_RATE, 0)
    expect(result.totalFees).toBe(0)
    expect(result.finalPortfolio).toBe(0)
  })

  it('returns only term life cost when premium is $0 with term life', () => {
    const result = calculateFees(0, 25, ETF_EXPENSE_RATIO, TERM_LIFE_MONTHLY)
    // No portfolio grows, so ETF fee = 0, but term life cost accrues
    expect(result.totalFees).toBe(TERM_LIFE_MONTHLY * 12 * 25)
    expect(result.finalPortfolio).toBe(0)
  })

  it('ILP fees > BTIR fees for typical inputs', () => {
    const ilp = calculateFees(200, 25, ILP_FEE_RATE, 0)
    const btir = calculateFees(200, 25, ETF_EXPENSE_RATIO, TERM_LIFE_MONTHLY)
    expect(ilp.totalFees).toBeGreaterThan(btir.totalFees)
  })

  it('fees scale with premium amount', () => {
    const low = calculateFees(100, 25, ILP_FEE_RATE, 0)
    const high = calculateFees(400, 25, ILP_FEE_RATE, 0)
    expect(high.totalFees).toBeGreaterThan(low.totalFees)
  })

  it('fees increase with longer term', () => {
    const short = calculateFees(200, 15, ILP_FEE_RATE, 0)
    const long = calculateFees(200, 30, ILP_FEE_RATE, 0)
    expect(long.totalFees).toBeGreaterThan(short.totalFees)
  })

  it('produces consistent results (deterministic)', () => {
    const a = calculateFees(200, 25, ILP_FEE_RATE, 0)
    const b = calculateFees(200, 25, ILP_FEE_RATE, 0)
    expect(a.totalFees).toBe(b.totalFees)
    expect(a.finalPortfolio).toBe(b.finalPortfolio)
  })

  it('manual calculation check for 1 year, $1200/yr, 3% fee', () => {
    // Year 1: portfolio starts at 0, grows by 6% -> 0, fee = 0, then add $1200
    // So totalFees should be 0 for a single year with no prior balance
    const result = calculateFees(100, 1, 0.03, 0)
    // Start: 0, grow: 0, fee: 0, add 1200 -> portfolio = 1200, totalFees = 0
    expect(result.totalFees).toBe(0)
    expect(result.finalPortfolio).toBe(1200)
  })

  it('manual calculation check for 2 years, $100/mo, 3% fee', () => {
    // Year 1: start=0, grow=0, fee=0, add 1200 -> portfolio=1200, totalFees=0
    // Year 2: start=1200, grow=1200*1.06=1272, fee=1272*0.03=38.16,
    //   portfolio=1272-38.16=1233.84, add 1200 -> portfolio=2433.84, totalFees=38.16
    const result = calculateFees(100, 2, 0.03, 0)
    expect(result.totalFees).toBeCloseTo(38.16, 2)
    expect(result.finalPortfolio).toBeCloseTo(2433.84, 2)
  })
})

// ─── Component tests ────────────────────────────────────────────────────────

describe('FeeComparisonSlider', () => {
  it('renders with defaults ($200/mo, 25 years)', () => {
    render(<FeeComparisonSlider />)

    const premiumInput = screen.getByRole('spinbutton') as HTMLInputElement
    expect(premiumInput.value).toBe(String(DEFAULT_MONTHLY_PREMIUM))

    const termSelect = screen.getByRole('combobox') as HTMLSelectElement
    expect(termSelect.value).toBe(String(DEFAULT_POLICY_TERM))

    // Both fee amounts should be rendered
    expect(screen.getByTestId('ilp-fee-amount')).toBeInTheDocument()
    expect(screen.getByTestId('btir-fee-amount')).toBeInTheDocument()
  })

  it('ILP fees > BTIR fees (ILP bar is always wider)', () => {
    render(<FeeComparisonSlider />)

    const ilpBar = screen.getByTestId('ilp-bar')
    const btirBar = screen.getByTestId('btir-bar')

    const ilpWidth = parseFloat(ilpBar.style.width)
    const btirWidth = parseFloat(btirBar.style.width)

    expect(ilpWidth).toBeGreaterThan(btirWidth)
    // ILP bar should be 100% (it's the max)
    expect(ilpWidth).toBe(100)
  })

  it('changing policy term updates both bars', () => {
    render(<FeeComparisonSlider />)

    // Get initial fee amounts
    const ilpAmount = screen.getByTestId('ilp-fee-amount').textContent
    const btirAmount = screen.getByTestId('btir-fee-amount').textContent

    // Change term to 15 years
    const termSelect = screen.getByRole('combobox')
    fireEvent.change(termSelect, { target: { value: '15' } })

    // Both amounts should have changed (shorter term = lower fees)
    expect(screen.getByTestId('ilp-fee-amount').textContent).not.toBe(ilpAmount)
    expect(screen.getByTestId('btir-fee-amount').textContent).not.toBe(btirAmount)
  })

  it('changing premium updates both bars', () => {
    render(<FeeComparisonSlider />)

    const ilpAmount = screen.getByTestId('ilp-fee-amount').textContent
    const btirAmount = screen.getByTestId('btir-fee-amount').textContent

    const premiumInput = screen.getByRole('spinbutton')
    fireEvent.change(premiumInput, { target: { value: '500' } })

    expect(screen.getByTestId('ilp-fee-amount').textContent).not.toBe(ilpAmount)
    expect(screen.getByTestId('btir-fee-amount').textContent).not.toBe(btirAmount)
  })

  it('$0 premium: ILP shows $0, BTIR still has term life cost', () => {
    render(<FeeComparisonSlider />)

    const premiumInput = screen.getByRole('spinbutton')
    fireEvent.change(premiumInput, { target: { value: '0' } })

    expect(screen.getByTestId('ilp-fee-amount').textContent).toBe('$0')

    // BTIR should still show term life cost: $30/mo * 12 * 25 = $9,000
    const expectedTermLifeCost = TERM_LIFE_MONTHLY * 12 * DEFAULT_POLICY_TERM
    expect(screen.getByTestId('btir-fee-amount').textContent).toBe(
      `$${Math.round(expectedTermLifeCost).toLocaleString('en-US')}`
    )
  })

  it('difference callout shows correct value (ILP fees - BTIR fees)', () => {
    render(<FeeComparisonSlider />)

    const ilp = calculateFees(DEFAULT_MONTHLY_PREMIUM, DEFAULT_POLICY_TERM, ILP_FEE_RATE, 0)
    const btir = calculateFees(
      DEFAULT_MONTHLY_PREMIUM,
      DEFAULT_POLICY_TERM,
      ETF_EXPENSE_RATIO,
      TERM_LIFE_MONTHLY
    )
    const diff = Math.round(ilp.totalFees - btir.totalFees)

    const callout = screen.getByTestId('difference-callout')
    expect(callout.textContent).toContain(
      `$${diff.toLocaleString('en-US')}`
    )
    expect(callout.textContent).toContain('more with term life + ETF')
  })

  it('"How we calculated this" section toggles open/closed', () => {
    render(<FeeComparisonSlider />)

    const details = screen.getByTestId('assumptions-toggle').closest('details')!

    // Initially closed (no open attribute)
    expect(details).not.toHaveAttribute('open')

    // Click to open
    fireEvent.click(screen.getByTestId('assumptions-toggle'))
    expect(details.open).toBe(true)

    // Click to close
    fireEvent.click(screen.getByTestId('assumptions-toggle'))
    expect(details.open).toBe(false)
  })

  it('CTA link contains correct UTM params and path', () => {
    render(<FeeComparisonSlider />)

    const link = screen.getByTestId('cta-link') as HTMLAnchorElement
    expect(link.href).toContain(CALCULATOR_PATH)
    expect(link.href).toContain('utm_source=blog')
    expect(link.href).toContain('utm_content=fee_slider')
  })

  it('disclaimer text renders', () => {
    render(<FeeComparisonSlider />)

    const disclaimer = screen.getByTestId('disclaimer')
    expect(disclaimer.textContent).toBe(FEE_DISCLAIMER)
  })
})
