import { useEffect, useMemo, useState } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useHealthCheckInputs } from '@/hooks/useHealthCheckInputs'
import { computeHealthRatios, type HealthCheckResult } from '@/lib/calculations/healthCheck'
import { computeInsuranceNeeds, type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { useTaxOptimization } from '@/hooks/useTaxOptimization'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { RatioGroup } from '@/components/health/RatioGroup'
import { TaxOptimizationPanel } from '@/components/health/TaxOptimizationPanel'
import { HEALTH_RATIOS } from '@/lib/data/healthBenchmarks'
import { MONEYSENSE_AREAS, MONEYSENSE_DISCLAIMER, getLifeStageGuides } from '@/lib/data/moneySenseGuide'
import { cn } from '@/lib/utils'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ExternalLink } from 'lucide-react'

function formatThreshold(value: number, unit: string): string {
  if (unit === 'months') return `${value} mo`
  if (unit === '%') return `${(value * 100).toFixed(0)}%`
  return value.toFixed(2)
}

const healthCheckAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'SG FIRE Planner — Financial Health Check',
  url: 'https://sgfireplanner.com/health-check',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Check your financial health with Singapore-specific ratios: savings rate, emergency fund, debt service (TDSR), liquidity, insurance coverage, and CPF adequacy.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'SGD' },
  browserRequirements: 'Requires JavaScript',
}

export function HealthCheckPage() {
  usePageMeta({
    title: 'Health Check | SG FIRE Planner',
    description:
      'Check your financial health against MoneySense guidelines: emergency funds, protection, debt health, and investment ratios.',
    path: '/health-check',
  })

  useEffect(() => {
    const appScript = document.createElement('script')
    appScript.type = 'application/ld+json'
    appScript.setAttribute('data-page-meta', 'app')
    appScript.textContent = JSON.stringify(healthCheckAppSchema)
    document.head.appendChild(appScript)
    return () => { document.head.removeChild(appScript) }
  }, [])
  const adults = useHouseholdPlanStore((s) => s.plan.adults)
  const isMultiAdult = adults.length > 1
  const [selectedAdultId, setSelectedAdultId] = useState(adults[0]?.id ?? '')

  // Fall back to first adult if selected ID is no longer valid (adult removed, plan changed)
  const validAdultId = adults.find((a) => a.id === selectedAdultId) ? selectedAdultId : (adults[0]?.id ?? '')

  // Use the selected adult's age for life-stage guide (not useProfileStore, which is always the primary adult)
  const selectedAdult = adults.find((a) => a.id === validAdultId)
  const currentAge = selectedAdult?.currentAge ?? 30

  const inputs = useHealthCheckInputs(validAdultId)

  const healthCheck: HealthCheckResult | null = useMemo(() => {
    if (!inputs) return null
    return computeHealthRatios(inputs.ratioInputs)
  }, [inputs])

  const insuranceNeeds: InsuranceNeedsResult | null = useMemo(() => {
    if (!inputs) return null
    return computeInsuranceNeeds(inputs.insuranceInputs)
  }, [inputs])

  const taxOptimization = useTaxOptimization(validAdultId)

  const lifeStageGuides = getLifeStageGuides(currentAge)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Financial Health Check</h1>
        <p className="text-muted-foreground mt-1">
          Your finances assessed against 4 key areas from the{' '}
          <a
            href="https://www.moneysense.gov.sg/planning-your-finances-well/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            MoneySense Basic Financial Planning Guide
          </a>
        </p>
        {healthCheck && inputs?.isReady && (
          <p className="text-sm text-muted-foreground mt-1">
            {healthCheck.greenCount}/{healthCheck.ratios.length} ratios healthy
          </p>
        )}
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

      {!inputs?.isReady ? (
        <div className="rounded-lg border border-dashed p-8 text-center bg-muted/20">
          <p className="text-muted-foreground">
            Enter income and expenses for {selectedAdult?.displayName ?? 'this adult'} to see the health assessment.
          </p>
        </div>
      ) : healthCheck ? (
        <>
          {/* 4 MoneySense areas */}
          {MONEYSENSE_AREAS.map((area, i) => (
            <RatioGroup
              key={area.id}
              area={area}
              ratios={healthCheck.ratios}
              insuranceNeeds={insuranceNeeds}
              insuranceInputs={inputs?.insuranceInputs ?? null}
              showDivider={i > 0}
            />
          ))}

          {/* Tax Optimisation */}
          {taxOptimization?.isReady && (
            <TaxOptimizationPanel
              result={taxOptimization.result}
              residencyStatus={selectedAdult?.residencyStatus ?? 'citizen'}
            />
          )}

          {/* Detailed ratio reference (collapsed) */}
          <Accordion type="single" collapsible>
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
                            <div
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                computed.status === 'green' && 'bg-emerald-500',
                                computed.status === 'amber' && 'bg-amber-500',
                                computed.status === 'red' && 'bg-red-500'
                              )}
                            />
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
                              {meta.direction === 'higher-is-better' ? '>=' : '<='}{' '}
                              {formatThreshold(meta.thresholds.greenBound, meta.unit)}
                            </span>
                            {' / '}
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {meta.direction === 'higher-is-better' ? '>=' : '<='}{' '}
                              {formatThreshold(meta.thresholds.amberBound, meta.unit)}
                            </span>
                            {' / '}
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                              otherwise
                            </span>
                          </p>
                          <div className="mt-1.5 space-y-0.5">
                            <p>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                              {meta.tip.green}
                            </p>
                            <p>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />
                              {meta.tip.amber}
                            </p>
                            <p>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
                              {meta.tip.red}
                            </p>
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
        </>
      ) : null}

      {/* Life-stage guide links */}
      {lifeStageGuides.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium mb-1">
            {lifeStageGuides.length === 1
              ? 'MoneySense guide for your life stage:'
              : 'MoneySense guides for your life stage:'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {lifeStageGuides.map((guide) => (
              <a
                key={guide.label}
                href={guide.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                {guide.label} (PDF)
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        {MONEYSENSE_DISCLAIMER}
      </p>
    </div>
  )
}
