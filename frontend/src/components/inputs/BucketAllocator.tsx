import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { useAllocationStore } from '@/stores/useAllocationStore'
import type { BucketConfig, TimeBucket } from '@/lib/types'

/**
 * Input UI for configuring bucket allocations.
 * Rendered in the Allocation section of InputsPage (advanced mode).
 */
export function BucketAllocator() {
  const bucketConfig = useAllocationStore((s) => s.bucketConfig)
  const setBucketConfig = useAllocationStore((s) => s.setBucketConfig)

  const handleToggle = useCallback(
    (enabled: boolean) => {
      setBucketConfig({ ...bucketConfig, enabled })
    },
    [bucketConfig, setBucketConfig],
  )

  const handleIncomeFloorChange = useCallback(
    (value: number) => {
      setBucketConfig({ ...bucketConfig, incomeFloorAnnual: value })
    },
    [bucketConfig, setBucketConfig],
  )

  const updateBucket = useCallback(
    (index: number, partial: Partial<TimeBucket>) => {
      const updated: BucketConfig = {
        ...bucketConfig,
        buckets: bucketConfig.buckets.map((b, i) =>
          i === index ? { ...b, ...partial } : b,
        ),
      }
      setBucketConfig(updated)
    },
    [bucketConfig, setBucketConfig],
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bucket Strategy</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Assign current assets to time-segmented buckets with different allocations per horizon.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bucket-toggle" className="text-sm">
              Enable
            </Label>
            <Switch
              id="bucket-toggle"
              checked={bucketConfig.enabled}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
      </CardHeader>

      {bucketConfig.enabled && (
        <CardContent className="space-y-5">
          <CurrencyInput
            label="Guaranteed income floor (annual)"
            value={bucketConfig.incomeFloorAnnual}
            onChange={handleIncomeFloorChange}
            tooltip="Annual guaranteed income from annuities, pensions, or CPF LIFE. This is subtracted from expenses to compute the gap each bucket must fund. Leave at 0 to use the auto-detected floor from your income streams."
          />

          <div className="space-y-4">
            {bucketConfig.buckets.map((bucket, index) => (
              <BucketRow
                key={bucket.id}
                bucket={bucket}
                index={index}
                onUpdate={updateBucket}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            This is an advisory overlay. It does not change Monte Carlo or backtest engines.
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function BucketRow({
  bucket,
  index,
  onUpdate,
}: {
  bucket: TimeBucket
  index: number
  onUpdate: (index: number, partial: Partial<TimeBucket>) => void
}) {
  const allocationSum =
    bucket.targetAllocation.equities +
    bucket.targetAllocation.bonds +
    bucket.targetAllocation.cash
  const isValidAllocation = Math.abs(allocationSum - 1) < 0.005

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{bucket.label}</span>
        <span className="text-xs text-muted-foreground">
          Years {bucket.startYear}{bucket.endYear <= 40 ? `-${bucket.endYear}` : '+'}
        </span>
      </div>

      <CurrencyInput
        label="Current amount"
        value={bucket.currentAmount}
        onChange={(v) => onUpdate(index, { currentAmount: v })}
      />

      <div className="grid grid-cols-3 gap-2">
        <PercentInput
          label="Equities"
          value={bucket.targetAllocation.equities}
          onChange={(v) =>
            onUpdate(index, {
              targetAllocation: { ...bucket.targetAllocation, equities: v },
            })
          }
        />
        <PercentInput
          label="Bonds"
          value={bucket.targetAllocation.bonds}
          onChange={(v) =>
            onUpdate(index, {
              targetAllocation: { ...bucket.targetAllocation, bonds: v },
            })
          }
        />
        <PercentInput
          label="Cash"
          value={bucket.targetAllocation.cash}
          onChange={(v) =>
            onUpdate(index, {
              targetAllocation: { ...bucket.targetAllocation, cash: v },
            })
          }
        />
      </div>

      {!isValidAllocation && (
        <p className="text-xs text-destructive">
          Allocation must sum to 100% (currently {Math.round(allocationSum * 100)}%)
        </p>
      )}
    </div>
  )
}
