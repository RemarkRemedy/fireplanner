import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, ExternalLink, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePageMeta } from '@/hooks/usePageMeta'
import leaderboardData from '@/lib/data/generated/ilpLeaderboard.json'

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

const rows = leaderboardData as LeaderboardRow[]

type SortKey = 'netFeeDragPct' | 'totalFeesCharged' | 'totalBonusesReceived' | 'bestExitYear' | 'mipLength' | 'insurer' | 'productName'
type SortDir = 'asc' | 'desc'

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
  const [filterInsurer, setFilterInsurer] = useState<string | null>(null)
  const [filterPremiumType, setFilterPremiumType] = useState<'all' | 'regular' | 'single'>('all')

  const insurers = useMemo(() => {
    const set = new Set(rows.map((r) => r.insurer))
    return Array.from(set).sort()
  }, [])

  function handleToggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = rows

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) =>
        r.productName.toLowerCase().includes(q)
        || r.insurer.toLowerCase().includes(q)
        || r.variantLabel.toLowerCase().includes(q),
      )
    }

    if (filterInsurer) {
      result = result.filter((r) => r.insurer === filterInsurer)
    }

    if (filterPremiumType !== 'all') {
      result = result.filter((r) => r.premiumType === filterPremiumType)
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = typeof aVal === 'string'
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [search, filterInsurer, filterPremiumType, sortKey, sortDir])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ILP Product Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Compare net fee drag across {rows.length} product variants from {insurers.length} insurers.
          Standardized at S$350/mo premium, policy year 1, mid return scenario.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filterInsurer ?? ''}
          onChange={(e) => setFilterInsurer(e.target.value || null)}
        >
          <option value="">All insurers</option>
          {insurers.map((insurer) => (
            <option key={insurer} value={insurer}>{insurer}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filterPremiumType}
          onChange={(e) => setFilterPremiumType(e.target.value as 'all' | 'regular' | 'single')}
        >
          <option value="all">All premium types</option>
          <option value="regular">Regular premium</option>
          <option value="single">Single premium</option>
        </select>
        <span className="text-sm text-muted-foreground">{filtered.length} results</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
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
                    <SortButton field="netFeeDragPct" label="Net Fee Drag %" activeKey={sortKey} onToggle={handleToggleSort} />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortButton field="totalFeesCharged" label="Gross Fees" activeKey={sortKey} onToggle={handleToggleSort} />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortButton field="totalBonusesReceived" label="Bonus Offset" activeKey={sortKey} onToggle={handleToggleSort} />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortButton field="bestExitYear" label="Lowest-Fee Exit Yr" activeKey={sortKey} onToggle={handleToggleSort} />
                  </th>
                  <th className="px-3 py-3 text-center">Type</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={`${row.productId}-${row.variantId}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-3 text-muted-foreground">{row.insurer}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.productName}</div>
                      <div className="text-xs text-muted-foreground">{row.variantLabel}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.mipBasis === 'open-ended' ? 'Open' : row.mipLength != null ? `${row.mipLength} yr` : 'N/A'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium">
                      {formatPercent(row.netFeeDragPct)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatCurrency(row.totalFeesCharged, row.currency)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.bonusModellingStatus === 'metadata-only' ? (
                        <span className="text-amber-600" title="Bonus data unavailable">
                          *
                        </span>
                      ) : row.totalBonusesReceived > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(row.totalBonusesReceived, row.currency)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.bestExitYear}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={row.premiumType === 'single' ? 'secondary' : 'outline'}>
                        {row.premiumType === 'single' ? 'Single' : 'Regular'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Link to={`/ilp-fees/story/${row.productId}`}>
                        <Button variant="ghost" size="sm" className="gap-1">
                          View
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      No products match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footnotes */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>* Products marked with * do not have bonus modelling. Their net fee drag may be overstated.</p>
        <p>
          All values assume S$350/mo premium (regular) or catalog default (single premium), policy year 1, 0 months paid, mid return scenario, full horizon (MIP + 10 post-MIP years).
          Your personal numbers may differ. Use the Exit Calculator for personalized analysis.
        </p>
        <p>Not financial advice. Consult a licensed financial adviser before making policy decisions.</p>
      </div>
    </div>
  )
}
