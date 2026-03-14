import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { getNudgeFlow, getFullPageFlowIds } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId, NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'
import type { HouseholdCpfConfig } from '@/lib/household/types'
import type { DownsizingConfig, HealthcareConfig } from '@/lib/types'

const DELTA_BEFORE_KEY = 'fireplanner-delta-before'

function applyFlowValues(flowId: NudgeFlowId, values: Record<string, unknown>): void {
  const store = useHouseholdPlanStore.getState()
  const plan = store.plan
  const selfAdult = plan.adults.find((a) => a.owner === 'self')
  if (!selfAdult) return

  switch (flowId) {
    case 'cpf': {
      const balances: HouseholdCpfConfig['balances'] = {
        ...selfAdult.cpf.balances,
        ...(typeof values.cpfOA === 'number' ? { oa: values.cpfOA } : {}),
        ...(typeof values.cpfSA === 'number' ? { sa: values.cpfSA } : {}),
        ...(typeof values.cpfMA === 'number' ? { ma: values.cpfMA } : {}),
        ...(typeof values.cpfRA === 'number' ? { ra: values.cpfRA } : {}),
      }

      const annualTopUps: HouseholdCpfConfig['annualTopUps'] = {
        ...selfAdult.cpf.annualTopUps,
        ...(typeof values.annualSaTopUp === 'number' ? { sa: values.annualSaTopUp } : {}),
        ...(typeof values.annualMaTopUp === 'number' ? { ma: values.annualMaTopUp } : {}),
      }

      const cpfUpdates: Partial<HouseholdCpfConfig> = {
        balances,
        annualTopUps,
      }

      if (typeof values.cpfLifePlan === 'string') {
        cpfUpdates.lifePlan = values.cpfLifePlan as HouseholdCpfConfig['lifePlan']
      }
      if (typeof values.cpfPayoutStartAge === 'number') {
        cpfUpdates.lifeStartAge = values.cpfPayoutStartAge
      }
      if (typeof values.hasCpfis === 'boolean') {
        cpfUpdates.cpfisEnabled = values.hasCpfis
      }

      store.updateAdult(selfAdult.id, {
        cpf: { ...selfAdult.cpf, ...cpfUpdates },
      })
      break
    }

    case 'property': {
      const property = plan.properties[0]
      if (!property) break

      const propertyUpdates: Record<string, unknown> = {}

      if (typeof values.propertyValue === 'number') {
        propertyUpdates.existingPropertyValue = values.propertyValue
      }
      if (typeof values.mortgageOutstanding === 'number') {
        propertyUpdates.existingMortgageBalance = values.mortgageOutstanding
      }
      if (typeof values.monthlyMortgagePayment === 'number') {
        propertyUpdates.existingMonthlyPayment = values.monthlyMortgagePayment
      }
      if (typeof values.mortgageRatePercent === 'number') {
        propertyUpdates.existingMortgageRate = values.mortgageRatePercent
      }
      if (typeof values.mortgageEndYear === 'number') {
        const currentYear = new Date().getFullYear()
        const remainingYears = Math.max(0, values.mortgageEndYear - currentYear)
        propertyUpdates.existingMortgageRemainingYears = remainingYears
      }
      if (typeof values.monthlyRentalIncome === 'number') {
        // Rental yield as annual rental / property value
        const propValue =
          typeof values.propertyValue === 'number'
            ? values.propertyValue
            : property.existingPropertyValue
        if (propValue > 0) {
          propertyUpdates.rentalYield = ((values.monthlyRentalIncome as number) * 12) / propValue
        }
      }

      if (values.planToDownsize === true) {
        const downsizing: DownsizingConfig = {
          ...property.downsizing,
          scenario: 'sell-and-downsize',
        }
        if (typeof values.downsizeYear === 'number') {
          const currentYear = new Date().getFullYear()
          const selfAge = selfAdult.currentAge
          downsizing.sellAge = selfAge + (values.downsizeYear - currentYear)
        }
        if (typeof values.downsizeProceedsPercent === 'number') {
          // Proceeds percent maps to sale price expectation (informational)
        }
        if (typeof values.replacementPropertyCost === 'number') {
          downsizing.newPropertyCost = values.replacementPropertyCost
        }
        propertyUpdates.downsizing = downsizing
      }

      store.updateProperty(property.id, propertyUpdates)
      break
    }

    case 'expenses': {
      const baseExpense = plan.expenses.find(
        (e) => e.kind === 'base-living' && e.timing.owner === 'self'
      )
      if (!baseExpense) break

      const categoryFields = [
        'housingExpenses',
        'foodExpenses',
        'transportExpenses',
        'utilitiesExpenses',
        'entertainmentExpenses',
        'travelExpenses',
        'otherExpenses',
      ] as const

      const total = categoryFields.reduce((sum, field) => {
        const val = values[field]
        return sum + (typeof val === 'number' && val > 0 ? val : 0)
      }, 0)

      const expenseUpdates: Record<string, unknown> = {}
      if (total > 0) {
        // Category values are monthly; convert to annual
        expenseUpdates.amount = total * 12
      }
      if (typeof values.retirementSpendingRatio === 'number') {
        expenseUpdates.retirementSpendingAdjustment = values.retirementSpendingRatio
      }

      store.updateExpense(baseExpense.id, expenseUpdates)
      break
    }

    case 'healthcare': {
      const healthcareUpdates: Partial<HealthcareConfig> = {
        ...selfAdult.healthcare,
        enabled: true,
      }

      if (typeof values.ispTier === 'string') {
        healthcareUpdates.ispTier = values.ispTier as HealthcareConfig['ispTier']
      }
      if (typeof values.careShieldEnrolled === 'boolean') {
        healthcareUpdates.careShieldLifeEnabled = values.careShieldEnrolled
      }

      store.updateAdult(selfAdult.id, {
        healthcare: healthcareUpdates as HealthcareConfig,
      })
      break
    }

    default:
      break
  }
}

function getVisibleScreens(
  screens: NudgeFlowScreen[],
  values: Record<string, unknown>
): NudgeFlowScreen[] {
  return screens.filter((screen) => !shouldSkipScreen(screen, values))
}

export default function RefineFlowPage() {
  const { flowId } = useParams<{ flowId: string }>()
  const navigate = useNavigate()
  const snapshot = useMetricsSnapshot()
  const snapshotCaptured = useRef(false)

  const fullPageIds = useMemo(() => getFullPageFlowIds(), [])
  const flow = flowId ? getNudgeFlow(flowId as NudgeFlowId) : undefined
  const isValid = flowId != null && fullPageIds.includes(flowId as NudgeFlowId) && flow != null

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0)

  // Capture before-snapshot on mount
  useEffect(() => {
    if (!isValid || snapshotCaptured.current) return
    snapshotCaptured.current = true

    const beforeData: MetricsSnapshot & { timestamp: number } = {
      ...snapshot,
      timestamp: Date.now(),
    }
    try {
      sessionStorage.setItem(DELTA_BEFORE_KEY, JSON.stringify(beforeData))
    } catch {
      // sessionStorage may be unavailable
    }
  }, [isValid, snapshot])

  // Redirect if flowId is invalid
  useEffect(() => {
    if (!isValid) {
      navigate('/', { replace: true })
    }
  }, [isValid, navigate])

  const handleChange = useCallback((field: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const visibleScreens = useMemo(
    () => (flow ? getVisibleScreens(flow.screens, values) : []),
    [flow, values]
  )

  const currentScreen = visibleScreens[currentScreenIndex]

  const handleNext = useCallback(() => {
    if (!flow || !flowId) return

    // Recompute visible screens with latest values to handle skip logic
    const latestVisible = getVisibleScreens(flow.screens, values)

    if (currentScreenIndex < latestVisible.length - 1) {
      setCurrentScreenIndex((i) => i + 1)
      return
    }

    // Final screen: apply values and navigate
    applyFlowValues(flowId as NudgeFlowId, values)

    // Mark flow as completed in UIStore
    const uiStore = useUIStore.getState()
    const completed = uiStore.completedNudgeFlows
    if (!completed.includes(flowId as NudgeFlowId)) {
      useUIStore.getState().setField('completedNudgeFlows', [
        ...completed,
        flowId as NudgeFlowId,
      ])
    }

    navigate('/projection', {
      state: { showDelta: true, flowId },
    })
  }, [flow, flowId, values, currentScreenIndex, navigate])

  const handleBack = useCallback(() => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex((i) => i - 1)
    }
  }, [currentScreenIndex])

  if (!isValid || !flow || !currentScreen) return null

  const isLastScreen = currentScreenIndex === visibleScreens.length - 1

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projection')}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projection
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">{flow.label}</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <SetupScreen
          screen={currentScreen}
          values={values}
          onChange={handleChange}
          onNext={handleNext}
          onBack={currentScreenIndex > 0 ? handleBack : undefined}
          currentStep={currentScreenIndex + 1}
          totalSteps={visibleScreens.length}
          submitLabel={isLastScreen ? 'Save & see impact' : 'Continue'}
        />
      </main>
    </div>
  )
}
