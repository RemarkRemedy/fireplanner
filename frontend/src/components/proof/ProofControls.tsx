import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatPercent } from '@/lib/utils'
import type { SgProxyDiagnostics } from '@/lib/simulation/proofData'
import type { ProofChartType, ProofMetricType, ProofSource } from '@/lib/types'

interface ProofControlsProps {
  source: ProofSource
  metricType: ProofMetricType
  chartType: ProofChartType
  blendRatio: number
  proxyDiagnostics: SgProxyDiagnostics | null
  onSourceChange: (value: ProofSource) => void
  onMetricTypeChange: (value: ProofMetricType) => void
  onChartTypeChange: (value: ProofChartType) => void
  onBlendRatioChange: (value: number) => void
}

const CHART_TYPE_OPTIONS: Array<{ value: ProofChartType; label: string }> = [
  { value: 'minmaxmean', label: 'Min/Max/Mean' },
  { value: 'time_series', label: 'Time Series' },
  { value: 'individual_cycles', label: 'Individual Cycles' },
  { value: 'spending_vs_returns', label: 'Spending vs Returns' },
]

export function ProofControls({
  source,
  metricType,
  chartType,
  blendRatio,
  proxyDiagnostics,
  onSourceChange,
  onMetricTypeChange,
  onChartTypeChange,
  onBlendRatioChange,
}: ProofControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chart Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => onSourceChange(v as ProofSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mc">Monte Carlo</SelectItem>
                <SelectItem value="historical_blended">Historical Blended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Metric Type</Label>
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={metricType === 'portfolio'}
                  onChange={() => onMetricTypeChange('portfolio')}
                />
                Portfolio
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={metricType === 'spending'}
                  onChange={() => onMetricTypeChange('spending')}
                />
                Spending
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chart Type</Label>
            <Select value={chartType} onValueChange={(v) => onChartTypeChange(v as ProofChartType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        {source === 'historical_blended' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <div className="space-y-2">
              <Label>US Weight (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(blendRatio * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (Number.isFinite(val)) {
                    const clamped = Math.max(0, Math.min(100, val))
                    onBlendRatioChange(clamped / 100)
                  }
                }}
              />
            </div>
            <div className="md:col-span-3 rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p className="text-muted-foreground">
                Missing SG years are proxy-calibrated from US returns. Provenance is shown in tooltip and export.
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Proxy residue (residual):</span> the leftover SG return not explained by the US proxy in overlap years.
              </p>
              {proxyDiagnostics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                  <div>SG proxy formula: <span className="font-medium">SG = α + β·US + ε</span></div>
                  <div>Calibration years: <span className="font-medium">{proxyDiagnostics.overlapYears}</span> (missing SG years: <span className="font-medium">{proxyDiagnostics.missingYears}</span>)</div>
                  <div>α (intercept): <span className="font-medium">{formatPercent(proxyDiagnostics.alpha, 2)}</span></div>
                  <div>β (sensitivity): <span className="font-medium">{proxyDiagnostics.beta.toFixed(2)}</span></div>
                  <div>Residue μ: <span className="font-medium">{formatPercent(proxyDiagnostics.residualMean, 2)}</span></div>
                  <div>Residue σ: <span className="font-medium">{formatPercent(proxyDiagnostics.residualStdDev, 2)}</span></div>
                  <div>P10 residue: <span className="font-medium">{formatPercent(proxyDiagnostics.residualP10, 2)}</span></div>
                  <div>P90 residue: <span className="font-medium">{formatPercent(proxyDiagnostics.residualP90, 2)}</span></div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
