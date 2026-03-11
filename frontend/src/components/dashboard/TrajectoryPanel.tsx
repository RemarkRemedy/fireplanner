import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NWChartView } from '@/components/projection/NWChartView'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { useProjection } from '@/hooks/useProjection'

export function TrajectoryPanel() {
  const { normalized } = useHouseholdRuntimeInputs()
  const retirementAge = normalized.retirementAge
  const { rows } = useProjection()

  if (!rows || rows.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Portfolio Trajectory</CardTitle>
          <Link
            to="/projection"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View full projection
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <NWChartView rows={rows} retirementAge={retirementAge} />
      </CardContent>
    </Card>
  )
}
