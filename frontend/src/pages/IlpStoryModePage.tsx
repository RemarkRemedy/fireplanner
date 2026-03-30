import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { FeeImpactChart } from '@/components/ilp/FeeImpactChart'
import { useFeeImpact } from '@/hooks/useFeeImpact'
import { DecisionPanel } from '@/components/ilp/DecisionPanel'
import { OpportunityCostCard } from '@/components/ilp/OpportunityCostCard'
import { PolicySetupGate } from '@/components/ilp/PolicySetupGate'
import { ReceiptPreviewModal } from '@/components/ilp/receipt/ReceiptPreviewModal'
import { usePageMeta } from '@/hooks/usePageMeta'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { formatIlpBonusSupport } from '@/lib/ilpBonusSupport'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import type { IlpCatalogProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { mergePolicySeed } from '@/stores/useIlpStore'

// --- Hydration: resolve productId to catalog product ---

function useCatalogProduct(productId: string | undefined) {
  return useMemo(() => {
    if (!productId) return null
    const { products } = getIlpCatalog()
    return products.find((p) => p.id === productId) ?? null
  }, [productId])
}

// --- Story screen wrapper ---

function StoryScreen({ children, id, wide }: { children: React.ReactNode; id: string; wide?: boolean }) {
  return (
    <section
      id={id}
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8"
    >
      <div className={`w-full space-y-6 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {children}
      </div>
    </section>
  )
}

function ScrollHint({ targetId, label }: { targetId: string; label: string }) {
  return (
    <button
      type="button"
      className="mt-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })}
    >
      <ChevronDown className="h-4 w-4 animate-bounce" />
      {label}
    </button>
  )
}

// --- Variant picker (when product has multiple variants) ---

function VariantPicker({
  product,
  onSelect,
}: {
  product: IlpCatalogProduct
  onSelect: (variant: IlpTemplateVariant) => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{product.productName}</h2>
      <p className="text-sm text-muted-foreground">
        This product has {product.variants.length} variants. Select one to continue.
      </p>
      <div className="grid gap-3">
        {product.variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent/50"
            onClick={() => onSelect(variant)}
          >
            <div className="font-medium">
              {variant.currency} / {variant.mipBasis === 'open-ended' ? 'Open-ended' : `MIP ${variant.mipLength}`}
              {(() => {
                const suffix = variant.id.split('-').pop()
                if (suffix && !['sgd', 'usd', 'sp', 'rsp'].includes(suffix) && !/^\d+$/.test(suffix)) {
                  return ` (${suffix.charAt(0).toUpperCase() + suffix.slice(1)})`
                }
                return ''
              })()}
            </div>
            <div className="text-xs text-muted-foreground">
              {variant.accounts.length} account{variant.accounts.length === 1 ? '' : 's'}, {variant.feeRules.length} fee rules
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Main page ---

export function IlpStoryModePage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVariantId = searchParams.get('variantId')

  usePageMeta({
    title: 'ILP Fee Story: SG FIRE Planner',
    description: 'See the real cost of your ILP in 4 screens.',
    path: `/ilp-fees/story/${productId ?? ''}`,
  })

  const catalogProduct = useCatalogProduct(productId)

  // Hydration state machine: variant selection -> setup gate -> story
  const [pendingSeed, setPendingSeed] = useState<IlpPolicySeed | null>(null)
  const [storyPolicy, setStoryPolicy] = useState<IlpPolicyInput | null>(null)
  const [showFeeStory, setShowFeeStory] = useState(true)

  // No persistence — always fresh from setup gate
  const activePolicy = storyPolicy
  const analysisResult = useMemo(() => {
    if (!activePolicy) return { analysis: null, error: null }
    try {
      return { analysis: analyzeIlpPolicy(activePolicy), error: null }
    } catch (err) {
      return { analysis: null, error: err instanceof Error ? err.message : 'Unable to analyze this policy.' }
    }
  }, [activePolicy])
  const { analysis, error: analysisError } = analysisResult

  const routeSeed = useMemo(() => {
    if (!catalogProduct || !requestedVariantId) return null
    const requestedVariant = catalogProduct.variants.find((variant) => variant.id === requestedVariantId)
    if (!requestedVariant) return null
    const { manifest } = getIlpCatalog()
    return templateVariantToPolicySeed(catalogProduct, requestedVariant, manifest)
  }, [catalogProduct, requestedVariantId])

  // Derive default seed for single-variant products (no state update needed)
  const defaultSeed = useMemo(() => {
    if (!catalogProduct || catalogProduct.variants.length !== 1) return null
    const { manifest } = getIlpCatalog()
    return templateVariantToPolicySeed(catalogProduct, catalogProduct.variants[0], manifest)
  }, [catalogProduct])

  // Effective seed: user-selected seed takes priority, then route-selected, then auto-derived default
  const effectiveSeed = pendingSeed ?? routeSeed ?? defaultSeed

  // --- Product not found ---
  if (!productId || !catalogProduct) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="text-muted-foreground">
          {productId ? `No product with ID "${productId}" in the catalog.` : 'No product ID specified.'}
        </p>
        <Link to="/ilp-review" className="text-primary hover:underline">
          Go to ILP Review
        </Link>
      </div>
    )
  }

  // --- Step 1: Variant selection (if multiple variants) ---
  if (!effectiveSeed && !storyPolicy) {
    if (catalogProduct.variants.length > 1) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
          <div className="w-full max-w-md">
            <VariantPicker product={catalogProduct} onSelect={(variant) => {
              const { manifest } = getIlpCatalog()
              const seed = templateVariantToPolicySeed(catalogProduct, variant, manifest)
              setPendingSeed(seed)
            }} />
          </div>
        </div>
      )
    }
  }

  // --- Step 2: Setup gate (confirm premium etc.) ---
  if (effectiveSeed && !storyPolicy) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-4">
          <h2 className="text-xl font-semibold">Confirm your details</h2>
          <p className="text-sm text-muted-foreground">
            Verify or adjust the premium and policy details before we show you the fee breakdown.
          </p>
          <PolicySetupGate
            seed={effectiveSeed!}
            prospect
            onConfirm={(adjustedSeed) => {
              // Build policy in-memory only — no store persistence for story mode
              const policy = mergePolicySeed(adjustedSeed)
              setStoryPolicy(policy)
              setShowFeeStory(true)
              setPendingSeed(null)
            }}
            onCancel={() => {
              setPendingSeed(null)
              if (requestedVariantId && productId) {
                navigate(`/ilp-fees/story/${productId}`, { replace: true })
              }
            }}
          />
        </div>
      </div>
    )
  }

  // --- Step 3: Story screens ---
  if (analysisError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Analysis failed</h1>
        <p className="text-sm text-muted-foreground">{analysisError}</p>
        <Link to="/ilp-review" className="text-primary hover:underline">
          Try the full dashboard
        </Link>
      </div>
    )
  }

  if (!activePolicy || !analysis) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Auto-launch story on first render when we have data
  if (showFeeStory) {
    return <IlpFeeStory policy={activePolicy} analysis={analysis} onClose={() => setShowFeeStory(false)} />
  }

  return (
    <StoryDetailView
      policy={activePolicy}
      analysis={analysis}
      catalogProduct={catalogProduct}
      onReplay={() => setShowFeeStory(true)}
    />
  )
}

/** Detail view after the Wrapped story closes. Separate component so hooks can be called unconditionally. */
function StoryDetailView({ policy, analysis, catalogProduct, onReplay }: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  catalogProduct: IlpCatalogProduct
  onReplay: () => void
}) {
  const feeImpact = useFeeImpact(policy, analysis, true)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const bonusSupport = formatIlpBonusSupport(
    analysis.summary.totalBonusesReceived,
    analysis.summary.totalFeesCharged,
  )
  const receiptFeeBreakdown = useMemo(
    () => buildFeeBreakdown(analysis.projections.mid, policy.funds, policy),
    [analysis, policy],
  )

  return (
    <div>
      {/* Screen 1: Fee Breakdown */}
      <StoryScreen id="story-fees" wide>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {catalogProduct.insurer}
            </p>
            <h1 className="text-2xl font-bold">{catalogProduct.productName}</h1>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            onClick={onReplay}
          >
            Replay fee story
          </button>
        </div>
        <FeeImpactChart
          tiers={feeImpact.tiers}
          timeSeries={feeImpact.timeSeries}
          tierDefs={feeImpact.tierDefs}
          horizonYears={feeImpact.horizonYears}
          currency={policy.currency}
          monthlyContribution={policy.monthlyContribution}
          initialSinglePremium={policy.initialSinglePremium}
          useReal
        />
        <FeeBreakdownSection policy={policy} analysis={analysis} />
        <ScrollHint targetId="story-bonuses" label="What about bonuses?" />
      </StoryScreen>

      {/* Screen 3: The Bonus Reality Check */}
      <StoryScreen id="story-bonuses" wide>
        <h2 className="text-2xl font-bold">The bonus reality check</h2>
        {analysis.summary.totalBonusesReceived > 0 ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Total bonuses received</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {new Intl.NumberFormat('en-SG', { style: 'currency', currency: policy.currency }).format(analysis.summary.totalBonusesReceived)}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Bonus support vs gross fees</div>
                  <div className="text-2xl font-bold">{bonusSupport.value}</div>
                  <div className="text-xs text-muted-foreground">{bonusSupport.detail}</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Bonuses can cushion net cost, but they are not fee rebates. Some products credit premium bonuses that can be larger than gross fees over the modelled horizon. Check your policy document for suspension, clawback, vesting, and payout conditions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                This product does not have modelled bonuses. All fee figures shown are gross fees with no modelled bonus support. Actual net fees may be lower if the product offers bonuses that are not yet captured in the catalog.
              </p>
            </CardContent>
          </Card>
        )}
        <ScrollHint targetId="story-exit" label="What are your exit options?" />
      </StoryScreen>

      {/* Screen 4: The Exit Math */}
      <StoryScreen id="story-exit" wide>
        <h2 className="text-2xl font-bold">Your exit options</h2>
        <DecisionPanel policy={policy} analysis={analysis} />
        <OpportunityCostCard policy={policy} analysis={analysis} />
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground">
              Not financial advice. These calculations are based on your inputs and standardized assumptions. Consult a licensed financial adviser before making policy decisions.
            </p>
          </CardContent>
        </Card>
        {analysis.summary.totalPremiumsPaid > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" size="lg" onClick={() => setReceiptOpen(true)}>
              <Receipt className="mr-2 h-4 w-4" />
              Generate Your ILP Receipt
            </Button>
          </div>
        )}
        <div className="flex flex-col items-center gap-3 pt-4">
          <Link to="/ilp-review">
            <Button size="lg">
              See full details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            View the complete projection table, fee waterfall, and NPV timeline.
          </p>
        </div>
      </StoryScreen>

      <ReceiptPreviewModal
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        policy={policy}
        analysis={analysis}
        feeBreakdown={receiptFeeBreakdown}
        includeOcf
      />
    </div>
  )
}
