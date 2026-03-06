import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { calculateBSD, calculateABSD, mortgageAmortization, leaseDecayFactor } from '@/lib/calculations/property'
import { formatCurrency, formatPercent } from '@/lib/utils'

export function PropertyAnalysisPanel() {
  const store = usePropertyStore()

  const analysis = useMemo(() => {
    if (Object.keys(store.validationErrors).length > 0) return null

    const bsd = calculateBSD(store.purchasePrice)
    const absd = calculateABSD(store.purchasePrice, store.residencyForAbsd, store.propertyCount)
    const loanAmount = store.purchasePrice * store.ltv
    const downPayment = store.purchasePrice - loanAmount
    const mortgage = mortgageAmortization(loanAmount, store.mortgageRate, store.mortgageTerm)

    const annualRental = store.purchasePrice * store.rentalYield
    const totalStampDuty = bsd + absd
    const totalUpfront = downPayment + totalStampDuty

    // Bala's Table factors at key milestones
    const balaFactors = [0, 10, 20, 30].map((y) => ({
      year: y,
      factor: leaseDecayFactor(store.leaseYears, y),
    }))

    return {
      bsd,
      absd,
      totalStampDuty,
      downPayment,
      totalUpfront,
      loanAmount,
      monthlyPayment: mortgage.monthlyPayment,
      totalInterest: mortgage.totalInterest,
      totalMortgageCost: mortgage.totalPayment,
      annualRental,
      balaFactors,
    }
  }, [
    store.purchasePrice,
    store.leaseYears,
    store.rentalYield,
    store.mortgageRate,
    store.mortgageTerm,
    store.ltv,
    store.residencyForAbsd,
    store.propertyCount,
    store.validationErrors,
  ])

  if (!analysis) {
    return (
      <Card>
        <CardContent className="pt-6 md:pt-6">
          <p className="text-sm text-muted-foreground">Fix the input errors above to see the property analysis.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Stamp Duties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buyer's Stamp Duty (BSD)</span>
              <span>{formatCurrency(analysis.bsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Additional BSD (ABSD)</span>
              <span>{formatCurrency(analysis.absd)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Total Stamp Duty</span>
              <span>{formatCurrency(analysis.totalStampDuty)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upfront Costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Down Payment ({formatPercent(1 - store.ltv, 0)})</span>
              <span>{formatCurrency(analysis.downPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stamp Duties</span>
              <span>{formatCurrency(analysis.totalStampDuty)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Total Upfront</span>
              <span>{formatCurrency(analysis.totalUpfront)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mortgage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Amount</span>
              <span>{formatCurrency(analysis.loanAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Payment</span>
              <span>{formatCurrency(analysis.monthlyPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Interest</span>
              <span>{formatCurrency(analysis.totalInterest)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Leasehold Depreciation (Bala's Table)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            {analysis.balaFactors.map(({ year, factor }) => (
              <div key={year} className="text-center">
                <p className="text-muted-foreground">Year {year}</p>
                <p className="font-medium">{formatPercent(factor)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Percentage of freehold value retained at each milestone for a {store.leaseYears}-year lease.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rental Income</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Annual Rental ({formatPercent(store.rentalYield)})</span>
            <span className="font-medium">{formatCurrency(analysis.annualRental)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monthly Rental</span>
            <span className="font-medium">{formatCurrency(analysis.annualRental / 12)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
