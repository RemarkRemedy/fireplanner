import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AllocationBuilder } from '@/components/allocation/AllocationBuilder'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import type { PlanningAdult } from '@/lib/household/types'
import type {
  FireNumberBasis,
  FireType,
  GlidePathMethod,
  RebalanceFrequency,
} from '@/lib/types'

type AssumptionsSectionMode = 'assumptions' | 'allocation'

interface AssumptionsSectionProps {
  mode: AssumptionsSectionMode
}

const GLIDE_PATH_METHODS: GlidePathMethod[] = ['linear', 'slowStart', 'fastStart']

const GLIDE_PATH_LABELS: Record<GlidePathMethod, string> = {
  linear: 'Linear',
  slowStart: 'Slow start',
  fastStart: 'Fast start',
}

function AllocationAssumptionsContent({
  referenceAdult,
}: {
  referenceAdult: PlanningAdult | null
}) {
  const glidePathConfig = useAllocationStore((state) => state.glidePathConfig)
  const allocationValidationErrors = useAllocationStore((state) => state.validationErrors)
  const setGlidePathConfig = useAllocationStore((state) => state.setGlidePathConfig)

  const toggleGlidePath = (enabled: boolean) => {
    if (!referenceAdult) return
    setGlidePathConfig({
      ...glidePathConfig,
      enabled,
      startAge: enabled ? glidePathConfig.startAge ?? Math.max(referenceAdult.currentAge, referenceAdult.retirementAge - 5) : glidePathConfig.startAge,
      endAge: enabled ? glidePathConfig.endAge ?? referenceAdult.retirementAge + 10 : glidePathConfig.endAge,
    })
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardContent className="py-5 space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Allocation stays global, not member-specific.</p>
          <p>
            Use this surface for the shared portfolio template and glide path that the household analysis reads.
            Defaults follow the first adult&apos;s timeline instead of the legacy profile store.
          </p>
        </CardContent>
      </Card>

      <AllocationBuilder />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Household Glide Path
              <InfoTooltip text="Transition from the current allocation to the retirement allocation over a household-aware age range anchored to the first adult." />
            </CardTitle>
            <Switch checked={glidePathConfig.enabled} onCheckedChange={toggleGlidePath} />
          </div>
        </CardHeader>
        {glidePathConfig.enabled && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Age timeline follows {referenceAdult?.displayName ?? 'the first adult'}.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Method</Label>
                <Select
                  value={glidePathConfig.method}
                  onValueChange={(value) => setGlidePathConfig({
                    ...glidePathConfig,
                    method: value as GlidePathMethod,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GLIDE_PATH_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {GLIDE_PATH_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberInput
                label="Start age"
                value={glidePathConfig.startAge}
                onChange={(value) => setGlidePathConfig({
                  ...glidePathConfig,
                  startAge: value,
                })}
                integer
                min={referenceAdult?.currentAge ?? 18}
                max={100}
                error={allocationValidationErrors['glidePathConfig.startAge']}
              />
              <NumberInput
                label="End age"
                value={glidePathConfig.endAge}
                onChange={(value) => setGlidePathConfig({
                  ...glidePathConfig,
                  endAge: value,
                })}
                integer
                min={glidePathConfig.startAge + 1}
                max={120}
                error={allocationValidationErrors['glidePathConfig.endAge']}
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export function AssumptionsSection({ mode }: AssumptionsSectionProps) {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const validationErrors = useHouseholdPlanStore((state) => state.validationErrors)
  const updateAssumptions = useHouseholdPlanStore((state) => state.updateAssumptions)

  const assumptionsErrors = validationErrors[`assumptions:${plan.id}`] ?? {}
  const referenceAdult = plan.adults.find((adult) => adult.owner === 'self') ?? plan.adults[0] ?? null
  const retirementMitigation = plan.assumptions.retirementMitigation

  if (mode === 'allocation') {
    return <AllocationAssumptionsContent referenceAdult={referenceAdult} />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Household FIRE Targets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <Label>FIRE type</Label>
            <Select
              value={plan.assumptions.fire.fireType}
              onValueChange={(value) => updateAssumptions({
                fire: {
                  fireType: value as FireType,
                },
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="lean">Lean</SelectItem>
                <SelectItem value="fat">Fat</SelectItem>
                <SelectItem value="coast">Coast</SelectItem>
                <SelectItem value="barista">Barista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PercentInput
            label="Safe withdrawal rate"
            value={plan.assumptions.fire.swr}
            onChange={(value) => updateAssumptions({
              fire: {
                swr: value,
              },
            })}
            error={assumptionsErrors['fire.swr']}
          />
          <div className="space-y-1">
            <Label>FIRE number basis</Label>
            <Select
              value={plan.assumptions.fire.fireNumberBasis}
              onValueChange={(value) => updateAssumptions({
                fire: {
                  fireNumberBasis: value as FireNumberBasis,
                },
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today&apos;s spending</SelectItem>
                <SelectItem value="retirement">Retirement spending</SelectItem>
                <SelectItem value="fireAge">At FIRE age</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Returns & Inflation
            <InfoTooltip text="Use a manual return assumption or inherit the portfolio return from the shared allocation builder. These settings feed the normalized household analysis slice." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={plan.assumptions.returns.usePortfolioReturn ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateAssumptions({
                returns: {
                  usePortfolioReturn: true,
                },
              })}
            >
              From allocation
            </Button>
            <Button
              type="button"
              variant={!plan.assumptions.returns.usePortfolioReturn ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateAssumptions({
                returns: {
                  usePortfolioReturn: false,
                },
              })}
            >
              Manual
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PercentInput
              label="Expected nominal return"
              value={plan.assumptions.returns.expectedReturn}
              onChange={(value) => updateAssumptions({
                returns: {
                  expectedReturn: value,
                },
              })}
              error={assumptionsErrors['returns.expectedReturn']}
              disabled={plan.assumptions.returns.usePortfolioReturn}
            />
            <PercentInput
              label="Inflation rate"
              value={plan.assumptions.returns.inflation}
              onChange={(value) => updateAssumptions({
                returns: {
                  inflation: value,
                },
              })}
              error={assumptionsErrors['returns.inflation']}
            />
            <PercentInput
              label="Expense ratio"
              value={plan.assumptions.returns.expenseRatio}
              onChange={(value) => updateAssumptions({
                returns: {
                  expenseRatio: value,
                },
              })}
              error={assumptionsErrors['returns.expenseRatio']}
              step={0.01}
            />
            <div className="space-y-1">
              <Label>Rebalancing frequency</Label>
              <Select
                value={plan.assumptions.returns.rebalanceFrequency}
                onValueChange={(value) => updateAssumptions({
                  returns: {
                    rebalanceFrequency: value as RebalanceFrequency,
                  },
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="semi-annual">Semi-annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Cash Reserve & Retirement Buffers
              <InfoTooltip text="Keep emergency cash and, if needed, add a dedicated retirement cash bucket without going back to the legacy cash reserve screen." />
            </CardTitle>
            <Switch
              checked={plan.assumptions.cashReserve.enabled}
              onCheckedChange={(checked) => updateAssumptions({
                cashReserve: {
                  enabled: checked,
                },
              })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.assumptions.cashReserve.enabled && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={plan.assumptions.cashReserve.mode === 'fixed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateAssumptions({
                    cashReserve: {
                      mode: 'fixed',
                    },
                  })}
                >
                  Fixed amount
                </Button>
                <Button
                  type="button"
                  variant={plan.assumptions.cashReserve.mode === 'months' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateAssumptions({
                    cashReserve: {
                      mode: 'months',
                    },
                  })}
                >
                  Months of expenses
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {plan.assumptions.cashReserve.mode === 'fixed' ? (
                  <CurrencyInput
                    label="Reserve target"
                    value={plan.assumptions.cashReserve.fixedAmount}
                    onChange={(value) => updateAssumptions({
                      cashReserve: {
                        fixedAmount: value,
                      },
                    })}
                    error={assumptionsErrors['cashReserve.fixedAmount']}
                  />
                ) : (
                  <NumberInput
                    label="Months of expenses"
                    value={plan.assumptions.cashReserve.months}
                    onChange={(value) => updateAssumptions({
                      cashReserve: {
                        months: value,
                      },
                    })}
                    integer
                    min={0}
                    max={60}
                    error={assumptionsErrors['cashReserve.months']}
                  />
                )}
                <PercentInput
                  label="Cash return"
                  value={plan.assumptions.cashReserve.returnRate}
                  onChange={(value) => updateAssumptions({
                    cashReserve: {
                      returnRate: value,
                    },
                  })}
                  error={assumptionsErrors['cashReserve.returnRate']}
                />
              </div>
            </>
          )}

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Retirement cash bucket</div>
                <div className="text-sm text-muted-foreground">
                  Use a dedicated cash bucket for early-retirement sequence-risk protection.
                </div>
              </div>
              <Switch
                checked={retirementMitigation.type === 'cash_bucket'}
                onCheckedChange={(checked) => updateAssumptions({
                  retirementMitigation: checked
                    ? {
                        type: 'cash_bucket',
                        targetMonths: 24,
                        cashReturn: 0.02,
                      }
                    : {
                        type: 'none',
                      },
                })}
              />
            </div>

            {retirementMitigation.type === 'cash_bucket' && (
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput
                  label="Bucket size (months)"
                  value={retirementMitigation.targetMonths}
                  onChange={(value) => updateAssumptions({
                    retirementMitigation: {
                      ...retirementMitigation,
                      targetMonths: value,
                    },
                  })}
                  integer
                  min={6}
                  max={60}
                />
                <PercentInput
                  label="Bucket cash return"
                  value={retirementMitigation.cashReturn}
                  onChange={(value) => updateAssumptions({
                    retirementMitigation: {
                      ...retirementMitigation,
                      cashReturn: value,
                    },
                  })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
