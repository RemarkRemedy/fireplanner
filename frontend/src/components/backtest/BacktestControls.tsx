import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { WithdrawalBasisToggle } from '@/components/shared/WithdrawalBasisToggle'
import type { BacktestDataset, HeatmapConfig, WithdrawalStrategyType } from '@/lib/types'
import { getStrategyLabel } from '@/hooks/useWithdrawalComparison'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { trackEvent } from '@/lib/analytics'

const ALL_STRATEGIES: WithdrawalStrategyType[] = [
  'constant_dollar', 'vpw', 'guardrails', 'vanguard_dynamic', 'cape_based', 'floor_ceiling',
  'percent_of_portfolio', 'one_over_n', 'sensible_withdrawals', 'ninety_five_percent',
  'endowment', 'hebeler_autopilot',
]

/** Strategies where the backtest's SWR field sets the initial withdrawal amount */
const SWR_STRATEGIES = new Set<WithdrawalStrategyType>(['constant_dollar', 'vanguard_dynamic'])

interface BacktestConfig {
  swr: number
  retirementDuration: number
  dataset: BacktestDataset
  blendRatio: number
  withdrawalStrategy: WithdrawalStrategyType
  heatmapConfig: HeatmapConfig
}

interface BacktestControlsProps {
  config: BacktestConfig
  setConfig: (update: Partial<BacktestConfig>) => void
  isPending: boolean
  canRun: boolean
  validationErrors: Record<string, string>
  onRunHeatmap: () => void
  isHeatmapPending: boolean
  heatmapStale: boolean
}

export function BacktestControls({ config, setConfig, isPending, canRun, validationErrors, onRunHeatmap, isHeatmapPending, heatmapStale }: BacktestControlsProps) {
  const errorMessages = Object.values(validationErrors)
  const disabledReason = !canRun
    ? errorMessages[0] ?? 'Fix validation errors to run backtest'
    : undefined

  const showSwr = SWR_STRATEGIES.has(config.withdrawalStrategy)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Backtest Parameters
          {isPending && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2 md:col-span-2 lg:col-span-2">
            <Label>
              Withdrawal Strategy
              <InfoTooltip text="How money is withdrawn during retirement. Each strategy handles market volatility differently. Constant Dollar is the classic 4% rule." />
            </Label>
            <Select
              value={config.withdrawalStrategy}
              onValueChange={(v) => { setConfig({ withdrawalStrategy: v as WithdrawalStrategyType }); trackEvent('strategy_selected', { strategy: v, context: 'backtest' }) }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STRATEGIES.map((s) => (
                  <SelectItem key={s} value={s}>{getStrategyLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Dataset
              <InfoTooltip text="US market (S&P 500) returns. Singapore market (STI). Blended mixes both with adjustable weighting." />
            </Label>
            <Select
              value={config.dataset}
              onValueChange={(v) => setConfig({ dataset: v as BacktestDataset })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us_only">US Only</SelectItem>
                <SelectItem value="sg_only">SG Only</SelectItem>
                <SelectItem value="blended">Blended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.dataset === 'blended' && (
            <div className="space-y-2">
              <Label>
                US Weight
                <InfoTooltip text="Percentage of US returns in the blend. Remainder uses SG returns." />
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={5}
                value={Math.round(config.blendRatio * 100)}
                onChange={(e) => setConfig({ blendRatio: Number(e.target.value) / 100 })}
              />
            </div>
          )}

          {showSwr && (
            <div className="space-y-2">
              <Label>
                Withdrawal Rate
                <InfoTooltip text="Safe Withdrawal Rate (SWR) — the percentage of your portfolio withdrawn in year 1. 4% is the classic starting point." />
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                max={10}
                step={0.25}
                value={(config.swr * 100).toFixed(2)}
                onChange={(e) => setConfig({ swr: Number(e.target.value) / 100 })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Duration (years)
              <InfoTooltip text="Length of retirement to simulate. 30 years is common for early retirees." />
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={10}
              max={60}
              step={5}
              value={config.retirementDuration}
              onChange={(e) => setConfig({ retirementDuration: Number(e.target.value) })}
            />
          </div>
        </div>

        <StrategyParams strategy={config.withdrawalStrategy} />
        <WithdrawalBasisToggle />

        {disabledReason && (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        )}

        {showSwr && <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">SWR x Duration Heatmap</Label>
            <Button
              size="sm"
              onClick={() => { trackEvent('simulation_run', { type: 'backtest-heatmap' }); onRunHeatmap() }}
              disabled={!canRun || isHeatmapPending}
            >
              {isHeatmapPending ? 'Generating...' : heatmapStale ? 'Regenerate Heatmap' : 'Generate Heatmap'}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <HeatmapField
              label="SWR Min"
              value={config.heatmapConfig.swrMin * 100}
              onChange={(v) => setConfig({ heatmapConfig: { ...config.heatmapConfig, swrMin: v / 100 } })}
              suffix="%"
              step={0.5}
            />
            <HeatmapField
              label="SWR Max"
              value={config.heatmapConfig.swrMax * 100}
              onChange={(v) => setConfig({ heatmapConfig: { ...config.heatmapConfig, swrMax: v / 100 } })}
              suffix="%"
              step={0.5}
            />
            <HeatmapField
              label="SWR Step"
              value={config.heatmapConfig.swrStep * 100}
              onChange={(v) => setConfig({ heatmapConfig: { ...config.heatmapConfig, swrStep: v / 100 } })}
              suffix="%"
              step={0.1}
            />
            <HeatmapField
              label="Duration Min"
              value={config.heatmapConfig.durationMin}
              onChange={(v) => setConfig({ heatmapConfig: { ...config.heatmapConfig, durationMin: v } })}
              suffix="yr"
              step={5}
            />
            <HeatmapField
              label="Duration Max"
              value={config.heatmapConfig.durationMax}
              onChange={(v) => setConfig({ heatmapConfig: { ...config.heatmapConfig, durationMax: v } })}
              suffix="yr"
              step={5}
            />
            <HeatmapField
              label="Duration Step"
              value={config.heatmapConfig.durationStep}
              onChange={(v) => setConfig({ heatmapConfig: { ...config.heatmapConfig, durationStep: v } })}
              suffix="yr"
              step={1}
            />
          </div>
        </div>}
      </CardContent>
    </Card>
  )
}

function StrategyParams({ strategy }: { strategy: WithdrawalStrategyType }) {
  const withdrawal = useWithdrawalStore()
  const params = withdrawal.strategyParams[strategy]

  const setParam = (field: string, value: number) => {
    withdrawal.setStrategyParam(strategy, field as keyof typeof params, value)
  }

  // No additional params needed for constant_dollar (SWR field handles it) or one_over_n
  if (strategy === 'constant_dollar' || strategy === 'one_over_n') return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {strategy === 'vpw' && (
        <>
          <ParamInput label="Expected Real Return" value={(params as { expectedRealReturn: number }).expectedRealReturn * 100} onChange={(v) => setParam('expectedRealReturn', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="Legacy Buffer" value={(params as { targetEndValue: number }).targetEndValue * 100} onChange={(v) => setParam('targetEndValue', v / 100)} suffix="%" step={1} tooltip="Percentage of portfolio to aim to keep at end. 0% = spend everything." />
        </>
      )}
      {strategy === 'guardrails' && (
        <>
          <ParamInput label="Initial Rate" value={(params as { initialRate: number }).initialRate * 100} onChange={(v) => setParam('initialRate', v / 100)} suffix="%" step={0.1} />
          <ParamInput label="Ceiling Trigger" value={(params as { ceilingTrigger: number }).ceilingTrigger * 100} onChange={(v) => setParam('ceilingTrigger', v / 100)} suffix="%" step={1} />
          <ParamInput label="Floor Trigger" value={(params as { floorTrigger: number }).floorTrigger * 100} onChange={(v) => setParam('floorTrigger', v / 100)} suffix="%" step={1} />
          <ParamInput label="Adjustment" value={(params as { adjustmentSize: number }).adjustmentSize * 100} onChange={(v) => setParam('adjustmentSize', v / 100)} suffix="%" step={1} />
        </>
      )}
      {strategy === 'vanguard_dynamic' && (
        <>
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
  )
}

function ParamInput({ label, value, onChange, prefix, suffix, step, tooltip }: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  step?: number
  tooltip?: string
}) {
  return (
    <div className="space-y-1">
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
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function HeatmapField({ label, value, onChange, suffix, step }: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix: string
  step: number
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          className="h-7 text-xs"
          value={parseFloat(value.toPrecision(12))}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  )
}
