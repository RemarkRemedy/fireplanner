import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, Info, Search } from 'lucide-react'
import { IlpSubfundDetailSheet } from '@/components/ilp/IlpSubfundDetailSheet'
import { normalizeDate, sourceHref } from '@/components/ilp/ilpDetailUtils'
import type { IlpMasterData, IlpMasterRow, ReturnStats, ReturnWindowSlug } from '@/components/ilp/types'
import { RETURN_WINDOWS } from '@/components/ilp/types'

type Props = {
  data: IlpMasterData
}

type CohortMode = 'recent_reports' | 'all' | string

function normalizeAsOfDate(value?: string | null): string {
  const normalized = normalizeDate(value)
  return normalized === 'Not stated' ? '' : normalized
}

function parseDateLabel(value: string): number {
  const match = value.match(/^(\d{1,2})\s([A-Za-z]+)\s(\d{4})$/)
  if (!match) return Number.NEGATIVE_INFINITY
  const monthMap: Record<string, number> = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  }
  const monthIndex = monthMap[match[2]]
  if (monthIndex == null) return Number.NEGATIVE_INFINITY
  return Date.UTC(Number(match[3]), monthIndex, Number(match[1]))
}

function compareNullable(left: number | null | undefined, right: number | null | undefined, direction: 'asc' | 'desc') {
  const leftValid = Number.isFinite(left)
  const rightValid = Number.isFinite(right)
  if (leftValid && rightValid) {
    return direction === 'asc'
      ? (left as number) - (right as number)
      : (right as number) - (left as number)
  }
  if (leftValid) return -1
  if (rightValid) return 1
  return 0
}

function getReturnStats(row: IlpMasterRow, activeWindow: ReturnWindowSlug): ReturnStats {
  const stats = row.returns?.windows?.[activeWindow]
  if (stats) return stats
  return {
    label: RETURN_WINDOWS.find((item) => item.slug === activeWindow)?.label ?? 'Return',
    fundDisplay: '',
    fundPct: null,
    benchmarkDisplay: '',
    benchmarkPct: null,
    gapDisplay: '',
    gapPct: null,
    hasData: false,
  }
}

export function IlpReturnsDashboard({ data }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const comparisonRows = useMemo(
    () => data.rows.filter((row) => row.returns?.hasComparisonData),
    [data.rows],
  )
  const insurers = useMemo(() => Array.from(new Set(comparisonRows.map((row) => row.insurer))).sort(), [comparisonRows])
  const asOfDates = useMemo(
    () => Array.from(
      new Set(
        comparisonRows
          .map((row) => normalizeAsOfDate(row.returns?.asOfDate))
          .filter(Boolean),
      ),
    ).sort((left, right) => parseDateLabel(right) - parseDateLabel(left)),
    [comparisonRows],
  )
  const recentReportDates = useMemo(() => asOfDates.slice(0, 3), [asOfDates])
  const recentReportSet = useMemo(() => new Set(recentReportDates), [recentReportDates])
  const recentReportCount = useMemo(
    () => comparisonRows.filter((row) => recentReportSet.has(normalizeAsOfDate(row.returns?.asOfDate))).length,
    [comparisonRows, recentReportSet],
  )
  const returnComparisonRowCount = data.coverage.returnComparisonRows ?? comparisonRows.length

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [insurer, setInsurer] = useState('all')
  const [asOfDate, setAsOfDate] = useState<CohortMode>('recent_reports')
  const [returnWindow, setReturnWindow] = useState<ReturnWindowSlug>('since_inception')
  const [sort, setSort] = useState<'gap-desc' | 'gap-asc' | 'fund-desc' | 'fund-asc' | 'alpha'>('gap-desc')
  const [quickFilter, setQuickFilter] = useState<'all' | 'outperform' | 'proxy' | 'low-fee'>('all')
  const selectedFundId = searchParams.get('fund')
  const selectedRow = useMemo(
    () => comparisonRows.find((row) => row.id === selectedFundId) ?? null,
    [comparisonRows, selectedFundId],
  )

  useEffect(() => {
    if (selectedFundId && !comparisonRows.some((row) => row.id === selectedFundId)) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('fund')
      setSearchParams(nextParams, { replace: true })
    }
  }, [comparisonRows, searchParams, selectedFundId, setSearchParams])

  const visibleRows = useMemo(() => comparisonRows
    .filter((row) => {
      const query = deferredSearch.trim().toLowerCase()
      const stats = getReturnStats(row, returnWindow)
      const rowAsOf = normalizeAsOfDate(row.returns?.asOfDate)

      if (insurer !== 'all' && row.insurer !== insurer) return false
      if (asOfDate === 'recent_reports' && !recentReportSet.has(rowAsOf)) return false
      if (asOfDate !== 'all' && asOfDate !== 'recent_reports' && rowAsOf !== asOfDate) return false
      if (quickFilter === 'outperform' && (stats.gapPct ?? Number.NEGATIVE_INFINITY) < 0) return false
      if (quickFilter === 'proxy' && !row.etfProxy) return false
      if (quickFilter === 'low-fee' && ((row.annualFeePct ?? Number.POSITIVE_INFINITY) > 1)) return false

      if (!query) return true
      const haystack = [
        row.insurer,
        row.subFund,
        row.benchmark ?? '',
        row.etfProxy ?? '',
        row.returns?.fundFamily ?? '',
        row.returns?.shareClassOrCurrency ?? '',
        rowAsOf,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .sort((left, right) => {
      const leftStats = getReturnStats(left, returnWindow)
      const rightStats = getReturnStats(right, returnWindow)
      if (sort === 'gap-asc') return compareNullable(leftStats.gapPct, rightStats.gapPct, 'asc')
      if (sort === 'fund-desc') return compareNullable(leftStats.fundPct, rightStats.fundPct, 'desc')
      if (sort === 'fund-asc') return compareNullable(leftStats.fundPct, rightStats.fundPct, 'asc')
      if (sort === 'alpha') return left.subFund.localeCompare(right.subFund)
      return compareNullable(leftStats.gapPct, rightStats.gapPct, 'desc')
    }),
  [asOfDate, comparisonRows, deferredSearch, insurer, quickFilter, recentReportSet, returnWindow, sort])

  const currentWindowLabel = useMemo(
    () => RETURN_WINDOWS.find((item) => item.slug === returnWindow)?.label ?? 'Since inception',
    [returnWindow],
  )
  const asOfSummary = useMemo(
    () => (asOfDate === 'recent_reports'
      ? `Recent reports cohort: ${recentReportDates.join(', ')}`
      : asOfDate === 'all'
        ? `Mixed dates: ${asOfDates.join(', ')}`
        : `As of: ${asOfDate}`),
    [asOfDate, asOfDates, recentReportDates],
  )
  const openRow = (row: IlpMasterRow) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('fund', row.id)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            ILP returns dashboard
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Compare ILP sub-funds against their stated benchmark
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            This page focuses on the return-versus-benchmark layer. The default view stays inside a recent reporting cohort so the ranking is more defensible than a fully mixed-date leaderboard.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Coverage
          </div>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-baseline justify-between gap-4">
              <span>Rows with return comparison</span>
              <strong className="text-xl text-foreground">{returnComparisonRowCount}</strong>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span>Current default cohort</span>
              <strong className="text-lg text-foreground">{recentReportCount}</strong>
            </div>
            <p className="leading-6">
              Total roster in the shared ILP master dataset: <strong className="text-foreground">{data.coverage.rowCount}</strong>. This page only screens rows with a source-citable benchmark comparison.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. AIA, Global Bond, S&P 500"
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
            />
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Insurer</span>
          <select value={insurer} onChange={(event) => setInsurer(event.target.value)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="all">All insurers</option>
            {insurers.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">As of date</span>
          <select value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="recent_reports">Recent reports cohort</option>
            <option value="all">Mixed dates (research mode)</option>
            {asOfDates.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Return window</span>
          <select value={returnWindow} onChange={(event) => setReturnWindow(event.target.value as ReturnWindowSlug)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            {RETURN_WINDOWS.map((item) => (
              <option key={item.slug} value={item.slug}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="gap-desc">Highest return gap</option>
            <option value="gap-asc">Lowest return gap</option>
            <option value="fund-desc">Highest fund return</option>
            <option value="fund-asc">Lowest fund return</option>
            <option value="alpha">A to Z</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'All rows'],
          ['outperform', 'Beating benchmark'],
          ['proxy', 'Has ETF proxy'],
          ['low-fee', 'Fee at or below 1.00%'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setQuickFilter(value as typeof quickFilter)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              quickFilter === value
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'bg-background text-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{visibleRows.length}</strong> rows</span>
        <span>Window: {currentWindowLabel}</span>
        <span>{asOfSummary}</span>
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="leading-6">
            Returns are only directly comparable within the same as-of date. The default cohort groups the latest published report dates in the dataset, but exact-date slices are still more rigorous.
          </p>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-sm lg:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-4 py-3">Sub-fund</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Benchmark</th>
              <th className="px-4 py-3">Fund</th>
              <th className="px-4 py-3">Benchmark</th>
              <th className="px-4 py-3">Gap</th>
              <th className="px-4 py-3">As of</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            )}
            {visibleRows.map((row) => {
              const stats = getReturnStats(row, returnWindow)
              const gapPositive = (stats.gapPct ?? Number.NEGATIVE_INFINITY) >= 0
              return (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openRow(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openRow(row)
                    }
                  }}
                  className="cursor-pointer border-b align-top transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <td className="px-4 py-4">
                    <div className="font-medium text-foreground">{row.subFund}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.insurer} • {row.returns?.shareClassOrCurrency || 'SGD'}
                    </div>
                    <button
                      type="button"
                      onClick={() => openRow(row)}
                      className="mt-2 text-xs font-medium text-foreground underline underline-offset-2"
                    >
                      Open details
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-foreground">{row.annualFeeDisplay || 'N/A'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.annualFeeLabel || 'Fee metric'}</div>
                  </td>
                  <td className="max-w-[22rem] px-4 py-4">
                    <div className="line-clamp-4 leading-6 text-foreground">{row.benchmark || 'Not stated'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.etfProxy || 'No ETF proxy mapped'}</div>
                  </td>
                  <td className="px-4 py-4 text-foreground">{stats.fundDisplay || 'N/A'}</td>
                  <td className="px-4 py-4 text-foreground">{stats.benchmarkDisplay || 'N/A'}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      stats.gapPct == null
                        ? 'bg-muted text-muted-foreground'
                        : gapPositive
                          ? 'bg-emerald-500/12 text-emerald-700'
                          : 'bg-orange-500/12 text-orange-700'
                    }`}>
                      {stats.gapDisplay || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-foreground">{normalizeAsOfDate(row.returns?.asOfDate) || 'N/A'}</td>
                  <td className="px-4 py-4">
                    <a
                      href={sourceHref(row.insurer, row.returns?.returnSourceUrl, row.returns?.returnSourcePage)}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 text-foreground underline underline-offset-2"
                    >
                      {row.returns?.returnSourcePage ? `Return p. ${row.returns.returnSourcePage}` : 'Source'}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {visibleRows.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
            No rows match the current filters.
          </div>
        )}
        {visibleRows.map((row) => {
          const stats = getReturnStats(row, returnWindow)
          const gapPositive = (stats.gapPct ?? Number.NEGATIVE_INFINITY) >= 0
          return (
            <article
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => openRow(row)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openRow(row)
                }
              }}
              className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{row.subFund}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.insurer} • {row.returns?.shareClassOrCurrency || 'SGD'}
                  </p>
                  <button
                    type="button"
                    onClick={() => openRow(row)}
                    className="mt-2 text-xs font-medium text-foreground underline underline-offset-2"
                  >
                    Open details
                  </button>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  stats.gapPct == null
                    ? 'bg-muted text-muted-foreground'
                    : gapPositive
                      ? 'bg-emerald-500/12 text-emerald-700'
                      : 'bg-orange-500/12 text-orange-700'
                }`}>
                  {stats.gapDisplay || 'N/A'}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Fee</dt>
                  <dd className="mt-1 text-foreground">{row.annualFeeDisplay || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">As of</dt>
                  <dd className="mt-1 text-foreground">{normalizeAsOfDate(row.returns?.asOfDate) || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Fund</dt>
                  <dd className="mt-1 text-foreground">{stats.fundDisplay || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Benchmark</dt>
                  <dd className="mt-1 text-foreground">{stats.benchmarkDisplay || 'N/A'}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Benchmark</div>
                <div className="mt-1 text-sm leading-6 text-foreground">{row.benchmark || 'Not stated'}</div>
                <div className="mt-1 text-xs text-muted-foreground">{row.etfProxy || 'No ETF proxy mapped'}</div>
              </div>

              <a
                href={sourceHref(row.insurer, row.returns?.returnSourceUrl, row.returns?.returnSourcePage)}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => event.stopPropagation()}
                className="mt-4 inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-2"
              >
                {row.returns?.returnSourcePage ? `Open source (p. ${row.returns.returnSourcePage})` : 'Open source'}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </article>
          )
        })}
      </div>

      <IlpSubfundDetailSheet
        row={selectedRow}
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) {
            const nextParams = new URLSearchParams(searchParams)
            nextParams.delete('fund')
            setSearchParams(nextParams, { replace: true })
          }
        }}
      />
    </div>
  )
}
