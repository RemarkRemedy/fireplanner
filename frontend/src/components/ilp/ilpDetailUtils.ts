import type { IlpMasterRow } from '@/components/ilp/types'

export function pdfPageTarget(insurer: string, pageLabel?: number | null): number | null {
  if (pageLabel == null) return null
  if (insurer === 'Great Eastern') return pageLabel + 2
  return pageLabel
}

export function sourceHref(insurer: string, url?: string, page?: string | number | null): string {
  if (!url) return '#'
  const pageLabel = typeof page === 'string' ? Number(page) : page
  const pageTarget = pdfPageTarget(insurer, pageLabel ?? null)
  if (pageTarget && /\.pdf($|\?)/i.test(url)) {
    return `${url}#page=${pageTarget}`
  }
  return url
}

export function normalizeDate(value?: string | null): string {
  const raw = (value ?? '').trim()
  if (!raw) return 'Not stated'
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return new Intl.DateTimeFormat('en-SG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }
  const match = raw.match(/^(\d{1,2})\s([A-Z][a-z]{2})\s(\d{4})$/)
  if (!match) return raw
  const monthMap: Record<string, string> = {
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    May: 'May',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December',
  }
  return `${Number(match[1])} ${monthMap[match[2]]} ${match[3]}`
}

export function structureLabel(value?: string | null): string {
  const text = (value ?? '').trim()
  if (!text) return 'Not stated'
  const map: Record<string, string> = {
    direct: 'Direct fund',
    feeder: 'Feeder fund',
    fund_of_funds: 'Fund of funds',
    direct_external_manager: 'Direct external manager',
    direct_internal: 'Direct internal',
    feeder_via_underlying_subfund: 'Feeder via underlying sub-fund',
    feeder_multi: 'Multi-feeder',
    feeder_of_feeder: 'Feeder of feeder',
    multi_manager_direct: 'Multi-manager direct',
    'multi-manager': 'Multi-manager',
    multi_manager: 'Multi-manager',
    'feeder via underlying entity': 'Feeder via underlying entity',
  }
  return map[text] ?? text.replace(/_/g, ' ')
}

export function benchmarkTypeLabel(benchmark?: string | null): string {
  const text = (benchmark ?? '').toLowerCase()
  if (!text || text === 'not benchmarked') return 'Not benchmarked'
  const hasEquity = /(msci|ftse|s&p|stoxx|russell|nikkei|equity|shares|stock|acwi|index with net dividends|csi)/.test(text)
  const hasFixedIncome = /(bond|iboxx|albi|sora|gov|government|credit|aggregate|treasury|fixed income|liquidity)/.test(text)
  if (hasEquity && hasFixedIncome) return 'Multi-asset benchmark'
  if (hasFixedIncome) return 'Fixed income benchmark'
  if (hasEquity) return 'Equity benchmark'
  return 'Custom or unspecified benchmark'
}

export function benchmarkMixLabel(benchmark?: string | null): string {
  const text = (benchmark ?? '').trim()
  if (!text || text.toLowerCase() === 'not benchmarked') return 'Not benchmarked'
  const pairMatch = text.match(/(\d{1,3})%\s+.+?&\s*(\d{1,3})%\s+/i)
  if (pairMatch) {
    return `${pairMatch[1]}% / ${pairMatch[2]}% benchmark split`
  }
  const lower = text.toLowerCase()
  if (/(bond|iboxx|albi|aggregate|gov|treasury|credit|fixed income|sora|liquidity)/.test(lower) && !/(msci|ftse|s&p|stoxx|russell|nikkei|equity|stock|shares)/.test(lower)) {
    return '100% fixed income'
  }
  if (/(msci|ftse|s&p|stoxx|russell|nikkei|equity|stock|shares|acwi|csi)/.test(lower) && !/(bond|iboxx|albi|aggregate|gov|treasury|credit|fixed income|sora|liquidity)/.test(lower)) {
    return '100% equity'
  }
  return 'Benchmark-based mix not clear'
}

export function shareClassKindLabel(row: IlpMasterRow): string {
  const text = `${row.subFund} ${row.returns?.shareClassOrCurrency ?? ''}`.toLowerCase()
  if (text.includes('distribution')) return 'Distribution'
  if (text.includes('accumulation')) return 'Accumulation'
  if (text.includes(' usd')) return 'USD share class'
  if (text.includes(' sgd')) return 'SGD share class'
  return 'Share-class style not stated'
}

export function identityChips(row: IlpMasterRow): string[] {
  const chips = new Set<string>()
  if (row.returns?.fundFamily) chips.add(`Family: ${row.returns.fundFamily}`)
  if (row.returns?.shareClassOrCurrency) chips.add(row.returns.shareClassOrCurrency)
  const classKind = shareClassKindLabel(row)
  if (classKind !== 'Share-class style not stated') chips.add(classKind)
  return Array.from(chips)
}

export function comparisonQualityLabel(value?: string | null): string {
  const text = (value ?? '').trim().toLowerCase()
  if (!text) return 'Not stated'
  if (text === 'high') return 'High confidence'
  if (text === 'medium') return 'Medium confidence'
  if (text === 'low') return 'Low confidence'
  return text
}
