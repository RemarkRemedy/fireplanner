import { useState } from 'react'
import {
  ILP_FEE_RATE,
  ILP_FEE_OPTIONS,
  TERM_LIFE_MONTHLY,
  ETF_EXPENSE_RATIO,
  EXPECTED_ANNUAL_RETURN,
  POLICY_TERMS,
  DEFAULT_POLICY_TERM,
  DEFAULT_MONTHLY_PREMIUM,
  FEE_DISCLAIMER,
  CALCULATOR_PATH,
} from '@/lib/ilp-constants'

interface FeeResult {
  totalFees: number
  finalPortfolio: number
}

/**
 * Calculate cumulative fees for a given investment path.
 *
 * For each year: portfolio grows by expectedReturn, then annual fee is deducted,
 * then new contributions are added. Term life cost (if any) is added to totalFees
 * but does not reduce the investment portfolio.
 */
export function calculateFees(
  monthlyPremium: number,
  termYears: number,
  feeRate: number,
  termLifeMonthlyCost: number
): FeeResult {
  let portfolioValue = 0
  let totalFees = 0
  const annualContribution = monthlyPremium * 12

  for (let year = 1; year <= termYears; year++) {
    portfolioValue *= 1 + EXPECTED_ANNUAL_RETURN
    const annualFee = portfolioValue * feeRate
    portfolioValue -= annualFee
    totalFees += annualFee
    totalFees += termLifeMonthlyCost * 12
    portfolioValue += annualContribution
  }

  return { totalFees, finalPortfolio: portfolioValue }
}

function formatDollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

export default function FeeComparisonSlider() {
  const [premium, setPremium] = useState(DEFAULT_MONTHLY_PREMIUM)
  const [term, setTerm] = useState<number>(DEFAULT_POLICY_TERM)
  const [ilpFeeRate, setIlpFeeRate] = useState(ILP_FEE_RATE)

  const ilp = calculateFees(premium, term, ilpFeeRate, 0)
  const btir = calculateFees(premium, term, ETF_EXPENSE_RATIO, TERM_LIFE_MONTHLY)

  const difference = ilp.totalFees - btir.totalFees
  const maxFees = Math.max(ilp.totalFees, btir.totalFees, 1) // avoid div by zero
  const ilpBarWidth = (ilp.totalFees / maxFees) * 100
  const btirBarWidth = (btir.totalFees / maxFees) * 100

  return (
    <div className="not-prose my-8 rounded-lg border border-border bg-card p-6 font-sans">
      <h3 className="mb-4 text-lg font-semibold text-card-foreground">
        Fee Comparison: ILP vs Term Life + ETF
      </h3>

      {/* Controls */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {/* Monthly Premium Input */}
        <div>
          <label
            htmlFor="fee-premium-input"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Monthly Premium
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              id="fee-premium-input"
              type="number"
              min={0}
              step={50}
              value={premium}
              onChange={(e) => {
                const val = Number(e.target.value)
                setPremium(val >= 0 ? val : 0)
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pl-7 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Policy Term Select */}
        <div>
          <label
            htmlFor="fee-term-select"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Policy Term
          </label>
          <select
            id="fee-term-select"
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {POLICY_TERMS.map((t) => (
              <option key={t} value={t}>
                {t} years
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ILP Fee Rate Toggle */}
      <div className="mb-6">
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          ILP fee level
        </span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ILP fee level">
          {ILP_FEE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={ilpFeeRate === option.value}
              onClick={() => setIlpFeeRate(option.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                ilpFeeRate === option.value
                  ? 'border-orange-500 bg-orange-50 font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                  : 'border-border bg-background text-muted-foreground hover:border-orange-300 hover:text-card-foreground'
              }`}
              data-testid={`fee-option-${option.value}`}
            >
              {option.label} <span className="text-xs opacity-70">({option.description})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fee Bars */}
      <div className="mb-4 space-y-3">
        {/* ILP Bar */}
        <div>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-card-foreground">ILP fees</span>
            <span className="font-semibold text-orange-600" data-testid="ilp-fee-amount">
              {formatDollars(ilp.totalFees)}
            </span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-orange-500 transition-all duration-300 ease-in-out"
              style={{ width: `${ilpBarWidth}%` }}
              data-testid="ilp-bar"
            />
          </div>
        </div>

        {/* BTIR Bar */}
        <div>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-card-foreground">
              Term life + ETF fees
            </span>
            <span className="font-semibold text-teal-600" data-testid="btir-fee-amount">
              {formatDollars(btir.totalFees)}
            </span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-teal-500 transition-all duration-300 ease-in-out"
              style={{ width: `${btirBarWidth}%` }}
              data-testid="btir-bar"
            />
          </div>
        </div>
      </div>

      {/* Difference Callout */}
      <div
        className="mb-4 rounded-md bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-200"
        data-testid="difference-callout"
      >
        {difference > 0
          ? `You'd keep ~${formatDollars(difference)} more with term life + ETF`
          : 'Both paths have similar cumulative costs at this level.'}
      </div>

      {/* Collapsible Assumptions */}
      <details className="mb-4">
        <summary
          className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-card-foreground"
          data-testid="assumptions-toggle"
        >
          How we calculated this
        </summary>
        <div className="mt-2 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              ILP annual fee: {(ilpFeeRate * 100).toFixed(1)}% of portfolio
              (you can adjust this above)
            </li>
            <li>
              ETF expense ratio: {(ETF_EXPENSE_RATIO * 100).toFixed(2)}% (e.g.
              VWRA)
            </li>
            <li>
              Term life premium: {formatDollars(TERM_LIFE_MONTHLY)}/mo (healthy
              non-smoker, 20s, ~$200K coverage)
            </li>
            <li>
              Expected annual return: {(EXPECTED_ANNUAL_RETURN * 100).toFixed(0)}
              % (both paths)
            </li>
            <li>
              Contributions: {formatDollars(premium)}/mo for {term} years
            </li>
          </ul>
        </div>
      </details>

      {/* Disclaimer */}
      <p
        className="mb-4 text-xs text-muted-foreground"
        data-testid="disclaimer"
      >
        {FEE_DISCLAIMER}
      </p>

      {/* CTA */}
      <a
        href={`${CALCULATOR_PATH}?utm_source=blog&utm_content=fee_slider`}
        className="inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        data-testid="cta-link"
      >
        Want the full breakdown with your actual ILP? Try the fee calculator
      </a>
    </div>
  )
}
