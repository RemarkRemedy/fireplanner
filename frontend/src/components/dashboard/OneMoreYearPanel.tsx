import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarPlus } from 'lucide-react'
import { useOneMoreYear, type RiskLevel } from '@/hooks/useOneMoreYear'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  safe: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    label: 'Safe',
  },
  marginal: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'Marginal',
  },
  risky: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    label: 'Risky',
  },
}

export function OneMoreYearPanel() {
  const { scenarios, hasData } = useOneMoreYear()
  const [isOpen, setIsOpen] = useState(false)

  if (!hasData) return null

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-4 w-4" />
          One More Year Analysis
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {isOpen ? 'Click to collapse' : 'Click to expand'}
          </span>
        </CardTitle>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            How much does working 1–3 extra years improve your retirement security?
          </p>

          {/* Desktop: table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Scenario</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Portfolio</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Withdrawal</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Duration</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Effective SWR</th>
                  <th className="py-2 font-medium text-muted-foreground text-center">Risk</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const risk = RISK_STYLES[s.riskLevel]
                  return (
                    <tr key={s.yearsExtra} className={cn('border-b last:border-0', s.yearsExtra === 0 && 'bg-muted/30')}>
                      <td className="py-3 pr-4">
                        <span className="font-medium">
                          {s.yearsExtra === 0 ? 'Planned' : `+${s.yearsExtra} year${s.yearsExtra > 1 ? 's' : ''}`}
                        </span>
                        <span className="text-muted-foreground ml-1.5">Age {s.retirementAge}</span>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCurrency(s.portfolioAtRetirement)}
                        {s.deltaPortfolio > 0 && (
                          <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                            +{formatCurrency(s.deltaPortfolio)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(s.sustainableWithdrawal)}/yr</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{s.retirementDuration} yrs</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {isFinite(s.effectiveSwr) ? formatPercent(s.effectiveSwr) : '—'}
                      </td>
                      <td className="py-3 text-center">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded', risk.bg, risk.text)}>
                          {risk.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card view */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {scenarios.map((s) => {
              const risk = RISK_STYLES[s.riskLevel]
              return (
                <div
                  key={s.yearsExtra}
                  className={cn(
                    'rounded-lg border p-4 space-y-2',
                    s.yearsExtra === 0 && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {s.yearsExtra === 0 ? 'Planned' : `+${s.yearsExtra} year${s.yearsExtra > 1 ? 's' : ''}`}
                      <span className="text-muted-foreground ml-1.5 font-normal">Age {s.retirementAge}</span>
                    </span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', risk.bg, risk.text)}>
                      {risk.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Portfolio</p>
                      <p className="font-medium tabular-nums">{formatCurrency(s.portfolioAtRetirement)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Withdrawal</p>
                      <p className="font-medium tabular-nums">{formatCurrency(s.sustainableWithdrawal)}/yr</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium">{s.retirementDuration} yrs</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Effective SWR</p>
                      <p className="font-medium tabular-nums">
                        {isFinite(s.effectiveSwr) ? formatPercent(s.effectiveSwr) : '—'}
                      </p>
                    </div>
                  </div>
                  {s.deltaPortfolio > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      +{formatCurrency(s.deltaPortfolio)} more than planned
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
