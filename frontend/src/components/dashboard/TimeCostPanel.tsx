import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Clock, ShoppingCart } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { calculateOneTimeCost, calculateRecurringCost, type TimeCostBaseInput } from '@/lib/calculations/timeCost'
import { formatCurrency, cn } from '@/lib/utils'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'

type CostMode = 'one-time' | 'recurring'

export function TimeCostPanel() {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()

  const [mode, setMode] = useState<CostMode>('one-time')
  const [oneTimeAmount, setOneTimeAmount] = useState(50000)
  const [monthlyAmount, setMonthlyAmount] = useState(500)
  const [isOpen, setIsOpen] = useState(false)

  const baseInput = useMemo<TimeCostBaseInput | null>(() => {
    if (Object.keys(profile.validationErrors).length > 0) return null

    const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    let effectiveIncome = profile.annualIncome
    const projectionParams = buildProjectionParams(profile, income, property)
    if (projectionParams) {
      const projection = generateIncomeProjection(projectionParams)
      if (projection.length > 0) effectiveIncome = projection[0].totalGross
    }

    let expectedReturn = profile.expectedReturn
    if (profile.usePortfolioReturn && Object.keys(allocation.validationErrors).length === 0) {
      expectedReturn = calculatePortfolioReturn(allocation.currentWeights, getEffectiveReturns(allocation.returnOverrides))
    }

    const netRealReturn = expectedReturn - profile.inflation - profile.expenseRatio

    return {
      annualExpenses: profile.annualExpenses,
      annualIncome: effectiveIncome,
      liquidNetWorth: profile.liquidNetWorth,
      cpfTotal,
      swr: profile.swr,
      netRealReturn,
      retirementAge: profile.retirementAge,
      currentAge: profile.currentAge,
    }
  }, [profile, income, allocation, property])

  const result = useMemo(() => {
    if (!baseInput) return null
    if (mode === 'one-time') {
      return { type: 'one-time' as const, ...calculateOneTimeCost(baseInput, oneTimeAmount) }
    }
    return { type: 'recurring' as const, ...calculateRecurringCost(baseInput, monthlyAmount) }
  }, [baseInput, mode, oneTimeAmount, monthlyAmount])

  if (!baseInput) return null

  const fireUnreachable = result && !isFinite(result.delayYears)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Time-Cost Translator
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {isOpen ? 'Click to collapse' : 'Click to expand'}
          </span>
        </CardTitle>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            See how a purchase or new expense delays your FIRE date.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'one-time' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('one-time')}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              One-Time Cost
            </Button>
            <Button
              variant={mode === 'recurring' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('recurring')}
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Recurring Monthly
            </Button>
          </div>

          {/* Input */}
          <div className="max-w-xs">
            {mode === 'one-time' ? (
              <CurrencyInput
                label="One-time expense amount"
                value={oneTimeAmount}
                onChange={setOneTimeAmount}
              />
            ) : (
              <CurrencyInput
                label="Monthly expense amount"
                value={monthlyAmount}
                onChange={setMonthlyAmount}
              />
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={cn(
              'rounded-lg border p-4 space-y-3',
              fireUnreachable
                ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                : 'bg-muted/50'
            )}>
              {fireUnreachable ? (
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  Your current plan does not reach FIRE — this cost makes it worse but the delay cannot be computed.
                </p>
              ) : result.delayYears === 0 && result.delayMonths === 0 ? (
                <p className="text-sm text-muted-foreground">No measurable delay to your FIRE date.</p>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">FIRE Delay</Label>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      +{result.delayYears > 0 ? `${result.delayYears} year${result.delayYears !== 1 ? 's' : ''}` : ''}
                      {result.delayYears > 0 && result.delayMonths > 0 ? ', ' : ''}
                      {result.delayMonths > 0 ? `${result.delayMonths} month${result.delayMonths !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  {result.type === 'one-time' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Opportunity Cost (at retirement)</Label>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(result.opportunityCost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        What {formatCurrency(oneTimeAmount)} could grow to if invested instead
                      </p>
                    </div>
                  )}
                  {result.type === 'recurring' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Annual Cost</Label>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(result.annualCost)}/yr
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">New FIRE Number</Label>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(result.newFireNumber)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
