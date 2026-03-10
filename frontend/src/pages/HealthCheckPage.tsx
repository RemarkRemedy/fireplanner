import { useState } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { useInsuranceNeeds } from '@/hooks/useInsuranceNeeds'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RatioGrid } from '@/components/health/RatioGrid'
import { InsuranceNeedsPanel } from '@/components/health/InsuranceNeedsPanel'

export function HealthCheckPage() {
  const adults = useHouseholdPlanStore((s) => s.plan.adults)
  const isMultiAdult = adults.length > 1

  const [selectedAdultId, setSelectedAdultId] = useState(adults[0]?.id ?? '')

  const healthCheck = useHealthCheck(selectedAdultId)
  const insuranceNeeds = useInsuranceNeeds(selectedAdultId)

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

      {healthCheck.result && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Health Ratios</h2>
            <span className="text-sm text-muted-foreground">
              {healthCheck.result.greenCount}/8 healthy
            </span>
          </div>
          <RatioGrid result={healthCheck.result} />
        </div>
      )}

      {insuranceNeeds.result && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Insurance Needs</h2>
          <InsuranceNeedsPanel result={insuranceNeeds.result} />
        </div>
      )}
    </div>
  )
}
