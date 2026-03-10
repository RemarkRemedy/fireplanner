import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import {
  generatePropertyProjection,
  type PropertyProjectionParams,
} from '@/lib/calculations/propertyProjection'
import type { PropertyPlan, PlanningAdult } from '@/lib/household/types'

interface PropertyProjectionPreviewProps {
  property: PropertyPlan
  /** The reference adult whose ages drive the projection */
  adult: Pick<PlanningAdult, 'currentAge' | 'retirementAge' | 'lifeExpectancy'>
}

export function PropertyProjectionPreview({ property, adult }: PropertyProjectionPreviewProps) {
  const [expanded, setExpanded] = useState(false)

  const params: PropertyProjectionParams = useMemo(() => ({
    ownsProperty: property.ownsProperty,
    existingPropertyValue: property.existingPropertyValue,
    existingMortgageBalance: property.existingMortgageBalance,
    existingMonthlyPayment: property.existingMonthlyPayment,
    existingMortgageRate: property.existingMortgageRate,
    existingMortgageRemainingYears: property.existingMortgageRemainingYears,
    mortgageCpfMonthly: property.mortgageCpfMonthly,
    existingAppreciationRate: property.existingAppreciationRate,
    existingLeaseYears: property.existingLeaseYears,
    existingApplyBalaDecay: property.existingApplyBalaDecay,
    ownershipPercent: property.ownershipPercent,
    purchasePrice: property.purchasePrice,
    leaseYears: property.leaseYears,
    appreciationRate: property.appreciationRate,
    mortgageRate: property.mortgageRate,
    mortgageTerm: property.mortgageTerm,
    ltv: property.ltv,
    purchaseYearsFromNow: property.purchaseYearsFromNow ?? 0,
    hdbMonetizationStrategy: property.hdbMonetizationStrategy,
    hdbSublettingRooms: property.hdbSublettingRooms,
    hdbSublettingRate: property.hdbSublettingRate,
    hdbCpfUsedForHousing: property.hdbCpfUsedForHousing,
    downsizing: property.downsizing,
    residencyForAbsd: property.residencyForAbsd,
    propertyCount: property.propertyCount,
    currentAge: adult.currentAge,
    retirementAge: adult.retirementAge,
    lifeExpectancy: adult.lifeExpectancy,
  }), [property, adult])

  const allRows = useMemo(() => generatePropertyProjection(params), [params])
  const milestoneRows = useMemo(() => allRows.filter(r => !r.isExpanded), [allRows])
  const visibleRows = expanded ? allRows : milestoneRows

  // Determine which optional columns to show
  const showBalaDecay = allRows.some(r => r.propertyValueLeaseAdj != null)
  const showCpfPayment = allRows.some(r => r.annualPaymentCpf > 0)
  const showRentalIncome = allRows.some(r => r.rentalIncome != null && r.rentalIncome > 0)
  const showCpfRefund = allRows.some(r => r.cpfHousingRefund != null)

  if (allRows.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Property Projection</Label>
        <span className="text-xs text-muted-foreground">(nominal $)</span>
      </div>
      <div className="overflow-auto rounded-md border" style={{ maxHeight: expanded ? '400px' : undefined }}>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Age</th>
              {showBalaDecay ? (
                <>
                  <th className="px-3 py-2 text-right font-medium">Value (Raw)</th>
                  <th className="px-3 py-2 text-right font-medium">Value (Lease-Adj)</th>
                </>
              ) : (
                <th className="px-3 py-2 text-right font-medium">Property Value</th>
              )}
              <th className="px-3 py-2 text-right font-medium">Lease Left</th>
              <th className="px-3 py-2 text-right font-medium">Mortgage</th>
              <th className="px-3 py-2 text-right font-medium">Payment (Cash)</th>
              {showCpfPayment && <th className="px-3 py-2 text-right font-medium">Payment (CPF)</th>}
              {showCpfRefund && <th className="px-3 py-2 text-right font-medium">CPF Refund</th>}
              <th className="px-3 py-2 text-right font-medium text-primary">Net Equity</th>
              {showRentalIncome && <th className="px-3 py-2 text-right font-medium">Rental</th>}
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.age} className="border-b last:border-0">
                <td className="px-3 py-1.5 font-medium">{row.age}</td>
                {showBalaDecay ? (
                  <>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.propertyValueRaw)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.propertyValueLeaseAdj ?? 0)}</td>
                  </>
                ) : (
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.propertyValueRaw)}</td>
                )}
                <td className="px-3 py-1.5 text-right tabular-nums">{row.leaseRemaining}yr</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.mortgageBalance)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.annualPaymentCash)}</td>
                {showCpfPayment && <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.annualPaymentCpf)}</td>}
                {showCpfRefund && <td className="px-3 py-1.5 text-right tabular-nums">{row.cpfHousingRefund != null ? formatCurrency(row.cpfHousingRefund) : ''}</td>}
                <td className="px-3 py-1.5 text-right tabular-nums text-primary font-medium">{formatCurrency(row.netEquity)}</td>
                {showRentalIncome && <td className="px-3 py-1.5 text-right tabular-nums">{row.rentalIncome != null ? formatCurrency(row.rentalIncome) : ''}</td>}
                <td className="px-3 py-1.5 text-muted-foreground">{row.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Show milestones only' : `Show full schedule (${allRows.length} years)`}
      </button>
    </div>
  )
}
