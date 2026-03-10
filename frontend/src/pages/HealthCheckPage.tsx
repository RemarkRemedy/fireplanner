import { useMemo, useState } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useHealthCheckInputs } from '@/hooks/useHealthCheckInputs'
import { computeHealthRatios, type HealthCheckResult } from '@/lib/calculations/healthCheck'
import { computeInsuranceNeeds, type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RatioGrid } from '@/components/health/RatioGrid'
import { InsuranceNeedsPanel } from '@/components/health/InsuranceNeedsPanel'

export function HealthCheckPage() {
  const adults = useHouseholdPlanStore((s) => s.plan.adults)
  const isMultiAdult = adults.length > 1

  const [selectedAdultId, setSelectedAdultId] = useState(adults[0]?.id ?? '')

  // Single call to useHealthCheckInputs — derives both ratio and insurance inputs
  const inputs = useHealthCheckInputs(selectedAdultId)

  const healthCheck: HealthCheckResult | null = useMemo(() => {
    if (!inputs) return null
    return computeHealthRatios(inputs.ratioInputs)
  }, [inputs])

  const insuranceNeeds: InsuranceNeedsResult | null = useMemo(() => {
    if (!inputs) return null
    return computeInsuranceNeeds(inputs.insuranceInputs)
  }, [inputs])

  if (!inputs?.isReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Financial Health Check</h1>
          <p className="text-muted-foreground mt-1">
            Enter your income and expenses to see your financial health ratios and insurance needs analysis.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial Health Check</h1>
        <p className="text-muted-foreground mt-1">
          8 financial health ratios and insurance needs analysis
        </p>
      </div>

      {isMultiAdult && (
        <Tabs value={selectedAdultId} onValueChange={setSelectedAdultId}>
          <TabsList>
            {adults.map((adult) => (
              <TabsTrigger key={adult.id} value={adult.id}>
                {adult.displayName}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {healthCheck && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Health Ratios</h2>
            <span className="text-sm text-muted-foreground">
              {healthCheck.greenCount}/{healthCheck.ratios.length} healthy
            </span>
          </div>
          <RatioGrid result={healthCheck} />
        </div>
      )}

      {insuranceNeeds && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Insurance Needs</h2>
          <InsuranceNeedsPanel result={insuranceNeeds} />
        </div>
      )}
    </div>
  )
}
