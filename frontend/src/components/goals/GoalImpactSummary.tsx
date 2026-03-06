import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useProjection } from '@/hooks/useProjection'
import { generateProjection } from '@/lib/calculations/projection'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'

/**
 * Shows the impact of financial goals on FIRE timeline by comparing
 * projection with goals vs projection without goals.
 *
 * Reuses the exact ProjectionParams from useProjection to ensure
 * an apples-to-apples comparison — only financialGoals differs.
 */
export function GoalImpactSummary() {
  const profile = useProfileStore()
  const { rows: withGoalsRows, summary: withGoalsSummary, params: projectionParams } = useProjection()

  const noGoalsResult = useMemo(() => {
    if (!projectionParams) return null
    if (profile.financialGoals.length === 0) return null

    return generateProjection({
      ...projectionParams,
      financialGoals: [],  // Only difference: no goals
    })
  }, [projectionParams, profile.financialGoals])

  // Don't show if there are no goals or no data
  if (profile.financialGoals.length === 0) return null
  if (!withGoalsSummary || !noGoalsResult || !withGoalsRows) return null

  const noGoalsSummary = noGoalsResult.summary

  const fireAgeWith = withGoalsSummary.fireAchievedAge
  const fireAgeWithout = noGoalsSummary.fireAchievedAge
  const terminalWith = withGoalsSummary.terminalLiquidNW
  const terminalWithout = noGoalsSummary.terminalLiquidNW

  const totalGoalCost = profile.financialGoals.reduce((sum, g) => sum + g.amount, 0)

  // Detect underfunded goal years using engine-computed shortfall field
  const underfundedAges: number[] = []
  let totalShortfall = 0
  for (const row of withGoalsRows) {
    if (row.goalShortfall > 0) {
      underfundedAges.push(row.age)
      totalShortfall += row.goalShortfall
    }
  }

  // Detect if goals cause or accelerate portfolio depletion
  const depletionWith = withGoalsSummary.portfolioDepletedAge
  const depletionWithout = noGoalsResult.summary.portfolioDepletedAge
  const goalsCauseDepletion = depletionWith !== null && depletionWithout === null
  const goalsAccelerateDepletion = depletionWith !== null && depletionWithout !== null
    && depletionWith < depletionWithout

  // Compute FIRE delay
  let fireDelayText: string
  let fireDelayColor: string
  if (fireAgeWith === null && fireAgeWithout === null) {
    fireDelayText = 'FIRE not achieved in either scenario'
    fireDelayColor = 'text-muted-foreground'
  } else if (fireAgeWith === null && fireAgeWithout !== null) {
    fireDelayText = `Goals prevent FIRE (was age ${fireAgeWithout})`
    fireDelayColor = 'text-destructive'
  } else if (fireAgeWith !== null && fireAgeWithout === null) {
    fireDelayText = `FIRE at age ${fireAgeWith} (not reachable without goals adjustment)`
    fireDelayColor = 'text-muted-foreground'
  } else if (fireAgeWith !== null && fireAgeWithout !== null) {
    const delay = fireAgeWith - fireAgeWithout
    if (delay === 0) {
      fireDelayText = `No delay — FIRE at age ${fireAgeWith}`
      fireDelayColor = 'text-green-600 dark:text-green-400'
    } else if (delay > 0) {
      fireDelayText = `FIRE delayed from age ${fireAgeWithout} to ${fireAgeWith} (+${delay} year${delay > 1 ? 's' : ''})`
      fireDelayColor = 'text-amber-600 dark:text-amber-400'
    } else {
      // Negative delay means goals accelerate FIRE — this is mathematically
      // impossible (goals always cost money). If this fires, it signals a
      // calculation bug, not an edge case to display gracefully.
      console.error(`[GoalImpactSummary] Goals appear to accelerate FIRE by ${Math.abs(delay)} years. This indicates a calculation bug.`)
      fireDelayText = `Something looks wrong: goals appear to speed up FIRE. This is likely a calculation error. Please report this issue.`
      fireDelayColor = 'text-destructive'
    }
  } else {
    fireDelayText = ''
    fireDelayColor = ''
  }

  const portfolioDelta = terminalWith - terminalWithout

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Goal Impact
          <InfoTooltip text="Shows how your financial goals affect your FIRE timeline and final cash and investments at life expectancy." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total Goal Cost</p>
            <p className="text-lg font-semibold">{formatCurrency(totalGoalCost)}</p>
            <p className="text-xs text-muted-foreground">
              across {profile.financialGoals.length} goal{profile.financialGoals.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">FIRE Timeline</p>
            <p className={`text-sm font-medium ${fireDelayColor}`}>{fireDelayText}</p>
          </div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Final Cash & Investments Impact</p>
          <p className="text-sm">
            <span className="font-semibold">{formatCurrency(terminalWith)}</span>
            <span className="text-muted-foreground"> vs </span>
            <span className="font-semibold">{formatCurrency(terminalWithout)}</span>
            <span className="text-muted-foreground"> without goals </span>
            <span className={portfolioDelta < 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
              ({portfolioDelta >= 0 ? '+' : ''}{formatCurrency(portfolioDelta)})
            </span>
          </p>
        </div>

        {/* Warnings */}
        {underfundedAges.length > 0 && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive">
              Goal costs exceed available funds
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              At age{underfundedAges.length > 1 ? 's' : ''}{' '}
              {underfundedAges.length <= 5
                ? underfundedAges.join(', ')
                : `${underfundedAges[0]}–${underfundedAges[underfundedAges.length - 1]}`
              }, your portfolio cannot fully fund the goal.
              The shortfall of {formatCurrency(totalShortfall)} is not financed. Consider reducing goal amounts or pushing target ages later.
            </p>
          </div>
        )}

        {goalsCauseDepletion && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Goals cause portfolio depletion at age {depletionWith}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Without goals, your portfolio survives to life expectancy.
              With goals, it runs out at age {depletionWith}. Consider reducing or deferring some goals.
            </p>
          </div>
        )}

        {goalsAccelerateDepletion && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Goals accelerate portfolio depletion by {depletionWithout! - depletionWith!} year{depletionWithout! - depletionWith! > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Portfolio depletes at age {depletionWith} vs {depletionWithout} without goals.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
