import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, BadgeDollarSign, Calculator, ChartColumnBig, Clock3, Play, Receipt, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InterpretationCallout } from '@/components/shared/InterpretationCallout'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { IlpIllustrativeDisclosureBanner } from '@/components/ilp/IlpIllustrativeDisclosureBanner'
import { IlpFeeStory } from '@/components/ilp/IlpFeeStory'
import { FeeBreakdownSection } from '@/components/ilp/FeeBreakdownSection'
import { FeeImpactChart } from '@/components/ilp/FeeImpactChart'
import { DiscountedChargeTimelineSection } from '@/components/ilp/DiscountedChargeTimelineSection'
import { ExitReinvestmentBenchmarkSection } from '@/components/ilp/ExitReinvestmentBenchmarkSection'
import { useFeeImpact } from '@/hooks/useFeeImpact'
import { useIlpFeesIllustrativeDisclosure } from '@/hooks/useIlpFeesIllustrativeDisclosure'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
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
import { formatCatalogVariantLabel } from '@/lib/ilp-catalog/labels'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import type { IlpCatalogProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { IllustrativeChartsGroup } from '@/components/ilp/IllustrationOnlyChartFrame'
import { formatIlpCurrency, formatIlpPercent } from '@/components/ilp/formatters'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

type StoryDetailMode = 'walkthrough' | 'detailed'
type SetupIntent = 'explore' | 'review'
type CashFlowQuickEntry = {
  monthlyIncome: number
  monthlyExpenses: number
}

type LiquidityStatus = 'comfortable' | 'tight' | 'strained'

function derivePlannerCashFlowQuickEntry({
  adults,
  annualExpenses,
  householdPlanRevision,
  incomeByAdultId,
}: {
  adults: Array<{ id: string; annualIncome: number }>
  annualExpenses: number
  householdPlanRevision: number
  incomeByAdultId: Record<string, Array<{ totalNet: number }>> | undefined
}): CashFlowQuickEntry | null {
  if (householdPlanRevision <= 0) {
    return null
  }

  const monthlyIncome = adults.reduce((sum, adult) => {
    const row0 = incomeByAdultId?.[adult.id]?.[0]
    const netMonthlyIncome = row0
      ? row0.totalNet / 12
      : adult.annualIncome * 0.8 / 12
    return sum + netMonthlyIncome
  }, 0)
  const monthlyExpenses = annualExpenses / 12

  if (monthlyIncome <= 0 && monthlyExpenses <= 0) {
    return null
  }

  return {
    monthlyIncome: Math.max(0, Math.round(monthlyIncome)),
    monthlyExpenses: Math.max(0, Math.round(monthlyExpenses)),
  }
}

function classifyLiquidityStatus({
  liquidMarginAfterPremium,
  premiumShareOfSurplus,
}: {
  liquidMarginAfterPremium: number | null
  premiumShareOfSurplus: number | null
}): LiquidityStatus {
  if (liquidMarginAfterPremium == null) {
    return 'tight'
  }
  if (liquidMarginAfterPremium < 0.10 || (premiumShareOfSurplus != null && premiumShareOfSurplus >= 0.5)) {
    return 'strained'
  }
  if (liquidMarginAfterPremium < 0.20 || (premiumShareOfSurplus != null && premiumShareOfSurplus >= 0.33)) {
    return 'tight'
  }
  return 'comfortable'
}

function liquidityTone(status: LiquidityStatus): string {
  if (status === 'comfortable') return 'text-emerald-700 dark:text-emerald-400'
  if (status === 'tight') return 'text-amber-700 dark:text-amber-400'
  return 'text-rose-700 dark:text-rose-400'
}

function liquidityBorder(status: LiquidityStatus): string {
  if (status === 'comfortable') return 'border-emerald-200 bg-emerald-50/60'
  if (status === 'tight') return 'border-amber-200 bg-amber-50/60'
  return 'border-rose-200 bg-rose-50/60'
}

function liquidityLabel(status: LiquidityStatus): string {
  if (status === 'comfortable') return 'Comfortable liquid margin'
  if (status === 'tight') return 'Tighter liquid margin'
  return 'Thin liquid margin'
}

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
          Standard review
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Confirm your details
          </h2>
          <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            This is the standard-assumption setup. We only need the premium, fund fee, and projection horizon before we show the walkthrough and detailed fee breakdown.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Template</div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{seed.name}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {seed.insurer} · {seed.currency}
            {seed.mipLength != null && ` · MIP ${seed.mipLength} years`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Starting assumptions</div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{pathLabel}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{horizonLabel}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">What you’ll see next</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This is the same dashboard detail, staged as the standard walkthrough for someone reviewing the product before adding current-policy inputs.
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

function CurrentPolicyPreview({ seed }: { seed: IlpPolicySeed }) {
  const statementItems = [
    {
      title: 'Where the policy stands today',
      detail: 'Enter your current policy year and how many months you have already paid so the review starts from your actual point in the policy.',
      icon: Clock3,
    },
    {
      title: 'What your balance may be made of',
      detail: 'We estimate how much may have come from premiums, bonuses, fees, and investment performance so far.',
      icon: BadgeDollarSign,
    },
    {
      title: 'What staying or exiting may look like next',
      detail: 'You will see the current balance attribution, fee path, and hold-versus-exit framing using the same product rules.',
      icon: ShieldCheck,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <Calculator className="h-3.5 w-3.5" />
          Current policy review
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Review what you already own
          </h2>
          <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Use your latest policy statement to review where you are today before deciding whether to keep going, hold, or exit.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product</div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{seed.name}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {seed.insurer} · {seed.currency}
            {seed.mipLength != null && ` · MIP ${seed.mipLength} years`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">You will need</div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Your policy statement</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Policy year, paid months, and current account balance</div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">What you’ll see next</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This review starts from your current policy position, not from a fresh buyer walkthrough.
          </p>
        </div>
        <div className="grid gap-3">
          {statementItems.map((card) => {
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
            <div className="font-medium">{formatCatalogVariantLabel(variant)}</div>
            <div className="text-xs text-muted-foreground">
              {variant.accounts.length} account{variant.accounts.length === 1 ? '' : 's'}, {variant.feeRules.length} fee rules
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReviewModeBranch({
  exitHref,
  onSwitchToExplore,
}: {
  exitHref: string
  onSwitchToExplore: () => void
}) {
  return (
    <div className="space-y-3">
      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/80 dark:bg-emerald-950/20">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Review my current ILP
            </div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">Use your policy statement</h3>
          </div>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Enter where you are in the policy today, how much you have paid so far, and your current balance. We will use that to estimate what may have come from premiums, bonuses, fees, and returns, then show what staying or exiting could look like next.
          </p>
          <div className="space-y-2 rounded-md border border-white/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <div className="text-sm font-medium text-slate-950 dark:text-white">What to prepare</div>
            <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>Your current policy year</li>
              <li>How many months you have already paid</li>
              <li>Your latest account balance or balances</li>
            </ul>
          </div>
          <Link to={exitHref} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Review my current policy
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={onSwitchToExplore}
        className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 transition-colors hover:border-primary hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        Prefer the product walkthrough first? Switch to the standard fee story.
      </button>
    </div>
  )
}

// --- Main page ---

export function IlpStoryModePage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVariantId = searchParams.get('variantId')
  const requestedIntent: SetupIntent = searchParams.get('intent') === 'review' ? 'review' : 'explore'

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
  const [detailMode, setDetailMode] = useState<StoryDetailMode>('walkthrough')
  const [setupIntent, setSetupIntent] = useState<SetupIntent>(requestedIntent)

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
  const exitHref = productId && requestedVariantId
    ? `/ilp-fees/exit?productId=${productId}&variantId=${encodeURIComponent(requestedVariantId)}`
    : '/ilp-fees/exit'

  useEffect(() => {
    if (!storyPolicy) {
      setSetupIntent(requestedIntent)
    }
  }, [requestedIntent, storyPolicy])

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
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl px-4 py-8">
        <div className="w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {catalogProduct.productName}
            </h1>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Choose how you want to review this product. You can start with the fee story or jump straight into current-policy review using your statement.
            </p>
          </div>

          <Tabs value={setupIntent} onValueChange={(value) => setSetupIntent(value as SetupIntent)}>
            <TabsList>
              <TabsTrigger value="explore">Understand this product</TabsTrigger>
              <TabsTrigger value="review">Review my current ILP</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,30rem)] lg:items-start">
            {setupIntent === 'review' ? (
              <CurrentPolicyPreview seed={effectiveSeed} />
            ) : (
              <ProspectSetupPreview seed={effectiveSeed} />
            )}
            <div className="space-y-3">
              {setupIntent === 'review' ? (
                <ReviewModeBranch
                  exitHref={exitHref}
                  onSwitchToExplore={() => setSetupIntent('explore')}
                />
              ) : (
                <>
                  <PolicySetupGate
                    seed={effectiveSeed}
                    prospect
                    onConfirm={(adjustedSeed) => {
                      // Build policy in-memory only — no store persistence for story mode
                      const policy = mergePolicySeed(adjustedSeed)
                      setStoryPolicy(policy)
                      setShowFeeStory(true)
                      setDetailMode('walkthrough')
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
                </>
              )}
            </div>
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
      mode={detailMode}
      onModeChange={setDetailMode}
      onReplayStory={() => setShowFeeStory(true)}
    />
  )
}

function GuideNote() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Use this estimate as a guide
      </div>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
        <li>
          We try to keep this estimate close to the published product rules, but it may not match the exact charges on your specific policy. It is still a useful guide to help you visualize the fees this product could incur.
        </li>
        <li>
          The fund-fee impact shown here depends on the market-return assumptions you use. You can use past returns as a reference point, but past performance does not guarantee future performance.
        </li>
        <li>
          This walkthrough is meant to make charges, projected values, and tradeoffs easier to read. It does not confirm the exact figures that apply to your policy.
        </li>
        <li>
          Confirm the applicable charges, surrender values, bonuses, and fund details in your policy documents and illustration before relying on these figures.
        </li>
      </ul>
    </div>
  )
}

function SectionLead({
  eyebrow,
  title,
  summary,
}: {
  eyebrow: string
  title: string
  summary?: string
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </div>
      <div className="max-w-3xl space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        {summary ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {summary}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function PlannerHandoffCard({
  policy,
  quickEntry,
  prefilledFromPlanner,
  onMonthlyIncomeChange,
  onMonthlyExpensesChange,
}: {
  policy: IlpPolicyInput
  quickEntry: CashFlowQuickEntry
  prefilledFromPlanner: boolean
  onMonthlyIncomeChange: (value: number) => void
  onMonthlyExpensesChange: (value: number) => void
}) {
  const hasQuickEntry = quickEntry.monthlyIncome > 0 || quickEntry.monthlyExpenses > 0
  const monthlySurplus = quickEntry.monthlyIncome - quickEntry.monthlyExpenses
  const annualSurplus = monthlySurplus * 12
  const canCompareMonthlyPremium = policy.currency === 'SGD' && policy.monthlyContribution > 0
  const remainingAfterPremium = canCompareMonthlyPremium ? monthlySurplus - policy.monthlyContribution : null
  const premiumShareOfSurplus = canCompareMonthlyPremium && monthlySurplus > 0
    ? policy.monthlyContribution / monthlySurplus
    : null
  const premiumShareOfTakeHome = canCompareMonthlyPremium && quickEntry.monthlyIncome > 0
    ? policy.monthlyContribution / quickEntry.monthlyIncome
    : null
  const liquidMarginAfterPremium = canCompareMonthlyPremium && remainingAfterPremium != null && quickEntry.monthlyIncome > 0
    ? remainingAfterPremium / quickEntry.monthlyIncome
    : null
  const liquidityStatus = classifyLiquidityStatus({
    liquidMarginAfterPremium,
    premiumShareOfSurplus,
  })

  let quickEntryCallout: ReactNode = null
  if (hasQuickEntry) {
    if (canCompareMonthlyPremium && monthlySurplus <= 0) {
      quickEntryCallout = (
        <InterpretationCallout
          level="danger"
          message="Your entered spending leaves no monthly surplus before this policy premium. Use the full planner if you want a broader affordability check."
        />
      )
    } else if (canCompareMonthlyPremium && remainingAfterPremium != null && remainingAfterPremium < 0) {
      quickEntryCallout = (
        <InterpretationCallout
          level="danger"
          message={`This policy's ${formatIlpCurrency(policy.monthlyContribution, 'SGD')} monthly premium is higher than your entered monthly surplus. Treat that as a prompt to double-check the commitment against your own numbers.`}
        />
      )
    } else if (canCompareMonthlyPremium && remainingAfterPremium != null && premiumShareOfSurplus != null) {
      if (liquidityStatus === 'comfortable') {
        quickEntryCallout = (
          <InterpretationCallout
            level="success"
            message={`At this quick-entry level, the monthly premium uses ${formatIlpPercent(premiumShareOfSurplus)} of your entered monthly surplus and leaves about ${formatIlpCurrency(remainingAfterPremium, 'SGD')} after the premium. That remaining cash flow still matters because this premium is less liquid than cash savings or a sellable investment position.`}
          />
        )
      } else {
        quickEntryCallout = (
          <InterpretationCallout
            level="warning"
            message={`At this quick-entry level, the monthly premium uses ${formatIlpPercent(premiumShareOfSurplus)} of your entered monthly surplus and leaves about ${formatIlpCurrency(remainingAfterPremium, 'SGD')} after the premium. That is still a thin liquid buffer for a commitment that is less liquid than cash savings or a sellable investment position.`}
          />
        )
      }
    } else if (policy.monthlyContribution > 0 && policy.currency !== 'SGD') {
      quickEntryCallout = (
        <InterpretationCallout
          level="warning"
          message="This quick entry is in SGD, so it does not directly compare against this USD premium. Use your own FX assumption if you want a cleaner comparison."
        />
      )
    } else if ((policy.initialSinglePremium ?? 0) > 0) {
      quickEntryCallout = (
        <InterpretationCallout
          level="warning"
          message="This quick entry helps you judge monthly cash flow only. For a one-off premium, compare the upfront amount against your broader finances separately."
        />
      )
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Want to compare this against your own cash flow?</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {prefilledFromPlanner
                ? 'These fields start with your saved planner income and spending. Adjust them here if you want a quick local affordability check without leaving this page.'
                : 'Enter a quick monthly estimate here if you want a rough affordability check on this page. This local check does not change your planner.'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CurrencyInput
            label="Monthly take-home income (SGD)"
            value={quickEntry.monthlyIncome}
            onChange={onMonthlyIncomeChange}
            placeholder="e.g. 5,000"
          />
          <CurrencyInput
            label="Monthly expenses (SGD)"
            value={quickEntry.monthlyExpenses}
            onChange={onMonthlyExpensesChange}
            placeholder="e.g. 3,000"
          />
        </div>

        {hasQuickEntry ? (
          <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex h-full flex-col rounded-md border p-4">
                <div className="min-h-[3rem] text-sm text-muted-foreground">Estimated monthly surplus</div>
                <div className="mt-1 text-2xl font-bold">{formatIlpCurrency(monthlySurplus, 'SGD')}</div>
              </div>
              <div className="flex h-full flex-col rounded-md border p-4">
                <div className="min-h-[3rem] text-sm text-muted-foreground">Estimated annual surplus</div>
                <div className="mt-1 text-2xl font-bold">{formatIlpCurrency(annualSurplus, 'SGD')}</div>
              </div>
              {canCompareMonthlyPremium ? (
                <>
                  <div className="flex h-full flex-col rounded-md border p-4">
                    <div className="min-h-[3rem] text-sm text-muted-foreground">This policy&apos;s monthly premium</div>
                    <div className="mt-1 text-2xl font-bold">{formatIlpCurrency(policy.monthlyContribution, 'SGD')}</div>
                  </div>
                  <div className="flex h-full flex-col rounded-md border p-4">
                    <div className="min-h-[3rem] text-sm text-muted-foreground">Surplus left after premium</div>
                    <div className="mt-1 text-2xl font-bold">{formatIlpCurrency(remainingAfterPremium ?? 0, 'SGD')}</div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col rounded-md border p-4 sm:col-span-2">
                  <div className="min-h-[3rem] text-sm text-muted-foreground">How to use this quick check</div>
                  <div className="mt-1 text-sm leading-6 text-muted-foreground">
                    Use this to judge your own monthly breathing room. For one-off premiums or non-SGD premiums, treat this as a local monthly check rather than a full policy-affordability answer.
                  </div>
                </div>
              )}
            </div>
            {canCompareMonthlyPremium && premiumShareOfTakeHome != null && liquidMarginAfterPremium != null ? (
              <div className="rounded-md border bg-slate-50/70 p-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-950">Liquidity lens</div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    This premium may contribute to long-term saving, but it does not behave like cash savings or a liquid ETF position you can usually access more easily.
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Premium as share of take-home pay</div>
                    <div className="mt-1 text-xl font-bold text-slate-950">
                      {formatIlpPercent(premiumShareOfTakeHome)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">How much of monthly take-home this policy asks you to commit.</div>
                  </div>
                  <div className={`rounded-md border p-4 ${liquidityBorder(liquidityStatus)}`}>
                    <div className="text-sm text-muted-foreground">Liquid cash-flow margin after premium</div>
                    <div className={`mt-1 text-xl font-bold ${liquidityTone(liquidityStatus)}`}>
                      {formatIlpPercent(liquidMarginAfterPremium)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {liquidityLabel(liquidityStatus)}. Share of take-home pay left as immediate monthly breathing room after the premium.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {quickEntryCallout}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Quick entry is optional. Add your own monthly numbers here if you want a rough surplus check without doing full planner onboarding.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BonusSection({
  policy,
  analysis,
  useReal,
  eyebrow = 'Bonus support',
  className,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  useReal: boolean
  eyebrow?: string
  className?: string
}) {
  const bonuses = useReal ? analysis.summary.realBonuses : analysis.summary.totalBonusesReceived
  const grossPolicyFees = useReal
    ? (analysis.summary.realWrapperFees + analysis.summary.inceptionCharges)
    : analysis.summary.totalFeesCharged
  const bonusSupport = formatIlpBonusSupport(bonuses, grossPolicyFees)

  return (
    <section className={className ?? 'space-y-4'}>
      <SectionLead
        eyebrow={eyebrow}
        title="How much bonuses may offset"
        summary="Separate bonus support from gross charges so you can see how much of the modeled fee load is being offset, and on what assumptions."
      />
      {analysis.summary.totalBonusesReceived > 0 ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Total bonuses received</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatIlpCurrency(bonuses, policy.currency)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{useReal ? "In today's dollars" : 'Nominal dollars'}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">How much bonuses cover gross policy fees</div>
                <div className="text-2xl font-bold">{bonusSupport.value}</div>
                <div className="text-xs text-muted-foreground">{bonusSupport.detail}</div>
              </div>
            </div>
            <InterpretationCallout
              level="success"
              message="Bonuses may reduce part of the net cost shown here, but they do not replace the gross fee picture. Check the product documents for suspension, clawback, vesting, and payout conditions before treating bonus support as certain."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <InterpretationCallout
              level="warning"
              message="No modeled bonus support appears in this estimate. Fee figures shown here therefore reflect the product charges without any bonus offset that may exist outside the current catalog model."
            />
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function WalkthroughSummarySection({
  policy,
  analysis,
  feeImpact,
  useReal,
  onOpenDetailed,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  feeImpact: ReturnType<typeof useFeeImpact>
  useReal: boolean
  onOpenDetailed: () => void
}) {
  const [showCalculation, setShowCalculation] = useState(false)
  const nominalFundCharges = useMemo(() => {
    const ocf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)
    return analysis.projections.mid.rows.reduce((sum, row) => {
      const openingValue = row.accounts.reduce((subtotal, account) => subtotal + account.open, 0)
      return sum + openingValue * ocf
    }, 0)
  }, [analysis.projections.mid.rows, policy.funds])
  const grossPolicyFees = useReal
    ? (analysis.summary.realWrapperFees + analysis.summary.inceptionCharges)
    : analysis.summary.totalFeesCharged
  const bonuses = useReal ? analysis.summary.realBonuses : analysis.summary.totalBonusesReceived
  const fundCharges = useReal ? analysis.summary.realFundCharges : nominalFundCharges
  const netPolicyFees = grossPolicyFees - bonuses
  const totalEstimatedFees = netPolicyFees + fundCharges

  return (
    <section className="space-y-4">
      <SectionLead
        eyebrow="Start here"
        title="The fee picture"
        summary="Start with the headline figures. This section summarizes the modeled fee load before you open the full chart set."
      />
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border p-4">
              <div className="text-sm text-muted-foreground">Estimated total fees</div>
              <div className="mt-1 text-2xl font-bold">{formatIlpCurrency(totalEstimatedFees, policy.currency)}</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm text-muted-foreground">Net policy fees</div>
              <div className="mt-1 text-2xl font-bold">{formatIlpCurrency(netPolicyFees, policy.currency)}</div>
            </div>
            <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Estimated annual cost on your portfolio</div>
                <div className="mt-1 text-2xl font-bold">{formatIlpPercent(feeImpact.annualDragPct)} p.a.</div>
              </div>
          </div>
          <InterpretationCallout
            level="warning"
            message="Under these assumptions, policy-layer charges account for most of the modeled fee load early on, while fund charges build more gradually in the background over time."
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="default" onClick={() => setShowCalculation((value) => !value)}>
              {showCalculation ? 'Hide estimate build' : 'See how this estimate is built'}
            </Button>
            <Button variant="ghost" onClick={onOpenDetailed}>
              Open detailed view
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {showCalculation && (
            <div className="rounded-md border bg-muted/20 p-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between gap-4">
                  <span>Gross policy fees</span>
                  <span className="tabular-nums">{formatIlpCurrency(grossPolicyFees, policy.currency)}</span>
                </div>
                <div className="flex justify-between gap-4 text-emerald-700 dark:text-emerald-400">
                  <span>Bonuses returned</span>
                  <span className="tabular-nums">-{formatIlpCurrency(bonuses, policy.currency)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Net policy fees</span>
                  <span className="tabular-nums">{formatIlpCurrency(netPolicyFees, policy.currency)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Fund charges</span>
                  <span className="tabular-nums">{formatIlpCurrency(fundCharges, policy.currency)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                  <span>Estimated total fees</span>
                  <span className="tabular-nums">{formatIlpCurrency(totalEstimatedFees, policy.currency)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function WalkthroughExitSection({
  policy,
  analysis,
  useReal,
  onOpenDetailed,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  useReal: boolean
  onOpenDetailed: () => void
}) {
  const [showExitDetails, setShowExitDetails] = useState(false)

  return (
    <section className="space-y-4">
      <SectionLead
        eyebrow="Exit lens"
        title="The early-exit tradeoff"
        summary="Compare the projected value available against the contributions and charges that still sit ahead from this point."
      />
      <DecisionPanel policy={policy} analysis={analysis} />
      <InterpretationCallout
        level="warning"
        message="These path comparisons use the current policy inputs and published rules in the model. Use them to compare projected tradeoffs, then confirm the actual exit values and charges in your policy documents."
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="default" onClick={() => setShowExitDetails((value) => !value)}>
          {showExitDetails ? 'Hide exit details' : 'See exit details'}
        </Button>
        <Button variant="ghost" onClick={onOpenDetailed}>
          Open detailed view
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {showExitDetails && (
        <div className="space-y-4">
          <ExitReinvestmentBenchmarkSection policy={policy} analysis={analysis} />
          <ExitTimingExplorer policy={policy} analysis={analysis} useReal={useReal} />
        </div>
      )}
    </section>
  )
}

function VerificationSection({
  onOpenDetailed,
}: {
  onOpenDetailed: () => void
}) {
  return (
    <section className="space-y-4">
      <SectionLead
        eyebrow="Document check"
        title="What this estimate does not confirm"
        summary="Use the items below as a document check before relying on any modeled figure shown here."
      />
      <Card>
        <CardContent className="space-y-5 p-6">
          <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Check the exact surrender value or exit value on the latest insurer statement.</li>
            <li>Confirm whether bonuses are vested, conditional, or clawed back on exit.</li>
            <li>Verify the actual fund fees on the funds chosen inside the policy.</li>
            <li>Use the current policy illustration or statement to confirm the exact numbers if you need them for a real decision.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onOpenDetailed}>
              Open detailed view
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function WalkthroughCashFlowSection({
  policy,
  quickEntry,
  prefilledFromPlanner,
  onMonthlyIncomeChange,
  onMonthlyExpensesChange,
}: {
  policy: IlpPolicyInput
  quickEntry: CashFlowQuickEntry
  prefilledFromPlanner: boolean
  onMonthlyIncomeChange: (value: number) => void
  onMonthlyExpensesChange: (value: number) => void
}) {
  return (
    <section className="space-y-4">
      <SectionLead
        eyebrow="Cash-flow check"
        title="How this compares against your own cash flow"
        summary="This is separate from the document check. Use it if you want a quick monthly affordability check without opening the full planner."
      />
      <PlannerHandoffCard
        policy={policy}
        quickEntry={quickEntry}
        prefilledFromPlanner={prefilledFromPlanner}
        onMonthlyIncomeChange={onMonthlyIncomeChange}
        onMonthlyExpensesChange={onMonthlyExpensesChange}
      />
    </section>
  )
}

function WalkthroughDetailView({
  policy,
  analysis,
  feeImpact,
  useReal,
  quickEntry,
  prefilledFromPlanner,
  onMonthlyIncomeChange,
  onMonthlyExpensesChange,
  onOpenDetailed,
  onOpenReceipt,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  feeImpact: ReturnType<typeof useFeeImpact>
  useReal: boolean
  quickEntry: CashFlowQuickEntry
  prefilledFromPlanner: boolean
  onMonthlyIncomeChange: (value: number) => void
  onMonthlyExpensesChange: (value: number) => void
  onOpenDetailed: () => void
  onOpenReceipt: () => void
}) {
  return (
    <div className="space-y-10">
      <WalkthroughSummarySection policy={policy} analysis={analysis} feeImpact={feeImpact} useReal={useReal} onOpenDetailed={onOpenDetailed} />
      <BonusSection policy={policy} analysis={analysis} useReal={useReal} className="space-y-4 border-t border-slate-200/80 pt-10" />
      <div className="border-t border-slate-200/80 pt-10">
        <WalkthroughExitSection policy={policy} analysis={analysis} useReal={useReal} onOpenDetailed={onOpenDetailed} />
      </div>
      <div className="border-t border-slate-200/80 pt-10">
        <VerificationSection
          onOpenDetailed={onOpenDetailed}
        />
      </div>
      <div className="border-t border-slate-200/80 pt-10">
        <WalkthroughCashFlowSection
          policy={policy}
          quickEntry={quickEntry}
          prefilledFromPlanner={prefilledFromPlanner}
          onMonthlyIncomeChange={onMonthlyIncomeChange}
          onMonthlyExpensesChange={onMonthlyExpensesChange}
        />
      </div>
      {analysis.summary.totalPremiumsPaid > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="lg" onClick={onOpenReceipt}>
            <Receipt className="mr-2 h-4 w-4" />
            Generate Your ILP Receipt
          </Button>
        </div>
      )}
    </div>
  )
}

function DetailedAnalysisView({
  policy,
  analysis,
  feeImpact,
  useReal,
  onUseRealChange,
  quickEntry,
  prefilledFromPlanner,
  onMonthlyIncomeChange,
  onMonthlyExpensesChange,
  onOpenReceipt,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  feeImpact: ReturnType<typeof useFeeImpact>
  useReal: boolean
  onUseRealChange: (value: boolean) => void
  quickEntry: CashFlowQuickEntry
  prefilledFromPlanner: boolean
  onMonthlyIncomeChange: (value: number) => void
  onMonthlyExpensesChange: (value: number) => void
  onOpenReceipt: () => void
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <SectionLead
          eyebrow="Cash-flow context"
          title="How this fits your own cash flow"
          summary={prefilledFromPlanner
            ? 'These fields start with your saved planner numbers. Adjust them here if you want a quick local affordability check in the same view.'
            : 'Use a quick local entry if you want a rough affordability check in the same view.'}
        />
        <PlannerHandoffCard
          policy={policy}
          quickEntry={quickEntry}
          prefilledFromPlanner={prefilledFromPlanner}
          onMonthlyIncomeChange={onMonthlyIncomeChange}
          onMonthlyExpensesChange={onMonthlyExpensesChange}
        />
      </section>
      <section className="space-y-4 border-t border-slate-200/80 pt-10">
        <SectionLead
          eyebrow="Charge path"
          title="How charges compound over time"
          summary="Read this first if you want the high-level path before opening the detailed fee evidence below."
        />
        <FeeImpactChart
          tiers={feeImpact.tiers}
          timeSeries={feeImpact.timeSeries}
          tierDefs={feeImpact.tierDefs}
          horizonYears={feeImpact.horizonYears}
          currency={policy.currency}
          monthlyContribution={policy.monthlyContribution}
          initialSinglePremium={policy.initialSinglePremium}
          useReal={useReal}
        />
      </section>
      <section className="space-y-4 border-t border-slate-200/80 pt-10">
        <SectionLead
          eyebrow="Evidence table"
          title="Where each fee line shows up"
          summary="Open the charts and table in this section if you want to inspect the annual and cumulative charge build in more detail."
        />
        <FeeBreakdownSection
          policy={policy}
          analysis={analysis}
          useRealValues={useReal}
          onUseRealValuesChange={onUseRealChange}
          showDollarBasisToggle={false}
        />
        {analysis.summary.totalPremiumsPaid > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="lg" onClick={onOpenReceipt}>
              <Receipt className="mr-2 h-4 w-4" />
              Generate Your ILP Receipt
            </Button>
          </div>
        )}
      </section>
      <BonusSection
        policy={policy}
        analysis={analysis}
        useReal={useReal}
        eyebrow="Bonus support"
        className="space-y-4 border-t border-slate-200/80 pt-10"
      />
      <section className="space-y-4 border-t border-slate-200/80 pt-10">
        <SectionLead
          eyebrow="Exit lens"
          title="Projected path comparison"
          summary="Review how projected value available, remaining contributions, out-of-pocket fees, and the benchmark lens change across the modeled path."
        />
        <DecisionPanel policy={policy} analysis={analysis} />
        <ExitReinvestmentBenchmarkSection policy={policy} analysis={analysis} />
        <DiscountedChargeTimelineSection
          policy={policy}
          analysis={analysis}
        />
        <ExitTimingExplorer policy={policy} analysis={analysis} useReal={useReal} />
        <InterpretationCallout
          level="warning"
          message="These path comparisons use the current policy inputs and published rules in the model. Use them to compare projected tradeoffs, then confirm the applicable values in your policy documents."
        />
        <OpportunityCostCard policy={policy} analysis={analysis} />
        <Card>
          <CardContent className="p-6">
          <p className="text-xs text-muted-foreground">
            Illustrative only. These calculations use your current inputs and standardized assumptions. Confirm the applicable values in your policy documents and illustration before relying on them.
          </p>
        </CardContent>
      </Card>
      </section>
      <div className="flex flex-col items-center gap-3 pt-2">
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
    </div>
  )
}

function StoryDetailView({
  policy,
  analysis,
  catalogProduct,
  mode,
  onModeChange,
  onReplayStory,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  catalogProduct: IlpCatalogProduct
  mode: StoryDetailMode
  onModeChange: (mode: StoryDetailMode) => void
  onReplayStory: () => void
}) {
  const [useReal, setUseReal] = useState(false)
  const feeImpact = useFeeImpact(policy, analysis, useReal)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const { revealed: detailChartsRevealed, setRevealed: setDetailChartsRevealed } = useIlpFeesIllustrativeDisclosure()
  const householdPlan = useHouseholdPlanStore((state) => state.plan)
  const householdRuntime = useHouseholdRuntimeInputs()
  const plannerQuickEntry = useMemo(() => derivePlannerCashFlowQuickEntry({
    adults: householdPlan.adults.map((adult) => ({
      id: adult.id,
      annualIncome: adult.annualIncome,
    })),
    annualExpenses: householdRuntime.profile.annualExpenses,
    householdPlanRevision: householdRuntime.householdPlanRevision,
    incomeByAdultId: householdRuntime.normalized.compiledPlan.incomeByAdultId,
  }), [
    householdPlan.adults,
    householdRuntime.householdPlanRevision,
    householdRuntime.normalized.compiledPlan.incomeByAdultId,
    householdRuntime.profile.annualExpenses,
  ])
  const [quickEntry, setQuickEntry] = useState<CashFlowQuickEntry>(() => (
    plannerQuickEntry ?? { monthlyIncome: 0, monthlyExpenses: 0 }
  ))
  const [quickEntryTouched, setQuickEntryTouched] = useState(false)
  // Sync planner store values into local state until user touches the form
  useEffect(() => {
    if (!quickEntryTouched && plannerQuickEntry) {
      setQuickEntry(plannerQuickEntry)
    }
  }, [plannerQuickEntry, quickEntryTouched])
  const receiptFeeBreakdown = useMemo(
    () => buildFeeBreakdown(analysis.projections.mid, policy.funds, policy),
    [analysis, policy],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {catalogProduct.insurer}
            </p>
            <h1 className="text-2xl font-bold">{catalogProduct.productName}</h1>
          </div>
          <div className="space-y-2 lg:min-w-[32rem]">
            <div className="flex flex-wrap items-end justify-end gap-6">
              <div className="space-y-2">
                <div className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dollar basis
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Tabs value={useReal ? 'real' : 'nominal'} onValueChange={(value) => setUseReal(value === 'real')}>
                    <TabsList>
                      <TabsTrigger value="nominal">Nominal</TabsTrigger>
                      <TabsTrigger value="real">Today&apos;s dollars</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-right text-xs text-muted-foreground">
                    Nominal matches most product illustrations. Today&apos;s dollars adjusts for inflation.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  View mode
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-end">
                  <Tabs value={mode} onValueChange={(value) => onModeChange(value as StoryDetailMode)} className="sm:flex-1">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="walkthrough">Walkthrough</TabsTrigger>
                      <TabsTrigger value="detailed">Detailed view</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {analysis.summary.totalPremiumsPaid > 0 && (
                    <Button
                      variant="outline"
                      className="h-10 px-4"
                      onClick={() => setReceiptOpen(true)}
                      aria-label="Generate ILP receipt"
                    >
                      <Receipt className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Generate Receipt</span>
                    </Button>
                  )}
                  <Button variant="outline" onClick={onReplayStory} className="h-10 px-4">
                    <Play className="mr-2 h-4 w-4" />
                    Replay Story
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <GuideNote />
        {mode === 'walkthrough' && (
          <div className="rounded-md border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              You just reviewed the fee story for {catalogProduct.insurer} {catalogProduct.productName}. Below is the same data in a detailed, interactive walkthrough.
            </p>
          </div>
        )}
        <IlpIllustrativeDisclosureBanner
          id="story-detail-illustrative"
          checked={detailChartsRevealed}
          title="Illustrative charts across ILP Fees"
          description="These charts are modeled illustrations, not policy statements. Acknowledge them once here and the whole ILP Fees section will stay unlocked while each chart keeps a visible `Illustrative` label."
          onCheckedChange={setDetailChartsRevealed}
          scopeLabel="ILP Fees"
        />
      </section>

      <IllustrativeChartsGroup revealed={detailChartsRevealed}>
        {mode === 'walkthrough' ? (
          <WalkthroughDetailView
            policy={policy}
            analysis={analysis}
            feeImpact={feeImpact}
            useReal={useReal}
            quickEntry={quickEntry}
            prefilledFromPlanner={plannerQuickEntry != null}
            onMonthlyIncomeChange={(value) => {
              setQuickEntryTouched(true)
              setQuickEntry((current) => ({ ...current, monthlyIncome: value }))
            }}
            onMonthlyExpensesChange={(value) => {
              setQuickEntryTouched(true)
              setQuickEntry((current) => ({ ...current, monthlyExpenses: value }))
            }}
            onOpenDetailed={() => onModeChange('detailed')}
            onOpenReceipt={() => setReceiptOpen(true)}
          />
        ) : (
          <DetailedAnalysisView
            policy={policy}
            analysis={analysis}
            feeImpact={feeImpact}
            useReal={useReal}
            onUseRealChange={setUseReal}
            quickEntry={quickEntry}
            prefilledFromPlanner={plannerQuickEntry != null}
            onMonthlyIncomeChange={(value) => {
              setQuickEntryTouched(true)
              setQuickEntry((current) => ({ ...current, monthlyIncome: value }))
            }}
            onMonthlyExpensesChange={(value) => {
              setQuickEntryTouched(true)
              setQuickEntry((current) => ({ ...current, monthlyExpenses: value }))
            }}
            onOpenReceipt={() => setReceiptOpen(true)}
          />
        )}
      </IllustrativeChartsGroup>

      <ReceiptPreviewModal
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        policy={policy}
        analysis={analysis}
        feeBreakdown={receiptFeeBreakdown}
        includeOcf
        defaultUseReal={useReal}
      />
    </div>
  )
}
