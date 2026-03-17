import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, FlaskConical } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusPanel } from '@/components/dashboard/StatusPanel'
import { WhatIfPanel } from '@/components/dashboard/WhatIfPanel'
import { TimeCostPanel } from '@/components/dashboard/TimeCostPanel'
import { OneMoreYearPanel } from '@/components/dashboard/OneMoreYearPanel'
import { CashFlowPanel } from '@/components/dashboard/CashFlowPanel'
import { RiskDashboard } from '@/components/dashboard/RiskDashboard'
import { EmptyDashboardState } from '@/components/dashboard/EmptyDashboardState'
import { PlanCompleteness } from '@/components/dashboard/PlanCompleteness'
import { NudgeDrawer } from '@/components/projection/NudgeDrawer'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import { StrategyCard } from '@/components/dashboard/StrategyCard'
import { PassiveIncomePanel } from '@/components/dashboard/PassiveIncomePanel'
import { TrajectoryPanel } from '@/components/dashboard/TrajectoryPanel'
import { PerAdultBreakdownPanel } from '@/components/dashboard/PerAdultBreakdownPanel'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { usePerAdultBreakdown } from '@/hooks/usePerAdultBreakdown'
import { useSectionCompletion, type SectionId } from '@/hooks/useSectionCompletion'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ExpenseTrackerCard } from '@/components/email/ExpenseTrackerCard'
import { useExpenseTrackerDwell } from '@/hooks/useExpenseTrackerDwell'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

const INDIVIDUAL_KEY_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'section-personal', label: 'Personal Details' },
  { id: 'section-income', label: 'Income' },
  { id: 'section-expenses', label: 'Expenses' },
  { id: 'section-net-worth', label: 'Net Worth' },
]

const HOUSEHOLD_KEY_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'section-personal', label: 'People & Household' },
  { id: 'section-income', label: 'Income & Work' },
  { id: 'section-expenses', label: 'Spending & Goals' },
  { id: 'section-net-worth', label: 'Assets & Net Worth' },
]

export function DashboardPage() {
  usePageMeta({ title: 'Dashboard — SG FIRE Planner', description: 'See your FIRE number, years to retirement, portfolio at retirement, success probability, and risk assessment in one view. Updated live as you adjust inputs.', path: '/dashboard' })
  const metrics = useDashboardMetrics()
  const isEmpty = metrics.fireNumber === null
  const { isEligible } = useExpenseTracker()
  useExpenseTrackerDwell(!isEmpty, 20)
  const { sections } = useSectionCompletion()
  const householdPlanType = useHouseholdPlanStore((state) => state.plan.planType)

  const [drawerFlowId, setDrawerFlowId] = useState<NudgeFlowId | null>(null)
  const lastMC = useSimulationStore((s) => s.lastMCSuccessRate)
  const lastBT = useSimulationStore((s) => s.lastBacktestSuccessRate)
  const hasRunSimulation = lastMC !== null || lastBT !== null

  const perAdult = usePerAdultBreakdown()
  const [selectedView, setSelectedView] = useState('joint')

  const isHouseholdMode = isHouseholdPlannerV1Enabled() && householdPlanType !== 'individual'
  const keySections = isHouseholdMode ? HOUSEHOLD_KEY_SECTIONS : INDIVIDUAL_KEY_SECTIONS
  const uncustomized = keySections.filter((section) => !sections[section.id].isComplete)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">FIRE Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Your financial independence snapshot. All metrics are computed from your profile, income, and allocation settings.
        </p>
      </div>

      <PlanCompleteness onOpenDrawer={setDrawerFlowId} />

      {!isEmpty && uncustomized.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p>
              {isHouseholdMode
                ? "Some household sections still look under-specified. Personalize them so the combined analysis reflects who the plan covers."
                : "You're using default values for some sections. Personalize your inputs for accurate results:"}
            </p>
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
      ) : perAdult ? (
        <Tabs value={selectedView} onValueChange={setSelectedView} className="mt-2">
          <TabsList>
            <TabsTrigger value="joint">Joint</TabsTrigger>
            {perAdult.adults.map((adult) => (
              <TabsTrigger key={adult.id} value={adult.id}>
                {adult.displayName}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="joint">
            <JointPanels metrics={metrics} isEligible={isEligible} />
          </TabsContent>

          {perAdult.adults.map((adult) => (
            <TabsContent key={adult.id} value={adult.id}>
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-3" data-testid="per-adult-heading">
                    {adult.displayName}&apos;s Financial Snapshot
                  </h2>
                  <PerAdultBreakdownPanel
                    adult={adult}
                    householdTotalIncome={perAdult.householdTotalIncome}
                    householdTotalNetWorth={perAdult.householdTotalNetWorth}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold">Joint Plan Metrics</h2>
                    <span className="text-xs text-muted-foreground">(household-level)</span>
                  </div>
                  <StatusPanel {...metrics} />
                  <TrajectoryPanel />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <JointPanels metrics={metrics} isEligible={isEligible} />
      )}

      <NudgeDrawer
        flowId={drawerFlowId}
        onClose={() => setDrawerFlowId(null)}
        onComplete={(_delta) => { setDrawerFlowId(null) }}
      />
    </div>
  )
}

// Internal component: all existing joint-view panels, extracted to avoid duplication
// between the couple (Tabs) and individual (plain) render paths.
function JointPanels({ metrics, isEligible }: { metrics: ReturnType<typeof useDashboardMetrics>; isEligible: boolean }) {
  return (
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
      {isEligible && (
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '440ms' }}>
          <ExpenseTrackerCard />
        </div>
      )}
    </>
  )
}
