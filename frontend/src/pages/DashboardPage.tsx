import { Link } from 'react-router-dom'
import { Info, FlaskConical } from 'lucide-react'
import { StatusPanel } from '@/components/dashboard/StatusPanel'
import { WhatIfPanel } from '@/components/dashboard/WhatIfPanel'
import { TimeCostPanel } from '@/components/dashboard/TimeCostPanel'
import { OneMoreYearPanel } from '@/components/dashboard/OneMoreYearPanel'
import { CashFlowPanel } from '@/components/dashboard/CashFlowPanel'
import { RiskDashboard } from '@/components/dashboard/RiskDashboard'
import { EmptyDashboardState } from '@/components/dashboard/EmptyDashboardState'
import { StrategyCard } from '@/components/dashboard/StrategyCard'
import { PassiveIncomePanel } from '@/components/dashboard/PassiveIncomePanel'
import { TrajectoryPanel } from '@/components/dashboard/TrajectoryPanel'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useSectionCompletion, type SectionId } from '@/hooks/useSectionCompletion'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePageMeta } from '@/hooks/usePageMeta'

const KEY_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'section-personal', label: 'Personal Details' },
  { id: 'section-income', label: 'Income' },
  { id: 'section-expenses', label: 'Expenses' },
  { id: 'section-net-worth', label: 'Net Worth' },
]

export function DashboardPage() {
  usePageMeta({ title: 'Dashboard — SG FIRE Planner', description: 'Your FIRE dashboard with key metrics, risk assessment, and retirement readiness overview.', path: '/dashboard' })
  const metrics = useDashboardMetrics()
  const isEmpty = metrics.fireNumber === null
  const { sections } = useSectionCompletion()

  const lastMC = useSimulationStore((s) => s.lastMCSuccessRate)
  const lastBT = useSimulationStore((s) => s.lastBacktestSuccessRate)
  const hasRunSimulation = lastMC !== null || lastBT !== null

  const uncustomized = KEY_SECTIONS.filter((s) => !sections[s.id].isComplete)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">FIRE Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Your financial independence snapshot. All metrics are computed from your profile, income, and allocation settings.
        </p>
      </div>

      {!isEmpty && uncustomized.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p>You're using default values for some sections. Personalize your inputs for accurate results:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {uncustomized.map((s) => (
                <Link
                  key={s.id}
                  to={`/inputs#${s.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isEmpty && !hasRunSimulation && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3">
          <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            These results are early estimates based on your inputs. Verify your year-by-year numbers in{' '}
            <Link to="/projection" className="font-medium underline hover:no-underline">Projection</Link>, then{' '}
            <Link to="/stress-test" className="font-medium underline hover:no-underline">Stress Test</Link>{' '}
            your plan to see how it holds up against life's uncertainties.
          </div>
        </div>
      )}

      {isEmpty ? (
        <EmptyDashboardState />
      ) : (
        <>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <StatusPanel {...metrics} />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '40ms' }}>
            <TrajectoryPanel />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <WhatIfPanel />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <TimeCostPanel />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
            <OneMoreYearPanel />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <StrategyCard />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <PassiveIncomePanel />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '320ms' }}>
            <CashFlowPanel />
          </div>
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <RiskDashboard />
          </div>
        </>
      )}
    </div>
  )
}
