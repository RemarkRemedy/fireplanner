import { useDeferredValue, useMemo, useState } from 'react'
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
      className="flex items-center gap-1 text-left font-medium text-[#5f6877] hover:text-[#0f1724]"
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
  const [filterInsurer, setFilterInsurer] = useState<string | null>(null)
  const deferredCustomMonthlyPremiumInput = useDeferredValue(customMonthlyPremiumInput)

  const customMonthlyPremium = useMemo(() => {
    const parsed = Number(deferredCustomMonthlyPremiumInput)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [deferredCustomMonthlyPremiumInput])

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
    <div className="space-y-6 text-[#0f1724]">
      <section className="rounded-[28px] border border-[#d9e4f2] bg-white px-5 py-5 shadow-[0_1px_0_rgba(15,23,36,0.04)] sm:px-7 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)] lg:items-end">
          <div className="space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Ranked fee report</div>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl">ILP Product Comparison</h1>
              <p className="max-w-3xl text-sm leading-6 text-[#5f6877] sm:text-base">
                Compare modelled net fees as a share of premiums paid across {rows.length} product variants from {INSURER_COUNT} insurers.
                Regular-premium and single-premium products are separated so they are not ranked on the same table.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#d9e4f2] bg-[#f7faff] p-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">How to read this table</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#5f6877]">
              <li>Rank is based on the active sort, not a hidden score.</li>
              <li>Gross fees and bonuses are shown separately so credits do not hide fee load.</li>
              <li>Use the story view when you want the year-by-year fee path for a specific variant.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-[#e8eef7] pt-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Premium basis</div>
            <p className="text-sm leading-6 text-[#5f6877]">
              Keep regular-pay and single-premium products in separate ranked sections. Regular-premium rows can be compared on a standardized basis or reranked using your own monthly premium.
            </p>
            <p className="text-sm leading-6 text-[#5f6877]">
              Single-premium products stay standardized because a lump-sum basis needs a separate comparison input.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[24rem] xl:items-end">
            <Tabs value={activePremiumSection} onValueChange={(value) => {
              setActivePremiumSection(value as PremiumSection)
              setFilterInsurer(null)
            }}>
              <TabsList className="h-12 rounded-2xl border-[#d9e4f2] bg-[#f3f7fd] p-1">
                <TabsTrigger value="regular" className="min-w-[11rem] rounded-xl px-5 py-2.5">
                  Regular premium
                </TabsTrigger>
                <TabsTrigger value="single" className="min-w-[11rem] rounded-xl px-5 py-2.5">
                  Single premium
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activePremiumSection === 'regular' ? (
              <div className="w-full space-y-3 rounded-2xl border border-[#d9e4f2] bg-[#f7faff] p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Comparison basis</div>
                <Tabs value={regularBasisMode} onValueChange={(value) => setRegularBasisMode(value as RegularBasisMode)}>
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl border-[#d9e4f2] bg-white p-1">
                    <TabsTrigger value="standardized" className="rounded-xl px-4 py-2">
                      Standardized
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="rounded-xl px-4 py-2">
                      Custom
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {regularBasisMode === 'custom' ? (
                  <div className="space-y-2">
                    <label htmlFor="leaderboard-monthly-premium" className="text-sm font-medium text-[#0f1724]">
                      Monthly premium
                    </label>
                    <Input
                      id="leaderboard-monthly-premium"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      value={customMonthlyPremiumInput}
                      onChange={(event) => setCustomMonthlyPremiumInput(event.target.value)}
                      className="h-11 border-[#d9e4f2] bg-white text-[#0f1724]"
                    />
                    <p className="text-sm leading-6 text-[#5f6877]">
                      This reranks regular-premium products only. The same numeric premium is applied in each product&apos;s own policy currency.
                    </p>
                    {customMonthlyPremium == null && (
                      <p className="text-sm leading-6 text-[#b24a2f]">Enter a monthly premium above 0 to rerank this section.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[#5f6877]">
                    Standardized mode uses 350/month in each product&apos;s policy currency, policy year 1, 0 months paid, the mid return scenario, and the full modelled horizon.
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full rounded-2xl border border-[#d9e4f2] bg-[#f7faff] p-4 text-sm leading-6 text-[#5f6877]">
                Single-premium products stay standardized here. Use the story view if you want to test a specific lump-sum amount for one product.
              </div>
            )}
          </div>
        </div>
      </section>

      {summary && (
        <section className="grid gap-px overflow-hidden rounded-[28px] border border-[#d9e4f2] bg-[#d9e4f2] md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white p-4 sm:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Filtered set</div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{filtered.length}</div>
            <p className="mt-2 text-sm leading-6 text-[#5f6877]">
              {activePremiumSection === 'regular' ? 'Regular-premium' : 'Single-premium'} variants currently in view after search and insurer filters.
            </p>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22624a]">Lowest fee drag</div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">{formatPercent(summary.lowestFeeRow.netFeeDragPct)}</div>
            <p className="mt-2 text-sm leading-6 text-[#5f6877]">
              {summary.lowestFeeRow.productName} · {summary.lowestFeeRow.variantLabel}
            </p>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#b24a2f]">Highest fee drag</div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">{formatPercent(summary.highestFeeRow.netFeeDragPct)}</div>
            <p className="mt-2 text-sm leading-6 text-[#5f6877]">
              {summary.highestFeeRow.productName} · {summary.highestFeeRow.variantLabel}
            </p>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#174a7c]">Strongest bonus support</div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">
              {summary.strongestBonusRow ? formatBonusSupport(summary.strongestBonusRow) : 'n/a'}
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5f6877]">
              {summary.strongestBonusRow
                ? `${summary.strongestBonusRow.productName} · ${summary.strongestBonusRow.variantLabel}`
                : 'No filtered product currently has modelled bonus support.'}
            </p>
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-[#d9e4f2] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Filters</div>
            <p className="text-sm leading-6 text-[#5f6877]">
              Narrow the active ranked table by insurer or product name. Active sort decides the row rank inside this premium section.
            </p>
          </div>
          <div className="text-sm text-[#5f6877]">{filtered.length} results</div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.9fr)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6877]" />
            <Input
              placeholder="Search insurer, product, or variant"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 border-[#d9e4f2] bg-white pl-9 text-[#0f1724] placeholder:text-[#7b8491]"
            />
          </div>
          <select
            className="h-11 rounded-xl border border-[#d9e4f2] bg-white px-3 text-sm text-[#0f1724]"
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

      <section className="overflow-hidden rounded-[28px] border border-[#d9e4f2] bg-white shadow-[0_1px_0_rgba(15,23,36,0.04)]">
        <div className="border-b border-[#d9e4f2] px-4 py-3 sm:px-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Scoreboard</div>
          <p className="mt-2 text-sm leading-6 text-[#5f6877]">
            `Net Fees / Premiums` stays the default sort because it is the clearest cross-product basis for comparison.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="border-b border-[#d9e4f2] bg-[#f7faff]">
              <tr className="text-[#0f1724]">
                <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Rank</th>
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
                <th className="px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Type</th>
                <th className="px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={`${row.productId}-${row.variantId}`}
                  className={cn(
                    'border-b border-[#e8eef7] last:border-0 hover:bg-[#f8fbff]',
                    index < 3 && 'bg-[#fbfdff]',
                  )}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-sm font-semibold tabular-nums text-[#0f1724]">{index + 1}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-[#5f6877]">{row.insurer}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-[#0f1724]">{row.productName}</div>
                    <div className="text-xs text-[#5f6877]">{row.variantLabel}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top text-[#0f1724]">
                    {row.mipBasis === 'open-ended' ? 'Open' : row.mipLength != null ? `${row.mipLength} yr` : 'N/A'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top font-semibold text-[#0f1724]">
                    {formatPercent(row.netFeeDragPct)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top text-[#b24a2f]">
                    {formatCurrency(row.totalFeesCharged, row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top">
                    {row.bonusModellingStatus === 'metadata-only' ? (
                      <span className="text-[#8a6a18]" title="Bonus data unavailable">*</span>
                    ) : row.totalBonusesReceived > 0 ? (
                      <span className="text-[#22624a]">
                        {formatCurrency(row.totalBonusesReceived, row.currency)}
                      </span>
                    ) : (
                      <span className="text-[#5f6877]">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums align-top text-[#0f1724]">{row.bestExitYear}</td>
                  <td className="px-3 py-3 text-center align-top">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]',
                        row.premiumType === 'single'
                          ? 'border-[#d9e4f2] bg-[#eef4fb] text-[#0f1724]'
                          : 'border-[#d9e4f2] bg-white text-[#5f6877]',
                      )}
                    >
                      {row.premiumType === 'single' ? 'Single' : 'Regular'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center align-top">
                    <Link to={`/ilp-fees/story/${row.productId}?variantId=${encodeURIComponent(row.variantId)}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-[#174a7c] hover:bg-[#dce6f2] hover:text-[#0f1724]">
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[#5f6877]">
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d9e4f2] bg-[#f7faff] p-4 sm:p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Method notes</div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-[#5f6877]">
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
