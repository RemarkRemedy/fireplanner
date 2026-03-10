import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { HouseholdPlanType } from '@/lib/household/types'
import { formatCurrency } from '@/lib/utils'

const PLAN_LABELS: Record<HouseholdPlanType, string> = {
  individual: 'Individual',
  couple: 'Couple',
  household: 'Household',
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function buildCoverageSummary(compiledPlan: CompiledHouseholdPlan): string {
  const adultNames = compiledPlan.adultOrder.map(
    (adultId) => compiledPlan.adultsById[adultId]?.displayName ?? 'Adult',
  )
  const dependentCount = compiledPlan.dependentOrder.length

  if (adultNames.length === 1 && dependentCount === 0) {
    return adultNames[0] ?? 'This plan'
  }

  if (adultNames.length === 1) {
    return `${adultNames[0]} and ${pluralize(dependentCount, 'dependent')}`
  }

  const primaryAdults = adultNames.slice(0, -1).join(', ')
  const lastAdult = adultNames[adultNames.length - 1]
  const dependentSuffix = dependentCount > 0 ? `, plus ${pluralize(dependentCount, 'dependent')}` : ''
  return `${primaryAdults} and ${lastAdult}${dependentSuffix}`
}

function findFirstRetirementLabel(compiledPlan: CompiledHouseholdPlan): string {
  const firstAdultId = compiledPlan.adultOrder.reduce<string | null>((earliestId, adultId) => {
    if (!compiledPlan.adultsById[adultId]) {
      return earliestId
    }
    if (!earliestId) return adultId

    const nextOffset = compiledPlan.adultTimingById[adultId]?.retirementYearOffset ?? Number.MAX_SAFE_INTEGER
    const currentOffset = compiledPlan.adultTimingById[earliestId]?.retirementYearOffset ?? Number.MAX_SAFE_INTEGER
    return nextOffset < currentOffset ? adultId : earliestId
  }, null)

  if (!firstAdultId) {
    return 'Not set'
  }

  const adult = compiledPlan.adultsById[firstAdultId]
  if (!adult) {
    return 'Not set'
  }
  const retirementOffset = compiledPlan.adultTimingById[firstAdultId]?.retirementYearOffset ?? 0
  const retirementAge = adult.currentAge + retirementOffset

  return retirementOffset === 0
    ? `${adult.displayName} now`
    : `${adult.displayName} at ${retirementAge}`
}

export function HouseholdOverviewBar({
  compiledPlan,
}: {
  compiledPlan: CompiledHouseholdPlan
}) {
  const currentRow = compiledPlan.rows[0]
  /** W54: Warn when retirement row index clamp activates. */
  if (compiledPlan.householdRetirementYearOffset >= compiledPlan.rows.length) {
    console.warn(
      `[HouseholdOverviewBar] householdRetirementYearOffset (${compiledPlan.householdRetirementYearOffset}) >= rows.length (${compiledPlan.rows.length}), clamping to last row`,
    )
  }
  const retirementRow = compiledPlan.rows[
    Math.min(compiledPlan.householdRetirementYearOffset, Math.max(0, compiledPlan.rows.length - 1))
  ]
  const trackedAssetValue = compiledPlan.assetOrder.reduce((sum, assetId) => {
    const asset = compiledPlan.assetsById[assetId]
    return sum + (asset?.amount ?? 0)
  }, 0)
  const coverageSummary = buildCoverageSummary(compiledPlan)
  const planLabel = PLAN_LABELS[compiledPlan.planType]

  return (
    <Card className="border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/20">
      <CardContent className="py-5 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-sky-300 bg-background/80 text-sky-900 dark:border-sky-800 dark:text-sky-100">
                {planLabel} plan
              </Badge>
              <Badge variant="secondary">Household-level result</Badge>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Who this analysis covers</h2>
              <p className="text-sm text-muted-foreground">
                {coverageSummary}. The success rate, FIRE ages, and withdrawal figures below stay household-level;
                these chips explain who is inside that answer.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {compiledPlan.adultOrder.map((adultId) => {
                const adult = compiledPlan.adultsById[adultId]
                return (
                  <Badge key={adultId} variant="outline" className="bg-background/80">
                    {adult?.displayName ?? 'Adult'} • age {adult?.currentAge ?? '—'}
                  </Badge>
                )
              })}
              {compiledPlan.dependentOrder.map((dependentId) => {
                const dependent = compiledPlan.dependentsById[dependentId]
                return (
                  <Badge key={dependentId} variant="outline" className="bg-background/80">
                    {dependent?.label ?? 'Dependent'}
                    {dependent?.currentAge != null ? ` • age ${dependent.currentAge}` : ' • dependent'}
                  </Badge>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[36rem] xl:shrink-0">
            <div className="rounded-lg border bg-background/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current savings</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(currentRow?.annualSavings ?? 0)}/yr
              </p>
              <p className="text-xs text-muted-foreground">Net household cashflow in today&apos;s authored year.</p>
            </div>

            <div className="rounded-lg border bg-background/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First retirement</p>
              <p className="mt-1 text-lg font-semibold">{findFirstRetirementLabel(compiledPlan)}</p>
              <p className="text-xs text-muted-foreground">
                Household retirement modeling starts once the first planning adult retires.
              </p>
            </div>

            <div className="rounded-lg border bg-background/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Retirement gap</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(retirementRow?.householdWithdrawalNeed ?? 0)}/yr
              </p>
              <p className="text-xs text-muted-foreground">
                First household retirement-year shortfall before portfolio withdrawals. Assets tracked:
                {' '}
                {formatCurrency(trackedAssetValue)}.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
