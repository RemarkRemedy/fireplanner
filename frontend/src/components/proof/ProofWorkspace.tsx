import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProjection } from '@/hooks/useProjection'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { percentile } from '@/lib/math/stats'
import {
  buildProofCsv,
  buildProofCyclesFromHistoricalBlended,
  buildProofCyclesFromMonteCarlo,
  getSgProxyDiagnostics,
} from '@/lib/simulation/proofData'
import type { MonteCarloResult, ProofCycle, ProofSource } from '@/lib/types'
import { ProofControls } from './ProofControls'
import { ProofChart } from './ProofChart'
import { ProofSummary } from './ProofSummary'
import { ProofDrilldown } from './ProofDrilldown'
import { ProofComparePanel } from './ProofComparePanel'
import { ProofCheatSheetDialog } from './ProofCheatSheetDialog'

interface ProofWorkspaceProps {
  mcResult: MonteCarloResult | undefined
  isMcResultStale: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toCompareSnapshot(cycles: ProofCycle[], source: ProofSource) {
  if (cycles.length === 0) return null

  const ending = cycles.map((c) => c.endingPortfolio)
  const spending = cycles.map((c) => c.meanSpending)
  const taxes = cycles.map((c) => c.rows.reduce((sum, row) => sum + row.sgTax, 0))

  return {
    source,
    successRate: cycles.filter((c) => c.endingPortfolio > 0).length / cycles.length,
    medianEndingPortfolio: percentile(ending, 50),
    medianSpending: percentile(spending, 50),
    medianTax: percentile(taxes, 50),
  }
}

export function ProofWorkspace({ mcResult, isMcResultStale }: ProofWorkspaceProps) {
  const { params: projectionParams } = useProjection()
  const analysisPortfolio = useAnalysisPortfolio()

  const {
    proofSource,
    proofMetricType,
    proofChartType,
    proofShowOutliers,
    proofBlendRatio,
    proofSelectedCycle,
    proofSelectedYear,
    setField,
  } = useSimulationStore()

  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false)
  const [cachedMcCycles, setCachedMcCycles] = useState<ProofCycle[] | null>(null)

  const cycles = useMemo(() => {
    if (!projectionParams) return []

    if (proofSource === 'mc') {
      if (mcResult && !isMcResultStale) {
        return buildProofCyclesFromMonteCarlo(mcResult, projectionParams)
      }
      return cachedMcCycles ?? []
    }

    return buildProofCyclesFromHistoricalBlended(
      projectionParams,
      analysisPortfolio.allocationWeights,
      proofBlendRatio,
    )
  }, [projectionParams, proofSource, mcResult, isMcResultStale, cachedMcCycles, analysisPortfolio.allocationWeights, proofBlendRatio])

  const isUsingMcHandoff = proofSource === 'mc' && (!mcResult || isMcResultStale) && cycles.length > 0

  const safeCycleIndex = clamp(proofSelectedCycle, 0, Math.max(0, cycles.length - 1))
  const safeYearIndex = clamp(
    proofSelectedYear,
    0,
    Math.max(0, (cycles[safeCycleIndex]?.rows.length ?? 1) - 1),
  )

  useEffect(() => {
    if (proofSelectedCycle !== safeCycleIndex) setField('proofSelectedCycle', safeCycleIndex)
  }, [proofSelectedCycle, safeCycleIndex, setField])

  useEffect(() => {
    if (proofSelectedYear !== safeYearIndex) setField('proofSelectedYear', safeYearIndex)
  }, [proofSelectedYear, safeYearIndex, setField])

  const compareSnapshot = useMemo(() => toCompareSnapshot(cycles, proofSource), [cycles, proofSource])
  const proxyDiagnostics = useMemo(() => (
    proofSource === 'historical_blended' ? getSgProxyDiagnostics() : null
  ), [proofSource])

  const exportCsv = () => {
    if (cycles.length === 0) return
    const csv = buildProofCsv(cycles, proofSource)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `proof-${proofSource}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (!projectionParams) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Fix projection inputs first to use Proof.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <ProofControls
        source={proofSource}
        metricType={proofMetricType}
        chartType={proofChartType}
        blendRatio={proofBlendRatio}
        proxyDiagnostics={proxyDiagnostics}
        onSourceChange={(value) => {
          setField('proofSource', value)
          if (value !== 'mc') setCachedMcCycles(null)
        }}
        onMetricTypeChange={(value) => setField('proofMetricType', value)}
        onChartTypeChange={(value) => setField('proofChartType', value)}
        onBlendRatioChange={(value) => setField('proofBlendRatio', value)}
      />

      <div className="rounded-md border bg-purple-100/50 p-3 text-sm flex flex-wrap items-center gap-2 justify-between">
        <div>
          <span className="font-medium">Note:</span> All values on this page are in "Today&apos;s Dollars".
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCheatSheetOpen(true)}>
          How to read Proof
        </Button>
      </div>

      {isUsingMcHandoff && (
        <div className="rounded-md border bg-blue-50 p-3 text-sm text-blue-900">
          Viewing cached MC snapshot loaded from Compare.
        </div>
      )}

      {proofSource === 'mc' && (!mcResult || isMcResultStale) && !isUsingMcHandoff ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {mcResult && isMcResultStale
              ? 'Monte Carlo results are stale — inputs have changed. Re-run MC to refresh Proof cycles.'
              : 'Run Monte Carlo first to view MC Proof cycles.'}
          </CardContent>
        </Card>
      ) : cycles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No cycles available for this source.
          </CardContent>
        </Card>
      ) : (
        <>
          <ProofChart
            cycles={cycles}
            metricType={proofMetricType}
            chartType={proofChartType}
            showOutliers={proofShowOutliers}
            selectedCycleIndex={safeCycleIndex}
            onSelectedCycleChange={(index) => setField('proofSelectedCycle', index)}
          />

          <ProofSummary cycles={cycles} />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button
              onClick={() => setDrilldownOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white"
            >
              Analyze Year-by-year data
            </Button>
          </div>

          <ProofComparePanel
            currentSnapshot={compareSnapshot}
            source={proofSource}
            blendRatio={proofBlendRatio}
            onOpenMcSnapshot={setCachedMcCycles}
          />

          <ProofDrilldown
            open={drilldownOpen}
            onOpenChange={setDrilldownOpen}
            cycles={cycles}
            selectedCycleIndex={safeCycleIndex}
            selectedYearIndex={safeYearIndex}
            onSelectedCycleChange={(index) => setField('proofSelectedCycle', index)}
            onSelectedYearChange={(index) => setField('proofSelectedYear', index)}
          />
        </>
      )}

      <ProofCheatSheetDialog open={cheatSheetOpen} onOpenChange={setCheatSheetOpen} />
    </div>
  )
}
