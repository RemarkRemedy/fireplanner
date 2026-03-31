import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, BadgeDollarSign, ChartColumnBig, Clock3, Receipt, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InterpretationCallout } from '@/components/shared/InterpretationCallout'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { FeeImpactChart } from '@/components/ilp/FeeImpactChart'
import { useFeeImpact } from '@/hooks/useFeeImpact'
import { DecisionPanel } from '@/components/ilp/DecisionPanel'
import { OpportunityCostCard } from '@/components/ilp/OpportunityCostCard'
import { ExitTimingExplorer } from '@/components/ilp/ExitTimingExplorer'
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

function ProspectSetupPreview({ seed }: { seed: IlpPolicySeed }) {
  const pathLabel = (seed.initialSinglePremium ?? 0) > 0 || seed.monthlyContribution === 0
    ? `${new Intl.NumberFormat('en-SG', { style: 'currency', currency: seed.currency, maximumFractionDigits: 0 }).format(seed.initialSinglePremium ?? 0)} single premium`
    : `${new Intl.NumberFormat('en-SG', { style: 'currency', currency: seed.currency, maximumFractionDigits: 0 }).format(seed.monthlyContribution)} / month`
  const horizonLabel = seed.mipLength != null ? `${seed.mipLength}+ years modeled` : 'Flexible projection horizon'

  const previewCards = [
    {
      title: 'Fee story',
      detail: 'Annual fee categories, cumulative fees, and the detailed table you saw on the explore dashboard.',
      icon: ChartColumnBig,
    },
    {
      title: 'How bonuses affect fees',
      detail: 'Bonuses are shown separately from gross fees so you can see how much support they provide to net cost.',
      icon: BadgeDollarSign,
    },
    {
      title: 'Exit options',
      detail: 'Hold-vs-exit comparisons with surrender charges and opportunity-cost framing.',
      icon: ShieldCheck,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <Clock3 className="h-3.5 w-3.5" />
          Prospect setup
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Confirm your details
          </h2>
          <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            We only need the premium, fund fee, and projection horizon before we show the full fee breakdown. The product rules stay the same; these inputs only control the scenario we illustrate.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Template</div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{seed.name}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {seed.insurer} · {seed.currency}
            {seed.mipLength != null && ` · MIP ${seed.mipLength} years`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Starting assumptions</div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{pathLabel}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{horizonLabel}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">What you’ll see next</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This is the same dashboard detail, staged in a simpler path for prospective buyers.
          </p>
        </div>
        <div className="grid gap-3">
          {previewCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.title} className="flex items-start gap-3 rounded-md border border-white/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div className="rounded-md bg-slate-100 p-2.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-slate-950 dark:text-white">{card.title}</div>
                  <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{card.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
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
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center px-4 py-8">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,30rem)] lg:items-start">
          <ProspectSetupPreview seed={effectiveSeed} />
          <div className="space-y-3">
            <PolicySetupGate
              seed={effectiveSeed}
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
            <p className="px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              No login, no saved lead form, and no adviser handoff. This route just turns the product template into a visible fee scenario.
            </p>
          </div>
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
    />
  )
}

/** Detail view after the Wrapped story closes. Separate component so hooks can be called unconditionally. */
function StoryDetailView({ policy, analysis, catalogProduct }: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  catalogProduct: IlpCatalogProduct
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
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="space-y-6">
        <div className="space-y-1">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {catalogProduct.insurer}
            </p>
            <h1 className="text-2xl font-bold">{catalogProduct.productName}</h1>
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900 dark:text-amber-200">
            Use this as a guide, not a quote
          </div>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
            <li>
              We try to keep this estimate close to the published product rules, but it may not match the exact charges on your specific policy. It is still a useful guide to help you visualize the fees this product could incur.
            </li>
            <li>
              The fund-fee impact shown here depends on the market-return assumptions you use. You can use past returns as a reference point, but past performance does not guarantee future performance.
            </li>
            <li>
              Check your policy documents and confirm the actual numbers with your adviser before relying on them for a decision.
            </li>
          </ul>
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
        {analysis.summary.totalPremiumsPaid > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="lg" onClick={() => setReceiptOpen(true)}>
              <Receipt className="mr-2 h-4 w-4" />
              Generate Your ILP Receipt
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">How bonuses affect your fees</h2>
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
                  <div className="text-sm text-muted-foreground">How much bonuses cover</div>
                  <div className="text-2xl font-bold">{bonusSupport.value}</div>
                  <div className="text-xs text-muted-foreground">{bonusSupport.detail}</div>
                </div>
              </div>
              <InterpretationCallout
                level="success"
                message="Bonuses can reduce your net cost, but they are separate from the policy's gross fees. Some products credit premium bonuses that may be large relative to fees over the modeled horizon. Check your policy document for suspension, clawback, vesting, and payout conditions."
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <InterpretationCallout
                level="warning"
                message="This product does not have modeled bonuses. All fee figures shown are gross fees with no modeled bonus support. Actual net fees may be lower if the product offers bonuses that are not yet captured in the catalog."
              />
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Your possible path and the opportunity cost</h2>
        <DecisionPanel policy={policy} analysis={analysis} />
        <ExitTimingExplorer policy={policy} analysis={analysis} />
        <InterpretationCallout
          level="warning"
          message="These path comparisons are scenario estimates based on your current inputs. Use them to compare tradeoffs, then confirm the actual exit values and charges with your adviser or policy documents."
        />
        <OpportunityCostCard policy={policy} analysis={analysis} />
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground">
              Not financial advice. These calculations are based on your inputs and standardized assumptions. Consult a licensed financial adviser before making policy decisions.
            </p>
          </CardContent>
        </Card>
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
      </section>

      <ReceiptPreviewModal
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        policy={policy}
        analysis={analysis}
        feeBreakdown={receiptFeeBreakdown}
        includeOcf
        defaultUseReal
      />
    </div>
  )
}
