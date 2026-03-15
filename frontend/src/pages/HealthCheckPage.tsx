import { useMemo, useState } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useHealthCheckInputs } from '@/hooks/useHealthCheckInputs'
import { computeHealthRatios, type HealthCheckResult } from '@/lib/calculations/healthCheck'
import { computeInsuranceNeeds, type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { RatioGrid } from '@/components/health/RatioGrid'
import { InsuranceNeedsPanel } from '@/components/health/InsuranceNeedsPanel'
import { HEALTH_RATIOS } from '@/lib/data/healthBenchmarks'
import { cn } from '@/lib/utils'
import { usePageMeta } from '@/hooks/usePageMeta'

function formatThreshold(value: number, unit: string): string {
  if (unit === 'months') return `${value} mo`
  if (unit === '%') return `${(value * 100).toFixed(0)}%`
  return value.toFixed(2)
}

export function HealthCheckPage() {
  usePageMeta({ title: 'Health Check — SG FIRE Planner', description: 'Check your financial health with Singapore-specific ratios: savings rate, emergency fund, debt service (TDSR), liquidity, insurance coverage, and CPF adequacy.', path: '/health-check' })
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

          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="ratio-guide">
              <AccordionTrigger className="text-sm font-medium">
                Understanding these ratios
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {HEALTH_RATIOS.map((meta) => {
                    const computed = healthCheck.ratios.find((r) => r.id === meta.id)
                    return (
                      <div key={meta.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          {computed?.status && (
                            <div className={cn(
                              'h-2 w-2 rounded-full shrink-0',
                              computed.status === 'green' && 'bg-emerald-500',
                              computed.status === 'amber' && 'bg-amber-500',
                              computed.status === 'red' && 'bg-red-500',
                            )} />
                          )}
                          <h4 className="text-sm font-semibold">{meta.label}</h4>
                          {computed?.displayValue && computed.displayValue !== '—' && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              ({computed.displayValue})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{meta.description}</p>
                        <div className="text-xs space-y-1">
                          <p>
                            <span className="font-medium">Formula: </span>
                            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{meta.formula}</code>
                          </p>
                          <p>
                            <span className="font-medium">Thresholds: </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {meta.direction === 'higher-is-better' ? '>=' : '<='} {formatThreshold(meta.thresholds.greenBound, meta.unit)}
                            </span>
                            {' / '}
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {meta.direction === 'higher-is-better' ? '>=' : '<='} {formatThreshold(meta.thresholds.amberBound, meta.unit)}
                            </span>
                            {' / '}
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                              otherwise
                            </span>
                          </p>
                          <div className="mt-1.5 space-y-0.5">
                            <p><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />{meta.tip.green}</p>
                            <p><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />{meta.tip.amber}</p>
                            <p><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />{meta.tip.red}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Source: {meta.source}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
