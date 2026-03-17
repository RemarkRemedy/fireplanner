import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Landmark } from 'lucide-react'
import { useEstateProjection } from '@/hooks/useEstateProjection'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

function BreakdownRow({
  label,
  value,
  isDeduction = false,
  muted = false,
}: {
  label: string
  value: number
  isDeduction?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className={cn('text-sm', muted ? 'text-muted-foreground' : '')}>
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          isDeduction && value > 0 ? 'text-destructive' : '',
        )}
      >
        {isDeduction && value > 0 ? '-' : ''}
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function EstateProjectionPanel() {
  const { estate, deathAge } = useEstateProjection()
  const [isOpen, setIsOpen] = useState(false)

  if (!estate || deathAge === null) return null

  const isNegative = estate.netEstate < 0

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" />
          Net Estate at Death
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {isOpen ? 'Click to collapse' : 'Click to expand'}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Summary line always visible */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            Projected at age {deathAge}
          </span>
          <span
            className={cn(
              'text-lg font-semibold tabular-nums',
              isNegative ? 'text-destructive' : 'text-green-600 dark:text-green-400',
            )}
          >
            {formatCurrency(estate.netEstate)}
          </span>
        </div>

        {isOpen && (
          <div className="mt-4 space-y-4">
            {/* Assets */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assets
              </p>
              <BreakdownRow label="Investment portfolio" value={estate.portfolio} muted />
              <BreakdownRow label="CPF (all accounts)" value={estate.cpfTotal} muted />
              {estate.propertyValue > 0 && (
                <BreakdownRow label="Property" value={estate.propertyValue} muted />
              )}
              {estate.srsBalance > 0 && (
                <BreakdownRow label="SRS balance" value={estate.srsBalance} muted />
              )}
              {estate.insurancePayouts > 0 && (
                <BreakdownRow label="Insurance death benefit" value={estate.insurancePayouts} muted />
              )}
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-sm font-medium">Gross estate</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(estate.grossEstate)}
                </span>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Deductions
              </p>
              {estate.mortgageBalance > 0 && (
                <BreakdownRow label="Mortgage balance" value={estate.mortgageBalance} isDeduction muted />
              )}
              {estate.nonMortgageDebts > 0 && (
                <BreakdownRow label="Other debts" value={estate.nonMortgageDebts} isDeduction muted />
              )}
              <BreakdownRow label="Funeral costs" value={estate.funeralCosts} isDeduction muted />
              <BreakdownRow label="Legal and admin" value={estate.legalAdminCosts} isDeduction muted />
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-sm font-medium">Total deductions</span>
                <span className="text-sm font-semibold tabular-nums text-destructive">
                  -{formatCurrency(estate.totalDeductions)}
                </span>
              </div>
            </div>

            {/* Net */}
            <div className="flex justify-between border-t-2 pt-2">
              <span className="font-semibold">Net estate</span>
              <span
                className={cn(
                  'font-bold text-lg tabular-nums',
                  isNegative ? 'text-destructive' : 'text-green-600 dark:text-green-400',
                )}
              >
                {formatCurrency(estate.netEstate)}
              </span>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground pt-2">
              This is an estimate based on your current plan inputs. Consult a qualified estate planner for personalized advice.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
