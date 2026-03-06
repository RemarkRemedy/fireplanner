import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useProfileStore } from '@/stores/useProfileStore'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useProjection } from '@/hooks/useProjection'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useAdjustedFireNumber } from '@/hooks/useAdjustedFireNumber'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import type { FireType, FireNumberBasis } from '@/lib/types'

export function FireTargetsSection() {
  const { fireType, swr, fireNumberBasis, inflation, retirementAge, currentAge, liquidNetWorth, setField, validationErrors } = useProfileStore()
  const mode = useEffectiveMode('section-fire-settings')
  const { metrics, hasErrors } = useFireCalculations()
  const { summary: projSummary } = useProjection()
  const { waterfallItems, netAnnualNeed, cpfOaMortgageCoverPct } = useAdjustedFireNumber()

  // Prefer projection's simulated FIRE age over NPER estimate
  const projFireAge = projSummary?.fireAchievedAge ?? null
  const effectiveFireAge = projFireAge ?? (metrics ? metrics.fireAge : null)
  const effectiveYearsToFire = effectiveFireAge !== null ? Math.max(0, effectiveFireAge - currentAge) : null
  const isSimulated = projFireAge !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">FIRE Targets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mode === 'advanced' && (
            <div className="space-y-1">
              <Label className="text-sm flex items-center">
                FIRE Type
                <InfoTooltip text="Regular: full expenses. Lean: 60%. Fat: 150%. Coast: let portfolio grow. Barista: part-time income." />
              </Label>
              <Select
                value={fireType}
                onValueChange={(v) => setField('fireType', v as FireType)}
              >
                <SelectTrigger className="border-blue-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular FIRE</SelectItem>
                  <SelectItem value="lean">Lean FIRE (60%)</SelectItem>
                  <SelectItem value="fat">Fat FIRE (150%)</SelectItem>
                  <SelectItem value="coast">Coast FIRE</SelectItem>
                  <SelectItem value="barista">Barista FIRE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'advanced' && (fireType === 'coast' || fireType === 'barista') && (
            <div className="col-span-1 md:col-span-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-2">
              {fireType === 'coast' ? (
                <>
                  <p className="font-medium text-primary">Coast FIRE</p>
                  <p className="text-muted-foreground">
                    Your portfolio is large enough that compound growth alone will reach your full FIRE number by retirement — even if you never invest another dollar.
                    You still need to earn enough to cover current expenses, but you can stop saving. This frees you to take a lower-paying job, work fewer hours, or take career risks.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formula: FIRE Number / (1 + real return)<sup>years to retirement</sup> &mdash; easier to reach because time does the heavy lifting.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-primary">Barista FIRE</p>
                  <p className="text-muted-foreground">
                    Your portfolio is large enough to partially fund retirement expenses right now. You only need a small part-time income to cover the gap between your investment withdrawals and your living expenses.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formula: max(0, Expenses &minus; Portfolio &times; SWR) &mdash; harder to reach than Coast FIRE because you're already withdrawing, which exposes you to sequence-of-returns risk.
                  </p>
                </>
              )}
            </div>
          )}

          <div>
            <PercentInput
              label="Safe Withdrawal Rate (SWR)"
              value={swr}
              onChange={(v) => setField('swr', v)}
              error={validationErrors.swr}
              tooltip="The percentage of your portfolio you withdraw annually in retirement. 4% is the classic rule."
              step={0.1}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This rate determines your FIRE Number — lower SWR = larger target.{' '}
              <Link to="/reference#swr" className="underline text-primary">Learn more</Link>
            </p>
          </div>

        </div>

        {/* Computed Metrics */}
        {hasErrors ? (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            Fix input errors above to see FIRE calculations.
          </div>
        ) : metrics ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Progress to FIRE</span>
                <span className="font-semibold">{formatPercent(Math.min(metrics.progress, 1))}</span>
              </div>
              <Progress value={Math.min(metrics.progress * 100, 100)} />
            </div>

            {/* Headline metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-1 p-3 rounded-md bg-muted/50">
                <div className="text-xs text-muted-foreground flex items-center">
                  FIRE Number
                  <InfoTooltip text={
                    fireType === 'lean'
                      ? 'Lean FIRE: 60% of annual expenses / SWR'
                      : fireType === 'fat'
                        ? 'Fat FIRE: 150% of annual expenses / SWR'
                        : 'Annual expenses / SWR'
                  } />
                </div>
                <div className="text-lg font-semibold mt-0.5">{formatCurrency(metrics.fireNumber)}</div>
                {fireType === 'lean' && (
                  <div className="text-xs text-muted-foreground">60% of expenses</div>
                )}
                {fireType === 'fat' && (
                  <div className="text-xs text-muted-foreground">150% of expenses</div>
                )}
                {/* Waterfall breakdown */}
                {waterfallItems.length > 1 && netAnnualNeed !== null ? (
                  <Accordion type="single" collapsible className="mt-1">
                    <AccordionItem value="breakdown" className="border-0">
                      <AccordionTrigger className="py-1 text-[10px] text-muted-foreground font-normal hover:no-underline">
                        Net annual need {formatCurrency(netAnnualNeed)}/yr at {(swr * 100).toFixed(1)}% SWR
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <WaterfallBreakdown
                          items={waterfallItems}
                          netAnnualNeed={netAnnualNeed}
                          swr={swr}
                          fireNumber={metrics.fireNumber}
                          fireType={fireType}
                          cpfOaMortgageCoverPct={cpfOaMortgageCoverPct}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : waterfallItems.length === 1 && netAnnualNeed !== null ? (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatCurrency(netAnnualNeed)} / {(swr * 100).toFixed(1)}% SWR
                  </div>
                ) : null}
                {/* Basis toggle */}
                <div role="radiogroup" aria-label="FIRE number dollar basis" className="flex items-center gap-0.5 mt-1.5 rounded-md bg-background border p-0.5">
                  {([
                    { value: 'today', label: "Today's $" },
                    { value: 'fireAge', label: 'FIRE Age' },
                    { value: 'retirement', label: 'Retirement' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      role="radio"
                      aria-checked={fireNumberBasis === opt.value}
                      onClick={() => setField('fireNumberBasis', opt.value as FireNumberBasis)}
                      className={`px-1.5 py-0.5 rounded text-[10px] transition-colors flex-1 ${
                        fireNumberBasis === opt.value
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {fireNumberBasis === 'retirement' && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Adjusted to age {retirementAge} at {(inflation * 100).toFixed(1)}%
                  </div>
                )}
                {fireNumberBasis === 'fireAge' && effectiveFireAge !== null && isFinite(effectiveFireAge) && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Adjusted to age {Math.ceil(effectiveFireAge)} at {(inflation * 100).toFixed(1)}%
                  </div>
                )}
              </div>
              <MetricCard
                label="Years to FIRE"
                value={
                  effectiveYearsToFire !== null && effectiveYearsToFire === 0
                    ? 'Achieved!'
                    : effectiveYearsToFire !== null && isFinite(effectiveYearsToFire)
                      ? Math.ceil(effectiveYearsToFire).toString()
                      : isFinite(metrics.yearsToFire)
                        ? Math.ceil(metrics.yearsToFire).toString()
                        : 'N/A'
                }
                subtitle={isSimulated ? 'simulated' : 'estimate'}
                tooltip={isSimulated
                  ? "Year-by-year projection with income growth, CPF, and tax"
                  : "NPER formula using constant savings and net real return"
                }
              />
              <MetricCard
                label="FIRE Age"
                value={
                  effectiveFireAge !== null && isFinite(effectiveFireAge)
                    ? Math.ceil(effectiveFireAge).toString()
                    : isFinite(metrics.fireAge)
                      ? Math.ceil(metrics.fireAge).toString()
                      : 'N/A'
                }
                subtitle={isSimulated ? 'simulated' : 'estimate'}
              />
              <MetricCard
                label="Savings Rate"
                value={formatPercent(metrics.savingsRate)}
                tooltip="Annual savings / annual income"
              />
              <MetricCard
                label="Coast FIRE"
                value={formatCurrency(metrics.coastFireNumber)}
                tooltip="Amount needed today for compound growth to reach FIRE number by retirement"
              />
              <MetricCard
                label="Barista FIRE Income"
                value={formatCurrency(metrics.baristaFireIncome) + '/yr'}
                tooltip="Part-time income needed if you stop saving but portfolio covers partial expenses"
              />
            </div>

            {/* CPF Dependency Warning */}
            {metrics.cpfDependency && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  FIRE depends on CPF — liquid portfolio covers {formatPercent(metrics.fireNumber > 0 ? liquidNetWorth / metrics.fireNumber : 0)} of target
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  CPF funds are not freely accessible before 55 and are subject to withdrawal limits. Your liquid portfolio alone does not meet your FIRE number.
                </p>
                {metrics.liquidBridgeGapYears !== null && metrics.liquidBridgeGapYears > 0 && metrics.liquidDepletionAge !== null && (
                  <p className="text-amber-700 dark:text-amber-300">
                    Liquid portfolio may deplete at age {metrics.liquidDepletionAge}, which is {metrics.liquidBridgeGapYears} years before CPF LIFE starts. Consider building a larger liquid buffer.
                  </p>
                )}
              </div>
            )}

            {/* FIRE Age > Retirement Age Warning */}
            {effectiveFireAge !== null && isFinite(effectiveFireAge) && effectiveFireAge > retirementAge && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  FIRE age ({Math.ceil(effectiveFireAge)}) is after retirement age ({retirementAge})
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  You may not have enough saved when you retire. Consider reducing retirement spending, increasing savings, or adjusting your retirement age.
                </p>
              </div>
            )}

            {/* Lean / Fat reference badges — hide the one matching current fireType */}
            <div className="flex gap-2 flex-wrap">
              {fireType !== 'lean' && (
                <Badge variant="secondary">
                  Lean FIRE: {formatCurrency(metrics.leanFireNumber)}
                </Badge>
              )}
              {fireType !== 'fat' && (
                <Badge variant="secondary">
                  Fat FIRE: {formatCurrency(metrics.fatFireNumber)}
                </Badge>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  subtitle,
  tooltip,
}: {
  label: string
  value: string
  subtitle?: string
  tooltip?: string
}) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="text-xs text-muted-foreground flex items-center">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      )}
    </div>
  )
}

function WaterfallBreakdown({
  items,
  netAnnualNeed,
  swr,
  fireNumber,
  fireType,
  cpfOaMortgageCoverPct,
}: {
  items: { label: string; amount: number; type: 'add' | 'subtract' }[]
  netAnnualNeed: number
  swr: number
  fireNumber: number
  fireType: FireType
  cpfOaMortgageCoverPct: number | null
}) {
  const maxAmount = Math.max(...items.map((i) => i.amount))
  const isCoastOrBarista = fireType === 'coast' || fireType === 'barista'

  return (
    <div className="text-[10px] text-muted-foreground space-y-0.5">
      {items.map((item, i) => {
        const barPct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0
        const isSubtract = item.type === 'subtract'
        return (
          <div key={item.label} className="flex items-center gap-1">
            <span className={`w-2.5 text-right shrink-0 ${isSubtract ? 'text-green-600' : ''}`}>
              {i === 0 ? '' : isSubtract ? '−' : '+'}
            </span>
            <span className={`w-24 truncate ${isSubtract ? 'text-green-600' : ''}`}>
              {item.label}
            </span>
            <span className={`w-16 text-right tabular-nums shrink-0 ${isSubtract ? 'text-green-600' : ''}`}>
              {isSubtract ? '−' : ''}{formatCurrency(item.amount)}
            </span>
            <div className="flex-1 h-2 rounded-sm overflow-hidden bg-muted">
              <div
                className={`h-full rounded-sm ${isSubtract ? 'bg-green-400' : 'bg-primary/40'}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-1 border-t border-border/50 pt-0.5 font-medium">
        <span className="w-2.5 shrink-0" />
        <span className="w-24">Net annual need</span>
        <span className="w-16 text-right tabular-nums shrink-0">{formatCurrency(netAnnualNeed)}</span>
      </div>
      {!isCoastOrBarista && (
        <div className="flex items-center gap-1 font-medium">
          <span className="w-2.5 shrink-0" />
          <span className="w-24">÷ {(swr * 100).toFixed(1)}% SWR</span>
          <span className="w-16 text-right tabular-nums shrink-0">{formatCurrency(fireNumber)}</span>
        </div>
      )}
      {cpfOaMortgageCoverPct !== null && (
        <div className="mt-1 px-1.5 py-1 rounded bg-muted/50 text-[10px] text-muted-foreground">
          CPF OA covers {Math.round(cpfOaMortgageCoverPct * 100)}% of your mortgage.
          Only the cash portion ({Math.round((1 - cpfOaMortgageCoverPct) * 100)}%) affects your FIRE number.
        </div>
      )}
    </div>
  )
}
