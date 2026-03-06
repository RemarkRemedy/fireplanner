import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'

export function DownsizingResultsPanel() {
  const downsizing = usePropertyStore((s) => s.downsizing)
  const existingMortgageBalance = usePropertyStore((s) => s.existingMortgageBalance)
  const existingMonthlyPayment = usePropertyStore((s) => s.existingMonthlyPayment)
  const existingMortgageRate = usePropertyStore((s) => s.existingMortgageRate)
  const residencyForAbsd = usePropertyStore((s) => s.residencyForAbsd)
  const currentAge = useProfileStore((s) => s.currentAge)

  const results = useMemo(() => {
    if (downsizing.scenario === 'none') return null

    const yearsToSell = Math.max(0, downsizing.sellAge - currentAge)
    const outstandingAtSell = outstandingMortgageAtAge(
      existingMortgageBalance,
      existingMonthlyPayment,
      existingMortgageRate,
      yearsToSell,
    )

    if (downsizing.scenario === 'sell-and-downsize') {
      const result = calculateSellAndDownsize({
        salePrice: downsizing.expectedSalePrice,
        outstandingMortgage: outstandingAtSell,
        newPropertyCost: downsizing.newPropertyCost,
        newLtv: downsizing.newLtv,
        newMortgageRate: downsizing.newMortgageRate,
        newMortgageTerm: downsizing.newMortgageTerm,
        residency: residencyForAbsd,
        propertyCount: 0,
      })
      return { type: 'sell-and-downsize' as const, ...result }
    }

    const result = calculateSellAndRent({
      salePrice: downsizing.expectedSalePrice,
      outstandingMortgage: outstandingAtSell,
      monthlyRent: downsizing.monthlyRent,
    })
    return { type: 'sell-and-rent' as const, ...result }
  }, [
    downsizing,
    existingMortgageBalance,
    existingMonthlyPayment,
    existingMortgageRate,
    residencyForAbsd,
    currentAge,
  ])

  if (!results) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Downsizing Analysis at Age {downsizing.sellAge}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <Row label="Gross Sale Proceeds" value={formatCurrency(results.grossProceeds)} />
          <Row label="Outstanding Mortgage at Sale" value={`(${formatCurrency(results.outstandingMortgage)})`} negative />

          {results.type === 'sell-and-downsize' && (
            <>
              <div className="border-t pt-2 mt-2" />
              <Row label="Buyer's Stamp Duty (BSD) on New Property" value={`(${formatCurrency(results.bsdOnNewProperty)})`} negative />
              <Row label="Additional BSD (ABSD) on New Property" value={results.absdOnNewProperty > 0 ? `(${formatCurrency(results.absdOnNewProperty)})` : '$0'} negative={results.absdOnNewProperty > 0} />
              <Row label="Down Payment" value={`(${formatCurrency(results.downPayment)})`} negative />
              <div className="border-t pt-2 mt-2" />
              <Row label="Net Equity to Portfolio" value={formatCurrency(results.netEquityToPortfolio)} highlight />
              <Row label="New Monthly Mortgage" value={`${formatCurrency(results.newMonthlyPayment)}/mo`} />
            </>
          )}

          {results.type === 'sell-and-rent' && (
            <>
              <div className="border-t pt-2 mt-2" />
              <Row label="Net Proceeds to Portfolio" value={formatCurrency(results.netProceedsToPortfolio)} highlight />
              <Row label="Annual Rent" value={`${formatCurrency(results.annualRent)}/yr`} />
            </>
          )}

          {results.shortfall > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mt-2">
              <p className="text-sm font-medium text-destructive">
                Shortfall of {formatCurrency(results.shortfall)}
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                Sale proceeds do not cover outstanding costs. You would need to bring{' '}
                {formatCurrency(results.shortfall)} in cash to settlement. This amount will be
                deducted from your portfolio in the projection.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, negative, highlight }: { label: string; value: string; negative?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'font-semibold text-primary' : negative ? 'text-destructive' : 'font-medium'}>
        {value}
      </span>
    </div>
  )
}
