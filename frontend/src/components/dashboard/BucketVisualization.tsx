import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import {
  bucketCapitalNeeds,
  bucketFillStatus,
} from '@/lib/calculations/bucketAllocation'
import type { BucketFillResult } from '@/lib/calculations/bucketAllocation'
import { getExpensesAtRetirement } from '@/lib/calculations/expenses'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

function statusColor(status: BucketFillResult['status']): string {
  switch (status) {
    case 'funded':
      return 'bg-green-500 dark:bg-green-600'
    case 'partial':
      return 'bg-amber-500 dark:bg-amber-500'
    case 'empty':
      return 'bg-red-400 dark:bg-red-500'
  }
}

function statusBorder(status: BucketFillResult['status']): string {
  switch (status) {
    case 'funded':
      return 'border-green-300 dark:border-green-700'
    case 'partial':
      return 'border-amber-300 dark:border-amber-600'
    case 'empty':
      return 'border-red-300 dark:border-red-600'
  }
}

function statusLabel(status: BucketFillResult['status']): string {
  switch (status) {
    case 'funded':
      return 'Fully funded'
    case 'partial':
      return 'Partially funded'
    case 'empty':
      return 'Not funded'
  }
}

export function BucketVisualization() {
  const bucketConfig = useAllocationStore((s) => s.bucketConfig)
  const { profile, normalized } = useHouseholdRuntimeInputs()

  // Get guaranteed income from the compiled plan (year offset 0 = retirement year)
  const guaranteedIncome = useMemo(() => {
    const arr = normalized.compiledPlan?.guaranteedIncomeByYear
    const retOffset = normalized.firstRetirementYearOffset
    return arr && retOffset < arr.length ? arr[retOffset] : 0
  }, [normalized.compiledPlan?.guaranteedIncomeByYear, normalized.firstRetirementYearOffset])

  // Get retirement expenses at year 0 of retirement (nominal)
  const retirementExpenses = useMemo(() => {
    return getExpensesAtRetirement(
      profile.retirementAge,
      profile.currentAge,
      profile.annualExpenses,
      profile.expenseAdjustments ?? [],
      profile.lifeExpectancy,
      profile.inflation,
    )
  }, [profile])

  const summary = useMemo(() => {
    if (!bucketConfig.enabled) return null

    // Use manual income floor override if set, otherwise use guaranteed income from analysis
    const incomeFloor = bucketConfig.incomeFloorAnnual > 0
      ? bucketConfig.incomeFloorAnnual
      : guaranteedIncome

    const annualGap = Math.max(retirementExpenses - incomeFloor, 0)
    const needs = bucketCapitalNeeds(annualGap, bucketConfig.buckets, profile.inflation)
    return bucketFillStatus(bucketConfig.buckets, needs)
  }, [bucketConfig, profile.inflation, retirementExpenses, guaranteedIncome])

  if (!bucketConfig.enabled || !summary) return null

  const yearsSecuredText = summary.totalYearsSecured >= 1
    ? `${Math.floor(summary.totalYearsSecured)}`
    : '<1'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Bucket Strategy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary headline */}
        <div>
          <p className="text-lg font-semibold">
            Your next {yearsSecuredText} years of spending are secured
          </p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(summary.totalAllocated)} allocated of {formatCurrency(summary.totalNeeded)} needed
          </p>
        </div>

        {/* Bucket bars */}
        <div className="space-y-3">
          {summary.buckets.map((bucket) => (
            <BucketBar key={bucket.bucketId} bucket={bucket} />
          ))}
        </div>

        {/* Refill waterfall note */}
        <p className="text-xs text-muted-foreground">
          As each bucket is depleted, the next bucket becomes your spending source.
          Longer-horizon buckets have more time to grow.
        </p>
      </CardContent>
    </Card>
  )
}

function BucketBar({ bucket }: { bucket: BucketFillResult }) {
  const fillPct = Math.round(bucket.fillRatio * 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{bucket.label}</span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded border',
          statusBorder(bucket.status),
        )}>
          {statusLabel(bucket.status)}
        </span>
      </div>

      {/* Fill bar */}
      <div className="relative h-5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', statusColor(bucket.status))}
          style={{ width: `${fillPct}%` }}
        />
        {fillPct > 8 && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
            {fillPct}%
          </span>
        )}
      </div>

      {/* Details row */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(bucket.currentAmount)} allocated</span>
        <span>
          {bucket.capitalNeeded > 0
            ? `${formatCurrency(bucket.capitalNeeded)} needed`
            : 'Fully covered by income'}
        </span>
      </div>
    </div>
  )
}
