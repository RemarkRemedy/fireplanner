import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { DecisionPanel } from '@/components/ilp/DecisionPanel'
import { OpportunityCostCard } from '@/components/ilp/OpportunityCostCard'
import { PolicySetupGate } from '@/components/ilp/PolicySetupGate'
import { usePageMeta } from '@/hooks/usePageMeta'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import type { IlpPolicyInput } from '@/lib/calculations/ilp'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import type { IlpCatalogProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { useIlpStore } from '@/stores/useIlpStore'

// --- Hydration: resolve productId to catalog product ---

function useCatalogProduct(productId: string | undefined) {
  return useMemo(() => {
    if (!productId) return null
    const { products } = getIlpCatalog()
    return products.find((p) => p.id === productId) ?? null
  }, [productId])
}

// --- Story screen wrapper ---

function StoryScreen({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <section
      id={id}
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-2xl space-y-6">
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
              {variant.id.includes('advanced') ? ' (Advanced)' : ''}
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

  usePageMeta({
    title: 'ILP Fee Story: SG FIRE Planner',
    description: 'See the real cost of your ILP in 4 screens.',
    path: `/ilp/story/${productId ?? ''}`,
  })

  const catalogProduct = useCatalogProduct(productId)
  const addPolicyFromSeed = useIlpStore((state) => state.addPolicyFromSeed)
  const policies = useIlpStore((state) => state.policies)

  // Hydration state machine: variant selection -> setup gate -> story
  const [selectedVariant, setSelectedVariant] = useState<IlpTemplateVariant | null>(null)
  const [pendingSeed, setPendingSeed] = useState<IlpPolicySeed | null>(null)
  const [storyPolicy, setStoryPolicy] = useState<IlpPolicyInput | null>(null)

  // Check if we already have this product in the store (persisted from prior session)
  const existingPolicy = useMemo(() => {
    if (!productId) return null
    return policies.find((p) => p.catalogSource?.productId === productId) ?? null
  }, [policies, productId])

  // Compute analysis for the active policy (existing or just-created)
  const activePolicy = storyPolicy ?? existingPolicy
  const analysisResult = useMemo(() => {
    if (!activePolicy) return { analysis: null, error: null }
    try {
      return { analysis: analyzeIlpPolicy(activePolicy), error: null }
    } catch (err) {
      return { analysis: null, error: err instanceof Error ? err.message : 'Unable to analyze this policy.' }
    }
  }, [activePolicy])
  const { analysis, error: analysisError } = analysisResult

  // Derive default seed for single-variant products (no state update needed)
  const defaultSeed = useMemo(() => {
    if (!catalogProduct || catalogProduct.variants.length !== 1) return null
    const { manifest } = getIlpCatalog()
    return templateVariantToPolicySeed(catalogProduct, catalogProduct.variants[0], manifest)
  }, [catalogProduct])

  // Effective seed: user-selected seed takes priority, then auto-derived default
  const effectiveSeed = pendingSeed ?? defaultSeed

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
    if (catalogProduct.variants.length > 1 && !selectedVariant) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
          <div className="w-full max-w-md">
            <VariantPicker product={catalogProduct} onSelect={(variant) => {
              setSelectedVariant(variant)
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
              // Build the policy from the seed
              const result = addPolicyFromSeed(adjustedSeed)
              if (result.success) {
                // Find the just-added policy
                const added = useIlpStore.getState().policies.find((p) => p.id === result.policyId)
                if (added) setStoryPolicy(added)
              }
              setPendingSeed(null)
            }}
            onCancel={() => {
              setPendingSeed(null)
              setSelectedVariant(null)
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

  return (
    <div>
      {/* Screen 1: The Hook */}
      <StoryScreen id="story-hook">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {catalogProduct.insurer}
          </p>
          <h1 className="text-3xl font-bold">{catalogProduct.productName}</h1>
        </div>
        <IlpFeeStory policy={activePolicy} analysis={analysis} />
        <p className="text-center text-xs text-muted-foreground">
          Based on {activePolicy.currency} {activePolicy.accounts[0]?.monthlyContribution
            ? `${activePolicy.accounts[0].monthlyContribution}/mo`
            : 'your'
          } premium, mid return scenario. Not financial advice.
        </p>
        <ScrollHint targetId="story-fees" label="Where does your money go?" />
      </StoryScreen>

      {/* Screen 2: Where Your Money Goes */}
      <StoryScreen id="story-fees">
        <h2 className="text-2xl font-bold">Where your money goes</h2>
        <FeeBreakdownSection policy={activePolicy} analysis={analysis} />
        <ScrollHint targetId="story-bonuses" label="What about bonuses?" />
      </StoryScreen>

      {/* Screen 3: The Bonus Reality Check */}
      <StoryScreen id="story-bonuses">
        <h2 className="text-2xl font-bold">The bonus reality check</h2>
        {analysis.summary.totalBonusesReceived > 0 ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Total bonuses received</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {new Intl.NumberFormat('en-SG', { style: 'currency', currency: activePolicy.currency }).format(analysis.summary.totalBonusesReceived)}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Bonus offset ratio</div>
                  <div className="text-2xl font-bold">
                    {analysis.summary.totalFeesCharged > 0
                      ? `${((analysis.summary.totalBonusesReceived / analysis.summary.totalFeesCharged) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">of gross fees offset by bonuses</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Bonuses reduce your net fee burden, but they do not eliminate it. Many bonuses are conditional on continuous premium payments. Bonus rules: check your policy document for suspension, clawback, or vesting conditions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                This product does not have modelled bonuses. All fee figures shown are gross fees with no bonus offset. Actual net fees may be lower if the product offers bonuses that are not yet captured in the catalog.
              </p>
            </CardContent>
          </Card>
        )}
        <ScrollHint targetId="story-exit" label="What are your exit options?" />
      </StoryScreen>

      {/* Screen 4: The Exit Math */}
      <StoryScreen id="story-exit">
        <h2 className="text-2xl font-bold">Your exit options</h2>
        <DecisionPanel policy={activePolicy} analysis={analysis} />
        <OpportunityCostCard policy={activePolicy} analysis={analysis} />
        <Card>
          <CardContent className="pt-6">
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
      </StoryScreen>
    </div>
  )
}
