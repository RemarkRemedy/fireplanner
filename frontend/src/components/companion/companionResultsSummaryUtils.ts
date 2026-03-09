import { formatPercent } from '@/lib/utils'

export function formatWRBand(
  low: number | null,
  mid: number | null,
  high: number | null,
): string {
  if (mid == null) return '\u2014'
  if (low != null && high != null) {
    return `${formatPercent(low, 1)} / ${formatPercent(mid, 1)} / ${formatPercent(high, 1)}`
  }
  return formatPercent(mid, 1)
}
