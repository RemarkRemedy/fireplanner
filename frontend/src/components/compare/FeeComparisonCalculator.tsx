import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { ROBO_FEES, getFeeRate, type PlatformFees } from '@/lib/data/roboFees'
import { formatCurrency } from '@/lib/utils'

const MIN_PORTFOLIO = 50_000
const MAX_PORTFOLIO = 2_000_000
const STEP = 10_000
const DEFAULT_PORTFOLIO = 500_000
const ANNUAL_RETURN = 0.07
const ASSUMED_INFLATION = 0.025
const YEARS = 30

interface PlatformRow {
  name: string
  feeRate: number
  nominalCost: number
  realCost: number
  isSgFirePlanner: boolean
  sourceUrl: string
}

/** Platforms with pricing pages to link to in the disclaimer */
const PRICING_LINKS: { name: string; url: string }[] = ROBO_FEES
  .filter((p: PlatformFees) => p.sourceUrl && p.id !== 'sgfireplanner')
  .map((p: PlatformFees) => ({ name: p.name, url: p.sourceUrl }))

const INFLATION_DEFLATOR = Math.pow(1 + ASSUMED_INFLATION, YEARS)

function calculateRows(portfolioSize: number): PlatformRow[] {
  const zeroFeeGrowth = portfolioSize * Math.pow(1 + ANNUAL_RETURN, YEARS)

  const rows: PlatformRow[] = ROBO_FEES.map((platform) => {
    const feeRate = getFeeRate(platform, portfolioSize)
    const netGrowth = portfolioSize * Math.pow(1 + ANNUAL_RETURN - feeRate, YEARS)
    const nominalCost = zeroFeeGrowth - netGrowth

    return {
      name: platform.name,
      feeRate,
      nominalCost,
      realCost: nominalCost / INFLATION_DEFLATOR,
      isSgFirePlanner: platform.id === 'sgfireplanner',
      sourceUrl: platform.sourceUrl,
    }
  })

  // Sort by nominal cost (highest first), SGFirePlanner always last
  const sgfp = rows.find((r) => r.isSgFirePlanner)
  const others = rows.filter((r) => !r.isSgFirePlanner)
  others.sort((a, b) => b.nominalCost - a.nominalCost)

  return sgfp ? [...others, sgfp] : others
}

export function FeeComparisonCalculator() {
  const [portfolioSize, setPortfolioSize] = useState(DEFAULT_PORTFOLIO)
  const [showReal, setShowReal] = useState(false)
  const rows = calculateRows(portfolioSize)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          What platform fees cost over 30 years
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The cumulative effect of platform and fund fees on your portfolio,
          assuming 7% annual returns. Lower fees compound in your favour,
          but convenience, SRS access, and discipline have real value too.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Portfolio size slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Portfolio size</Label>
            <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {formatCurrency(portfolioSize, 0)}
            </span>
          </div>
          <Slider
            value={[portfolioSize]}
            min={MIN_PORTFOLIO}
            max={MAX_PORTFOLIO}
            step={STEP}
            onValueChange={([v]) => setPortfolioSize(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(MIN_PORTFOLIO, 0)}</span>
            <span>{formatCurrency(MAX_PORTFOLIO, 0)}</span>
          </div>
        </div>

        {/* Dollar basis toggle */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Show in:</span>
          <button
            type="button"
            onClick={() => setShowReal(false)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !showReal
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Nominal dollars
          </button>
          <button
            type="button"
            onClick={() => setShowReal(true)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              showReal
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Today's dollars (2.5% inflation)
          </button>
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium">Platform</th>
                <th className="text-right py-2 px-4 font-medium">
                  Total fee rate
                </th>
                <th className="text-right py-2 pl-4 font-medium">
                  30-year fee impact
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className={
                    row.isSgFirePlanner
                      ? 'border-t-2 border-primary/20 bg-primary/5 font-semibold'
                      : 'border-b'
                  }
                >
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {(row.feeRate * 100).toFixed(2)}%
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {row.isSgFirePlanner ? (
                      <span className="text-green-600 dark:text-green-400">
                        $0
                      </span>
                    ) : (
                      formatCurrency(showReal ? row.realCost : row.nominalCost, 0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Balanced note */}
        <p className="text-xs text-muted-foreground italic">
          A platform that keeps you invested through downturns can be worth more
          than the fee difference.
        </p>

        {/* Disclaimers */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            This assumes a constant fee tier. Actual costs may be lower as your
            portfolio grows into cheaper tiers.
          </p>
          <p>
            Fee structures change. Verify current rates on each platform's
            pricing page:{' '}
            {PRICING_LINKS.map((link, i) => (
              <span key={link.name}>
                {i > 0 && ', '}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {link.name}
                </a>
              </span>
            ))}
            .
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
