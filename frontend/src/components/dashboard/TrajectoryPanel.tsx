import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { QuickProjectionChart } from '@/components/shared/QuickProjectionChart'
import { useProjection } from '@/hooks/useProjection'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useProfileStore } from '@/stores/useProfileStore'

export function TrajectoryPanel() {
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const { rows } = useProjection()
  const { metrics } = useFireCalculations()

  if (!rows || rows.length === 0 || !metrics) return null

  const fireNumber = metrics.fireNumber
  const fireAge = metrics.fireAge

  // Transform full projection rows into the simple {age, balance, phase} format
  const chartData = rows.map((row) => ({
    age: row.age,
    balance: row.liquidNW,
    phase: (row.age >= retirementAge ? 'decumulation' : 'accumulation') as 'accumulation' | 'decumulation',
  }))

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
        <QuickProjectionChart data={chartData} fireNumber={fireNumber} fireAge={fireAge} />
      </CardContent>
    </Card>
  )
}
