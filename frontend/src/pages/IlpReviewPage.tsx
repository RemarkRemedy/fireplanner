import { useMemo, useState } from 'react'
import { AlertTriangle, FolderOpen, Plus, Receipt } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductPickerDialog } from '@/components/ilp/catalog/ProductPickerDialog'
import { PolicySetupGate } from '@/components/ilp/PolicySetupGate'
import { ComparisonTable } from '@/components/ilp/ComparisonTable'
import { DecisionPanel } from '@/components/ilp/DecisionPanel'
import { FeeWaterfallChart } from '@/components/ilp/FeeWaterfallChart'
import { NpvTimelineChart } from '@/components/ilp/NpvTimelineChart'
import { OpportunityCostCard } from '@/components/ilp/OpportunityCostCard'
import { PolicyInputForm } from '@/components/ilp/PolicyInputForm'
import { PolicyTabs } from '@/components/ilp/PolicyTabs'
import { ProjectionTable } from '@/components/ilp/ProjectionTable'
import { SummaryCards } from '@/components/ilp/SummaryCards'
import { formatIlpCurrency } from '@/components/ilp/formatters'
import { ReceiptPreviewModal } from '@/components/ilp/receipt/ReceiptPreviewModal'
import { usePageMeta } from '@/hooks/usePageMeta'
import type {
  IlpPolicyAnalysis,
  IlpPolicyInput,
  IlpProjectedPolicyAnalysis,
} from '@/lib/calculations/ilp'
import { analyzeAllPolicies, isProjectedAnalysisEligible } from '@/lib/calculations/ilp'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { ilpPolicySchema } from '@/lib/validation/ilpSchema'
import { useIlpStore } from '@/stores/useIlpStore'

function issueMessagesFromPolicy(policy: unknown): string[] {
  const parsed = ilpPolicySchema.safeParse(policy)
  if (parsed.success) return []
  return parsed.error.issues.map((issue) => issue.message)
}

function estimateCurrentInputSignalCount(policy: IlpPolicyInput | null): number {
  if (policy == null) {
    return 0
  }

  const warningSignals = (policy.catalogWarnings ?? []).filter((warning) => {
    const normalized = warning.toLowerCase()
    return normalized.includes('manual')
      || normalized.includes('current ')
      || normalized.includes('remaining ')
      || normalized.includes('amount owing')
  }).length

  return warningSignals
}

type CompactMetricTone = 'default' | 'warning' | 'destructive'

interface CompactMetricItem {
  label: string
  value: string
  detail: string
  tone?: CompactMetricTone
}

function buildCurrentValueMetric({
  label,
  currency,
  fallbackValue,
  detail,
  tone = 'default',
}: {
  label: string
  currency: IlpPolicyInput['currency']
  fallbackValue: number | undefined
  detail: string
  tone?: CompactMetricTone
}): CompactMetricItem | null {
  if (fallbackValue != null) {
    return {
      label,
      value: formatIlpCurrency(fallbackValue, currency),
      detail,
      tone,
    }
  }

  return null
}

function buildCurrentMetricValue({
  label,
  currency,
  fallbackValue,
  detail,
}: {
  label: string
  currency: IlpPolicyInput['currency']
  fallbackValue: number | undefined
  detail: string
}): CompactMetricItem | null {
  if (fallbackValue != null) {
    return {
      label,
      value: formatIlpCurrency(fallbackValue, currency),
      detail,
      tone: 'default',
    }
  }

  return null
}

function buildCompactSnapshotMetrics(policy: IlpPolicyInput, analysis: IlpPolicyAnalysis): CompactMetricItem[] {
  const { summary } = analysis
  const metrics: CompactMetricItem[] = []

  const surrenderMetric = buildCurrentValueMetric({
    label: 'Surrender Value Today',
    currency: policy.currency,
    fallbackValue: summary.currentSurrenderValue,
    detail: 'Current balances minus exit charge today.',
  })

  if (surrenderMetric) metrics.push(surrenderMetric)

  const penaltyMetric = buildCurrentValueMetric({
    label: 'Cancel-Now Penalty',
    currency: policy.currency,
    fallbackValue: summary.cancelNowPenalty,
    detail: 'Early exit charge on EEC-subject accounts.',
    tone: 'destructive',
  })

  if (penaltyMetric) metrics.push(penaltyMetric)

  const optionalMetrics = [
    buildCurrentMetricValue({
      label: 'Death Benefit Today',
      currency: policy.currency,
      fallbackValue: summary.currentDeathBenefitEstimate,
      detail: 'Current supported death-benefit estimate.',
    }),
    buildCurrentMetricValue({
      label: 'TI Benefit Today',
      currency: policy.currency,
      fallbackValue: summary.currentTiBenefitEstimate,
      detail: 'Current supported terminal-illness estimate.',
    }),
    buildCurrentMetricValue({
      label: 'TPD Benefit Today',
      currency: policy.currency,
      fallbackValue: summary.currentTpdBenefitEstimate,
      detail: 'Current supported TPD estimate.',
    }),
    buildCurrentMetricValue({
      label: 'Death Benefit After TI Claim Today',
      currency: policy.currency,
      fallbackValue: summary.currentResidualDeathBenefitAfterTiEstimate,
      detail: 'Residual death cover if a TI claim were admitted today.',
    }),
  ].filter((metric): metric is CompactMetricItem => metric != null)

  return [...metrics, ...optionalMetrics].slice(0, 4)
}

function ReviewWorkspaceOverview({
  selectedPolicy,
  policyCount,
}: {
  selectedPolicy: IlpPolicyInput | null
  policyCount: number
}) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Selected Policy Workspace</h2>
              {selectedPolicy && <Badge variant="outline">{selectedPolicy.name}</Badge>}
              <Badge variant="secondary">{policyCount} {policyCount === 1 ? 'policy' : 'policies'} loaded</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Use this page as the advanced working bench: complete the form first, keep today&apos;s snapshot beside you, then move into comparison and deeper review below once the current state is coherent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="#policy-configuration">Policy configuration</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#current-snapshot">Current snapshot</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#comparison-analysis">Compare</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#advanced-review">Advanced review</a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CurrentSnapshotRail({
  selectedPolicy,
  displayPolicy,
  displayAnalysis,
  selectedProjectedAnalysis,
  selectedCurrentOnlyAnalysis,
  manualRequirementCount,
}: {
  selectedPolicy: IlpPolicyInput | null
  displayPolicy: IlpPolicyInput | null
  displayAnalysis: IlpPolicyAnalysis | null
  selectedProjectedAnalysis: IlpPolicyAnalysis | null
  selectedCurrentOnlyAnalysis: IlpPolicyAnalysis | null
  manualRequirementCount: number
}) {
  if (selectedPolicy == null) {
    return null
  }

  const informationalResidualCount = (selectedPolicy.catalogSource?.metadataOnlyBehaviors.length ?? 0)
    + (selectedPolicy.catalogWarnings ?? []).filter((warning) => {
      const normalized = warning.toLowerCase()
      return normalized.includes('informational only')
        || normalized.includes('outside this estimate')
        || normalized.includes('outside this snapshot')
    }).length

  const snapshotMetrics = displayPolicy && displayAnalysis
    ? buildCompactSnapshotMetrics(displayPolicy, displayAnalysis)
    : []

  return (
    <div className="space-y-4 xl:sticky xl:top-4">
      <Card id="current-snapshot">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Current Snapshot</h2>
            <p className="text-sm text-muted-foreground">
              Keep today&apos;s key numbers visible while you work through the form. The full summary grid and projection stack stay lower on the page.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap gap-2">
              {selectedPolicy.catalogSource == null ? (
                <Badge variant="secondary">Manual draft</Badge>
              ) : selectedPolicy.catalogSource.supportStatus === 'supported' ? (
                <Badge variant="outline">Seeded template</Badge>
              ) : (
                <Badge variant="secondary">Template needs review</Badge>
              )}
              <Badge variant={manualRequirementCount === 0 ? 'outline' : 'secondary'}>
                {manualRequirementCount === 0
                  ? 'Current inputs complete'
                  : `${manualRequirementCount} current input${manualRequirementCount === 1 ? '' : 's'} left`}
              </Badge>
              <Badge variant={displayAnalysis == null ? 'secondary' : displayAnalysis.mode === 'projected' ? 'outline' : 'secondary'}>
                {displayAnalysis == null
                  ? 'Review paused'
                  : displayAnalysis.mode === 'projected'
                    ? 'Projected review below'
                    : 'Current snapshot only'}
              </Badge>
              {informationalResidualCount > 0 && (
                <Badge variant="secondary">
                  {informationalResidualCount} review note{informationalResidualCount === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {displayAnalysis == null
                ? 'Fix the selected policy before relying on the snapshot or deeper review panels.'
                : manualRequirementCount > 0
                  ? 'Use the working column to fill the remaining current-state fields. The seeded notes already describe the support boundary, so this rail only tracks what is still blocking a trustworthy current snapshot.'
                  : displayAnalysis.mode === 'current-only'
                    ? 'Today&apos;s state is coherent, but this policy intentionally stops at current-state review.'
                    : 'Today&apos;s state is coherent, so you can use the compact snapshot here and the deeper projected review below.'}
            </p>
            {manualRequirementCount > 0 && (
              <Button asChild className="mt-3" size="sm" variant="outline">
                <a href="#policy-configuration">Finish current inputs</a>
              </Button>
            )}
          </div>

          {selectedProjectedAnalysis == null && selectedCurrentOnlyAnalysis == null && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Showing another policy&apos;s output temporarily</AlertTitle>
              <AlertDescription>
                The selected policy is invalid right now, so this rail is using the nearest valid policy output until the form is fixed.
              </AlertDescription>
            </Alert>
          )}

          {displayAnalysis == null || displayPolicy == null ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Fix this policy to unlock review</AlertTitle>
              <AlertDescription>
                {issueMessagesFromPolicy(selectedPolicy)[0] ?? 'This policy has validation issues that block analysis right now.'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Key current metrics</h3>
                <p className="text-xs text-muted-foreground">
                  This rail stays compact on purpose. Use the advanced review section for the full summary grid and projected analysis.
                </p>
              </div>
              <div className="space-y-2">
                {snapshotMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border px-3 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{metric.label}</p>
                        <p className="text-xs text-muted-foreground">{metric.detail}</p>
                      </div>
                      <p className={
                        metric.tone === 'destructive'
                          ? 'text-right text-sm font-semibold text-destructive'
                          : metric.tone === 'warning'
                            ? 'text-right text-sm font-semibold text-amber-700'
                            : 'text-right text-sm font-semibold'
                      }>
                        {metric.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function IlpReviewPage() {
  usePageMeta({
    title: 'ILP Review — SG FIRE Planner',
    description: 'Compare ILP fee drag, surrender penalties, and exit options across multiple policies in one place.',
    path: '/ilp-review',
  })

  const policies = useIlpStore((state) => state.policies)
  const selectedPolicyId = useIlpStore((state) => state.selectedPolicyId)
  const addPolicy = useIlpStore((state) => state.addPolicy)
  const addPolicyFromSeed = useIlpStore((state) => state.addPolicyFromSeed)
  const replacePolicyFromSeed = useIlpStore((state) => state.replacePolicyFromSeed)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingSeed, setPendingSeed] = useState<IlpPolicySeed | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  function handleCatalogPick(product: ReturnType<typeof getIlpCatalog>['products'][number], variant: ReturnType<typeof getIlpCatalog>['products'][number]['variants'][number]) {
    const seed = templateVariantToPolicySeed(product, variant, getIlpCatalog().manifest)
    setPickerOpen(false)
    setCatalogError(null)
    setPendingSeed(seed)
  }

  function handleSetupConfirm(adjustedSeed: IlpPolicySeed) {
    const result = selectedPolicyId
      ? replacePolicyFromSeed(selectedPolicyId, adjustedSeed)
      : addPolicyFromSeed(adjustedSeed)
    if (!result.success) {
      setCatalogError(result.errors[0] ?? 'Unable to seed policy from the selected catalog template.')
      return
    }
    setCatalogError(null)
    setPendingSeed(null)
  }

  const policyEntries = useMemo(() => (
    policies.map((policy) => {
      const parsed = ilpPolicySchema.safeParse(policy)
      return {
        policy: parsed.success ? parsed.data : policy,
        issues: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
        valid: parsed.success,
        projectedEligible: parsed.success && isProjectedAnalysisEligible(parsed.data),
      }
    })
  ), [policies])

  const analysisResult = useMemo(() => {
    const analyzablePolicies = policyEntries
      .filter((entry) => entry.valid)
      .map((entry) => entry.policy)

    if (analyzablePolicies.length === 0) {
      return { analysis: null, error: null }
    }

    try {
      return { analysis: analyzeAllPolicies(analyzablePolicies), error: null }
    } catch (error) {
      return {
        analysis: null,
        error: error instanceof Error ? error.message : 'Unable to analyze ILP policies.',
      }
    }
  }, [policyEntries])

  const selectedEntry = policyEntries.find((entry) => entry.policy.id === selectedPolicyId)
    ?? policyEntries[0]
    ?? null
  const selectedPolicy = selectedEntry?.policy ?? null
  const selectedAnalysis = analysisResult.analysis?.policies.find((analysis) => analysis.policyId === selectedPolicy?.id) ?? null
  const selectedProjectedAnalysis = selectedAnalysis?.mode === 'projected' ? selectedAnalysis : null
  const selectedCurrentOnlyAnalysis = selectedAnalysis?.mode === 'current-only' ? selectedAnalysis : null
  const fallbackAnalysis = analysisResult.analysis?.policies[0] ?? null
  const displayAnalysis = selectedProjectedAnalysis ?? selectedCurrentOnlyAnalysis ?? fallbackAnalysis
  const displayPolicy = selectedCurrentOnlyAnalysis != null
    ? selectedPolicy
    : (displayAnalysis
      ? policyEntries.find((entry) => entry.policy.id === displayAnalysis.policyId)?.policy ?? null
      : null)
  const excludedCount = policyEntries.filter((entry) => !entry.valid).length
  const currentOnlyCount = policyEntries.filter((entry) => entry.valid && !entry.projectedEligible).length
  const manualRequirementCount = estimateCurrentInputSignalCount(selectedPolicy)

  const receiptFeeBreakdown = useMemo(() => {
    if (displayAnalysis?.mode !== 'projected' || !displayPolicy) return null
    return buildFeeBreakdown(displayAnalysis.projections.mid, displayPolicy.funds, displayPolicy)
  }, [displayAnalysis, displayPolicy])

  if (policies.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ILP Review</h1>
          <p className="text-sm text-muted-foreground">
            Compare ILP fee drag, surrender penalties, and exit timing without touching your main FIRE planner state.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-4 py-10 text-center">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Start with a policy</h2>
              <p className="text-sm text-muted-foreground">
                Add one ILP, then duplicate it to compare alternate insurers or revised fee schedules side by side.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => setPickerOpen(true)}>
                  <FolderOpen className="h-4 w-4" />
                  Choose Product
                </Button>
                <Button onClick={addPolicy} variant="outline">
                  <Plus className="h-4 w-4" />
                  Add Blank Policy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {pendingSeed && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-lg font-semibold">Confirm your assumptions</h2>
              <p className="text-sm text-muted-foreground">
                Verify or adjust the premium and policy details before adding this product.
              </p>
              <PolicySetupGate
                seed={pendingSeed}
                onConfirm={handleSetupConfirm}
                onCancel={() => setPendingSeed(null)}
              />
            </CardContent>
          </Card>
        )}
        <ProductPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleCatalogPick} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">ILP Review</h1>
            <p className="text-sm text-muted-foreground">
              Model generic ILP fee drag, compare surrender options with NPV analysis, and see the opportunity cost of staying invested inside the policy.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setPickerOpen(true)}>
              <FolderOpen className="h-4 w-4" />
              Choose Product
            </Button>
            <Button variant="outline" onClick={addPolicy}>
              <Plus className="h-4 w-4" />
              Add Blank Policy
            </Button>
          </div>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Support boundary</AlertTitle>
        <AlertDescription>
          Supported catalog templates are gated only within the summary-described economics modeled here. Templates needing review remain useful for structured comparison, but the dashboard should not be read as a statement that every unmodeled catalog note is part of the product scope.
        </AlertDescription>
      </Alert>
      <PolicyTabs />

      <ProductPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleCatalogPick} />

      {pendingSeed && (
        <PolicySetupGate
          seed={pendingSeed}
          onConfirm={handleSetupConfirm}
          onCancel={() => setPendingSeed(null)}
        />
      )}

      {analysisResult.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Analysis paused</AlertTitle>
          <AlertDescription>{analysisResult.error}</AlertDescription>
        </Alert>
      )}

      {excludedCount > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{excludedCount} {excludedCount === 1 ? 'policy' : 'policies'} excluded from analysis</AlertTitle>
          <AlertDescription>
            Invalid policies stay editable below, but analysis surfaces only include policies that currently pass validation.
          </AlertDescription>
        </Alert>
      )}

      {currentOnlyCount > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{currentOnlyCount} {currentOnlyCount === 1 ? 'policy stays' : 'policies stay'} in current-snapshot mode</AlertTitle>
          <AlertDescription>
            Mature finite-MIP policies now stay in comparison rows and summary cards, but projection charts, NPV, and decision panels remain limited to projection-eligible policies.
          </AlertDescription>
        </Alert>
      )}

      {catalogError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Catalog seeding failed</AlertTitle>
          <AlertDescription>{catalogError}</AlertDescription>
        </Alert>
      )}

      <ReviewWorkspaceOverview
        selectedPolicy={selectedPolicy}
        policyCount={policies.length}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <div className="space-y-3" id="policy-configuration">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Policy Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Keep baseline setup, current-state support inputs, and claim-state support inputs aligned before relying on the review rail.
            </p>
          </div>
          <PolicyInputForm policy={selectedPolicy} issues={selectedEntry?.issues ?? []} />
        </div>

        <CurrentSnapshotRail
          selectedPolicy={selectedPolicy}
          displayPolicy={displayPolicy}
          displayAnalysis={displayAnalysis}
          selectedProjectedAnalysis={selectedProjectedAnalysis}
          selectedCurrentOnlyAnalysis={selectedCurrentOnlyAnalysis}
          manualRequirementCount={manualRequirementCount}
        />
      </section>

      {analysisResult.analysis && (
        <section className="space-y-3" id="comparison-analysis">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Comparison &amp; Analysis Set</h2>
            <p className="text-sm text-muted-foreground">
              Compare the policies that currently pass validation, then drop into the deeper review stack for the selected policy.
            </p>
          </div>
          <ComparisonTable
            analyses={analysisResult.analysis.policies}
            comparison={analysisResult.analysis.comparison}
          />
        </section>
      )}

      {selectedPolicy && displayAnalysis && displayPolicy ? (
        <section className="space-y-4" id="advanced-review">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Advanced Review</h2>
            <p className="text-sm text-muted-foreground">
              Full summary cards, fee breakdowns, NPV, exit analysis, and receipt generation live here once the current state is coherent.
            </p>
          </div>
          <SummaryCards policy={displayPolicy} analysis={displayAnalysis} />
          <a
            href="/blog/ilp-questions?utm_source=dashboard&utm_content=fee_summary"
            className="mt-2 inline-block text-sm text-blue-600 underline decoration-dotted underline-offset-4 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Are these fees worth it? A framework to decide
          </a>
          {displayAnalysis.mode === 'projected' && (
            <>
              {receiptFeeBreakdown && displayAnalysis.summary.totalPremiumsPaid > 0 && displayPolicy.monthsAlreadyPaid === 0 && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setReceiptOpen(true)}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Generate Your ILP Receipt
                  </Button>
                </div>
              )}
              <FeeWaterfallChart policy={displayPolicy} analysis={displayAnalysis} />
              <DecisionPanel policy={displayPolicy} analysis={displayAnalysis} />
              <NpvTimelineChart analyses={analysisResult.analysis?.policies.filter((analysis): analysis is IlpProjectedPolicyAnalysis => analysis.mode === 'projected') ?? []} />
              <ProjectionTable policy={displayPolicy} analysis={displayAnalysis} />
              <OpportunityCostCard policy={displayPolicy} analysis={displayAnalysis} />
            </>
          )}
        </section>
      ) : selectedPolicy ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fix this policy to unlock analysis</AlertTitle>
          <AlertDescription>
            {issueMessagesFromPolicy(selectedPolicy)[0] ?? 'This policy has validation issues that block analysis right now.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {displayPolicy && displayAnalysis?.mode === 'projected' && receiptFeeBreakdown && (
        <ReceiptPreviewModal
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          policy={displayPolicy}
          analysis={displayAnalysis}
          feeBreakdown={receiptFeeBreakdown}
          includeOcf
          defaultUseReal
        />
      )}

      {/* "Still not sure?" footer CTA */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-5 text-center dark:border-amber-900 dark:bg-amber-950/20">
        <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
          ILPs aren&apos;t always a bad deal
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-amber-800 dark:text-amber-300">
          The numbers above show the cost. But cost isn&apos;t the only factor. Discipline, convenience, and your personal situation all matter.
        </p>
        <a
          href="/blog/ilp-questions?utm_source=dashboard&utm_content=footer_card#when-ilp-makes-sense"
          className="mt-3 inline-block rounded-md border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:bg-transparent dark:text-blue-400 dark:hover:bg-blue-950"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read: When an ILP actually makes sense &rarr;
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        This tool is for educational purposes. It models generic ILP fee structures and does not constitute financial advice. Verify all assumptions against your actual policy documents.
      </p>
    </div>
  )
}
