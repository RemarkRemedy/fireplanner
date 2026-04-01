import { useState } from 'react'
import {
  DEFAULT_PA_RATE,
  MIN_PA_RATE,
  MAX_PA_RATE,
  DEFAULT_MONTHLY_PREMIUM,
} from '@/lib/ilp-constants'

function formatDollars(amount: number): string {
  return `$${amount.toFixed(0)}`
}

export default function PaRateVisualizer() {
  const [paRate, setPaRate] = useState(DEFAULT_PA_RATE)
  const [premium, setPremium] = useState(DEFAULT_MONTHLY_PREMIUM)

  const investedAmount = premium * paRate
  const chargesAmount = premium * (1 - paRate)
  const investedPercent = paRate * 100
  const chargesPercent = (1 - paRate) * 100

  return (
    <div className="not-prose my-8 rounded-lg border border-border bg-card p-6 font-sans">
      <h3 className="mb-4 text-lg font-semibold text-card-foreground">
        Premium Allocation Breakdown
      </h3>

      {/* Controls */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {/* PA Rate Slider */}
        <div>
          <label
            htmlFor="pa-rate-slider"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Premium Allocation Rate:{' '}
            <span className="font-semibold text-card-foreground">
              {Math.round(paRate * 100)}%
            </span>
          </label>
          <input
            id="pa-rate-slider"
            type="range"
            min={MIN_PA_RATE * 100}
            max={MAX_PA_RATE * 100}
            step={1}
            value={Math.round(paRate * 100)}
            onChange={(e) => setPaRate(Number(e.target.value) / 100)}
            className="w-full accent-teal-600"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(MIN_PA_RATE * 100)}%</span>
            <span>{Math.round(MAX_PA_RATE * 100)}%</span>
          </div>
        </div>

        {/* Premium Input */}
        <div>
          <label
            htmlFor="premium-input"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Monthly Premium
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              id="premium-input"
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
      </div>

      {/* Animated Bar */}
      <div className="mb-3 overflow-hidden rounded-md" aria-hidden="true">
        <div className="flex h-10 w-full">
          {/* Invested segment */}
          <div
            className="flex items-center justify-center bg-teal-600 text-sm font-medium text-white transition-all duration-300 ease-in-out"
            style={{ width: `${investedPercent}%` }}
            data-testid="invested-segment"
          >
            {investedPercent >= 15 && formatDollars(investedAmount)}
          </div>
          {/* Charges segment */}
          <div
            className="flex items-center justify-center bg-gray-400 text-sm font-medium text-white transition-all duration-300 ease-in-out"
            style={{ width: `${chargesPercent}%` }}
            data-testid="charges-segment"
          >
            {chargesPercent >= 15 && formatDollars(chargesAmount)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-teal-600" />
          Invested: {formatDollars(investedAmount)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-400" />
          Charges: {formatDollars(chargesAmount)}
        </span>
      </div>

      {/* Summary text */}
      <p className="text-sm text-muted-foreground" data-testid="summary-text">
        Each month in Year 1, only {formatDollars(investedAmount)} of your{' '}
        {formatDollars(premium)} premium is invested.
      </p>
    </div>
  )
}
