import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { cn } from '@/lib/utils'
import type { RebalanceFrequency } from '@/lib/types'

export function AssumptionsSection() {
  const store = useProfileStore()
  const allocation = useAllocationStore()

  const { portfolioReturn, portfolioReturnDisplay, allocationValid } = useMemo(() => {
    const hasErrors = Object.keys(allocation.validationErrors).length > 0

    if (!hasErrors) {
      const ret = calculatePortfolioReturn(allocation.currentWeights, getEffectiveReturns(allocation.returnOverrides))
      return {
        portfolioReturn: ret,
        portfolioReturnDisplay: (ret * 100).toFixed(1),
        allocationValid: true,
      }
    }

    return {
      portfolioReturn: null,
      portfolioReturnDisplay: null,
      allocationValid: false,
    }
  }, [
    allocation.validationErrors,
    allocation.currentWeights,
    allocation.returnOverrides,
  ])

  // Determine the effective return used for calculations
  const useAuto = store.usePortfolioReturn
  const effectiveReturn = useAuto && portfolioReturn !== null
    ? portfolioReturn
    : store.expectedReturn

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Assumptions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-sm">Expected Nominal Return</Label>
                <InfoTooltip text="Choose 'From Allocation' to automatically compute your expected return from your asset allocation weights, or 'Manual' to enter your own estimate. The derived value updates when you change allocations." />
              </div>

              <div className="inline-flex rounded-md border bg-muted p-0.5">
                <button
                  onClick={() => store.setField('usePortfolioReturn', true)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    useAuto
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  From Allocation
                </button>
                <button
                  onClick={() => store.setField('usePortfolioReturn', false)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    !useAuto
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Manual
                </button>
              </div>
            </div>

            <PercentInput
              value={effectiveReturn}
              onChange={(v) => store.setField('expectedReturn', v)}
              error={store.validationErrors.expectedReturn}
              disabled={useAuto && allocationValid}
            />

            {useAuto && allocationValid && (
              <p className="text-xs text-green-600">
                Derived from Asset Allocation ({portfolioReturnDisplay}%). Edit weights in Asset Allocation to change.
              </p>
            )}
            {useAuto && !allocationValid && (
              <p className="text-xs text-amber-600">
                Asset Allocation has errors — using manual value ({(store.expectedReturn * 100).toFixed(1)}%) until fixed.
              </p>
            )}
          </div>

          <div className="pt-3">
            <PercentInput
              label="Inflation Rate"
              value={store.inflation}
              onChange={(v) => store.setField('inflation', v)}
              error={store.validationErrors.inflation}
              tooltip="Expected annual inflation. Singapore historical average ~2.5%."
            />
          </div>

          <PercentInput
            label="Expense Ratio"
            value={store.expenseRatio}
            onChange={(v) => store.setField('expenseRatio', v)}
            error={store.validationErrors.expenseRatio}
            tooltip="Weighted average expense ratio of your portfolio funds. Typically 0.1%-0.5%."
            step={0.01}
          />

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Rebalancing Frequency
              <InfoTooltip text="How often you rebalance your portfolio. Note: simulations use annual steps regardless of this setting." />
            </Label>
            <Select
              value={store.rebalanceFrequency}
              onValueChange={(v) => store.setField('rebalanceFrequency', v as RebalanceFrequency)}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Net real return: {((effectiveReturn - store.inflation - store.expenseRatio) * 100).toFixed(1)}%
          ({(effectiveReturn * 100).toFixed(1)}% nominal - {(store.inflation * 100).toFixed(1)}% inflation - {(store.expenseRatio * 100).toFixed(1)}% fees)
        </p>
      </CardContent>
    </Card>
  )
}
