import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Info, Search } from 'lucide-react'
import { IlpSubfundDetailSheet } from '@/components/ilp/IlpSubfundDetailSheet'
import { normalizeDate, sourceHref, structureLabel } from '@/components/ilp/ilpDetailUtils'
import type { IlpMasterData, IlpMasterRow } from '@/components/ilp/types'

type Props = {
  data: IlpMasterData
}

type QuickFilter = 'all' | 'low-fee' | 'proxy' | 'manager'
type SortMode = 'fee-asc' | 'fee-desc' | 'alpha' | 'insurer'

type FeeRow = {
  id: string
  raw: IlpMasterRow
  insurer: string
  subFund: string
  annualFeeLabel: string
  annualFeeDisplay: string
  annualFeePct: number | null
  feeAsOfDate: string
  benchmark: string
  etfProxy: string
  structureType: string
  structureLabel: string
  externalManager: string
  sourceUrl: string
  sourcePage: number | null
  sourceNote: string
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

export function IlpOcfDashboard({ data }: Props) {
  const verifiedRows = useMemo<FeeRow[]>(
    () =>
      data.rows
        .filter((row) => row.annualFeePct != null && row.feeVerificationStatus === 'verified_exact')
        .map((row) => ({
          id: row.id,
          raw: row,
          insurer: row.insurer,
          subFund: row.subFund,
          annualFeeLabel: row.annualFeeLabel || row.feeMetric || 'Fee metric',
          annualFeeDisplay: row.annualFeeDisplay || 'N/A',
          annualFeePct: typeof row.annualFeePct === 'number' ? row.annualFeePct : null,
          feeAsOfDate: normalizeDate(row.feeAsOfDate),
          benchmark: row.benchmark || 'Not stated',
          etfProxy: row.etfProxy || '',
          structureType: row.lookthrough?.structureType || '',
          structureLabel: structureLabel(row.lookthrough?.structureType),
          externalManager: row.lookthrough?.externalManager || 'Not stated',
          sourceUrl: row.feeSource?.url || '#',
          sourcePage: row.feeSource?.page ? Number(row.feeSource.page) : null,
          sourceNote: row.feeSource?.note || '',
        })),
    [data.rows],
  )

  const insurers = Array.from(new Set(verifiedRows.map((row) => row.insurer))).sort()
  const feeLabels = Array.from(new Set(verifiedRows.map((row) => row.annualFeeLabel))).sort()
  const structures = Array.from(new Set(verifiedRows.map((row) => row.structureLabel))).sort()
  const asOfDates = Array.from(new Set(verifiedRows.map((row) => row.feeAsOfDate))).sort((a, b) => a.localeCompare(b))
  const numericFees = verifiedRows
    .map((row) => row.annualFeePct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b)
  const medianFee = numericFees.length
    ? (numericFees.length % 2 === 0
      ? (numericFees[numericFees.length / 2 - 1] + numericFees[numericFees.length / 2]) / 2
      : numericFees[Math.floor(numericFees.length / 2)])
    : null

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [insurer, setInsurer] = useState('all')
  const [feeLabel, setFeeLabel] = useState('all')
  const [asOfDate, setAsOfDate] = useState('all')
  const [structure, setStructure] = useState('all')
  const [sort, setSort] = useState<SortMode>('fee-asc')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [selectedRow, setSelectedRow] = useState<IlpMasterRow | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fundId = params.get('fund')
    if (!fundId) return
    const match = verifiedRows.find((row) => row.id === fundId)
    if (match) setSelectedRow(match.raw)
  }, [verifiedRows])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (selectedRow) {
      url.searchParams.set('fund', selectedRow.id)
    } else {
      url.searchParams.delete('fund')
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [selectedRow])

  const visibleRows = verifiedRows
    .filter((row) => {
      const query = deferredSearch.trim().toLowerCase()
      if (insurer !== 'all' && row.insurer !== insurer) return false
      if (feeLabel !== 'all' && row.annualFeeLabel !== feeLabel) return false
      if (asOfDate !== 'all' && row.feeAsOfDate !== asOfDate) return false
      if (structure !== 'all' && row.structureLabel !== structure) return false
      if (quickFilter === 'low-fee' && ((row.annualFeePct ?? Number.POSITIVE_INFINITY) > 1)) return false
      if (quickFilter === 'proxy' && !row.etfProxy) return false
      if (quickFilter === 'manager' && (!row.externalManager || row.externalManager === 'Not stated')) return false

      if (!query) return true
      const haystack = [
        row.insurer,
        row.subFund,
        row.annualFeeLabel,
        row.benchmark,
        row.etfProxy,
        row.structureLabel,
        row.externalManager,
        row.feeAsOfDate,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .sort((left, right) => {
      if (sort === 'fee-desc') return compareNullable(left.annualFeePct, right.annualFeePct, 'desc')
      if (sort === 'alpha') return left.subFund.localeCompare(right.subFund)
      if (sort === 'insurer') {
        const insurerCompare = left.insurer.localeCompare(right.insurer)
        if (insurerCompare !== 0) return insurerCompare
        return left.subFund.localeCompare(right.subFund)
      }
      return compareNullable(left.annualFeePct, right.annualFeePct, 'asc')
    })

  const lowFeeCount = verifiedRows.filter((row) => (row.annualFeePct ?? Infinity) <= 1).length
  const etfProxyCount = verifiedRows.filter((row) => Boolean(row.etfProxy)).length
  const managerShownCount = verifiedRows.filter((row) => row.externalManager && row.externalManager !== 'Not stated').length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            ILP OCF dashboard
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Search source-cited ILP sub-fund fees
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            This page uses OCF as shorthand for the sub-fund fee layer, but the dataset preserves the insurer’s reported metric exactly. Compare rows within the same fee label and as-of date where possible.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Coverage
          </div>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-baseline justify-between gap-4">
              <span>Verified fee rows</span>
              <strong className="text-xl text-foreground">{verifiedRows.length}</strong>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span>Insurers covered</span>
              <strong className="text-lg text-foreground">{insurers.length}</strong>
            </div>
            <p className="leading-6">
              Total top-level ILP roster in the shared dataset: <strong className="text-foreground">{data.coverage.rowCount}</strong>. This page only screens rows with an exact fee verification status.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Median fee</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{medianFee == null ? 'N/A' : `${medianFee.toFixed(2)}%`}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Calculated across verified rows only, without standardising different fee metric definitions.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Fee at or below 1.00%</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{lowFeeCount}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Useful for quickly finding lower-cost rows before comparing labels and source dates.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">ETF proxy mapped</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{etfProxyCount}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Rows that also have a benchmark proxy mapped in the shared ILP research pipeline.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Manager shown</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{managerShownCount}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Counts rows where the official insurer source explicitly names a manager, whether internal or external.</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. AIA, Global Bond, Fidelity, Expense Ratio"
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
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Fee label</span>
          <select value={feeLabel} onChange={(event) => setFeeLabel(event.target.value)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="all">All fee labels</option>
            {feeLabels.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">As of date</span>
          <select value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="all">All dates</option>
            {asOfDates.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Structure</span>
          <select value={structure} onChange={(event) => setStructure(event.target.value)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="all">All structures</option>
            {structures.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-11 rounded-lg border bg-background px-3 text-sm">
            <option value="fee-asc">Lowest fee</option>
            <option value="fee-desc">Highest fee</option>
            <option value="alpha">A to Z</option>
            <option value="insurer">Insurer</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'All verified fees'],
          ['low-fee', 'Fee at or below 1.00%'],
          ['proxy', 'Has ETF proxy'],
          ['manager', 'Manager shown'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setQuickFilter(value as QuickFilter)}
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
        <span>Verified fee rows only</span>
        <span>{asOfDate === 'all' ? 'All dates' : `As of: ${asOfDate}`}</span>
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="leading-6">
            This is a screening view, not a perfectly standardised OCF league table. Compare rows within the same reported label, such as <strong className="text-foreground">Expense Ratio</strong>, <strong className="text-foreground">Management Fee</strong>, or <strong className="text-foreground">Continuing Investment Charge</strong>, and keep the source date visible when comparing across insurers.
          </p>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-sm lg:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-4 py-3">Sub-fund</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Reported label</th>
              <th className="px-4 py-3">As of</th>
              <th className="px-4 py-3">Structure</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRow(row.raw)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedRow(row.raw)
                  }
                }}
                className="cursor-pointer border-b align-top transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{row.subFund}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.insurer} • {row.externalManager}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.etfProxy || 'No ETF proxy mapped'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(row.raw)}
                    className="mt-2 text-xs font-medium text-foreground underline underline-offset-2"
                  >
                    Open details
                  </button>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{row.annualFeeDisplay}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{row.annualFeePct == null ? 'N/A' : `${row.annualFeePct.toFixed(2)}% numeric`}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{row.annualFeeLabel}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.benchmark}</div>
                </td>
                <td className="px-4 py-4 text-foreground">{row.feeAsOfDate}</td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{row.structureLabel}</div>
                </td>
                <td className="px-4 py-4">
                  <a
                    href={sourceHref(row.insurer, row.sourceUrl, row.sourcePage)}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-foreground underline underline-offset-2"
                  >
                    {row.sourcePage ? `Fee p. ${row.sourcePage}` : 'Source'}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {row.sourceNote && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.sourceNote}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {visibleRows.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
            No rows match the current filters.
          </div>
        )}
        {visibleRows.map((row) => (
          <article
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedRow(row.raw)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setSelectedRow(row.raw)
              }
            }}
            className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">{row.subFund}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{row.insurer}</p>
                <button
                  type="button"
                  onClick={() => setSelectedRow(row.raw)}
                  className="mt-2 text-xs font-medium text-foreground underline underline-offset-2"
                >
                  Open details
                </button>
              </div>
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-foreground">
                {row.annualFeeDisplay}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Label</dt>
                <dd className="mt-1 text-foreground">{row.annualFeeLabel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">As of</dt>
                <dd className="mt-1 text-foreground">{row.feeAsOfDate}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Structure</dt>
                <dd className="mt-1 text-foreground">{row.structureLabel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Manager</dt>
                <dd className="mt-1 text-foreground">{row.externalManager}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-1">
              <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Benchmark / proxy</div>
              <div className="text-sm text-foreground">{row.benchmark}</div>
              <div className="text-xs text-muted-foreground">{row.etfProxy || 'No ETF proxy mapped'}</div>
            </div>

            <a
              href={sourceHref(row.insurer, row.sourceUrl, row.sourcePage)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
              className="mt-4 inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-2"
            >
              {row.sourcePage ? `Open source (p. ${row.sourcePage})` : 'Open source'}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>

      <IlpSubfundDetailSheet row={selectedRow} open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)} />
    </div>
  )
}
