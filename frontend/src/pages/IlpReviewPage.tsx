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
import { ReceiptPreviewModal } from '@/components/ilp/receipt/ReceiptPreviewModal'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
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

function TemplateCatalogSummary() {
  const { products, manifest } = getIlpCatalog()
  const supportedProducts = products.filter((product) => product.supportStatus === 'supported')
  const reviewProducts = products.filter((product) => product.supportStatus === 'partial')

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Available Templates</h2>
            <Badge variant="outline">Catalog {manifest.catalogVersion}</Badge>
            <Badge>{supportedProducts.length} supported</Badge>
            <Badge variant="secondary">{reviewProducts.length} need review</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Supported templates are gated to the summary-described economics modeled here. Templates needing review stay selectable, but the dashboard keeps claims narrow to the slice it can justify today.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Supported templates</div>
            <div className="space-y-2">
              {supportedProducts.map((product) => (
                <div key={product.id} className="rounded-md border px-3 py-2">
                  <div className="font-medium">{product.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.insurer} · {product.variants.length} {product.variants.length === 1 ? 'variant' : 'variants'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Templates Needing Review</div>
            <div className="space-y-2">
              {reviewProducts.map((product) => (
                <div key={product.id} className="rounded-md border px-3 py-2">
                  <div className="font-medium">{product.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.insurer} · {product.variants.length} {product.variants.length === 1 ? 'variant' : 'variants'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
    const result = addPolicyFromSeed(adjustedSeed)
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
                <Button onClick={() => setPickerOpen(true)} variant="outline">
                  <FolderOpen className="h-4 w-4" />
                  Choose Product
                </Button>
                <Button onClick={addPolicy}>
                  <Plus className="h-4 w-4" />
                  Add Policy
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
        {!pendingSeed && <TemplateCatalogSummary />}
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
          <Button variant="outline" onClick={() => setPickerOpen(true)}>
            <FolderOpen className="h-4 w-4" />
            Choose Product
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Support boundary</AlertTitle>
        <AlertDescription>
          Supported catalog templates are gated only within the summary-described economics modeled here. Templates needing review remain useful for structured comparison, but the dashboard should not be read as a statement that every unmodeled catalog note is part of the product scope.
        </AlertDescription>
      </Alert>

      <TemplateCatalogSummary />

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

      <PolicyInputForm policy={selectedPolicy} issues={selectedEntry?.issues ?? []} />

      {analysisResult.analysis && (
        <ComparisonTable
          analyses={analysisResult.analysis.policies}
          comparison={analysisResult.analysis.comparison}
        />
      )}

      {selectedPolicy && displayAnalysis && displayPolicy ? (
        <>
          {selectedProjectedAnalysis == null && selectedCurrentOnlyAnalysis == null && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Showing analysis for another valid policy</AlertTitle>
              <AlertDescription>
                The selected policy is invalid right now, so the analysis panels below are temporarily using {displayPolicy.name}.
              </AlertDescription>
            </Alert>
          )}
          {displayAnalysis.mode === 'current-only' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Current snapshot only</AlertTitle>
              <AlertDescription>
                This mature finite-MIP policy currently supports today&apos;s value and benefit metrics plus comparison rows only. Projection, NPV, and opportunity-cost panels remain intentionally unavailable in V1.
              </AlertDescription>
            </Alert>
          )}
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
        </>
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
