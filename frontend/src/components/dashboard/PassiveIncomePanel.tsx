import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { usePassiveIncomeSummary } from '@/hooks/usePassiveIncomeSummary'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

export function PassiveIncomePanel() {
  const data = usePassiveIncomeSummary()
  const isMobile = useIsMobile()

  if (!data) return null

  const hasIncome = data.sources.length > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Passive Income Coverage
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasIncome ? (
          <>
            {/* Summary metrics */}
            <p className="text-lg font-semibold">
              {formatPercent(data.coverageRatio, 0)} covered
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passive Income</span>
                <span className="font-medium">
                  {formatCurrency(data.totalAtRetirement)}/yr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Required Expenses</span>
                <span className="font-medium">
                  {formatCurrency(data.requiredExpenses)}/yr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {data.gap > 0 ? 'Gap (from portfolio)' : 'Surplus'}
                </span>
                <span
                  className={
                    data.gap > 0
                      ? 'text-destructive font-medium'
                      : 'text-green-600 font-medium'
                  }
                >
                  {formatCurrency(Math.abs(data.gap))}/yr
                </span>
              </div>
            </div>

            {/* Source breakdown */}
            {data.sources.length > 1 && (
              <div className="mt-3 pt-3 border-t space-y-1 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Income Sources at Retirement
                </p>
                {data.sources.map((src) => (
                  <div key={src.label} className="flex justify-between">
                    <span className="text-muted-foreground">{src.label}</span>
                    <span className="font-medium">
                      {formatCurrency(src.annualAmount)}/yr
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Stacked area chart */}
            <div
              className="mt-4 h-48 md:h-56"
              role="img"
              aria-label="Stacked area chart showing passive income sources over retirement years with expense reference line"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.yearlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="age"
                    label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCurrency(v)}
                    width={80}
                  />
                  <Tooltip trigger={isMobile ? 'click' : undefined} formatter={(value: number) => formatCurrency(value)} />
                  <Area
                    type="monotone"
                    dataKey="rentalIncome"
                    name="Rental"
                    stackId="1"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="investmentIncome"
                    name="Investment"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="businessIncome"
                    name="Business"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="governmentIncome"
                    name="Government / CPF LIFE"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                  <ReferenceLine
                    y={data.requiredExpenses}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Expenses',
                      position: 'right',
                      fill: '#ef4444',
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            No passive income streams configured. Add rental, investment, business, or
            government income to see coverage analysis.
          </p>
        )}
        <Link
          to="/inputs#section-income"
          className="text-xs text-primary hover:underline mt-3 inline-block"
        >
          Configure income streams
        </Link>
      </CardContent>
    </Card>
  )
}
