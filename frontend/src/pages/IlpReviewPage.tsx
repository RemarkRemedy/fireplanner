import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, FolderOpen, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductPickerDialog } from '@/components/ilp/catalog/ProductPickerDialog'
import { ComparisonTable } from '@/components/ilp/ComparisonTable'
import { DecisionPanel } from '@/components/ilp/DecisionPanel'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { FeeWaterfallChart } from '@/components/ilp/FeeWaterfallChart'
import { NpvTimelineChart } from '@/components/ilp/NpvTimelineChart'
import { OpportunityCostCard } from '@/components/ilp/OpportunityCostCard'
import { PolicyInputForm } from '@/components/ilp/PolicyInputForm'
import { PolicySetupGate } from '@/components/ilp/PolicySetupGate'
import { PolicyTabs } from '@/components/ilp/PolicyTabs'
import { ProjectionTable } from '@/components/ilp/ProjectionTable'
import { SummaryCards } from '@/components/ilp/SummaryCards'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { IlpPolicyAnalysis } from '@/lib/calculations/ilp'
import { analyzeAllPolicies } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpPercent } from '@/components/ilp/formatters'
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

interface HeadlineInsightProps {
  policy: { name: string; currency: 'SGD' | 'USD' }
  analysis: IlpPolicyAnalysis
}

function HeadlineInsight({ policy, analysis }: HeadlineInsightProps) {
  const { summary } = analysis
  const feePctOfPremiums = summary.totalPremiumsPaid > 0
    ? summary.netFeeDrag / summary.totalPremiumsPaid
    : 0

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Returns are not guaranteed, but fees are.
        </p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-3xl font-bold">{formatIlpCurrency(summary.netFeeDrag, policy.currency)}</div>
            <div className="text-sm text-muted-foreground">net fees over the analysis horizon</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{formatIlpPercent(feePctOfPremiums)}</div>
            <div className="text-sm text-muted-foreground">of your premiums</div>
          </div>
          {summary.totalBonusesReceived > 0 && (
            <div>
              <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(summary.totalBonusesReceived, policy.currency)}</div>
              <div className="text-sm text-muted-foreground">returned as bonuses</div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {policy.name}. Gross fees {formatIlpCurrency(summary.totalFeesCharged, policy.currency)}, bonuses offset {formatIlpCurrency(summary.totalBonusesReceived, policy.currency)}.
          {analysis.mode === 'projected' && ` Cancel-now penalty: ${formatIlpCurrency(summary.cancelNowPenalty, policy.currency)}.`}
        </p>
      </CardContent>
    </Card>
  )
}

function TemplateCatalogSummary() {
  const { products, manifest } = getIlpCatalog()
  const supportedProducts = products.filter((product) => product.supportStatus === 'supported')
  const partialProducts = products.filter((product) => product.supportStatus === 'partial')
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <button
          type="button"
          className="flex w-full items-start justify-between text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Available Templates</h2>
              <Badge variant="outline">Catalog {manifest.catalogVersion}</Badge>
              <Badge>{supportedProducts.length} supported</Badge>
              <Badge variant="secondary">{partialProducts.length} partial</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Supported templates are release-gated within their modeled economics. Partial templates stay selectable, but still need document review for metadata-only behavior.
            </p>
          </div>
          {expanded
            ? <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            : <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
        </button>

        {expanded && (
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
              <div className="text-sm font-medium">Partial templates</div>
              <div className="space-y-2">
                {partialProducts.map((product) => (
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
        )}
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
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [pendingSeed, setPendingSeed] = useState<IlpPolicySeed | null>(null)

  function handleCatalogPick(product: ReturnType<typeof getIlpCatalog>['products'][number], variant: ReturnType<typeof getIlpCatalog>['products'][number]['variants'][number]) {
    const seed = templateVariantToPolicySeed(product, variant, getIlpCatalog().manifest)
    setCatalogError(null)
    setPickerOpen(false)
    setPendingSeed(seed)
  }

  function handleGateConfirm(adjustedSeed: IlpPolicySeed) {
    const result = addPolicyFromSeed(adjustedSeed)
    if (!result.success) {
      setCatalogError(result.errors[0] ?? 'Unable to seed policy from the selected catalog template.')
      return
    }
    setPendingSeed(null)
  }

  function handleGateCancel() {
    setPendingSeed(null)
  }

  const policyEntries = useMemo(() => (
    policies.map((policy) => {
      const parsed = ilpPolicySchema.safeParse(policy)
      return {
        policy,
        issues: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
        valid: parsed.success,
      }
    })
  ), [policies])

  const analysisResult = useMemo(() => {
    const validPolicies = policyEntries.filter((entry) => entry.valid).map((entry) => entry.policy)
    if (validPolicies.length === 0) {
      return { analysis: null, error: null }
    }

    try {
      return { analysis: analyzeAllPolicies(validPolicies), error: null }
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
  const fallbackAnalysis = analysisResult.analysis?.policies[0] ?? null
  const displayAnalysis = selectedAnalysis ?? fallbackAnalysis
  const displayPolicy = displayAnalysis
    ? policyEntries.find((entry) => entry.policy.id === displayAnalysis.policyId)?.policy ?? null
    : null
  const excludedCount = policyEntries.filter((entry) => !entry.valid).length

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
        <TemplateCatalogSummary />
        <ProductPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleCatalogPick} />
        {pendingSeed && (
          <PolicySetupGate
            seed={pendingSeed}
            onConfirm={handleGateConfirm}
            onCancel={handleGateCancel}
          />
        )}
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

      <PolicyTabs />

      <ProductPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleCatalogPick} />

      {pendingSeed && (
        <PolicySetupGate
          seed={pendingSeed}
          onConfirm={handleGateConfirm}
          onCancel={handleGateCancel}
        />
      )}

      {analysisResult.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Analysis paused</AlertTitle>
          <AlertDescription>{analysisResult.error}</AlertDescription>
        </Alert>
      )}

      {catalogError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Catalog seeding failed</AlertTitle>
          <AlertDescription>{catalogError}</AlertDescription>
        </Alert>
      )}

      {/* Headline insight + analysis sections — shown FIRST so users see results immediately */}
      {selectedPolicy && displayAnalysis && displayPolicy ? (
        <>
          {selectedAnalysis == null && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Showing analysis for another valid policy</AlertTitle>
              <AlertDescription>
                The selected policy is invalid right now, so the analysis panels below are temporarily using {displayPolicy.name}.
              </AlertDescription>
            </Alert>
          )}
          <HeadlineInsight policy={displayPolicy} analysis={displayAnalysis} />
          <SummaryCards policy={displayPolicy} analysis={displayAnalysis} />
          <FeeWaterfallChart policy={displayPolicy} analysis={displayAnalysis} />
          <FeeBreakdownSection policy={displayPolicy} analysis={displayAnalysis} />
          <DecisionPanel policy={displayPolicy} analysis={displayAnalysis} />
          <NpvTimelineChart analyses={analysisResult.analysis?.policies ?? [displayAnalysis]} />
          <OpportunityCostCard policy={displayPolicy} analysis={displayAnalysis} />

          {analysisResult.analysis && (
            <ComparisonTable
              analyses={analysisResult.analysis.policies}
              comparison={analysisResult.analysis.comparison}
            />
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

      {/* Policy configuration — below analysis for catalog-seeded policies */}
      <PolicyInputForm policy={selectedPolicy} issues={selectedEntry?.issues ?? []} />

      {/* Detailed projection table — reference data at the bottom */}
      {selectedPolicy && displayAnalysis && displayPolicy && displayAnalysis.mode === 'projected' && (
        <ProjectionTable policy={displayPolicy} analysis={displayAnalysis} />
      )}

      {excludedCount > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{excludedCount} policy excluded from comparison</AlertTitle>
          <AlertDescription>
            Invalid policies stay editable below, but only valid policies are included in the charts and comparison table so the page remains usable while you edit.
          </AlertDescription>
        </Alert>
      )}

      <TemplateCatalogSummary />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Support boundary</AlertTitle>
        <AlertDescription>
          Supported catalog templates are release-gated only within their declared modeled economics. Partial templates remain useful for structured review, but they still require manual verification of metadata-only behavior and unresolved charges.
        </AlertDescription>
      </Alert>

      <p className="text-xs text-muted-foreground">
        This tool is for educational purposes. It models generic ILP fee structures and does not constitute financial advice. Verify all assumptions against your actual policy documents.
      </p>
    </div>
  )
}
