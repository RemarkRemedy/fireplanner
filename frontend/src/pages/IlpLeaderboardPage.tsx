import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePageMeta } from '@/hooks/usePageMeta'
import { analyzeIlpPolicy, type IlpPolicyInput } from '@/lib/calculations/ilp'
import leaderboardData from '@/lib/data/generated/ilpLeaderboard.json'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { cn } from '@/lib/utils'
import { createDefaultPolicy } from '@/stores/useIlpStore'

interface LeaderboardRow {
  productId: string
  insurer: string
  productName: string
  variantId: string
  variantLabel: string
  currency: string
  mipLength: number | null
  mipBasis: string
  premiumType: 'regular' | 'single'
  netFeeDrag: number
  netFeeDragPct: number
  totalPremiumsPaid: number
  totalFeesCharged: number
  totalBonusesReceived: number
  bestExitYear: number
  bonusModellingStatus: 'modelled' | 'metadata-only' | 'none'
}

type SortKey = 'netFeeDragPct' | 'totalFeesCharged' | 'totalBonusesReceived' | 'bestExitYear' | 'mipLength' | 'insurer' | 'productName'
type SortDir = 'asc' | 'desc'
type PremiumSection = 'regular' | 'single'
type RegularBasisMode = 'standardized' | 'custom'

interface SeededLeaderboardRow {
  baseRow: LeaderboardRow
  seed: IlpPolicySeed
}

const rows = leaderboardData as LeaderboardRow[]
const STANDARD_MONTHLY_PREMIUM = 350
const STANDARD_POLICY_YEAR = 1
const STANDARD_MONTHS_PAID = 0
const REGULAR_ROWS = rows.filter((row) => row.premiumType === 'regular')
const SINGLE_ROWS = rows.filter((row) => row.premiumType === 'single')
const INSURER_COUNT = Array.from(new Set(rows.map((row) => row.insurer))).length
const { manifest, products } = getIlpCatalog()

const regularSeedRows: SeededLeaderboardRow[] = REGULAR_ROWS.flatMap((row) => {
  const product = products.find((candidate) => candidate.id === row.productId)
  const variant = product?.variants.find((candidate) => candidate.id === row.variantId)
  if (!product || !variant) {
    return []
  }

  return [{
    baseRow: row,
    seed: templateVariantToPolicySeed(product, variant, manifest),
  }]
})

function seedToPolicy(seed: IlpPolicySeed): IlpPolicyInput {
  const base = createDefaultPolicy()
  return {
    ...base,
    ...seed,
    eecTable: [...(seed.eecTable ?? base.eecTable)],
    funds: (seed.funds ?? base.funds).map((fund) => ({ ...fund })),
    accounts: (seed.accounts ?? base.accounts).map((account) => ({ ...account })),
    bonuses: (seed.bonuses ?? base.bonuses).map((bonus) => ({ ...bonus })),
    chargeRules: (seed.chargeRules ?? base.chargeRules ?? []).map((rule) => ({ ...rule })),
    eventChargeRules: (seed.eventChargeRules ?? base.eventChargeRules ?? []).map((rule) => ({ ...rule })),
    policyEvents: seed.policyEvents?.map((event) => ({ ...event })) ?? [],
  }
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatBonusSupport(row: LeaderboardRow): string {
  if (row.bonusModellingStatus !== 'modelled' || row.totalFeesCharged <= 0 || row.totalBonusesReceived <= 0) {
    return 'n/a'
  }

  return `${Math.round((row.totalBonusesReceived / row.totalFeesCharged) * 100)}%`
}

function SortButton({ field, label, activeKey, onToggle }: {
  field: SortKey
  label: string
  activeKey: SortKey
  onToggle: (key: SortKey) => void
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onToggle(field)}
    >
      {label}
      {activeKey === field && <ArrowUpDown className="h-3 w-3" />}
    </button>
  )
}

export function IlpLeaderboardPage() {
  usePageMeta({
    title: 'ILP Product Comparison: SG FIRE Planner',
    description: 'Compare fee drag across 92 Singapore ILP products.',
    path: '/ilp-fees/compare',
  })

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('netFeeDragPct')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [activePremiumSection, setActivePremiumSection] = useState<PremiumSection>('regular')
  const [regularBasisMode, setRegularBasisMode] = useState<RegularBasisMode>('standardized')
  const [customMonthlyPremiumInput, setCustomMonthlyPremiumInput] = useState(String(STANDARD_MONTHLY_PREMIUM))
  const [confirmedPremium, setConfirmedPremium] = useState<number | null>(null)
  const [filterInsurer, setFilterInsurer] = useState<string | null>(null)

  const parsedInput = useMemo(() => {
    const parsed = Number(customMonthlyPremiumInput)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [customMonthlyPremiumInput])

  const customMonthlyPremium = confirmedPremium
  const inputDirty = parsedInput !== confirmedPremium

  const customRegularRows = useMemo(() => {
    if (regularBasisMode !== 'custom' || customMonthlyPremium == null) {
      return REGULAR_ROWS
    }

    return regularSeedRows.map(({ baseRow, seed }) => {
      const policy = seedToPolicy({
        ...seed,
        monthlyContribution: customMonthlyPremium,
        currentPolicyYear: STANDARD_POLICY_YEAR,
        monthsAlreadyPaid: STANDARD_MONTHS_PAID,
      })
      const analysis = analyzeIlpPolicy(policy)
      const { summary } = analysis

      return {
        ...baseRow,
        netFeeDrag: summary.netFeeDrag,
        netFeeDragPct: summary.totalPremiumsPaid > 0
          ? summary.netFeeDrag / summary.totalPremiumsPaid
          : 0,
        totalPremiumsPaid: summary.totalPremiumsPaid,
        totalFeesCharged: summary.totalFeesCharged,
        totalBonusesReceived: summary.totalBonusesReceived,
        bestExitYear: analysis.npvAnalysis.bestExitYear,
      }
    })
  }, [customMonthlyPremium, regularBasisMode])

  const sectionRows = useMemo(() => {
    if (activePremiumSection === 'single') {
      return SINGLE_ROWS
    }

    return regularBasisMode === 'custom' ? customRegularRows : REGULAR_ROWS
  }, [activePremiumSection, customRegularRows, regularBasisMode])

  const insurers = useMemo(() => {
    const set = new Set(sectionRows.map((row) => row.insurer))
    return Array.from(set).sort()
  }, [sectionRows])

  function handleToggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = sectionRows

    if (search) {
      const query = search.toLowerCase()
      result = result.filter((row) => (
        row.productName.toLowerCase().includes(query)
        || row.insurer.toLowerCase().includes(query)
        || row.variantLabel.toLowerCase().includes(query)
      ))
    }

    if (filterInsurer) {
      result = result.filter((row) => row.insurer === filterInsurer)
    }

    return [...result].sort((left, right) => {
      const leftValue = left[sortKey]
      const rightValue = right[sortKey]
      if (leftValue == null && rightValue == null) return 0
      if (leftValue == null) return 1
      if (rightValue == null) return -1

      const comparison = typeof leftValue === 'string'
        ? leftValue.localeCompare(rightValue as string)
        : (leftValue as number) - (rightValue as number)

      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [filterInsurer, search, sectionRows, sortDir, sortKey])

  const summary = useMemo(() => {
    if (filtered.length === 0) {
      return null
    }

    const lowestFeeRow = filtered.reduce((best, row) => (row.netFeeDragPct < best.netFeeDragPct ? row : best), filtered[0])
    const highestFeeRow = filtered.reduce((worst, row) => (row.netFeeDragPct > worst.netFeeDragPct ? row : worst), filtered[0])
    const strongestBonusRow = filtered
      .filter((row) => row.bonusModellingStatus === 'modelled' && row.totalBonusesReceived > 0 && row.totalFeesCharged > 0)
      .sort((left, right) => (right.totalBonusesReceived / right.totalFeesCharged) - (left.totalBonusesReceived / left.totalFeesCharged))[0] ?? null

    return { highestFeeRow, lowestFeeRow, strongestBonusRow }
  }, [filtered])

  const regularMethodNote = regularBasisMode === 'custom'
    ? `Regular-premium rows use your custom ${customMonthlyPremium != null ? formatNumber(customMonthlyPremium) : 'custom'} per-month amount in each product's policy currency, policy year 1, 0 months paid, the mid return scenario, and the full horizon basis.`
    : 'Regular-premium rows use the standardized 350/month basis in each product\'s policy currency, policy year 1, 0 months paid, the mid return scenario, and the full horizon basis.'

  return (
    <div className="space-y-6 text-foreground">
      <section className="rounded-lg border border-border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)] lg:items-end">
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ranked fee report</div>
            <div className="space-y-2">
              <h1 className="font-sans text-3xl leading-tight sm:text-4xl">ILP Product Comparison</h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Compare modelled net fees as a share of premiums paid across {rows.length} product variants from {INSURER_COUNT} insurers.
                Regular-premium and single-premium products are separated so they are not ranked on the same table.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How to read this table</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Rank is based on the active sort, not a hidden score.</li>
              <li>Gross fees and bonuses are shown separately so credits do not hide fee load.</li>
              <li>Use the story view when you want the year-by-year fee path for a specific variant.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-border/70 pt-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Premium basis</div>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep regular-pay and single-premium products in separate ranked sections. Regular-premium rows can be compared on a standardized basis or reranked using your own monthly premium.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Single-premium products stay standardized because a lump-sum basis needs a separate comparison input.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[24rem] xl:items-end">
            <Tabs value={activePremiumSection} onValueChange={(value) => {
              setActivePremiumSection(value as PremiumSection)
              setFilterInsurer(null)
            }}>
              <TabsList className="h-10 border-border bg-muted p-1">
                <TabsTrigger value="regular" className="min-w-[11rem] px-5 py-1.5">
                  Regular premium
                </TabsTrigger>
                <TabsTrigger value="single" className="min-w-[11rem] px-5 py-1.5">
                  Single premium
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activePremiumSection === 'regular' ? (
              <div className="w-full space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comparison basis</div>
                <Tabs value={regularBasisMode} onValueChange={(value) => setRegularBasisMode(value as RegularBasisMode)}>
                  <TabsList className="grid h-10 w-full grid-cols-2 border-border bg-muted p-1">
                    <TabsTrigger value="standardized" className="px-3 py-1.5">
                      Standardized
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="px-3 py-1.5">
                      Custom
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {regularBasisMode === 'custom' ? (
                  <div className="space-y-2">
                    <label htmlFor="leaderboard-monthly-premium" className="text-sm font-medium text-foreground">
                      Monthly premium
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="leaderboard-monthly-premium"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="1"
                        value={customMonthlyPremiumInput}
                        onChange={(event) => setCustomMonthlyPremiumInput(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter' && parsedInput != null) setConfirmedPremium(parsedInput) }}
                        className="h-10 border-border bg-card text-foreground"
                      />
                      <Button
                        onClick={() => { if (parsedInput != null) setConfirmedPremium(parsedInput) }}
                        disabled={parsedInput == null || !inputDirty}
                        className="h-10 shrink-0"
                      >
                        {confirmedPremium == null ? 'Apply' : 'Rerank'}
                      </Button>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      This reranks regular-premium products only. The same numeric premium is applied in each product&apos;s own policy currency.
                    </p>
                    {parsedInput == null && (
                      <p className="text-sm leading-6 text-rose-700 dark:text-rose-400">Enter a monthly premium above 0 to rerank this section.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Standardized mode uses 350/month in each product&apos;s policy currency, policy year 1, 0 months paid, the mid return scenario, and the full modelled horizon.
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full rounded-lg border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                Single-premium products stay standardized here. Use the story view if you want to test a specific lump-sum amount for one product.
              </div>
            )}
          </div>
        </div>
      </section>

      {summary && (
        <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-card p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filtered set</div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{filtered.length}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {activePremiumSection === 'regular' ? 'Regular-premium' : 'Single-premium'} variants currently in view after search and insurer filters.
            </p>
          </div>
          <div className="bg-card p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Lowest fee drag</div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">{formatPercent(summary.lowestFeeRow.netFeeDragPct)}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {summary.lowestFeeRow.productName} · {summary.lowestFeeRow.variantLabel}
            </p>
          </div>
          <div className="bg-card p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-400">Highest fee drag</div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">{formatPercent(summary.highestFeeRow.netFeeDragPct)}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {summary.highestFeeRow.productName} · {summary.highestFeeRow.variantLabel}
            </p>
          </div>
          <div className="bg-card p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-primary">Strongest bonus support</div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">
              {summary.strongestBonusRow ? formatBonusSupport(summary.strongestBonusRow) : 'n/a'}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {summary.strongestBonusRow
                ? `${summary.strongestBonusRow.productName} · ${summary.strongestBonusRow.variantLabel}`
                : 'No filtered product currently has modelled bonus support.'}
            </p>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filters</div>
            <p className="text-sm leading-6 text-muted-foreground">
              Narrow the active ranked table by insurer or product name. Active sort decides the row rank inside this premium section.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{filtered.length} results</div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.9fr)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search insurer, product, or variant"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <select
            className="h-10 border border-border bg-card px-3 text-sm text-foreground"
            value={filterInsurer ?? ''}
            onChange={(event) => setFilterInsurer(event.target.value || null)}
          >
            <option value="">All insurers</option>
            {insurers.map((insurer) => (
              <option key={insurer} value={insurer}>{insurer}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scoreboard</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            `Net Fees / Premiums` stays the default sort because it is the clearest cross-product basis for comparison.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-foreground">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rank</th>
                <th className="px-3 py-3 text-left">
                  <SortButton field="insurer" label="Insurer" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-left">
                  <SortButton field="productName" label="Product" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortButton field="mipLength" label="MIP" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortButton field="netFeeDragPct" label="Net Fees / Premiums" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortButton field="totalFeesCharged" label="Gross Fees" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortButton field="totalBonusesReceived" label="Bonuses" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortButton field="bestExitYear" label="Lowest-Fee Exit Yr" activeKey={sortKey} onToggle={handleToggleSort} />
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={`${row.productId}-${row.variantId}`}
                  className={cn(
                    'border-b border-border/70 last:border-0 hover:bg-muted/15',
                    index < 3 && 'bg-background',
                  )}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-sm font-semibold tabular-nums text-foreground">{index + 1}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-muted-foreground">{row.insurer}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-foreground">{row.productName}</div>
                    <div className="text-xs text-muted-foreground">{row.variantLabel}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top text-foreground">
                    {row.mipBasis === 'open-ended' ? 'Open' : row.mipLength != null ? `${row.mipLength} yr` : 'N/A'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top font-semibold text-foreground">
                    {formatPercent(row.netFeeDragPct)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top text-rose-700 dark:text-rose-400">
                    {formatCurrency(row.totalFeesCharged, row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top">
                    {row.bonusModellingStatus === 'metadata-only' ? (
                      <span className="text-amber-700 dark:text-amber-400" title="Bonus data unavailable">*</span>
                    ) : row.totalBonusesReceived > 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(row.totalBonusesReceived, row.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top text-foreground">{row.bestExitYear}</td>
                  <td className="px-3 py-3 text-center align-top">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]',
                        row.premiumType === 'single'
                          ? 'border-border bg-muted/40 text-foreground'
                          : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      {row.premiumType === 'single' ? 'Single' : 'Regular'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center align-top">
                    <Link to={`/ilp-fees/story/${row.productId}?variantId=${encodeURIComponent(row.variantId)}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-primary hover:bg-muted/50 hover:text-foreground">
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-muted/30 p-4 sm:p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Method notes</div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <p>* Products marked with * do not have bonus modelling. Their net fee drag may be overstated.</p>
          <p>`Net Fees / Premiums` is total net fees divided by total premiums paid over the full modelled horizon. It is not an annualized drag rate.</p>
          <p>
            {activePremiumSection === 'regular'
              ? regularMethodNote
              : 'Single-premium rows use the catalog default single-premium setup, policy year 1, 0 months paid, the mid return scenario, and the full horizon basis. Custom premium mode is unavailable in this section.'}
            {' '}
            Your personal numbers may differ. Use the story or exit calculator for personalized analysis.
          </p>
          <p>Not financial advice. Consult a licensed financial adviser before making policy decisions.</p>
        </div>
      </section>
    </div>
  )
}
