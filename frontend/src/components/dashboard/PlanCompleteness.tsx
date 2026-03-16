import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlanCompleteness } from '@/hooks/usePlanCompleteness'
import type { CompletenessRow } from '@/hooks/usePlanCompleteness'

export function PlanCompleteness() {
  const rows = usePlanCompleteness()
  const navigate = useNavigate()

  const providedCount = rows.filter(r => r.status === 'provided' || r.status === 'provided-basic' || r.status === 'not-applicable').length
  const totalCount = rows.length

  const handleAction = (row: CompletenessRow) => {
    // All flows now open as drawers on the projection page
    navigate('/projection', { state: { openFlow: row.flowId } })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span>Plan Completeness</span>
          <span className="text-sm font-normal text-muted-foreground">
            {providedCount} / {totalCount} sections filled
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const isProvided = row.status === 'provided' || row.status === 'not-applicable'
            const isBasic = row.status === 'provided-basic'
            const showAction = row.status !== 'not-applicable'

            return (
              <li key={row.flowId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="shrink-0">
                  {isProvided ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isBasic ? (
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none">{row.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.detail}</p>
                </div>
                {showAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 px-2 text-xs"
                    onClick={() => handleAction(row)}
                  >
                    {row.actionLabel}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
