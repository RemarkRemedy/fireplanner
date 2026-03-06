import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { usePortfolioStats } from '@/hooks/usePortfolioStats'
import { formatPercent, cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface StatRowProps {
  label: string
  tooltip: string
  formula?: string
  current: number
  target: number
  format: (v: number) => string
  higherIsBetter?: boolean
}

function StatRow({ label, tooltip, formula, current, target, format, higherIsBetter = true }: StatRowProps) {
  const diff = target - current
  const isImproved = higherIsBetter ? diff > 0.0001 : diff < -0.0001
  const isWorse = higherIsBetter ? diff < -0.0001 : diff > 0.0001

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-2">
        <span className="flex items-center gap-1 text-sm">
          {label}
          <InfoTooltip text={tooltip} formula={formula} />
        </span>
      </td>
      <td className="py-2 px-2 text-right text-sm font-mono">{format(current)}</td>
      <td className={cn(
        'py-2 pl-2 text-right text-sm font-mono',
        isImproved && 'text-green-600',
        isWorse && 'text-red-600'
      )}>
        {format(target)}
      </td>
    </tr>
  )
}

export function PortfolioStatsPanel({ compact = false }: { compact?: boolean } = {}) {
  const { currentStats, targetStats, hasErrors } = usePortfolioStats()
  const [expanded, setExpanded] = useState(false)

  if (hasErrors || !currentStats || !targetStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fix the input errors above to see portfolio statistics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Portfolio Statistics
          <InfoTooltip text="Portfolio analytics comparing your current (accumulation) and target (retirement) allocations, showing the optimal risk-return balance." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2 text-sm font-medium">Metric</th>
                <th className="text-right py-2 px-2 text-sm font-medium">Current</th>
                <th className="text-right py-2 pl-2 text-sm font-medium">Retirement</th>
              </tr>
            </thead>
            <tbody>
              <StatRow
                label="Expected Return"
                tooltip="Weighted average of asset class expected returns"
                formula="Σ wᵢ × rᵢ"
                current={currentStats.expectedReturn}
                target={targetStats.expectedReturn}
                format={(v) => formatPercent(v, 2)}
              />
              <StatRow
                label="Real Return"
                tooltip="Expected return minus inflation"
                formula="Expected Return - Inflation"
                current={currentStats.realReturn}
                target={targetStats.realReturn}
                format={(v) => formatPercent(v, 2)}
              />
              {!compact && expanded && (
                <>
                  <StatRow
                    label="Net Return"
                    tooltip="Real return minus expense ratio"
                    formula="Real Return - Expense Ratio"
                    current={currentStats.netReturn}
                    target={targetStats.netReturn}
                    format={(v) => formatPercent(v, 2)}
                  />
                  <StatRow
                    label="Risk (Std Dev)"
                    tooltip="Portfolio volatility. Lower means less risk and more stable returns."
                    formula="√(w'Σw)"
                    current={currentStats.stdDev}
                    target={targetStats.stdDev}
                    format={(v) => formatPercent(v, 2)}
                    higherIsBetter={false}
                  />
                  <StatRow
                    label="Risk-Adjusted Return (Sharpe)"
                    tooltip="Measures return per unit of risk. Higher means more return for the same level of volatility."
                    formula="(Net Return - Risk Free) / Std Dev"
                    current={currentStats.sharpe}
                    target={targetStats.sharpe}
                    format={(v) => isFinite(v) ? v.toFixed(3) : '\u221E'}
                  />
                  <StatRow
                    label="Worst-Case Loss (95% confidence)"
                    tooltip="The worst expected annual return under normal conditions, with 95% confidence. Less negative is better."
                    formula="Return - 1.645 × Std Dev"
                    current={currentStats.var95}
                    target={targetStats.var95}
                    format={(v) => formatPercent(v, 2)}
                    higherIsBetter={false}
                  />
                  <StatRow
                    label="Diversification"
                    tooltip="Ratio > 1 indicates diversification benefit. Higher is better."
                    formula="Σ(wᵢ × σᵢ) / σ_portfolio"
                    current={currentStats.diversificationRatio}
                    target={targetStats.diversificationRatio}
                    format={(v) => v.toFixed(3)}
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
        {!compact && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            {expanded ? (
              <>Hide details <ChevronUp className="h-4 w-4" /></>
            ) : (
              <>Show all stats <ChevronDown className="h-4 w-4" /></>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
