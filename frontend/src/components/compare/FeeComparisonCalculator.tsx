import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { ROBO_FEES, getFeeRate } from '@/lib/data/roboFees'
import { formatCurrency } from '@/lib/utils'

const MIN_PORTFOLIO = 50_000
const MAX_PORTFOLIO = 2_000_000
const STEP = 10_000
const DEFAULT_PORTFOLIO = 500_000
const ANNUAL_RETURN = 0.07
const YEARS = 30

interface PlatformRow {
  name: string
  feeRate: number
  opportunityCost: number
  isSgFirePlanner: boolean
}

function calculateRows(portfolioSize: number): PlatformRow[] {
  const zeroFeeGrowth = portfolioSize * Math.pow(1 + ANNUAL_RETURN, YEARS)

  const rows: PlatformRow[] = ROBO_FEES.map((platform) => {
    const feeRate = getFeeRate(platform, portfolioSize)
    const netGrowth = portfolioSize * Math.pow(1 + ANNUAL_RETURN - feeRate, YEARS)
    const opportunityCost = zeroFeeGrowth - netGrowth

    return {
      name: platform.name,
      feeRate,
      opportunityCost,
      isSgFirePlanner: platform.id === 'sgfireplanner',
    }
  })

  // Sort by opportunity cost (highest first), SGFirePlanner always last
  const sgfp = rows.find((r) => r.isSgFirePlanner)
  const others = rows.filter((r) => !r.isSgFirePlanner)
  others.sort((a, b) => b.opportunityCost - a.opportunityCost)

  return sgfp ? [...others, sgfp] : others
}

export function FeeComparisonCalculator() {
  const [portfolioSize, setPortfolioSize] = useState(DEFAULT_PORTFOLIO)
  const rows = calculateRows(portfolioSize)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Lost portfolio growth over 30 years (opportunity cost)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          This is the difference in portfolio value between paying this fee and
          paying nothing, assuming 7% annual returns.
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
                  30-year cost
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
                      formatCurrency(row.opportunityCost, 0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Disclaimers */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            This assumes a constant fee tier. Actual costs may be lower as your
            portfolio grows into cheaper tiers.
          </p>
          <p>
            Fee structures change. Verify current rates on each platform's
            pricing page.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
