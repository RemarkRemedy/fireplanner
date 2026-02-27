import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import type { MonteCarloMethod, WithdrawalStrategyType } from '@/lib/types'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { WithdrawalBasisToggle } from '@/components/shared/WithdrawalBasisToggle'
import { getStrategyLabel } from '@/hooks/useWithdrawalComparison'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { trackEvent } from '@/lib/analytics'

const MC_METHODS: { value: MonteCarloMethod; label: string }[] = [
  { value: 'parametric', label: 'Parametric (Cholesky)' },
  { value: 'bootstrap', label: 'Historical Bootstrap' },
  { value: 'fat_tail', label: 'Fat-Tail (Student-t df=5)' },
]

const SIMPLE_STRATEGIES: WithdrawalStrategyType[] = [
  'constant_dollar', 'vpw', 'guardrails', 'vanguard_dynamic', 'cape_based', 'floor_ceiling',
]

const ALL_STRATEGIES: WithdrawalStrategyType[] = [
  'constant_dollar', 'vpw', 'guardrails', 'vanguard_dynamic', 'cape_based', 'floor_ceiling',
  'percent_of_portfolio', 'one_over_n', 'sensible_withdrawals', 'ninety_five_percent',
  'endowment', 'hebeler_autopilot',
]

interface SimulationControlsProps {
  onRun: () => void
  isPending: boolean
  canRun: boolean
  validationErrors: Record<string, string>
}

export function SimulationControls({ onRun, isPending, canRun, validationErrors }: SimulationControlsProps) {
  const simulation = useSimulationStore()
  const currentAge = useProfileStore((s) => s.currentAge)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const mode = useEffectiveMode('section-stress-test')
  const strategies = mode === 'advanced' ? ALL_STRATEGIES : SIMPLE_STRATEGIES

  const [learnMoreOpen, setLearnMoreOpen] = useState(false)

  const errorMessages = Object.values(validationErrors)
  const disabledReason = !canRun
    ? errorMessages[0] ?? 'Fix validation errors to run simulation'
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulation Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Method
              <InfoTooltip text="How returns are generated. Parametric uses normal distribution with correlations. Bootstrap samples from history. Fat-tail uses Student-t for extreme events." />
            </Label>
            <Select
              value={simulation.mcMethod}
              onValueChange={(v) => simulation.setField('mcMethod', v as MonteCarloMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MC_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Withdrawal Strategy
              <InfoTooltip text="How money is withdrawn during retirement. Each strategy handles market volatility differently." />
            </Label>
            <Select
              value={simulation.selectedStrategy}
              onValueChange={(v) => { simulation.setField('selectedStrategy', v as WithdrawalStrategyType); trackEvent('strategy_selected', { strategy: v, context: 'monte-carlo' }) }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s} value={s}>{getStrategyLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Simulations
              <InfoTooltip text="Number of Monte Carlo paths. More = more accurate but slower. 10,000 is standard." />
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={100}
              max={100000}
              step={1000}
              value={simulation.nSimulations}
              onChange={(e) => simulation.setField('nSimulations', Number(e.target.value))}
            />
          </div>

          {/* Pre-retirement returns toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium shrink-0">
                Pre-retirement returns
              </Label>
              {currentAge >= retirementAge ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex rounded-lg border bg-muted p-0.5 opacity-50 cursor-not-allowed">
                        <button disabled className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground">Expected</button>
                        <button disabled className="rounded-md px-3 py-1.5 text-sm font-medium bg-background text-foreground shadow-sm">Random</button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Not applicable: you are already in retirement</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <div className="inline-flex rounded-lg border bg-muted p-0.5">
                  <button
                    onClick={() => simulation.setField('deterministicAccumulation', true)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      simulation.deterministicAccumulation
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Expected
                  </button>
                  <button
                    onClick={() => simulation.setField('deterministicAccumulation', false)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      !simulation.deterministicAccumulation
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Random
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {simulation.deterministicAccumulation
                ? 'Assumes average market luck until retirement. Every simulation starts decumulation with the same portfolio.'
                : 'Considers both lucky and unlucky markets before retirement. Some simulations arrive with much more, others much less. More realistic, but produces lower success rates.'}
            </p>
            <button
              onClick={() => setLearnMoreOpen(!learnMoreOpen)}
              className="text-xs text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-0.5 mt-0.5"
            >
              <ChevronRight className={cn('h-3 w-3 transition-transform', learnMoreOpen && 'rotate-90')} />
              {learnMoreOpen ? 'Show less' : 'Learn more'}
            </button>
          </div>
        </div>

        {learnMoreOpen && (
          <div className="text-xs text-muted-foreground space-y-4 rounded-lg border bg-muted/30 p-4">
            {/* Comparison table — full-width, bordered cells */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border bg-muted/50 px-3 py-2 font-medium w-[140px]"></th>
                    <th className="border border-border bg-muted/50 px-3 py-2 font-medium">Expected</th>
                    <th className="border border-border bg-muted/50 px-3 py-2 font-medium">Random</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-3 py-2 font-medium bg-muted/30">How it works</td>
                    <td className="border border-border px-3 py-2">Uses the average (mean) return every year. You are neither lucky nor unlucky. Every simulation arrives at retirement with the same portfolio.</td>
                    <td className="border border-border px-3 py-2">Draws different returns each year per simulation. Some sims hit bull runs, others crash right before retirement. Wide range of starting portfolios.</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2 font-medium bg-muted/30">Question answered</td>
                    <td className="border border-border px-3 py-2">If I hit my savings target, does retirement survive?</td>
                    <td className="border border-border px-3 py-2">What is my real end-to-end probability?</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2 font-medium bg-muted/30">Risk captured</td>
                    <td className="border border-border px-3 py-2">Withdrawal strategy only</td>
                    <td className="border border-border px-3 py-2">All sources (accumulation + decumulation)</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2 font-medium bg-muted/30">Conservative?</td>
                    <td className="border border-border px-3 py-2">Less</td>
                    <td className="border border-border px-3 py-2">More</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Volatility drag + reading results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-border bg-background p-3 space-y-1">
                <p className="font-medium text-foreground">Volatility drag</p>
                <p>
                  Expected mode uses the arithmetic mean return (e.g. 8%), but volatile returns compound lower.
                  A portfolio with 8% mean and 15% volatility actually grows at ~6.9%. So Expected is slightly
                  optimistic. The further from retirement, the more this gap compounds.
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-3 space-y-1">
                <p className="font-medium text-foreground">Reading your results</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>High Expected, low Random:</strong> pre-retirement market risk is your bottleneck.</li>
                  <li><strong>Both similar:</strong> plan is robust regardless of pre-retirement luck.</li>
                  <li><strong>High Random, low Expected:</strong> withdrawal strategy may be too aggressive.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <WithdrawalBasisToggle />
        <StrategyParams />

        <div className="flex items-center gap-3">
          <Button
            onClick={() => { trackEvent('simulation_run', { type: 'monte-carlo', method: simulation.mcMethod, strategy: simulation.selectedStrategy }); onRun() }}
            disabled={!canRun || isPending}
            className="min-w-[160px]"
          >
            {isPending ? 'Running...' : 'Run Simulation'}
          </Button>
          {disabledReason && (
            <span className="text-sm text-muted-foreground">{disabledReason}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StrategyParams() {
  const simulation = useSimulationStore()
  const withdrawalStore = useWithdrawalStore()
  const strategy = simulation.selectedStrategy
  const params = simulation.strategyParams[strategy]
  const withdrawalBasis = simulation.withdrawalBasis
  const [showHint, setShowHint] = useState(false)

  // Only show hint for strategy + field combos where the toggle materially changes behavior.
  // These are strategies whose initial withdrawal amount is set by portfolio × rate:
  //   constant_dollar.swr, guardrails.initialRate, vanguard_dynamic.swr
  // Other strategies (VPW, floor_ceiling, cape_based, etc.) compute withdrawals dynamically
  // from portfolio size, remaining years, or CAPE ratio — the toggle has minimal effect.
  const HINT_TRIGGER: Record<string, Set<string>> = {
    constant_dollar: new Set(['swr']),
    guardrails: new Set(['initialRate']),
    vanguard_dynamic: new Set(['swr']),
  }

  // Grey out rate fields when "My Expenses" is selected (rate is unused)
  const rateDisabled = withdrawalBasis === 'expenses'

  const setParam = (field: string, value: number) => {
    simulation.setStrategyParam(
      strategy,
      field as keyof typeof params,
      value
    )
    // Keep withdrawal store in sync so deterministic comparison uses same params
    withdrawalStore.setStrategyParam(
      strategy,
      field as keyof typeof params,
      value
    )
    const triggers = HINT_TRIGGER[strategy]
    if (withdrawalBasis === 'expenses' && triggers?.has(field)) {
      setShowHint(true)
    }
  }

  return (
    <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {strategy === 'constant_dollar' && (
        <ParamInput label="SWR" value={(params as { swr: number }).swr * 100} onChange={(v) => setParam('swr', v / 100)} suffix="%" step={0.1} disabled={rateDisabled} />
      )}
      {strategy === 'vpw' && (
        <>
          <ParamInput label="Expected Real Return" value={(params as { expectedRealReturn: number }).expectedRealReturn * 100} onChange={(v) => setParam('expectedRealReturn', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="Legacy Buffer" value={(params as { targetEndValue: number }).targetEndValue * 100} onChange={(v) => setParam('targetEndValue', v / 100)} suffix="%" step={1} tooltip="Percentage of portfolio to aim to keep at end of retirement. 0% = spend everything, 10% = leave 10% as safety buffer." />
        </>
      )}
      {strategy === 'guardrails' && (
        <>
          <ParamInput label="Initial Rate" value={(params as { initialRate: number }).initialRate * 100} onChange={(v) => setParam('initialRate', v / 100)} suffix="%" step={0.1} disabled={rateDisabled} />
          <ParamInput label="Ceiling Trigger" value={(params as { ceilingTrigger: number }).ceilingTrigger * 100} onChange={(v) => setParam('ceilingTrigger', v / 100)} suffix="%" step={1} />
          <ParamInput label="Floor Trigger" value={(params as { floorTrigger: number }).floorTrigger * 100} onChange={(v) => setParam('floorTrigger', v / 100)} suffix="%" step={1} />
          <ParamInput label="Adjustment" value={(params as { adjustmentSize: number }).adjustmentSize * 100} onChange={(v) => setParam('adjustmentSize', v / 100)} suffix="%" step={1} />
        </>
      )}
      {strategy === 'vanguard_dynamic' && (
        <>
          <ParamInput label="SWR" value={(params as { swr: number }).swr * 100} onChange={(v) => setParam('swr', v / 100)} suffix="%" step={0.1} disabled={rateDisabled} />
          <ParamInput label="Ceiling" value={(params as { ceiling: number }).ceiling * 100} onChange={(v) => setParam('ceiling', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="Floor" value={(params as { floor: number }).floor * 100} onChange={(v) => setParam('floor', v / 100)} suffix="%" step={0.1} />
        </>
      )}
      {strategy === 'cape_based' && (
        <>
          <ParamInput label="Base Rate" value={(params as { baseRate: number }).baseRate * 100} onChange={(v) => setParam('baseRate', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="CAPE Weight" value={(params as { capeWeight: number }).capeWeight * 100} onChange={(v) => setParam('capeWeight', v / 100)} suffix="%" step={1} />
          <ParamInput label="Current CAPE" value={(params as { currentCape: number }).currentCape} onChange={(v) => setParam('currentCape', v)} step={1} />
        </>
      )}
      {strategy === 'floor_ceiling' && (
        <>
          <ParamInput label="Floor" value={(params as { floor: number }).floor} onChange={(v) => setParam('floor', v)} prefix="$" step={1000} />
          <ParamInput label="Ceiling" value={(params as { ceiling: number }).ceiling} onChange={(v) => setParam('ceiling', v)} prefix="$" step={1000} />
          <ParamInput label="Target Rate" value={(params as { targetRate: number }).targetRate * 100} onChange={(v) => setParam('targetRate', v / 100)} suffix="%" step={0.1} />
        </>
      )}
      {strategy === 'percent_of_portfolio' && (
        <ParamInput label="Withdrawal Rate" value={(params as { rate: number }).rate * 100} onChange={(v) => setParam('rate', v / 100)} suffix="%" step={0.1} />
      )}
      {strategy === 'sensible_withdrawals' && (
        <>
          <ParamInput label="Base Rate" value={(params as { baseRate: number }).baseRate * 100} onChange={(v) => setParam('baseRate', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="Extras Rate" value={(params as { extrasRate: number }).extrasRate * 100} onChange={(v) => setParam('extrasRate', v / 100)} suffix="%" step={1} tooltip="Percentage of prior-year gains added as a bonus withdrawal." />
        </>
      )}
      {strategy === 'ninety_five_percent' && (
        <ParamInput label="Target Rate" value={(params as { swr: number }).swr * 100} onChange={(v) => setParam('swr', v / 100)} suffix="%" step={0.1} />
      )}
      {strategy === 'endowment' && (
        <>
          <ParamInput label="Target Rate" value={(params as { swr: number }).swr * 100} onChange={(v) => setParam('swr', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="Smoothing Weight" value={(params as { smoothingWeight: number }).smoothingWeight * 100} onChange={(v) => setParam('smoothingWeight', v / 100)} suffix="%" step={5} tooltip="Weight given to prior-year withdrawal vs current portfolio-based amount." />
        </>
      )}
      {strategy === 'hebeler_autopilot' && (
        <ParamInput label="Expected Real Return" value={(params as { expectedRealReturn: number }).expectedRealReturn * 100} onChange={(v) => setParam('expectedRealReturn', v / 100)} suffix="%" step={0.1} />
      )}
    </div>
    {showHint && withdrawalBasis === 'expenses' && (
      <p className="text-xs text-muted-foreground mt-2">
        Switch to{' '}
        <button
          className="underline font-medium"
          onClick={() => {
            simulation.setField('withdrawalBasis', 'rate')
            setShowHint(false)
          }}
        >
          Custom Rate
        </button>{' '}
        to test different withdrawal rates.
        <button
          className="ml-1 text-muted-foreground/60 hover:text-muted-foreground"
          onClick={() => setShowHint(false)}
          aria-label="Dismiss hint"
        >
          ✕
        </button>
      </p>
    )}
    </>
  )
}

function ParamInput({ label, value, onChange, prefix, suffix, step, tooltip, disabled }: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  step?: number
  tooltip?: string
  disabled?: boolean
}) {
  return (
    <div className={cn('space-y-1', disabled && 'opacity-50')}>
      <Label className="text-xs">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </Label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          inputMode="decimal"
          className="h-8 text-sm"
          value={parseFloat(value.toPrecision(12))}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}
